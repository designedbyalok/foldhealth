import { Icon } from '../Icon/Icon';
import { HoverCard } from '../HoverCard/HoverCard';
import { OutreachActivityCard } from '../OutreachActivityCard/OutreachActivityCard';
import styles from './OutreachStatusCell.module.css';

const DOT_CLASS = { error: styles.dotFailed, success: styles.dotSuccess, warning: styles.dotNote, none: styles.dotPending };
const TONE = {
  success: { color: 'var(--status-success)', className: styles.statusOk },
  warning: { color: 'var(--status-warning)', className: styles.statusNote },
  error: { color: 'var(--status-error)', className: styles.statusFailed },
};

/**
 * OutreachStatusCell: the worklist "Outreach" cell (TOC / SNP / AWV look):
 * phone icon, last attempt's result + date, and one dot per attempt.
 *
 * outreach: null renders the muted "-" cell. Otherwise
 *   { status: 'Attended' | 'Note' | 'Failed' | …, tone?: 'success' | 'warning' | 'error',
 *     failed?: boolean (when no tone), date,
 *     dots: Array<'success' | 'warning' | 'error' | 'none'>, kind?: 'call' | 'letter' }
 * `title` sets a hover tooltip (e.g. who was contacted and the outcome).
 * `recent` (OutreachActivityCard items, newest first) replaces it with the
 * latest attempts in a card that opens after a short hover; `onViewAll`
 * adds its View All link.
 */
export function OutreachStatusCell({ outreach, title, recent, onViewAll }) {
  if (!outreach) {
    return (
      <span className={styles.none}>
        <Icon name="solar:phone-calling-linear" size={16} color="var(--neutral-200)" />
        <span className={styles.dash}>-</span>
      </span>
    );
  }
  const tone = TONE[outreach.tone || (outreach.failed ? 'error' : 'success')];
  const icon = outreach.kind === 'letter' ? 'solar:document-text-linear' : 'solar:phone-calling-linear';
  const withCard = recent?.length > 0;
  const cell = (
    <span className={styles.cell} title={withCard ? undefined : title}>
      <Icon name={icon} size={16} color={tone.color} />
      <span className={styles.body}>
        <span className={tone.className}>{outreach.status}</span>
        {outreach.date && <span className={styles.date}>{outreach.date}</span>}
        {outreach.dots?.length ? (
          <span className={styles.dots}>
            {outreach.dots.map((c, i) => <span key={i} className={`${styles.dot} ${DOT_CLASS[c] || styles.dotPending}`} />)}
          </span>
        ) : null}
      </span>
    </span>
  );
  if (!withCard) return cell;
  return (
    <HoverCard trigger={cell} width={329} openDelay={400} flush ariaLabel="Outreach activity">
      {(close) => <OutreachActivityCard items={recent} onViewAll={onViewAll ? () => { close(); onViewAll(); } : undefined} />}
    </HoverCard>
  );
}
