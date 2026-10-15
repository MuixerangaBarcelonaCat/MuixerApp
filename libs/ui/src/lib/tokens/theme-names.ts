import type { ThemeMode } from './color';

/**
 * The DaisyUI theme names registered in tailwind.config.ts, one per mode. Shared by the config,
 * ThemeService, ThemeScopeDirective and the pre-boot script in both apps' index.html (which can't
 * import this, so a spec in each app checks it stays in sync).
 */
export const THEME_NAMES: Record<ThemeMode, string> = {
  light: 'colla-barcelona-light',
  dark: 'colla-barcelona-dark',
};

/** localStorage key for the per-device preference. Absent means "follow the system". */
export const THEME_STORAGE_KEY = 'muixer_theme';
