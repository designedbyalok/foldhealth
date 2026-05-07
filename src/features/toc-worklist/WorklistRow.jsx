import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Checkbox } from '../../components/ui/checkbox';
import { OutreachPopover } from '../../components/OutreachPopover/OutreachPopover';
import { useAppStore } from '../../store/useAppStore';
import styles from './WorklistRow.module.css';

const LANG_MAP = { en: 'English', es: 'Spanish', zh: 'Chinese', yue: 'Cantonese', ko: 'Korean', vi: 'Vietnamese', hi: 'Hindi', pa: 'Punjabi' };

function TocStatusBadge({ status }) {
  const MAP = {
    enrolled: { variant: 'toc-enrolled', label: 'Enrolled', icon: 'solar:check-circle-bold' },
    engaged: { variant: 'toc-engaged', label: 'Engaged', icon: 'solar:link-round-bold' },
    attempted: { variant: 'toc-attempted', label: 'Attempted', icon: 'solar:history-bold' },
    new: { variant: 'toc-new', label: 'New', icon: 'solar:star-bold' },
    oncall: { variant: 'toc-oncall', label: 'On Call', icon: 'solar:phone-calling-bold' },
  };
  const cfg = MAP[status] || MAP.new;
  return <Badge variant={cfg.variant} label={cfg.label} icon={cfg.icon} />;
}

function OutreachCell({ patient }) {
  const dots = patient.outreachDots || ['pending','pending','pending'];
  const hasSuccess = dots.includes('success');
  const hasFailed = dots.includes('failed') && !hasSuccess;
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
      <div className={styles.outreachWlMain}>
        {hasSuccess ? (
          <>
            <Icon name="solar:phone-calling-bold" size={15} color="#059669" />
            <div>
              <div className={styles.outreachWlText}>Attended</div>
              {patient.outreachDate && <div className={styles.outreachWlDate}>{patient.outreachDate}</div>}
            </div>
          </>
        ) : hasFailed ? (
          <>
            <Icon name="solar:phone-bold" size={15} color="#DC2626" />
            <div>
              <div className={styles.outreachWlFailed}>Failed</div>
              {patient.outreachDate && <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{patient.outreachDate}</div>}
            </div>
          </>
        ) : (
          <>
            <Icon name="solar:phone-linear" size={15} color="var(--neutral-200)" />
            <div className={styles.outreachWlNone}>—</div>
          </>
        )}
      </div>
      <div className={styles.dotsRow}>
        {dots.map((d, i) => <div key={i} className={`${styles.dot} ${styles[d]}`} />)}
      </div>
      {showPop && createPortal(
        <OutreachPopover patient={patient} pos={popPos} onMouseEnter={handlePopEnter} onMouseLeave={handlePopLeave} />,
        document.body
      )}
    </div>
  );
}

function DropdownMenu({ patientId, onClose }) {
  const openWorkflow = useAppStore(s => s.openWorkflow);
  const showToast = useAppStore(s => s.showToast);
  const requestAddTask = useAppStore(s => s.requestAddTask);
  const patients = useAppStore(s => s.patients);
  const p = patients.find(x => x.id === patientId);

  return (
    <div className={styles.dropdown} onClick={e => e.stopPropagation()}>
      <div className={styles.dropdownSection}>Communication</div>
      {['Send SMS','Send Email','Start Meeting','Chat'].map(l => (
        <button key={l} className={styles.dropdownItem} onClick={() => { showToast(`${l} – coming soon`); onClose(); }}>
          <Icon name={l === 'Send SMS' ? 'solar:chat-round-line-linear' : l === 'Send Email' ? 'solar:letter-linear' : l === 'Start Meeting' ? 'solar:videocamera-record-linear' : 'solar:chat-dots-linear'} size={18} color="var(--neutral-300)" />
          {l}
        </button>
      ))}
      <div className={styles.dropdownDivider} />
      <div className={styles.dropdownSection}>Care Actions</div>
      {['Send Assessment','Initiate Protocol','Send Education','Warm Referral','Add to Program','Upload File'].map(l => (
        <button key={l} className={styles.dropdownItem} onClick={() => { showToast(`${l} – coming soon`); onClose(); }}>
          <Icon name="solar:clipboard-check-linear" size={18} color="var(--neutral-300)" />
          {l}
        </button>
      ))}
      <button className={styles.dropdownItem} onClick={() => { requestAddTask({ member: p?.name }); onClose(); }}>
        <Icon name="solar:checklist-minimalistic-linear" size={18} color="var(--neutral-300)" />
        Add Task
      </button>
      <div className={styles.dropdownDivider} />
      <div className={styles.dropdownSection}>Automation</div>
      <button className={styles.dropdownItem} onClick={() => { showToast('Run Automation – coming soon'); onClose(); }}>
        <Icon name="solar:bolt-outline" size={18} color="var(--neutral-300)" />
        Run Automation
      </button>
      <div className={styles.dropdownDivider} />
      <div className={styles.dropdownSection}>Admin Actions</div>
      <button className={styles.dropdownItem} onClick={() => { openWorkflow(patientId); onClose(); }}>
        <Icon name="solar:clipboard-list-linear" size={18} color="var(--neutral-300)" />
        Open Workflow
      </button>
      {(p?.status === 'scheduled' || p?.status === 'queued') && (
        <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={() => { showToast(`Cancelled call`); onClose(); }}>
          <Icon name="solar:close-circle-linear" size={18} color="#DC2626" />
          {p?.status === 'queued' ? 'Cancel Queued Call' : 'Cancel Scheduled Call'}
        </button>
      )}
    </div>
  );
}

export function WorklistRow({ patient, isSelected, onSelect }) {
  const openWorkflow = useAppStore(s => s.openWorkflow);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const openDetail = useAppStore(s => s.openDetail);
  const openLiveDrawer = useAppStore(s => s.openLiveDrawer);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const dropBtnRef = useRef(null);
  const callBtnRef = useRef(null);

  useEffect(() => {
    if (!showDropdown) return;
    const clickHandler = () => setShowDropdown(false);
    const closeHandler = (e) => { if (e.detail !== patient.id) setShowDropdown(false); };
    // Use requestAnimationFrame to avoid the opening click from immediately closing
    const raf = requestAnimationFrame(() => {
      document.addEventListener('click', clickHandler);
      document.addEventListener('close-all-dropdowns', closeHandler);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('click', clickHandler);
      document.removeEventListener('close-all-dropdowns', closeHandler);
    };
  }, [showDropdown, patient.id]);

  const handleRowClick = () => {
    if (patient.status === 'completed') {
      openDetail(patient.id);
      return;
    }
    if (patient.status === 'oncall') {
      openLiveDrawer(patient.id);
      return;
    }
    openWorkflow(patient.id);
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
    document.dispatchEvent(new CustomEvent('close-all-dropdowns', { detail: patient.id }));
    const btn = dropBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const dropdownHeight = 420;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const top = spaceBelow < dropdownHeight
        ? Math.max(8, rect.top - Math.min(dropdownHeight, rect.top - 8))
        : rect.bottom + 4;
      setDropdownPos({
        top,
        right: window.innerWidth - rect.right,
      });
    }
    setShowDropdown(v => !v);
  };

  const p = patient;
  const outreachBadgeVariant = p.outreachType === '48h' ? 'outreach-48h' : 'outreach-7d';

  return (
    <>
      <tr className={styles.row} onClick={handleRowClick}>
        <td className={`${styles.checkTd} ${styles.stickyLeft}`} style={{ left: 0 }} onClick={e => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect(p.id)}
          />
        </td>
        <td className={`${styles.membersTd} ${styles.stickyLeft}`} style={{ left: 36 }}>
          <div className={styles.patientCell}>
            <Avatar variant="patient" initials={p.initials} />
            <div>
              <div className={styles.patientName}><button className={styles.patientNameLink} onClick={e => { e.stopPropagation(); useAppStore.getState().openQuickView({ id: p.id, name: p.name, initials: p.initials, gender: p.gender, age: p.age, memberId: p.memberId, language: p.language, lace: p.lace }); }}>{p.name}</button> <span className={styles.patientDemo}>({p.gender}•{p.age})</span></div>
              <div className={styles.patientMeta}>
                {p.memberId} •{' '}
                <span className={styles.langBadge}>
                  {(p.language || 'en').toUpperCase()}
                  <span className={styles.langTooltip}>Preferred Language: {LANG_MAP[p.language] || 'English'}</span>
                </span>
              </div>
            </div>
          </div>
        </td>
        <td className={styles.td}>
          <Badge variant={`lace-${p.lace.toLowerCase()}`} label={p.lace} />
        </td>
        <td className={styles.td}>
          <div className={styles.outreachCell}>
            <Badge variant={outreachBadgeVariant} label={`TOC ${p.outreachType}`} />
            {p.onCall ? (
              <span className={styles.outreachOncall}>
                <Icon name="solar:phone-calling-bold" size={14} />
                On Call: {p.callDuration}
              </span>
            ) : (
              <span className={styles.outreachTime}>
                <Icon name="solar:clock-circle-linear" size={14} />
                {p.outreachLeft}
              </span>
            )}
          </div>
        </td>
        <td className={styles.td}><TocStatusBadge status={p.tocStatus} /></td>
        <td className={styles.td}><OutreachCell patient={p} /></td>
        <td className={styles.td}><span className={styles.dateText}>{p.nextOutreach || '—'}</span></td>
        <td className={styles.td}><span className={styles.dateText}>{p.startDate || '—'}</span></td>
        <td className={styles.td}><span className={styles.dateText}>{p.lastAdmission || '—'}</span></td>
        <td className={styles.td}>
          <div className={styles.assigneeCell}>
            <Avatar variant="assignee" initials={p.assigneeInitials} />
            <span style={{ fontSize: 13 }}>{p.assignee}</span>
          </div>
        </td>
        <td className={styles.td}>
          {p.agentAssigned ? (
            <div className={styles.agentCell}>
              <Avatar variant="agent" agentName={p.agentAssigned} />
              <div>
                <div className={styles.agentName}>{p.agentAssigned}</div>
                <div className={styles.agentRole}>{p.agentRole}</div>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--neutral-200)' }}>—</span>
          )}
        </td>
        <td className={`${styles.td} ${styles.stickyRight}`} onClick={e => e.stopPropagation()}>
          <div className={styles.actionsCell}>
            <ActionButton
              icon="solar:document-text-linear"
              size="L"
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
                icon="solar:phone-outline"
                size="L"
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
                size="L"
                tooltip="More options"
                onClick={handleDropdownToggle}
              />
              {showDropdown && createPortal(
                <div style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}>
                  <DropdownMenu patientId={p.id} onClose={() => setShowDropdown(false)} />
                </div>,
                document.body
              )}
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}
