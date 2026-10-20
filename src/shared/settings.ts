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
/** 完整设置的同步镜像：内容脚本在 DOMContentLoaded 即可直接跑 DOM 增强，
 *  不必等 chrome.storage 回包（storage 需唤醒 service worker，冷启动可达数百毫秒），
 *  回包后只做校正。写入时机与 chrome.storage 同步 */
const SETTINGS_CACHE_KEY = 'jsl-polish-settings';

export function loadSettings(): Promise<Settings> {
  return chrome.storage.sync.get(STORAGE_KEY).then((stored) => ({
    ...DEFAULT_SETTINGS,
    ...(stored[STORAGE_KEY] as Partial<Settings> | undefined),
  }));
}

export function saveSettings(settings: Settings): Promise<void> {
  cacheEnabledEarly(settings.enabled);
  cacheSettings(settings);
  return chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

/** 同步读取设置镜像；无缓存（首次安装/隐私模式）返回 null，调用方回退到 storage 回包 */
export function readSettingsCache(): Settings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Settings> | null;
    return parsed ? { ...DEFAULT_SETTINGS, ...parsed } : null;
  } catch {
    return null;
  }
}

function cacheSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // 同上
  }
}

/** storage 回包后回写同步镜像：镜像缺失（首次安装）或与 storage 有出入时，
 *  下次页面加载就能直接走缓存路径，不再等 storage */
export function writeSettingsCache(settings: Settings): void {
  cacheEnabledEarly(settings.enabled);
  cacheSettings(settings);
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
    const next = { ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEY].newValue as Partial<Settings>) };
    // 同步镜像跟随 storage（含其它标签页/其它设备的修改），下次加载不必等回包
    writeSettingsCache(next);
    callback(next);
  });
}
