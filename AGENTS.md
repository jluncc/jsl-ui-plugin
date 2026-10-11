# AGENTS.md · JSL Polish 开发指引

给后续接手本项目的 AI agent / 协作者。读完这页可以跳过大部分摸索成本——特别是「站方样式陷阱」一节，全部是实测踩坑结论。

## 项目是什么

为 [集思录](https://www.jisilu.cn/) 社区（WeCenter / Bootstrap 2 / jQuery 老站）做界面现代化的 Chrome MV3 扩展。零运行时依赖，TypeScript + tsup + pnpm。当前版本 0.2.0：列表页布局已按用户手绘稿完成重构并通过逐项验收，详情页为早期状态（见「待办」）。

## 常用命令

```bash
pnpm dev     # watch 构建，改完在 chrome://extensions/ 点刷新 + 刷新网页
pnpm build   # 构建 dist/（加载已解压扩展用 dist/）
pnpm lint    # eslint + tsc --noEmit
pnpm format  # prettier
```

改动 CSS/TS 后务必 `pnpm build`，dist 是手写 manifest + tsup 产物 + static/ 拷贝。

## 架构

- **content script（document_start）**：`src/content/index.ts` 按 DOM 特征在 `<html>` 上挂 `jsl` / `jsl-community` / `jsl-page-list` / `jsl-page-detail` 标志类。全部 CSS 挂钩在这些类下——**总开关 = 移除一个 class**。
- **样式三段式**：`src/styles/tokens.css`（深浅两套 CSS 变量，`html[data-theme]` 切换）→ `global.css`（顶栏/页脚/通用）→ `community.css`（列表/详情/侧栏）。顶栏颜色单独走 `--jsl-header-*` 令牌组。
- **DOM 增强**：`src/content/modules/list.ts`（合并导航、侧栏重排）、`detail.ts`（楼层号、回顶按钮）、`theme-toggle.ts`（顶栏主题切换按钮）。
- **设置**：`src/shared/settings.ts`，chrome.storage.sync，含总开关与模块开关；options 页在 `static/options.html`。

## 预览与验收工作流（不装扩展即可验证样式）

1. 页面快照放在 `/tmp/jsl-preview/raw-list.html`、`raw-detail.html`（SavePage 下载后剥净注入的产物，勿带 `<style>` 注入与探针脚本）。
2. `./scripts/preview.sh /tmp/jsl-preview/raw-list.html r5-list dark` 生成 `/tmp/jsl-preview/r5-list.html`——快照 + 最新三段 CSS + **模拟 content script 全部 DOM 变换的内联脚本**。
3. 侧栏内嵌浏览器不能开 `file://`，本地起服务：`cd /tmp/jsl-preview && python3 -m http.server 8642`，访问 `http://127.0.0.1:8642/r5-list-dark.html?v=N`。
4. **`?v=N` 是缓存击穿约定**：每次重新生成预览页，把 `index.html` 里的版本号 +1（`sed -i '' -E 's/\?v=旧/\?v=新/g'`），否则浏览器拿到缓存的旧 HTML，会让你误判"改了没生效"。
5. `preview.sh` 内嵌的模拟脚本与 `src/content/modules/*` **必须同步改**——两边是同一套 DOM 变换的 TS/JS 双实现。

验收手段（按成本递增）：`playwright.evaluate` 读 computed style / getBoundingClientRect 数值对齐 → 截图 + `nodeRepl.emitImage` 目测 → PIL 像素扫描（连续性/周期性图案）。数值探针优先。

## 站方样式陷阱（全部实测，新 bug 先对照这张表）

1. **站方样式覆盖欲极强，且部分是运行时动态注入**（不在初始 CSSOM 里，遍历 `document.styleSheets` 搜不到）。判断样式来源要直接查 `getComputedStyle`；定位"多出来的装饰线"最有效的办法是**对边界坐标做全元素扫描**（遍历 `querySelectorAll` 找 rect 跨越该 y/x 的元素，逐一查 border / 伪元素 / background-image），不要只搜规则文本。
2. 已知被站方坑过的具体点：
   - `.aw-item`（帖子行）有 `border-top: 1px dotted`（动态注入）→ 行间"虚线"的真凶，已 `border: none !important` 清除。
   - `.aw-question-replay-count`（回复数胶囊）：站方 `position: absolute; left: 0`，必须强制 `position: static` 拉回 flex 流，否则标题钻到胶囊下面；内部 `em` 有独立白色圆角底，需一并清掉。
   - `h4` 标题站方写死 `width: 550px`（给"贡献"头像留位），导致话题 chip 提前换行；已 `width: auto !important`。
   - `.aw-question-tags` 外层 span 带标签形 sprite 贴图（左右两瓣外露），内层 `a` 有高优先级浅色底——两层都要清。
   - 侧栏热门话题卡：body 类名是 `aw-mod-body`（不是 `aw-side-bar-mod-body`）；`dd` 被钉死 141px 宽、`dd p` 有宽度、外层有 justify——需逐层放开。
   - `.aw-main-content` 有 `border-right: 1px #F7F7F7`（深色下成贯穿亮竖线）。
   - 搜索下拉 `.aw-search-dropdown-box`：定位基准是 form 层，站方 `left: -164px / width: 362px`；需把 `.navbar-search` 设 `position: relative; width: 100%` 再 `left/right/top/width` 对齐。
   - 给链接类元素设 `display: inline-flex` 会顶掉 `[hidden]` 的 UA 样式（曾让已隐藏的「首页」复活），需配 `a[hidden] { display: none !important }` 兜底。
   - `.aw-footer` 自带 30px 上下 padding，与扩展层的 padding 叠加会让页脚虚胖。
3. **1px 细线在侧栏缩放显示下会摩尔纹成虚线**（面板把 1280px 页面缩小渲染，细线周期性丢像素）。行分隔线用 2px；用户参考 V2EX 式"两端 18px 留白的实线"，用 `.aw-item:not(:last-child)::after` 伪元素实现。

## 布局决策记录（用户手绘稿定稿，勿轻易改）

- 顶栏：**通栏附着式**，深浅两主题同一布局（深色=深色条 #14181f，浅色=无底色）；去掉「首页」入口（logo 即首页）；「社区-知识库」文案简化为「社区」且不特殊着色（站方 `.on` 仅表当前位置）；顶栏所有间距统一由容器 `gap: 10px` 控制，勿给子项加 margin。
- 列表卡片头**两行**：第一行 = 全部/分类/话题（`data-dim: cat|topic`），第二行 = 最新/热门/按发表时间（`sort`）；选中态：cat 实底蓝、sort 浅蓝薄底。
- 列表行：回复数胶囊 `align-self: stretch` 与内容列上下对齐；标题/分类 chip/胶囊左缘同线（18px 基线）。
- 侧栏仅两卡：「集思录会员」（价目三行并入卡内，第三行文案规范为「会员优惠 • 会员福利」）+「热门话题」（占位图与空 dt 隐藏，纯文字行）。
- 隐藏项：微信二维码浮窗 `.scanWeiXinWD`、站方回顶按钮 `.aw-back-top`、BBS 阅读模式、会员权益说明。
- 回顶按钮：右缘对齐容器（`right: max(18px, calc(50% - 580px))`），滚动 600px 后淡入。
- 页脚：单层 padding（14px 0 + margin-top 24px）。
- 主题令牌驱动一切颜色；改主题只动 `tokens.css`。

## 用户偏好（验收过程中反复确认的）

- 对齐敏感：左基线、上下边缘、列间距都要严格共线，验收时给出数值证据（如 x=93=93）。
- 两套主题必须共享同一布局，只换配色。
- 视觉风格克制：低对比细线、无多余装饰、间隙统一。
- 反馈方式：在侧栏浏览器里点选元素发 dump，按元素逐条提修改；改完要求实测验证 + 截图确认。

## 待办 / 已知边界

- [ ] 详情页按列表页同套语言精修（当前仅早期适配：楼层号、回顶、引用/代码块样式）。
- [ ] 二期：数据页（可转债/LOF/ETF）表格美化——sticky 表头、斑马纹、tabular-nums。
- [ ] 登录态页面深度适配（发帖页、个人中心、消息下拉）。
- [ ] 预览页主题切换不持久（真实扩展走 chrome.storage，行为差异已知）。
- [ ] 站方改版风险：选择器依赖 `.aw-*` 结构，列在 global/community.css 顶部注释区，改版后按 `preview.sh` 工作流回归。
