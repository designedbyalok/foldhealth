import { useRef, useState, useMemo, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '../Input/Input';
import { Icon } from '../Icon/Icon';
import { useIcdSearch } from '../../lib/icd/useIcdSearch';
import styles from './IcdSearch.module.css';

const EMPTY_EXCLUDE_CODES = [];

/**
 * Fold Health ICD search — shared autocomplete for looking up ICD codes from
 * the live WHO ICD-11 API (via the `/api/icd-search` proxy), with a Supabase
 * cache + bundled catalog fallback chain.
 *
 * The results dropdown renders through a portal with fixed positioning so it
 * floats above drawers/tables regardless of ancestor overflow clipping.
 *
 * Selecting a result fires `onSelect({ code, title, hcc, chapter, id })`,
 * clears the query, and keeps focus so multiple codes can be added in a row.
 *
 * @param {object}   props
 * @param {(icd:object)=>void} props.onSelect   – called with the chosen code
 * @param {string}   [props.placeholder]
 * @param {string[]} [props.excludeCodes]       – codes to hide (already added)
 * @param {boolean}  [props.autoFocus]
 * @param {string}   [props.variant]            – 'default' | 'error'
 * @param {number}   [props.minChars]
 * @param {string}   [props.className]
 */
export function IcdSearch({
  id,
  onSelect,
  placeholder = 'Search and Add ICD Code & Description, HCC Code & Description',
  excludeCodes = EMPTY_EXCLUDE_CODES,
  autoFocus = false,
  variant = 'default',
  minChars = 2,
  className,
}) {
  const { query, setQuery, results, loading, source } = useIcdSearch({ minChars });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const blurTimer = useRef(null);
  const listboxId = useId();

  const excludeSet = useMemo(
    () => new Set(excludeCodes.filter(Boolean)),
    [excludeCodes],
  );
  // Code-less keyword entities can't become chips (no key, no dedupe) — skip.
  const visible = useMemo(
    () => results.filter((r) => r.code && !excludeSet.has(r.code)),
    [results, excludeSet],
  );

  // Reset the highlight only when the actual result set changes — `visible`
  // is referentially fresh every parent render.
  const visibleKey = visible.map((r) => r.code).join('|');
  useEffect(() => setActive(0), [visibleKey]);
  useEffect(() => () => clearTimeout(blurTimer.current), []);

  const showDropdown = open && query.trim().length >= minChars;

  // Anchor the fixed-position dropdown to the input. Re-measure while open on
  // scroll (capture phase catches scrolling containers) and resize.
  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (el) setRect(el.getBoundingClientRect());
  }, []);
  useEffect(() => {
    if (!showDropdown) return undefined;
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [showDropdown, measure]);

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(listboxId, active))}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, listboxId]);

  const choose = (icd) => {
    if (!icd?.code) return;
    onSelect?.(icd);
    setQuery('');
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (visible[active]) {
        e.preventDefault();
        choose(visible[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={anchorRef} className={[styles.wrap, className || ''].filter(Boolean).join(' ')}>
      <div className={styles.inputWrap}>
        <Icon name="solar:magnifer-linear" size={15} className={styles.searchIcon} />
        <Input
          id={id}
          ref={inputRef}
          className={styles.inputField}
          variant={variant}
          placeholder={placeholder}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 120); }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={showDropdown && visible[active] ? optionId(listboxId, active) : undefined}
        />
        {loading && (
          <span className={styles.spinner} aria-hidden="true">
            <Icon name="solar:refresh-linear" size={14} />
          </span>
        )}
      </div>

      {showDropdown && rect && createPortal(
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className={styles.dropdown}
          style={{ left: rect.left, top: rect.bottom + 4, width: rect.width }}
        >
          {visible.map((r, i) => (
            <button
              key={r.code}
              id={optionId(listboxId, i)}
              type="button"
              role="option"
              aria-selected={i === active}
              className={[styles.item, i === active ? styles.itemActive : ''].filter(Boolean).join(' ')}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(r)}
            >
              <code className={styles.code}>{r.code}</code>
              <span className={styles.title}>{r.title}</span>
              {(r.hcc || r.chapter) && (
                <span className={styles.meta}>{(r.hcc || r.chapter).replace(/ - .*$/, '')}</span>
              )}
            </button>
          ))}

          {!visible.length && (
            <div className={styles.status}>
              {loading ? 'Searching…' : 'No matching ICD codes'}
            </div>
          )}

          {!!visible.length && (
            <div className={styles.footer}>
              <Icon name="solar:health-linear" size={12} className={styles.footerIcon} />
              {source === 'who' ? 'WHO ICD-11' : source === 'cache' ? 'Fold catalog' : 'Offline catalog'}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

// useId output contains ':' — CSS.escape handles it for querySelector use.
const optionId = (listboxId, index) => `${listboxId}-opt-${index}`;
