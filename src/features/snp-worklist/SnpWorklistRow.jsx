import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { DownChevronIcon } from '../../components/Icon/DownChevronIcon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { PatientAvatarHover } from '../../components/PatientHoverCard/PatientAvatarHover';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../components/Badge/Badge';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { buildPatientRowMenuItems } from '../../components/MenuPopover/patientRowMenuItems';
import { useAppStore } from '../../store/useAppStore';
import { worklistMemberCallId } from '../../lib/patientCall';
import { clinicalRolesPickerLabel } from '../../lib/worklistAssignee';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import { pauseSummary } from '../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanPause';
import { CoveringNote } from '../ooo/CoveringNote';
import styles from './SnpWorklistRow.module.css';
import { OutreachStatus } from '../../components/OutreachStatus/OutreachStatus';
import { outreachFromSummary } from '../../components/OutreachStatus/outreachStatusModel';

const PROGRAM_SUB_STATUS_VARIANT = {
  'New':                  'neutral',
  'Engaged':              'info',
  'Declined':             'danger',
  'Unable to Reach':      'secondary',
  'Attempted':            'warning',
  '2nd Cont. – Fail':     'warning',
  'Enrolled':             'success',
  'Completed':            'success',
  'Closed - Other':       'neutral',
  'Closed - Excluded':    'neutral',
  'Closed - Do not call': 'danger',
};

const PROGRAM_SUB_STATUS_ITEMS = [
  { section: 'Not Started' },
  { key: 'New', label: 'New' },
  { divider: true },
  { section: 'In progress' },
  { key: 'Engaged', label: 'Engaged' },
  { key: 'Declined', label: 'Declined' },
  { key: 'Unable to Reach', label: 'Unable to Reach' },
  { key: 'Attempted', label: 'Attempted' },
  { key: 'Enrolled', label: 'Enrolled' },
  { divider: true },
  { section: 'Completed' },
  { key: 'Completed', label: 'Completed' },
  { divider: true },
  { section: 'Closed' },
  { key: 'Closed - Other', label: 'Closed - Other' },
  { key: 'Closed - Excluded', label: 'Closed - Excluded' },
  { key: 'Closed - Do not call', label: 'Closed - Do not call' },
];

const LANG_MAP = { en: 'English', es: 'Spanish', zh: 'Chinese', yue: 'Cantonese', ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', pa: 'Punjabi' };

// Outreach: the shared worklist outreach status (icon, result, date, attempt dots).
function OutreachCell({ outreach }) {
  return <OutreachStatus {...outreachFromSummary(outreach)} />;
}

const TAG_VARIANT_BY_TONE = {
  grey:  'neutral',
  blue:  'info',
  green: 'success',
  amber: 'warning',
  red:   'danger',
};

function TagCell({ tags, tagsMore }) {
  if (!tags?.length) return <span className={styles.mutedDash}>-</span>;
  return (
    <span className={styles.tagCell}>
      {tags.map(t => (
        <Badge size="md"
          key={t.label}
          tone={TAG_VARIANT_BY_TONE[t.tone] || 'neutral'}
          label={t.label}
        />
      ))}
      {tagsMore > 0 ? <span className={styles.tagMore}>+{tagsMore} More</span> : null}
    </span>
  );
}

const HCC_ONLY_ROLES = new Set(['Coder', 'Support', 'QA', 'Compliance']);

/**
 * Middle-column defs for the SNP worklist. Each carries `renderCell(member,
 * ctx)` so the ColumnsHeaderButton popover can hide + reorder columns and
 * the row body follows along. Sticky checkbox / Members / Actions columns
 * stay hardcoded around this band.
 *
 * ctx shape: {
 *   showStatusMenu, setShowStatusMenu, statusBtnRef,
 *   setSnpProgramSubStatus, setSnpAssignee, eligibleUsers,
 *   showToast,
 * }
 */
// Care Plan Status as coloured text with an icon (the column beside it
// already uses badges): Signed green with a check, Draft in warning colours,
// On Hold (a paused plan) in info blue, anything else (No Care Plan) grey.
const CARE_PLAN_STATUS_LOOK = {
  Signed: { className: styles.carePlanSigned, icon: 'solar:check-circle-linear' },
  Draft: { className: styles.carePlanDraft, icon: 'solar:pen-2-linear' },
  'On Hold': { className: styles.carePlanOnHold, icon: 'solar:pause-circle-linear' },
};
// Statuses with a plan behind them, which open it in the Review drawer.
const REVIEWABLE_CARE_PLAN = new Set(['Signed', 'Draft', 'On Hold']);
function CarePlanStatusBadge({ status, pause }) {
  if (!status) return <span className={styles.statusText}>-</span>;
  const look = CARE_PLAN_STATUS_LOOK[status];
  const badge = (
    <span className={`${styles.carePlanStatus} ${look?.className || styles.carePlanNone}`}>
      {look && <Icon name={look.icon} size={14} color="currentColor" />}
      <span className={styles.carePlanStatusLabel}>{status}</span>
    </span>
  );
  return pause ? <Tooltip label={pauseSummary(pause)}>{badge}</Tooltip> : badge;
}

export const SNP_MIDDLE_COLUMNS = [
  {
    key: 'programSubStatus',
    label: 'Program Sub Status',
    sortKey: 'programSubStatus',
    stopRowClickPropagation: true,
    renderCell: (m, ctx) => (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <button
          ref={ctx.statusBtnRef}
          type="button"
          className={styles.statusBadgeBtn}
          onClick={(e) => { e.stopPropagation(); ctx.setShowStatusMenu(v => !v); }}
          aria-haspopup="menu"
          aria-expanded={ctx.showStatusMenu}
        >
          <Badge
            size="md"
            tone={PROGRAM_SUB_STATUS_VARIANT[m.programSubStatus] || 'neutral'}
            label={m.programSubStatus}
            trailingIconElement={<DownChevronIcon size={13} color="currentColor" />}
          />
        </button>
        {ctx.showStatusMenu && (
          <MenuPopover
            anchorRef={ctx.statusBtnRef}
            items={PROGRAM_SUB_STATUS_ITEMS}
            onSelect={(key) => {
              ctx.setSnpProgramSubStatus?.(m.id, key);
              ctx.setShowStatusMenu(false);
            }}
            onClose={() => ctx.setShowStatusMenu(false)}
            width={220}
            ariaLabel="Change program sub status"
          />
        )}
      </span>
    ),
  },
  {
    key: 'carePlanStatus',
    label: 'Care Plan Status',
    sortKey: 'carePlanStatus',
    // Signed, Draft or On Hold opens the plan in the Review care plan drawer;
    // any other status (No Care Plan) is plain text.
    stopRowClickPropagation: true,
    renderCell: (m, ctx) => {
      const badge = <CarePlanStatusBadge status={m.carePlanStatus} pause={m.carePlanPause} />;
      if (!(m.patientId && m.programId && REVIEWABLE_CARE_PLAN.has(m.carePlanStatus))) return badge;
      return (
        <button
          type="button"
          className={styles.carePlanStatusLink}
          onClick={() => ctx.openCarePlanReview?.({
            patientId: m.patientId,
            patientName: m.name,
            // Patient context for the drawer's banner.
            patient: { initials: m.initials, name: m.name, gender: m.gender, age: m.age, memberId: m.memberId },
            program: { id: m.programId, code: 'SNP', name: 'Special Needs Plan' },
          })}
          aria-label={`Review ${m.name}'s ${m.carePlanStatus.toLowerCase()} care plan`}
        >
          {badge}
        </button>
      );
    },
  },
  {
    key: 'nextActionDue',
    label: 'Next Action Due',
    sortKey: 'nextActionDueSort',
    sortType: 'date',
    renderCell: (m) => <span className={styles.dateText}>{m.nextActionDue || '-'}</span>,
  },
  {
    key: 'outreach',
    label: 'Outreach',
    renderCell: (m) => <OutreachCell outreach={m.outreach} />,
  },
  {
    key: 'assignee',
    label: 'Assignee',
    sortKey: 'assigneeName',
    stopRowClickPropagation: true,
    renderCell: (m, ctx) => (
      m.assigneeName ? (
        <AssigneeChange
          name={m.assigneeName}
          initials={m.assigneeInitials}
          showRole={false}
          users={ctx.eligibleUsers}
          onSelect={(u) => ctx.setSnpAssignee(m.id, u)}
          pickerTitle="Change assignee"
        />
      ) : (
        <AssigneeChange
          unassigned
          showRole={false}
          users={ctx.eligibleUsers}
          onSelect={(u) => ctx.setSnpAssignee(m.id, u)}
          pickerTitle="Assign user"
        />
      )
    ),
  },
  {
    key: 'triggerDate',
    label: 'Trigger Date',
    sortKey: 'triggerDateSort',
    sortType: 'date',
    renderCell: (m) => <span className={styles.dateText}>{m.triggerDate || '-'}</span>,
  },
  {
    key: 'lastAdmission',
    label: 'Last Admission',
    sortKey: 'lastAdmissionSort',
    sortType: 'date',
    renderCell: (m) => <span className={styles.mutedDash}>{m.lastAdmission || '-'}</span>,
  },
  {
    key: 'trigger',
    label: 'Trigger',
    sortKey: 'trigger',
    renderCell: (m) => <span className={styles.triggerText}>{m.trigger || '-'}</span>,
  },
  {
    key: 'riskIq',
    label: 'Risk IQ',
    sortKey: 'riskIq',
    renderCell: (m) => <span className={styles.riskText}>{m.riskIq || 'Undetermined'}</span>,
  },
  {
    key: 'tags',
    label: 'Tags',
    renderCell: (m) => <TagCell tags={m.tags} tagsMore={m.tagsMore} />,
  },
  {
    key: 'taskCount',
    label: 'Tasks',
    sortKey: 'taskCount',
    sortType: 'number',
    renderCell: (m) => (
      m.taskCount
        ? <button type="button" className={styles.taskLink} onClick={e => e.stopPropagation()}>{m.taskCount}</button>
        : <span className={styles.mutedDash}>-</span>
    ),
  },
];

export function SnpWorklistRow({ member, columns, hiddenSet, isSelected, onSelect, coveringFor }) {
  const openQuickView = useAppStore(s => s.openQuickView);
  const openCarePlanReview = useAppStore(s => s.openCarePlanReview);
  const navigateToPatient = useAppStore(s => s.navigateToPatient);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const requestAddTask = useAppStore(s => s.requestAddTask);
  const setSnpProgramSubStatus = useAppStore(s => s.setSnpProgramSubStatus);
  const setSnpAssignee = useAppStore(s => s.setSnpAssignee);
  const platformUsers = useAppStore(s => s.platformUsers);
  const showToast = useAppStore(s => s.showToast);
  const openPatientEdit = useAppStore(s => s.openPatientEdit);
  const m = member;

  const middleCols = (columns || SNP_MIDDLE_COLUMNS)
    .filter(c => !c.sticky && !c.showCheckbox && c.renderCell);
  const visibleMiddle = hiddenSet ? middleCols.filter(c => !hiddenSet.has(c.key)) : middleCols;

  const eligibleUsers = [];
  for (const u of platformUsers) {
    if (u.clinicalRoles?.some(r => HCC_ONLY_ROLES.has(r))) continue;
    eligibleUsers.push({
      id: u.id,
      name: u.name,
      initials: u.initials,
      role: clinicalRolesPickerLabel(u),
    });
  }

  const [showDropdown, setShowDropdown] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const dropBtnRef = useRef(null);
  const callBtnRef = useRef(null);
  const statusBtnRef = useRef(null);

  const cellCtx = {
    openCarePlanReview,
    showStatusMenu,
    setShowStatusMenu,
    statusBtnRef,
    setSnpProgramSubStatus,
    setSnpAssignee,
    eligibleUsers,
    showToast,
  };

  const handleRowClick = () => {
    if (m.patientId) navigateToPatient(m.patientId);
    else showToast(`${m.name}, no linked patient record yet`);
  };

  const openInCareProgram = (e) => {
    e?.stopPropagation?.();
    navigateToPatient(m.patientId || m.id, {
      profileTab: 'Care Programs',
      programCode: 'SNP',
    });
  };
  const handleNameClick = (e) => {
    e.stopPropagation();
    openQuickView?.({ id: m.patientId || m.id, name: m.name, initials: m.initials, gender: m.gender, age: m.age, memberId: m.memberId, language: m.language });
  };
  const handleCallClick = (e) => {
    e.stopPropagation();
    openCallPopover(worklistMemberCallId(m), callBtnRef);
  };

  const menuItems = buildPatientRowMenuItems([
    { key: 'View Program', icon: 'solar:eye-linear', label: 'View Program' },
  ]);

  const runPatientRowAction = useAppStore(s => s.runPatientRowAction);
  const handleMenuSelect = (key) => {
    if (runPatientRowAction(key, m)) return;
    if (key === 'View Program') { openInCareProgram(); return; }
    if (key === 'Add Task') { requestAddTask?.({ member: m.name }); return; }
    if (key === 'Edit Details') {
      openPatientEdit('basic', {
        id: m.patientId || m.id,
        name: m.name,
        initials: m.initials,
        gender: m.gender,
        age: m.age,
        memberId: m.memberId,
      });
      return;
    }
    showToast(`${key} – coming soon`);
  };

  return (
    <tr className={styles.row} onClick={handleRowClick}>
      <td className={`${styles.checkTd} ${styles.stickyLeft}`} style={{ left: 0 }} onClick={e => e.stopPropagation()}>
        <Checkbox checked={isSelected} onCheckedChange={() => onSelect(m.id)} aria-label={`Select ${m.name}`} />
      </td>

      <td
        className={`${styles.membersTd} ${styles.stickyLeft}`}
        style={{ left: 36, cursor: 'pointer' }}
        title="Open patient quick view"
      >
        <div className={styles.patientCell}>
          <PatientAvatarHover patient={{ memberId: m.memberId, id: m.id, name: m.name, initials: m.initials, gender: m.gender, age: m.age, dob: m.dob }} />
          <div>
            <div className={styles.patientName}>
              <button className={styles.patientNameLink} onClick={handleNameClick}>{m.name}</button>{' '}
              {(() => {
                const dobLabel = formatDobDisplay(m.dob) || deriveDob(m.age, m.name);
                return (
                  <Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom">
                    <span className={styles.patientDemo}>({m.gender}•{m.age})</span>
                  </Tooltip>
                );
              })()}
            </div>
            <div className={styles.patientMeta}>
              <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                <FoldIdTag id={m.memberId} className={styles.foldId} showToast={showToast} />
              </span>{' '}•{' '}
              <Tooltip label={`Preferred Language: ${LANG_MAP[m.language] || 'English'}`} variant="light">
                <button type="button" className={styles.langBadge} onClick={e => e.stopPropagation()}>
                  {(m.language || 'en').toUpperCase()}
                </button>
              </Tooltip>
            </div>
            <CoveringNote people={coveringFor} />
          </div>
        </div>
      </td>

      {visibleMiddle.map(col => (
        <td
          key={col.key}
          data-col-key={col.key}
          className={styles.td}
          onClick={col.stopRowClickPropagation ? (e) => e.stopPropagation() : undefined}
        >
          {col.renderCell(m, cellCtx)}
        </td>
      ))}

      <td className={`${styles.td} ${styles.stickyRight}`} onClick={e => e.stopPropagation()}>
        <div className={styles.actionsCell}>
          <ActionButton
            icon="solar:eye-linear"
            tooltip="View Program"
            onClick={openInCareProgram}
          />
          <span className={styles.actionDivider} />
          <ActionButton
            ref={callBtnRef}
            icon="solar:phone-linear"
            tooltip="Call patient"
            onClick={handleCallClick}
          />
          <span className={styles.actionDivider} />
          <div style={{ position: 'relative' }}>
            <ActionButton
              ref={dropBtnRef}
              icon="solar:menu-dots-linear"
              tooltip="More options"
              onClick={(e) => { e.stopPropagation(); setShowDropdown(v => !v); }}
            />
            {showDropdown && (
              <MenuPopover
                anchorRef={dropBtnRef}
                items={menuItems}
                onSelect={(key) => { handleMenuSelect(key); setShowDropdown(false); }}
                onClose={() => setShowDropdown(false)}
                width={220}
                ariaLabel="Row actions"
              />
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
