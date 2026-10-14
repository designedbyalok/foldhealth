import { useState, useRef, useEffect } from 'react';
import { Icon } from '../Icon/Icon';
import { Switch } from '../Switch/Switch';
import { useAppStore } from '../../store/useAppStore';
import styles from './ThemePicker.module.css';

/**
 * ThemePicker — dropdown-based theme selector.
 *
 * Built as a dropdown (rather than a segmented control) so additional themes
 * can be added later — e.g. high-contrast, custom brand palettes — without the
 * row blowing out horizontally inside the profile popover.
 *
 * Reads/writes the current theme via useAppStore. All color transitions are
 * handled by the global 200ms cascade in index.css when token values flip
 * under [data-theme="<name>"].
 */
const FONT_SCALE_OPTIONS = [
  { value: 'smaller', label: 'A', size: 11 },
  { value: 'small',   label: 'A', size: 12 },
  { value: 'default', label: 'A', size: 14 },
  { value: 'large',   label: 'A', size: 16 },
  { value: 'larger',  label: 'A', size: 18 },
];

const OPTIONS = [
  { value: 'light',  label: 'Light',        icon: 'solar:sun-2-linear' },
  { value: 'dark',   label: 'Dark',         icon: 'solar:moon-stars-linear' },
  { value: 'blue',   label: 'Blue',         icon: 'solar:palette-linear' },
  { value: 'plum',   label: 'Astrana Plum', icon: 'solar:crown-star-linear' },
  { value: 'system', label: 'System',       icon: 'solar:monitor-smartphone-linear' },
];

export function ThemePicker() {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);
  const navStyle = useAppStore(s => s.navStyle);
  const setNavStyle = useAppStore(s => s.setNavStyle);
  const sidebarShape = useAppStore(s => s.sidebarShape);
  const setSidebarShape = useAppStore(s => s.setSidebarShape);
  const contrast = useAppStore(s => s.contrast);
  const setContrast = useAppStore(s => s.setContrast);
  const fontScale = useAppStore(s => s.fontScale);
  const setFontScale = useAppStore(s => s.setFontScale);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const current = OPTIONS.find(o => o.value === theme) || OPTIONS[0];

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrapper} ref={wrapRef}>
      <div className={styles.section}>
        <div className={styles.label}>Theme</div>
        <button
          type="button"
          className={styles.trigger}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Theme"
          onClick={() => setOpen(o => !o)}
        >
          <span className={styles.triggerLeft}>
            <Icon name={current.icon} size={14} color="currentColor" />
            <span>{current.label}</span>
          </span>
          <Icon name="solar:alt-arrow-down-linear" size={12} color="currentColor" />
        </button>
        {open && (
          <ul className={styles.menu} role="listbox" aria-label="Theme">
            {OPTIONS.map(opt => {
              const active = theme === opt.value;
              return (
                <li key={opt.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`${styles.item} ${active ? styles.itemActive : ''}`}
                    onClick={() => { setTheme(opt.value); setOpen(false); }}
                  >
                    <Icon name={opt.icon} size={14} color="currentColor" />
                    <span>{opt.label}</span>
                    {active && (
                      <span className={styles.check} aria-hidden="true">
                        <Icon name="solar:check-read-linear" size={14} color="var(--primary-300)" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className={styles.section}>
        <div className={styles.label}>Sidebar</div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleCopy}>
            <span className={styles.toggleTitle}>Minimal navigation</span>
            <span className={styles.toggleHint}>Adopts the active theme&rsquo;s primary color as the accent.</span>
          </span>
          <Switch
            checked={navStyle === 'light'}
            onChange={(next) => setNavStyle(next ? 'light' : 'default')}
            ariaLabel="Toggle light navigation"
          />
        </div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleCopy}>
            <span className={styles.toggleTitle}>Floating sidebar</span>
            <span className={styles.toggleHint}>Compact icon rail paired with an inline sub-nav as one floating card.</span>
          </span>
          <Switch
            checked={sidebarShape === 'floating'}
            onChange={(next) => setSidebarShape(next ? 'floating' : 'standard')}
            ariaLabel="Toggle floating sidebar"
          />
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.label}>Accessibility</div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleCopy}>
            <span className={styles.toggleTitle}>High contrast</span>
            <span className={styles.toggleHint}>Boosts text and border contrast for easier reading.</span>
          </span>
          <Switch
            checked={contrast === 'high'}
            onChange={(next) => setContrast(next ? 'high' : 'default')}
            ariaLabel="Toggle high contrast"
          />
        </div>
        <div className={styles.scaleRow}>
          <span className={styles.toggleCopy}>
            <span className={styles.toggleTitle}>Text size</span>
            <span className={styles.toggleHint}>Adjust font size across the application.</span>
          </span>
          <div className={styles.scaleSegments} role="radiogroup" aria-label="Text size">
            {FONT_SCALE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={fontScale === opt.value}
                aria-label={opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
                className={`${styles.scaleSeg} ${fontScale === opt.value ? styles.scaleSegActive : ''}`}
                style={{ fontSize: opt.size }}
                onClick={() => setFontScale(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
