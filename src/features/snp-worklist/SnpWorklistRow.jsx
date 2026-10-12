import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { DownChevronIcon } from '../../components/Icon/DownChevronIcon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { PatientAvatarHover } from '../../components/PatientHoverCard/PatientAvatarHover';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../components/Badge/Badge';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { buildPatientRowMenuItems } from '../../components/MenuPopover/patientRowMenuItems';
import { useAppStore } from '../../store/useAppStore';
import { worklistMemberCallId } from '../../lib/patientCall';
import { clinicalRolesPickerLabel } from '../../lib/worklistAssignee';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import styles from './SnpWorklistRow.module.css';

const PROGRAM_SUB_STATUS_VARIANT = {
  'New':                  'toc-new',
  'Engaged':              'toc-engaged',
  'Declined':             'lace-high',
  'Unable to Reach':      'priority-high',
  'Attempted':            'toc-attempted',
  '2nd Cont. – Fail':     'toc-attempted',
  'Enrolled':             'toc-enrolled',
  'Completed':            'toc-enrolled',
  'Closed - Other':       'toc-new',
  'Closed - Excluded':    'toc-new',
  'Closed - Do not call': 'lace-high',
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

const DOT_COLOR = { red: 'var(--status-error)', blue: 'var(--status-info)', grey: 'var(--neutral-200)' };

function OutreachCell({ outreach }) {
  if (!outreach) {
    return (
      <span className={styles.outreachNone}>
        <Icon name="solar:phone-calling-linear" size={16} color="var(--neutral-200)" />
        <span className={styles.mutedDash}>—</span>
      </span>
    );
  }
  const icon = outreach.kind === 'letter' ? 'solar:document-text-linear' : 'solar:phone-calling-linear';
  return (
    <span className={styles.outreachCell}>
      <Icon name={icon} size={16} color="var(--status-error)" />
      <span className={styles.outreachBody}>
        <span className={styles.outreachStatus}>{outreach.status}</span>
        <span className={styles.outreachDate}>{outreach.date}</span>
        {outreach.dots?.length ? (
          <span className={styles.dots}>
            {outreach.dots.map((c, i) => (
              <span key={i} className={styles.dot} style={{ background: DOT_COLOR[c] || DOT_COLOR.grey }} />
            ))}
          </span>
        ) : null}
      </span>
    </span>
  );
}

const TAG_VARIANT_BY_TONE = {
  grey:  'ai-neutral',
  blue:  'outreach-appointment',
  green: 'ai-med',
  amber: 'outreach-care-gap',
  red:   'ai-risk',
};

function TagCell({ tags, tagsMore }) {
  if (!tags?.length) return <span className={styles.mutedDash}>—</span>;
  return (
    <span className={styles.tagCell}>
      {tags.map(t => (
        <Badge size="M"
          key={t.label}
          variant={TAG_VARIANT_BY_TONE[t.tone] || 'ai-neutral'}
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
// anything else (No Care Plan) grey.
const CARE_PLAN_STATUS_LOOK = {
  Signed: { className: styles.carePlanSigned, icon: 'solar:check-circle-linear' },
  Draft: { className: styles.carePlanDraft, icon: 'solar:pen-2-linear' },
};
function CarePlanStatusBadge({ status }) {
  if (!status) return <span className={styles.statusText}>—</span>;
  const look = CARE_PLAN_STATUS_LOOK[status];
  return (
    <span className={`${styles.carePlanStatus} ${look?.className || styles.carePlanNone}`}>
      {look && <Icon name={look.icon} size={14} color="currentColor" />}
      <span className={styles.carePlanStatusLabel}>{status}</span>
    </span>
  );
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
            size="M"
            variant={PROGRAM_SUB_STATUS_VARIANT[m.programSubStatus] || 'snp-new'}
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
    // Signed or Draft opens the plan in the Review care plan drawer; any other
    // status (No Care Plan) is plain text.
    stopRowClickPropagation: true,
    renderCell: (m, ctx) => {
      const badge = <CarePlanStatusBadge status={m.carePlanStatus} />;
      if (!(m.patientId && m.programId && (m.carePlanStatus === 'Signed' || m.carePlanStatus === 'Draft'))) return badge;
      return (
        <button
          type="button"
          className={styles.carePlanStatusLink}
          onClick={() => ctx.openCarePlanReview?.({
            patientId: m.patientId,
            patientName: m.name,
            // Patient context for the drawer's banner.
            patient: { initials: m.initials, name: m.name, gender: m.gender, age: m.age, memberId: m.memberId },
            program: { id: m.programId, code: 'SNP', name: 'SNP Care Program' },
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
    renderCell: (m) => <span className={styles.dateText}>{m.nextActionDue || '—'}</span>,
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
    renderCell: (m) => <span className={styles.dateText}>{m.triggerDate || '—'}</span>,
  },
  {
    key: 'lastAdmission',
    label: 'Last Admission',
    sortKey: 'lastAdmissionSort',
    sortType: 'date',
    renderCell: (m) => <span className={styles.mutedDash}>{m.lastAdmission || '—'}</span>,
  },
  {
    key: 'trigger',
    label: 'Trigger',
    sortKey: 'trigger',
    renderCell: (m) => <span className={styles.triggerText}>{m.trigger || '—'}</span>,
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
        : <span className={styles.mutedDash}>—</span>
    ),
  },
];

export function SnpWorklistRow({ member, columns, hiddenSet, isSelected, onSelect }) {
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
    else showToast(`${m.name} — no linked patient record yet`);
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
            size="L"
            tooltip="View Program"
            onClick={openInCareProgram}
          />
          <span className={styles.actionDivider} />
          <ActionButton
            ref={callBtnRef}
            icon="solar:phone-linear"
            size="L"
            tooltip="Call patient"
            onClick={handleCallClick}
          />
          <span className={styles.actionDivider} />
          <div style={{ position: 'relative' }}>
            <ActionButton
              ref={dropBtnRef}
              icon="solar:menu-dots-linear"
              size="L"
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
