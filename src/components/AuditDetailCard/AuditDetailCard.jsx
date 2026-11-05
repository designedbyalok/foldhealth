import { Fragment } from 'react';
import { Icon } from '../Icon/Icon';
import { Badge } from '../Badge/Badge';
import { Link } from '../Link/Link';
import { ActionButton } from '../ActionButton/ActionButton';
import styles from './AuditDetailCard.module.css';

/**
 * AuditDetailCard: the expandable detail card behind a history timeline's
 * "View Details". A bordered card of titled sections, each with an optional
 * caption, trailing badges, a from → to pair and a free-text body.
 *
 * @param {Array<string>} [props.header]  Attribution lines, joined with dots.
 * @param {Array} props.sections
 *   { id, title, titleAction: {label, onClick}, caption,
 *     badges: [{label, tone, icon, onClick}], change: {from, to}, body,
 *     onClick }
 * @param {() => void} [props.onOpen]  Renders the corner action when supplied.
 * @param {string} [props.openTooltip]
 */
export function AuditDetailCard({ header, sections, onOpen, openTooltip = 'Open' }) {
  if (!sections?.length) return null;
  return (
    <div className={styles.card}>
      <div className={styles.inner}>
        {header?.length > 0 && (
          <div className={styles.header}>
            {header.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <span>•</span>}
                <span>{part}</span>
              </Fragment>
            ))}
          </div>
        )}

        {sections.map((s, i) => (
          <div
            key={s.id ?? i}
            className={`${styles.section} ${s.onClick ? styles.sectionClickable : ''}`}
            role={s.onClick ? 'button' : undefined}
            tabIndex={s.onClick ? 0 : undefined}
            onClick={s.onClick}
            onKeyDown={s.onClick
              ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.onClick(); } }
              : undefined}
          >
            {s.title && (
              <div className={styles.titleRow}>
                <span className={styles.sectionTitle}>{s.title}</span>
                {s.titleAction && (
                  <Link onClick={s.titleAction.onClick}>{s.titleAction.label}</Link>
                )}
              </div>
            )}
            {s.body && <span className={styles.sectionBody}>{s.body}</span>}
            {(s.caption || s.badges?.length || s.change) && (
              <div className={styles.caption}>
                {s.caption && <span>{s.caption}</span>}
                {s.badges?.map((b, bi) => (b.onClick
                  ? (
                    <button
                      key={bi}
                      type="button"
                      className={styles.badgeButton}
                      onClick={(e) => { e.stopPropagation(); b.onClick(); }}
                    >
                      <Badge tone={b.tone || 'neutral'} size="sm" icon={b.icon} label={b.label} />
                    </button>
                  )
                  : <Badge key={bi} tone={b.tone || 'neutral'} size="sm" icon={b.icon} label={b.label} />
                ))}
                {s.change && (
                  <>
                    <Badge tone={s.change.fromTone || 'neutral'} size="sm" label={s.change.from} />
                    <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-200)" />
                    <Badge tone={s.change.toTone || 'neutral'} size="sm" label={s.change.to} />
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {onOpen && (
        <div className={styles.actionCol}>
          <ActionButton
            icon="solar:arrow-right-up-linear"
            size="sm"
            tooltip={openTooltip}
            onClick={onOpen}
          />
        </div>
      )}
    </div>
  );
}
