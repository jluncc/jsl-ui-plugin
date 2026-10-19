import { applyEnabledEarly, loadSettings, watchSettings, type Settings } from '../shared/settings';
import { applyThemeEarly, syncTheme } from './theme';
import { enhanceListPage } from './modules/list';
import { enhanceDetailPage } from './modules/detail';
import { enhancePortalHome, movePublishToHeader, reorganizePortalFooter } from './modules/portal';
import { enhanceSettingsPage } from './modules/settings';
import { injectThemeToggle } from './modules/theme-toggle';

// document_start：同步定主题与总开关，避免异步设置回包前闪一下站点原样式
applyThemeEarly();
applyEnabledEarly();

function applyPageFlags(): void {
  const root = document.documentElement;
  // 集思录社区（WeCenter）所有页面共用 .aw-wecenter 外壳
  if (document.querySelector('.aw-wecenter')) root.classList.add('jsl-community');
  if (document.querySelector('.aw-question-list')) root.classList.add('jsl-page-list');
  if (document.querySelector('.aw-question-detail-box')) root.classList.add('jsl-page-detail');
  // 话题页（/topic/<name>）：社区外壳内的独立话题头 + tab 行 + 话题侧栏
  if (document.querySelector('.aw-topic-detail-title')) root.classList.add('jsl-page-topic');
  // 门户新架构页（www.jisilu.cn/ 首页、搜索结果等，非 WeCenter 架构，共用新版导航）
  if (document.querySelector('.wrapper_content') || document.querySelector('.header_navbar_bg')) {
    root.classList.add('jsl-page-portal');
  }
  // 登录/注册/找回密码页：同一套门户外壳，但内容区是独立登录卡
  if (document.querySelector('.content_box')) root.classList.add('jsl-page-auth');
  // 投资日历页：FullCalendar 1.x 生成的月历（事件宽度是渲染时算好的内联值）
  if (document.getElementById('calendar')) root.classList.add('jsl-page-calendar');
  // 实时数据页（Vue + Element UI 架构，与门户/社区都是两套不同外壳）
  if (document.querySelector('.data-content.auto-content-width')) {
    root.classList.add('jsl-page-data');
  } else if (document.querySelector('#app .layout-default .header_subnavbar_bg')) {
    // Vue 数据外壳的其它页（如持仓 /web/positions）：header + 子导航与数据页同构，
    // 但没有 .data-content.auto-content-width，单独识别后共用数据页外壳样式
    root.classList.add('jsl-page-data');
  }
  // 旧版服务端渲染数据页（新股/ETF/债券/详情/计算器…）
  if (isLegacyDataShell()) root.classList.add('jsl-page-data-legacy');
}

/** 旧版数据页：.data_content + 数据子导航（排除首页/日历等门户外壳）。 */
function isLegacyDataShell(): boolean {
  return (
    !!document.querySelector('.data_content') &&
    !!document.querySelector('.header_subnavbar_bg') &&
    !document.querySelector('.wrapper_content')
  );
}

/** FullCalendar 按容器宽度在渲染时算好事件的内联 left/width；
 *  CSS 把容器从 1170 收到 960 后必须触发一次 resize 让它重算，
 *  否则事件块会溢出单元格。幂等，重复触发无副作用。 */
function reflowCalendar(): void {
  if (!document.getElementById('calendar')) return;
  const fire = () => window.dispatchEvent(new Event('resize'));
  fire();
  window.addEventListener('load', fire, { once: true });
  window.setTimeout(fire, 600);
  window.setTimeout(fire, 1500);
  watchCalendarEvents();
}

/** FullCalendar 的跨周续接段（无 fc-event-start）用 left:0 贴齐单元格左缘，
 *  而起始段是 left:3px——圆角卡片语言下续接段左缘会凸出 3px。
 *  统一内缩 3px 并把宽度同步减 3，右缘保持不动（实测同列右缘原本对齐）。 */
function normalizeCalendarEventInsets(): void {
  if (!document.documentElement.classList.contains('jsl')) return;
  for (const el of document.querySelectorAll<HTMLElement>(
    '#calendar .fc-event:not(.fc-event-start)',
  )) {
    if (parseFloat(el.style.left || '0') !== 0) continue;
    const width = parseFloat(el.style.width);
    if (!Number.isFinite(width)) continue;
    el.style.left = '3px';
    el.style.width = `${width - 3}px`;
  }
}

/** 翻月/切视图/窗口重排都会重建事件节点或重写内联定位，
 *  用 MutationObserver 在每帧末尾补一次校正（幂等，只处理 left:0 的续接段） */
function watchCalendarEvents(): void {
  const calendar = document.getElementById('calendar');
  if (!calendar) return;
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      normalizeCalendarEventInsets();
    });
  };
  normalizeCalendarEventInsets();
  new MutationObserver(schedule).observe(calendar, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style'],
  });
  window.addEventListener('load', schedule, { once: true });
  window.setTimeout(schedule, 600);
  window.setTimeout(schedule, 1500);
}

/** 总开关与主题即时生效；模块开关（列表/详情）涉及单向 DOM 变换，
 *  无法低成本撤销，变更后重载页面让两侧状态一致 */
let lastSettings: Settings | null = null;

function applySettings(settings: Settings): void {
  const previous = lastSettings;
  lastSettings = settings;

  document.documentElement.classList.toggle('jsl', settings.enabled);
  syncTheme(settings.themeMode);

  const structuralChange =
    previous !== null &&
    (previous.enabled !== settings.enabled ||
      previous.modernList !== settings.modernList ||
      previous.modernDetail !== settings.modernDetail);
  if (structuralChange) location.reload();
}

/** 门户导航简化：去掉「首页」入口、「社区-知识库」简化为「社区」（与社区页导航一致）。
 *  数据页（Vue 架构）的菜单没有 id，按文案兜底处理 */
function polishPortalNav(): void {
  if (!document.querySelector('.header_navbar_bg')) return;
  document.getElementById('top_nav_menu_home')?.remove();
  const forumLink = document.querySelector('#top_nav_menu_forum a');
  if (forumLink) forumLink.textContent = '社区';

  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    '.header_navbar_content .menu ul li a',
  )) {
    const text = (link.textContent || '').trim();
    if (text === '首页' && (link.getAttribute('href') || '') === '/') {
      link.closest('li')?.remove();
    } else if (text.startsWith('社区') && text !== '社区') {
      link.textContent = '社区';
    }
  }
}

/** 站方顶栏文案装饰（「»首 页」）清理；「首页」入口去掉（logo 即首页）、「社区-知识库」简化为「社区」 */
function polishHeaderLinks(): void {
  for (const link of document.querySelectorAll<HTMLElement>('.span6.aw-logo > a[href]:not(:first-child)')) {
    const text = (link.textContent || '').replace(/»/g, '').replace(/\s+/g, '');
    if (!text) continue;
    if (text === '首页') {
      link.hidden = true;
      continue;
    }
    if (text.startsWith('社区')) {
      link.textContent = '社区';
      continue;
    }
    link.textContent = text;
  }
}

/** 用户下拉菜单：文案对齐门户用户弹窗（主页→个人主页、设置→个人设置），
 *  排序一致：个人主页 / 个人设置 / 我的关注 / 我的收藏 / 我的购买 / 我的金币 /
 *  黑名单 / 退出 */
function reorderUserNavMenu(): void {
  const menu = document.querySelector('.aw-user-nav-dropdown .dropdown-menu ul');
  if (!menu) return;
  const order: Array<[string, string]> = [
    ['主页', '个人主页'],
    ['设置', '个人设置'],
    ['我的关注', '我的关注'],
    ['我的收藏', '我的收藏'],
    ['我的购买', '我的购买'],
    ['我的金币', '我的金币'],
    ['黑名单', '黑名单'],
    ['退出', '退出'],
  ];
  const items = new Map<string, HTMLLIElement>();
  for (const li of [...menu.querySelectorAll('li')]) {
    const t = (li.textContent || '').trim();
    if (t && !items.has(t)) items.set(t, li);
  }
  for (const [from, to] of order) {
    const li = items.get(from);
    if (!li) continue;
    if (to !== from) {
      const a = li.querySelector('a');
      const tn = a && [...a.childNodes].find((n) => n.nodeType === 3 && n.textContent?.trim());
      if (tn) tn.textContent = to;
    }
    menu.appendChild(li);
  }
}

/** 数据页外壳（Vue 数据页 / 持仓 / 旧版服务端页）判定。 */
function isDataShellPage(): boolean {
  return (
    !!document.querySelector('.data-content.auto-content-width') ||
    !!document.querySelector('#app .layout-default .header_subnavbar_bg') ||
    isLegacyDataShell()
  );
}

/** 数据页 popper（挂 body 下）右缘对齐触发按钮，幂等。 */
let dataPagePopperWatcherStarted = false;

function alignDataPagePoppers(): void {
  if (dataPagePopperWatcherStarted) return;
  // 数据页标志可能尚未挂上（Vue 渲染晚于 DOMContentLoaded）：由延时重试补上
  if (!isDataShellPage()) return;
  dataPagePopperWatcherStarted = true;

  const watched = new WeakSet<HTMLElement>();
  let queued = false;

  const align = () => {
    queued = false;
    for (const popper of document.querySelectorAll<HTMLElement>('body > .el-popover.el-popper')) {
      if (!watched.has(popper)) {
        watched.add(popper);
        new MutationObserver(schedule).observe(popper, {
          attributes: true,
          attributeFilter: ['style', 'aria-hidden'],
        });
      }
      const rect = popper.getBoundingClientRect();
      if (!rect.width) continue;
      const ref = popper.id
        ? document.querySelector<HTMLElement>(`[aria-describedby="${popper.id}"]`)
        : null;
      if (!ref) continue;
      const target = Math.round(ref.getBoundingClientRect().right + window.scrollX - rect.width);
      const current = Math.round(parseFloat(popper.style.left || '0'));
      if (Number.isFinite(target) && Math.abs(current - target) > 1) {
        popper.style.left = `${target}px`;
      }
    }
  };

  function schedule(): void {
    if (queued) return;
    queued = true;
    requestAnimationFrame(align);
  }

  schedule();
  new MutationObserver(schedule).observe(document.body, { childList: true });
}

/** 数据页：tab 行/筛选条/说明块对齐主表左缘，右浮动图表对齐主表右缘。
 *  主表宽屏封顶 1900 后居中，兄弟块仍贴内容区两缘 → 量差值补内衬/外边距。 */
let dataPageTabAlignStarted = false;

function alignDataPageTabs(): void {
  if (dataPageTabAlignStarted) return;
  // 容器可能晚于 DOMContentLoaded 渲染（Vue）：找不到就先不置位，留给延时重试
  if (!document.querySelector('.data_content, .data-content')) return;
  dataPageTabAlignStarted = true;

  const padded = new Set<HTMLElement>();

  // 还原上一轮写的内联样式（含右浮动块）
  const restore = (el: HTMLElement) => {
    const undo = (key: 'jslPl' | 'jslMl' | 'jslMr' | 'jslImr', prop: string) => {
      const original = el.dataset[key];
      if (original === undefined) return;
      if (original) el.style.setProperty(prop, original);
      else el.style.removeProperty(prop);
      delete el.dataset[key];
    };
    undo('jslPl', 'padding-left');
    undo('jslMl', 'margin-left');
    undo('jslMr', 'margin-right');
    undo('jslImr', 'margin-right');
  };

  const apply = () => {
    // 先还原再量：否则被推开的块不再满足「贴边」条件，下一轮会反复抖动
    for (const el of padded) restore(el);
    padded.clear();

    const container =
      document.querySelector<HTMLElement>('.data_content') ??
      document.querySelector<HTMLElement>('.data-content');
    if (!container) return;
    const table = [
      ...container.querySelectorAll<HTMLElement>('.data_table_tabs table, .jsl-table'),
    ].find((t) => {
      const b = t.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    });
    if (!table) return;

    const tableRect = table.getBoundingClientRect();
    const cs = getComputedStyle(container);
    const contentLeft = container.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
    const offset = Math.round(tableRect.left - contentLeft);

    // ---- 左缘：贴内容左缘的兄弟块（满宽块用 padding，窄块用 margin） ----
    if (offset > 0) {
      const base = [
        ...container.querySelectorAll<HTMLElement>('div, p, form, ul, ol'),
      ].filter((el) => {
        if (el.closest('table') || el.contains(table)) return false;
        const b = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (s.display === 'none' || b.width < 200 || b.height < 8) return false;
        if (Math.abs(b.left - contentLeft) > 2) return false;
        // 图表容器（canvas/echarts）没有文字，但同样需要跟表格左缘对齐
        return !!(el.textContent ?? '').trim() || !!el.querySelector('canvas');
      });
      const baseSet = new Set(base);
      const candidates = base.filter(
        (el) => !(el.parentElement && baseSet.has(el.parentElement)),
      );
      const avail =
        container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      for (const el of candidates) {
        const narrow = el.getBoundingClientRect().width < avail - 2;
        el.dataset[narrow ? 'jslMl' : 'jslPl'] = narrow
          ? el.style.marginLeft
          : el.style.paddingLeft;
        el.style.setProperty(
          narrow ? 'margin-left' : 'padding-left',
          `${offset}px`,
          'important',
        );
        padded.add(el);
      }
    }

    // ---- 右缘：右浮动图表块（A股温度仪表盘等）贴主表右缘 ----
    // 目标右缘 = min(主表右缘, 行右缘)：表格宽于视口时右缘不可见，
    // 退回对齐行右缘而不是把图表推出屏幕。
    // 站方给 echarts 外层留了 10px 右内衬与 5px 上边距，先清零再按外框对齐，
    // 否则图形会比容器右缘缩进 10px。
    const floats = [
      ...container.querySelectorAll<HTMLElement>('div, section'),
    ].filter((el) => {
      if (el.closest('table') || el.contains(table)) return false;
      if (getComputedStyle(el).float !== 'right') return false;
      const b = el.getBoundingClientRect();
      if (b.width < 20 || b.height < 20) return false;
      return !!el.querySelector('canvas');
    });
    for (const el of floats) {
      if (floats.some((other) => other !== el && other.contains(el))) continue;
      const row = el.parentElement;
      if (!row) continue;
      const rowRight =
        row.getBoundingClientRect().right -
        parseFloat(getComputedStyle(row).paddingRight || '0');
      const target = Math.min(tableRect.right, rowRight);

      // echarts 内层（canvas 的祖辈里带内联 margin 的那个）：清零右/上内衬
      const inner = el.querySelector<HTMLElement>('div[style*="margin-right"]');
      if (inner && el !== inner && !inner.querySelector('div[style*="margin-right"]')) {
        inner.dataset.jslImr = inner.style.marginRight;
        inner.style.setProperty('margin-right', '0px', 'important');
        padded.add(inner);
      }

      const shift = Math.round(el.getBoundingClientRect().right - target);
      if (shift === 0) continue;
      const original = parseFloat(el.style.marginRight) || 0;
      el.dataset.jslMr = el.style.marginRight;
      el.style.setProperty('margin-right', `${original + shift}px`, 'important');
      padded.add(el);
    }
  };

  // 样式表异步加载、tablesorter 初始化、切 tab 都会改变表格位置 → 多轮复算
  apply();
  [300, 800, 1500, 2500, 4000].forEach((ms) => window.setTimeout(apply, ms));
  window.addEventListener('resize', apply);
  // 切子 tab 只换表格显隐，不触发 resize → 点击 tab 区后补一次
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.data_type_nav, .data_table_tabs, .nav-box, .el-menu')) return;
    requestAnimationFrame(apply);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyPageFlags();
  polishHeaderLinks();
  polishPortalNav();
  reorderUserNavMenu();
  injectThemeToggle();
  reflowCalendar();
  alignDataPagePoppers();
  alignDataPageTabs();
  // 延时重跑标志检测与 DOM 变换（幂等）
  const enhanceDataShellLater = () => {
    applyPageFlags();
    polishPortalNav();
    polishHeaderLinks();
    if (isDataShellPage()) {
      injectThemeToggle();
      movePublishToHeader();
      reorganizePortalFooter();
      alignDataPagePoppers();
      alignDataPageTabs();
    }
  };
  window.setTimeout(enhanceDataShellLater, 1200);
  window.setTimeout(enhanceDataShellLater, 2500);

  void loadSettings().then((settings) => {
    applySettings(settings);

    if (settings.enabled) {
      if (settings.modernList && document.querySelector('.aw-question-list')) {
        enhanceListPage();
      }
      if (settings.modernDetail && document.querySelector('.aw-question-detail-box')) {
        enhanceDetailPage();
      }
      // 设置页：会员信息 / 基本信息两张卡拆分（用户定稿）
      if (document.querySelector('.aw-user-setting')) {
        enhanceSettingsPage();
      }
      // 门户首页内容区重排（温度计上移/收费数据移除/APP 链接入页脚），
      // 以文章标题条的温度计容器为门户首页标志（搜索页等其他门户架构页不命中）
      if (document.querySelector('.first_column .right .title_box .indicator')) {
        enhancePortalHome();
      } else if (document.querySelector('.content_box')) {
        // 登录/注册页：内容区是独立登录卡，只复用页脚整理（与门户首页同一套文案结构）
        reorganizePortalFooter();
      } else if (isDataShellPage()) {
        // 实时数据页（Vue / 旧版服务端）：header 补「发起」，页脚与门户同一套
        movePublishToHeader();
        reorganizePortalFooter();
      }
    }

    watchSettings(applySettings);
  });
});
