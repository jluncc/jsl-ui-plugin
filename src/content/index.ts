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
  // 旧版服务端渲染数据页（新股/ETF/LOF/债券/转债详情…）：
  // 常见是 .grid.data_content，计算器页（新股人品计算器/收益计算器）只有 .data_content
  if (document.querySelector('.data_content')) {
    root.classList.add('jsl-page-data-legacy');
  }
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

/** 数据页外壳判定：Vue 数据页（.data-content.auto-content-width）、
 *  Vue 数据外壳的其它页（持仓，有 #app 内的子导航）、
 *  旧版服务端数据页（.grid.data_content）。三者共用 header/footer 增强。 */
function isDataShellPage(): boolean {
  return (
    !!document.querySelector('.data-content.auto-content-width') ||
    !!document.querySelector('#app .layout-default .header_subnavbar_bg') ||
    !!document.querySelector('.data_content')
  );
}

/** 数据页 header 浮层：Element UI 的 popper 打开时被挂到 body 下，并按站方
 *  300px 宽度相对触发按钮居中定位；样式收窄成 148px 后左缘不变，右缘会比按钮
 *  缩进 74px（宽 300 时则溢出 header 104px）。把 popper 右缘对齐到触发按钮右缘。
 *  Element 在弹窗上回写 aria-describedby，用它反查触发元素。
 *  选择器只命中 Element UI 的 popper（门户/社区用的是 Bootstrap popover），不影响其它页。 */
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

document.addEventListener('DOMContentLoaded', () => {
  applyPageFlags();
  polishHeaderLinks();
  polishPortalNav();
  reorderUserNavMenu();
  injectThemeToggle();
  reflowCalendar();
  alignDataPagePoppers();
  // 数据页是 Vue/服务端两套外壳，header、子导航、页脚都可能晚于 DOMContentLoaded 出现：
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
