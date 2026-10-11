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

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] as Partial<Settings> | undefined) };
}

export function saveSettings(settings: Settings): Promise<void> {
  return chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

export function watchSettings(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return;
    callback({ ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue as Partial<Settings>) });
  });
}
