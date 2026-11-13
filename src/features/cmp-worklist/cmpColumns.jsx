import { Icon } from '../../components/Icon/Icon';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../components/Badge/Badge';
import { DownChevronIcon } from '../../components/Icon/DownChevronIcon';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { CmpOutreachCell } from './CmpOutreachCell';
import { CMP_STATUS_TONE } from './cmpStatuses';
import { CMP_CARE_TEAM_ROLES } from './cmpCareTeam';
import styles from './CmpWorklistRow.module.css';

const STATUS_MENU = Object.keys(CMP_STATUS_TONE).map(key => ({ key, label: key }));

const RISK_VARIANT = { Low: 'success', Medium: 'warning', High: 'danger' };


// Care team roles on each enrollment, after Assignee.
const ROLE_WIDTH = { nurseHealthCoach: 180, coordinator: 160, socialWorker: 160, communityHealthWorker: 210 };
const CARE_TEAM_ROLES = CMP_CARE_TEAM_ROLES.map(r => ({ ...r, width: ROLE_WIDTH[r.key] }));
const initialsOf = (name) => name.replace(/\./g, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

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
 * ctx shape: { statusAnchor, setStatusAnchor, updateCmpMemberStatus, showToast, onOpenEnrollment,
 *             users (assignee picker list), setCareTeam(enrollmentId, role, user) }
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
            tone={CMP_STATUS_TONE[e.progSubStatus] || 'info'}
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
    key: 'outreach',
    label: 'Outreach',
    sortKey: 'outreach',
    width: 150,
    perEnrollment: true,
    renderItem: (e) => <CmpOutreachCell member={e} />,
  },
  {
    key: 'assignee',
    label: 'Assignee',
    sortKey: 'assignee',
    width: 170,
    perEnrollment: true,
    renderItem: (e, ctx) => (
      <AssigneeChange
        name={e.assignee || undefined}
        initials={e.assigneeIn || undefined}
        oooUser={e.assignee ? { name: e.assignee } : undefined}
        unassigned={!e.assignee}
        showRole={false}
        users={ctx.users}
        pickerTitle={`Assignee · ${e.subProgram}`}
        onSelect={(u) => ctx.setCareTeam(e.id, 'assignee', u)}
      />
    ),
  },
  // The care team on the enrollment, one column per role (Assignee owns it).
  ...CARE_TEAM_ROLES.map(({ key, label, width }) => ({
    key,
    label,
    sortKey: key,
    width,
    perEnrollment: true,
    renderItem: (e, ctx) => (
      <AssigneeChange
        name={e[key] || undefined}
        initials={e[key] ? initialsOf(e[key]) : undefined}
        oooUser={e[key] ? { name: e[key] } : undefined}
        unassigned={!e[key]}
        showRole={false}
        users={ctx.users}
        pickerTitle={`${label} · ${e.subProgram}`}
        onSelect={(u) => ctx.setCareTeam(e.id, key, u)}
      />
    ),
  })),
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
    key: 'lastAdmission',
    label: 'Last Admission',
    sortKey: 'lastAdmissionSort',
    width: 140,
    renderCell: (member) => member.lastAdmission || '-',
  },
  {
    key: 'caseAcuity',
    label: 'Case Acuity',
    sortKey: 'caseAcuityRank',
    width: 120,
    renderCell: (member) => member.caseAcuity || '-',
  },
  {
    key: 'riskTier',
    label: 'Risk Level',
    sortKey: 'riskTier',
    width: 140,
    renderCell: (member) => member.riskTier || '-',
  },
  {
    key: 'tags',
    label: 'Tags',
    width: 200,
    // The first tag, then "+N More" with the rest on hover.
    renderCell: (member) => {
      const tags = member.tags || [];
      if (!tags.length) return '-';
      const rest = tags.slice(1);
      return (
        <span className={styles.tags}>
          <Badge size="sm" tone="info" label={tags[0]} />
          {rest.length > 0 && (
            <Tooltip label={rest.join(', ')} placement="bottom">
              <span className={styles.tagsMore}>+{rest.length} More</span>
            </Tooltip>
          )}
        </span>
      );
    },
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
