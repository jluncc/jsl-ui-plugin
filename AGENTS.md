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
- **侧栏「发起人」卡（.aw-side-bar-mod-body dl）**：头像上边缘 = **用户名文字**上边缘（用户定稿，实测双主题 116.5=116.5）。实现：`dl` flex + `align-items:flex-start`、dt/dd 零 margin、`dt` 与 `dt a` flex/block + `line-height:0`、`img` block，再给 `dt` 加 `margin-top:4.5px`——dd 首行是 20px 行盒里 12px 的字，文字实际绘制在行盒内下沉约 4.5px，纯顶对齐会让头像比名字高一截。三个坑：① 不能用 `align-items:center`（dd 含多行简介 81px，头像会落到整块中线）；② 不要做中线对齐；③ **"上边缘齐平"指文字上边缘，不是 dd 块上边缘**。此类「头像+多行信息」卡一律按文字上边缘校准。
- **DOM 增强**：`src/content/modules/list.ts`（合并导航、侧栏重排）、`detail.ts`（楼层号、回顶按钮）、`portal.ts`（门户首页内容区重排：温度计上移、收费数据移除、APP 链接入页脚）、`theme-toggle.ts`（顶栏主题切换按钮）。
- **设置**：`src/shared/settings.ts`，chrome.storage.sync，含总开关与模块开关；options 页在 `static/options.html`。
- **首帧无闪烁**：`applyThemeEarly()` + `applyEnabledEarly()` 在 document_start 同步读 localStorage 缓存（`jsl-polish-theme` / `jsl-polish-enabled`）先定 `data-theme` 与 `jsl` 类，chrome.storage 异步回包后再对齐；`saveSettings()` 同时写缓存。
- **设置变更策略**：主题即时生效；总开关/模块开关涉及单向 DOM 变换，无法低成本撤销 → `location.reload()`（避免"关掉扩展但卡片头还在"的半应用状态）。
- **事件委托**：列表整行点击、详情回复里的图片 load/error 复检都走容器级委托，不逐元素挂 handler。

## 登录 / 注册页（.jsl-page-auth）

站点 `account/login`（含注册/找回密码）属于门户外壳：有 `header_navbar_bg` / `wrapper_content` / `footer_bg`，所以 `jsl-page-portal` 的 header 与页脚基础规则自动命中；但内容区是独立的 `.content_box` 登录卡，需要单独的 `jsl-page-auth` 标志（`applyPageFlags` 检测 `.content_box`，preview.sh 同步）。

- 登录卡：`surface` 底 + 1px 边框 + 10px 圆角 + `--jsl-shadow`，与门户/详情卡片同语言；`register_button` 是同款独立卡。
- 标题：站方 16px + 3px 蓝底线 → 15px/600 主文字色，蓝底线收成 2px 短标（下移 -11px 压在 1px 分隔线上）。
- 输入框：38px 高、surface-2 胶囊、8px 圆角、1px 透明边框，聚焦时 `--jsl-border-2`；按钮 `--jsl-accent-solid` + 白字、宽 260px。
- header：**登录/注册页隐藏站内搜索与「发起」**（页面语境不需要这两个入口，`display:none`），搜索框隐藏后由主题切换按钮 `margin-left:auto` 接管右侧对齐。
- 页脚：与门户首页**同一套结构与排版**（左文字块 + 右二维码 96px 白底圆角卡，12px/22px 行高、行间 7px、法律链接 `|` 分隔），`height:auto` + `padding:18px 0`；文案整理复用 `reorganizePortalFooter()`——它已支持「无 APP 链接行」的页面（登录页新建只放法律链接的同行）；**body 必须 `display:flex !important`**（站方 body 带内联 `display:inline-block`，不加 important 页脚不会贴底），页脚 `margin-top:auto` 保证短页面贴底。
- 原生控件：`tokens.css` 加了 `color-scheme: light/dark`，复选框/滚动条跟随主题（否则深色下复选框是白块）。
- 站方 JS 有 `/login/` 路径守卫（`if (!href.includes('/login/')) location.replace('/login/')`），所以**登录页预览必须放在 `/tmp/jsl-preview/login/` 子目录**，直接放根目录会被强制跳转、测不到注入样式。

## 全站 header / footer 一致性（硬约定）

**所有页面 header 与 footer 必须同构同尺寸**（用户明确要求）。基准：门户首页。

| 项目 | 基准值 |
|---|---|
| header 内容 | 960px 居中（1450 视口下 x=245，右缘 1205） |
| header 高 | 52px（含 1px 底边共 53） |
| 控件簇 | 搜索 240×30 → 发起 30px → 主题切换 30px → 通知/私信 → 用户区，gap 10px |
| logo | 26px 图标 + 17px 文字，左缘 = header 内容盒左缘 |
| footer 外层 | 全宽、165px 高、`padding: 18px 0` |
| footer 内容 | 960px 居中（与 header 同边），高 128px |
| footer 左 | 四行：版权·邮箱 / 法律链接（`|` 分隔）/ 备案合行 / 声明，12px/22px 行高 |
| footer 右 | 两张 96px 白底圆角二维码卡，gap 28px，右缘 = 内容盒右缘 |
| 登录/注册页例外 | header 隐藏搜索与发起（页面语境不需要），主题按钮接管右对齐 |

**各页面的实际外壳差异**（必须分别适配，不能只写一套）：
- 门户/日历/登录（jQuery）：`.header_navbar_content` + `.footer_content > .flex`。
- 社区（WeCenter）：`.aw-top-menu-wrap`（通栏 flex，padding 镜像内容区）+ `.aw-wecenter`；页脚 `.aw-footer`。
- 数据页（Vue/Element UI）：`.header_navbar_content > .el-row > .el-col` 栅格 + `.footer_content > .el-row > .footer_left.el-col-8 / .footer_right.el-col-10.offset-4`。**必须把 el-col 百分比栅格打平成 flex**（el-col-8 只有 320px，文案被挤成两行、页脚蹿到 256px），并把站方的 `translateX` 居中 hack 清零。

**回归检查脚本**（每改 header/footer 必跑）：对每页量 `header_navbar_content`（或 `.aw-top-menu-wrap`）、`.footer_content`、`.footer_left`、`.footer_right`、`.footer_right img` 的 rect，确认 header/footer 内容盒 x=245 且 w=960、footer 外高 165、二维码 96×96。

## 实时数据页（.jsl-page-data）

`/web/data/cb/` 是 **Vue + Element UI** SPA（`#app`），与门户（jQuery）、社区（WeCenter）都是不同外壳；导航菜单没有 id。

- **架构识别**：`document.querySelector('.data-content.auto-content-width')` → `jsl-page-data`。
- **宽度策略与门户相反**：表格 39 列、自然宽 ~1650px，页面本就宽于视口（1450 下横向滚动）。所以 header / 子导航 / 内容区统一改为**全宽**，而不是收 960；强行把横向滚动关进内容区会让固定表头与表体列宽错位（实测），保持整页横向滚动即可。
- **站方的居中 hack**：header / 子导航用 JS 写 `transform: translateX((innerWidth-1200)/2)`，页面实际 1686 宽时该值（125px）会把整条 header 右移 → 必须 `transform: none !important`。同时内层 `.el-row` 带 `-15px` 负边距，需清零，否则再撑宽 30px。
- **左基线**：`header_navbar_content` 自己不加 padding（否则 30px），左缘交给内层 `el-col` 自带的 15px——与数据区 `padding: 0 15px` 的表格起点（x=16）对齐。
- **配色**：`#app` 白底、子导航深蓝 `#206798`、表头浅蓝 `#86c5e3`、行斑马 `rgba(245,245,245,.6)`、粘性列白线、涨跌纯红/绿——全部令牌化。深色下 `Beta` 徽标（亮蓝实底白字 3.13）与表头站方深蓝字（3.06）也已修。
- **导航文案**：SPA 渲染晚于 DOMContentLoaded，`polishPortalNav()` 需延时 800ms 再跑一次才能命中「首页」移除 / 「社区-知识库」→「社区」。
- **已知边界**：站方 `#app` 有 `min-width: max-content`，页面宽度由表格决定，超出视口时整页横向滚动（这是站点原生行为，未改）。

## 投资日历页（.jsl-page-calendar）

`/data/calendar/` 是门户外壳 + **FullCalendar 1.x**（`#calendar`，站方内联 `width:950px` 右浮动）+ 左侧筛选表（`#event-category`，`width:150px` 左浮动，底层是一张 17 行 × 5 列的表）。

- **布局**：站方内容区 1170 宽、与 header 960 错位。改为 `data_content` flex 纵向 + 960 宽居中；左侧竖栏打平成顶部**横向筛选条**（表格 `display:contents` + 每个 `tr` 变一枚芯片，占位列 `td[width]` 隐藏、`td[bgcolor]` 变 10px 圆点），日历占满 960。
- **FullCalendar 的坑**：事件块的 `left/width` 是渲染时按容器宽度算好的**内联值**，只改 CSS 不重算会溢出单元格。必须 `window.dispatchEvent(new Event('resize'))` 触发重算（`reflowCalendar()`：立即 + load + 600ms + 1500ms 各一次，幂等）。实测从 183px 正确变为 169px。
- **配色**：站方硬编码 `#eee` 筛选底、`#999` 边框、`#4d4d4d` 文字、`#ddd` 网格线、今天 `#b4e6ff`+红字+蓝色外发光、fc 按钮浅色渐变——全部令牌化。
- **事件块**：底色来自站方内联 `background-color`（十几种高饱和色，是日历类型的语义），**不要逐个改色**。深色下改用 `background-image: linear-gradient(rgba(0,0,0,.55),…)` 叠遮罩 + 白字：任意底色都被压到 L≤0.19，白字对比 ≥4.7（最亮白底 4.74、最暗紫底 11.5），色相仍保留。
- **验证注意**：对比度扫描只读 `backgroundColor`，看不到 `background-image` 遮罩，会误报事件块不达标——这种情况用 PIL 采样渲染像素仲裁（实测黄底被压到 `(113,102,49)`，白字 5.76:1）。
- 站方筛选表最后一行的「确定」按钮用 `tr:has(td[colspan])` 单独还原成右侧对齐的普通按钮。

## 用户中心四页（通知 / 私信 / 个人主页 / 设置）

均为 WeCenter 架构（`.aw-wecenter` → `jsl-community` 自动命中），但内部结构与列表/详情不同，样式集中在 `community.css` 末尾的「用户中心」段。

- **通知/私信**：主卡 = `.aw-content-wrap > .aw-main-content > .aw-mod`（surface + 1px 边框 + 10px 圆角 + 投影）。卡片头 `.aw-mod-head` 站方是「h2 里塞右浮动按钮」，改 flex + `order` 重排（标题左、设置链接 + 主按钮右），47px 灰底条。列表行 **必须显式清掉站方动态注入的 `border-top:1px dotted`**，否则与本项目 `::after` 的 2px 实线重叠、透出虚线（本页踩过）。「更多...」从站方浅蓝条改居中描边按钮。
- **私信行**：站方把 `.aw-user-img` **absolute 钉在行右上角**，改 CSS Grid 时必须 `position:static` 拉回流内，否则首列塌成 0、头像浮到文字右侧（本页踩过）。网格首列写死 `40px`。
- **个人主页**：详情卡 + tab 卡两段。站方 `h1` 写死 `#17344a`（深色 1.34:1）、`.aw-user-flag` 用 dotted 底边、`.aw-text-color-666`（主页访问量）3.01:1，均已令牌化。主 tab 行为纯胶囊、无下边线（见下条）。概览小卡 `h3` 的 DOM 是「`<a>更多»</a>标题」——用 flex 会把「更多」排到标题前，改 **block + `float:right`**。
- **个人主页 tab 区**：主 tab 改胶囊选中（accent-weak 底 + accent 字，与列表排序行同构），**胶囊行下去掉横线**（用户定稿；设置页 nav-tabs 内是「用户设置」标题条，保留底边线作分割）。**「左对齐」指文字左缘、不是底色边缘**（用户澄清）：胶囊自带 `padding:5px 12px`，文字比内容区右移 12px——`.nav-tabs` 整行 `margin-left:-12px`（GitHub UnderlineNav 负边距做法），使首个胶囊**文字** x=114 与下方 h3/正文同缘（底色外扩进卡片内衬）。**面板标题上方空隙**：站方 h3/h4 是 `margin-top:10px + padding-top:25px` 双份内衬（「详细资料/最新动态/主题/回复」全中招），tab-content 再 8px——全部清到只剩 8px（实测 nav 底到标题文字 10.5px 视觉净空）；面板首 h3/h4 同时清 margin-top/padding-top。**首个胶囊位置**：`.nav-tabs` 打成 flex+gap 后，站方 Bootstrap clearfix 伪元素变成 0 宽 flex 子项、各吃掉一头 4px gap（与顶栏 `.row` 同款陷阱），且站方 `a` 残留 `margin-right:2px`——伪元素 `display:none` + a margin 归零。**「详细资料」成就 dl 有 60px 左右内衬**（站方），导致「个人成就/最后活跃」与标题错位——清零；**站方 dt 左浮动 + dd 左缩进 10px + 统计行自带 10px 上边距**，会把「个人成就:」标签和「威望/赞同/感谢」拆成上下两行——整条 `dl` 改 `display:flex; align-items:center; gap:10px` 单行同轴（label 与数值垂直居中），并清 dt float/dd margin/统计行 margin；**dl 与标题底边线之间补 `margin-top:10px`**（否则紧贴横线，用户反馈）。**「个人成就/最后活跃」下不带任何分隔线**（用户定稿整段去线，站方 dt/dl 的 dotted 一并清；两组 dl 间只留 10px 呼吸）。页面里剩下的那条线是「详细资料」面板标题 h3 的分段底边线，保留。**「关注的人」h4 与子标签文字同左缘**（用户定稿，不再是缩进对齐头像）：关注面板 `.aw-tabs` 子胶囊左右各 10px 内衬 → 容器 `margin-left:-10px`，使子标签文字、h4 与主 tab「详细资料」文字三点同缘（实测 x=94）；**负边距外扩会撞上站方 `.tab-content` 的 `overflow:auto`**（滚动容器从内容盒 x=114 起裁，胶囊左缘 x=104 被切平、圆角消失）——`.tab-content` 改 `overflow:visible`（面板本就不内滚）。**关注列表头像与 h4 同左缘**：站方每个 `li.span5` 左右各 `margin:14px`（双列间距用），首列头像因此比标题右移 14px——`> ul > li { margin-left: 0 !important }`（右 margin 保留作列间距），实测 avatar x=94 = h4 文字 x=94、第二列 x=528；行分隔按项目约定由 1px dotted 改 2px 实线（`li::after`，right 留 14px 避开列间隙）；关注面板的「更多...」按钮站方是浅蓝实底 + 1px 实线边（深色下成亮带），并入动态列表同款透明描边胶囊。**面板内子标签 `.aw-tabs`**（关注的人/关注者/关注的话题）站方 `#f7f7f7` 白底横条，深色下刺眼——初版透明底 + 12px 胶囊；**2026-10-18 二次定稿：改用列表页排序行同款语言**——通栏 `surface-2` 灰带（`margin: 0 -20px` 吃掉面板 20px 内衬、贴卡片两缘，`.tab-content` 需 `overflow:visible`）+ 13px 胶囊（`6px 11px` / radius 7 / gap 2px，选中 accent-weak 底 accent 字，灰带上 hover 只变色），首个胶囊**盒子**落在内容缘 x=94（取代旧的 -10px 文字对齐方案）；**站方 `.aw-tabs` 与其内 `a` 均定高 30px（content-box）**，胶囊被撑高溢出灰带、底边压到下方内容——容器与 a 均 `height:auto` 放开。**关注面板「更多...」按钮与上方两列同长**（用户定稿）：列 = 420px span5 ×2 + 14px 列距 = **854px**（站方 BS2 静态栅格定宽，视口变化列宽不变），按钮 `width:100% + max-width:854px + border-box`——通栏 1091px 会比第二列右缘（x=948）多出 237px；动态面板的更多按钮保持通栏定稿不变，选择器限 `.aw-user-center-follow-mod` 作用域。**「动态」列表**与通知列表同一套行语言（2px 实线分隔 + 居中描边加载按钮），清站方 li dotted；**站方 `#contents_user_actions` 有 15px 左内衬**，行首文字比「最新动态」标题右移——清零后动态行首与标题同缘。**「更多...」按钮左右缘与动态行文字同宽**（用户定稿）：站方给按钮 15px 左右外边距会让它比列表窄一圈——水平 margin 归零，实测按钮 x=94..1185 = 行文字 x=94..1185。
- **全站 footer 恒贴底（用户硬约定，三种外壳都已覆盖）**：① 社区页（列表/详情/通知/私信/设置/个人主页）——`.jsl-community body` 改 `display:flex; flex-direction:column; min-height:100vh`，`.aw-container-wrap` 加 `flex:1 0 auto`；② 门户外壳（首页/日历/登录）——站方 body 带内联 `display:inline-block`，用 `body:has(> .footer_bg)` 覆盖为 flex 列，`.wrapper_content` / `#wrap` 吃剩余高度；③ 数据页——页脚在 `#app > .layout-default` 内，给该容器 flex 列 + `min-height:100vh`，`.nav-data` 吃剩余高度。实测短内容时页脚底边 = 视口底、间隙 0；长内容时页脚跟在内容末尾不遮挡。
- **个人主页外壳**：站方 `.aw-user-center` 自带 20px 四向内衬，会让详情卡/tab 卡比 header 基准线内缩 20px——左右清零（`padding: 20px 0`），卡片左缘 x=73 = header logo 左缘、右缘 x=1206 = 用户名按钮右缘（实测同值）。**全站 sticky footer**（用户定稿）：`.jsl-community body` 改 `display:flex; flex-direction:column; min-height:100vh`，`.aw-container-wrap` 加 `flex:1 0 auto`——内容短的页面（个人主页/设置/私信）页脚贴视口底，内容长的页面（列表）页脚仍跟在内容末尾、不遮挡。注意站方 body 可能带内联 `display:inline-block`，登录页已在 `jsl-page-auth` 单独用 `!important` 覆盖，这里社区页无需。
- **设置页**：三个坑——① `h2` 被站方 `position:absolute` 钉在 tab 条上（与首个 tab 重叠）→ `position:static` 拉回；② 小节标题 `h4` 自带 `background:#f7f7f7`（深色下成白条）→ 归零交给 `.aw-mod-head` 灰底条；③ 头像上传块 `position:absolute` 钉在表单右侧、与 `dl` 内容重叠 → 用 `:has()` 把表单改成两列网格（`minmax(0,1fr) 300px`），头像块变右列卡片。保存按钮所在 div 高度为 0（float 溢出）→ `:has(> .aw-user-setting-save)` 补成卡片页脚条。**2026-10-18 定稿补充**：④ `nav-tabs` 的 `border-bottom:1px #ddd` 去掉（用户定稿「用户设置下不要线」）；⑤ 「会员信息 / 基本信息」站方塞在同一个 `.aw-mod`（两个 head 共享一张卡）→ `settings.ts splitSettingsCards()` 按第二个 `.aw-mod-head` 切分原始子节点成两张卡（不重解析 HTML，保留站方表单/按钮事件；`data-jsl-split` 幂等），卡间 16px；⑥ 小节标题条内衬**必须 20px**（`padding: 0 20px`）——清成 0 会让 h4 贴卡片左边缘（用户反馈「挨到左边缘」），20px 时 h4 文字 x=94 与下方标签列盒左缘同线；⑦ 站方写死 `h4 height:40px` 让 24px 行盒贴顶（文字偏上 8.5px）→ `height:auto !important` 交回 flex 居中；⑧ 「介绍:」标签在 `<label>` 里（14px + `margin-right:5px`）→ 归零继承 dt 字号，四个 dt 文字右缘才同线（实测全为 174）；⑨ 「绑定手机 / 介绍」单行行站方用内联 `padding-left:50px` / `margin-left:50px` 裸排 → `settings.ts normalizeRows()` 加 `.jsl-inline-row` 类并剥内联间距，CSS `dd` 改 flex + `gap:10px`（按钮组 span 内同样 flex+gap；`&nbsp;` 文本节点要删，否则多一个 0 宽 flex 项吃 gap）；⑩ 站方模板残留**空 dd** 会占掉 grid 第二行 + 10px row-gap → 删除；⑪ 单行 dl 站方 `padding-bottom:15px` 让内容偏上（18/33）→ `:only-of-type` 清零交回 18/18；⑫ 行内 `input` 站方 `margin-bottom:10px` 会让 flex 居中按 margin 盒算（内容上浮 5px）→ 归零；⑬ 用户名行是多行块结构（input+按钮+说明段落），**不要**一起 flex 化。**隐私/提醒页（/setting/privacy/）额外两坑**：⑭ 三张卡（APP推送/私信设置/通知设置）是 `form` 的子级、不在 `.tab-content` 下——卡间距规则要写 `form > .aw-mod + .aw-mod`（站方原本 gapBefore=0，三卡贴死）；⑮ 保存按钮**没有包裹 div**（直接挂 `.tab-content` 下，`float:right` 脱流贴左缘）——`settings.ts wrapSaveButton()` 补一层包裹，复用「保存条卡片」规则；按钮自身保持 13px/92×34 实底胶囊不变。⑯ **「用户设置」h2 左内衬 21px**（= 卡片 1px 边框 + 小节标题条 20px 内衬），使标题文字与各 tab 页首个小节标题严格同缘 x=122——8 个 tab 页（我的内容/我的金币/我的购买/黑名单/安全设置/账号绑定/隐私提醒/基本资料）实测全部对齐，改这条规则要全 tab 复测。⑰ 复选框/单选框与文字站方零间隙（input margin:0、label inline-block）→ `label:has(> input[type=checkbox|radio])` 改 `inline-flex + gap:6px + align-items:center`（实测中线差 0.3px）。⑱ **表单标签 dt 定稿改左对齐**（原 text-align:right 会让「会员状态：/绑定手机:/用户名:/介绍:」左缘参差 137~170）：左对齐后四个标签文字与「会员信息/基本信息」标题严格同缘 x=122（实测 allAligned）。⑲ **保存按钮三种挂法**（`settings.ts wrapSaveButton()` 统一成「独立页脚卡」）：① 已有包裹 div（基本资料）；② 直接挂 `.tab-content`（隐私/提醒，原地补包裹）；③ 挂在 `form` 内部（**安全设置页**，把按钮搬到 `.tab-content` 末尾的包裹里——点按走 `onclick="doModify()"` 按 id 取表单 serialize，移出 form 不影响提交；已实测 form 内无残留按钮、实体仍是 92×34 实底胶囊右对齐）。⑳ **账号绑定页已绑定账号卡**（`.aw-user-setting-bind`）：站方 body `30px 60px` 超大内衬（内容比标题缩进 40px）→ 18px 20px；裸 inline 状态/头像改 flex 单行 gap:10px、行 `min-height:32px`；`i.aw-icon`（PUA 图标字体）在此环境不渲染字形只留 16px 空盒 → `display:none`，状态改 `surface-2` 底 999px 圆角胶囊 + 6px 绿点（`--jsl-down`；文字保持 text-2，语义绿做文字对浅底仅 ~3.5:1 不达 AA）；头像 32px + 8px 圆角 + `box-sizing:border-box`（配 1px 边框后仍 32px，否则 34px）；站方 `margin-left:5%` 与两个 `float:right` 清零，靠 order + `margin-left:auto` 把按钮组推到行尾（重新绑定在左、取消绑定在右）。㉑ **服务购买页（/setting/payment/）**：① FAQ 说明块直接挂在 `.aw-mod` 下、无横向内衬（文字 x=102，比正文内容缘 x=122 靠左 20px）→ `.aw-mod > div:not(.aw-mod-head):not(.aw-mod-body)` 补 20px 左右内衬；② 订单筛选按钮行与表格站方贴死（表格顶边 = 筛选行底边，gap=0）→ `.aw-user-setting-reset-table table { margin-top: 14px }`（金币流水/我的内容等表格类设置页同款受益）。
- **通用**：`dl` 网格只作用于表单直接子级（`> dl`），否则上传块内部的 `dl` 会被一起吃成两列。

## 定期非功能性体检

```bash
pnpm audit:code   # 零依赖源码体检，有 error 退出码 1
pnpm lint         # eslint + tsc
```

`scripts/audit.mjs` 检查四类信号，建议每积累一批改动跑一次：

1. **危险 API**：`eval` / `new Function` / `document.write` / `window.open` 缺 noopener
2. **XSS 面**：`innerHTML` 赋值（当前仅用于内置 SVG 常量，可信）；新增处必须确认内容来源
3. **CSS 冗余**：`transition: all`（改显式属性）；**声明完全相同**的重复选择器（同一选择器分多条写基础+状态补丁是正常分层，不报）
4. **体积预算**：`content.js ≤ 32KB`、三段 CSS 合计 ≤ 235KB（随覆盖页面增长上调：12 页 → 含设置页 8 个 tab 深度精修；超了先查是不是又内联了大段 data URI 或可压缩的冗长注释）

审查基线（2026-10 首轮）：CSS 142.8KB / content.js 22.7KB；当前 **224.8KB / 28.1KB**（十二页 + 用户中心 + 设置页 8 个 tab 深度精修后）；已知可接受项 = 2 处 `innerHTML`（detail.ts 回顶图标、theme-toggle.ts 主题图标，均为内置 SVG 字符串常量）。

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
   - 顶栏把站方 `.row` 打成 `display: contents` 后，它的 clearfix 伪元素（`::before/::after`，`display: table`）会被提升成 0 宽 flex 子项，各自吃掉两侧 10px gap——logo 前凭空多 10px 偏移、窄屏白占滚动空间；必须 `display: none` 摘除（global.css 顶栏区有现成规则）。**任何被接管成 flex+gap 的站方 Bootstrap 容器同款**：个人主页 `.nav-tabs`（flex+gap 4px）首个胶囊被 `::before` 吃掉 4px gap 右移、首项与下方标题错位——同样摘除伪元素。
   - 站方输入控件无全局 `border-box`：`width: 100%` + padding/border 会外溢（搜索框曾撑到 246×36，吃掉与「发起」按钮的间隙），自绘胶囊一律补 `box-sizing: border-box` + 定高。
   - 门户架构页（首页/搜索）的搜索结果与联想弹窗由站方 AJAX 异步渲染，本地预览无后端会被清空——preview.sh 里做了克隆还原兜底（真实站点不受影响）。
   - 站方对部分文案做字符混淆（自定义字体渲染 PUA 字形），扩展环境下是乱码替换符（U+FFFD）——按已知文案还原（如侧栏「特色数据、功能特权」，list.ts）。
   - 门户导航（header_navbar_content）靠固定子宽 + 子项 margin-top + 58px 高菜单 li 排版，接管时须整段清零重排，只清直接子级会残留；Bootstrap3 的 `.input-group-btn` 挂 `width: 1%` 表格 hack，按钮会溢出容器。
3. **1px 细线在侧栏缩放显示下会摩尔纹成虚线**（面板把 1280px 页面缩小渲染，细线周期性丢像素）。行分隔线用 2px；用户参考 V2EX 式"两端 18px 留白的实线"，用 `.aw-item:not(:last-child)::after` 伪元素实现。

## 布局决策记录（用户手绘稿定稿，勿轻易改）

- 顶栏：**通栏附着式**，深浅两主题同一布局（深色=深色条 #14181f，浅色=无底色）；去掉「首页」入口（logo 即首页）；「社区-知识库」文案简化为「社区」且不特殊着色（站方 `.on` 仅表当前位置）；顶栏所有间距统一由容器 `gap: 10px` 控制，勿给子项加 margin。
- 三页 header/宽度统一（用户定稿）：门户/列表/详情 header 以门户为准同构（搜索 240×30 发起入口 右侧按钮簇，间隙 10px）；**三页 header 材质统一**（2026-10 定稿）：社区 `.aw-top-menu-wrap` 从透明底改为与门户同款 `surface` 底 + 1px `--jsl-border` 底边（53px 总高），logo 浅色 `--jsl-text` / 深色品牌蓝 #0d6290，导航链接 `--jsl-text-2` + surface-2 悬停，主题切换/登录注册描边统一 `--jsl-border-2`、悬停 accent，登录注册内距对齐门户 `0 12px`；门户搜索框由站方 JS 运行时构建（curl 快照里是空 `.search_box`），社区侧用同款胶囊皮肤（外框 surface-2 + 2px 内衬 + 8px 圆角 + 透明 input），搜索按钮的 PUA 图标字体被隐藏后需自绘放大镜（mask + currentColor）；门户「发起」匿名态也注入（`movePublishToHeader` 不再依赖登录弹窗）；社区内容区**可见卡片边缘与 header 内容盒同边**（2026-10 定稿，取代旧的"960 对齐门户"）：`.aw-wecenter`（主容器+页脚）`margin-left: max(18px, (100%-1200)/2 + 61px)`、`margin-right: max(18px, (100%-1200)/2)`——镜像 `.aw-top-menu-wrap` 的不对称 padding；**主栏内还要清零站方 BS2 栅格 gutter**（`.row.aw-content-wrap` 的 `padding-left:10px` + `.aw-main-content` 的 `padding-left:30px`），否则可见卡片比容器内缩 40px、视觉上仍与 logo 错位；宽屏下实测 logo 左缘=卡片左缘=186、侧栏右缘=注册按钮右缘=1325，容器 1139px 随视口流式（门户仍 960 不变）；回顶按钮 right 同步为 `max(18px, (100%-1200)/2 + 20px)`；门户 header logo 深浅两版均用品牌蓝 #0d6290（图形 data URI + 文字色，深色下显示蓝色而非白色，对齐列表页 logo 图片观感）；社区搜索胶囊底色 surface-2 对齐门户。
- 门户首页内容区（用户定稿，portal.ts + preview.sh sim 双实现）：
  - 「收费数据」面板整块移除；
  - A股温度/转债温度两只 echarts（canvas 自带「xx温度 NN℃」文案，站方 indicator.js）从文章标题条移入左栏顶部「市场温度」区，置于投资日历上方；投资日历折叠开关（▿）移除、日历常开；
  - 文章卡尾部链接行只留 苹果APP/安卓APP/用户指引&常见问题，剥 `<font>` 壳后入页脚，紧跟「用户协议」行，`|` 分隔；
  - 本周热点正文按 `<br>` 拆成竖排编号列表（.jsl-event-list / .jsl-event-row，2026-10 定稿，取代两栏网格 .jsl-event-grid）：**行数不固定**（站方每天可能 1–8 行），三条约束同时成立——`flex:1 1 0` 均分剩余高度、`max-height:74px` 封顶（行少时整块居中，不把单行拉成半张卡）、`min-height:min-content` 兜底（CSS 规则下 min 胜于 max-height，长文本换行自动撑到 83px 不裁切；行数多到装不下时卡片长高、左卡 stretch 同步）。已实测 1/2/3/4/6/8 行 + 超长换行全部无裁切；编号 01–04 等宽数字，首条为当期头条（accent 编号 + 15px/600 主文字色，其余 14px/400 text-2）；标题条文案简化为区名「本周热点」（原标题=首条事件，重复），「全文>>」按钮移除（标题条仍可进原帖），标题条压到 15px/自适应高（站方 height:76px 是给浮动的 .indicator 留位的，搬走后放开了）；
  - 投资日历休市提示（.rest-banner）：站方 28px 圆图标 + 12px 内衬把文字推到日期行右侧 50px，现剥掉图标与底色盒，两行 12/11px 弱化文字左对齐内容缘（261）；日历日期行/事件区内衬 14→15px，与面板标题条文字同线；
  - **投资日历事件区滚动（#events-area）**：站方 JS 按事件量给内联高度 72px（无事件/休市）或 **245px**（繁忙日），原站靠左卡 `height:315 + overflow-y:auto` 整卡滚动；我们放开左卡高度后，卡片自身 `overflow:hidden`（圆角裁剪）会把超出事件直接裁掉且无法滚动 → 给 `#events-area` 补 `overflow-y:auto` + `overscroll-behavior:contain` + 6px 细滚动条（`::-webkit-scrollbar` 令牌化），日期行保持固定、仅事件列表内滚；无溢出时滚动条不占位（实测 clientW=offsetW）。已实测 9/12/20 条事件：滚到底最后一条完整可见、卡片高度稳定不被撑爆；
  - 社区板块标题（最新/热门/实盘）：**编辑式分区标尺**（2026-10 定稿，取代 15px+3px accent 短下划线）——13px/600 + 0.04em 字距，右侧 1px `--jsl-border` 细线延伸到列右缘（`::after` flex:1），与卡片 1px 边框同语言；站方 `.category` 有 `text-indent:20px`（盒子 50px 而文字仅 30px，下划线却从盒缘起）→ `text-indent:0 !important` 清零；首标题 margin-top 14px，其余 28px；右列站方 padding-top:10px 一并清零（「热门」曾比「最新」低 10px）；
  - 社区区头右侧六个分类按钮（.tag_top .link）移除；「投资前必看」为幽灵描边胶囊（透明底+红描边+状态点+语义红字）；
  - 卡片头语言全页统一为投资提示 title_box 同款灰底条（47px = 15px/24 + 11px 15px + 1px 底边）：左栏两条（.first_column .left .title，站方 16px/30px 定高压平）+ 两处 .tag_top（数据宫格/社区卡，站方 height:45 条与子项 39px 定高全接管，「持仓」为条内次级链接）+ 右卡 title_box；`.tag_box` 站方 padding-top:10px 清零（否则灰底条上方露出一条卡底线）；社区卡头文案「社区-知识库」简化为「社区」（页面有两个 .tag_top，文案替换要遍历按文案命中，不能只取第一个）；
  - 页脚整理（reorganizeFooter）：7 行压 4 行——版权·客服邮箱 / 产品与法律 6 链接（复用 APP 行 `|` 分隔）/ 两条备案合行 / 声明；站方「使用 Edge/Chrome」推荐行删除；`.footer_left` 站方 margin-left:90px 清零（文字左基线与「赞助商」卡左缘对齐）；`.footer_content .flex` 垂直居中（左文字块与右二维码列中线对齐）；站方 `.footer_bg` 写死 height:240px 放开为 auto+18px 上下 padding（内容实高 ~165，否则底部一大截死空白）；右侧二维码 96px 白底圆角卡（标题在上、码在下、flex gap 28px）；
  - 广告物料圆角化：顶部通栏横条（.banner_ad img）10px 圆角通栏；「赞助商」区并入卡片语言（.footer_ad_box = surface 卡 + title_box 同款标题条，文案冒号去掉），广告小图 6px 圆角；广告网格改卡内留隙布局（行 padding 15px + gap 8px，图宽收至 178px，站方 .ad_item 的 margin-right/padding-right 8px 必须清零否则第 5 列溢出）；「广告」角标贴图左下角（left/bottom 0 + 左下角与图同圆角，站方 width:26px 定宽要放开否则竖排）；
  - 卡片边框全站一致：.tag_box 与首屏两卡同用 1px 边界色边框（深浅同令牌）；刺眼的白线其实是 .tag_content/.tag_column 的站方 #ccc 内框，已去；面板间 20px 垂直节奏（.data_content 五个直接子块 margin-bottom）；
  - 「发起」入口在 header 搜索框右侧（.jsl-header-publish，与列表页 .b-start-question 同款实底 accent 30px），header 搜索胶囊外圆角统一 8px、宽度对齐 240px；门户/列表/详情三页 header 结构与按钮间隙一致；
  - 用户菜单弹窗（.popover-menu）对齐列表/详情页用户下拉：**纯链接列表**——用户信息行/会员推广行整体移除（stripPopoverHeader），菜单排序统一为 个人主页/个人设置/我的关注/我的收藏/我的购买/我的金币/黑名单/退出（reorderMenuItems，两个站方 ul + 底部退出区合并为单列；社区页下拉在 index.ts reorderUserNavMenu 做同构排序 + 文案对齐：主页→个人主页、设置→个人设置，只改链接首个文本节点保留图标），项样式 = global.css 的 .dropdown-menu a 同款（min-height 30px + 4px 12px + radius sm + 13px text-2，悬停 surface-2）；弹窗定位改右缘对齐用户按钮（站方 JS 按旧宽度算的 left 失效，`left:auto/right:0 !important`；门户 `.user_icon.dropdown` 没有 Bootstrap 的 relative，必须补 `position:relative` 作定位锚点，否则 right:0 甩到别的包含块）；宽度钉死 148px（站方 .popover-menu/.menu_links ul 有 295/281px 定宽，需 !important + 更高特异性对抗）；`.menu_links` 站方是 flex 容器（两个 ul 成并排列）必须打平为 block 才能单列；`.popover-menu` 要补 surface 底色（外壳透明化后无底会透出页面）；通知弹窗（.notification_popover）外壳并入同款卡片语言（portal 头部 popover 用 `.popover:not(.user_menu_popover)` 通配）；
  - 三板块帖子列表（最新/热门/实盘 .question_list）对齐列表页语言：去站方 disc 圆点与 .title 定宽 425px 截断（改通栏单行省略、15px/500），行距统一 + `li:not(:last-child)::after` 2px 分隔，meta（chip/回复/浏览）flex gap 单源间距并与标题同一条左基线（站方缩进 15px 已清）；板块头 = 编辑部式短下划线（15px/600 主文字色 + 文字下方 36px accent 短线，inline-flex 贴文不横穿整行）；双列内容左缘与「社区」标题条文字对齐（.tag_column .left padding 0 16px 0 15px / .right padding-left 15px——对齐链 = 卡缘 + 1px 边框 + 15px，社区/最新·热门·实盘/行标题五点同线；accent 竖条/通栏细线/居中/双列竖分隔线均按用户反馈回退，站方「热门/实盘」间整宽 .line 隐藏）；
  - 预览烘焙：温度计 canvas 按 indicator.js 的半环样式画仿真占位（四段色带/刻度/指针/文案，随主题换 ink 色；盘面 cy=63 上抬、文案基线 cy+15 落在色带端点之下），真实站点不受影响。
- 列表卡片头**两行**：第一行 = 全部/分类/话题（`data-dim: cat|topic`），第二行 = 最新/热门/按发表时间（`sort`）；选中态：cat 实底蓝、sort 浅蓝薄底。
- 列表行：回复数胶囊 `align-self: stretch` 与内容列上下对齐；标题/分类 chip/胶囊左缘同线（18px 基线）。
- 侧栏仅两卡：「集思录会员」（价目三行并入卡内，第三行文案规范为「会员优惠 • 会员福利」）+「热门话题」（占位图与空 dt 隐藏，纯文字行）。
- 隐藏项：微信二维码浮窗 `.scanWeiXinWD`、站方回顶按钮 `.aw-back-top`、BBS 阅读模式、会员权益说明。
- 回顶按钮：右缘对齐容器（`right: max(18px, calc(50% - 580px))`），滚动 600px 后淡入。
- 页脚：单层 padding（14px 0 + margin-top 24px）。
- 主题令牌驱动一切颜色；改主题只动 `tokens.css`。
- **门户弹窗宽度链（2026-10 实测）**：站方给门户 popover 的内层 `.popover-content` 写死宽度——用户菜单 295px、通知 250px；而社区页对应浮层只有 148px。外层 `.popover` 若 `max-width` 收到 260，内层就按 148 左对齐、在外层里留出 112px 空白（用户看到「菜单没贴住按钮」）。修法：用户菜单与通知弹窗都让 `.popover-content` `width:auto !important; min-width:0`，宽度交还内容，外层 `right:0` 才能真正贴住按钮右缘。通知弹窗同时对齐社区页 `.aw-message-dropdown`：6px 内衬 + 10px 圆角 + 内容 `p` 8px 12px / 12px 三级色。
- **登录态实测补充（2026-10）**：真实登录页多出用户菜单/通知/私信/编辑器/投票条等元素，未登录快照测不到。已修：`赏` 按钮（站方亮橙 #f48817 + 白字仅 2.51:1 → 压暗到 #b35f0b，4.61:1）、「关注问题」label（#666 → text-2）、投票条内层 em 的浅蓝底（清除，改 text-2）、正文表格内联 `#ccc` 边框（令牌化）。**正文里用户自己写的浅底单元格**（黄底/浅蓝底 + 继承的浅色字，实测 1.05:1）在深色下统一改深色文字、保留底色语义；内联 `color:red/green` 换成主题涨跌色。
- **对比度基线（2026-10 定稿）**：深色主题全站正文/控件文字对底色 ≥4.5:1（AA）。三组专用令牌：
  - `--jsl-accent` 只用于**文字/链接**（深色 #5c8dff，surface 5.52 / surface-2 4.72）；
  - `--jsl-accent-solid` / `--jsl-accent-solid-hover` / `--jsl-accent-solid-ink` 专用于**白字实底**按钮与选中胶囊（深色 #3b6ee0，对白字 4.67；悬停 #3564d4 → 5.35）——直接用浅色 accent 当实底会只有 3.13:1；
  - `--jsl-text-3` 深色 #8d97a8（surface-2 上 5.01，原 #7d8798 仅 4.07）。
  - 站方写死色要逐条令牌化：正文标题深蓝 #17344a（.markitup-box h1–h6，深色下 1.34:1 几乎不可见）、链接蓝 .aw-text-color-blue #2586cd（4.42）、宫格内联红字「评分」（3.7）。
  - **验证方法**：注入整页后 evaluate 遍历所有含直接文本节点的可见元素，按实际层叠底色算 WCAG 对比度，输出 <4.5 的清单（三页深色复扫为 0 项）。浅色主题的元信息灰（--jsl-text-3 #8b949e，2.69–3.08）是有意的弱化层级，未改。

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
