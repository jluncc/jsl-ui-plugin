# JSL Polish · 集思录现代化

为 [集思录](https://www.jisilu.cn/) 社区带来现代化界面的 Chrome 扩展，思路致敬 [V2EX_Polish](https://github.com/coolpace/V2EX_Polish)。

## 功能

- **深色 / 浅色双主题**：跟随系统自动切换（也可在设置中强制），`document_start` 阶段同步定题，无闪白；header 右侧有太阳/月亮快捷切换按钮；两套主题共享同一布局，仅配色不同
- **顶栏重排**：站方"深色条+白色条"两行重排为单行通栏（深色条/浅色无底），「集思录」字标与正文卡片对齐，按钮间距统一
- **帖子列表**（v0.2 按手绘稿重构）：两行导航（分类+话题 / 排序）并入列表卡片顶部；整行可点击、回复数胶囊与内容对齐、话题 chip、两端留白实线分隔、胶囊分页器
- **侧栏精简**：仅「集思录会员」（价目并入卡内）与「热门话题」两卡；隐藏微信浮窗与站方回顶按钮
- **帖子详情**：正文排版（15px / 1.75 行高）、引用块与代码块美化、回复卡片化（头像居左、楼层号）、回到顶部（滚动 600px 后出现）
- **总开关与模块开关**：设置页可关闭单个模块，或一键恢复站方原生界面

范围：社区（WeCenter）页面——广场、帖子详情、话题、个人主页等。数据页（可转债/LOF 等）为二期规划。

## 安装（开发者模式）

1. `pnpm install && pnpm build`
2. 打开 `chrome://extensions/`，开启右上角「开发者模式」
3. 「加载已解压的扩展程序」→ 选择本项目的 `dist/` 目录
4. 访问 [集思录广场](https://www.jisilu.cn/explore/) 查看效果；点击工具栏图标进入设置

## 开发

```bash
pnpm dev     # watch 模式，改完在扩展页点刷新 + 刷新网页
pnpm build   # 构建 dist/
pnpm lint    # eslint + tsc 类型检查
pnpm format  # prettier
```

### 调试技巧

- `scripts/preview.sh <页面快照> <名字> [light|dark]`：把下载的页面 HTML 加上扩展样式生成本地预览页，配合无头 Chrome 截图可在不装扩展的情况下快速验证样式
- 深浅主题由 `<html data-theme="dark|light">` 驱动，DevTools 里手动改这个属性即可切换预览

## 技术栈

TypeScript + tsup + pnpm。**运行时依赖 0 个**，开发依赖仅 typescript / tsup / @types/chrome / eslint 系 / prettier。

架构要点：

- MV3 content script（`document_start`）按 DOM 特征识别页面类型，在 `<html>` 上挂 `jsl` / `jsl-community` 等标志类，全部 CSS 挂钩在这些标志下——总开关就是移除一个 class
- 主题色板走 CSS custom properties（`src/styles/tokens.css`），深浅两套令牌，红涨绿跌语义色保留
- 集思录社区是 Bootstrap 2 + jQuery + WeCenter 的老式浮动布局，扩展通过 flex 重排 + 定向 `!important` 覆盖（内容脚本的样式晚于站方样式生效）

## 目录结构

```
├── manifest.json            # MV3 清单（静态手写）
├── static/                  # 构建时原样复制进 dist（图标、options.html）
├── scripts/                 # preview.sh 等开发辅助
└── src/
    ├── content/
    │   ├── index.ts         # 入口：页面识别、设置应用、模块分发
    │   ├── theme.ts         # 主题解析 + 防闪白 + 系统偏好监听
    │   └── modules/         # list.ts / detail.ts（DOM 增强）
    ├── options/             # 设置页
    ├── background/          # 点击工具栏图标打开设置
    ├── shared/settings.ts   # 设置 schema + chrome.storage 封装
    └── styles/              # tokens / global / community 三段式 CSS
```

## 路线图

- [ ] 二期：数据页表格美化（可转债 / LOF / ETF——sticky 表头、斑马纹、hover、tabular-nums）
- [ ] 增值功能（按实际痛点选）：用户标签、屏蔽用户、回复高亮自己的发言、时间相对化
- [ ] 登录态页面的深度适配（发帖页、个人中心）

## 已知边界

- 站方公告横幅等内容为 AJAX 注入，已做样式适配；若站方改版可能需要补充选择器
- 首次从设置页切换主题后，已打开的旧页面以 localStorage 缓存为准，下次刷新完全生效
