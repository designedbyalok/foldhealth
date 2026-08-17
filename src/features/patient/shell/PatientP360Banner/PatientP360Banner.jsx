import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Icon } from '../../../../components/Icon/Icon';
import { MenuPopover } from '../../../../components/MenuPopover/MenuPopover';
import { useAppStore } from '../../../../store/useAppStore';
import { formatDobDisplay, deriveDob } from '../../../../lib/patientDob';
import { formatFoldId } from '../../../../lib/foldId';
import { FALLBACK_P360 } from '../../data/p360Mock';
import { ExpandedDemographics, ExpandedHealthStatus, ExpandedAppointments, ExpandedFamily, QuickViewExpanded } from './PatientP360BannerExpanded';
import { PatientP360BannerDrawer } from './PatientP360BannerDrawer';
import { MORE_MENU_LABELS } from './PatientP360Banner.utils';
import styles from './PatientP360Banner.module.css';

export function PatientP360Banner({ patient, variant = 'full' }) {
  const [expanded, setExpanded] = useState(false);
  const [tags, setTags] = useState([]);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // The dropdown's scrim is aria-hidden, so Escape is the keyboard dismiss path.
  // Before this there was none at all — the only way out was a mouse click on
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
  const [bannerSize, setBannerSize] = useState('wide');
  const showToast = useAppStore(s => s.showToast);
  const updatePatient = useAppStore(s => s.updatePatient);
  const openPatientEdit = useAppStore(s => s.openPatientEdit);

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
  useEffect(() => { if (patient?.id) fetchP360Profile(patient.id); }, [patient?.id, fetchP360Profile]);

  // Real enrolled care programs (patient_care_programs) — the "Programs:"
  // badges must reflect actual enrollment, not the static p360 mock field.
  // The fetch is per-patient-guarded in the store, so this is a no-op when
  // the Care Programs tab (or a previous banner mount) already hydrated it.
  const carePrograms = useAppStore(s => (patient?.id ? s.careProgramsByPatient[patient.id] : undefined));
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  useEffect(() => { if (patient?.id) fetchCareProgramsForPatient(patient.id); }, [patient?.id, fetchCareProgramsForPatient]);
  // Unique codes in enrollment order — SNP can be enrolled multiple times
  // (one row per trigger) but reads as a single badge.
  const programCodes = useMemo(
    () => [...new Set((carePrograms || []).map(cp => cp.code))],
    [carePrograms],
  );

  const p = p360Profile || FALLBACK_P360;
  useEffect(() => { setTags(p.condition_tags || FALLBACK_P360.condition_tags); }, [p.condition_tags]);

  if (!patient) return null;
  if (variant === 'drawer') return <PatientP360BannerDrawer patient={patient} p={p} programCodes={programCodes} />;


  return (
    <div className={styles.banner} ref={bannerRef}>
      <div className={styles.row1}>
        <div className={styles.userInfo}>
          <Avatar variant="patient" initials={patient.initials || '??'} />
          <div className={styles.nameBlock}>
            <div className={styles.nameRow}>
              <span className={styles.name}>{patient.name}</span>
              <Icon name="solar:pen-2-linear" size={16} color="var(--neutral-200)" />
            </div>
            <div className={styles.meta}>
              {patient.gender} • {formatDobDisplay(patient.dob) || deriveDob(patient.age, patient.name) || '—'} ({patient.age})
              {bannerSize !== 'wide' && (
                <>
                  <span className={styles.metaDot}>•</span>
                  <button type="button" className={styles.metaConsent}>
                    Consent: {p.consent_given}/{p.consent_total}
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
                <span className={`${styles.badge} ${styles.badgeGrey}`} style={{ height: 18, fontSize: 12, padding: '0 4px', marginLeft: 4 }}>+{((p.insurance_profiles || FALLBACK_P360.insurance_profiles).length - 1)}</span>
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
                        {/* Central Profile IS the FoldHealth identity — its id is the
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
                  <span className={`${styles.badge} ${styles.badgeWarning}`}>{p.consent_given}/{p.consent_total} <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--status-warning)" /></span>
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
                <div className={styles.metricValueRow}><span className={styles.nextApptValue}>{p.next_appointment_date || '—'}</span></div>
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
          <div className={styles.actionCol}><ActionButton icon="solar:square-top-down-linear" size="L" tooltip="EHR" /><span className={styles.actionLabel}>EHR</span></div>
          <span className={styles.hDivider} />
          <div className={styles.actionCol}><ActionButton icon="solar:phone-linear" size="L" tooltip="Call" /><span className={styles.actionLabel}>Call</span></div>
          <span className={styles.hDivider} />
          <div className={styles.actionCol}><ActionButton icon="solar:letter-linear" size="L" tooltip="Email" /><span className={styles.actionLabel}>Email</span></div>
          <span className={styles.hDivider} />
          <ActionButton
            icon="solar:menu-dots-bold"
            size="L"
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
            if (key === 'edit') { openPatientEdit('basic', patient); return; }
            if (key === 'print') { showToast('Printing clinical profile…'); window.print(); return; }
            if (key === 'inactive') {
              const nextStatus = patient.status === 'inactive' ? 'active' : 'inactive';
              updatePatient(patient.id, { status: nextStatus });
              showToast(nextStatus === 'inactive' ? `${patient.name} set to Inactive` : `${patient.name} set to Active`);
              return;
            }
            showToast(`${MORE_MENU_LABELS[key] || 'Action'} — coming soon`);
          }}
        />
      )}

      <div className={styles.row2}>
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
        <button className={styles.addTagBtn} aria-label="Add tag"><Icon name="solar:add-circle-linear" size={12} color="var(--neutral-300)" /></button>
      </div>

      {expanded && (
        bannerSize === 'wide' ? (
          <div className={styles.expandedGrid}>
            <ExpandedDemographics p={p} />
            <ExpandedHealthStatus p={p} movedMetrics programCodes={programCodes} />
            <ExpandedAppointments p={p} />
            <ExpandedFamily p={p} />
          </div>
        ) : (
          <QuickViewExpanded p={p} programCodes={programCodes} />
        )
      )}
    </div>
  );
}
