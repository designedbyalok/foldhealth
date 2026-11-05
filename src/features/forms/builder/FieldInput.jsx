/**
 * Renders a single form field as its actual input, using the shared Fold
 * component primitives (Input, Textarea, Select, DatePicker, RadioButton,
 * Checkbox). Used both on the builder canvas (interactive=false → inert) and
 * in the live Preview tab (interactive=true → wired to answers).
 */
import { useState } from 'react';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Select } from '../../../components/Select/Select';
import { DatePicker } from '../../../components/DatePicker/DatePicker';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { RatingInput } from '../../../components/RatingInput/RatingInput';
import { toggleMultiChoice } from './multiChoice';
import { ratingElement, ratingAnchors, npsGroup, NPS_TONE, DEFAULT_RATING_FILL } from './rating';
import styles from './FormBuilder.module.css';

/**
 * A Rating question. Unlike the other fields it stays usable on the builder
 * canvas: a slider shows a handle, and a handle that cannot be dragged reads
 * as broken. There the drag is a try-it preview held in local state, nothing
 * is recorded, since the canvas is not where a form is answered. In Preview
 * and the live form it reports answers as usual.
 */
function RatingField({ field, value, onChange, interactive, name }) {
  const [tryValue, setTryValue] = useState('');
  const element = ratingElement(field.ratingElement);
  const points = (field.options || []).map((o) => ({ value: o.value, label: o.label || o.value }));
  return (
    <RatingInput
      look={element.look}
      thumb={element.thumb}
      points={points}
      value={interactive ? (value ?? '') : tryValue}
      onChange={interactive ? (v) => onChange?.(v) : setTryValue}
      fillColor={field.fillColor || DEFAULT_RATING_FILL}
      showScale={field.showRatingScale !== false}
      anchors={ratingAnchors(field)}
      toneOf={(i) => NPS_TONE[npsGroup(Number(points[i].value))]}
      name={name}
      ariaLabel={field.text}
    />
  );
}

export function FieldInput({ field, value, onChange, interactive = false, idPrefix = 'f', className }) {
  const disabled = !interactive;
  const set = (v) => interactive && onChange?.(v);
  const id = `${idPrefix}-${field.linkId}`;
  const opts = field.options || [];

  switch (field.type) {
    case 'text':
      return (
        <Textarea
          className={[styles.ctl, className].filter(Boolean).join(' ')}
          rows={3}
          placeholder={field.placeholder || 'Type your answer here…'}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => set(e.target.value)}
        />
      );

    case 'integer':
    case 'decimal': {
      const input = (
        <Input
          className={[styles.ctl, className].filter(Boolean).join(' ')}
          type="number"
          step={field.type === 'decimal' ? '0.01' : '1'}
          placeholder={field.placeholder || '0'}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
      return field.control === 'currency' ? (
        <div className={styles.fiInputWrap}>
          <span className={styles.fiPrefix}>$</span>
          <Input
            className={styles.fiCurrencyInput}
            type="number"
            step="0.01"
            placeholder={field.placeholder || '0.00'}
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
      ) : input;
    }

    case 'date':
      return <DatePicker value={value ?? ''} onSelect={set} disabled={disabled} id={id} />;

    case 'boolean':
      return (
        <label className={styles.fiCheckRow}>
          <Checkbox checked={!!value} disabled={disabled} onCheckedChange={(c) => set(!!c)} />
          <span>{field.consentLabel || field.text}</span>
        </label>
      );

    case 'display':
      return field.control === 'image'
        ? <div className={styles.fiImage}>Image</div>
        : <p className={styles.fiParagraph}>{field.text}</p>;

    case 'choice': {
      if (field.control === 'consent') {
        return (
          <div className={styles.fiOptions}>
            {opts.map((o, i) => {
              const checked = value === o.value;
              return (
                <label key={i} className={styles.fiOptionRow}>
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(nextChecked) => set(nextChecked ? o.value : '')}
                  />
                  <span>{o.label || o.value}</span>
                </label>
              );
            })}
          </div>
        );
      }
      if (field.control === 'rating') {
        return <RatingField field={field} value={value} onChange={onChange} interactive={interactive} name={id} />;
      }
      if (field.control === 'dropdown') {
        return (
          <Select
            className={styles.ctl}
            placeholder="Select an option"
            value={value ?? ''}
            disabled={disabled}
            options={opts.map((o) => ({ value: o.value, label: o.label || o.value }))}
            onValueChange={set}
          />
        );
      }
      const multi = field.control === 'checkbox';
      const arr = Array.isArray(value) ? value : [];
      const selected = new Set(arr);
      return (
        <div className={styles.fiOptions}>
          {opts.map((o, i) => {
            const checked = multi ? selected.has(o.value) : value === o.value;
            if (multi) {
              return (
                <label key={i} className={styles.fiOptionRow}>
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={() => set(toggleMultiChoice(arr, opts, o.value))}
                  />
                  <span>{o.label || o.value}</span>
                </label>
              );
            }
            return (
              <RadioButton
                key={i}
                name={id}
                value={o.value}
                label={o.label || o.value}
                checked={checked}
                disabled={disabled}
                onChange={() => set(o.value)}
              />
            );
          })}
        </div>
      );
    }

    case 'string':
    default:
      return (
        <Input
          className={[styles.ctl, className].filter(Boolean).join(' ')}
          type={field.control === 'email' ? 'email' : field.control === 'tel' ? 'tel' : 'text'}
          placeholder={field.placeholder || 'Type your answer here…'}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => set(e.target.value)}
        />
      );
  }
}
