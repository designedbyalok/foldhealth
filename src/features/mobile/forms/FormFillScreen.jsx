import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { evaluate } from '../../forms/scoring/evaluate';
import { toQuestionnaire } from '../../forms/builder/engineAdapter';
import { FormRenderer } from '../../forms/render/FormRenderer';
import { normalizeLayout } from '../../forms/render/layout';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import common from '../mobile.module.css';
import styles from './forms.module.css';

const answeredCount = (a) => Object.values(a)
  .filter(v => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)).length;

/**
 * Fill a form on the phone: the same FormRenderer, autosave
 * (savePartialResponse) and scored submit (submitFormResponse) as the
 * desktop fill view (forms/view/FormView).
 */
export function FormFillScreen({ id, name }) {
  const { pop } = useMobileNav();
  const fetchFormById = useAppStore(s => s.fetchFormById);
  const submitFormResponse = useAppStore(s => s.submitFormResponse);
  const savePartialResponse = useAppStore(s => s.savePartialResponse);
  const showToast = useAppStore(s => s.showToast);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const sessionIdRef = useRef(null);
  const submittedRef = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    let active = true;
    fetchFormById(id).then((f) => { if (active) { setForm(f); setLoading(false); } });
    return () => { active = false; };
  }, [id, fetchFormById]);

  // One session per fill, kept across a reload like desktop.
  useEffect(() => {
    const key = `formSession:${id}`;
    let sid = null;
    try { sid = sessionStorage.getItem(key); } catch { /* private mode */ }
    if (!sid) {
      sid = crypto?.randomUUID ? crypto.randomUUID() : `${id}-${Math.random().toString(36).slice(2)}`;
      try { sessionStorage.setItem(key, sid); } catch { /* ignore */ }
    }
    sessionIdRef.current = sid;
    submittedRef.current = false;
  }, [id]);

  const items = useMemo(() => form?.schema?.items || [], [form]);
  useEffect(() => {
    if (submittedRef.current || !form?.id) return undefined;
    const n = answeredCount(answers);
    if (n === 0) return undefined;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!submittedRef.current) savePartialResponse(form.id, { sessionId: sessionIdRef.current, answers, answeredCount: n });
    }, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [answers, form?.id, savePartialResponse]);

  const paged = normalizeLayout(form?.settings?.layout) !== 'entire-page';
  const handleSubmit = async () => {
    submittedRef.current = true;
    clearTimeout(saveTimer.current);
    setSubmitting(true);
    let scoreSnapshot = {};
    try {
      const result = evaluate(
        { questionnaire: toQuestionnaire(items), scores: form.scoring?.scores || [], criticalTriggers: form.scoring?.criticalTriggers || [] },
        answers,
      );
      scoreSnapshot = { scores: result.scores, criticalsTriggered: result.criticalsTriggered };
    } catch { /* submit answers even if scoring fails */ }
    const ok = await submitFormResponse(form.id, answers, scoreSnapshot, { sessionId: sessionIdRef.current, answeredCount: answeredCount(answers) })
      .finally(() => setSubmitting(false));
    if (ok) {
      try { sessionStorage.removeItem(`formSession:${id}`); } catch { /* ignore */ }
    } else {
      submittedRef.current = false;
      showToast?.('Could not submit the form. Try again.');
    }
    if (ok && !paged) setSubmitted(true);
    return ok;
  };

  return (
    <div className={common.screen}>
      <MobileSubHeader title={form?.name || name || 'Form'} />
      <div className={`${common.body} ${styles.fillBody}`}>
        {loading ? <MobileListSkeleton count={4} /> : !form ? (
          <MobileEmpty icon="solar:clipboard-remove-linear" title="This form could not be found" />
        ) : submitted ? (
          <div className={styles.thanks}>
            <Icon name="solar:check-circle-linear" size={48} color="var(--status-success)" />
            <h2 className={styles.thanksTitle}>Thank you</h2>
            <p className={styles.sub}>Your response has been submitted.</p>
            <Button size="lg" variant="outline" onClick={pop}>Done</Button>
          </div>
        ) : (
          <FormRenderer
            fields={items}
            settings={form.settings}
            scoring={form.scoring}
            formName={form.name}
            formDescription={form.description}
            answers={answers}
            onAnswer={(linkId, v) => setAnswers(prev => ({ ...prev, [linkId]: v }))}
            onSubmit={handleSubmit}
            submitting={submitting}
            scope="standalone"
            onValidationFail={(n) => showToast?.(`Please answer ${n} required field${n === 1 ? '' : 's'}`)}
          />
        )}
      </div>
    </div>
  );
}
