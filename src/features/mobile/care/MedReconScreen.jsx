import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { searchMedications } from '../../../lib/openfda';
import { MED_RECON_MOCK } from '../../patient/data/medReconMock';
import { mmddyy } from '../../patient/right-panel/tabs/care-programs/program-detail/ProgramDetailView/ProgramDetailView.utils';
import { todayMMDDYYYY } from '../../tasks/TasksView.utils';
import { MobileListSkeleton } from '../MobileParts';
import { FieldGroup, FormScreen } from '../patient/FormScreen';
import { usePatient } from '../patient/usePatient';
import { AssigneeSheet } from './ProgramSheets';
import styles from './care.module.css';

const EMPTY = [];
const EMPTY_CHECKS = {};
const STATUS_OPTIONS = [{ value: 'Active', label: 'Active' }, { value: 'Stopped', label: 'Stopped' }];
const STOP_REASONS = ['Adverse Reaction', 'Ineffective', 'Patient Request', 'Prescriber Discontinued', 'Other'].map(v => ({ value: v, label: v }));
const todayISO = () => new Date().toISOString().slice(0, 10);
const toMDY = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return m && d && y ? `${m}/${d}/${y}` : iso; };
const toISO = (s) => { const [m, d, y] = String(s || '').split('/'); return m && d && y ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : ''; };
const blank = () => ({ name: '', status: 'Active', start: todayISO(), stopDate: '', stopReason: '', sig: '', note: '', openfdaMeta: null, source: 'manual' });

/**
 * The Medication Reconciliation step on the phone (desktop
 * MedicationReconciliation): the patient's medications with discharge
 * imports badged New until seen (markNewMedsViewed), add or edit one
 * (addPatientMedication / updatePatientMedication, same required fields),
 * the mandatory Medication Checklist (setMedReconCheck), and Sign (Self / NP)
 * or Send for Sign Off once every box is ticked. Each change is logged to
 * the program's activity as on desktop.
 */
export function MedReconScreen({ patientId, programId }) {
  const program = useAppStore(s => (s.careProgramsByPatient[patientId] || []).find(p => String(p.id) === String(programId)) || null);
  const meds = useAppStore(s => s.patientMedications?.[patientId]);
  const fetchPatientMedications = useAppStore(s => s.fetchPatientMedications);
  const addPatientMedication = useAppStore(s => s.addPatientMedication);
  const updatePatientMedication = useAppStore(s => s.updatePatientMedication);
  const viewed = useAppStore(s => s.viewedNewMedIds[patientId]) || EMPTY;
  const markNewMedsViewed = useAppStore(s => s.markNewMedsViewed);
  const checks = useAppStore(s => s.medReconChecks[patientId]) || EMPTY_CHECKS;
  const setMedReconCheck = useAppStore(s => s.setMedReconCheck);
  const logProgramActivity = useAppStore(s => s.logProgramActivity);
  const updateCareProgram = useAppStore(s => s.updateCareProgram);
  const createTask = useAppStore(s => s.createTask);
  const me = useAppStore(s => s.currentUserProfile);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const patient = usePatient(patientId);
  const [editing, setEditing] = useState(null); // { med | null } while the form sheet is open
  const [sheet, setSheet] = useState(null); // 'sign' | 'signoff'

  useEffect(() => { if (patientId) fetchPatientMedications?.(patientId); }, [patientId, fetchPatientMedications]);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  const medications = useMemo(() => meds || EMPTY, [meds]);
  // Desktop: a discharge import keeps its New badge for the whole first
  // visit and is marked seen on the way out.
  const unseenRef = useRef([]);
  useEffect(() => {
    unseenRef.current = medications.filter(m => m.source === 'discharge_import' && !viewed.includes(m.id)).map(m => m.id);
  }, [medications, viewed]);
  useEffect(() => () => {
    if (unseenRef.current.length) markNewMedsViewed(patientId, unseenRef.current);
  }, [patientId, markNewMedsViewed]);

  const log = (title, statusLabel = '', statusType = 'neutral') => logProgramActivity({
    patientId, programCode: program?.code, title, activityKind: 'medication', statusLabel, statusType,
  });

  const checklistDone = MED_RECON_MOCK.checklist.every(c => checks[c.id]);
  const signature = program?.medReconSignedBy
    ? `Signed by ${program.medReconSignedBy}${program.medReconSignedRole ? ` (${program.medReconSignedRole})` : ''} on ${program.medReconSignedAt}`
    : null;

  const openSign = () => {
    // The checklist is mandatory: the attempt says so rather than a dead button.
    if (!checklistDone) { toast.error('Complete Medication Checklist to sign.'); return; }
    setSheet('sign');
  };
  const sign = (role) => {
    setSheet(null);
    const name = me?.name;
    if (!name) { toast.error('Could not sign: no signed-in user'); return; }
    updateCareProgram(patientId, program.id, { medReconSignedBy: name, medReconSignedRole: role, medReconSignedAt: mmddyy() });
    log('Medication Reconciliation Signed', `Signed by ${name}`, 'success');
    toast.success('Medication reconciliation signed');
  };
  const sendSignOff = async (user) => {
    setSheet(null);
    const memberName = patient?.name || '';
    const created = await createTask({
      name: `Sign off on med recon for ${memberName}`,
      status: 'pending', priority: 'medium', due_date: todayMMDDYYYY(),
      assigned_to: user.name, assigned_to_id: user.id, member: memberName,
      labels: [], meta: '', description: '', pool: null, mentions: [], attachments: 0, comments: 0,
      is_subtask: false, parent_task: null, parent_task_id: null,
      created_by: me?.name || null, created_by_id: me?.id || null,
      program_code: program?.code || null, patient_id: patientId != null ? String(patientId) : null,
    }).catch(() => null);
    if (created) toast.success(`Sign-off task assigned to ${user.name}`);
    else toast.error('Could not create the sign-off task');
  };

  const saveMed = async (draft, med) => {
    const stopped = draft.status === 'Stopped';
    const fields = {
      name: draft.name.trim(),
      start: toMDY(draft.start),
      stop: stopped ? toMDY(draft.stopDate) : '',
      stopReason: stopped ? draft.stopReason : '',
      sig: draft.sig.trim(),
      status: draft.status,
      note: draft.note.trim(),
    };
    if (med) {
      await updatePatientMedication(patientId, med.id, fields);
      log(med.status !== draft.status ? `Medication Status Changed: ${fields.name}` : `Medication Updated: ${fields.name}`, draft.status);
      toast.success(`${fields.name} updated`);
      return true;
    }
    const id = await addPatientMedication(patientId, { ...fields, source: draft.source, openfdaMeta: draft.openfdaMeta });
    if (!id) return false;
    log(`Medication Added: ${fields.name}`, draft.status);
    toast.success(`${fields.name} added`);
    return true;
  };

  return (
    <FormScreen
      title="Medication Reconciliation"
      subtitle={signature || program?.name}
      footer={signature
        ? <Button size="lg" fullWidth variant="soft" tone="success" leadingIcon="solar:check-circle-linear" disabled>Reviewed</Button>
        : <Button size="lg" fullWidth leadingIcon="solar:pen-2-linear" onClick={openSign}>Sign</Button>}
    >
      <FieldGroup label={`Medications${medications.length ? ` (${medications.length})` : ''}`}>
        {meds === undefined ? <MobileListSkeleton count={3} height={72} /> : medications.length === 0 ? (
          <p className={styles.sheetMeta}>No medications on file</p>
        ) : (
          <div className={styles.medList}>
            {medications.map(m => (
              <button key={m.id} type="button" className={styles.medRow} onClick={() => setEditing({ med: m })}>
                <span className={styles.checkText}>
                  <span className={styles.checkLabel}>{m.name}</span>
                  <span className={styles.meta}>{[m.sig, m.start ? `Started ${m.start}` : null, m.stop ? `Stopped ${m.stop}` : null].filter(Boolean).join(' • ')}</span>
                </span>
                {m.source === 'discharge_import' && !viewed.includes(m.id) && <Badge size="sm" tone="primary" variant="soft" label="New" />}
                <Badge size="sm" tone={m.status === 'Stopped' ? 'neutral' : 'success'} variant="soft" label={m.status || 'Active'} />
              </button>
            ))}
          </div>
        )}
        <Button size="lg" variant="outline" leadingIcon="solar:add-circle-linear" onClick={() => setEditing({ med: null })}>Add Medication</Button>
      </FieldGroup>

      <FieldGroup label="Medication Checklist" required>
        <div className={styles.checklist}>
          {MED_RECON_MOCK.checklist.map(c => (
            <label key={c.id} className={styles.checkRow}>
              <Checkbox checked={!!checks[c.id]} onCheckedChange={v => setMedReconCheck(patientId, c.id, v === true)} aria-label={c.label} />
              <span className={[styles.checkLabel, checks[c.id] ? styles.checkDone : ''].join(' ')}>{c.label}</span>
            </label>
          ))}
        </div>
      </FieldGroup>

      {editing && (
        <MedSheet
          med={editing.med}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            const ok = await saveMed(draft, editing.med).catch(() => false);
            if (ok) setEditing(null);
            else toast.error('Could not save the medication.');
          }}
        />
      )}
      {sheet === 'sign' && (
        <BottomSheet title="Sign" onClose={() => setSheet(null)}>
          <BottomSheetItem icon="solar:pen-2-linear" label="Sign (Self)" onClick={() => sign('Self')} />
          <BottomSheetItem icon="solar:pen-2-linear" label="Sign (NP)" onClick={() => sign('NP')} />
          <BottomSheetItem icon="solar:checklist-minimalistic-linear" label="Send for Sign Off" onClick={() => setSheet('signoff')} />
        </BottomSheet>
      )}
      {sheet === 'signoff' && (
        <AssigneeSheet title="Send for Sign Off" users={platformUsers} onPick={sendSignOff} onClose={() => setSheet(null)} />
      )}
    </FormScreen>
  );
}

/**
 * Add or edit a medication (desktop form card): name from an OpenFDA search
 * or typed, status, start date and sig are required; a stopped medication
 * also needs its stop date and reason.
 */
function MedSheet({ med, onSave, onClose }) {
  const [draft, setDraft] = useState(() => (med ? {
    ...blank(), name: med.name, status: med.status || 'Active', start: toISO(med.start), stopDate: toISO(med.stop),
    stopReason: med.stopReason || '', sig: med.sig || '', note: med.note || '',
  } : blank()));
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const stopped = draft.status === 'Stopped';
  const canSave = !!draft.name.trim() && !!draft.status && !!draft.start && !!draft.sig.trim()
    && (!stopped || (!!draft.stopDate && !!draft.stopReason)) && !busy;

  // Debounced OpenFDA lookup while a new medication's name is typed.
  const q = med ? '' : draft.name.trim();
  useEffect(() => {
    if (draft.source === 'openfda' || q.length < 2) return undefined;
    const controller = new AbortController();
    const t = setTimeout(() => {
      searchMedications(q, { signal: controller.signal, limit: 6 }).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => { clearTimeout(t); controller.abort(); };
  }, [q, draft.source]);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try { await onSave(draft); } finally { setBusy(false); }
  };

  return (
    <BottomSheet title={med ? 'Edit Medication' : 'Add Medication'} onClose={onClose}>
      <Input
        size="lg"
        label="Medication"
        required
        leadingIcon={med ? undefined : 'solar:magnifer-linear'}
        placeholder="Search medications"
        value={draft.name}
        readOnly={!!med}
        enterKeyHint="next"
        onValueChange={(v) => { set({ name: v, source: 'manual', openfdaMeta: null }); if (v.trim().length < 2) setResults([]); }}
      />
      {!med && draft.source !== 'openfda' && q.length >= 2 && results.length > 0 && (
        <div className={styles.medList}>
          {results.map(r => (
            <button
              key={r.id || r.displayName}
              type="button"
              className={styles.medRow}
              onClick={() => { set({ name: r.displayName, source: 'openfda', openfdaMeta: r.raw }); setResults([]); }}
            >
              <Icon name="solar:pill-linear" size={20} color="var(--neutral-300)" />
              <span className={styles.checkLabel}>{r.displayName}</span>
            </button>
          ))}
        </div>
      )}
      <RadioOptionGroup label="Status" variant="card" orientation="horizontal" options={STATUS_OPTIONS} value={draft.status} onChange={(v) => set({ status: v })} />
      <div className={styles.dates}>
        <Input type="date" size="lg" label="Start Date" required value={draft.start} onValueChange={(v) => set({ start: v })} />
        {stopped && <Input type="date" size="lg" label="Stop Date" required value={draft.stopDate} min={draft.start || undefined} onValueChange={(v) => set({ stopDate: v })} />}
      </div>
      {stopped && <RadioOptionGroup label="Stop Reason" variant="card" options={STOP_REASONS} value={draft.stopReason} onChange={(v) => set({ stopReason: v })} />}
      <Input size="lg" label="Sig" required placeholder="e.g. 1 tab • 1 time a day • Morning" value={draft.sig} enterKeyHint="next" onValueChange={(v) => set({ sig: v })} />
      <Textarea rows={2} value={draft.note} onChange={(e) => set({ note: e.target.value })} placeholder="Add a note (optional)" aria-label="Medication note" />
      <div className={styles.actions}>
        <Button size="lg" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button size="lg" variant="solid" onClick={save} disabled={!canSave}>{med ? 'Save' : 'Add'}</Button>
      </div>
    </BottomSheet>
  );
}
