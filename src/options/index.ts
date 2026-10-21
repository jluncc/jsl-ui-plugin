import { loadSettings, saveSettings, type Settings, type ThemeMode } from '../shared/settings';

function init(): void {
  const seg = document.getElementById('theme-seg') as HTMLElement;
  const enabledInput = document.getElementById('opt-enabled') as HTMLInputElement;
  const versionLabel = document.getElementById('opt-version');

  // 版本号从 manifest 读取，避免打包版本与设置页文案各自漂移
  if (versionLabel) versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;

  let current = { ...({} as Settings) };

  const render = (settings: Settings) => {
    current = settings;
    document.documentElement.dataset.theme =
      settings.themeMode === 'auto'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : settings.themeMode;
    for (const button of seg.querySelectorAll<HTMLButtonElement>('button[data-value]')) {
      button.classList.toggle('active', button.dataset.value === settings.themeMode);
    }
    enabledInput.checked = settings.enabled;
  };

  const update = (patch: Partial<Settings>) => {
    current = { ...current, ...patch };
    render(current);
    void saveSettings(current);
  };

  seg.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-value]');
    if (button) update({ themeMode: button.dataset.value as ThemeMode });
  });
  enabledInput.addEventListener('change', () => update({ enabled: enabledInput.checked }));

  void loadSettings().then(render);
}

init();
