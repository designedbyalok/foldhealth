import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { PatientAvatarHover } from '../../components/PatientHoverCard/PatientAvatarHover';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../components/Badge/Badge';
import { laceTone } from '../../lib/riskTone';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { buildPatientRowMenuItems } from '../../components/MenuPopover/patientRowMenuItems';
import { useAppStore } from '../../store/useAppStore';
import { worklistMemberCallId } from '../../lib/patientCall';
import { FoldIdTag } from '../../components/FoldIdTag/FoldIdTag';
import { CcmBillingReviewDrawer } from './CcmBillingReviewDrawer';
import styles from './CcmWorklistRow.module.css';

const LANG_MAP = { en: 'English', es: 'Spanish', zh: 'Chinese', yue: 'Cantonese', ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', pa: 'Punjabi', ch: 'Chinese' };

const STATUS_VARIANT = {
  'New':             { variant: 'neutral',       label: 'New',             icon: 'solar:star-bold' },
  'Engaged':         { variant: 'info',   label: 'Engaged',         icon: 'solar:link-round-bold' },
  'Enrolled':        { variant: 'success',  label: 'Enrolled',        icon: 'solar:check-circle-bold' },
  'Unable to Reach': { variant: 'warning', label: 'Unable to Reach', icon: 'solar:history-bold' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_VARIANT[status] || STATUS_VARIANT['New'];
  return <Badge size="md" tone={cfg.variant} label={cfg.label} icon={cfg.icon} />;
}

const formatMins = (seconds) => {
  if (!seconds && seconds !== 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} Mins`;
};

/**
 * Middle-column defs for CCM. Each carries `renderCell(member, ctx)` so
 * the Show Columns popover can hide + reorder columns and the row body
 * follows along. Sticky checkbox / Members / Actions columns stay
 * hardcoded around this band.
 *
 * ctx shape: { openBilling }
 */
export const CCM_MIDDLE_COLUMNS = [
  {
    key: 'status',
    label: 'Status',
    renderCell: (m) => <StatusBadge status={m.status} />,
  },
  {
    key: 'nextActionDue',
    label: 'Next Action Due',
    renderCell: (m) => (
      <span className={`${styles.dateText} ${m.nextActionOverdue ? styles.overdue : ''}`}>
        {m.nextActionDue || '-'}
      </span>
    ),
  },
  {
    key: 'outreach',
    label: 'Outreach',
    renderCell: (m) => (
      m.outreachStatus ? (
        <div className={styles.outreachCell}>
          <Icon name="solar:phone-calling-bold" size={15} color="var(--status-success)" />
          <div>
            <div className={styles.outreachStatus}>{m.outreachStatus}</div>
            {m.outreachDate && <div className={styles.outreachDate}>{m.outreachDate}</div>}
          </div>
        </div>
      ) : (
        <div className={styles.outreachCell}>
          <Icon name="solar:phone-linear" size={15} color="var(--neutral-200)" />
          <span className={styles.outreachNone}>-</span>
        </div>
      )
    ),
  },
  {
    key: 'assignee',
    label: 'Assignee',
    renderCell: (m, ctx) => (
      m.assigneeName ? (
        <AssigneeChange
          name={m.assigneeName}
          initials={m.assigneeInitials || m.assigneeName.slice(0, 2).toUpperCase()}
          showRole={false}
          onClick={() => ctx.showToast?.(`Change assignee for ${m.name}, coming soon`)}
        />
      ) : (
        <AssigneeChange
          unassigned
          unassignedLabel="Assign User"
          showRole={false}
          onClick={() => ctx.showToast?.(`Assign owner for ${m.name}, coming soon`)}
        />
      )
    ),
  },
  {
    key: 'startDate',
    label: 'Start Date',
    renderCell: (m) => <span className={styles.dateText}>{m.startDate || '-'}</span>,
  },
  {
    key: 'lastAdmission',
    label: 'Last Admission',
    renderCell: (m) => <span className={styles.dateText}>{m.lastAdmission || '-'}</span>,
  },
  {
    key: 'billableMins',
    label: 'Billable Mins',
    stopRowClickPropagation: true,
    renderCell: (m, ctx) => (
      <button type="button" className={styles.billableMins} onClick={ctx.openBilling}>
        {formatMins(m.billableSeconds)}
      </button>
    ),
  },
  {
    key: 'unloggedMins',
    label: 'Unlogged Mins',
    renderCell: (m) => <span className={styles.unloggedMins}>{formatMins(m.unloggedSeconds)}</span>,
  },
  {
    key: 'riskLevel',
    label: 'Risk Level',
    renderCell: (m) => (
      m.riskLevel
        ? <Badge size="md" tone={laceTone(m.riskLevel)} label={m.riskLevel} />
        : <span className={styles.mutedDash}>-</span>
    ),
  },
  {
    key: 'taskCount',
    label: 'Task',
    renderCell: (m) => (
      m.taskCount
        ? <span className={styles.taskBadge}>{m.taskCount} Task</span>
        : <span className={styles.mutedDash}>-</span>
    ),
  },
  {
    key: 'carePlanStatus',
    label: 'Care Plan Status',
    renderCell: (m) => <span className={styles.carePlanText}>{m.carePlanStatus || '-'}</span>,
  },
];

export function CcmWorklistRow({ member, columns, hiddenSet, isSelected, onSelect }) {
  const openQuickView = useAppStore(s => s.openQuickView);
  const navigateToPatient = useAppStore(s => s.navigateToPatient);
  const showToast = useAppStore(s => s.showToast);
  const requestAddTask = useAppStore(s => s.requestAddTask);
  const openPatientEdit = useAppStore(s => s.openPatientEdit);
  const [billingOpen, setBillingOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const callBtnRef = useRef(null);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const middleCols = (columns || CCM_MIDDLE_COLUMNS)
    .filter(c => !c.sticky && !c.showCheckbox && c.renderCell);
  const visibleMiddle = hiddenSet ? middleCols.filter(c => !hiddenSet.has(c.key)) : middleCols;

  const toggleMenu = (e) => {
    e.stopPropagation();
    setMenuOpen(v => !v);
  };

  const m = member;

  const menuItems = buildPatientRowMenuItems([
    { key: 'Open Care Program', icon: 'solar:folder-open-linear', label: 'Open Care Program' },
  ]);

  const runPatientRowAction = useAppStore(s => s.runPatientRowAction);
  const handleMenuSelect = (key) => {
    if (runPatientRowAction(key, m)) return;
    if (key === 'Add Task') { requestAddTask?.({ member: m.name }); return; }
    if (key === 'Open Care Program') {
      if (m.patientId) navigateToPatient(m.patientId, { profileTab: 'Care Programs', programCode: 'CCM' });
      return;
    }
    if (key === 'Edit Details') {
      openPatientEdit('basic', {
        id: m.patientId || m.id,
        name: m.name,
        initials: m.initials,
        gender: m.gender,
        age: m.age,
        memberId: m.memberId,
        language: m.language,
      });
      return;
    }
    showToast(`${key} – coming soon`);
  };

  const openBilling = (e) => {
    e.stopPropagation();
    setBillingOpen(true);
  };

  const openInCarePlan = (e) => {
    e.stopPropagation();
    if (!m.patientId) {
      showToast(`${m.name}, no linked patient record yet`);
      return;
    }
    navigateToPatient(m.patientId, {
      profileTab: 'Care Programs',
      programCode: 'CCM',
    });
  };

  const handleRowClick = () => {
    if (m.patientId) navigateToPatient(m.patientId);
    else showToast(`${m.name}, no linked patient record yet`);
  };

  const handleNameClick = (e) => {
    e.stopPropagation();
    openQuickView?.({
      id: m.patientId || m.id,
      name: m.name,
      initials: m.initials,
      gender: m.gender,
      age: m.age,
      memberId: m.memberId,
      language: m.language,
    });
  };
  const cellCtx = { openBilling, showToast };

  return (
    <>
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
          <ActionButton icon="solar:document-text-linear" tooltip="Open CCM care program" onClick={openInCarePlan} />
          <span className={styles.actionDivider} />
          <ActionButton
            ref={callBtnRef}
            icon="solar:phone-linear"
            tooltip="Call patient"
            onClick={(e) => {
              e.stopPropagation();
              openCallPopover(worklistMemberCallId(m), callBtnRef);
            }}
          />
          <span className={styles.actionDivider} />
          <ActionButton
            ref={menuBtnRef}
            icon="solar:menu-dots-linear"
            tooltip="More options"
            onClick={toggleMenu}
          />
        </div>
      </td>
    </tr>
    {menuOpen && (
      <MenuPopover
        anchorRef={menuBtnRef}
        items={menuItems}
        onSelect={handleMenuSelect}
        onClose={() => setMenuOpen(false)}
        width={220}
        ariaLabel="Row actions"
      />
    )}
    {billingOpen && (
      <CcmBillingReviewDrawer member={m} onClose={() => setBillingOpen(false)} />
    )}
    </>
  );
}
