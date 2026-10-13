#!/usr/bin/env bash
# 生成本地预览页：集思录页面快照 + JSL Polish 样式，用于无头 Chrome 截图验收。
# 用法: ./scripts/preview.sh <快照html> <输出名> [light|dark]
set -euo pipefail

SNAPSHOT="$1"
NAME="$2"
THEME="${3:-light}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="/tmp/jsl-preview"
mkdir -p "$OUT"

python3 - "$SNAPSHOT" "$OUT/$NAME.html" "$THEME" "$ROOT" <<'PY'
import sys

src, dst, theme, root = sys.argv[1:5]
html = open(src, encoding="utf-8").read()

css = ""
for name in ("tokens.css", "global.css", "community.css"):
    css += open(f"{root}/src/styles/{name}", encoding="utf-8").read() + "\n"

# 模拟 content script 全部 DOM 增强（与 src/content 保持一致）
inject_style = f"<style>{css}</style>"

# 页面标志按快照内容判断，而不是文件名
flags = "jsl jsl-community"
if "aw-question-list" in html:
    flags += " jsl-page-list"
if "aw-question-detail-box" in html:
    flags += " jsl-page-detail"

sim = """
<script>
(function () {
  // polishHeaderLinks：清理「»首 页」装饰；「首页」入口去掉（logo 即首页）、「社区-知识库」简化为「社区」
  document.querySelectorAll('.span6.aw-logo > a[href]:not(:first-child)').forEach(function (link) {
    var text = (link.textContent || '').replace(/»/g, '').replace(/\\s+/g, '');
    if (!text) return;
    if (text === '首页') { link.hidden = true; return; }
    if (text.indexOf('社区') === 0) { link.textContent = '社区'; return; }
    link.textContent = text;
  });

  // injectThemeToggle：注入主题切换按钮；预览版点击直接翻转 data-theme
  var wrap = document.querySelector('.aw-top-menu-wrap');
  if (wrap && !wrap.querySelector('.jsl-theme-toggle')) {
    var SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    var MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    var b = document.createElement('button');
    b.className = 'jsl-theme-toggle';
    b.type = 'button';
    var syncBtn = function () {
      var dark = document.documentElement.dataset.theme === 'dark';
      b.title = dark ? '切换到浅色模式' : '切换到深色模式';
      b.innerHTML = dark ? SUN : MOON;
    };
    b.addEventListener('click', function () {
      var root = document.documentElement;
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      syncBtn();
    });
    syncBtn();
    wrap.appendChild(b);
  }

  // list.ts：卡片顶部两行导航——第一行分类+话题，第二行排序
  var list = document.querySelector('.aw-question-list');
  if (list) {
    var catUl = document.querySelector('.row.category ul');
    var sortUl = document.querySelector('.aw-main-content > .aw-reset-nav-tabs');
    var picked = {};
    [[catUl, 'cat'], [sortUl, 'sort']].forEach(function (p) {
      if (!p[0]) return;
      p[0].querySelectorAll('li').forEach(function (li) {
        var href = (li.querySelector('a') || {}).getAttribute ? (li.querySelector('a').getAttribute('href') || '') : '';
        var dim = p[1] === 'sort' && href.indexOf('/topic/') >= 0 ? 'topic' : p[1];
        li.setAttribute('data-dim', dim);
        var key = (li.textContent || '').replace(/\\s+/g, '');
        if (key && !picked[key]) picked[key] = li;
      });
    });
    var head = document.createElement('div');
    head.className = 'jsl-card-head';
    var rowMain = document.createElement('div');
    rowMain.className = 'jsl-card-head-row';
    var rowSort = document.createElement('div');
    rowSort.className = 'jsl-card-head-row jsl-card-head-sort';
    head.appendChild(rowMain);
    head.appendChild(rowSort);
    ['全部','债券/可转债','基金','套利','新股','闲聊','新手专区'].forEach(function (k) {
      if (picked[k]) rowMain.appendChild(picked[k]);
    });
    ['最新','热门','按发表时间'].forEach(function (k) {
      if (picked[k]) rowSort.appendChild(picked[k]);
    });
    Object.keys(picked).forEach(function (k) {
      if (!rowMain.contains(picked[k]) && !rowSort.contains(picked[k])) rowMain.appendChild(picked[k]);
    });
    list.insertBefore(head, list.firstChild);
    var rc = document.querySelector('.row.category');
    if (rc) rc.remove();
    if (sortUl) sortUl.remove();

    // list.ts：价目条并入侧栏会员卡（标题之下、购买行之上）
    var promo = document.querySelector('.aw-main-content > .aw-item[style]');
    if (promo) {
      promo.classList.add('jsl-promo', 'jsl-promo-merged');
      var note = promo.querySelector("span[style*='color:#999']");
      if (note) {
        var welfareLink = note.parentElement && note.parentElement.nextElementSibling
          ? note.parentElement.nextElementSibling.querySelector('a') : null;
        if (welfareLink) welfareLink.textContent = '会员优惠 • 会员福利';
        note.remove();
      }
      var mc = document.querySelector(".aw-side-bar > div[style*='jsl_bg_member_info']");
      if (mc) mc.insertBefore(promo, mc.lastElementChild);
      else {
        var sb = document.querySelector('.aw-side-bar');
        if (sb) sb.prepend(promo);
      }
    }
  }

  // detail.ts：楼层号 + 回到顶部 + 长回复折叠（与真实扩展一致：滚动 600px 后出现）
  document.querySelectorAll('.aw-dynamic-topic > .aw-item').forEach(function (el, i) {
    var s = document.createElement('span');
    s.className = 'jsl-floor';
    s.textContent = '#' + (i + 2);
    el.appendChild(s);
  });
  var top = document.createElement('button');
  top.className = 'jsl-back-top';
  top.type = 'button';
  top.title = '回到顶部';
  top.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  top.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  var toggleTop = function () {
    top.classList.toggle('jsl-show', window.scrollY > 600);
  };
  window.addEventListener('scroll', toggleTop, { passive: true });
  toggleTop();
  document.body.appendChild(top);

  // 长回复折叠
  document.querySelectorAll('.aw-dynamic-topic > .aw-item').forEach(function (item) {
    var content = item.querySelector('.aw-dynamic-topic-content');
    if (!content) return;
    var btn = document.createElement('button');
    btn.className = 'jsl-reply-expand-btn';
    btn.type = 'button';
    btn.textContent = '展开回复';
    btn.addEventListener('click', function () {
      var collapsed = item.classList.toggle('jsl-reply-collapsed');
      btn.textContent = collapsed ? '展开回复' : '收起回复';
      // 收起后内容大幅缩短，视口可能停在已消失的区域；滚到整条回复可见
      if (collapsed) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    var evaluateFold = function () {
      if (content.scrollHeight > 500) {
        // 按钮已挂载说明初判已折叠，复检不再动状态，避免覆盖用户手动展开/收起
        if (!btn.isConnected) {
          item.classList.add('jsl-reply-collapsed');
          // 插进正文容器末尾（meta 行之后）：item/mod-body 都是 flex 行，
          // 插在外面会变成同排 flex 子项；容器内部是普通文档流，
          // 展开态按钮才能块级独占一行。收起态按钮绝对定位，不受容器
          // overflow:hidden 影响，照常浮在渐隐区上
          content.insertAdjacentElement('beforeend', btn);
        }
      } else {
        item.classList.remove('jsl-reply-collapsed');
        btn.remove();
      }
    };
    evaluateFold();
    content.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) {
        img.addEventListener('load', evaluateFold, { once: true });
        img.addEventListener('error', evaluateFold, { once: true });
      }
    });
  });
})();
</script>
"""

# 插入 base 让相对资源指向线上；样式注到 head 末尾（真实扩展的 CSS 也晚于站方生效）
if "</head>" in html:
    html = html.replace("</head>", f"<base href='https://www.jisilu.cn/'>{inject_style}</head>", 1)
else:
    html = inject_style + html

html = html.replace("<html", f"<html data-theme='{theme}' class='{flags}' ", 1)
html = html.replace("</body>", sim + "</body>", 1)

open(dst, "w", encoding="utf-8").write(html)
print(dst)
PY
