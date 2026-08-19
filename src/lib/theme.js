/**
 * Theme system
 * ────────────
 * Theme settings the user can choose:
 *   - 'light'   → always render the light palette (purple primary)
 *   - 'dark'    → always render the dark palette (purple primary)
 *   - 'blue'    → light-surface variant with a blue primary palette
 *                 (see `[data-theme="blue"]` block in tokens.css)
 *   - 'system'  → follow OS prefers-color-scheme, live-updating on change
 *
 * Adding more palettes: append to THEME_VALUES + ensure getResolvedTheme
 * returns the value as-is, then add a `[data-theme="<name>"]` block in
 * tokens.css. Also append the option to ThemePicker's OPTIONS list.
 *
 * Token cascade is driven entirely by `<html data-theme="...">` in tokens.css.
 * The `.dark` class is also applied (only for resolved === 'dark') so
 * Tailwind's `dark:` variant works for the few hand-written utility classes
 * that need explicit overrides.
 *
 * The blocking script in index.html performs the initial paint application
 * BEFORE React mounts, so this module's initTheme() reconciles the store
 * with what the script already wrote (and wires the system listener).
 */

export const THEME_STORAGE_KEY = 'theme';
export const THEME_VALUES = ['light', 'dark', 'blue', 'plum', 'system'];

/**
 * Nav style — independent of color theme.
 * 'default' keeps the per-theme dark-purple chrome.
 * 'light'   applies a hardcoded light sidebar across every color theme
 *           via [data-nav-style="light"] in tokens.css.
 */
export const NAV_STYLE_STORAGE_KEY = 'navStyle';
export const NAV_STYLE_VALUES = ['default', 'light'];

export function getStoredNavStyle() {
  try {
    const v = localStorage.getItem(NAV_STYLE_STORAGE_KEY);
    return NAV_STYLE_VALUES.includes(v) ? v : 'default';
  } catch {
    return 'default';
  }
}

export function persistNavStyle(value) {
  try {
    localStorage.setItem(NAV_STYLE_STORAGE_KEY, value);
  } catch {
    /* localStorage unavailable */
  }
}

/** Apply nav style to <html>. 'default' removes the attribute entirely. */
export function applyNavStyle(value) {
  if (typeof document === 'undefined') return value;
  const safe = NAV_STYLE_VALUES.includes(value) ? value : 'default';
  const root = document.documentElement;
  if (safe === 'default') root.removeAttribute('data-nav-style');
  else root.setAttribute('data-nav-style', safe);
  persistNavStyle(safe);
  return safe;
}

export function initNavStyle() {
  const value = getStoredNavStyle();
  applyNavStyle(value);
  return value;
}

/**
 * Contrast setting — independent of color theme.
 * 'default' keeps the standard neutral scale.
 * 'high'    boosts text and border tokens for easier reading (older users,
 *           low-vision scenarios) via [data-contrast="high"] in tokens.css.
 */
export const CONTRAST_STORAGE_KEY = 'contrast';
export const CONTRAST_VALUES = ['default', 'high'];

export function getStoredContrast() {
  try {
    const v = localStorage.getItem(CONTRAST_STORAGE_KEY);
    return CONTRAST_VALUES.includes(v) ? v : 'default';
  } catch {
    return 'default';
  }
}

export function persistContrast(value) {
  try {
    localStorage.setItem(CONTRAST_STORAGE_KEY, value);
  } catch {
    /* localStorage unavailable */
  }
}

/** Apply contrast to <html>. 'default' removes the attribute entirely. */
export function applyContrast(value) {
  if (typeof document === 'undefined') return value;
  const safe = CONTRAST_VALUES.includes(value) ? value : 'default';
  const root = document.documentElement;
  if (safe === 'default') root.removeAttribute('data-contrast');
  else root.setAttribute('data-contrast', safe);
  persistContrast(safe);
  return safe;
}

export function initContrast() {
  const value = getStoredContrast();
  applyContrast(value);
  return value;
}

/**
 * Font-scale setting — independent of color theme.
 * 5 accessibility levels that adjust the root font-size so all rem-based
 * tokens scale proportionally. Mirrors Apple's Dynamic Type non-accessibility
 * range (xSmall → xxLarge), mapped to clean percentage steps.
 *
 *   smaller  → 87.5%
 *   small    → 93.75%
 *   default  → 100%
 *   large    → 112.5%
 *   larger   → 125%
 *
 * These are multipliers, not absolute px — they compose with the fluid base
 * root size (which grows with viewport width on large desktop panels). The
 * px each level resolves to therefore depends on screen size; on laptop
 * widths it is 14/15/16/18/20px. See `--root-font-fluid` in tokens.css.
 */
export const FONT_SCALE_STORAGE_KEY = 'fontScale';
export const FONT_SCALE_VALUES = ['smaller', 'small', 'default', 'large', 'larger'];

export function getStoredFontScale() {
  try {
    const v = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    return FONT_SCALE_VALUES.includes(v) ? v : 'default';
  } catch {
    return 'default';
  }
}

export function persistFontScale(value) {
  try {
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, value);
  } catch {
    /* localStorage unavailable */
  }
}

/** Apply font-scale to <html>. 'default' removes the attribute entirely. */
export function applyFontScale(value) {
  if (typeof document === 'undefined') return value;
  const safe = FONT_SCALE_VALUES.includes(value) ? value : 'default';
  const root = document.documentElement;
  if (safe === 'default') root.removeAttribute('data-font-scale');
  else root.setAttribute('data-font-scale', safe);
  persistFontScale(safe);
  return safe;
}

export function initFontScale() {
  const value = getStoredFontScale();
  applyFontScale(value);
  return value;
}

/** Resolve a setting ('system') down to an actual rendered theme. */
export function getResolvedTheme(setting) {
  if (setting === 'system') {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  // 'light' | 'dark' | 'blue' (or any future named palette) passes through.
  return THEME_VALUES.includes(setting) && setting !== 'system' ? setting : 'light';
}

/** Read the persisted theme setting; defaults to 'light'. */
export function getStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_VALUES.includes(v) ? v : 'light';
  } catch {
    return 'light';
  }
}

/** Persist the theme setting. Silently no-ops in private-mode browsers. */
export function persistTheme(setting) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, setting);
  } catch {
    /* localStorage unavailable */
  }
}

/**
 * Duration of the theme cross-fade in ms — mirrors --duration-base in
 * src/tokens/tokens.css. The +20ms cushion covers the last commit frame.
 */
const THEME_TRANSITION_MS = 200;
const THEME_TRANSITION_CLEAR_MS = THEME_TRANSITION_MS + 20;

/**
 * Apply a resolved theme ('light' | 'dark' | 'blue' | 'plum') to <html>.
 *
 * Coordinates with the [data-theme-transitioning] gate in src/index.css so
 * theme flips cross-fade. Initial paint is a no-op (guard: same-theme skip),
 * so the app boots without a fade.
 *
 * Never write `data-theme` directly outside this function — the attribute
 * pair is the contract.
 */
export function applyResolvedTheme(resolved) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root.getAttribute('data-theme') === resolved) {
    // Still ensure the .dark class matches on first boot; the initial
    // <html data-theme> may have been set by the blocking script without
    // the class toggle.
    root.classList.toggle('dark', resolved === 'dark');
    return;
  }
  root.setAttribute('data-theme-transitioning', '');
  // Wait one frame so the transitioning attribute applies before the color
  // tokens change. Without this, the color swap and the transition-property
  // set race and the fade is inconsistent.
  requestAnimationFrame(() => {
    root.setAttribute('data-theme', resolved);
    root.classList.toggle('dark', resolved === 'dark');
    setTimeout(() => {
      root.removeAttribute('data-theme-transitioning');
    }, THEME_TRANSITION_CLEAR_MS);
  });
}

/**
 * Apply a theme setting end-to-end:
 *   - Persist to localStorage
 *   - Resolve 'system' → actual
 *   - Update <html data-theme=...> + .dark class
 * Returns the resolved theme.
 */
export function applyTheme(setting) {
  const safe = THEME_VALUES.includes(setting) ? setting : 'light';
  persistTheme(safe);
  const resolved = getResolvedTheme(safe);
  applyResolvedTheme(resolved);
  return resolved;
}

/**
 * Subscribe to OS prefers-color-scheme changes.
 * Only triggers the callback while the active setting is 'system'.
 * Returns an unsubscribe function.
 */
export function subscribeToSystem(getCurrentSetting, onSystemChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    if (getCurrentSetting() === 'system') {
      const resolved = e.matches ? 'dark' : 'light';
      applyResolvedTheme(resolved);
      onSystemChange?.(resolved);
    }
  };
  // Modern browsers: addEventListener; legacy Safari: addListener
  if (mql.addEventListener) mql.addEventListener('change', handler);
  else mql.addListener(handler);
  return () => {
    if (mql.removeEventListener) mql.removeEventListener('change', handler);
    else mql.removeListener(handler);
  };
}

/**
 * One-time bootstrap called from main.jsx before React mounts.
 *  - Reads stored setting (defaulting to 'light')
 *  - Re-applies it (the index.html inline script already did this; this is a
 *    safety net in case the script failed in some browser)
 *  - Returns { setting, resolved } so the store can hydrate consistently.
 */
export function initTheme() {
  const setting = getStoredTheme();
  const resolved = applyTheme(setting);
  return { setting, resolved };
}
