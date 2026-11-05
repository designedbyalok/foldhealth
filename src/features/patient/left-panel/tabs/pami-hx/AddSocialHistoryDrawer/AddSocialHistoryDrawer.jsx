import { useEffect, useId, useRef, useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Select } from '../../../../../../components/Select/Select';
import { Input } from '../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../components/Textarea/Textarea';
import { RadioButton } from '../../../../../../components/RadioButton/RadioButton';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { CollapsibleSection } from '../../../../../../components/CollapsibleSection/CollapsibleSection';
import { useAppStore } from '../../../../../../store/useAppStore';
import { FormRenderer } from '../../../../../forms/render/FormRenderer';
import { SOCIAL_HISTORY_SECTIONS, isValidNumberAnswer, normalizeSocialAnswers } from '../../../../../../reference-data/socialHistoryQuestionnaire';
import styles from '../AddProblemsDrawer/AddProblemsDrawer.module.css';

// How long typing pauses before a text answer saves. Choices save at once.
const TEXT_SAVE_DELAY = 600;

const asOptions = (list) => list.map(v => ({ value: v, label: v }));

// Icons sit here rather than in the questionnaire, which is data only.
// Tobacco, SDOH and the wine glass are our own custom icons (the wine glass is
// the same one as the History card); Exercise is Solar's.
const SECTION_ICONS = {
  tobacco: 'custom:tobacco',
  exercise: 'solar:running-linear',
  sdoh: 'custom:sdoh',
  substances: 'custom:social-history',
};

/**
 * A free-text answer. Saves once typing pauses, and again on blur or when the
 * drawer closes, so nothing typed is lost to a pending timer.
 */
function TextAnswer({ id, label, value, onSave }) {
  const [text, setText] = useState(value || '');
  const timer = useRef(null);
  const pending = useRef(null);

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current != null) {
      onSave(pending.current);
      pending.current = null;
    }
  };

  // Flush on unmount; `flush` reads refs, so the latest value is what saves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => flush, []);

  const change = (next) => {
    setText(next);
    pending.current = next.trim();
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, TEXT_SAVE_DELAY);
  };

  return (
    <div className={styles.qField}>
      {label && <label className={styles.qLabel} htmlFor={id}>{label}</label>}
      <Textarea
        id={id}
        rows={3}
        value={text}
        placeholder=""
        onChange={e => change(e.target.value)}
        onBlur={flush}
      />
    </div>
  );
}

/**
 * A typed whole number with bounds (days of exercise a week, 0 to 7). Saves on
 * the same pause as text, but only a valid value: an out-of-range entry shows
 * the error and leaves the last good answer stored.
 */
function NumberAnswer({ question, value, onSave }) {
  const [text, setText] = useState(value ?? '');
  const timer = useRef(null);
  const pending = useRef(null);
  const valid = isValidNumberAnswer(question, text);

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current != null) {
      onSave(pending.current);
      pending.current = null;
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => flush, []);

  const change = (next) => {
    setText(next);
    clearTimeout(timer.current);
    if (!isValidNumberAnswer(question, next)) { pending.current = null; return; }
    pending.current = next.trim() === '' ? '' : String(Number(next.trim()));
    timer.current = setTimeout(flush, TEXT_SAVE_DELAY);
  };

  return (
    <Input
      label={question.label}
      value={text}
      inputMode="numeric"
      placeholder={`${question.min ?? 0}–${question.max}`}
      onChange={e => change(e.target.value)}
      onBlur={flush}
      errorText={valid ? undefined : `Enter a whole number from ${question.min ?? 0} to ${question.max}`}
    />
  );
}

/** One choice, with every option laid out under the question like a paper form. */
function RadioAnswer({ question, value, onSave }) {
  const labelId = useId();
  return (
    <div className={styles.qField}>
      <span className={styles.qLabel} id={labelId}>{question.label}</span>
      <div className={styles.qRadios} role="radiogroup" aria-labelledby={labelId}>
        {question.options.map(opt => (
          <RadioButton
            key={opt}
            label={opt}
            value={opt}
            name={question.id}
            checked={value === opt}
            onChange={() => onSave(opt)}
          />
        ))}
      </div>
    </div>
  );
}

function Question({ question, answers, onSave }) {
  const fieldId = useId();
  const value = answers[question.id];
  const save = (v) => onSave(question.id, v);

  if (question.type === 'text') {
    return <TextAnswer id={fieldId} label={question.label} value={value} onSave={save} />;
  }
  if (question.type === 'radio') {
    return <RadioAnswer question={question} value={value} onSave={save} />;
  }
  if (question.type === 'number') {
    return <NumberAnswer question={question} value={value} onSave={save} />;
  }
  const multiple = question.type === 'multi';
  return (
    <Select
      portal
      label={question.label}
      options={asOptions(question.options)}
      value={multiple ? (Array.isArray(value) ? value : []) : (value || '')}
      onValueChange={save}
      multiple={multiple}
      checkboxes={multiple}
      badges={multiple}
      placeholder="Select"
    />
  );
}

/**
 * Social History: the questionnaire the Fold QA app asks (Tobacco,
 * Exercise, SDOH, and Alcohol and other substances), defined in
 * src/reference-data/socialHistoryQuestionnaire.js.
 *
 * Every section is stacked as a collapsible card. The first opens on its own
 * and the rest start folded, so the drawer opens on one short form. SDOH and AUDIT-C render as forms: the
 * same locked fields the Form Builder offers (src/reference-data/
 * sdohScreening.js, validatedInstruments.js).
 *
 * Like the source form there is no Save button: each answer saves as it is
 * given, and closing the drawer keeps everything.
 *
 * @param {string}   props.patientId
 * @param {function} props.onClose
 */
export function AddSocialHistoryDrawer({ patientId, onClose }) {
  const record = useAppStore(s => (patientId ? s.patientSocialHistory[patientId] : null));
  const loadedFor = useAppStore(s => (patientId ? s.patientSocialHistoryLoadedFor[patientId] : false));
  const fetchPatientSocialHistory = useAppStore(s => s.fetchPatientSocialHistory);
  const savePatientSocialHistory = useAppStore(s => s.savePatientSocialHistory);

  useEffect(() => {
    if (patientId) fetchPatientSocialHistory(patientId);
  }, [patientId, fetchPatientSocialHistory]);

  const loading = !!patientId && !loadedFor;
  const answers = record?.answers || {};

  const saveAnswer = (questionId, value) => savePatientSocialHistory(patientId, { answers: { [questionId]: value } });

  return (
    <Drawer title="Social History" onClose={onClose}>
      <div className={styles.body}>
        {loading ? (
          <CardSkeleton rows={6} />
        ) : (
          SOCIAL_HISTORY_SECTIONS.map((sec, i) => (
            <CollapsibleSection key={sec.id} icon={SECTION_ICONS[sec.id]} title={sec.title} defaultOpen={i === 0}>
              {/* SDOH and AUDIT-C are the Form Builder's own fields, drawn by
                  the form renderer and keyed by the drawer's answer ids; any
                  other questions in the section follow as before. */}
              {sec.form && (
                <FormRenderer embedded fields={sec.form} answers={normalizeSocialAnswers(answers)} onAnswer={saveAnswer} />
              )}
              {sec.questions.filter(q => q.type !== 'form').map(q => (
                <Question key={q.id} question={q} answers={answers} onSave={saveAnswer} />
              ))}
            </CollapsibleSection>
          ))
        )}
      </div>
    </Drawer>
  );
}
