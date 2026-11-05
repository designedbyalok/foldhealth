import { Icon } from '../../components/Icon/Icon';
import { MissedCallIcon } from '../../components/Icon/MissedCallIcon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { CallTypeAvatar } from '../../components/CallTypeAvatar/CallTypeAvatar';
import { DIR_LABEL } from '../../components/CallTypeAvatar/CallTypeAvatar.constants';
import { AgentsIcon } from '../agent-builder/nodes/NodeIcons';
import { getInitials } from './CallsViewHelpers.utils';
import styles from './CallsView.module.css';

const CALL_DIR_MAP = {
  outgoing: { icon: 'solar:outgoing-call-linear',  color: 'var(--primary-300)' },
  incoming: { icon: 'solar:incoming-call-linear',  color: 'var(--accent-teal)' },
  answered: { icon: 'solar:phone-calling-linear',  color: 'var(--accent-light-green)' },
  declined: { icon: 'solar:end-call-linear',       color: 'var(--status-error)' },
};

export function CallDirBadge({ dir, size = 14 }) {
  if (dir === 'missed') {
    return <MissedCallIcon size={size} color="var(--status-error)" />;
  }
  const cfg = CALL_DIR_MAP[dir] || CALL_DIR_MAP.outgoing;
  return <Icon name={cfg.icon} size={size} color={cfg.color} />;
}

export function EngagementScoreBadge({ score }) {
  if (score == null) return <span className={styles.dateDash}>-</span>;

  let color = '#D72825';
  if (score >= 85) color = '#009B53';
  else if (score >= 70) color = '#009B53';
  else if (score >= 30) color = '#D9A50B';

  return (
    <span
      className={styles.engBadge}
      style={{ color, background: `${color}15`, borderColor: `${color}25` }}
    >
      {score}%
    </span>
  );
}

export function CallListSkeleton() {
  return (
    <div className={styles.skeletonItem}>
      <div className={styles.skeletonAvatar} />
      <div className={styles.skeletonLines}>
        <div className={[styles.skeletonLine, styles.skeletonLineWide].join(' ')} />
        <div className={[styles.skeletonLine, styles.skeletonLineNarrow].join(' ')} />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className={styles.skeletonRow}>
      {[180, 140, 80, 100, 120, 60, 120].map((w, i) => (
        <td key={i} className={styles.td}>
          <div className={styles.skeletonCell} style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export function CallListItem({ entry, selected, onClick }) {
  return (
    <button
      type="button"
      className={[styles.convItem, selected ? styles.selected : ''].join(' ')}
      onClick={onClick}
    >
      <div className={styles.avatarWrap}>
        <Avatar variant="callCard" initials={getInitials(entry.name)} />
        <span className={styles.avatarBadge} aria-hidden="true">
          <CallDirBadge dir={entry.dir} size={10} />
        </span>
      </div>
      <div className={styles.convInfo}>
        <div className={styles.convNameRow}>
          <div className={styles.convName}>
            {entry.name}
            {entry.pinned && (
              <Icon name="solar:pin-bold" size={10} color="var(--primary-300)" className={styles.pin} />
            )}
          </div>
          <div className={styles.convTime}>{entry.time}</div>
        </div>
        <div className={styles.convPreview}>{entry.status}</div>
      </div>
    </button>
  );
}

export function CallsTableRow({ row, onClick }) {
  const hasGoals = row.goalStatus != null;
  const allMet = row.goalStatus?.allMet;

  return (
    <tr className={[styles.row, row.isNew ? styles.rowNew : ''].filter(Boolean).join(' ')} onClick={onClick}>
      <td className={`${styles.td} ${styles.tdStickyLeft}`}>
        <div className={styles.callsCell}>
          <CallTypeAvatar dir={row.dir} />
          <div className={styles.callsCellText}>
            <span className={styles.callDirText}>{DIR_LABEL[row.dir] || 'Call'}</span>
            <div className={styles.callsAgent}>
              {row.isBot
                ? <AgentsIcon size={11} />
                : <Icon name="solar:user-rounded-linear" size={11} color="var(--neutral-300)" />}
              <span>{row.agent}</span>
            </div>
          </div>
        </div>
      </td>
      <td className={styles.td}><span className={styles.secondaryText}>{row.date}</span></td>
      <td className={styles.td}>
        {row.duration != null
          ? <span className={styles.secondaryText}>{row.duration}</span>
          : <span className={styles.emDash}>-</span>}
      </td>
      <td className={styles.td}>
        <div className={styles.goalStatusCell}>
          {hasGoals ? (
            <>
              <Icon
                name={allMet ? 'solar:check-circle-linear' : 'solar:close-circle-linear'}
                size={15}
                color={allMet ? 'var(--status-success)' : 'var(--status-error)'}
              />
              <span className={styles.secondaryText}>{row.goalStatus.passed}/{row.goalStatus.total} Met</span>
            </>
          ) : (
            <span className={styles.emDash}>-</span>
          )}
        </div>
      </td>
      <td className={styles.td}>
        {row.engagementScore != null
          ? <EngagementScoreBadge score={row.engagementScore} />
          : <span className={styles.emDash}>-</span>}
      </td>
      <td className={styles.td}>
        <span className={row.ooh === 'Yes' ? styles.oohYes : styles.secondaryText}>{row.ooh}</span>
      </td>
      <td className={`${styles.td} ${styles.tdStickyRight}`} onClick={e => e.stopPropagation()}>
        <div className={styles.actionsCell}>
          <ActionButton icon="solar:play-circle-linear" tooltip="Play recording" />
          <span className={styles.actionDivider} />
          <ActionButton icon="solar:document-text-linear" tooltip="Transcript" />
          <span className={styles.actionDivider} />
          <ActionButton icon="solar:menu-dots-bold" tooltip="More" />
        </div>
      </td>
    </tr>
  );
}

