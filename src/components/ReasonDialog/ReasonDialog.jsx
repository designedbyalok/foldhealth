import { useId, useState } from 'react';
import { Dialog, DialogContent } from '../ShadcnDialog/ShadcnDialog';
import { Select } from '../Select/Select';
import { Textarea } from '../Textarea/Textarea';
import { Button } from '../Button/Button';
import styles from './ReasonDialog.module.css';

/**
 * ReasonDialog — captures a mandatory reason for a manual compliance
 * decision (pass or fail). Spec: every Support override carries a
 * reason for HCC submission audits.
 *
 * Reason model:
 *   { code: string | null, freeText: string }
 *
 * The Select carries the standard reasons. The Textarea always allows free
 * text. The form is valid when a code is selected OR free text has content.
 *
 * @param {object}   props
 * @param {string}   props.title           – Dialog heading
 * @param {string}   props.description     – One-line context (e.g. check name)
 * @param {'pass'|'fail'} props.decision   – Which action triggered the dialog
 * @param {string[]} props.standardReasons – Per-check list of canonical reasons
 * @param {function} props.onCancel
 * @param {function} props.onSubmit        – Called with ({ code, freeText })
 */
export function ReasonDialog({
  title,
  description,
  decision = 'fail',
  standardReasons = [],
  onCancel,
  onSubmit,
}) {
  const uid = useId();
  const [code, setCode] = useState('');
  const [freeText, setFreeText] = useState('');

  const valid = !!code || freeText.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    onSubmit?.({ code: code || null, freeText: freeText.trim() });
  };

  const options = [
    { value: '', label: 'Select a reason…' },
    ...standardReasons.map((r) => ({ value: r, label: r })),
    { value: '__other__', label: 'Other (free text only)' },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel?.(); }}>
      <DialogContent className="max-w-[460px] gap-0 p-0">
        <div className={styles.body}>
          <h3 className={styles.title}>{title}</h3>
          {description && <p className={styles.description}>{description}</p>}

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-reason-code`}>Standard reason</label>
            <Select
              id={`${uid}-reason-code`}
              options={options}
              value={code === null ? '' : code}
              onChange={(v) => setCode(v === '__other__' ? '' : v)}
              placeholder="Select a reason…"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${uid}-reason-notes`}>
              Additional notes {code ? '(optional)' : <span className={styles.required}>*</span>}
            </label>
            <Textarea
              id={`${uid}-reason-notes`}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={code
                ? 'Add any context the next reviewer should see…'
                : 'Explain why you\'re overriding this check…'}
              rows={3}
            />
          </div>

          <div className={styles.footer}>
            <Button variant="secondary" size="L" onClick={onCancel}>Cancel</Button>
            <Button
              variant={decision === 'fail' ? 'danger' : 'primary'}
              size="L"
              disabled={!valid}
              onClick={submit}
            >
              {decision === 'fail' ? 'Mark Failed' : 'Mark Passed'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
