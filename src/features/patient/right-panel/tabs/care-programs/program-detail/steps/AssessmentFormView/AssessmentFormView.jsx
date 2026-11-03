import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { FieldInput } from '../../../../../../../forms/builder/FieldInput';
import { evaluate } from '../../../../../../../forms/scoring/evaluate';
import { toQuestionnaire } from '../../../../../../../forms/builder/engineAdapter';
import { isVisible } from '../../../../../../../forms/render/layout';
import { resolveRecall } from '../../../../../../../forms/render/recall';
import { isAnswered } from '../../../../../../../forms/scoring/util';
import { SEVERITY } from '../../../../../../../forms/scoring/types';
import { AssessmentFormSkeleton } from './AssessmentFormSkeleton';
import styles from './AssessmentFormView.module.css';

// Stable identity for "no answers yet" so the scoring/visibility memos below
// don't re-run on every render before the first answer is given.
const EMPTY_ANSWERS = {};

// Answerable leaves only: groups just nest, display blocks aren't answers.
function flattenLeaves(items) {
  const leaves = [];
  const walk = (arr) => (arr || []).forEach(f => {
    if (f.type === 'group') walk(f.items);
    else if (f.type !== 'display') leaves.push(f);
  });
  walk(items);
  return leaves;
}

// A plausible non-empty value per field type, used to seed `prefill` so a
// reviewer sees an already-answered assessment instead of a blank one.
function defaultAnswerFor(field) {
  switch (field.type) {
    case 'boolean': return true;
    case 'integer':
    case 'decimal': return 0;
    case 'date': return new Date().toISOString().slice(0, 10);
    case 'choice': {
      const first = field.options?.[0]?.value;
      return field.control === 'checkbox' ? (first ? [first] : []) : (first ?? '');
    }
    default: return 'N/A';
  }
}

// Recursively render the saved form's fields exactly as defined: sections,
// display blocks, and numbered leaf questions (numbering only the answerable
// leaves, matching the Review view). Branching (visibility) and recall (piped
// text) are honored via the shared form engine.
function renderNode(field, ctx) {
  if (!isVisible(field.linkId, ctx.visibility)) return null;
  if (field.type === 'group') {
    return (
      <div key={field.linkId} className={styles.section}>
        {field.text ? <div className={styles.sectionTitle}>{ctx.pipe(field.text)}</div> : null}
        {(field.items || []).map(sub => renderNode(sub, ctx))}
      </div>
    );
  }
  if (field.type === 'display') {
    return (
      <div key={field.linkId} className={styles.display}>
        <FieldInput field={field} interactive={false} />
      </div>
    );
  }
  const n = (ctx.counter.n += 1);
  return (
    <div key={field.linkId} className={styles.question}>
      <div className={styles.qHead}>
        <span className={styles.qNum}>{n}.</span>
        <span className={styles.qText}>
          {ctx.pipe(field.text)}
          {field.required ? <span className={styles.req}> *</span> : null}
        </span>
      </div>
      <div className={styles.qControl}>
        <FieldInput
          field={field}
          interactive
          value={ctx.answers[field.linkId]}
          onChange={(v) => ctx.onAnswer(field.linkId, v)}
        />
      </div>
    </div>
  );
}

/**
 * Renders the form saved under `formName` (from Settings → Content → Forms),
 * or the one with `formId` when given (a step linked to a form keeps working
 * if the form is renamed),
 * inside the program window, in the Review layout: a stats strip (progress /
 * score / interpretation) above the form's own questions.
 *
 * `fallbackForm` is used when the named form is missing from Content → Forms
 * (e.g. the TOC queue drawer rendering PHQ-9 from the validated instrument).
 */
export function AssessmentFormView({
  formId = null,
  formName,
  interpretation = 'High Risk',
  fallbackForm = null,
  initialAnswers = null,
  onAnswersChange,
  hideStats = false,
  prefill = false,
}) {
  const fetchFormByName = useAppStore(s => s.fetchFormByName);
  const fetchFormById = useAppStore(s => s.fetchFormById);
  const [form, setForm] = useState(null);
  // Which form the loaded `form` belongs to. `loading` is derived from it
  // rather than set at the top of the fetch effect, so switching forms shows
  // the loading state without a synchronous setState during the effect.
  const [loadedFor, setLoadedFor] = useState(null);
  const loading = loadedFor !== formName;
  // Answers keyed by form name, so pointing at a different form starts from a
  // clean sheet without an explicit reset. `initialAnswers` seeds the map on
  // mount: used by the TOC drawer to show an already-filled assessment.
  const [answersByForm, setAnswersByForm] = useState(() =>
    initialAnswers ? { [formName]: initialAnswers } : {},
  );
  const answers = answersByForm[formName] ?? EMPTY_ANSWERS;

  useEffect(() => {
    let active = true;
    (formId ? fetchFormById(formId).then(f => f || fetchFormByName(formName)) : fetchFormByName(formName))
      .then(f => {
        if (!active) return;
        setForm(f || fallbackForm || null);
        setLoadedFor(formName);
      })
      .catch(() => {
        if (!active) return;
        setForm(fallbackForm || null);
        setLoadedFor(formName);
      });
    return () => { active = false; };
  }, [formId, formName, fetchFormById, fetchFormByName, fallbackForm]);

  const items = useMemo(() => form?.schema?.items || [], [form]);

  // Seed a fully-answered demo state once, on load, never overwrites a
  // form that already has answers (prefilled or user-edited), and never
  // goes through onAnswer/onAnswersChange so Save stays disabled until the
  // reviewer actually touches a question.
  useEffect(() => {
    if (!prefill || items.length === 0) return;
    setAnswersByForm(prev => {
      if (prev[formName]) return prev;
      const filled = {};
      flattenLeaves(items).forEach(f => { filled[f.linkId] = defaultAnswerFor(f); });
      return { ...prev, [formName]: filled };
    });
  }, [prefill, items, formName]);

  const onAnswer = (linkId, v) => {
    setAnswersByForm(prev => ({ ...prev, [formName]: { ...(prev[formName] ?? {}), [linkId]: v } }));
    onAnswersChange?.();
  };

  const evalResult = useMemo(() => {
    try {
      return evaluate(
        { questionnaire: toQuestionnaire(items), scores: form?.scoring?.scores || [], criticalTriggers: form?.scoring?.criticalTriggers || [] },
        answers,
      );
    } catch {
      return { visibility: {}, scores: [] };
    }
  }, [items, form, answers]);

  const visibility = evalResult.visibility;
  const pipe = (text) => resolveRecall(text, { answers, scores: {}, hidden: answers });

  const { total, answered } = useMemo(() => {
    const leaves = flattenLeaves(items);
    return { total: leaves.length, answered: leaves.filter(f => isAnswered(answers[f.linkId])).length };
  }, [items, answers]);

  const score = useMemo(
    () => (evalResult.scores || []).reduce((a, s) => a + (typeof s.value === 'number' ? s.value : 0), 0),
    [evalResult],
  );
  const scoredBand = (evalResult.scores || []).find(s => s.band)?.band;
  const interpLabel = scoredBand?.label || interpretation;
  const interpTone = scoredBand
    ? (scoredBand.severity === SEVERITY.CRITICAL || scoredBand.severity === SEVERITY.HIGH
      ? 'danger'
      : scoredBand.severity === SEVERITY.WARNING ? 'warning'
      : scoredBand.severity === SEVERITY.INFO ? 'info'
      : 'neutral')
    : 'danger';

  if (loading) return <AssessmentFormSkeleton />;
  if (!form) {
    return (
      <div className={styles.state}>
        Couldn’t load “{formName}”. Make sure it exists in Settings → Content → Forms.
      </div>
    );
  }

  const pct = total ? Math.round((answered / total) * 100) : 0;
  const ctx = { visibility, pipe, answers, onAnswer, counter: { n: 0 } };

  return (
    <div className={styles.wrap}>
      {/* Stats strip */}
      {!hideStats && (
        <div className={styles.strip}>
          <span className={styles.stripItem}>
            Questions Answered :
            <span className={styles.progressTrack}><span className={styles.progressFill} style={{ width: `${pct}%` }} /></span>
            <span className={styles.stripValue}>{answered}/{total}</span>
          </span>
          <span className={styles.stripDot} />
          <span className={styles.stripItem}>Assessment Score: <span className={styles.stripValue}>{score}</span></span>
          <span className={styles.stripDot} />
          <span className={styles.stripItem}>Interpretation Score : <Badge tone={interpTone} size="sm" label={interpLabel} /></span>
        </div>
      )}

      {/* Form questions: rendered from the saved definition */}
      <div className={styles.formScroll}>
        {items.length === 0
          ? <p className={styles.state}>This form has no questions yet.</p>
          : items.map(f => renderNode(f, ctx))}
      </div>
    </div>
  );
}
