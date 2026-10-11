import { loadSettings, watchSettings } from '../shared/settings';
import { applyThemeEarly, syncTheme } from './theme';
import { enhanceListPage } from './modules/list';
import { enhanceDetailPage } from './modules/detail';
import { injectThemeToggle } from './modules/theme-toggle';

applyThemeEarly();

function applyPageFlags(): void {
  const root = document.documentElement;
  // 集思录社区（WeCenter）所有页面共用 .aw-wecenter 外壳
  if (document.querySelector('.aw-wecenter')) root.classList.add('jsl-community');
  if (document.querySelector('.aw-question-list')) root.classList.add('jsl-page-list');
  if (document.querySelector('.aw-question-detail-box')) root.classList.add('jsl-page-detail');
}

function applySettings(settings: { enabled: boolean; themeMode: 'auto' | 'light' | 'dark' }): void {
  document.documentElement.classList.toggle('jsl', settings.enabled);
  syncTheme(settings.themeMode);
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
    }

    watchSettings(applySettings);
  });
});
