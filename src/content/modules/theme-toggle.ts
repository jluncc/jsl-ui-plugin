import { loadSettings, saveSettings } from '../../shared/settings';

const SUN_SVG = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="4"/>
  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
</svg>`;

const MOON_SVG = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

/** 向社区 header 注入深浅主题切换按钮；写入显式 themeMode 并由设置监听即时生效 */
export function injectThemeToggle(): void {
  const wrap = document.querySelector<HTMLElement>('.aw-top-menu-wrap');
  if (!wrap || wrap.querySelector('.jsl-theme-toggle')) return;

  const button = document.createElement('button');
  button.className = 'jsl-theme-toggle';
  button.type = 'button';

  button.addEventListener('click', () => {
    void (async () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      await saveSettings({ ...(await loadSettings()), themeMode: next });
    })();
  });

  const syncIcon = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    // 深色下显示太阳（点击切浅色），浅色下显示月亮
    button.innerHTML = dark ? SUN_SVG : MOON_SVG;
    button.title = dark ? '切换到浅色模式' : '切换到深色模式';
  };
  new MutationObserver(syncIcon).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  syncIcon();

  wrap.appendChild(button);
}
