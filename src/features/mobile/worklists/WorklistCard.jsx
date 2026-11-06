import { useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { initialsOf } from '../mobileFormat';
import styles from './WorklistCard.module.css';

const SUB_ITEMS_SHOWN = 2;

/**
 * One worklist row as a card: who, the program status, the fields a
 * provider acts on, stacked enrollments or gaps, and Call / Open.
 * `onStatus(status)` opens the status picker for a status with options;
 * `onAssign()` the card's assignee picker; `onSub(sub)` a sub-row's own
 * action (open a gap, or a CMP enrollment's care team); `onPush(target)` a
 * field or the card's detail screen ({ screen, props }).
 */
export function WorklistCard({ card, onStatus, onAssign, onSub, onPush, onCall, onOpen, note }) {
  const [expanded, setExpanded] = useState(false);
  const subs = card.subItems || [];
  const shownSubs = expanded ? subs : subs.slice(0, SUB_ITEMS_SHOWN);

  return (
    <article className={styles.card}>
      <button type="button" className={styles.head} onClick={onOpen}>
        <Avatar variant="patient" size="L" initials={card.initials && card.initials !== '??' ? card.initials : initialsOf(card.name)} />
        <span className={styles.who}>
          <span className={styles.name}>{card.name}</span>
          {card.meta && <span className={styles.meta}>{card.meta}</span>}
        </span>
      </button>
      {card.status && <StatusBadge status={card.status} onStatus={onStatus} className={styles.headStatus} />}

      {card.fields.length > 0 && (
        <dl className={styles.fields}>
          {card.fields.map(f => {
            const act = f.action === 'assign' ? (card.assign && onAssign) : f.action && (() => onPush(f.action));
            return (
              <div key={f.label} className={styles.field}>
                <dt className={styles.label}>{f.label}</dt>
                <dd className={[styles.value, f.danger ? styles.danger : ''].join(' ')}>
                  {act ? (
                    <button type="button" className={styles.fieldBtn} aria-label={`${f.label}: ${f.value}. ${f.action === 'assign' ? 'Change' : 'Open'}`} onClick={act}>
                      <span className={styles.fieldBtnText}>{f.value}</span>
                      <Icon name={f.action === 'assign' ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} size={16} color="currentColor" />
                    </button>
                  ) : f.value}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {subs.length > 0 && (
        <ul className={styles.subs}>
          {shownSubs.map(sub => (
            <li key={sub.key} className={styles.sub}>
              {sub.open || sub.team ? (
                <button
                  type="button"
                  className={`${styles.subText} ${styles.subBtn}`}
                  aria-label={`${sub.title}${sub.detail ? `, ${sub.detail}` : ''}. ${sub.open ? 'Open' : 'Care team'}`}
                  onClick={() => onSub(sub)}
                >
                  <span className={styles.subTitle}>
                    {sub.title}
                    <Icon name={sub.open ? 'solar:alt-arrow-right-linear' : 'solar:users-group-rounded-linear'} size={16} color="var(--neutral-300)" />
                  </span>
                  {sub.detail && <span className={[styles.subDetail, sub.danger ? styles.danger : ''].join(' ')}>{sub.detail}</span>}
                </button>
              ) : (
                <span className={styles.subText}>
                  <span className={styles.subTitle}>{sub.title}</span>
                  {sub.detail && <span className={[styles.subDetail, sub.danger ? styles.danger : ''].join(' ')}>{sub.detail}</span>}
                </span>
              )}
              {sub.status && <StatusBadge status={sub.status} onStatus={onStatus} />}
            </li>
          ))}
          {subs.length > SUB_ITEMS_SHOWN && (
            <li>
              <button type="button" className={styles.more} onClick={() => setExpanded(v => !v)}>
                {expanded ? 'Show less' : `View ${subs.length - SUB_ITEMS_SHOWN} more`}
              </button>
            </li>
          )}
        </ul>
      )}

      {note && <p className={styles.note}>{note}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={onCall}>
          <Icon name="solar:phone-linear" size={20} color="currentColor" />
          Call
        </button>
        <button type="button" className={styles.action} onClick={onOpen}>
          <Icon name="solar:user-id-linear" size={20} color="currentColor" />
          Open
        </button>
        {card.detail && (
          <button type="button" className={styles.action} onClick={() => onPush(card.detail)}>
            <Icon name={card.detail.icon} size={20} color="currentColor" />
            {card.detail.label}
          </button>
        )}
      </div>
    </article>
  );
}

function StatusBadge({ status, onStatus, className }) {
  const editable = status.options?.length > 0 && status.set;
  const badge = (
    <Badge
      size="md"
      tone={status.tone || 'neutral'}
      variant="soft"
      label={status.label}
      chevron={editable || undefined}
    />
  );
  if (!editable) return <span className={className}>{badge}</span>;
  return (
    <button
      type="button"
      className={[styles.statusBtn, className].filter(Boolean).join(' ')}
      aria-label={`Status: ${status.label}. Change status`}
      onClick={() => onStatus(status)}
    >
      {badge}
    </button>
  );
}
