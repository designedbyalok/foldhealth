import { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { CheckboxTick } from '../../components/CheckboxTick/CheckboxTick';
import { useAppStore } from '../../store/useAppStore';
import { MONTH_NAMES, formatDateFriendly, parseTaskDate } from './TasksView.utils';
import { usePopoverPosition } from './usePopoverPosition';
import styles from './TasksView.module.css';

export function TaskDatePicker({ value, onSelect, overdue }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const parsed = parseTaskDate(value);
    return parsed ? new Date(parsed.getFullYear(), parsed.getMonth(), 1) : new Date();
  });
  const btnRef = useRef(null);
  const pos = usePopoverPosition(btnRef, open);

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const selected = parseTaskDate(value);
  const selectedDay = selected ? selected.getDate() : null;
  const selectedMonth = selected ? selected.getMonth() : null;
  const selectedYear = selected ? selected.getFullYear() : null;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const isToday = (d) => d === todayDay && month === todayMonth && year === todayYear;
  const isSelected = (d) => d === selectedDay && month === selectedMonth && year === selectedYear;

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        className={styles.detailValue}
        style={{ color: overdue ? 'var(--status-error)' : (value ? 'var(--neutral-300)' : 'var(--neutral-200)') }}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
      >
        <Icon name="solar:calendar-linear" size={16} color={overdue ? 'var(--status-error)' : (value ? 'var(--neutral-300)' : 'var(--neutral-200)')} />
        <span>{formatDateFriendly(value)}</span>
      </button>
      {open && pos && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)}>
          <div
            className={styles.calendarDropdown}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.calendarHeader}>
              <ActionButton icon="solar:alt-arrow-left-linear" size="S" onClick={() => setViewDate(new Date(year, month - 1, 1))} />
              <span className={styles.calendarTitle}>{MONTH_NAMES[month]} {year}</span>
              <ActionButton icon="solar:alt-arrow-right-linear" size="S" onClick={() => setViewDate(new Date(year, month + 1, 1))} />
            </div>
            <div className={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className={styles.calendarDayLabel}>{d}</div>)}
              {days.map((d, i) => d ? (
                <button
                  key={i}
                  className={[styles.calendarDay, isToday(d) ? styles.calendarToday : '', isSelected(d) ? styles.calendarSelected : ''].filter(Boolean).join(' ')}
                  onClick={() => { onSelect(`${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}-${year}`); setOpen(false); }}
                >{d}</button>
              ) : <div key={i} />)}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


export function CreatableLabelDropdown({ selectedLabels, onToggle, children }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);
  const pos = usePopoverPosition(btnRef, open);
  const taskLabels = useAppStore(s => s.taskLabels);
  const createTaskLabel = useAppStore(s => s.createTaskLabel);
  const showToast = useAppStore(s => s.showToast);

  const filtered = taskLabels.filter(l => !search || l.toLowerCase().includes(search.toLowerCase()));
  const exact = taskLabels.find(l => l.toLowerCase() === search.trim().toLowerCase());
  const canCreate = search.trim() && !exact;
  const selectedLabelSet = useMemo(() => new Set(selectedLabels), [selectedLabels]);

  const handleCreate = async () => {
    const created = await createTaskLabel(search.trim());
    if (created) {
      showToast(`Label "${created}" created`);
      onToggle(created);
      setSearch('');
    }
  };

  return (
    <div ref={btnRef} style={{ position: 'relative' }}>
      <button className={styles.detailValue} onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
        {children || <Icon name="solar:add-circle-linear" size={14} color="var(--neutral-200)" />}
      </button>
      {open && pos && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => { setOpen(false); setSearch(''); }}>
          <div
            className={styles.simpleDropdown}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.dropdownSearch}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
              <input aria-label="Search or create a label"
                className={styles.dropdownSearchInput}
                placeholder="Search or create..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
                autoFocus
              />
            </div>
            {filtered.map(l => (
              <button key={l} type="button" role="menuitemcheckbox" aria-checked={selectedLabelSet.has(l)} className={styles.simpleDropItem} onClick={() => onToggle(l)}>
                <CheckboxTick checked={selectedLabelSet.has(l)} size={15} />
                {l}
              </button>
            ))}
            {canCreate && (
              <button className={styles.simpleDropItem} style={{ color: 'var(--primary-300)', fontWeight: 500 }} onClick={handleCreate}>
                <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
                Create "{search.trim()}"
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <div className={styles.simpleDropItem} style={{ color: 'var(--neutral-200)', cursor: 'default' }}>No results</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function DetailDropdown({ value, options, onSelect, renderOption, children, searchable = true, multiSelect, selected }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);
  const pos = usePopoverPosition(btnRef, open);
  const selectedSet = useMemo(() => new Set(selected || []), [selected]);

  const filtered = options.filter(opt => {
    if (!search) return true;
    const label = typeof opt === 'string' ? opt : opt.label;
    return label.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} className={styles.detailValue} onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
        {children || value || '—'}
      </button>
      {open && pos && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => { setOpen(false); setSearch(''); }}>
          <div
            className={styles.simpleDropdown}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            {searchable && options.length > 3 && (
              <div className={styles.dropdownSearch}>
                <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
                <input aria-label="Search options" className={styles.dropdownSearchInput} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
              </div>
            )}
            {filtered.map(opt => {
              const label = typeof opt === 'string' ? opt : opt.label;
              const val = typeof opt === 'string' ? opt : opt.value;
              const isChecked = multiSelect && selectedSet.has(val);
              return (
                <button key={val} className={styles.simpleDropItem} onClick={() => {
                  onSelect(val);
                  if (!multiSelect) { setOpen(false); setSearch(''); }
                }} type="button" role={multiSelect ? 'menuitemcheckbox' : undefined} aria-checked={multiSelect ? isChecked : undefined}>
                  {multiSelect && <CheckboxTick checked={isChecked} size={15} />}
                  {renderOption ? renderOption(opt) : label}
                </button>
              );
            })}
            {filtered.length === 0 && <div className={styles.simpleDropItem} style={{ color: 'var(--neutral-200)', cursor: 'default' }}>No results</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
