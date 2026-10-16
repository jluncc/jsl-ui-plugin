/**
 * 门户首页（www.jisilu.cn）内容区改造：
 * 1. 「收费数据」面板移除
 * 2. 文章标题条里的 A股温度/转债温度两只 echarts 温度计，移入左栏顶部「市场温度」区
 *    （用户定稿：置于投资日历上方；canvas 自带「A股温度 xx℃」文案，站方 indicator.js）
 * 3. 投资日历折叠开关移除（常开）
 * 4. 文章卡尾部链接行只保留苹果APP/安卓APP/用户指引&常见问题，并入页脚法律链接行下方
 *
 * 与 scripts/preview.sh 的 sim 段是同一套 DOM 变换的 TS/JS 双实现，改这边必须同步那边。
 */

/** 文章卡尾部链接行保留的文案前缀（精确匹配项见 APP_LINK_TEXTS） */
const APP_LINK_PREFIX = '用户指引';
const APP_LINK_TEXTS = ['苹果APP', '安卓APP'];

export function enhancePortalHome(): void {
  removeMemberDataPanel();
  moveTemperatureIndicators();
  unfoldCalendar();
  gridifyInvestmentEvents();
  moveAppLinksToFooter();
  polishCommunityTab();
  reorganizeFooter();
  movePublishToHeader();
  stripPopoverHeader();
  reorderMenuItems();
}

/** 弹窗菜单排序：个人主页 / 个人设置 / 我的关注 / 我的收藏 / 我的购买 / 我的金币 /
 *  黑名单 / 退出（两个站方 ul + 底部退出区合并为单列；与社区页用户下拉排序一致） */
function reorderMenuItems(): void {
  const menu = document.querySelector('.header_navbar_content .popover-menu');
  const ul = menu?.querySelector('.menu_links ul');
  if (!menu || !ul) return;
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
  menu.querySelector('.bottom_links')?.remove();
}

/** 弹窗顶部的用户信息行与会员推广行移除——对齐列表/详情页用户下拉的纯链接列表 */
function stripPopoverHeader(): void {
  const menu = document.querySelector('.header_navbar_content .popover-menu');
  if (!menu) return;
  menu.querySelector('.user_info')?.remove();
  menu.querySelector('.member_box')?.remove();
}

/** 「发起」入口：从弹窗菜单移到 header 搜索框右侧（与列表页「发起」按钮同位同款），
 *  弹窗里的按钮项随之移除 */
function movePublishToHeader(): void {
  const search = document.querySelector('.header_navbar_content .search_box');
  const menuLink = document.querySelector<HTMLAnchorElement>(
    '.header_navbar_content .popover-menu a.btn[href="/publish/"]',
  );
  if (!search || !menuLink) return;
  const btn = document.createElement('a');
  btn.className = 'jsl-header-publish';
  btn.href = '/publish/';
  btn.textContent = '发起';
  search.insertAdjacentElement('afterend', btn);
  menuLink.closest('li')?.remove();
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
 *  版权+客服邮箱 / 产品与法律链接（复用 APP 行，`|` 分隔）/ 备案合行 / 声明；
 *  「使用 Edge/Chrome 浏览本站最佳」推荐行删除；缩进对齐交给 CSS */
function reorganizeFooter(): void {
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
  const apps = left.querySelector<HTMLElement>('.jsl-footer-apps');
  const statement = left.querySelector<HTMLElement>('.statement');
  if (!copyright || !email || !legal || !apps) return;

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

  // 行2：APP 行并入法律链接（用户协议/隐私政策/问题反馈），`|` 分隔共 6 项
  for (const a of [...legal.querySelectorAll('a')]) apps.appendChild(a);

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
  left.append(meta, apps, beian);
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

/** 投资提示正文：站方 <br> 分隔的事件行拆「名称：描述」，重排为两栏网格
 *  （横向铺满卡片、纵向在剩余高度居中，消除原文一行一个的死空白） */
function gridifyInvestmentEvents(): void {
  const text = document.querySelector<HTMLElement>('.first_column .right .content .text');
  if (!text || text.querySelector('.jsl-event-grid')) return;

  // 按 <br> 切分成事件段（保留段内原有子节点，兼容站方日后塞链接）
  const segments: string[] = [];
  let buffer: Node[] = [];
  const flush = () => {
    if (buffer.length === 0) return;
    const wrap = document.createElement('div');
    for (const node of buffer) wrap.appendChild(node.cloneNode(true));
    segments.push(wrap.innerHTML);
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

  const grid = document.createElement('div');
  grid.className = 'jsl-event-grid';
  for (const segment of segments) {
    const item = document.createElement('div');
    item.className = 'jsl-event-item';
    item.innerHTML = segment;
    // 首段文本按首个「：」拆出事件名称（站方 <br> 后的换行空白一并清掉）
    const first = item.firstChild;
    if (first && first.nodeType === Node.TEXT_NODE) {
      const raw = (first.textContent ?? '').trim();
      const cut = raw.indexOf('：');
      if (cut > 0) {
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = raw.slice(0, cut);
        first.textContent = `：${raw.slice(cut + 1)}`;
        item.insertBefore(name, first);
      }
    }
    grid.appendChild(item);
  }
  text.replaceWith(grid);
  // 「全文>>」按钮：事件已两栏铺开，入口冗余（用户定稿移除）
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
