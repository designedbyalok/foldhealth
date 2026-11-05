import { Icon } from '../../components/Icon/Icon';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../components/Badge/Badge';
import { DownChevronIcon } from '../../components/Icon/DownChevronIcon';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { CmpOutreachCell } from './CmpOutreachCell';
import styles from './CmpWorklistRow.module.css';

const STATUS_VARIANT = {
  New: 'info',
  Open: 'info',
  Attempted: 'warning',
  Engaged: 'success',
  'Engaged - Requires Follow Up': 'warning',
  'Unable to Reach': 'neutral',
};
const STATUS_MENU = Object.keys(STATUS_VARIANT).map(key => ({ key, label: key }));

const RISK_VARIANT = { Low: 'success', Medium: 'warning', High: 'danger' };

const CARE_PLAN_LOOK = {
  Signed: { className: styles.carePlanSigned, icon: 'solar:check-circle-linear' },
  Draft: { className: styles.carePlanDraft, icon: 'solar:pen-2-linear' },
};

const DAY_MS = 86400000;

// "Overdue: 3D" / "Due Today" / "Due in 5D" for an MM/DD/YYYY date.
function dueInfo(mdy) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mdy || '');
  if (!m) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(+m[3], +m[1] - 1, +m[2]) - today) / DAY_MS);
  if (days < 0) return { label: `Overdue: ${-days}D`, className: styles.dueOverdue };
  if (days === 0) return { label: 'Due Today', className: styles.dueSoon };
  return { label: `Due in ${days}D`, className: days <= 7 ? styles.dueSoon : styles.dueLater };
}

/**
 * Middle-column defs for CMP. One row per member; a member can be in several
 * CMP sub-programs, so the `perEnrollment` columns stack one line per
 * enrollment (`renderItem(enrollment, ctx)`, like HEDIS's per-gap columns)
 * and the rest render once for the member (`renderCell(member, ctx)`).
 *
 * ctx shape: { statusAnchor, setStatusAnchor, updateCmpMemberStatus, showToast, onOpenEnrollment }
 */
export const CMP_MIDDLE_COLUMNS = [
  {
    key: 'subProgram',
    label: 'Sub Program',
    sortKey: 'subProgram',
    width: 210,
    perEnrollment: true,
    renderItem: (e, ctx) => (
      <button
        type="button"
        className={styles.subProgramLink}
        onClick={(ev) => { ev.stopPropagation(); ctx.onOpenEnrollment(e); }}
      >
        {e.subProgram || '-'}
      </button>
    ),
  },
  {
    key: 'progSubStatus',
    label: 'Program Sub Status',
    sortKey: 'progSubStatus',
    width: 200,
    perEnrollment: true,
    renderItem: (e, ctx) => (
      <>
        <button
          type="button"
          className={styles.statusBtn}
          onClick={(ev) => { ev.stopPropagation(); ctx.setStatusAnchor({ id: e.id, el: ev.currentTarget }); }}
        >
          <Badge
            size="md"
            tone={STATUS_VARIANT[e.progSubStatus] || 'info'}
            label={e.progSubStatus}
            trailingIconElement={<DownChevronIcon size={12} color="currentColor" />}
          />
        </button>
        {ctx.statusAnchor?.id === e.id && (
          <MenuPopover
            anchorRef={{ current: ctx.statusAnchor.el }}
            width="auto"
            items={STATUS_MENU}
            onSelect={(key) => ctx.updateCmpMemberStatus(e.id, key)}
            onClose={() => ctx.setStatusAnchor(null)}
          />
        )}
      </>
    ),
  },
  {
    key: 'carePlanStatus',
    label: 'Care Plan Status',
    sortKey: 'carePlanStatus',
    width: 160,
    perEnrollment: true,
    renderItem: (e) => {
      const look = CARE_PLAN_LOOK[e.carePlanStatus];
      return (
        <span className={`${styles.carePlanStatus} ${look?.className || styles.carePlanNone}`}>
          {look && <Icon name={look.icon} size={14} color="currentColor" />}
          {e.carePlanStatus || '-'}
        </span>
      );
    },
  },
  {
    key: 'assignee',
    label: 'Assignee',
    sortKey: 'assignee',
    width: 170,
    perEnrollment: true,
    renderItem: (e, ctx) => (
      e.assignee ? (
        <AssigneeChange
          name={e.assignee}
          initials={e.assigneeIn}
          showRole={false}
          onClick={() => ctx.showToast(`Changing the assignee for ${e.name} is coming soon`)}
        />
      ) : (
        <AssigneeChange
          unassigned
          showRole={false}
          onClick={() => ctx.showToast(`Assigning an owner for ${e.name} is coming soon`)}
        />
      )
    ),
  },
  {
    key: 'outreach',
    label: 'Outreach',
    sortKey: 'outreach',
    width: 150,
    perEnrollment: true,
    renderItem: (e) => <CmpOutreachCell member={e} />,
  },
  {
    key: 'nextActionDue',
    label: 'Next Action Due',
    sortKey: 'nextActionDueSort',
    width: 150,
    perEnrollment: true,
    renderItem: (e) => {
      const due = dueInfo(e.nextActionDue);
      if (!due) return '-';
      return (
        <div className={styles.dueCell}>
          <div className={styles.dueDate}>{e.nextActionDue}</div>
          <div className={`${styles.dueLabel} ${due.className}`}>
            <Icon name="solar:clock-circle-linear" size={11} color="currentColor" />
            {due.label}
          </div>
        </div>
      );
    },
  },
  {
    key: 'programStartDate',
    label: 'Start Date',
    sortKey: 'programStartSort',
    width: 130,
    perEnrollment: true,
    renderItem: (e) => e.programStartDate || '-',
  },
  {
    key: 'programDueDate',
    label: 'Due Date',
    sortKey: 'programDueSort',
    width: 130,
    perEnrollment: true,
    renderItem: (e) => e.programDueDate || '-',
  },
  {
    key: 'ri',
    label: 'Risk IQ',
    sortKey: 'ri',
    width: 110,
    renderCell: (member) => (
      member.ri ? <Badge size="md" tone={RISK_VARIANT[member.ri] || 'success'} label={member.ri} /> : '-'
    ),
  },
  {
    key: 'task',
    label: 'Tasks',
    sortKey: 'task',
    width: 90,
    align: 'center',
    renderCell: (member) => (
      member.task > 0
        ? <span className={styles.taskBadge}>{member.task}</span>
        : <span className={styles.taskBadgeMuted}>0</span>
    ),
  },
];
