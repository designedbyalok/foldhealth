import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { RadioButton } from '../RadioButton/RadioButton';
import { ActionButton } from '../ActionButton/ActionButton';
import { FilterChip } from '../FilterChip/FilterChip';
import styles from './ProviderSelect.module.css';

const NETWORK_OPTIONS = ['In-Network', 'Out of Network'];
const EMPTY_ADVANCED = { network: [], specialty: [], zip: [] };
const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

// Clicks inside portals (FilterChip popovers + their click-catcher, tooltips)
// land outside this component's DOM but belong to it; only clicks inside the
// app root count as "outside".
function isInAppRoot(target) {
  let n = target;
  while (n?.parentElement && n.parentElement !== document.body) n = n.parentElement;
  return n?.id === 'root';
}

const initialsOf = (name) => String(name || '').replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean)
  .slice(0, 2).map(w => w[0]).join('').toUpperCase();

/**
 * ProviderSelect: searchable provider picker (Figma New Care Gap Workflow
 * 19:47455). Each row: radio, provider avatar, name + source badge
 * ("Fold Provider" / "EHR Provider"), a "specialty • address" line, and an
 * optional contact line (e.g. "eFax : (619) 555-4321").
 *
 * @param {object}   props
 * @param {string}   [props.label]
 * @param {boolean}  [props.required]
 * @param {Array}    props.providers – [{ id, name, subtitle?, source?: 'fold'|'ehr',
 *                                      contactLabel?, contactValue?, disabled?, disabledReason? }]
 * @param {string}   [props.value]   – selected provider id
 * @param {function} props.onChange  – (id) => void
 * @param {string}   [props.placeholder='Select Provider'] – closed field text
 * @param {string}   [props.searchPlaceholder='Search Providers'] – search box text
 * @param {string}   [props.emptyText]
 * @param {boolean}  [props.advancedSearch] – filter icon in the search row
 *        toggling FilterChips: Search In (network), Specialty, Zip Code.
 *        Uses each provider's `network`, `specialties[]` and `zip`.
 */
export function ProviderSelect({
  label,
  required = false,
  providers = [],
  value,
  onChange,
  placeholder = 'Select Provider',
  searchPlaceholder = 'Search Providers',
  emptyText = 'No providers found.',
  advancedSearch = false,
  // Extra Specialty filter options (e.g. a standard list); merged with the
  // specialties the providers actually have.
  specialtyOptions: extraSpecialties = [],
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const selected = providers.find(p => p.id === value);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advanced, setAdvanced] = useState(EMPTY_ADVANCED);
  const setAdv = (key) => (vals) => setAdvanced(a => ({ ...a, [key]: vals }));
  const anyAdvanced = Object.values(advanced).some(v => v.length > 0);
  const specialtyOptions = uniqueSorted([...extraSpecialties, ...providers.flatMap(p => p.specialties || [])]);
  const zipOptions = uniqueSorted(providers.map(p => p.zip));

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target) || !isInAppRoot(e.target)) return;
      setOpen(false);
    };
    // Escape inside a FilterChip popover closes only that popover.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const active = document.activeElement;
      if (active && active !== document.body && !wrapRef.current?.contains(active)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const q = query.trim().toLowerCase();
  const visible = providers.filter(p => {
    if (q && !`${p.name} ${p.subtitle || ''} ${p.contactValue || ''}`.toLowerCase().includes(q)) return false;
    if (advanced.network.length && !advanced.network.includes(p.network)) return false;
    if (advanced.specialty.length && !(p.specialties || []).some(s => advanced.specialty.includes(s))) return false;
    if (advanced.zip.length && !advanced.zip.includes(p.zip)) return false;
    return true;
  });

  const pick = (p) => {
    if (p.disabled) return;
    onChange?.(p.id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={styles.field} ref={wrapRef}>
      {label && (
        <span className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-hidden="true" />}
        </span>
      )}
      <button
        type="button"
        className={[styles.trigger, open ? styles.triggerOpen : ''].filter(Boolean).join(' ')}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? styles.triggerValue : styles.triggerPlaceholder}>
          {selected ? selected.name : placeholder}
        </span>
        <DownChevronIcon size={14} color="var(--neutral-300)" style={open ? { transform: 'rotate(180deg)' } : undefined} />
      </button>

      {open && (
        <div className={styles.menu} role="listbox" aria-label={label || 'Providers'}>
          <div className={styles.searchRow}>
            <Icon name="solar:magnifer-linear" size={13} color="var(--neutral-300)" />
            <input
              autoFocus
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {advancedSearch && (
              <>
                <span className={styles.searchDivider} />
                <ActionButton
                  size="sm"
                  icon="custom:filter"
                  tooltip={advancedOpen ? 'Hide advanced search' : 'Advanced search'}
                  iconColor={advancedOpen || anyAdvanced ? 'var(--primary-300)' : undefined}
                  onClick={() => setAdvancedOpen(v => !v)}
                />
              </>
            )}
          </div>
          {advancedSearch && advancedOpen && (
            <div className={styles.advancedRow}>
              <FilterChip size="S" label="Search In" options={NETWORK_OPTIONS} selected={advanced.network} onChange={setAdv('network')} singleSelect />
              <FilterChip size="S" label="Specialty" options={specialtyOptions} selected={advanced.specialty} onChange={setAdv('specialty')} searchable />
              <FilterChip size="S" label="Zip Code" options={zipOptions} selected={advanced.zip} onChange={setAdv('zip')} searchable />
              {anyAdvanced && (
                <button type="button" className={styles.clearAll} onClick={() => setAdvanced(EMPTY_ADVANCED)}>
                  <Icon name="solar:close-circle-linear" size={14} color="currentColor" />
                  Clear All
                </button>
              )}
            </div>
          )}
          {visible.length === 0 ? (
            <div className={styles.empty}>{emptyText}</div>
          ) : visible.map(p => (
            <div
              key={p.id}
              role="option"
              aria-selected={p.id === value}
              aria-disabled={p.disabled || undefined}
              tabIndex={p.disabled ? -1 : 0}
              className={[styles.option, p.disabled ? styles.optionDisabled : '', p.id === value ? styles.optionSelected : ''].filter(Boolean).join(' ')}
              onClick={() => pick(p)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(p); } }}
            >
              <RadioButton checked={p.id === value} onChange={() => pick(p)} ariaLabel={p.name} disabled={p.disabled} />
              <Avatar variant="provider" initials={initialsOf(p.name)} size="M" />
              <div className={styles.text}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{p.name}</span>
                  {p.source === 'fold' && <Badge size="sm" tone="primary" label="Fold Provider" />}
                  {p.source === 'ehr' && <Badge size="sm" label="EHR Provider" />}
                </div>
                {p.subtitle && <span className={styles.sub}>{p.subtitle}</span>}
                {p.contactValue
                  ? <span className={styles.sub}>{p.contactLabel} : {p.contactValue}</span>
                  : p.disabledReason && <span className={styles.subMuted}>{p.disabledReason}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
