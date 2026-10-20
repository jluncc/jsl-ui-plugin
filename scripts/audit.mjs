#!/usr/bin/env node
/**
 * 定期体检：性能 / 安全 / CSS 冗余。
 * 用法: pnpm audit:code    （零依赖，直接读源码，不跑浏览器）
 *
 * 只报告这四类高价值信号，避免噪音：
 *   1. 危险 API（innerHTML 读取式重排、eval、文档写入）
 *   2. window.open / target=_blank 缺 noopener
 *   3. CSS 重复选择器与 transition: all
 *   4. 体积预算（content.js / 三段 CSS）
 * 有 error 时退出码 1，便于后续接 CI 或 git hook。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const problems = [];
const warnings = [];

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const walk = (dir, out = []) => {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};

const tsFiles = walk('src').filter((f) => f.endsWith('.ts'));
const cssFiles = walk('src/styles').filter((f) => f.endsWith('.css'));

// ---- 1/2. 源码安全与性能信号 ----
for (const file of tsFiles) {
  const src = read(file);
  src.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (/\.innerHTML\s*=/.test(line)) {
      warnings.push(`${at}  innerHTML 赋值——确认内容可信；更常用 createElement/append 移动节点`);
    }
    if (/\beval\(|new Function\(/.test(line)) {
      problems.push(`${at}  使用 eval / new Function`);
    }
    if (/document\.write\(/.test(line)) {
      problems.push(`${at}  使用 document.write`);
    }
    if (/window\.open\(/.test(line) && !/noopener/.test(line)) {
      problems.push(`${at}  window.open 缺少 noopener/noreferrer`);
    }
    if (/target\s*=\s*['"]_blank/.test(line) && !/noopener/.test(line)) {
      warnings.push(`${at}  target=_blank 未带 rel=noopener（静态 HTML 可接受）`);
    }
  });

  // 仅在 forEach 回调内部挂监听才算「逐元素监听」：从 forEach 起找到配对的 }) 为止
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const open = line.indexOf('.forEach(');
    if (open < 0) return;
    let depth = 0;
    let started = false;
    for (let j = i; j < Math.min(i + 40, lines.length); j++) {
      for (const ch of lines[j]) {
        if (ch === '(' || ch === '{') {
          depth++;
          started = true;
        } else if (ch === ')' || ch === '}') depth--;
      }
      if (j > i && started && depth <= 0) {
        const body = lines.slice(i, j + 1).join('\n');
        if (/addEventListener\(/.test(body)) {
          warnings.push(
            `${file}:${i + 1}  forEach 内 addEventListener（可考虑事件委托；单次绑定可忽略）`,
          );
        }
        break;
      }
    }
  });
}

// ---- 3. CSS 冗余 ----
for (const file of cssFiles) {
  const src = read(file);
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/transition:\s*all\b/.test(body)) {
    problems.push(`${file}  transition: all（触发全属性动画，改显式属性）`);
  }
  const seen = new Map();
  for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@')) continue;
    for (const part of sel.split(',')) {
      const key = part.trim();
      const decl = m[2].replace(/\s+/g, ' ').trim();
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(decl);
    }
  }
  // 只有「声明完全相同」的重复才是可安全删除的冗余；
  // 同一选择器分多条规则写（基础 + 响应式/状态补丁）是正常分层，不报。
  const exact = [...seen]
    .filter(([, decls]) => decls.length > 1 && new Set(decls).size < decls.length)
    .sort((a, b) => b[1].length - a[1].length);
  if (exact.length) {
    warnings.push(
      `${file}  ${exact.length} 个选择器声明完全重复（可删，前 5: ${exact
        .slice(0, 5)
        .map(([s]) => s.slice(-40))
        .join(' | ')}）`,
    );
  }
}

// ---- 4. 体积预算 ----
// 预算随覆盖页面增长：现含门户/列表/详情/登录注册/通知/私信/个人主页/设置（8 个 tab）/
// 日历/数据页/搜索结果/关注面板/话题页与话题广场（含数据页 tab/附属块对齐增强）。新增整页样式时先评估是否复用既有卡片语言，再按实际需要上调
const BUDGET = { contentJs: 37 * 1024, cssTotal: 300 * 1024 };
const cssBytes = cssFiles.reduce((n, f) => n + statSync(join(ROOT, f)).size, 0);
const distContent = (() => {
  try {
    return statSync(join(ROOT, 'dist/scripts/content.js')).size;
  } catch {
    return null;
  }
})();
if (distContent !== null && distContent > BUDGET.contentJs) {
  problems.push(`dist/scripts/content.js ${distContent}B 超出预算 ${BUDGET.contentJs}B`);
}
if (cssBytes > BUDGET.cssTotal) {
  problems.push(`CSS 总计 ${cssBytes}B 超出预算 ${BUDGET.cssTotal}B`);
}

// ---- 报告 ----
const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
console.log('JSL Polish · 非功能性体检\n');
console.log(`源码: ${tsFiles.length} 个 TS 文件 / ${cssFiles.length} 个 CSS 文件`);
console.log(`CSS 合计 ${kb(cssBytes)}（预算 ${kb(BUDGET.cssTotal)}）`);
console.log(
  distContent !== null
    ? `content.js ${kb(distContent)}（预算 ${kb(BUDGET.contentJs)}）\n`
    : 'content.js 未构建（先 pnpm build）\n',
);

if (problems.length) {
  console.log(`✗ 必须修复 (${problems.length})`);
  for (const p of problems) console.log('  ' + p);
  console.log();
}
if (warnings.length) {
  console.log(`△ 需要确认 (${warnings.length})`);
  for (const w of warnings) console.log('  ' + w);
  console.log();
}
if (!problems.length && !warnings.length) console.log('✓ 未发现问题');
process.exit(problems.length ? 1 : 0);
