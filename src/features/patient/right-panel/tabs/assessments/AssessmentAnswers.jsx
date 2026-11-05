import { CheckboxTick } from '../../../../../components/CheckboxTick/CheckboxTick';
import { RadioButton } from '../../../../../components/RadioButton/RadioButton';
import { leafFields } from '../../../../forms/analytics/aggregate';
import { formatAnswerValue } from '../../../../forms/analytics/formAnalyticsUi';
import { isAnswered } from '../../../../forms/scoring/util';
import styles from './AssessmentDetail.module.css';

function Choices({ field, value }) {
  const multi = field.control === 'checkbox';
  const picked = new Set(Array.isArray(value) ? value : [value]);
  return (
    <div className={styles.options} role={multi ? 'group' : 'radiogroup'} aria-label={field.text} aria-readonly="true">
      {(field.options || []).map((o, i) => (multi ? (
        <span key={i} className={styles.option} role="checkbox" aria-checked={picked.has(o.value)} aria-readonly="true">
          <CheckboxTick checked={picked.has(o.value)} />
          <span className={picked.has(o.value) ? styles.optionPicked : ''}>{o.label || o.value}</span>
        </span>
      ) : (
        <RadioButton key={i} className={styles.readOnly} checked={picked.has(o.value)} label={o.label || o.value} />
      )))}
    </div>
  );
}

function Answer({ field, value }) {
  if (field.type === 'choice' && field.control !== 'dropdown' && field.control !== 'rating') {
    return <Choices field={field} value={value} />;
  }
  return isAnswered(value)
    ? <p className={styles.answerText}>{formatAnswerValue(value)}</p>
    : <p className={styles.unanswered}>Not answered</p>;
}

/** A form's questions, numbered, with this response's answers. Read-only. */
export function AssessmentAnswers({ fields, answers }) {
  const numbers = new Map(leafFields(fields).map((f, i) => [f.linkId, i + 1]));
  const render = list => (list || []).map((f) => {
    if (f.type === 'group') {
      return (
        <section key={f.linkId} className={styles.section}>
          {f.text && <h4 className={styles.sectionTitle}>{f.text}</h4>}
          {render(f.items)}
        </section>
      );
    }
    if (f.type === 'display') return <p key={f.linkId} className={styles.displayText}>{f.text}</p>;
    return (
      <div key={f.linkId} className={styles.question}>
        <span className={styles.questionText}>{numbers.get(f.linkId)}. {f.text}</span>
        <Answer field={f} value={answers?.[f.linkId]} />
      </div>
    );
  });
  if (!fields?.length) return <p className={styles.unanswered}>This form has no questions.</p>;
  return <div className={styles.questions}>{render(fields)}</div>;
}
