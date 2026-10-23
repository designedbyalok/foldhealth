import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Icon } from '../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../components/Icon/DownChevronIcon';
import { PatientAppActiveIndicator } from '../../../../components/PatientAppActiveIndicator/PatientAppActiveIndicator';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { PatientConsentPopover } from '../../shared/PatientConsentPopover/PatientConsentPopover';
import { usePatientConsent } from '../../hooks/usePatientConsent';
import { consentPopoverPos, consentSummaryLabel } from './consentBadge';
import { ScheduleDrawer } from '../../../../components/ScheduleDrawer/ScheduleDrawer';
import { MenuPopover } from '../../../../components/MenuPopover/MenuPopover';
import { useAppStore } from '../../../../store/useAppStore';
import { formatFoldId } from '../../../../lib/foldId';
import { FALLBACK_P360 } from '../../data/p360Mock';
import { usePatientDisplay } from '../../hooks/usePatientDisplay';
import { QuickViewExpanded } from './PatientP360BannerExpanded';
import { DRAWER_ACTIONS, MORE_MENU_LABELS } from './PatientP360Banner.utils';
import styles from './PatientP360Banner.module.css';

// Every quick action, SMS last. The row shows as many as fit; the rest move
// to the top of the More menu (see useFitCount).
const QUICK_ACTIONS = [...DRAWER_ACTIONS, { icon: 'solar:chat-line-linear', label: 'SMS', sms: true }];
// One action cell ("Schedule" is the widest label) plus its divider.
const ACTION_SLOT_PX = 64;

// How many actions fit the row's current width. The ResizeObserver fires on
// observe, so the first count lands before paint without a synchronous
// setState in the effect body.
function useFitCount(ref, total) {
  const [fit, setFit] = useState(total);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      setFit(Math.max(1, Math.min(total, Math.floor(el.clientWidth / ACTION_SLOT_PX))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, total]);
  return fit;
}

export function PatientP360BannerDrawer({ patient, p, programCodes }) {
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [consentPos, setConsentPos] = useState(null);
  const consentBadgeRef = useRef(null);
  const [drawerDropdownStyle, setDrawerDropdownStyle] = useState(null);
  const profileCardRef = useRef(null);
  const [showScheduleDrawer, setShowScheduleDrawer] = useState(false);
  const callBtnRef = useRef(null);
  const moreBtnRef = useRef(null);
  const actionsListRef = useRef(null);
  const fitCount = useFitCount(actionsListRef, QUICK_ACTIONS.length);
  const visibleActions = QUICK_ACTIONS.slice(0, fitCount);
  const overflowActions = QUICK_ACTIONS.slice(fitCount);
  const [moreMenuRect, setMoreMenuRect] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('central');

  const showToast = useAppStore(s => s.showToast);
  const updatePatient = useAppStore(s => s.updatePatient);
  const updateP360Profile = useAppStore(s => s.updateP360Profile);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const openPatientEdit = useAppStore(s => s.openPatientEdit);
  const showPatientAppIndicator = useAppStore(s => s.showPatientAppIndicator);
  const display = usePatientDisplay(patient);
  const { summary: consent } = usePatientConsent(patient.id);

  const noop = (label) => () => showToast(`${label} — coming soon`);
  // Shared by the row buttons and their overflow menu entries. An overflowed
  // Call anchors its popover to the More button, since its own button is gone.
  const runAction = (label) => {
    if (label === 'Schedule') { setShowScheduleDrawer(true); return; }
    if (label === 'Call') {
      const inRow = visibleActions.some(a => a.label === 'Call');
      openCallPopover(patient.id, inRow ? callBtnRef : moreBtnRef);
      return;
    }
    noop(label)();
  };
  const activeProfileName = (p.insurance_profiles || FALLBACK_P360.insurance_profiles).find(pr => pr.id === selectedProfileId)?.name || p.profile_type;

  const handleConsentClick = () => {
    if (consentPos) { setConsentPos(null); return; }
    setConsentPos(consentPopoverPos(consentBadgeRef.current));
  };
  const closeConsent = useCallback(() => setConsentPos(null), []);

  // The dropdown's scrim is aria-hidden, so Escape is the keyboard dismiss path.
  // Before this there was none at all.
  useEffect(() => {
    if (!showProfileDropdown) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { setShowProfileDropdown(false); setDrawerDropdownStyle(null); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showProfileDropdown]);

  const handleProfileClick = () => {
    if (showProfileDropdown) { setShowProfileDropdown(false); setDrawerDropdownStyle(null); return; }
    const rect = profileCardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const popH = 480;
    const top = rect.bottom + 4 + popH > window.innerHeight ? Math.max(8, rect.top - popH - 4) : rect.bottom + 4;
    setDrawerDropdownStyle({ position: 'fixed', top, left: Math.min(rect.left, window.innerWidth - 348), zIndex: 9999 });
    setShowProfileDropdown(true);
  };

  return (
    <>
      {/* Size container for the banner's container queries: it lives in the
          700px Quick View drawer and the resizable split patient card. */}
      <div className={styles.drawerRoot}>
      <div className={styles.drawerPatientBanner}>
        <div className={styles.drawerBannerLeft}>
          <div className={styles.drawerAvatar}>{patient.initials}</div>
          <div className={styles.drawerPatientInfo}>
            <div className={styles.drawerNameRow}>
              <span className={styles.drawerPatientName}>{display.displayName}</span>
              {showPatientAppIndicator && patient.patientAppActive && (
                <PatientAppActiveIndicator size={16} />
              )}
            </div>
            <div className={styles.drawerMetaRow}>
              <span className={styles.drawerMetaText}>{display.gender} • {display.dob || '—'} ({display.age})</span>
              <span className={styles.drawerMetaDot}>•</span>
              <button ref={consentBadgeRef} className={styles.drawerConsentBadge} onClick={handleConsentClick}>
                Consent: {consentSummaryLabel(consent)}
                <DownChevronIcon size={12} color="var(--status-warning)" />
              </button>
            </div>
          </div>
        </div>
        <span className={styles.drawerBannerDivider} />
        <div ref={profileCardRef} className={styles.drawerProfileCard}>
          <div className={styles.drawerProfileRow}>
            <Icon name="solar:hospital-linear" size={14} color="var(--neutral-300)" />
            <button type="button" aria-expanded={showProfileDropdown} className={styles.drawerProfileSelector} onClick={handleProfileClick}>
              {activeProfileName}
              <DownChevronIcon size={14} />
            </button>
          </div>
          <div className={styles.drawerProfileIdRow}>
            <span className={styles.drawerProfileOrg}>{selectedProfileId === 'central' ? p.health_plan_name : activeProfileName}</span>
            {/* health_plan_id already carries its '#' — don't prepend another
                (the old template rendered "##94949494WIWI"). */}
            <span className={styles.drawerProfileIdText}>({p.health_plan_id || formatFoldId(patient.memberId)})</span>
            <span className={styles.drawerPlusBadge}>+{(p.insurance_profiles || FALLBACK_P360.insurance_profiles).length - 1}</span>
          </div>
        </div>
      </div>

      <div className={styles.drawerTagsRow}>
        <span className={styles.drawerTagBadge}>New Patient <DownChevronIcon size={12} /></span>
        <span className={styles.drawerTagDivider} />
        <span className={styles.drawerCondBadge}>Diabetes</span>
        <span className={styles.drawerCondBadge}>Hypertension</span>
        <span className={styles.drawerMoreBadge}>+2</span>
        <button className={styles.drawerAddTagBtn} aria-label="Add tag"><Icon name="solar:add-circle-linear" size={12} color="var(--neutral-300)" /></button>
        <button className={styles.drawerExpandIcon} onClick={() => setDrawerExpanded(v => !v)} aria-expanded={drawerExpanded} aria-label={drawerExpanded ? 'Collapse panel' : 'Expand panel'}>
          <span className={`${styles.drawerExpandIconInner} ${drawerExpanded ? styles.drawerExpandIconRotated : ''}`}>
            <Icon name="custom:expand-drawer" size={16} />
          </span>
        </button>
      </div>

      {drawerExpanded && <QuickViewExpanded p={p} programCodes={programCodes} />}

      <div className={styles.drawerActionsRow}>
        <div ref={actionsListRef} className={styles.drawerActionsList}>
          {visibleActions.flatMap(({ icon, label, sms }, i) => {
            const cell = (
              <div key={label} className={styles.drawerActionCell}>
                <button type="button" ref={label === 'Call' ? callBtnRef : undefined} className={styles.drawerActionBtn} onClick={() => runAction(label)}>
                  {sms ? (
                    <div className={styles.drawerSmsWrap}>
                      <Icon name={icon} size={16} color="var(--neutral-300)" />
                      <span className={styles.drawerSmsBadge}><Icon name="solar:verified-check-bold" size={10} color="var(--status-success)" /></span>
                    </div>
                  ) : (
                    <Icon name={icon} size={16} color="var(--neutral-300)" />
                  )}
                  <span className={styles.drawerActionLabel}>{label}</span>
                </button>
              </div>
            );
            return i === 0 ? [cell] : [<span key={`d${i}`} className={styles.drawerActionDivider} />, cell];
          })}
        </div>
        <span className={styles.drawerActionDivider} />
        <ActionButton ref={moreBtnRef} icon="solar:menu-dots-linear" size="L" tooltip="More" onClick={(e) => setMoreMenuRect(e.currentTarget.getBoundingClientRect())} />
      </div>
      </div>

      {moreMenuRect && (
        <MenuPopover anchorRect={moreMenuRect} width={220} align="right"
          items={[
            ...overflowActions.map(a => ({ key: `action:${a.label}`, icon: a.icon, label: a.label })),
            ...(overflowActions.length ? [{ divider: true }] : []),
            { key: 'assessment', icon: 'solar:clipboard-check-linear', label: 'Assessment' },
            { key: 'education', icon: 'solar:book-linear', label: 'Education' },
            { key: 'add-task', icon: 'solar:checklist-linear', label: 'Add Task' },
            { key: 'referral', icon: 'solar:arrow-right-up-linear', label: 'Create Referral' },
            { key: 'automation', icon: 'solar:bolt-linear', label: 'Run Automation' },
            { key: 'relatives', icon: 'solar:users-group-two-rounded-linear', label: 'Add Relatives' },
            { key: 'print', icon: 'solar:printer-linear', label: 'Print Clinical Profile' },
            { key: 'edit', icon: 'solar:pen-linear', label: 'Edit Details' },
            { key: 'reset-pw', icon: 'solar:refresh-linear', label: 'Reset Password' },
            { key: 'inactive', icon: 'solar:user-cross-linear', label: patient.status === 'inactive' ? 'Set Active' : 'Set Inactive' },
            { divider: true },
            { key: 'block', icon: 'solar:forbidden-circle-linear', label: 'Block Number', danger: true },
          ]}
          onClose={() => setMoreMenuRect(null)}
          onSelect={(key) => {
            setMoreMenuRect(null);
            if (key.startsWith('action:')) { runAction(key.slice('action:'.length)); return; }
            if (key === 'print') { showToast('Printing clinical profile…'); window.print(); return; }
            if (key === 'edit') { openPatientEdit('basic', patient); return; }
            if (key === 'inactive') {
              const nextStatus = patient.status === 'inactive' ? 'active' : 'inactive';
              updatePatient(patient.id, { status: nextStatus });
              showToast(nextStatus === 'inactive' ? `${patient.name} set to Inactive` : `${patient.name} set to Active`);
              return;
            }
            if (key === 'block') {
              const existing = Array.isArray(p.opted_out_comms) ? p.opted_out_comms : [];
              const primary = patient.phone || p.plan_numbers_primary?.[0] || '';
              if (existing.some(e => e.includes(primary))) { showToast('Number is already blocked'); return; }
              // opted_out_comms lives on p360_profiles, where the banner and
              // Contact card read it (updatePatient wrote the patients table).
              updateP360Profile(patient.id, { opted_out_comms: [...existing, primary ? `${primary} (Call, SMS)` : 'Primary phone (Call, SMS)'] })
                .then(ok => showToast(ok ? `Blocked ${primary || 'primary number'} for calls and SMS` : 'Could not block the number'));
              return;
            }
            noop(MORE_MENU_LABELS[key] || 'Action')();
          }}
        />
      )}

      {showScheduleDrawer && <ScheduleDrawer initialPatientId={patient.id} source="patient_banner" onClose={() => setShowScheduleDrawer(false)} />}
      {consentPos && <PatientConsentPopover patientId={patient.id} pos={consentPos} onClose={closeConsent} />}
      {showProfileDropdown && drawerDropdownStyle && (
        <>
          <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => { setShowProfileDropdown(false); setDrawerDropdownStyle(null); }} />
          <div className={styles.profileDropdown} style={drawerDropdownStyle}>
            <div className={styles.profileDropdownTitle}>Member Insurance Profiles</div>
            {(p.insurance_profiles || FALLBACK_P360.insurance_profiles).map(prof => (
              <button type="button" key={prof.id} aria-pressed={selectedProfileId === prof.id} className={`${styles.profileOption} ${selectedProfileId === prof.id ? styles.profileOptionSelected : ''}`}
                onClick={() => { setSelectedProfileId(prof.id); setShowProfileDropdown(false); setDrawerDropdownStyle(null); }}>
                <div className={styles.profileOptionHeader}>
                  {/* Central Profile IS the FoldHealth identity — show the real
                      Fold ID; other insurer profiles keep their sample ids. */}
                  <div><div className={styles.profileOptionName}>{prof.name}</div><div className={styles.profileOptionSub}>{prof.id === 'central' ? `Fold ID: ${formatFoldId(patient.memberId)}` : prof.subtitle}</div></div>
                  {selectedProfileId === prof.id ? <Icon name="solar:check-circle-bold" size={20} color="var(--status-success)" /> : <span className={styles.profileOptionRadio} />}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
