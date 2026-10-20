# JSL Polish · 集思录现代化

为 [集思录](https://www.jisilu.cn/) 社区做的界面现代化 Chrome 扩展（Manifest V3）：统一深浅双主题、卡片语言与阅读排版，不改变站方功能。思路致敬 [V2EX_Polish](https://github.com/coolpace/V2EX_Polish)。

> **非官方项目**：与集思录站方无隶属或合作关系。扩展只做样式与轻量 DOM 增强，样式依赖站方页面结构，站点改版后个别页面可能需要跟进适配。

当前版本 **0.7.0** · Chrome 114+ · 运行时依赖 0 个

## 功能

### 全站

- **深浅双主题**：自动跟随系统，也可在设置中强制浅色/深色；顶栏有太阳/月亮快捷切换。`document_start` 阶段同步定题，无闪白；两套主题共享同一布局，只换配色。
- **统一外壳**：门户、社区、数据页、日历页共用同一套 header / footer 规格（960px 内容盒、52px 顶栏、页脚恒贴底），按钮簇与间距一致。
- **设置页**：总开关、主题模式、列表/详情模块开关；主题即时生效，涉及单向 DOM 变换的开关会自动刷新页面，避免半应用状态。

### 社区（WeCenter）

- **帖子列表**：分类/话题与排序导航并入卡片头；整行可点击、回复数胶囊、话题 chip、2px 实线分隔、胶囊分页器；侧栏精简为「集思录会员」与「热门话题」两卡。
- **帖子详情**：正文 15px / 1.75 行高，引用块、代码块、表格令牌化；回复楼层号、长回复折叠（可展开/收起）、回到顶部。
- **话题页 / 话题广场**：话题头卡、关注按钮、tab、站内搜索、侧栏卡片统一卡片语言。
- **我的收藏 / 我的首页**：卡片头、收藏行、AJAX 信息流、草稿/邀请 tab 与侧栏导航适配。
- **用户中心**：通知、私信、个人主页，以及设置页的 8 个 tab（我的内容 / 金币 / 购买 / 黑名单 / 安全 / 账号绑定 / 隐私提醒 / 基本资料）。
- **登录 / 注册 / 找回密码**：登录卡、输入框、按钮与门户页脚对齐，隐藏页面语境不需要的搜索与「发起」入口。

### 门户与数据

- **门户首页**：内容区重排（市场温度仪表盘上移、投资日历常开、收费数据面板移除、APP 链接入页脚）；本周热点按行重排；广告位与赞助商卡片圆角化；用户菜单 / 通知弹窗统一为单列卡片。
- **投资日历**：左侧 150px 筛选竖栏（sticky）、右侧日历吃满剩余宽度；事件块深色遮罩保证可读性，跨周续接段对齐。
- **实时数据页**（Vue + Element UI）：header / 子导航 / 页脚 960px 居中，表格、斑马纹、粘性列、涨跌色、浮层与工具条全部令牌化。
- **旧版服务端数据页**：新股申购、ETF、LOF、债券、转债详情、个股、持仓等页面适配同一套外壳与表格语言。
- **搜索结果**：门户搜索结果与联想弹窗的卡片化适配。

### 页面覆盖

| 页面                                        | 状态   |
| ------------------------------------------- | ------ |
| 广场 / 列表 / 详情 / 话题 / 收藏 / 我的首页 | 已覆盖 |
| 通知 / 私信 / 个人主页 / 设置（8 tab）      | 已覆盖 |
| 门户首页 / 登录注册 / 投资日历 / 搜索结果   | 已覆盖 |
| 实时数据页 / 旧版服务端数据页 / 持仓        | 已覆盖 |
| 发帖编辑器深度适配                          | 计划中 |

## 安装

扩展尚未上架 Chrome Web Store，目前从源码构建：

```bash
git clone https://github.com/jluncc/jsl-ui-plugin.git
cd jsl-ui-plugin
pnpm install
pnpm build
```

1. 打开 `chrome://extensions/`，开启右上角「开发者模式」
2. 点击「加载已解压的扩展程序」，选择本项目的 `dist/` 目录
3. 打开 [集思录](https://www.jisilu.cn/) 查看效果；点击工具栏图标进入设置

需要 Chrome 114+（扩展使用了 `:has()` 等较新的 CSS 能力）。Edge 等其他 Chromium 浏览器未做系统验证。

## 权限与隐私

扩展只申请两项最小权限：

| 权限                      | 用途                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| `storage`                 | 在 `chrome.storage.sync` 中保存总开关、主题与模块设置（可随浏览器账号同步） |
| `https://www.jisilu.cn/*` | 在集思录页面注入样式与 DOM 增强                                             |

明确边界：

- **不读取** Cookie、密码或表单输入值、浏览历史、剪贴板；不采集、不上报任何页面数据或使用统计。DOM 增强只读取页面可见结构（标题、导航文案、楼层等）用于重排，读到的内容不出页面。
- **不加载远程代码**，扩展自身运行时不发起任何网络请求；所有样式与脚本都打包在扩展内。
- 仅写入集思录域下的 `localStorage` 键 `jsl-polish-theme` / `jsl-polish-enabled` / `jsl-polish-settings`，用于首帧防闪与设置镜像。这些只是缓存，清除后下次加载会从 `chrome.storage.sync` 重新写入；真正的设置在扩展设置页里。
- 仓库中的 `scripts/refresh-calendar-events.mjs` 是**开发辅助脚本**，只会在手动运行时请求集思录公开日历接口抓预览数据，扩展本身不会调用它。

## 开发

```bash
pnpm dev         # watch 构建，改完在 chrome://extensions/ 点刷新 + 刷新网页
pnpm build       # 构建 dist/
pnpm lint        # eslint + tsc --noEmit
pnpm format      # prettier
pnpm audit:code  # 零依赖源码体检（危险 API / XSS 面 / CSS 冗余 / 体积预算）
```

### 目录结构

```
├── static/                  # manifest.json、options.html、图标；构建时原样复制进 dist/
├── scripts/
│   ├── audit.mjs            # 非功能性体检
│   ├── preview.sh           # 页面快照 + 扩展样式 → 本地预览页
│   ├── diagnose.sh          # 预览页几何诊断
│   └── refresh-calendar-events.mjs
├── src/
│   ├── content/
│   │   ├── index.ts         # 页面识别、标志挂载、设置应用、模块分发
│   │   ├── theme.ts         # 主题解析 + 首帧防闪 + 系统偏好监听
│   │   └── modules/         # list / detail / portal / settings / theme-toggle
│   ├── options/             # 设置页逻辑
│   ├── background/          # 点击工具栏图标打开设置页
│   ├── shared/settings.ts   # 设置 schema + chrome.storage / localStorage 镜像
│   └── styles/              # tokens.css → global.css → community.css
├── dist/                    # pnpm build 产物（不入库）
└── AGENTS.md                # 项目笔记、站方样式陷阱与验收流程
```

### 本地预览（不装扩展）

1. 把页面快照放到 `/tmp/jsl-preview/raw-*.html`（用浏览器 Save Page 下载，剥掉站方注入的 `<style>` 与探针脚本）
2. 生成预览页：`./scripts/preview.sh /tmp/jsl-preview/raw-list.html r5-list dark`
3. 起本地服务：`cd /tmp/jsl-preview && python3 -m http.server 8642`，访问 `http://127.0.0.1:8642/r5-list.html`
4. 日历页需要先 `pnpm preview:calendar-data` 抓一份公开事件数据，再运行 `preview.sh`

`preview.sh` 内嵌了与 content script 等价的 DOM 变换模拟，改动 `src/content/modules/*` 时需要同步修改。更完整的验收流程、选择器陷阱与设计决策见 [AGENTS.md](AGENTS.md)。

> 页面快照可能包含登录态、用户名与个人信息，**不要提交到仓库**；`inject.js` 也是本地调试产物，已在 `.gitignore` 中排除。

## 已知边界

- 站方公告横幅、搜索结果等由 AJAX 注入，已做样式适配；若站方改版可能需要补充选择器。
- 首次切换主题后，已打开的旧页面以 `localStorage` 缓存为准，刷新后完全生效。
- 预览页的主题切换不持久（真实扩展走 `chrome.storage`，这是预期的行为差异）。
- 目前只覆盖桌面端集思录，未做移动端布局。

## 贡献

欢迎 Issue / PR。提交前请确保：

1. `pnpm lint` 与 `pnpm audit:code` 通过
2. `pnpm build` 成功，并在真实页面（或按上述预览流程）验证过深浅两套主题
3. 不提交页面快照、Cookie、账号信息、`inject.js` 或其他本地调试产物
4. 新增页面适配时同步更新 `AGENTS.md` 的覆盖范围与陷阱清单

## 许可

[ISC](LICENSE)。集思录名称、页面内容与相关素材归其权利人所有；本项目仅提供界面增强代码。
