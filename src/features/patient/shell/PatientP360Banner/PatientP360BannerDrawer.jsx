import { useState, useRef } from 'react';
import { Icon } from '../../../../components/Icon/Icon';
import { PhoneVerifiedIcon } from '../../../../components/Icon/PhoneVerifiedIcon';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { ConsentPopover } from '../../../../components/ConsentPopover/ConsentPopover';
import { ScheduleDrawer } from '../../../../components/ScheduleDrawer/ScheduleDrawer';
import { MenuPopover } from '../../../../components/MenuPopover/MenuPopover';
import { useAppStore } from '../../../../store/useAppStore';
import { FALLBACK_P360 } from '../../data/p360Mock';
import { QuickViewExpanded } from './PatientP360BannerExpanded';
import { DRAWER_ACTIONS, MORE_MENU_LABELS } from './PatientP360Banner.utils';
import styles from './PatientP360Banner.module.css';

export function PatientP360BannerDrawer({ patient, p }) {
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [consentPos, setConsentPos] = useState(null);
  const consentBadgeRef = useRef(null);
  const [drawerDropdownStyle, setDrawerDropdownStyle] = useState(null);
  const profileCardRef = useRef(null);
  const [showScheduleDrawer, setShowScheduleDrawer] = useState(false);
  const callBtnRef = useRef(null);
  const [moreMenuRect, setMoreMenuRect] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('central');

  const showToast = useAppStore(s => s.showToast);
  const updatePatient = useAppStore(s => s.updatePatient);
  const openCallPopover = useAppStore(s => s.openCallPopover);

  const noop = (label) => () => showToast(`${label} — coming soon`);
  const activeProfileName = (p.insurance_profiles || FALLBACK_P360.insurance_profiles).find(pr => pr.id === selectedProfileId)?.name || p.profile_type;

  const handleConsentClick = () => {
    if (consentPos) { setConsentPos(null); return; }
    const rect = consentBadgeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const popW = 320;
    let left = rect.left;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    setConsentPos({ top: rect.bottom + 4, left });
  };

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
      <div className={styles.drawerPatientBanner}>
        <div className={styles.drawerBannerLeft}>
          <div className={styles.drawerAvatar}>{patient.initials}</div>
          <div className={styles.drawerPatientInfo}>
            <div className={styles.drawerNameRow}>
              <span className={styles.drawerPatientName}>{patient.name}</span>
              <PhoneVerifiedIcon size={16} />
            </div>
            <div className={styles.drawerMetaRow}>
              <span className={styles.drawerMetaText}>{patient.gender} • {patient.age}</span>
              <span className={styles.drawerMetaDot}>•</span>
              <button ref={consentBadgeRef} className={styles.drawerConsentBadge} onClick={handleConsentClick}>
                Consent: 2/4
                <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--status-warning)" />
              </button>
            </div>
          </div>
        </div>
        <span className={styles.drawerBannerDivider} />
        <div ref={profileCardRef} className={styles.drawerProfileCard} onClick={handleProfileClick} style={{ cursor: 'pointer' }}>
          <div className={styles.drawerProfileRow}>
            <Icon name="solar:hospital-linear" size={14} color="var(--neutral-300)" />
            <button className={styles.drawerProfileSelector} tabIndex={-1}>
              {activeProfileName}
              <Icon name="solar:alt-arrow-down-linear" size={14} color="var(--neutral-300)" />
            </button>
          </div>
          <div className={styles.drawerProfileIdRow}>
            <span className={styles.drawerProfileOrg}>{selectedProfileId === 'central' ? p.health_plan_name : activeProfileName}</span>
            <span className={styles.drawerProfileIdText}>(#{p.health_plan_id || patient.memberId})</span>
            <span className={styles.drawerPlusBadge}>+{(p.insurance_profiles || FALLBACK_P360.insurance_profiles).length - 1}</span>
          </div>
        </div>
      </div>

      <div className={styles.drawerTagsRow}>
        <span className={styles.drawerTagBadge}>New Patient <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" /></span>
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

      {drawerExpanded && <QuickViewExpanded p={p} />}

      <div className={styles.drawerActionsRow}>
        <div className={styles.drawerActionsList}>
          {DRAWER_ACTIONS.flatMap(({ icon, label }, i) => {
            const handleAction = () => {
              if (label === 'Schedule') { setShowScheduleDrawer(true); return; }
              if (label === 'Call') { openCallPopover(patient.id, callBtnRef); return; }
              noop(label)();
            };
            const cell = (
              <div key={label} className={styles.drawerActionCell}>
                <button ref={label === 'Call' ? callBtnRef : undefined} className={styles.drawerActionBtn} onClick={handleAction}>
                  <Icon name={icon} size={16} color="var(--neutral-300)" />
                  <span className={styles.drawerActionLabel}>{label}</span>
                </button>
              </div>
            );
            return i === 0 ? [cell] : [<span key={`d${i}`} className={styles.drawerActionDivider} />, cell];
          })}
          <span className={styles.drawerActionDivider} />
          <div className={styles.drawerActionCell}>
            <button className={styles.drawerActionBtn} onClick={noop('SMS')}>
              <div className={styles.drawerSmsWrap}>
                <Icon name="solar:chat-line-linear" size={16} color="var(--neutral-300)" />
                <span className={styles.drawerSmsBadge}><Icon name="solar:verified-check-bold" size={10} color="var(--status-success)" /></span>
              </div>
              <span className={styles.drawerActionLabel}>SMS</span>
            </button>
          </div>
        </div>
        <span className={styles.drawerActionDivider} />
        <ActionButton icon="solar:menu-dots-linear" size="L" tooltip="More" onClick={(e) => setMoreMenuRect(e.currentTarget.getBoundingClientRect())} />
      </div>

      {moreMenuRect && (
        <MenuPopover anchorRect={moreMenuRect} width={220} align="right"
          items={[
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
            if (key === 'print') { showToast('Printing clinical profile…'); window.print(); return; }
            if (key === 'edit') { setDrawerExpanded(true); showToast('Expanded details for editing'); return; }
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
              updatePatient(patient.id, { opted_out_comms: [...existing, primary ? `${primary} (Call, SMS)` : 'Primary phone (Call, SMS)'] });
              showToast(`Blocked ${primary || 'primary number'} for calls and SMS`);
              return;
            }
            noop(MORE_MENU_LABELS[key] || 'Action')();
          }}
        />
      )}

      {showScheduleDrawer && <ScheduleDrawer initialPatientId={patient.id} onClose={() => setShowScheduleDrawer(false)} />}
      {consentPos && <ConsentPopover pos={consentPos} onClose={() => setConsentPos(null)} />}
      {showProfileDropdown && drawerDropdownStyle && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => { setShowProfileDropdown(false); setDrawerDropdownStyle(null); }} />
          <div className={styles.profileDropdown} style={drawerDropdownStyle}>
            <div className={styles.profileDropdownTitle}>Member Insurance Profiles</div>
            {(p.insurance_profiles || FALLBACK_P360.insurance_profiles).map(prof => (
              <div key={prof.id} className={`${styles.profileOption} ${selectedProfileId === prof.id ? styles.profileOptionSelected : ''}`}
                onClick={() => { setSelectedProfileId(prof.id); setShowProfileDropdown(false); setDrawerDropdownStyle(null); }}>
                <div className={styles.profileOptionHeader}>
                  <div><div className={styles.profileOptionName}>{prof.name}</div><div className={styles.profileOptionSub}>{prof.subtitle}</div></div>
                  {selectedProfileId === prof.id ? <Icon name="solar:check-circle-bold" size={20} color="var(--status-success)" /> : <span className={styles.profileOptionRadio} />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
