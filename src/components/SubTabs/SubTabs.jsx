import { useState } from 'react';
import { resolveSize, warnDeprecated } from '../../lib/legacyProps';
import styles from './SubTabs.module.css';

/**
 * SubTabs: the pill-style secondary tab row (the Care Programs sub-tab
 * pattern). A row of buttons where the active one becomes a white pill with a
 * hairline border. Distinct from the underline `TabStrip` used for the app's
 * top-level tabs; use this for a secondary switch inside a tab.
 *
 * Props:
 *  - tabs      (string | {key,label,count})[]: tab definitions. A bare string
 *                                          is both the key and the label; `count`
 *                                          shows a small bordered number badge.
 *  - value     string: the selected tab's key (controlled).
 *  - defaultValue string: the initially selected key (uncontrolled).
 *  - onValueChange (key) => void: called with a tab's key on click.
 *                                          (`activeKey` / `onChange` are the old names)
 *  - leading   ReactNode: optional content rendered before the
 *                                          tabs (e.g. a search toggle + divider).
 *  - size      'md' | 'sm', sm: 24px tall, 13px text, for a switch
 *                                          inside a drawer tab
 *  - className string
 *  - ...rest   spread on the row
 */
export function SubTabs({
  tabs, value, defaultValue, onValueChange, activeKey, onChange,
  leading, size = 'md', className, ...rest
}) {
  if (activeKey !== undefined) warnDeprecated('SubTabs', 'activeKey', true, 'value');
  if (onChange && !onValueChange) warnDeprecated('SubTabs', 'onChange', true, 'onValueChange');
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const controlledValue = value !== undefined ? value : activeKey;
  const current = controlledValue !== undefined ? controlledValue : uncontrolled;
  const select = (key) => {
    if (controlledValue === undefined) setUncontrolled(key);
    (onValueChange ?? onChange)?.(key);
  };
  return (
    <div {...rest} className={[styles.subTabs, resolveSize('SubTabs', size) === 'sm' ? styles.sizeS : '', className].filter(Boolean).join(' ')}>
      {leading}
      {tabs.map((t) => {
        const key = typeof t === 'string' ? t : t.key;
        const label = typeof t === 'string' ? t : t.label;
        const count = typeof t === 'string' ? undefined : t.count;
        return (
          <button
            key={key}
            type="button"
            className={`${styles.subTab} ${current === key ? styles.subTabActive : ''}`}
            aria-pressed={current === key}
            onClick={() => select(key)}
          >
            {label}
            {count != null && <span className={styles.count}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
