import { Icon } from '../../../../../../components/Icon/Icon';
import { LOG_TYPE_ICON } from './OutreachTab.utils';
import { LogRowMenu } from './OutreachLogRowMenu';
import styles from './OutreachTab.module.css';

const SMS_ICON = 'solar:chat-round-line-linear';

/**
 * Outreach log groups as shared ActivityLog entries, so the Outreach tab's
 * timeline reads like every other activity log: month headers, the icon
 * rail, meta line, headline with program badges, outcome and View Note.
 */
export function outreachActivityEntries(groups, { onEdit, onDelete } = {}) {
  return (groups || []).flatMap(group => [
    { t: 'group', label: group.label },
    ...group.logs.map(log => {
      const [by, role] = String(log.author || '').split(/ \((.*)\)$/);
      const programs = log.programs || [];
      return {
        id: log.id,
        t: 'outreach',
        icon: log.type === 'SMS' ? SMS_ICON : (LOG_TYPE_ICON[log.type]?.icon || 'solar:document-text-linear'),
        date: log.date,
        time: log.time,
        by,
        role,
        context: log.outreachSource
          ? <span className={styles.logMetaSource} title={`Source: ${log.outreachSource}`}>via {log.outreachSource}</span>
          : null,
        title: log.title,
        badges: programs.length
          ? programs
          : [{ label: 'Member Outreach', tone: 'grey', title: 'Member outreach: not tied to a care program' }],
        outcome: log.outcome,
        outcomeColor: log.outcomeColor,
        outcomeAside: log.type === 'Call' && log.callDetailsMissing ? (
          <span className={styles.logCallNoDetails} title="External call: call details not available">
            <Icon name="solar:info-circle-linear" size={10} color="var(--neutral-300)" />
            Call details unavailable
          </span>
        ) : null,
        expandLabel: 'View Note',
        note: log.note,
        callDetails: log.type === 'Call' ? log.callDetails : undefined,
        trailing: <LogRowMenu log={log} onEdit={onEdit} onDelete={onDelete} />,
      };
    }),
  ]);
}
