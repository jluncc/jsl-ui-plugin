// 打包 dist/ 为可上传 Chrome Web Store 的 zip（manifest.json 必须在压缩包根目录）。
// 用法: pnpm package  →  产出 release/jsl-ui-plugin-<version>.zip
import { readFile, mkdir, rm, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'release');

// manifest.json 缺失通常意味着忘了先 pnpm build
await stat(join(dist, 'manifest.json')).catch(() => {
  console.error('dist/manifest.json 不存在，请先运行 pnpm build');
  process.exit(1);
});

const { version } = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'));
const target = join(outDir, `jsl-ui-plugin-${version}.zip`);

await mkdir(outDir, { recursive: true });
await rm(target, { force: true });

// 用系统 zip 而不是第三方包：仓库零运行时依赖的约束同样适用于构建脚本。
// -X 去掉扩展属性；排除 .DS_Store / __MACOSX / ._ 资源叉文件——商店会因这些杂项拒收。
await exec('zip', ['-r', '-X', '-q', target, '.', '-x', '.*', '*/.*', '__MACOSX/*'], {
  cwd: dist,
});

const { size } = await stat(target);
console.log(`已打包 release/jsl-ui-plugin-${version}.zip（${(size / 1024).toFixed(1)}KB）`);
