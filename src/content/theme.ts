import type { ThemeMode } from '../shared/settings';

export type ResolvedTheme = 'light' | 'dark';

/** localStorage 同步缓存，document_start 阶段读取以避免深色闪白 */
const CACHE_KEY = 'jsl-polish-theme';

function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'auto' ? systemTheme() : mode;
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(CACHE_KEY, theme);
  } catch {
    // 隐私模式等场景下 localStorage 不可用，忽略
  }
}

/** document_start 阶段同步执行，赶在首帧渲染前定下主题 */
export function applyThemeEarly(): void {
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(CACHE_KEY);
  } catch {
    // 同上
  }
  applyTheme(cached === 'dark' || cached === 'light' ? cached : systemTheme());
}

let currentMode: ThemeMode = 'auto';

export function syncTheme(mode: ThemeMode): void {
  currentMode = mode;
  applyTheme(resolveTheme(mode));
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentMode === 'auto') applyTheme(systemTheme());
});
