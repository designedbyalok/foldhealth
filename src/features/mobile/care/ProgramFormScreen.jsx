import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { FieldInput } from '../../forms/builder/FieldInput';
import { FormRenderer } from '../../forms/render/FormRenderer';
import { requiredLeaves } from '../../forms/render/layout';
import { evaluate } from '../../forms/scoring/evaluate';
import { toQuestionnaire } from '../../forms/builder/engineAdapter';
import { isAnswered } from '../../forms/scoring/util';
import { SNP_SNAPSHOT_FORM, snapshotFormName } from '../../forms/templates/snpSnapshotForm';
import { preVisitForProgram } from '../../patient/data/programActivityMock';
import { STEP_STATUS } from '../../patient/right-panel/tabs/care-programs/program-detail/ProgramDetailView/stepStatus';
import { useMobileNav } from '../MobileNavContext';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { FormScreen } from '../patient/FormScreen';
import styles from './care.module.css';

const BUILT_IN = { SNP: SNP_SNAPSHOT_FORM };
const EMPTY_ANSWERS = {};
const leavesOf = items => (items || []).flatMap(f => (f.type === 'group' ? leavesOf(f.items) : [f]));
const countAnswered = answers => Object.values(answers).filter(v => v !== '' && v != null).length;

// Desktop SnapshotForm: MM/DD/YYYY, DD/MM/YYYY or YYYY-MM-DD to YYYY-MM-DD.
function toIsoDate(v) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim())) return String(v).trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v || '').trim());
  if (!m) return null;
  let [mm, dd] = [Number(m[1]), Number(m[2])];
  if (mm > 12) [mm, dd] = [dd, mm];
  return `${m[3]}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// Desktop SnapshotForm: answers the member's record already has, matched by label.
function recordAnswers(programCode, fields, trigger) {
  const config = preVisitForProgram(programCode);
  const known = new Map();
  for (const f of [...(config.general?.top || []), ...(config.general?.payerCols || []).flat()]) known.set(f.label.toLowerCase(), f.value);
  if (trigger?.type) known.set('trigger type', trigger.type);
  if (trigger?.date) known.set('trigger date', trigger.date);
  const out = {};
  for (const field of fields) {
    const value = known.get(String(field.text).toLowerCase());
    if (value == null || value === '') continue;
    if (field.type === 'date') { const iso = toIsoDate(value); if (iso) out[field.linkId] = iso; }
    else if (field.type === 'choice') { if ((field.options || []).some(o => o.value === value)) out[field.linkId] = value; }
    else out[field.linkId] = value;
  }
  return out;
}

/**
 * A program step's form filled in on the phone. `snapshot`: the program's
 * Snapshot (desktop SnapshotForm, "<CODE> Snapshot", saved under session
 * `snapshot:<patientId>:<programId>`). Otherwise the step's assessment form
 * (desktop AssessmentFormView: the linked form, else the named one),
 * rendered with the shared form renderer and submitted through
 * submitFormResponse under session `step:<patientId>:<programId>:<stepId>`;
 * a submitted assessment marks the step Reviewed the way desktop markStep does.
 */
export function ProgramFormScreen({ patientId, programId, step, formId = null, formName, snapshot = false }) {
  const { pop } = useMobileNav();
  const program = useAppStore(s => (s.careProgramsByPatient[patientId] || []).find(p => String(p.id) === String(programId)) || null);
  const fetchFormByName = useAppStore(s => s.fetchFormByName);
  const fetchFormById = useAppStore(s => s.fetchFormById);
  const fetchFormResponseBySession = useAppStore(s => s.fetchFormResponseBySession);
  const submitFormResponse = useAppStore(s => s.submitFormResponse);
  const setProgramStepStatus = useAppStore(s => s.setProgramStepStatus);
  const logProgramActivity = useAppStore(s => s.logProgramActivity);
  const code = program?.code;
  const name = snapshot ? snapshotFormName(code) : formName;
  const sessionId = snapshot ? `snapshot:${patientId}:${programId}` : `step:${patientId}:${programId}:${step?.id}`;
  const [loaded, setLoaded] = useState(null); // { form, saved }
  const [edits, setEdits] = useState(EMPTY_ANSWERS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return undefined;
    let active = true;
    (async () => {
      const byId = !snapshot && formId ? await fetchFormById(formId).catch(() => null) : null;
      const stored = byId || await fetchFormByName(name).catch(() => null);
      const form = stored || (snapshot ? BUILT_IN[code] : null) || null;
      const saved = stored?.id ? await fetchFormResponseBySession(stored.id, sessionId).catch(() => null) : null;
      if (active) setLoaded({ form, saved });
    })();
    return () => { active = false; };
  }, [code, name, formId, snapshot, sessionId, fetchFormById, fetchFormByName, fetchFormResponseBySession]);

  const form = loaded?.form || null;
  const items = useMemo(() => form?.schema?.items || [], [form]);
  const baseline = useMemo(() => (form ? {
    ...(snapshot ? recordAnswers(code, leavesOf(items), { type: program?.triggerType, date: program?.triggerDate }) : {}),
    ...(loaded?.saved?.answers || {}),
  } : EMPTY_ANSWERS), [form, snapshot, code, items, program?.triggerType, program?.triggerDate, loaded]);
  const answers = useMemo(() => ({ ...baseline, ...edits }), [baseline, edits]);
  const onAnswer = (linkId, v) => setEdits(prev => ({ ...prev, [linkId]: v }));

  const result = useMemo(() => {
    try {
      return evaluate({ questionnaire: toQuestionnaire(items), scores: form?.scoring?.scores || [], criticalTriggers: form?.scoring?.criticalTriggers || [] }, answers);
    } catch {
      return { visibility: {}, scores: [] };
    }
  }, [items, form, answers]);
  const missing = snapshot ? [] : requiredLeaves(items, result.visibility).filter(f => !isAnswered(answers[f.linkId]));
  const leaves = leavesOf(items).filter(f => f.type !== 'display');
  const answered = leaves.filter(f => isAnswered(answers[f.linkId])).length;
  const score = (result.scores || []).reduce((a, s) => a + (typeof s.value === 'number' ? s.value : 0), 0);
  const band = (result.scores || []).find(s => s.band)?.band;
  const dirty = Object.keys(edits).length > 0;
  // A built-in Snapshot isn't in the library yet, so it has nowhere to save (desktop too).
  const canSave = !!form?.id && !busy && (snapshot ? dirty : missing.length === 0);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    const scores = snapshot ? {} : { scores: result.scores, criticalsTriggered: result.criticalsTriggered };
    const ok = await submitFormResponse(form.id, answers, scores, { sessionId, answeredCount: countAnswered(answers) }).catch(() => false);
    if (!ok) {
      setBusy(false);
      toast.error(snapshot ? 'Couldn’t save the Snapshot. Try again.' : `Couldn’t submit ${step?.name || 'the form'}. Try again.`);
      return;
    }
    if (!snapshot && step && program && step.status !== STEP_STATUS.completed) {
      await setProgramStepStatus(program.id, step, STEP_STATUS.completed).catch(() => null);
      logProgramActivity({ patientId, programCode: program.code, title: `${step.name} Marked as Reviewed`, activityKind: 'clipboard', statusLabel: 'Reviewed', statusType: 'success' });
    }
    setBusy(false);
    toast.success(snapshot ? 'Snapshot saved' : `${step?.name || 'Form'} submitted`);
    pop();
  };

  const title = snapshot ? 'Snapshot' : (step?.name || formName);
  return (
    <FormScreen
      title={title}
      subtitle={program?.name}
      footer={form && (
        <Button size="lg" fullWidth disabled={!canSave} onClick={save}>
          {snapshot ? 'Save' : missing.length ? `${missing.length} required left` : 'Submit'}
        </Button>
      )}
    >
      {!loaded ? <MobileListSkeleton count={4} height={72} /> : !form ? (
        <MobileEmpty icon="solar:document-text-linear" title={`Couldn’t load “${name}”`} />
      ) : (
        <>
          {!snapshot && (
            <p className={styles.meta}>
              {answered}/{leaves.length} answered • Score {score}
              {band && <> • <Badge size="sm" tone={['critical', 'high'].includes(band.severity) ? 'danger' : band.severity === 'warning' ? 'warning' : 'info'} variant="soft" label={band.label} /></>}
            </p>
          )}
          {snapshot && !form.id && <p className={styles.sheetMeta}>This Snapshot isn&rsquo;t in the forms library yet, so edits stay on screen only.</p>}
          {snapshot ? (
            items.filter(i => i.type === 'group').map(group => (
              <section key={group.linkId} className={styles.formSection}>
                <h2 className={styles.formSectionTitle}>{group.text}</h2>
                {(group.items || []).filter(f => f.type !== 'display').map(field => (
                  <div key={field.linkId} className={styles.formField}>
                    <span className={styles.formLabel}>{field.text}</span>
                    <FieldInput field={field} idPrefix="m-snapshot" interactive={!field.readOnly} value={answers[field.linkId]} onChange={v => onAnswer(field.linkId, v)} />
                  </div>
                ))}
              </section>
            ))
          ) : items.length === 0 ? <p className={styles.sheetMeta}>This form has no questions yet.</p> : (
            <FormRenderer embedded fields={items} scoring={form.scoring} settings={form.settings} answers={answers} onAnswer={onAnswer} compact />
          )}
        </>
      )}
    </FormScreen>
  );
}
