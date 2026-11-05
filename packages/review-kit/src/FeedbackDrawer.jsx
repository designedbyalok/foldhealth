import { useEffect, useMemo, useRef, useState } from 'react';
import { CloseIcon, ChevronIcon, GripIcon, PenIcon } from './icons';
import { themeToStyle, mergeLabels } from './theme';
import { KIT_ATTR } from './picker';

const cx = (...a) => a.filter(Boolean).join(' ');

const EMPTY_ITEMS = [];
const EMPTY_CLASSNAMES = {};

const DEFAULT_TABS = [
  { id: 'needs-review', label: 'Needs review' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'reviewed', label: 'Reviewed' },
];

/**
 * Side drawer that hosts a reviewer's queue of feedback items. The host
 * supplies the items. Clicking an item fires `onOpenItem(item)`, which the
 * host wires to navigate to the item's target and open the ReviewDock there.
 *
 * Separate from ReviewDock on purpose: ReviewDock is where feedback is
 * written; FeedbackDrawer is where the queue of what-needs-feedback lives.
 */
export function FeedbackDrawer({
  open,
  onClose,
  items = EMPTY_ITEMS,
  onOpenItem,
  onStartReview,
  title = 'Feedback',
  tabs = DEFAULT_TABS,
  defaultTab,
  theme,
  colorMode,
  labels,
  className,
  classNames = EMPTY_CLASSNAMES,
}) {
  const L = useMemo(() => mergeLabels(labels), [labels]);
  const themeStyle = useMemo(() => themeToStyle(theme), [theme]);
  const [tabId, setTabId] = useState(defaultTab || tabs[0]?.id);

  const counts = useMemo(() => {
    const c = {};
    for (const t of tabs) c[t.id] = 0;
    for (const it of items) if (c[it.status] != null) c[it.status] += 1;
    return c;
  }, [items, tabs]);

  const visible = useMemo(
    () => items.filter(it => it.status === tabId),
    [items, tabId]
  );

  const panel = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const layerProps = {
    className: cx('rk-root', 'rk-layer', 'rk-fb-layer', className, classNames.root),
    style: themeStyle,
    [KIT_ATTR]: '',
    ...(colorMode ? { 'data-rk-theme': colorMode } : {}),
  };

  return (
    <div {...layerProps}>
      <div className="rk-fb-scrim" onClick={onClose} aria-hidden="true" />
      <dialog
        ref={panel}
        open
        className={cx('rk-fb-panel', classNames.panel)}
        aria-label={title}
      >
        <header className="rk-fb-header">
          <div className="rk-fb-title">{title}</div>
          <div className="rk-fb-header-actions">
            {onStartReview && (
              <button
                type="button"
                className="rk-fb-start"
                onClick={onStartReview}
                aria-label="Start a review"
                title="Start a review"
              >
                <PenIcon />
                <span>Start a review</span>
              </button>
            )}
            <button type="button" className="rk-icon-btn" onClick={onClose} aria-label="Close" title="Close">
              <CloseIcon />
            </button>
          </div>
        </header>

        <nav className="rk-fb-tabs" role="tablist" aria-label={title}>
          {tabs.map((t) => {
            const n = counts[t.id] || 0;
            const on = t.id === tabId;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={cx('rk-fb-tab', on && 'rk-fb-tab-on')}
                onClick={() => setTabId(t.id)}
              >
                <span>{t.label}</span>
                <span className="rk-fb-tab-count">{n}</span>
              </button>
            );
          })}
        </nav>

        {visible.length === 0 ? (
          <div className="rk-fb-list">
            <div className="rk-fb-empty">
              <div className="rk-fb-empty-title">Nothing here yet</div>
              <div className="rk-fb-empty-body">
                {tabId === 'needs-review'
                  ? 'When someone requests feedback on a screen, it will show up here.'
                  : tabId === 'in-progress'
                    ? 'Reviews you start will land here until you send them.'
                    : 'Submitted reviews will stack up here.'}
              </div>
            </div>
          </div>
        ) : (
          <ul className="rk-fb-list">
            {visible.map((item) => (
              <li key={item.id}>
                <FeedbackCard item={item} onOpen={() => onOpenItem?.(item)} />
              </li>
            ))}
          </ul>
        )}
      </dialog>
    </div>
  );
}

function FeedbackCard({ item, onOpen }) {
  const shots = item.shots || item.attachmentCount || 0;
  const points = item.points || item.pointCount || 0;
  return (
    <button type="button" className="rk-fb-card" onClick={onOpen}>
      <div className="rk-fb-card-head">
        <div className="rk-fb-card-title" title={item.title}>{item.title}</div>
        {item.target && (
          <div className="rk-fb-card-target">{item.target}</div>
        )}
      </div>
      {item.description && (
        <div className="rk-fb-card-body">{item.description}</div>
      )}
      {item.previews && item.previews.length > 0 && (
        <div className="rk-fb-card-thumbs">
          {item.previews.slice(0, 4).map((src, i) => (
            <div key={i} className="rk-fb-card-thumb" style={{ backgroundImage: `url(${src})` }} />
          ))}
          {item.previews.length > 4 && (
            <div className="rk-fb-card-thumb rk-fb-card-thumb--more">+{item.previews.length - 4}</div>
          )}
        </div>
      )}
      <div className="rk-fb-card-meta">
        {points > 0 && <span>{points} {points === 1 ? 'point' : 'points'}</span>}
        {shots > 0 && <span>· {shots} {shots === 1 ? 'shot' : 'shots'}</span>}
        {item.requestedBy && <span>· {item.requestedBy}</span>}
        <span className="rk-fb-card-cta">
          <ChevronIcon direction="right" />
        </span>
      </div>
    </button>
  );
}

/**
 * Lightweight trigger button for a host app's nav. Shows a badge with the
 * count of items that need review.
 */
export function FeedbackTrigger({ count = 0, onClick, label = 'Feedback', className }) {
  return (
    <button type="button" className={cx('rk-fb-trigger', className)} onClick={onClick} aria-label={label}>
      <GripIcon />
      <span>{label}</span>
      {count > 0 && <span className="rk-fb-trigger-badge">{count}</span>}
    </button>
  );
}
