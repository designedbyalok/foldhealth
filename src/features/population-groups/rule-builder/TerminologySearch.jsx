import { useRef, useState, useMemo, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '../../../components/Input/Input';
import { Icon } from '../../../components/Icon/Icon';
import { useIcdSearch } from '../../../lib/icd/useIcdSearch';
import styles from './ruleBuilder.module.css';

/**
 * TerminologySearch — autocomplete for coded healthcare terminologies.
 *
 * For ICD-10 it delegates to the existing useIcdSearch hook (WHO ICD-11 API →
 * Supabase cache → bundled catalog). For other terminologies (SNOMED, CPT,
 * LOINC, RxNorm) it provides a local search against the patient_clinical_events
 * table's distinct codes — a practical approach that works without external
 * terminology servers while still offering real data.
 *
 * @param {object}   props
 * @param {string}   props.terminology  — 'icd10' | 'snomed' | 'cpt' | 'loinc' | 'rxnorm'
 * @param {(result:{code,display,system})=>void} props.onSelect
 * @param {string}   [props.placeholder]
 * @param {string[]} [props.excludeCodes] — codes to hide (already selected)
 */
// Stable identity for the omitted prop — an inline `= []` default would rebuild
// the excludeSet memo below on every render.
const EMPTY_CODES = [];

export function TerminologySearch({
  terminology = 'icd10',
  onSelect,
  placeholder,
  excludeCodes = EMPTY_CODES,
  autoFocus = false,
}) {
  const isIcd = terminology === 'icd10';

  /* ICD-10 uses the existing rich search; others use a simpler local hook. */
  const icd = useIcdSearch({ minChars: 2 });
  const local = useLocalTermSearch({ terminology, minChars: 2 });
  const hook = isIcd ? icd : local;

  const { query, setQuery, results, loading } = hook;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const blurTimer = useRef(null);
  const listboxId = useId();

  const excludeSet = useMemo(() => new Set(excludeCodes), [excludeCodes]);
  const visible = useMemo(
    () => results.filter(r => r.code && !excludeSet.has(r.code)),
    [results, excludeSet],
  );

  const visibleKey = visible.map(r => r.code).join('|');
  useEffect(() => setActive(0), [visibleKey]);
  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const showDropdown = open && query.trim().length >= 2;

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (el) setRect(el.getBoundingClientRect());
  }, []);
  useEffect(() => {
    if (!showDropdown) return;
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [showDropdown, measure]);

  const choose = (item) => {
    const system = isIcd ? 'icd10' : terminology;
    onSelect?.({ code: item.code, display: item.title || item.display || '', system });
    setQuery('');
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, visible.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && visible[active]) { e.preventDefault(); choose(visible[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const TERM_LABELS = { icd10: 'ICD-10', snomed: 'SNOMED', cpt: 'CPT', loinc: 'LOINC', rxnorm: 'RxNorm' };
  const termLabel = TERM_LABELS[terminology] || terminology;

  return (
    <div ref={anchorRef} className={styles.termSearchWrap}>
      <div className={styles.termSearchInput}>
        <Icon name="solar:magnifer-linear" size={15} color="var(--neutral-200)" />
        <Input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder || `Search ${termLabel} codes...`}
          style={{ width: '100%' }}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls={listboxId}
        />
        {loading && <Icon name="solar:refresh-linear" size={14} color="var(--neutral-200)" />}
      </div>

      {showDropdown && rect && createPortal(
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className={styles.termDropdown}
          style={{ left: rect.left, top: rect.bottom + 4, width: Math.max(rect.width, 360) }}
        >
          {visible.map((r, i) => (
            <button
              key={r.code}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`${styles.termItem} ${i === active ? styles.termItemActive : ''}`}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(r)}
            >
              <code className={styles.termCode}>{r.code}</code>
              <span className={styles.termTitle}>{r.title || r.display || ''}</span>
            </button>
          ))}
          {!visible.length && (
            <div className={styles.termEmpty}>
              {loading ? 'Searching...' : `No matching ${termLabel} codes`}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* Lightweight local search for non-ICD terminologies — queries distinct codes
   from patient_clinical_events. In production these would hit terminology
   servers; for now the event table has enough data for demos. */
function useLocalTermSearch({ terminology, minChars = 2, debounceMs = 200 }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < minChars) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        /* Search the event table for matching codes/display text.
           This table may not exist yet (migration pending), so catch gracefully. */
        const { supabase } = await import('../../../lib/supabase');
        const safe = q.replace(/[(),%*]/g, ' ').trim();
        const { data } = await supabase
          .from('patient_clinical_events')
          .select('code, display, code_system')
          .eq('code_system', terminology)
          .or(`code.ilike.%${safe}%,display.ilike.%${safe}%`)
          .limit(15);
        const seen = new Set();
        const deduped = (data || []).filter(r => {
          if (!r.code || seen.has(r.code)) return false;
          seen.add(r.code);
          return true;
        });
        setResults(deduped.map(r => ({ code: r.code, title: r.display || r.code, display: r.display || '' })));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, terminology, minChars, debounceMs]);

  return { query, setQuery, results, loading };
}
