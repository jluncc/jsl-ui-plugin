import { loadSettings, watchSettings } from '../shared/settings';
import { applyThemeEarly, syncTheme } from './theme';
import { enhanceListPage } from './modules/list';
import { enhanceDetailPage } from './modules/detail';
import { enhancePortalHome } from './modules/portal';
import { injectThemeToggle } from './modules/theme-toggle';

applyThemeEarly();

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

function applySettings(settings: { enabled: boolean; themeMode: 'auto' | 'light' | 'dark' }): void {
  document.documentElement.classList.toggle('jsl', settings.enabled);
  syncTheme(settings.themeMode);
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

document.addEventListener('DOMContentLoaded', () => {
  applyPageFlags();
  polishHeaderLinks();
  polishPortalNav();
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
