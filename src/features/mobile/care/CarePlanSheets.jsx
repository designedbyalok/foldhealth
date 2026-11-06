import { useEffect, useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { useCarePlanDraftState } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/useCarePlanDraftState';
import styles from './care.module.css';

const TARGETS = [
  { value: 'EHR', label: 'Share to EHR' },
  { value: 'Patient', label: 'Share to Patient' },
  { value: 'POA', label: 'Share to POA' },
];
const TARGET_ID = { EHR: 'ehr', Patient: 'patient', POA: 'poa' };

/**
 * Share the latest signed version of a care plan (desktop CarePlanShareDrawer
 * Share menu): to the EHR, the patient or their POA, with an optional note.
 * Only a signed version can be shared, so an unsigned plan says to sign it.
 */
export function ShareCarePlanSheet({ patientId, program, onClose }) {
  const key = `${patientId}::${program.id}`;
  const signedCopy = useAppStore(s => s.patientSignedCarePlans?.[key]);
  const fetchSignedCarePlans = useAppStore(s => s.fetchSignedCarePlans);
  const sharePatientCarePlan = useAppStore(s => s.sharePatientCarePlan);
  const draft = useCarePlanDraftState(patientId, program.id);
  const [target, setTarget] = useState('EHR');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // Forced: a plan signed a moment ago on this phone isn't in the cached copies yet.
  useEffect(() => { fetchSignedCarePlans?.(patientId, { force: true }); }, [patientId, fetchSignedCarePlans]);

  const signed = draft.signed && !!signedCopy;
  const version = signedCopy?.signedVersion || draft.latestVersion?.versionNumber || null;
  const goalIds = (signedCopy?.goals || []).map(g => g.id);
  const interventionIds = (signedCopy?.interventions || []).map(i => i.id);
  const nothing = goalIds.length === 0 && interventionIds.length === 0 && !(signedCopy?.barriers || []).length;

  const share = async () => {
    setBusy(true);
    const rec = await sharePatientCarePlan(patientId, program, {
      target: TARGET_ID[target], format: 'standard', note: note.trim(), goalIds, interventionIds, versionNumber: version,
    }).catch(() => null);
    setBusy(false);
    // sharePatientCarePlan shows its own error toast.
    if (!rec) return;
    toast.success(version ? `Version ${version} shared to ${target}` : `Care plan shared to ${target}`);
    onClose();
  };

  return (
    <BottomSheet title="Share Care Plan" onClose={onClose}>
      {!signed ? (
        <p className={styles.sheetText}>Only a signed care plan can be shared. Sign it first, then share it.</p>
      ) : (
        <>
          <p className={styles.sheetMeta}>
            Version {version}: {goalIds.length} goal{goalIds.length === 1 ? '' : 's'}, {interventionIds.length} intervention{interventionIds.length === 1 ? '' : 's'}.
            {draft.hasUnsignedChanges ? ' Unsigned changes are not included; sign the care plan to share them.' : ''}
          </p>
          <RadioOptionGroup label="Share to" variant="card" options={TARGETS} value={target} onChange={setTarget} />
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" aria-label="Share note" />
        </>
      )}
      <div className={styles.actions}>
        <Button size="lg" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button size="lg" variant="solid" leadingIcon="solar:share-linear" disabled={!signed || nothing || busy} onClick={share}>Share</Button>
      </div>
    </BottomSheet>
  );
}

/** A destructive confirmation as a bottom sheet (Apple HIG: confirm before deleting). */
export function ConfirmSheet({ title, text, confirmLabel, busy, onConfirm, onClose }) {
  return (
    <BottomSheet title={title} onClose={onClose}>
      <p className={styles.sheetText}>{text}</p>
      <div className={styles.actions}>
        <Button size="lg" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button size="lg" variant="solid" tone="danger" onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
      </div>
    </BottomSheet>
  );
}
