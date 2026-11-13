import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { PatientAvatarHover } from '../../../components/PatientHoverCard/PatientAvatarHover';
import { AssigneeChange } from '../../../components/AssigneeChange/AssigneeChange';
import { Badge } from '../../../components/Badge/Badge';
import { laceTone } from '../../../lib/riskTone';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { formatDobDisplay, deriveDob } from '../../../lib/patientDob';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { OutreachPopover } from '../../../components/OutreachPopover/OutreachPopover';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { buildPatientRowMenuItems } from '../../../components/MenuPopover/patientRowMenuItems';
import { useAppStore } from '../../../store/useAppStore';
import { LiveCallDuration } from './LiveCallDuration';
import { FoldIdTag } from '../../../components/FoldIdTag/FoldIdTag';
import { platformUsersForAssigneePicker } from '../../../lib/worklistAssignee';
import styles from './WorklistRow.module.css';
import { OutreachStatus } from '../../../components/OutreachStatus/OutreachStatus';
import { outreachFromDots } from '../../../components/OutreachStatus/outreachStatusModel';

const LANG_MAP = { en: 'English', es: 'Spanish', zh: 'Chinese', yue: 'Cantonese', ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', pa: 'Punjabi' };

const TOC_STATUS_MAP = {
  enrolled: { variant: 'success', label: 'Enrolled', icon: 'solar:check-circle-bold' },
  engaged: { variant: 'info', label: 'Engaged', icon: 'solar:link-round-bold' },
  attempted: { variant: 'warning', label: 'Attempted', icon: 'solar:history-bold' },
  new: { variant: 'neutral', label: 'New', icon: 'solar:star-bold' },
  oncall: { variant: 'primary', label: 'On Call', icon: 'solar:phone-calling-bold' },
};

function TocStatusBadge({ status }) {
  const cfg = TOC_STATUS_MAP[status] || TOC_STATUS_MAP.new;
  return <Badge size="md" tone={cfg.variant} label={cfg.label} icon={cfg.icon} />;
}

function OutreachCell({ patient }) {
  const [showPop, setShowPop] = useState(false);
  const [popPos, setPopPos] = useState({ top: 0, left: 0 });
  const cellRef = useRef(null);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);

  const handleMouseEnter = useCallback(() => {
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => {
      if (!cellRef.current) return;
      const rect = cellRef.current.getBoundingClientRect();
      const popH = 280;
      let top = rect.bottom + 4;
      let left = rect.left;
      if (top + popH > window.innerHeight) top = rect.top - popH - 4;
      if (left + 380 > window.innerWidth) left = window.innerWidth - 388;
      setPopPos({ top, left });
      setShowPop(true);
    }, 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setShowPop(false), 300);
  }, []);

  const handlePopEnter = useCallback(() => {
    clearTimeout(hideTimer.current);
  }, []);

  const handlePopLeave = useCallback(() => {
    setShowPop(false);
  }, []);

  return (
    <div className={styles.outreachWl} ref={cellRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <OutreachStatus {...outreachFromDots(patient.outreachDots, { date: patient.outreachDate, attended: patient.outreachAttended })} />
      {showPop && createPortal(
        <OutreachPopover patient={patient} pos={popPos} onMouseEnter={handlePopEnter} onMouseLeave={handlePopLeave} />,
        document.body
      )}
    </div>
  );
}

function AssigneeCell({ patient, platformUsers, updatePatient }) {
  const users = platformUsersForAssigneePicker(platformUsers);
  const onSelect = (u) => updatePatient(patient.id, {
    assignee: u.name,
    assigneeInitials: u.initials,
    assigneeRole: u.role,
  });
  if (patient.assignee) {
    return (
      <AssigneeChange
        name={patient.assignee}
        initials={patient.assigneeInitials}
        showRole={false}
        users={users}
        onSelect={onSelect}
        pickerTitle="Change assignee"
      />
    );
  }
  return (
    <AssigneeChange
      unassigned
      showRole={false}
      users={users}
      onSelect={onSelect}
      pickerTitle="Assign user"
    />
  );
}

function AgentAssignedCell({ patient }) {
  if (!patient.agentAssigned) {
    return <span style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-200)' }}>-</span>;
  }
  return (
    <div className={styles.agentCell}>
      <Avatar variant="agent" agentName={patient.agentAssigned} />
      <div>
        <div className={styles.agentName}>{patient.agentAssigned}</div>
        <div className={styles.agentRole}>{patient.agentRole}</div>
      </div>
    </div>
  );
}

/**
 * Middle-column defs for the TCM Worklist. Each carries `renderCell(patient,
 * ctx)` so the ColumnsHeaderButton popover can hide + reorder columns and
 * the row body follows along. Sticky checkbox / Members / Actions columns
 * stay hardcoded around this band.
 *
 * ctx shape:
 *   { platformUsers, updatePatient }
 */
export const WORKLIST_MIDDLE_COLUMNS = [
  {
    key: 'lace',
    label: 'LACE Acuity',
    renderCell: (p) => (
      p.lace
        ? <Badge size="md" tone={laceTone(p.lace)} label={p.lace} />
        : <span>-</span>
    ),
  },
  {
    key: 'outreachWindow',
    label: 'Outreach Window',
    renderCell: (p) => {
      const outreachBadgeVariant = p.outreachType === '48h' ? 'danger' : 'info';
      return (
        <div className={styles.outreachCell}>
          <Badge size="md" tone={outreachBadgeVariant} label={`TCM ${p.outreachType}`} />
          {p.onCall ? (
            <span className={styles.outreachOncall}>
              <Icon name="solar:phone-calling-bold" size={14} />
              On Call: <LiveCallDuration patient={p} />
            </span>
          ) : (
            <span className={styles.outreachTime}>
              <Icon name="solar:clock-circle-linear" size={14} />
              {p.outreachLeft}
            </span>
          )}
        </div>
      );
    },
  },
  {
    key: 'tocStatus',
    label: 'TCM Status',
    renderCell: (p) => <TocStatusBadge status={p.tocStatus} />,
  },
  {
    key: 'outreach',
    label: 'Outreach',
    renderCell: (p) => <OutreachCell patient={p} />,
  },
  {
    key: 'nextOutreach',
    label: 'Next Outreach',
    renderCell: (p) => <span className={styles.dateText}>{p.nextOutreach || '-'}</span>,
  },
  {
    key: 'startDate',
    label: 'Start Date',
    renderCell: (p) => <span className={styles.dateText}>{p.startDate || '-'}</span>,
  },
  {
    key: 'lastAdmission',
    label: 'Last Admission',
    renderCell: (p) => <span className={styles.dateText}>{p.lastAdmission || '-'}</span>,
  },
  {
    key: 'assignee',
    label: 'Assignee',
    stopRowClickPropagation: true,
    renderCell: (p, ctx) => (
      <AssigneeCell patient={p} platformUsers={ctx.platformUsers} updatePatient={ctx.updatePatient} />
    ),
  },
  {
    key: 'agentAssigned',
    label: 'Agent Assigned',
    renderCell: (p) => <AgentAssignedCell patient={p} />,
  },
];

export function WorklistRow({ patient, columns, hiddenSet, isSelected, onSelect }) {
  const openQuickView = useAppStore(s => s.openQuickView);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const openDetail = useAppStore(s => s.openDetail);
  const openLiveDrawer = useAppStore(s => s.openLiveDrawer);
  const showToast = useAppStore(s => s.showToast);
  const platformUsers = useAppStore(s => s.platformUsers);
  const updatePatient = useAppStore(s => s.updatePatient);
  const openPatientEdit = useAppStore(s => s.openPatientEdit);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropBtnRef = useRef(null);
  const callBtnRef = useRef(null);

  const middleCols = (columns || WORKLIST_MIDDLE_COLUMNS)
    .filter(c => !c.sticky && !c.showCheckbox && c.renderCell);
  const visibleMiddle = hiddenSet ? middleCols.filter(c => !hiddenSet.has(c.key)) : middleCols;

  const cellCtx = { platformUsers, updatePatient };

  const handleRowClick = () => {
    if (patient.status === 'completed') {
      openDetail(patient.id);
      return;
    }
    if (patient.status === 'oncall') {
      openLiveDrawer(patient.id);
      return;
    }
    openQuickView({ id: patient.id, name: patient.name, initials: patient.initials, gender: patient.gender, age: patient.age, memberId: patient.memberId, language: patient.language, lace: patient.lace });
  };

  const handleCallClick = (e) => {
    e.stopPropagation();
    if (patient.status === 'oncall') {
      openLiveDrawer(patient.id);
      return;
    }
    openCallPopover(patient.id, callBtnRef);
  };

  const handleDropdownToggle = (e) => {
    e.stopPropagation();
    setShowDropdown(v => !v);
  };

  const p = patient;
  const quickViewPayload = { id: p.id, name: p.name, initials: p.initials, gender: p.gender, age: p.age, memberId: p.memberId, language: p.language, lace: p.lace };
  const handleMemberCellClick = (e) => {
    e.stopPropagation();
    openQuickView(quickViewPayload);
  };

  const menuItems = buildPatientRowMenuItems([
    ...(p.status === 'scheduled' || p.status === 'queued'
      ? [{
          key: 'Cancel Call',
          icon: 'solar:close-circle-linear',
          label: p.status === 'queued' ? 'Cancel Queued Call' : 'Cancel Scheduled Call',
          danger: true,
        }]
      : []),
  ]);

  const runPatientRowAction = useAppStore(s => s.runPatientRowAction);
  const handleMenuSelect = (key) => {
    if (runPatientRowAction(key, p)) return;
    if (key === 'Cancel Call') { showToast('Cancelled call'); return; }
    if (key === 'Edit Details') { openPatientEdit('basic', p); return; }
    showToast(`${key} – coming soon`);
  };

  return (
    <>
      <tr className={styles.row} onClick={handleRowClick}>
        <td className={`${styles.checkTd} ${styles.stickyLeft}`} style={{ left: 0 }} onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect(p.id)}
          />
        </td>
        <td
          className={`${styles.membersTd} ${styles.stickyLeft}`}
          style={{ left: 36, cursor: 'pointer' }}
          title="Open patient quick view"
        >
          <div className={styles.patientCell}>
            <PatientAvatarHover patient={{ memberId: p.memberId, id: p.id, name: p.name, initials: p.initials, gender: p.gender, age: p.age, dob: p.dob }} />
            <div>
              <div className={styles.patientName}>
                <button className={styles.patientNameLink} onClick={handleMemberCellClick}>{p.name}</button> {(() => { const dobLabel = formatDobDisplay(p.dob) || deriveDob(p.age, p.name); return (<Tooltip label={dobLabel ? `DOB: ${dobLabel}` : ''} placement="bottom"><span className={styles.patientDemo}>({p.gender}•{p.age})</span></Tooltip>); })()}
              </div>
              <div className={styles.patientMeta}>
                <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
                  <FoldIdTag id={p.memberId} className={styles.foldId} showToast={showToast} />
                </span>{' '}•{' '}
                <Tooltip label={`Preferred Language: ${LANG_MAP[p.language] || 'English'}`} variant="light">
                  <button type="button" className={styles.langBadge} onClick={e => e.stopPropagation()}>
                    {(p.language || 'en').toUpperCase()}
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
            {col.renderCell(p, cellCtx)}
          </td>
        ))}

        <td className={`${styles.td} ${styles.stickyRight}`} onClick={e => e.stopPropagation()}>
          <div className={styles.actionsCell}>
            <ActionButton
              icon="solar:document-text-linear"
              tooltip="View details"
              onClick={() => {
                if (p.status === 'oncall') openLiveDrawer(p.id);
                else openDetail(p.id);
              }}
            />
            <span className={styles.actionDivider} />
            <span style={{ position: 'relative' }}>
              <ActionButton
                ref={callBtnRef}
                icon="solar:phone-linear"
                tooltip={p.status === 'oncall' ? 'View live call' : 'Call patient'}
                iconColor={p.status === 'oncall' ? '#059669' : undefined}
                className={p.status === 'oncall' ? styles.oncall : p.status === 'queued' ? styles.queuedCall : ''}
                onClick={handleCallClick}
              />
              {p.status === 'oncall' && <span className={styles.callLiveDot} />}
            </span>
            <span className={styles.actionDivider} />
            <div style={{ position: 'relative' }}>
              <ActionButton
                ref={dropBtnRef}
                icon="solar:menu-dots-linear"
                tooltip="More options"
                onClick={handleDropdownToggle}
              />
              {showDropdown && (
                <MenuPopover
                  anchorRef={dropBtnRef}
                  items={menuItems}
                  onSelect={handleMenuSelect}
                  onClose={() => setShowDropdown(false)}
                  width={220}
                  ariaLabel="Row actions"
                />
              )}
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
