export type ThemeMode = 'auto' | 'light' | 'dark';

export interface Settings {
  /** 总开关：关闭后移除所有样式与增强 */
  enabled: boolean;
  themeMode: ThemeMode;
  /** 帖子列表现代化 */
  modernList: boolean;
  /** 帖子详情现代化 */
  modernDetail: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  themeMode: 'auto',
  modernList: true,
  modernDetail: true,
};

const STORAGE_KEY = 'settings';
/** localStorage 早期缓存：content script 在 document_start 同步读取，
 *  避免 chrome.storage 异步回包前站点以原样式渲染造成闪烁 */
const ENABLED_CACHE_KEY = 'jsl-polish-enabled';

export function loadSettings(): Promise<Settings> {
  return chrome.storage.sync.get(STORAGE_KEY).then((stored) => ({
    ...DEFAULT_SETTINGS,
    ...(stored[STORAGE_KEY] as Partial<Settings> | undefined),
  }));
}

export function saveSettings(settings: Settings): Promise<void> {
  cacheEnabledEarly(settings.enabled);
  return chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

/** 同步应用总开关（document_start 用）；缓存缺失时按开启处理 */
export function applyEnabledEarly(): void {
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(ENABLED_CACHE_KEY);
  } catch {
    // 隐私模式等场景下 localStorage 不可用，忽略
  }
  document.documentElement.classList.toggle('jsl', cached !== '0');
}

function cacheEnabledEarly(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_CACHE_KEY, enabled ? '1' : '0');
  } catch {
    // 同上
  }
}

export function watchSettings(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return;
    callback({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue as Partial<Settings>) });
  });
}
