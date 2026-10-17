import { applyEnabledEarly, loadSettings, watchSettings, type Settings } from '../shared/settings';
import { applyThemeEarly, syncTheme } from './theme';
import { enhanceListPage } from './modules/list';
import { enhanceDetailPage } from './modules/detail';
import { enhancePortalHome } from './modules/portal';
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

/** 门户导航简化：去掉「首页」入口、「社区-知识库」简化为「社区」（与社区页导航一致） */
function polishPortalNav(): void {
  if (!document.querySelector('.header_navbar_bg')) return;
  document.getElementById('top_nav_menu_home')?.remove();
  const forumLink = document.querySelector('#top_nav_menu_forum a');
  if (forumLink) forumLink.textContent = '社区';
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

document.addEventListener('DOMContentLoaded', () => {
  applyPageFlags();
  polishHeaderLinks();
  polishPortalNav();
  reorderUserNavMenu();
  injectThemeToggle();

  void loadSettings().then((settings) => {
    applySettings(settings);

    if (settings.enabled) {
      if (settings.modernList && document.querySelector('.aw-question-list')) {
        enhanceListPage();
      }
      if (settings.modernDetail && document.querySelector('.aw-question-detail-box')) {
        enhanceDetailPage();
      }
      // 门户首页内容区重排（温度计上移/收费数据移除/APP 链接入页脚），
      // 以文章标题条的温度计容器为门户首页标志（搜索页等其他门户架构页不命中）
      if (document.querySelector('.first_column .right .title_box .indicator')) {
        enhancePortalHome();
      }
    }

    watchSettings(applySettings);
  });
});
