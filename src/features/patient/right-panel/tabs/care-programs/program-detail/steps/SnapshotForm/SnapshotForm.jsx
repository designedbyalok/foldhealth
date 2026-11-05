import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { toast } from '../../../../../../../../components/Toast/sonnerToast';
import { CollapsibleContent } from '../../../../../../../../components/Collapsible/Collapsible';
import { FieldInput } from '../../../../../../../forms/builder/FieldInput';
import { SNP_SNAPSHOT_FORM, snapshotFormName } from '../../../../../../../forms/templates/snpSnapshotForm';
import { preVisitForProgram } from '../../../../../../data/programActivityMock';
import { AssessmentFormSkeleton } from '../AssessmentFormView/AssessmentFormSkeleton';
import styles from './SnapshotForm.module.css';

// Built-in Snapshot forms, used until the program's form is in the library.
const BUILT_IN = { SNP: SNP_SNAPSHOT_FORM };

// MM/DD/YYYY, DD/MM/YYYY or YYYY-MM-DD → YYYY-MM-DD (the date field's value), else null.
function toIsoDate(v) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim())) return String(v).trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v || '').trim());
  if (!m) return null;
  let [mm, dd] = [Number(m[1]), Number(m[2])];
  if (mm > 12) [mm, dd] = [dd, mm];
  return `${m[3]}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

// Answers taken from what the member's record already has (the program's
// General Info, and the trigger picked when the program was created),
// matched to the form's fields by label.
function recordAnswers(programCode, fields, trigger) {
  const config = preVisitForProgram(programCode);
  const known = new Map();
  for (const f of [...(config.general?.top || []), ...(config.general?.payerCols || []).flat()]) {
    known.set(f.label.toLowerCase(), f.value);
  }
  if (trigger?.type) known.set('trigger type', trigger.type);
  if (trigger?.date) known.set('trigger date', trigger.date);
  const out = {};
  for (const field of fields) {
    const value = known.get(String(field.text).toLowerCase());
    if (value == null || value === '') continue;
    if (field.type === 'date') {
      const iso = toIsoDate(value);
      if (iso) out[field.linkId] = iso;
    } else if (field.type === 'choice') {
      if ((field.options || []).some(o => o.value === value)) out[field.linkId] = value;
    } else {
      out[field.linkId] = value;
    }
  }
  return out;
}

const leavesOf = items => (items || []).flatMap(f => (f.type === 'group' ? leavesOf(f.items) : [f]));

function FormSection({ group, answers, onAnswer }) {
  const [open, setOpen] = useState(true);
  const fields = (group.items || []).filter(f => f.type !== 'display');
  return (
    <div className={styles.section}>
      <button type="button" className={styles.sectionToggle} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <DownChevronIcon size={16} color="var(--neutral-300)" className={`${styles.chevron} ${open ? '' : styles.closed}`} />
        <span className={styles.sectionTitle}>{group.text}</span>
      </button>
      <CollapsibleContent open={open}>
        <div className={styles.grid} style={{ '--snapshot-columns': group.columns || 3 }}>
          {fields.map(field => (
            <div key={field.linkId} className={styles.field}>
              <span className={styles.label}>{field.text}</span>
              <FieldInput
                field={field}
                idPrefix="snapshot"
                interactive={!field.readOnly}
                value={answers[field.linkId]}
                onChange={v => onAnswer(field.linkId, v)}
              />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </div>
  );
}

/**
 * The program's Snapshot form, editable: its sections in a grid, filled from
 * the member's record and from what was last saved for this enrollment.
 * The form is "<CODE> Snapshot" in Settings > Content > Forms (SNP has a
 * built-in one until it's seeded); a program without one renders `fallback`.
 * Edits save on their own (a moment after the last change) to
 * form_responses under session `snapshot:<patientId>:<programId>`; until the
 * form is in the library they stay on screen only.
 */
export function SnapshotForm({ programCode, patientId, programId, trigger = null, fallback = null }) {
  const fetchFormByName = useAppStore(s => s.fetchFormByName);
  const fetchFormResponseBySession = useAppStore(s => s.fetchFormResponseBySession);
  const submitFormResponse = useAppStore(s => s.submitFormResponse);
  const formName = snapshotFormName(programCode);
  const sessionId = patientId && programId ? `snapshot:${patientId}:${programId}` : null;

  const [loaded, setLoaded] = useState(null); // { key, form, saved }
  const key = `${formName}|${sessionId}`;
  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await fetchFormByName(formName).catch(() => null);
      const form = stored || BUILT_IN[programCode] || null;
      const saved = stored?.id && sessionId ? await fetchFormResponseBySession(stored.id, sessionId) : null;
      if (active) setLoaded({ key, form, saved });
    })();
    return () => { active = false; };
  }, [key, formName, programCode, sessionId, fetchFormByName, fetchFormResponseBySession]);

  const ready = loaded?.key === key;
  const form = ready ? loaded.form : null;
  const groups = useMemo(() => (form?.schema?.items || []).filter(i => i.type === 'group'), [form]);
  const baseline = useMemo(
    () => (form ? { ...recordAnswers(programCode, leavesOf(form.schema?.items), trigger), ...(loaded?.saved?.answers || {}) } : {}),
    [form, programCode, loaded, trigger],
  );
  const [edits, setEdits] = useState({ key: null, answers: {} });
  const answers = edits.key === key ? { ...baseline, ...edits.answers } : baseline;
  const dirty = edits.key === key && Object.keys(edits.answers).length > 0;
  const canSave = !!form?.id && !!sessionId;

  // Save a moment after the last edit.
  useEffect(() => {
    if (!dirty || !canSave) return undefined;
    const t = window.setTimeout(async () => {
      const answeredCount = Object.values(answers).filter(v => v !== '' && v != null).length;
      const ok = await submitFormResponse(form.id, answers, {}, { sessionId, answeredCount });
      if (!ok) toast.error?.('Couldn’t save the Snapshot. Try again.');
    }, 800);
    return () => window.clearTimeout(t);
    // `answers` is rebuilt every render; `edits` is what changes on an edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, canSave, sessionId, submitFormResponse]);

  if (!ready) return <AssessmentFormSkeleton />;
  if (!form) return fallback;

  const onAnswer = (linkId, v) => setEdits(prev => ({ key, answers: { ...(prev.key === key ? prev.answers : {}), [linkId]: v } }));

  return (
    <div className={styles.form}>
      {groups.map(group => (
        <FormSection key={group.linkId} group={group} answers={answers} onAnswer={onAnswer} />
      ))}
    </div>
  );
}
