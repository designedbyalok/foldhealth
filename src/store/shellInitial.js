import {
  applyTheme,
  getResolvedTheme,
  getStoredTheme,
  subscribeToSystem,
  applyNavStyle,
  getStoredNavStyle,
  applyContrast,
  getStoredContrast,
  applyFontScale,
  getStoredFontScale,
  applySidebarShape,
  getStoredSidebarShape,
} from '../lib/theme';

export const initialThemeSetting = getStoredTheme();
export const initialResolvedTheme = getResolvedTheme(initialThemeSetting);
export const initialNavStyle = getStoredNavStyle();
export const initialContrast = getStoredContrast();
export const initialFontScale = getStoredFontScale();
export const initialSidebarShape = getStoredSidebarShape();

applyNavStyle(initialNavStyle);
applyContrast(initialContrast);
applyFontScale(initialFontScale);
applySidebarShape(initialSidebarShape);

export function readChangelogSeenAt() {
  try {
    return localStorage.getItem('changelogSeenAt');
  } catch {
    return null;
  }
}
