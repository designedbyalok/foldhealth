/**
 * Shareable form fill-view (#/f/{id}). Renders the saved form via the shared
 * FormRenderer (honoring the form's layout mode) and submits to form_responses
 * with an engine-evaluated score snapshot.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { useAppStore } from '../../../store/useAppStore';
import { evaluate } from '../scoring/evaluate';
import { toQuestionnaire } from '../builder/engineAdapter';
import { FormRenderer } from '../render/FormRenderer';
import { normalizeLayout } from '../render/layout';
import { injectGoogleFonts } from '../../email-builder/googleFonts';
import styles from './FormView.module.css';

injectGoogleFonts();

/** Collect URL params from both the search string and any `?…` after the hash. */
function readUrlParams() {
  const out = {};
  const add = (qs) => { try { new URLSearchParams(qs).forEach((v, k) => { out[k] = v; }); } catch { /* noop */ } };
  add((window.location.search || '').replace(/^\?/, ''));
  const hash = window.location.hash || '';
  const q = hash.indexOf('?');
  if (q >= 0) add(hash.slice(q + 1));
  return out;
}

function closeFormView() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/home';
}

export function FormView({ id: propId, isPublic = false }) {
  const storeFormViewId = useAppStore((s) => s.formViewId);
  const formViewId = propId ?? storeFormViewId;
  const fetchFormById = useAppStore((s) => s.fetchFormById);
  const submitFormResponse = useAppStore((s) => s.submitFormResponse);
  const savePartialResponse = useAppStore((s) => s.savePartialResponse);
  const showToast = useAppStore((s) => s.showToast);

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Drop-off tracking: one stable session id per fill (survives a refresh).
  const sessionIdRef = useRef(null);
  const submittedRef = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchFormById(formViewId).then((f) => {
      if (!active) return;
      setForm(f);
      setLoading(false);
    });
    return () => { active = false; };
  }, [formViewId, fetchFormById]);

  useEffect(() => {
    const key = `formSession:${formViewId}`;
    let sid = null;
    try { sid = sessionStorage.getItem(key); } catch { /* private mode */ }
    if (!sid) {
      sid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${formViewId}-${Math.random().toString(36).slice(2)}`;
      try { sessionStorage.setItem(key, sid); } catch { /* ignore */ }
    }
    sessionIdRef.current = sid;
    submittedRef.current = false;
  }, [formViewId]);

  // Hidden fields: prefill declared names from URL params (?mrn=…&name=… or a
  // query after the hash). Seeded values live in `answers` so recall + enableWhen
  // + scoring can use them; they're excluded from the "started" count below.
  const hiddenNames = useMemo(() => form?.settings?.hidden || [], [form]);
  const hiddenNameSet = useMemo(() => new Set(hiddenNames), [hiddenNames]);
  useEffect(() => {
    if (!form || !hiddenNames.length) return;
    const params = readUrlParams();
    const seed = {};
    hiddenNames.forEach((name) => { if (params[name] != null && params[name] !== '') seed[name] = params[name]; });
    if (Object.keys(seed).length) setAnswers((prev) => ({ ...seed, ...prev })); // user answers win
  }, [form, hiddenNames]);

  const items = useMemo(() => form?.schema?.items || [], [form]);
  const setAnswer = (linkId, v) => setAnswers((prev) => ({ ...prev, [linkId]: v }));

  // Count genuine answers (prefilled hidden fields don't count as "started").
  const countAnswered = (a) => Object.entries(a)
    .filter(([k, v]) => !hiddenNameSet.has(k) && v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .length;

  // Auto-save partial progress (debounced) from the first answer onward, so an
  // abandoned fill is recorded as an in-progress (Pending) response.
  useEffect(() => {
    if (submittedRef.current || !form?.id) return undefined;
    const answered = countAnswered(answers);
    if (answered === 0) return undefined;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (submittedRef.current) return;
      savePartialResponse(form.id, { sessionId: sessionIdRef.current, answers, answeredCount: answered });
    }, 1200);
    return () => clearTimeout(saveTimer.current);
  }, [answers, form?.id, savePartialResponse]);
  const settings = form?.settings;
  // Paged layouts show their own end screen inside FormRenderer; only the
  // entire-page layout falls back to this view's thank-you.
  const paged = normalizeLayout(settings?.layout) !== 'entire-page';

  // FormRenderer validates (per step + full form) before calling this; here we
  // just score + persist.
  const handleSubmit = async () => {
    // Stop autosave so a late debounce can't revert the row to in-progress.
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
    let ok = false;
    try {
      ok = await submitFormResponse(form.id, answers, scoreSnapshot, {
        sessionId: sessionIdRef.current,
        answeredCount: countAnswered(answers),
      });
    } finally {
      setSubmitting(false);
    }
    if (ok) {
      try { sessionStorage.removeItem(`formSession:${formViewId}`); } catch { /* ignore */ }
    } else {
      submittedRef.current = false; // let autosave resume on a failed submit
    }
    if (ok && !paged) setSubmitted(true); // paged → FormRenderer shows its end screen
    return ok;
  };

  return (
    <div className={styles.page} style={{ background: settings?.background || undefined }}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <Icon name="solar:clipboard-text-linear" size={18} color="var(--primary-300)" />
          {form?.name || 'Form'}
        </span>
        {!isPublic && <CloseButton onClick={closeFormView} />}
      </header>

      <div className={styles.scroll}>
        {loading ? (
          <div className={styles.state}>Loading…</div>
        ) : !form ? (
          <div className={styles.state}>This form could not be found.</div>
        ) : submitted ? (
          <div className={styles.sheet}>
            <div className={styles.thanks}>
              <Icon name="solar:check-circle-linear" size={40} color="var(--status-success)" />
              <h2 className={styles.title}>Thank you</h2>
              <p className={styles.desc}>Your response has been submitted.</p>
              <Button variant="outline" onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <FormRenderer
            fields={items}
            settings={settings}
            scoring={form.scoring}
            formName={form.name}
            formDescription={form.description}
            answers={answers}
            onAnswer={setAnswer}
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

export default FormView;
