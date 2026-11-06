import { useEffect, useMemo } from 'react';
import { Badge } from '../../../../components/Badge/Badge';
import { Sparkline } from '../../../../components/Sparkline/Sparkline';
import { useAppStore } from '../../../../store/useAppStore';
import { VITALS, formatVital } from '../../../patient/left-panel/tabs/vitals-labs/vitalsConfig';
import { ProfileEmpty, ProfileSection } from './ProfileSection';
import common from '../../mobile.module.css';
import styles from '../MemberProfileScreen.module.css';

const EMPTY = [];
const isActive = (r) => !/inactive|resolved|stopped|discontinued|completed/i.test(r?.status || '');
const SEVERITY_TONE = { severe: 'danger', high: 'danger', moderate: 'warning', medium: 'warning', mild: 'success', low: 'success' };
const toneFor = (v) => SEVERITY_TONE[String(v || '').toLowerCase()] || 'neutral';
const shortDate = (iso) => {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${m}-${d}-${y}` : (iso || '');
};

/** Figma P360 PAMI: medications, problems, allergies, immunizations, vitals (759:26451). */
export function PamiTab({ patientId }) {
  const meds = useAppStore(s => s.patientMedications?.[patientId] || EMPTY);
  const problems = useAppStore(s => s.patientProblems?.[patientId] || EMPTY);
  const allergies = useAppStore(s => s.patientAllergies?.[patientId] || EMPTY);
  const immunizations = useAppStore(s => s.patientImmunizations?.[patientId] || EMPTY);
  const vitals = useAppStore(s => s.patientVitals?.[patientId] || EMPTY);
  const fetchPatientMedications = useAppStore(s => s.fetchPatientMedications);
  const fetchPatientProblems = useAppStore(s => s.fetchPatientProblems);
  const fetchPatientAllergies = useAppStore(s => s.fetchPatientAllergies);
  const fetchPatientImmunizations = useAppStore(s => s.fetchPatientImmunizations);
  const fetchPatientVitals = useAppStore(s => s.fetchPatientVitals);

  useEffect(() => {
    if (patientId == null) return;
    fetchPatientMedications?.(patientId);
    fetchPatientProblems?.(patientId);
    fetchPatientAllergies?.(patientId);
    fetchPatientImmunizations?.(patientId);
    fetchPatientVitals?.(patientId);
  }, [patientId, fetchPatientMedications, fetchPatientProblems, fetchPatientAllergies, fetchPatientImmunizations, fetchPatientVitals]);

  const activeMeds = meds.filter(isActive);
  const pastMeds = meds.length - activeMeds.length;
  const activeProblems = problems.filter(isActive);
  const resolvedProblems = problems.length - activeProblems.length;

  // Newest reading first per vital (rows arrive newest first).
  const vitalCards = useMemo(() => VITALS.map(v => {
    const readings = vitals.filter(r => r.vital_key === v.key);
    if (!readings.length) return null;
    const latest = readings[0];
    const series = readings.slice(0, 10).map(r => Number(r.value)).filter(Number.isFinite).reverse();
    return { ...v, latest, series };
  }).filter(Boolean), [vitals]);

  return (
    <>
      <ProfileSection title="Medications" count={activeMeds.length || null}>
        {activeMeds.length === 0 ? <ProfileEmpty>No active medications</ProfileEmpty> : (
          <div className={styles.group}>
            {activeMeds.map(m => (
              <div key={m.id} className={styles.groupRow}>
                <span className={common.cardText}>
                  <span className={`${common.primaryText} ${common.wrap}`}>{m.name}</span>
                  <span className={`${common.secondaryText} ${common.wrap}`}>
                    {[m.sig, m.lastFilledOn ? `Last filled ${m.lastFilledOn}` : '', m.start ? `Since ${m.start}` : ''].filter(Boolean).join(' • ') || 'Active'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        {pastMeds > 0 && <p className={styles.footnote}>{pastMeds} discontinued {pastMeds === 1 ? 'medication' : 'medications'}</p>}
      </ProfileSection>

      <ProfileSection title="Problems" count={activeProblems.length || null}>
        {activeProblems.length === 0 ? <ProfileEmpty>No active problems</ProfileEmpty> : (
          <div className={styles.group}>
            {activeProblems.map(p => (
              <div key={p.id} className={styles.groupRow}>
                <span className={common.cardText}>
                  {p.onsetLabel && <span className={common.secondaryText}>Since {p.onsetLabel}</span>}
                  <span className={`${common.primaryText} ${common.wrap}`}>{p.title}{p.code ? ` (${p.code})` : ''}</span>
                  {p.type && <span className={common.secondaryText}>{p.type}</span>}
                </span>
                {p.severity && <Badge size="sm" variant="soft" tone={toneFor(p.severity)} label={p.severity} />}
              </div>
            ))}
          </div>
        )}
        {resolvedProblems > 0 && <p className={styles.footnote}>{resolvedProblems} resolved {resolvedProblems === 1 ? 'problem' : 'problems'}</p>}
      </ProfileSection>

      <ProfileSection title="Allergies" count={allergies.length || null}>
        {allergies.length === 0 ? <ProfileEmpty>No known allergies</ProfileEmpty> : (
          <div className={styles.group}>
            {allergies.map(a => (
              <div key={a.id} className={styles.groupRow}>
                <span className={common.cardText}>
                  {a.sinceDate && <span className={common.secondaryText}>Since {a.sinceDate}</span>}
                  <span className={`${common.primaryText} ${common.wrap}`}>{a.title}</span>
                  {(a.reactions?.length > 0 || a.reactionType) && (
                    <span className={`${common.secondaryText} ${common.wrap}`}>
                      {[a.reactionType, ...(a.reactions || []).map(r => (typeof r === 'string' ? r : r?.name || r?.label)).filter(Boolean)].filter(Boolean).join(', ')}
                    </span>
                  )}
                </span>
                {a.criticality && <Badge size="sm" variant="soft" tone={toneFor(a.criticality)} label={a.criticality} />}
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Immunizations" count={immunizations.length || null}>
        {immunizations.length === 0 ? <ProfileEmpty>No immunizations recorded</ProfileEmpty> : (
          <div className={styles.group}>
            {immunizations.map(i => (
              <div key={i.id} className={styles.groupRow}>
                <span className={common.cardText}>
                  {i.dateAdministered && <span className={common.secondaryText}>{i.dateAdministered}</span>}
                  <span className={`${common.primaryText} ${common.wrap}`}>{i.title}</span>
                  {(i.doseQuantity || i.doseUnits) && <span className={common.secondaryText}>{[i.doseQuantity, i.doseUnits].filter(Boolean).join(' ')}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Vitals" count={vitalCards.length || null}>
        {vitalCards.length === 0 ? <ProfileEmpty>No vitals recorded</ProfileEmpty> : (
          <div className={styles.vitals}>
            {vitalCards.map(v => (
              <div key={v.key} className={styles.vital}>
                <span className={styles.vitalName}>{v.name}</span>
                <span className={styles.vitalValue}>
                  {formatVital(v.key, v.latest.value, v.latest.value2)}
                  {v.key !== 'spo2' && v.key !== 'ht' && <span className={styles.vitalUnit}> {v.unit}</span>}
                </span>
                <span className={styles.vitalDate}>{shortDate(v.latest.recorded_on)}</span>
                {v.series.length > 1 && <Sparkline values={v.series} label={`${v.name} trend`} />}
              </div>
            ))}
          </div>
        )}
      </ProfileSection>
    </>
  );
}
