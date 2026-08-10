import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Button } from '../../../components/Button/Button';
import styles from './AccountPanel.module.css';

const EMPTY_STRING_ARRAY = [];

const LOCATION_OPTIONS_FALLBACK = ['SEB Office', 'Downtown Clinic', 'AstranaCare Centennial Hills', 'Valley Medical Center', 'Sunrise Health', 'Palm Desert Office', 'Riverside Clinic', 'Carson City Center'];

// Hook the user drawers use to pull practice-location names from the store.
// Fires the fetch on first mount so opening a drawer before the Locations
// tab still hydrates the dropdown.
export function useLocationNames() {
  const locations = useAppStore(s => s.practiceLocations);
  const fetched   = useAppStore(s => s.practiceLocationsFetched);
  const fetchLocations = useAppStore(s => s.fetchPracticeLocations);
  useEffect(() => { if (!fetched) fetchLocations(); }, [fetched, fetchLocations]);
  return locations.length ? locations.map(l => l.name) : LOCATION_OPTIONS_FALLBACK;
}

/* Tag input helper — renders removable badges inside an input-like container */
export function TagInput({ value = [], onChange, placeholder, inputId }) {
  const [inputVal, setInputVal] = useState('');
  const addTag = () => {
    const v = inputVal.trim();
    if (v && !value.includes(v)) { onChange([...value, v]); setInputVal(''); }
  };
  const removeTag = (tag) => onChange(value.filter(t => t !== tag));
  return (
    <div className={styles.tagInput}>
      {value.map(tag => (
        <span key={tag} className={styles.tag}>
          {tag}
          <CloseButton size={10} onClick={() => removeTag(tag)} className={styles.tagClose} label="Remove" />
        </span>
      ))}
      <input
        id={inputId}
        className={styles.tagInputField}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
        placeholder={value.length === 0 ? placeholder : ''}
      />
    </div>
  );
}

/* ── Multi-select helper (checkbox list inside a select-like container) ── */
export function MultiSelectField({ label, required, options, value = EMPTY_STRING_ARRAY, onChange }) {
  const [open, setOpen] = useState(false);
  // Anchor rect drives the portalled dropdown's position. Recomputed on
  // open + on scroll/resize so it tracks the trigger correctly when the
  // form scrolls underneath.
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const popRef = useRef(null);

  const measure = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setRect(r);
  };
  useEffect(() => {
    if (!open) return undefined;
    measure();
    const onScroll = () => measure();
    const close = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const toggle = (opt) => {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  };
  const valueSet = useMemo(() => new Set(value), [value]);
  return (
    <div className={styles.formField}>
      {/* Not a <label>: the trigger below is a div, which htmlFor can't target. */}
      <span className={styles.formLabel}>{label} {required && <span className={styles.required}>*</span>}</span>
      <div ref={triggerRef} style={{ position: 'relative' }}>
        <div className={styles.tagInput} onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
          {value.length > 0 ? value.map(v => (
            <span key={v} className={styles.tag}>
              {v}
              <CloseButton size={10} onClick={e => { e.stopPropagation(); toggle(v); }} className={styles.tagClose} label="Remove" />
            </span>
          )) : <span style={{ color: 'var(--neutral-200)', fontSize: 14 }}>Select...</span>}
          <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </div>
      </div>
      {/* Portal the dropdown out to document.body with fixed positioning
          so the surrounding .inviteFormScroll's overflow:auto never
          clips it. */}
      {open && rect && createPortal(
        <div
          ref={popRef}
          className={styles.multiSelectDropdown}
          style={{
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
          }}
        >
          {options.map(opt => (
            <label key={opt} className={styles.multiSelectOption}>
              <input type="checkbox" checked={valueSet.has(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ── Inline Audit Log for User Profile ── */
/* ── Add Column Dropdown for Bulk Import ── */
export function AddColumnDropdown({ available, labels, onAdd, onClose }) {
  const [selected, setSelected] = useState([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div className={styles.addColDropdown}>
        {available.map(col => (
          <label key={col} className={styles.addColOption}>
            <input type="checkbox" checked={selectedSet.has(col)} onChange={() => setSelected(prev => {
              const next = new Set(prev);
              if (next.has(col)) next.delete(col);
              else next.add(col);
              return [...next];
            })} />
            <span>{labels[col] || col}</span>
          </label>
        ))}
        {available.length === 0 && <div style={{ padding: 12, color: 'var(--neutral-300)', fontSize: 13 }}>All columns added</div>}
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '0.5px solid var(--neutral-100)' }}>
          <Button variant="ghost" size="S" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="S" onClick={() => onAdd(selected)} disabled={selected.length === 0}>Add Columns</Button>
        </div>
      </div>
    </>
  );
}
