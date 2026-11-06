import { useMemo, useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import form from '../patient/patientForm.module.css';
import styles from './users.module.css';

/**
 * The phone's multi-select field (desktop `Select multiple checkboxes`): a
 * picker-styled button that opens a bottom sheet of check rows, with search
 * once the list is long. Picks apply when the sheet's Done is tapped.
 */
export function MultiPickerField({ label, required, hint, options, value, onChange, placeholder = 'Select', disabled }) {
  const [open, setOpen] = useState(false);
  const summary = value.length > 2 ? `${value.slice(0, 2).join(', ')} +${value.length - 2}` : value.join(', ');
  return (
    <div className={form.field}>
      <span className={form.fieldLabel}>
        {label}
        {required && <span className={form.required} aria-hidden="true" />}
      </span>
      <button
        type="button"
        className={form.picker}
        aria-label={`${label}: ${value.length ? value.join(', ') : placeholder}`}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className={value.length ? form.pickerValue : form.pickerPlaceholder}>{value.length ? summary : placeholder}</span>
        <Icon name="solar:alt-arrow-down-linear" size={20} color="currentColor" />
      </button>
      {hint && <span className={styles.fieldHint}>{hint}</span>}
      {open && (
        <MultiPickSheet
          title={label}
          options={options}
          value={value}
          onDone={(next) => { onChange(next); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function MultiPickSheet({ title, options, value, onDone, onClose }) {
  const [picked, setPicked] = useState(value);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const toggle = (o) => setPicked(p => (p.includes(o) ? p.filter(x => x !== o) : [...p, o]));
  const pickedSet = new Set(picked);
  const done = () => {
    const optionSet = new Set(options);
    onDone(options.filter(o => pickedSet.has(o)).concat(picked.filter(p => !optionSet.has(p))));
  };
  return (
    <BottomSheet title={title} onClose={onClose}>
      {options.length > 8 && (
        <Input
          leadingIcon="solar:magnifer-linear"
          size="lg"
          type="search"
          placeholder="Search"
          enterKeyHint="search"
          aria-label={`Search ${title}`}
          value={query}
          onValueChange={setQuery}
        />
      )}
      <div className={form.choices} role="group" aria-label={title}>
        {shown.map(o => (
          <button key={o} type="button" role="checkbox" aria-checked={pickedSet.has(o)} className={form.choice} onClick={() => toggle(o)}>
            <span className={form.choiceText}><span className={form.choiceLabel}>{o}</span></span>
            {pickedSet.has(o) && <Icon name="solar:check-circle-linear" size={24} color="var(--primary-300)" />}
          </button>
        ))}
        {shown.length === 0 && <p className={styles.muted}>Nothing matches.</p>}
      </div>
      <Button size="lg" onClick={done}>
        Done{picked.length ? ` (${picked.length})` : ''}
      </Button>
    </BottomSheet>
  );
}
