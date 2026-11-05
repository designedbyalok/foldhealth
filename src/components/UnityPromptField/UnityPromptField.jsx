import { Textarea } from '../Textarea/Textarea';
import { Button } from '../Button/Button';
import { UnityIcon } from '../UnityIcon/UnityIcon';
import styles from './UnityPromptField.module.css';

/**
 * UnityPromptField: a plain-English request to UnityAI: a labelled textarea
 * with the Unity mark, a character counter and the action that sends it.
 * The host does the generating; this owns the input, the "Try …" example
 * that fills it, and Cmd/Ctrl+Enter to submit.
 *
 * @param {string}   props.label
 * @param {string}   props.value
 * @param {function} props.onChange       – (text) => void
 * @param {function} props.onSubmit       – (trimmedText) => void
 * @param {string}   [props.placeholder]
 * @param {string}   [props.example]      – shown while empty; a click fills the field with it
 * @param {string}   [props.actionLabel='Generate']
 * @param {string}   [props.generatingLabel='Generating…']
 * @param {boolean}  [props.generating]   – locks the field and shows `generatingLabel`
 * @param {string}   [props.error]        – shown below in the error style
 * @param {string}   [props.hint]         – shown below when there's no error
 * @param {number}   [props.maxLength=1000]
 * @param {number}   [props.minLength=10] – the action stays off until the text is this long
 * @param {number}   [props.rows=3]
 */
export function UnityPromptField({
  label,
  value,
  onChange,
  onSubmit,
  placeholder,
  example,
  actionLabel = 'Generate',
  generatingLabel = 'Generating…',
  generating = false,
  error,
  hint,
  maxLength = 1000,
  minLength = 10,
  rows = 3,
}) {
  const ready = !generating && value.trim().length >= minLength;
  const submit = () => { if (ready) onSubmit?.(value.trim()); };

  return (
    <div className={styles.field}>
      <Textarea
        title={(
          <span className={styles.title}>
            <UnityIcon size={16} color="var(--primary-300)" />
            {label}
          </span>
        )}
        value={value}
        onValueChange={text => onChange?.(text.slice(0, maxLength))}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        invalid={error}
        supportingText={error || hint}
        disabled={generating}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        aria-label={label}
      />
      <div className={styles.actions}>
        {example && !value.trim() && !generating ? (
          <button type="button" className={styles.example} onClick={() => onChange?.(example)}>
            <span className={styles.exampleLabel}>Try:</span> {example}
          </button>
        ) : <span />}
        <Button
          variant="outline"
          size="sm"
          leadingIconElement={<UnityIcon size={14} color="currentColor" />}
          disabled={!ready}
          onClick={submit}
        >
          {generating ? generatingLabel : actionLabel}
        </Button>
      </div>
    </div>
  );
}
