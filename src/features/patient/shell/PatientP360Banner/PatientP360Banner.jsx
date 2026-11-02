import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Icon } from '../../../../components/Icon/Icon';
import { MenuPopover } from '../../../../components/MenuPopover/MenuPopover';
import { Collapse } from '../../../../components/Collapse/Collapse';
import { useAppStore } from '../../../../store/useAppStore';
import { formatFoldId } from '../../../../lib/foldId';
import { usePatientDisplay } from '../../hooks/usePatientDisplay';
import { PatientAppActiveIndicator } from '../../../../components/PatientAppActiveIndicator/PatientAppActiveIndicator';
import { FALLBACK_P360 } from '../../data/p360Mock';
import { ExpandedDemographics, ExpandedHealthStatus, ExpandedAppointments, ExpandedFamily, QuickViewExpanded } from './PatientP360BannerExpanded';
import { PatientP360BannerDrawer } from './PatientP360BannerDrawer';
import { buildPatientRowMenuItems } from '../../../../components/MenuPopover/patientRowMenuItems';
import { useCcmTimerDockOptional } from '../CcmTimerWidget/CcmTimerDockContext';
import { PatientConsentPopover } from '../../shared/PatientConsentPopover/PatientConsentPopover';
import { usePatientConsent } from '../../hooks/usePatientConsent';
import { consentPopoverPos, consentSummaryLabel } from './consentBadge';
import { PatientTagPills, AddPatientTagDrawer } from './PatientTags';
import { AddFamilyDrawer } from '../../family/AddFamilyDrawer';
import { CareTeamDrawer } from '../../care-team/CareTeamDrawer';
import styles from './PatientP360Banner.module.css';

export function PatientP360Banner({ patient, variant = 'full' }) {
  const [expanded, setExpanded] = useState(false);
  const [tags, setTags] = useState([]);
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // The dropdown's scrim is aria-hidden, so Escape is the keyboard dismiss path.
  // Before this there was none at all, the only way out was a mouse click on
  // the scrim, which a keyboard user cannot reach.
  useEffect(() => {
    if (!showProfileDropdown) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShowProfileDropdown(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showProfileDropdown]);
  const [selectedProfileId, setSelectedProfileId] = useState('central');
  const [moreMenuRect, setMoreMenuRect] = useState(null);
  const bannerRef = useRef(null);
  const callBtnRef = useRef(null);
  const openCallPopover = useAppStore(s => s.openCallPopover);
  const [bannerSize, setBannerSize] = useState('wide');
  const showToast = useAppStore(s => s.showToast);
  const runPatientRowAction = useAppStore(s => s.runPatientRowAction);
  const openPatientEdit = useAppStore(s => s.openPatientEdit);
  const showPatientAppIndicator = useAppStore(s => s.showPatientAppIndicator);
  const { dockRef } = useCcmTimerDockOptional();
  const [consentPos, setConsentPos] = useState(null);
  const { summary: consent } = usePatientConsent(patient?.id);
  const toggleConsent = (e) => {
    const next = consentPopoverPos(e.currentTarget);
    setConsentPos(pos => (pos ? null : next));
  };
  const closeConsent = useCallback(() => setConsentPos(null), []);

  const measureBanner = useCallback(() => {
    const el = bannerRef.current;
    if (!el) return;
    setBannerSize(el.getBoundingClientRect().width < 1200 ? 'narrow' : 'wide');
  }, []);

  useLayoutEffect(() => {
    const el = bannerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => measureBanner());
    ro.observe(el);
    measureBanner();
    return () => ro.disconnect();
  }, [measureBanner]);

  const p360Profile = useAppStore(s => (patient?.id ? s.p360ProfilesById[patient.id] : null));
  const fetchP360Profile = useAppStore(s => s.fetchP360Profile);
  const fetchOrgFeatures = useAppStore(s => s.fetchOrgFeatures);
  useEffect(() => { if (patient?.id) fetchP360Profile(patient.id); }, [patient?.id, fetchP360Profile]);
  useEffect(() => { fetchOrgFeatures(); }, [fetchOrgFeatures]);

  // Real enrolled care programs (patient_care_programs): the "Programs:"
  // badges must reflect actual enrollment, not the static p360 mock field.
  // The fetch is per-patient-guarded in the store, so this is a no-op when
  // the Care Programs tab (or a previous banner mount) already hydrated it.
  const carePrograms = useAppStore(s => (patient?.id ? s.careProgramsByPatient[patient.id] : undefined));
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  useEffect(() => { if (patient?.id) fetchCareProgramsForPatient(patient.id); }, [patient?.id, fetchCareProgramsForPatient]);
  // Unique codes in enrollment order: SNP can be enrolled multiple times
  // (one row per trigger) but reads as a single badge.
  const programCodes = useMemo(
    () => [...new Set((carePrograms || []).map(cp => cp.code))],
    [carePrograms],
  );

  // Family and care team come only from the patient's own profile; without
  // one they're empty (sample people would read as real ones).
  const p = p360Profile || { ...FALLBACK_P360, family_members: [], family_caregiver_count: 0, care_team: [] };
  const [familyOpen, setFamilyOpen] = useState(false);
  const [careTeamOpen, setCareTeamOpen] = useState(false);
  const familyDrawer = patient && (
    <>
      {familyOpen && <AddFamilyDrawer patient={patient} onClose={() => setFamilyOpen(false)} />}
      {careTeamOpen && <CareTeamDrawer patient={patient} onClose={() => setCareTeamOpen(false)} />}
    </>
  );
  const display = usePatientDisplay(patient);
  useEffect(() => { setTags(p.condition_tags || FALLBACK_P360.condition_tags); }, [p.condition_tags]);

  if (!patient) return null;
  if (variant === 'drawer') return <><PatientP360BannerDrawer patient={patient} p={p} programCodes={programCodes} onManageFamily={() => setFamilyOpen(true)} onManageCareTeam={() => setCareTeamOpen(true)} />{familyDrawer}</>;


  return (
    <div className={styles.banner} ref={bannerRef}>
      <div className={styles.row1}>
        <div className={styles.userInfo}>
          <Avatar variant="patient" initials={patient.initials || '??'} />
          <div className={styles.nameBlock}>
            <div className={styles.nameRow}>
              <span className={styles.name}>{display.displayName}</span>
              {showPatientAppIndicator && patient.patientAppActive && (
                <PatientAppActiveIndicator size={16} />
              )}
            </div>
            <div className={styles.meta}>
              {display.gender} • {display.dob || '-'} ({display.age})
              {bannerSize !== 'wide' && (
                <>
                  <span className={styles.metaDot}>•</span>
                  <button type="button" className={styles.metaConsent} onClick={toggleConsent} aria-haspopup="dialog">
                    Consent: {consentSummaryLabel(consent)}
                    <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--status-warning)" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <span className={styles.vDivider} />

        <div className={styles.mainInfo}>
          <div style={{ position: 'relative' }}>
            <button type="button" aria-expanded={showProfileDropdown} className={styles.profileCard} onClick={() => setShowProfileDropdown(v => !v)} style={{ cursor: 'pointer' }}>
              <div className={styles.profileCardTop}>
                <Icon name="solar:hospital-linear" size={14} color="var(--neutral-300)" />
                <span className={styles.profileLink}>{(p.insurance_profiles || FALLBACK_P360.insurance_profiles).find(pr => pr.id === selectedProfileId)?.name || p.profile_type} <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" /></span>
              </div>
              <div className={styles.profileCardBottom}>
                <strong>{selectedProfileId === 'central' ? p.health_plan_name : (p.insurance_profiles || FALLBACK_P360.insurance_profiles).find(pr => pr.id === selectedProfileId)?.name}</strong> <span>({p.health_plan_id || formatFoldId(patient.memberId)})</span>
                <span className={`${styles.badge} ${styles.badgeGrey}`} style={{ height: 18, fontSize: 'var(--font-sm)', padding: '0 4px', marginLeft: 4 }}>+{((p.insurance_profiles || FALLBACK_P360.insurance_profiles).length - 1)}</span>
              </div>
            </button>
            {showProfileDropdown && (
              <>
                <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowProfileDropdown(false)} />
                <div className={styles.profileDropdown}>
                  <div className={styles.profileDropdownTitle}>Member Insurance Profiles</div>
                  {(p.insurance_profiles || FALLBACK_P360.insurance_profiles).map(prof => (
                    <button type="button" key={prof.id} aria-pressed={selectedProfileId === prof.id} className={`${styles.profileOption} ${selectedProfileId === prof.id ? styles.profileOptionSelected : ''}`} onClick={() => { setSelectedProfileId(prof.id); setShowProfileDropdown(false); }}>
                      <div className={styles.profileOptionHeader}>
                        {/* Central Profile IS the FoldHealth identity, its id is the
                            patient's real Fold ID, not the mock's sample Athena id.
                            Other insurer profiles keep their sample member ids. */}
                        <div><div className={styles.profileOptionName}>{prof.name}</div><div className={styles.profileOptionSub}>{prof.id === 'central' ? `Fold ID: ${formatFoldId(patient.memberId)}` : prof.subtitle}</div></div>
                        {selectedProfileId === prof.id ? <Icon name="solar:check-circle-bold" size={20} color="var(--status-success)" /> : <span className={styles.profileOptionRadio} />}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {bannerSize === 'wide' && (
            <>
              <div className={styles.metricCol}>
                <span className={styles.metricLabel}>Consent</span>
                <div className={styles.metricValueRow}>
                  <button type="button" className={`${styles.badge} ${styles.badgeWarning}`} onClick={toggleConsent} aria-haspopup="dialog" aria-label={`Consent ${consentSummaryLabel(consent)}`}>{consentSummaryLabel(consent)} <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--status-warning)" /></button>
                </div>
              </div>
              <div className={styles.metricCol}>
                <span className={styles.metricLabel}>Acuity</span>
                <div className={styles.metricValueRow}><span className={`${styles.badge} ${styles.badgeError}`}>{p.acuity}</span></div>
              </div>
              <div className={styles.metricCol}>
                <span className={styles.metricLabel}>RAF</span>
                <div className={styles.metricValueRow}>
                  <span className={styles.rafValue}>{p.raf_score}</span>
                  {p.raf_change > 0 && <span className={styles.rafChangeBadge}>+{p.raf_change} <Icon name="solar:arrow-up-linear" size={12} color="var(--status-error)" /></span>}
                </div>
              </div>
              <div className={styles.metricCol}>
                <span className={styles.metricLabel}>Next Appt.</span>
                <div className={styles.metricValueRow}><span className={styles.nextApptValue}>{p.next_appointment_date || '-'}</span></div>
              </div>
            </>
          )}

          <button className={styles.expandArrow} onClick={() => setExpanded(v => !v)} aria-expanded={expanded} aria-label={expanded ? 'Collapse patient summary' : 'Expand patient summary'}>
            <span className={`${styles.drawerExpandIconInner} ${expanded ? styles.drawerExpandIconRotated : ''}`}>
              <Icon name="custom:expand-drawer" size={16} />
            </span>
          </button>
        </div>

        <div className={styles.actionsGroup}>
          <div className={styles.actionCol}><ActionButton icon="solar:square-top-down-linear" tooltip="EHR" /><span className={styles.actionLabel}>EHR</span></div>
          <span className={styles.hDivider} />
          <div className={styles.actionCol}>
            <ActionButton
              ref={callBtnRef}
              icon="solar:phone-linear"
              tooltip="Call"
              onClick={() => openCallPopover(patient.id, callBtnRef)}
            />
            <span className={styles.actionLabel}>Call</span>
          </div>
          <span className={styles.hDivider} />
          <div className={styles.actionCol}><ActionButton icon="solar:letter-linear" tooltip="Email" /><span className={styles.actionLabel}>Email</span></div>
          <span className={styles.hDivider} />
          <ActionButton
            icon="solar:menu-dots-bold"
            tooltip="More"
            onClick={(e) => setMoreMenuRect(e.currentTarget.getBoundingClientRect())}
          />
        </div>
      </div>

      {moreMenuRect && (
        <MenuPopover
          anchorRect={moreMenuRect}
          width={220}
          align="right"
          // The same actions as a worklist row's menu, minus Send Email:
          // the Email button sits beside this one.
          items={buildPatientRowMenuItems().filter(item => item.key !== 'Send Email')}
          onClose={() => setMoreMenuRect(null)}
          onSelect={(key) => {
            setMoreMenuRect(null);
            if (runPatientRowAction(key, patient)) return;
            if (key === 'Edit Details') { openPatientEdit('basic', patient); return; }
            showToast(`${key}: coming soon`);
          }}
        />
      )}

      <div className={styles.row2} data-ccm-timer-row>
        <button className={styles.patientTypeBadge}>{p.patient_type} <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" /></button>
        <span className={styles.tagDivider} />
        {tags.map((tag, i) => (
          <span key={i} className={tag === 'Needs Transportation' ? styles.tagBlue : styles.tagCyan}>
            {tag}
            <button className={styles.tagClose} onClick={() => setTags(prev => prev.filter((_, j) => j !== i))} aria-label={`Remove ${tag} tag`}>
              <Icon name="solar:close-linear" size={12} color={tag === 'Needs Transportation' ? 'var(--status-info)' : 'var(--accent-cyan)'} />
            </button>
          </span>
        ))}
        <PatientTagPills patientId={patient.id} />
        <button className={styles.addTagBtn} aria-label="Add tag" onClick={() => setAddTagOpen(true)}><Icon name="solar:add-circle-linear" size={12} color="var(--neutral-300)" /></button>
        {addTagOpen && <AddPatientTagDrawer patient={patient} onClose={() => setAddTagOpen(false)} />}
        {familyDrawer}
        <span className={styles.row2Spacer} aria-hidden="true" />
        <div ref={dockRef} className={styles.timerDockSlot} data-ccm-timer-dock />
      </div>

      <Collapse open={expanded}>
        {bannerSize === 'wide' ? (
          <div className={styles.expandedGrid}>
            <ExpandedDemographics p={p} />
            <ExpandedHealthStatus p={p} movedMetrics programCodes={programCodes} />
            <ExpandedAppointments p={p} />
            <ExpandedFamily p={p} patientId={patient.id} visible={expanded} onManage={() => setFamilyOpen(true)} onManageCareTeam={() => setCareTeamOpen(true)} />
          </div>
        ) : (
          <QuickViewExpanded p={p} patientId={patient.id} visible={expanded} programCodes={programCodes} onManageFamily={() => setFamilyOpen(true)} onManageCareTeam={() => setCareTeamOpen(true)} />
        )}
      </Collapse>
      {consentPos && <PatientConsentPopover patientId={patient.id} pos={consentPos} onClose={closeConsent} />}
    </div>
  );
}
