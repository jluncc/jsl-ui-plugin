/**
 * 门户首页（www.jisilu.cn）内容区改造：
 * 1. 「收费数据」面板移除
 * 2. 文章标题条里的 A股温度/转债温度两只 echarts 温度计，移入左栏顶部「市场温度」区
 *    （用户定稿：置于投资日历上方；canvas 自带「A股温度 xx℃」文案，站方 indicator.js）
 * 3. 投资日历折叠开关移除（常开）
 * 4. 本周热点正文重排为竖排编号列表（原设计即竖排），标题条简化为区名「本周热点」
 * 5. 文章卡尾部链接行只保留苹果APP/安卓APP/用户指引&常见问题，并入页脚法律链接行下方
 *
 * 与 scripts/preview.sh 的 sim 段是同一套 DOM 变换的 TS/JS 双实现，改这边必须同步那边。
 */

/** 文章卡尾部链接行保留的文案前缀（精确匹配项见 APP_LINK_TEXTS） */
const APP_LINK_PREFIX = '用户指引';
const APP_LINK_TEXTS = ['苹果APP', '安卓APP'];

export function enhancePortalHome(): void {
  removeMemberDataPanel();
  moveTemperatureIndicators();
  nudgeGaugeLabels();
  unfoldCalendar();
  layoutInvestmentEvents();
  moveAppLinksToFooter();
  polishCommunityTab();
  reorganizePortalFooter();
  movePublishToHeader();
  enhanceHeaderPopover();
}

/** 门户外壳的用户弹窗（.header_navbar_content .popover-menu）统一整理：
 *  去掉用户信息行/会员推广条、菜单并为单列固定顺序。
 *  首页、日历、数据页（Vue / 旧版）共用同一个 header，任何一页漏跑都会露出
 *  站方的双列菜单与白底会员条——index.ts 在 DOMContentLoaded 与数据页延时重跑时
 *  都会调用本函数（幂等）。
 *  站方 JS 在弹窗打开时把源菜单 clone 进 .popover-content，页面上可能同时存在
 *  源节点与已打开的副本，两处都要整理（副本打开着的时候也要立刻干净）。 */
export function enhanceHeaderPopover(): void {
  for (const menu of document.querySelectorAll<HTMLElement>(
    '.header_navbar_content .popover-menu',
  )) {
    stripPopoverHeader(menu);
    reorderMenuItems(menu);
    // 「发起讨论」只有 header 已补出「发起」入口时才移除；日历/搜索等页面
    // 目前不注入该按钮，保留菜单项以免把发布入口彻底去掉
    if (document.querySelector('.jsl-header-publish')) {
      menu.querySelector('a.btn[href="/publish/"]')?.closest('li')?.remove();
    }
  }
}

/** 弹窗菜单排序：个人主页 / 个人设置 / 我的关注 / 我的收藏 / 我的购买 / 我的金币 /
 *  黑名单 / 退出（两个站方 ul + 底部退出区合并为单列；与社区页用户下拉排序一致） */
function reorderMenuItems(menu: HTMLElement): void {
  const ul = menu.querySelector<HTMLUListElement>('.menu_links ul');
  if (!ul) return;
  const order = ['个人主页', '个人设置', '我的关注', '我的收藏', '我的购买', '我的金币', '黑名单', '退出'];
  const items = new Map<string, HTMLLIElement>();
  for (const li of menu.querySelectorAll<HTMLLIElement>('.menu_links li, .bottom_links li')) {
    const t = (li.textContent || '').trim();
    if (t && !items.has(t)) items.set(t, li);
  }
  for (const t of order) {
    const li = items.get(t);
    if (li) ul.appendChild(li);
  }
  // 站方是两个 ul 并排：空壳留着会让菜单多出一段空白
  for (const extra of [...menu.querySelectorAll<HTMLUListElement>('.menu_links ul')]) {
    if (extra !== ul && !extra.querySelector('li')) extra.remove();
  }
  menu.querySelector('.bottom_links')?.remove();
}

/** 弹窗顶部的用户信息行与会员推广行移除——对齐列表/详情页用户下拉的纯链接列表 */
function stripPopoverHeader(menu: HTMLElement): void {
  menu.querySelector('.user_info')?.remove();
  menu.querySelector('.member_box')?.remove();
}

/** 「发起」入口：header 搜索框右侧（与列表页「发起」按钮同位同款）。
 *  登录态从弹窗菜单搬运并删除菜单项；匿名态弹窗不存在，直接补按钮——
 *  列表页匿名态本就有「发起」，三页 header 保持一致 */
export function movePublishToHeader(): void {
  const search = document.querySelector(
    '.header_navbar_content .search_box, .header_navbar_content .search',
  );
  if (!search) return;
  const menuLink = document.querySelector<HTMLAnchorElement>(
    '.header_navbar_content .popover-menu a.btn[href="/publish/"]',
  );
  if (!search.parentElement?.querySelector('.jsl-header-publish')) {
    const btn = document.createElement('a');
    btn.className = 'jsl-header-publish';
    btn.href = '/publish/';
    btn.textContent = '发起';
    search.insertAdjacentElement('afterend', btn);
  }
  menuLink?.closest('li')?.remove();
}

/** 「社区-知识库」tab 文案简化为「社区」（与顶栏导航同一约定）。
 *  页面有两个 .tag_top（数据宫格/社区卡），按文案命中，不能只取第一个 */
function polishCommunityTab(): void {
  for (const tab of document.querySelectorAll<HTMLElement>('.tag_top .active')) {
    if (/社区/.test(tab.textContent ?? '')) {
      tab.textContent = '社区';
      break;
    }
  }
}

const FOOTER_DOT_CLASS = 'jsl-footer-dot';

/** 页脚文案整理：站点原 7 行压缩为 4 行——
 *  版权+客服邮箱 / 产品与法律链接（有 APP 行时并入，否则只放法律链接）/ 备案合行 / 声明；
 *  「使用 Edge/Chrome 浏览本站最佳」推荐行删除；缩进对齐交给 CSS。
 *  登录/注册页没有文章卡（无 APP 行），单独调用本函数也能得到同一套结构。 */
export function reorganizePortalFooter(): void {
  const left = document.querySelector<HTMLElement>('.footer_bg .footer_left');
  if (!left || left.querySelector('.jsl-footer-meta')) return;

  // 赞助商标题条化后冒号冗余（strip 标题不带标点，与投资提示/市场温度一致）
  const sponsorTitle = document.querySelector<HTMLElement>('.footer_ad_box .title');
  if (sponsorTitle) sponsorTitle.textContent = '赞助商';

  const plain = (el: Element) => (el.textContent || '').replace(/\s+/g, '');
  const rows = [...left.children];
  const copyright = rows.find((d) => /版权所有/.test(plain(d)));
  const email = rows.find((d) => /客服邮箱/.test(plain(d)));
  const legal = rows.find((d) => /用户协议/.test(plain(d)));
  const beianGov = rows.find((d) => d.querySelector('a[href*="beian.gov.cn"]'));
  const beianMiit = rows.find((d) => /京ICP证/.test(plain(d)));
  const statement = left.querySelector<HTMLElement>('.statement');
  if (!copyright || !email || !legal) return;

  // APP 链接行只在门户首页存在（由文章卡尾部链接拼出）；登录页等直接用法律链接行
  let links = left.querySelector<HTMLElement>('.jsl-footer-apps');
  if (!links) {
    links = document.createElement('div');
    links.className = 'jsl-footer-apps';
  }

  const dot = () => {
    const s = document.createElement('span');
    s.className = FOOTER_DOT_CLASS;
    s.textContent = '·';
    return s;
  };

  // 行1：版权 · 客服邮箱（站方邮箱文案里的防爬空格一并清掉）
  const meta = document.createElement('div');
  meta.className = 'jsl-footer-meta';
  meta.appendChild(document.createTextNode(plain(copyright)));
  meta.appendChild(dot());
  meta.appendChild(document.createTextNode(plain(email)));

  // 行2：法律链接并入产品链接行（门户首页共 6 项，`|` 分隔；登录页仅 3 项）
  for (const a of [...legal.querySelectorAll('a')]) links.appendChild(a);

  // 行3：两条备案合一行（保链 保徽章图）
  const beian = document.createElement('div');
  beian.className = 'jsl-footer-beian';
  if (beianGov) {
    for (const n of [...beianGov.childNodes]) beian.appendChild(n.cloneNode(true));
  }
  if (beianMiit) {
    beian.appendChild(dot());
    for (const n of [...beianMiit.childNodes]) beian.appendChild(n.cloneNode(true));
  }

  statement?.remove();
  for (const child of [...left.children]) child.remove();
  left.append(meta, links, beian);
  if (statement) left.appendChild(statement);
}

/** 「收费数据」整块移除（标题条 #home-member-data + 价目 ul 的共同父级） */
function removeMemberDataPanel(): void {
  document.getElementById('home-member-data')?.parentElement?.remove();
}

/** 温度计容器（.title_box .indicator）整体搬进左栏顶部，站方 echarts 实例随节点移动 */
function moveTemperatureIndicators(): void {
  const box = document.querySelector<HTMLElement>('.first_column .right .title_box .indicator');
  const left = document.querySelector<HTMLElement>('.first_column .left');
  if (!box || !left) return;

  const section = document.createElement('div');
  section.className = 'jsl-temp-panel';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = '市场温度';
  const cells = document.createElement('div');
  cells.className = 'cells';
  // 只搬元素（两个 <a>，站方 JS 已把 href 改写到指数页），空白文本节点留下
  for (const child of [...box.children]) cells.appendChild(child);

  section.append(title, cells);
  left.insertBefore(section, left.firstElementChild);
  box.remove();
}

/** 投资日历折叠开关（▿，触发 calToggleShow）移除，日历常开 */
function unfoldCalendar(): void {
  document.getElementById('cal-btn-toggle')?.remove();
}

/** 温度计文字（echarts detail，canvas 内绘制）下移：站方 offsetCenter [0,'35%']
 *  紧贴盘面，用户定稿多留一点空隙 → [0,'50%']；同时 gauge center 下移到 58%，
 *  盘面+文字整体在 canvas 里上下居中（默认 50% 时上方 2px/下方 14px 头重脚轻）。
 *  echarts 由站方 AJAX 回包后才 init，轮询等实例就绪；dataset 标记防重复 setOption */
function nudgeGaugeLabels(): void {
  if (!document.querySelector('.jsl-temp-panel')) return;
  const w = window as unknown as {
    echarts?: { getInstanceByDom?: (el: HTMLElement) => { setOption: (opt: object) => void } | undefined };
  };
  const ids = ['indicator', 'cb_indicator'];
  const apply = (): boolean => {
    if (!w.echarts?.getInstanceByDom) return false;
    let allDone = true;
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el || el.dataset.jslLabelOffset === '1') continue;
      const inst = w.echarts.getInstanceByDom(el);
      if (!inst) {
        allDone = false;
        continue;
      }
      try {
        inst.setOption({ series: [{ center: ['50%', '58%'], detail: { offsetCenter: [0, '50%'] } }] });
        el.dataset.jslLabelOffset = '1';
      } catch {
        allDone = false;
      }
    }
    return allDone;
  };
  if (apply()) return;
  const timer = setInterval(() => {
    if (apply()) clearInterval(timer);
  }, 500);
  setTimeout(() => clearInterval(timer), 12000);
}

/** 本周热点正文：站方 <br> 分隔的 4 条事件重排为竖排编号列表（原设计即竖排，
 *  双栏网格留白零碎，用户否决）。行高均分卡片剩余高度、1px 细线分隔，
 *  首条（当期头条）加重；标题条简化为区名「本周热点」——原标题就是首条事件，重复。
 *  节点直接移动而非 innerHTML 重解析：更快，且保留站方绑在链接上的事件。 */
function layoutInvestmentEvents(): void {
  const text = document.querySelector<HTMLElement>('.first_column .right .content .text');
  if (!text || text.querySelector('.jsl-event-list')) return;

  // 按 <br> 切分事件段（保留段内节点引用）
  const segments: Node[][] = [];
  let buffer: Node[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    const hasContent = buffer.some(
      (node) =>
        node.nodeType === Node.ELEMENT_NODE || (node.textContent ?? '').trim().length > 0,
    );
    if (hasContent) segments.push(buffer);
    buffer = [];
  };
  for (const node of [...text.childNodes]) {
    if (node.nodeName === 'BR') {
      flush();
      continue;
    }
    buffer.push(node);
  }
  flush();
  if (segments.length === 0) return;

  const list = document.createElement('div');
  list.className = 'jsl-event-list';
  segments.forEach((segment, i) => {
    const row = document.createElement('div');
    row.className = 'jsl-event-row';
    const index = document.createElement('span');
    index.className = 'idx';
    index.textContent = String(i + 1).padStart(2, '0');
    const txt = document.createElement('span');
    txt.className = 'txt';

    for (const node of segment) {
      if (node.nodeType === Node.TEXT_NODE) {
        // 站方 <br> 后的换行缩进一并清掉；清空后的纯空白节点直接丢弃
        node.textContent = (node.textContent ?? '').replace(/^[\s\u00a0]+/, '');
        if (!node.textContent) continue;
      }
      txt.appendChild(node);
    }

    // 首段文本按首个「：」拆出事件名称（站方日后若改为「名称：描述」格式）
    const first = txt.firstChild;
    if (first && first.nodeType === Node.TEXT_NODE) {
      const raw = (first.textContent ?? '').trim();
      const cut = raw.indexOf('：');
      if (cut > 0) {
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = raw.slice(0, cut);
        first.textContent = `：${raw.slice(cut + 1)}`;
        txt.insertBefore(name, first);
      }
    }

    row.append(index, txt);
    list.appendChild(row);
  });
  text.replaceWith(list);

  const titleLink = document.querySelector<HTMLAnchorElement>(
    '.first_column .right .title_box .title a',
  );
  if (titleLink) titleLink.textContent = '本周热点';
  // 「全文>>」按钮：标题条仍可进入原帖，入口冗余（用户定稿移除）
  document.querySelector('.first_column .right .content .more')?.remove();
}

/** 文章卡尾部链接行 → 页脚：剥 <font color> 壳，紧跟「用户协议」行插入 */
function moveAppLinksToFooter(): void {
  const editLinks = document.querySelector<HTMLElement>('.first_column .right .edit_links');
  const footerLeft = document.querySelector<HTMLElement>('.footer_bg .footer_left');
  if (!editLinks || !footerLeft) return;

  const keep = [...editLinks.querySelectorAll<HTMLAnchorElement>('a')].filter((a) => {
    const text = (a.textContent || '').trim();
    return APP_LINK_TEXTS.includes(text) || text.startsWith(APP_LINK_PREFIX);
  });

  if (keep.length > 0) {
    const row = document.createElement('div');
    row.className = 'jsl-footer-apps';
    for (const a of keep) {
      // <font color="#066699"> 是站方配色残片，剥壳保文字与 href
      for (const font of [...a.querySelectorAll('font')]) {
        font.replaceWith(...font.childNodes);
      }
      row.appendChild(a);
    }
    const legalRow = [...footerLeft.children].find((d) => /用户协议/.test(d.textContent || ''));
    if (legalRow) {
      legalRow.insertAdjacentElement('afterend', row);
    } else {
      footerLeft.appendChild(row);
    }
  }
  editLinks.remove();
}
