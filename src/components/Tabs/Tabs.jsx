import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Badge } from '../Badge/Badge';
import { resolveSize, warnDeprecated } from '../../lib/legacyProps';
import underline from './Tabs.module.css';
import pill from './PillTabs.module.css';

const normalize = (t) => (typeof t === 'string' ? { key: t, label: t } : t);

/**
 * Tabs: a row of tabs that switches what's shown below it.
 *
 *   variant="underline" (default): the app's tab bar, with a sliding underline
 *     under the active tab. Top-level and drawer tabs.
 *   variant="pill": the active tab becomes a white pill with a hairline border.
 *     A secondary switch inside a tab.
 *
 * To pick a value rather than switch content, use `SegmentedControl`.
 *
 * Keyboard: the tabs are one tab stop; Left / Right / Home / End move between
 * them and select as they go.
 *
 * @param {object} props
 * @param {(string|{key, label, icon?, count?, notif?})[]} props.items – a bare
 *   string is both key and label; `count` shows a number, `notif` a pulsing dot
 * @param {string} [props.value] – selected key (controlled)
 * @param {string} [props.defaultValue] – initially selected key (uncontrolled)
 * @param {(key: string) => void} [props.onValueChange]
 * @param {'underline'|'pill'} [props.variant='underline']
 * @param {'sm'|'md'} [props.size='md']
 * @param {React.ReactNode} [props.leading] – before the tabs (pill)
 * @param {React.ReactNode} [props.trailing] – pinned to the right end (underline)
 * @param {boolean} [props.fullWidth=true] – underline: bleed to the container edges
 * @param {boolean} [props.embedded] – underline: no bar chrome, for inside another header
 * @param {boolean} [props.embeddedBaseline] – underline, embedded: draw the bottom hairline
 * @param {boolean} [props.balanceTabs] – underline: tabs share the width equally
 */
export const Tabs = forwardRef(function Tabs({
  items = [], value, defaultValue, onValueChange, activeKey, onChange,
  variant = 'underline', size = 'md', leading, trailing,
  fullWidth = true, embedded = false, embeddedBaseline = false, balanceTabs = false,
  className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...rest
}, ref) {
  if (activeKey !== undefined) warnDeprecated('Tabs', 'activeKey', true, 'value');
  if (onChange && !onValueChange) warnDeprecated('Tabs', 'onChange', true, 'onValueChange');
  const list = items.map(normalize);
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? list[0]?.key);
  const controlledValue = value !== undefined ? value : activeKey;
  const current = controlledValue !== undefined ? controlledValue : uncontrolled;
  const select = (key) => {
    if (controlledValue === undefined) setUncontrolled(key);
    (onValueChange ?? onChange)?.(key);
  };

  const tabRefs = useRef(new Map());
  // One tab stop: the selected tab, or the first when the selection isn't in
  // this row (OverflowTabs moves it into More).
  const focusKey = list.some(t => t.key === current) ? current : list[0]?.key;
  const onKeyDown = (e) => {
    const i = list.findIndex(t => t.key === current);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: list.length - 1 }[e.key];
    if (next === undefined || !list.length) return;
    e.preventDefault();
    const t = list[(next + list.length) % list.length];
    select(t.key);
    tabRefs.current.get(t.key)?.focus();
  };
  const tabProps = (t) => ({
    type: 'button',
    role: 'tab',
    'aria-selected': t.key === current,
    tabIndex: t.key === focusKey ? 0 : -1,
    ref: (el) => { if (el) tabRefs.current.set(t.key, el); else tabRefs.current.delete(t.key); },
    onClick: () => select(t.key),
  });
  const tablist = (children) => (
    <div role="tablist" aria-label={ariaLabel} aria-labelledby={ariaLabelledby} className={variant === 'pill' ? pill.tabList : underline.tabList} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
  const sm = resolveSize('Tabs', size) === 'sm';

  if (variant === 'pill') {
    return (
      <div ref={ref} {...rest} className={[pill.subTabs, sm ? pill.sizeS : '', className].filter(Boolean).join(' ')}>
        {leading}
        {tablist(list.map(t => (
          <button key={t.key} {...tabProps(t)} className={`${pill.subTab} ${t.key === current ? pill.subTabActive : ''}`}>
            {t.label}
            {t.count != null && <span className={pill.count}>{t.count}</span>}
          </button>
        )))}
      </div>
    );
  }

  return (
    <UnderlineRow
      ref={ref}
      rest={rest}
      list={list}
      current={current}
      tabRefs={tabRefs}
      tabProps={tabProps}
      tablist={tablist}
      trailing={trailing}
      className={[
        underline.tabBar,
        embedded ? underline.embedded : '',
        embedded && embeddedBaseline ? underline.embeddedWithBaseline : '',
        !embedded && fullWidth ? underline.fullWidth : '',
        sm ? underline.sizeS : '',
        balanceTabs ? underline.balanceTabs : '',
        className || '',
      ].filter(Boolean).join(' ')}
      balanceTabs={balanceTabs}
    />
  );
});

const UnderlineRow = forwardRef(function UnderlineRow(
  { rest, list, current, tabRefs, tabProps, tablist, trailing, className, balanceTabs },
  ref,
) {
  const rowRef = useRef(null);
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });

  useLayoutEffect(() => {
    const row = rowRef.current;
    const el = tabRefs.current.get(current);
    if (!row || !el) return;
    // The underline lives in the row's scrolled content, so add scrollLeft
    // back; otherwise it lands under the wrong tab once the row scrolls.
    const measure = () => {
      const rowRect = row.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({ x: elRect.left - rowRect.left + row.scrollLeft, w: elRect.width, ready: true });
    };
    measure();
    // Re-measure when tab widths change after mount (web font swap, count
    // badges updating, container resize).
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    ro.observe(el);
    return () => ro.disconnect();
  }, [current, list, tabRefs]);

  const setRow = (el) => {
    rowRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  return (
    <div ref={setRow} {...rest} className={className}>
      {tablist(list.map((it) => {
        const active = it.key === current;
        return (
          <button
            key={it.key}
            {...tabProps(it)}
            className={[underline.tabItem, active ? underline.active : '', balanceTabs ? underline.tabItemBalanced : ''].filter(Boolean).join(' ')}
          >
            {it.icon && <Icon name={it.icon} size={14} color={active ? 'var(--primary-300)' : 'var(--neutral-300)'} />}
            {it.label}
            {typeof it.count === 'number' && <Badge label={String(it.count)} />}
            {it.notif && <span className={underline.notifDot} title="New activity" />}
          </button>
        );
      }))}
      <span
        className={underline.tabUnderline}
        aria-hidden
        style={{ transform: `translateX(${indicator.x}px)`, width: indicator.w, opacity: indicator.ready ? 1 : 0 }}
      />
      {trailing && (
        <>
          <span className={underline.trailingSpacer} aria-hidden />
          <div className={underline.trailing}>{trailing}</div>
        </>
      )}
    </div>
  );
});
