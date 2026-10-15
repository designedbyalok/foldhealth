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
  applyFloatingDensity,
  getStoredFloatingDensity,
} from '../lib/theme';

export const initialThemeSetting = getStoredTheme();
export const initialResolvedTheme = getResolvedTheme(initialThemeSetting);
export const initialNavStyle = getStoredNavStyle();
export const initialContrast = getStoredContrast();
export const initialFontScale = getStoredFontScale();
export const initialSidebarShape = getStoredSidebarShape();
export const initialFloatingDensity = getStoredFloatingDensity();

applyNavStyle(initialNavStyle);
applyContrast(initialContrast);
applyFontScale(initialFontScale);
applySidebarShape(initialSidebarShape);
applyFloatingDensity(initialFloatingDensity);

export function readProgramPanelSplit() {
  try {
    return localStorage.getItem('programPanelSplit') === 'true';
  } catch {
    return false;
  }
}

export function readChangelogSeenAt() {
  try {
    return localStorage.getItem('changelogSeenAt');
  } catch {
    return null;
  }
}
