# AGENTS.md · JSL Polish 开发指引

给后续接手本项目的 AI agent / 协作者。读完这页可以跳过大部分摸索成本——特别是「站方样式陷阱」一节，全部是实测踩坑结论。

## 项目是什么

为 [集思录](https://www.jisilu.cn/) 社区（WeCenter / Bootstrap 2 / jQuery 老站）做界面现代化的 Chrome MV3 扩展。零运行时依赖，TypeScript + tsup + pnpm。当前版本 0.4.0：列表、详情、门户首页、话题广场、搜索结果、个人中心均已精修（登录态实测）。站点存在两套架构：WeCenter 社区页（aw-* 组件）与门户新版自定义皮肤（960px 定宽，标志类 jsl-page-portal）。

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
- **DOM 增强**：`src/content/modules/list.ts`（合并导航、侧栏重排）、`detail.ts`（楼层号、回顶按钮）、`portal.ts`（门户首页内容区重排：温度计上移、收费数据移除、APP 链接入页脚）、`theme-toggle.ts`（顶栏主题切换按钮）。
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
   - 门户 `.tag_top div`（tab）与文章 `.title_box`：白底 + 3px 蓝顶边 + **1px solid #fff 底边**——深色下白底刺眼、白底边成悬空白线；tab 已改下划线式（inset box-shadow 贴行底），白底边一律令牌化为 `--jsl-border`。
   - 门户 `.first_column .left` 写死 `height: 315px`（配 `overflow-y: auto` 隐滚条）；`.first_column` 是 flex `align-items: stretch` 等高布局——重排内容必须放开 `height: auto`，且左栏内容加高会被 `.right` 的 `overflow: hidden` 裁行（收费数据加 padding 后第三行被裁的教训：行高勿动，站方 `line-height:30px` 是节奏基准）。
   - 门户 `.jisilu-icons`（PUA 图标字体，收费数据「会员服务」徽标、页脚 Edge/Chrome 前缀）扩展环境必渲染为乱码替换符 → 整页 `display: none`。
   - 门户页脚纯文本 div/span/`|` separator 是站方 #333 硬编码，深色下不可见；`<font color>` 残片在链接行内需剥壳保文字。
   - `.aw-question-replay-count`（回复数胶囊）：站方 `position: absolute; left: 0`，必须强制 `position: static` 拉回 flex 流，否则标题钻到胶囊下面；内部 `em` 有独立白色圆角底，需一并清掉。
   - `h4` 标题站方写死 `width: 550px`（给"贡献"头像留位），导致话题 chip 提前换行；已 `width: auto !important`。
   - `.aw-question-tags` 外层 span 带标签形 sprite 贴图（左右两瓣外露），内层 `a` 有高优先级浅色底——两层都要清。
   - 侧栏热门话题卡：body 类名是 `aw-mod-body`（不是 `aw-side-bar-mod-body`）；`dd` 被钉死 141px 宽、`dd p` 有宽度、外层有 justify——需逐层放开。
   - `.aw-main-content` 有 `border-right: 1px #F7F7F7`（深色下成贯穿亮竖线）。
   - 搜索下拉 `.aw-search-dropdown-box`：定位基准是 form 层，站方 `left: -164px / width: 362px`；需把 `.navbar-search` 设 `position: relative; width: 100%` 再 `left/right/top/width` 对齐。
   - 给链接类元素设 `display: inline-flex` 会顶掉 `[hidden]` 的 UA 样式（曾让已隐藏的「首页」复活），需配 `a[hidden] { display: none !important }` 兜底。
   - `.aw-footer` 自带 30px 上下 padding，与扩展层的 padding 叠加会让页脚虚胖。
   - 顶栏把站方 `.row` 打成 `display: contents` 后，它的 clearfix 伪元素（`::before/::after`，`display: table`）会被提升成 0 宽 flex 子项，各自吃掉两侧 10px gap——logo 前凭空多 10px 偏移、窄屏白占滚动空间；必须 `display: none` 摘除（global.css 顶栏区有现成规则）。
   - 站方输入控件无全局 `border-box`：`width: 100%` + padding/border 会外溢（搜索框曾撑到 246×36，吃掉与「发起」按钮的间隙），自绘胶囊一律补 `box-sizing: border-box` + 定高。
   - 门户架构页（首页/搜索）的搜索结果与联想弹窗由站方 AJAX 异步渲染，本地预览无后端会被清空——preview.sh 里做了克隆还原兜底（真实站点不受影响）。
   - 站方对部分文案做字符混淆（自定义字体渲染 PUA 字形），扩展环境下是乱码替换符（U+FFFD）——按已知文案还原（如侧栏「特色数据、功能特权」，list.ts）。
   - 门户导航（header_navbar_content）靠固定子宽 + 子项 margin-top + 58px 高菜单 li 排版，接管时须整段清零重排，只清直接子级会残留；Bootstrap3 的 `.input-group-btn` 挂 `width: 1%` 表格 hack，按钮会溢出容器。
3. **1px 细线在侧栏缩放显示下会摩尔纹成虚线**（面板把 1280px 页面缩小渲染，细线周期性丢像素）。行分隔线用 2px；用户参考 V2EX 式"两端 18px 留白的实线"，用 `.aw-item:not(:last-child)::after` 伪元素实现。

## 布局决策记录（用户手绘稿定稿，勿轻易改）

- 顶栏：**通栏附着式**，深浅两主题同一布局（深色=深色条 #14181f，浅色=无底色）；去掉「首页」入口（logo 即首页）；「社区-知识库」文案简化为「社区」且不特殊着色（站方 `.on` 仅表当前位置）；顶栏所有间距统一由容器 `gap: 10px` 控制，勿给子项加 margin。
- 门户首页内容区（用户定稿，portal.ts + preview.sh sim 双实现）：
  - 「收费数据」面板整块移除；
  - A股温度/转债温度两只 echarts（canvas 自带「xx温度 NN℃」文案，站方 indicator.js）从文章标题条移入左栏顶部「市场温度」区，置于投资日历上方；投资日历折叠开关（▿）移除、日历常开；
  - 文章卡尾部链接行只留 苹果APP/安卓APP/用户指引&常见问题，剥 `<font>` 壳后入页脚，紧跟「用户协议」行，`|` 分隔；
  - 投资提示正文按 `<br>` 拆「名称：描述」两栏网格（.jsl-event-grid），网格在剩余高度垂直居中、「全文>>」钉右下，标题条压到 15px/自适应高（站方 height:76px 是给浮动的 .indicator 留位的，搬走后放开了）；
  - 社区区头右侧六个分类按钮（.tag_top .link）移除；「投资前必看」为幽灵描边胶囊（透明底+红描边+状态点+语义红字）；
  - 卡片头语言全页统一为投资提示 title_box 同款灰底条（47px = 15px/24 + 11px 15px + 1px 底边）：左栏两条（.first_column .left .title，站方 16px/30px 定高压平）+ 两处 .tag_top（数据宫格/社区卡，站方 height:45 条与子项 39px 定高全接管，「持仓」为条内次级链接）+ 右卡 title_box；`.tag_box` 站方 padding-top:10px 清零（否则灰底条上方露出一条卡底线）；社区卡头文案「社区-知识库」简化为「社区」（页面有两个 .tag_top，文案替换要遍历按文案命中，不能只取第一个）；
  - 页脚整理（reorganizeFooter）：7 行压 4 行——版权·客服邮箱 / 产品与法律 6 链接（复用 APP 行 `|` 分隔）/ 两条备案合行 / 声明；站方「使用 Edge/Chrome」推荐行删除；`.footer_left` 站方 margin-left:90px 清零（文字左基线与「赞助商」卡左缘对齐）；`.footer_content .flex` 垂直居中（左文字块与右二维码列中线对齐）；站方 `.footer_bg` 写死 height:240px 放开为 auto+18px 上下 padding（内容实高 ~165，否则底部一大截死空白）；右侧二维码 96px 白底圆角卡（标题在上、码在下、flex gap 28px）；
  - 广告物料圆角化：顶部通栏横条（.banner_ad img）10px 圆角通栏；「赞助商」区并入卡片语言（.footer_ad_box = surface 卡 + title_box 同款标题条，文案冒号去掉），广告小图 6px 圆角（网格布局沿用站方 footer_ad_row，不动尺寸避免溢出裁切）；
  - 三板块帖子列表（最新/热门/实盘 .question_list）对齐列表页语言：去站方 disc 圆点与 .title 定宽 425px 截断（改通栏单行省略、15px/500），行距统一 + `li:not(:last-child)::after` 2px 分隔，meta（chip/回复/浏览）flex gap 单源间距并与标题同一条左基线（站方缩进 15px 已清）；板块头 = accent 竖条 + 主文字色 + 行尾细线（站方「热门/实盘」间整宽 .line 隐藏）；
  - 预览烘焙：温度计 canvas 按 indicator.js 的半环样式画仿真占位（四段色带/刻度/指针/文案，随主题换 ink 色；盘面 cy=63 上抬、文案基线 cy+15 落在色带端点之下），真实站点不受影响。
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

- [x] 详情页按列表页同套语言精修（标题行对齐、正文两端对齐、meta 行 flex 化、长回复折叠双向切换、侧栏 16px 节奏、登录态下拉适配）。
- [ ] 二期：数据页（可转债/LOF/ETF）表格美化——sticky 表头、斑马纹、tabular-nums。
- [ ] 登录态页面深度适配（发帖页、个人中心、消息下拉）。
- [ ] 预览页主题切换不持久（真实扩展走 chrome.storage，行为差异已知）。
- [ ] 站方改版风险：选择器依赖 `.aw-*` 结构，列在 global/community.css 顶部注释区，改版后按 `preview.sh` 工作流回归。
