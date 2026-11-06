import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../components/Badge/Badge';
import { BottomSheet, BottomSheetItem } from '../../../../components/BottomSheet/BottomSheet';
import { Sparkline } from '../../../../components/Sparkline/Sparkline';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { todayIso } from '../../../../lib/clinicalDates';
import { VITALS, formatVital } from '../../../patient/left-panel/tabs/vitals-labs/vitalsConfig';
import { useMobileNav } from '../../MobileNavContext';
import { PAMI_KINDS } from '../../patient/pamiKinds';
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

// The row menu's status shortcut per list, as the desktop row's status
// dropdown offers it (with Undo), and what it is called.
const STATUS_ACTION = {
  problem: { to: 'Resolved', label: 'Mark Resolved', toast: 'Problem marked as resolved' },
  allergy: { to: 'Past', label: 'Move to Past Allergies', toast: 'Allergy moved to past allergies' },
  immunization: { to: 'Completed', label: 'Mark Completed', toast: 'Immunization marked as completed' },
};

/** Figma P360 PAMI (759:26690): medications, problems, allergies, immunizations, vitals. */
export function PamiTab({ patientId }) {
  const { push } = useMobileNav();
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
  const [menu, setMenu] = useState(null); // { kind, row }

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

  const addNew = (kind) => push('patientPami', { patientId, kind });
  const edit = (kind, row, preset) => push('patientPami', { patientId, kind, itemId: row.id, preset });

  return (
    <>
      <ProfileSection title="Medications" count={activeMeds.length || null} onAdd={() => addNew('medication')} addLabel="Add medication">
        {activeMeds.length === 0 ? <ProfileEmpty>No active medications</ProfileEmpty> : (
          <div className={styles.group}>
            {activeMeds.map(m => (
              <PamiRow onEdit={edit} onMenu={setMenu} key={m.id} kind="medication" row={m}>
                <span className={`${common.primaryText} ${common.wrap}`}>{m.name}</span>
                <span className={`${common.secondaryText} ${common.wrap}`}>
                  {[m.sig, m.lastFilledOn ? `Last filled ${m.lastFilledOn}` : '', m.start ? `Since ${m.start}` : ''].filter(Boolean).join(' • ') || 'Active'}
                </span>
              </PamiRow>
            ))}
          </div>
        )}
        {pastMeds > 0 && <p className={styles.footnote}>{pastMeds} discontinued {pastMeds === 1 ? 'medication' : 'medications'}</p>}
      </ProfileSection>

      <ProfileSection title="Problems" count={activeProblems.length || null} onAdd={() => addNew('problem')} addLabel="Add problem">
        {activeProblems.length === 0 ? <ProfileEmpty>No active problems</ProfileEmpty> : (
          <div className={styles.group}>
            {activeProblems.map(p => (
              <PamiRow onEdit={edit} onMenu={setMenu} key={p.id} kind="problem" row={p} badge={p.severity && <Badge size="sm" variant="soft" tone={toneFor(p.severity)} label={p.severity} />}>
                {p.onsetLabel && <span className={common.secondaryText}>Since {p.onsetLabel}</span>}
                <span className={`${common.primaryText} ${common.wrap}`}>{p.title}{p.code ? ` (${p.code})` : ''}</span>
                {p.type && <span className={common.secondaryText}>{p.type}</span>}
              </PamiRow>
            ))}
          </div>
        )}
        {resolvedProblems > 0 && <p className={styles.footnote}>{resolvedProblems} resolved {resolvedProblems === 1 ? 'problem' : 'problems'}</p>}
      </ProfileSection>

      <ProfileSection title="Allergies" count={allergies.length || null} onAdd={() => addNew('allergy')} addLabel="Add allergy">
        {allergies.length === 0 ? <ProfileEmpty>No known allergies</ProfileEmpty> : (
          <div className={styles.group}>
            {allergies.map(a => (
              <PamiRow onEdit={edit} onMenu={setMenu} key={a.id} kind="allergy" row={a} badge={a.criticality && <Badge size="sm" variant="soft" tone={toneFor(a.criticality)} label={a.criticality} />}>
                {a.sinceDate && <span className={common.secondaryText}>Since {a.sinceDate}</span>}
                <span className={`${common.primaryText} ${common.wrap}`}>{a.title}</span>
                {(a.reactions?.length > 0 || a.reactionType) && (
                  <span className={`${common.secondaryText} ${common.wrap}`}>
                    {[a.reactionType, ...(a.reactions || []).map(r => (typeof r === 'string' ? r : r?.display || r?.name || r?.label)).filter(Boolean)].filter(Boolean).join(', ')}
                  </span>
                )}
              </PamiRow>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Immunizations" count={immunizations.length || null} onAdd={() => addNew('immunization')} addLabel="Add immunization">
        {immunizations.length === 0 ? <ProfileEmpty>No immunizations recorded</ProfileEmpty> : (
          <div className={styles.group}>
            {immunizations.map(i => (
              <PamiRow onEdit={edit} onMenu={setMenu} key={i.id} kind="immunization" row={i}>
                {i.dateAdministered && <span className={common.secondaryText}>{i.dateAdministered}</span>}
                <span className={`${common.primaryText} ${common.wrap}`}>{i.title}</span>
                {(i.doseQuantity || i.doseUnits) && <span className={common.secondaryText}>{[i.doseQuantity, i.doseUnits].filter(Boolean).join(' ')}</span>}
              </PamiRow>
            ))}
          </div>
        )}
      </ProfileSection>

      <ProfileSection title="Vitals" count={vitalCards.length || null} onAdd={() => push('patientVitals', { patientId })} addLabel="Record vitals">
        {vitalCards.length === 0 ? <ProfileEmpty>No vitals recorded</ProfileEmpty> : (
          <div className={styles.vitals}>
            {vitalCards.map(v => (
              <button key={v.key} type="button" className={styles.vital} aria-label={`Record ${v.name}`} onClick={() => push('patientVitals', { patientId, focus: v.key })}>
                <span className={styles.vitalName}>{v.name}</span>
                <span className={styles.vitalValue}>
                  {formatVital(v.key, v.latest.value, v.latest.value2)}
                  {v.key !== 'spo2' && v.key !== 'ht' && <span className={styles.vitalUnit}> {v.unit}</span>}
                </span>
                <span className={styles.vitalDate}>{shortDate(v.latest.recorded_on)}</span>
                {v.series.length > 1 && <Sparkline values={v.series} label={`${v.name} trend`} />}
              </button>
            ))}
          </div>
        )}
      </ProfileSection>

      {menu && <RowMenu patientId={patientId} {...menu} onEdit={edit} onClose={() => setMenu(null)} />}
    </>
  );
}

/** A PAMI row (Figma 759:27080): tap to edit, "⋯" for the rest. */
function PamiRow({ kind, row, badge, children, onEdit, onMenu }) {
  return (
    <div className={styles.pamiRow}>
      <button type="button" className={styles.pamiMain} onClick={() => onEdit(kind, row)}>
        <span className={common.cardText}>{children}</span>
        {badge}
      </button>
      <ActionButton icon="solar:menu-dots-linear" size="lg" aria-label={`More for ${PAMI_KINDS[kind].titleOf(row)}`} onClick={() => onMenu({ kind, row })} />
    </div>
  );
}

/** "⋯" on a PAMI row: edit, the status shortcut, remove (with a confirm). */
function RowMenu({ patientId, kind, row, onEdit, onClose }) {
  const cfg = PAMI_KINDS[kind];
  const update = useAppStore(s => s[cfg.update]);
  const remove = useAppStore(s => (cfg.remove ? s[cfg.remove] : null));
  const [confirming, setConfirming] = useState(false);
  const title = cfg.titleOf(row);
  const status = STATUS_ACTION[kind];

  const setStatus = async () => {
    onClose();
    const prev = row.status || 'Active';
    const ok = await update(patientId, row.id, { status: status.to });
    if (ok) toast.success(status.toast, { action: { label: 'Undo', onClick: () => update(patientId, row.id, { status: prev }) } });
  };
  const doRemove = async () => {
    onClose();
    const ok = await remove(patientId, row.id);
    if (ok) toast.success(`${cfg.noun} removed`);
  };

  if (confirming) {
    return (
      <BottomSheet title={`Remove ${cfg.noun}?`} onClose={onClose}>
        <p className={styles.sheetText}>&ldquo;{title}&rdquo; will be removed from the patient&apos;s list.</p>
        <BottomSheetItem icon="solar:trash-bin-minimalistic-linear" label="Remove" tone="danger" onClick={doRemove} />
      </BottomSheet>
    );
  }
  return (
    <BottomSheet title={title} onClose={onClose}>
      <BottomSheetItem icon="solar:pen-linear" label="Edit" onClick={() => { onClose(); onEdit(kind, row); }} />
      {kind === 'medication' && (
        <BottomSheetItem icon="solar:stop-circle-linear" label="Stop Medication" onClick={() => { onClose(); onEdit(kind, row, { status: 'Stopped', stop: todayIso() }); }} />
      )}
      {status && row.status !== status.to && <BottomSheetItem icon="solar:check-circle-linear" label={status.label} onClick={setStatus} />}
      {remove && <BottomSheetItem icon="solar:trash-bin-minimalistic-linear" label="Remove" tone="danger" onClick={() => setConfirming(true)} />}
    </BottomSheet>
  );
}
