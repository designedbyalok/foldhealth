import styles from './SubTabs.module.css';

/**
 * SubTabs — the pill-style secondary tab row (the Care Programs sub-tab
 * pattern). A row of buttons where the active one becomes a white pill with a
 * hairline border. Distinct from the underline `TabStrip` used for the app's
 * top-level tabs; use this for a secondary switch inside a tab.
 *
 * Props:
 *  - tabs      (string | {key,label})[]  — tab definitions. A bare string is
 *                                          both the key and the label.
 *  - activeKey string                    — the selected tab's key.
 *  - onChange  (key) => void             — called with a tab's key on click.
 *  - leading   ReactNode                 — optional content rendered before the
 *                                          tabs (e.g. a search toggle + divider).
 *  - className string
 */
export function SubTabs({ tabs, activeKey, onChange, leading, className }) {
  return (
    <div className={[styles.subTabs, className].filter(Boolean).join(' ')}>
      {leading}
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.key;
        const label = typeof t === 'string' ? t : t.label;
        return (
          <button
            key={key}
            type="button"
            className={`${styles.subTab} ${activeKey === key ? styles.subTabActive : ''}`}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
