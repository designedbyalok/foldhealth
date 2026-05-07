import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Toggle } from '../../components/Toggle/Toggle';
import { Avatar } from '../../components/Avatar/Avatar';
import { TopBar } from '../../components/TopBar/TopBar';
import { Drawer } from '../../components/Drawer/Drawer';
import { ConfirmDialog } from '../../components/Modal/ConfirmDialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { useAppStore } from '../../store/useAppStore';
import styles from './TasksView.module.css';

const TABS = [
  { key: 'all', label: 'All Tasks' },
  { key: 'assigned', label: 'Assigned to Me' },
  { key: 'pool', label: 'My Task Pool' },
  { key: 'created', label: 'Created by Me' },
  { key: 'mentions', label: 'Mentions' },
];

function KanbanIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <path d="M7.75 6C7.75 5.58579 7.41421 5.25 7 5.25C6.58579 5.25 6.25 5.58579 6.25 6H7.75ZM6.25 17C6.25 17.4142 6.58579 17.75 7 17.75C7.41421 17.75 7.75 17.4142 7.75 17H6.25ZM12.75 6C12.75 5.58579 12.4142 5.25 12 5.25C11.5858 5.25 11.25 5.58579 11.25 6H12.75ZM11.25 12C11.25 12.4142 11.5858 12.75 12 12.75C12.4142 12.75 12.75 12.4142 12.75 12H11.25ZM17.75 6C17.75 5.58579 17.4142 5.25 17 5.25C16.5858 5.25 16.25 5.58579 16.25 6H17.75ZM16.25 15.5C16.25 15.9142 16.5858 16.25 17 16.25C17.4142 16.25 17.75 15.9142 17.75 15.5H16.25ZM12 22V21.25C9.62178 21.25 7.91356 21.2484 6.61358 21.0736C5.33517 20.9018 4.56445 20.5749 3.9948 20.0052L3.46447 20.5355L2.93414 21.0659C3.82895 21.9607 4.96897 22.366 6.41371 22.5603C7.83687 22.7516 9.66418 22.75 12 22.75V22ZM2 12H1.25C1.25 14.3358 1.24841 16.1631 1.43975 17.5863C1.63399 19.031 2.03933 20.1711 2.93414 21.0659L3.46447 20.5355L3.9948 20.0052C3.42514 19.4355 3.09825 18.6648 2.92637 17.3864C2.75159 16.0864 2.75 14.3782 2.75 12H2ZM22 12H21.25C21.25 14.3782 21.2484 16.0864 21.0736 17.3864C20.9018 18.6648 20.5749 19.4355 20.0052 20.0052L20.5355 20.5355L21.0659 21.0659C21.9607 20.1711 22.366 19.031 22.5603 17.5863C22.7516 16.1631 22.75 14.3358 22.75 12H22ZM12 22V22.75C14.3358 22.75 16.1631 22.7516 17.5863 22.5603C19.031 22.366 20.1711 21.9607 21.0659 21.0659L20.5355 20.5355L20.0052 20.0052C19.4355 20.5749 18.6648 20.9018 17.3864 21.0736C16.0864 21.2484 14.3782 21.25 12 21.25V22ZM12 2V2.75C14.3782 2.75 16.0864 2.75159 17.3864 2.92637C18.6648 3.09825 19.4355 3.42514 20.0052 3.9948L20.5355 3.46447L21.0659 2.93414C20.1711 2.03933 19.031 1.63399 17.5863 1.43975C16.1631 1.24841 14.3358 1.25 12 1.25V2ZM22 12H22.75C22.75 9.66418 22.7516 7.83687 22.5603 6.41371C22.366 4.96897 21.9607 3.82895 21.0659 2.93414L20.5355 3.46447L20.0052 3.9948C20.5749 4.56445 20.9018 5.33517 21.0736 6.61358C21.2484 7.91356 21.25 9.62178 21.25 12H22ZM12 2V1.25C9.66418 1.25 7.83687 1.24841 6.41371 1.43975C4.96897 1.63399 3.82895 2.03933 2.93414 2.93414L3.46447 3.46447L3.9948 3.9948C4.56445 3.42514 5.33517 3.09825 6.61358 2.92637C7.91356 2.75159 9.62178 2.75 12 2.75V2ZM2 12H2.75C2.75 9.62178 2.75159 7.91356 2.92637 6.61358C3.09825 5.33517 3.42514 4.56445 3.9948 3.9948L3.46447 3.46447L2.93414 2.93414C2.03933 3.82895 1.63399 4.96897 1.43975 6.41371C1.24841 7.83687 1.25 9.66418 1.25 12H2ZM7 6H6.25V17H7H7.75V6H7ZM12 6H11.25V12H12H12.75V6H12ZM17 6H16.25V15.5H17H17.75V6H17Z" fill="currentColor"/>
    </svg>
  );
}

const VIEW_TOGGLE_ITEMS = [
  { key: 'list', icon: 'solar:list-linear' },
  { key: 'board', icon: <KanbanIcon size={16} /> },
];

const TASK_FILTER_DEFS = [
  { key: 'assigned_to', label: 'Assigned to', options: [
    { value: 'Dr. JeDee Potter', label: 'Dr. JeDee Potter' },
    { value: 'Deborah Hintz', label: 'Deborah Hintz' },
    { value: 'Dr. Robert Frost', label: 'Dr. Robert Frost' },
  ]},
  { key: 'view_by', label: 'View By', options: [
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'due_date', label: 'Due Date' },
  ]},
  { key: 'sort_by', label: 'Sort By', options: [
    { value: 'due_date', label: 'Due Date' },
    { value: 'priority', label: 'Priority' },
    { value: 'name', label: 'Name' },
  ]},
  { key: 'created_by', label: 'Created By', options: [
    { value: 'Dr. JeDee Potter', label: 'Dr. JeDee Potter' },
    { value: 'Deborah Hintz', label: 'Deborah Hintz' },
    { value: 'Dr. Robert Frost', label: 'Dr. Robert Frost' },
  ]},
  { key: 'task_status', label: 'Task Status', options: [
    { value: 'pending', label: 'Pending' },
    { value: 'missed', label: 'Missed' },
    { value: 'completed', label: 'Completed' },
  ]},
  { key: 'priority', label: 'Priority', options: [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ]},
  { key: 'labels', label: 'Labels', options: [
    { value: 'Hypertension', label: 'Hypertension' },
    { value: 'Exercise', label: 'Exercise' },
    { value: 'Document Collection', label: 'Document Collection' },
  ]},
];

const STATUS_ORDER = ['pending', 'missed', 'completed'];
const STATUS_LABELS = { pending: 'Pending', missed: 'Missed', completed: 'Completed' };
const STATUS_BADGE_VARIANTS = {
  pending: 'status-queued',
  missed: 'status-failed',
  completed: 'status-completed',
};
const STATUS_COLORS = {
  pending: 'var(--status-warning)',
  missed: 'var(--status-error)',
  completed: 'var(--status-success)',
};

const PRIORITY_COLORS = {
  high: '#FF623E',
  medium: '#FFAB00',
  low: '#0065FF',
  none: '#6F7A90',
};

/* ── Date helpers ── */
function parseTaskDate(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
  const [m, d, y] = parts;
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function todayStart() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function todayMMDDYYYY() {
  const t = new Date();
  return `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}-${t.getFullYear()}`;
}

function isOverdue(task) {
  if (!task || !task.due_date || task.status === 'completed') return false;
  const d = parseTaskDate(task.due_date);
  if (!d) return false;
  return d < todayStart() || task.status === 'missed';
}

function formatDateFriendly(str) {
  if (!str) return 'Select Date';
  const d = parseTaskDate(str);
  if (!d) return str;
  const today = todayStart();
  const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return str;
}

function SubtaskIcon({ size = 16, color = 'var(--primary-300)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M3.33325 6H12.6666C13.7712 6 14.6666 5.10457 14.6666 4C14.6666 2.89543 13.7712 2 12.6666 2H3.33325C2.22868 2 1.33325 2.89543 1.33325 4C1.33325 5.10457 2.22868 6 3.33325 6ZM3.33325 6L3.33325 9.33333C3.33325 10.8061 4.52716 12 5.99992 12M5.99992 12C5.99992 13.1046 6.89535 14 7.99992 14H12.6666C13.7712 14 14.6666 13.1046 14.6666 12C14.6666 10.8954 13.7712 10 12.6666 10H7.99992C6.89535 10 5.99992 10.8954 5.99992 12Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PriorityIcon({ priority, size = 24 }) {
  const s = size;
  if (priority === 'high') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path fillRule="evenodd" clipRule="evenodd" d="M19.7119 12.1961C19.46 12.3737 19.1183 12.4735 18.762 12.4735C18.4058 12.4735 18.0641 12.3737 17.8122 12.1961L12.0445 8.12892L6.27686 12.1961C6.02347 12.3687 5.68409 12.4642 5.33183 12.462C4.97957 12.4599 4.6426 12.3602 4.3935 12.1846C4.14441 12.0089 4.00311 11.7713 4.00005 11.5229C3.99699 11.2745 4.13241 11.0352 4.37714 10.8565L11.0947 6.11949C11.3466 5.94188 11.6883 5.8421 12.0445 5.8421C12.4008 5.8421 12.7424 5.94188 12.9944 6.11949L19.7119 10.8565C19.9638 11.0341 20.1053 11.2751 20.1053 11.5263C20.1053 11.7775 19.9638 12.0184 19.7119 12.1961ZM19.7119 17.8805C19.46 18.0581 19.1183 18.1579 18.762 18.1579C18.4058 18.1579 18.0641 18.0581 17.8122 17.8805L12.0445 13.8133L6.27686 17.8805C6.02347 18.0531 5.68409 18.1486 5.33183 18.1464C4.97957 18.1443 4.6426 18.0446 4.3935 17.869C4.14441 17.6933 4.00311 17.4557 4.00005 17.2073C3.99699 16.9589 4.13241 16.7196 4.37714 16.5409L11.0947 11.8039C11.3466 11.6263 11.6883 11.5265 12.0445 11.5265C12.4008 11.5265 12.7424 11.6263 12.9944 11.8039L19.7119 16.5409C19.9638 16.7185 20.1053 16.9595 20.1053 17.2107C20.1053 17.4619 19.9638 17.7028 19.7119 17.8805Z" fill="url(#priorityHigh)"/>
        <defs><linearGradient id="priorityHigh" x1="12.0526" y1="5.8421" x2="12.0526" y2="18.1579" gradientUnits="userSpaceOnUse"><stop stopColor="#FF623E"/><stop offset="1" stopColor="#ED876F"/></linearGradient></defs>
      </svg>
    );
  }
  if (priority === 'medium') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path d="M4.5 13C3.80859 13 3.25 13.5586 3.25 14.25C3.25 14.9414 3.80859 15.5 4.5 15.5H19.5C20.1914 15.5 20.75 14.9414 20.75 14.25C20.75 13.5586 20.1914 13 19.5 13H4.5ZM4.5 8C3.80859 8 3.25 8.55859 3.25 9.25C3.25 9.94141 3.80859 10.5 4.5 10.5H19.5C20.1914 10.5 20.75 9.94141 20.75 9.25C20.75 8.55859 20.1914 8 19.5 8H4.5Z" fill="#FFAB00"/>
      </svg>
    );
  }
  if (priority === 'low') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
        <path fillRule="evenodd" clipRule="evenodd" d="M20.5848 12.293C20.3188 12.1055 19.9582 12.0002 19.5822 12.0002C19.2061 12.0002 18.8455 12.1055 18.5795 12.293L12.4914 16.5861L6.40335 12.293C6.13588 12.1108 5.77766 12.01 5.40582 12.0123C5.03399 12.0146 4.6783 12.1198 4.41537 12.3052C4.15243 12.4906 4.00328 12.7414 4.00005 13.0036C3.99682 13.2658 4.13976 13.5184 4.39809 13.707L11.4888 18.7072C11.7548 18.8947 12.1154 19 12.4914 19C12.8675 19 13.2281 18.8947 13.4941 18.7072L20.5848 13.707C20.8506 13.5195 21 13.2652 21 13C21 12.7348 20.8506 12.4805 20.5848 12.293ZM20.5848 6.2928C20.3188 6.10532 19.9582 6 19.5822 6C19.2061 6 18.8455 6.10532 18.5795 6.2928L12.4914 10.5859L6.40335 6.2928C6.13588 6.11063 5.77766 6.00983 5.40582 6.01211C5.03399 6.01439 4.6783 6.11956 4.41537 6.30498C4.15243 6.49039 4.00328 6.74121 4.00005 7.00342C3.99682 7.26562 4.13976 7.51823 4.39809 7.70684L11.4888 12.707C11.7548 12.8945 12.1154 12.9998 12.4914 12.9998C12.8675 12.9998 13.2281 12.8945 13.4941 12.707L20.5848 7.70684C20.8506 7.51931 21 7.26499 21 6.99982C21 6.73465 20.8506 6.48033 20.5848 6.2928Z" fill="url(#priorityLow)"/>
        <defs><linearGradient id="priorityLow" x1="12.5" y1="6" x2="12.5" y2="19" gradientUnits="userSpaceOnUse"><stop stopColor="#6AA3F9"/><stop offset="1" stopColor="#0065FF"/></linearGradient></defs>
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 5.34783C8.32611 5.34783 5.34783 8.32611 5.34783 12C5.34783 15.6739 8.32611 18.6522 12 18.6522C15.6739 18.6522 18.6522 15.6739 18.6522 12C18.6522 8.32611 15.6739 5.34783 12 5.34783ZM3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" fill="#6F7A90"/>
    </svg>
  );
}

/* ── Date Picker (inline calendar, same as appointment drawer) ── */
function TaskDatePicker({ value, onSelect, overdue }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) return new Date(+parts[2], +parts[0] - 1, 1);
    }
    return new Date();
  });
  const btnRef = useRef(null);

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const selectedParts = value ? value.split('-') : null;
  const selectedDay = selectedParts ? +selectedParts[1] : null;
  const selectedMonth = selectedParts ? +selectedParts[0] - 1 : null;
  const selectedYear = selectedParts ? +selectedParts[2] : null;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)}>
          <div
            className={styles.calendarDropdown}
            style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.calendarHeader}>
              <ActionButton icon="solar:alt-arrow-left-linear" size="S" onClick={() => setViewDate(new Date(year, month - 1, 1))} />
              <span className={styles.calendarTitle}>{monthNames[month]} {year}</span>
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

/* ── Inline Label Dropdown for list rows (multi-select with search + create) ── */
function RowLabelDropdown({ task, children }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);
  const taskLabels = useAppStore(s => s.taskLabels);
  const createTaskLabel = useAppStore(s => s.createTaskLabel);
  const labels = Array.isArray(task.labels) ? task.labels : [];
  const filtered = taskLabels.filter(l => !search || l.toLowerCase().includes(search.toLowerCase()));
  const exact = taskLabels.find(l => l.toLowerCase() === search.trim().toLowerCase());
  const canCreate = search.trim() && !exact;

  const toggle = (l) => {
    const next = labels.includes(l) ? labels.filter(x => x !== l) : [...labels, l];
    updateTask(task.id, { labels: next });
    showToast(labels.includes(l) ? `Label "${l}" removed` : `Label "${l}" added`);
  };

  const handleCreate = async () => {
    const created = await createTaskLabel(search.trim());
    if (created) {
      showToast(`Label "${created}" created`);
      const next = [...labels, created];
      updateTask(task.id, { labels: next });
      setSearch('');
    }
  };

  return (
    <div ref={btnRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
      {children || (
        <button className={styles.addLabel}>
          <Icon name="solar:tag-linear" size={13} color="var(--neutral-200)" />
          Add Label
        </button>
      )}
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setOpen(false); setSearch(''); }}>
          <div
            className={styles.simpleDropdown}
            style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.dropdownSearch}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
              <input
                className={styles.dropdownSearchInput}
                placeholder="Search or create..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
                autoFocus
              />
            </div>
            {filtered.map(l => (
              <button key={l} className={styles.simpleDropItem} onClick={() => toggle(l)}>
                <input type="checkbox" checked={labels.includes(l)} readOnly style={{ accentColor: 'var(--primary-300)', width: 15, height: 15, flexShrink: 0 }} />
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

/* ── Three-dot Action Menu for rows and kanban cards ── */
function RowActionMenu({ task }) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const btnRef = useRef(null);
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const showToast = useAppStore(s => s.showToast);
  const allTasks = useAppStore(s => s.tasks);
  const subCount = allTasks.filter(t => t.parent_task_id === task.id).length;

  const actions = [];
  if (task.status === 'pending') {
    actions.push({ key: 'complete', label: 'Mark as Complete', icon: 'solar:check-circle-linear', handler: () => { updateTask(task.id, { status: 'completed' }); showToast('Task marked as complete'); } });
    actions.push({ key: 'missed', label: 'Mark as Missed', icon: 'solar:close-circle-linear', handler: () => { updateTask(task.id, { status: 'missed' }); showToast('Task marked as missed'); } });
  } else if (task.status === 'missed') {
    actions.push({ key: 'pending', label: 'Mark as Pending', icon: 'solar:clock-circle-linear', handler: () => { updateTask(task.id, { status: 'pending' }); showToast('Task marked as pending'); } });
    actions.push({ key: 'complete', label: 'Mark as Complete', icon: 'solar:check-circle-linear', handler: () => { updateTask(task.id, { status: 'completed' }); showToast('Task marked as complete'); } });
  } else if (task.status === 'completed') {
    actions.push({ key: 'pending', label: 'Mark as Pending', icon: 'solar:clock-circle-linear', handler: () => { updateTask(task.id, { status: 'pending' }); showToast('Task marked as pending'); } });
    actions.push({ key: 'missed', label: 'Mark as Missed', icon: 'solar:close-circle-linear', handler: () => { updateTask(task.id, { status: 'missed' }); showToast('Task marked as missed'); } });
  }
  actions.push({ key: 'delete', label: 'Delete', icon: 'solar:trash-bin-trash-linear', danger: true, handler: () => setShowDeleteConfirm(true) });

  return (
    <div ref={btnRef} style={{ position: 'relative' }}>
      <button className={styles.actionMenuBtn} onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
        <Icon name="solar:menu-dots-bold" size={16} color="var(--neutral-300)" />
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setOpen(false); }}>
          <div
            className={styles.actionMenuDropdown}
            style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().right - 180, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            {actions.map(a => (
              <button key={a.key} className={`${styles.actionMenuItem} ${a.danger ? styles.actionMenuDanger : ''}`} onClick={() => { a.handler(); setOpen(false); }}>
                <Icon name={a.icon} size={16} />
                {a.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
      {showDeleteConfirm && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title="Delete this task?"
          description={subCount > 0 ? `This task has ${subCount} subtask(s). Deleting it will also delete all subtasks. This cannot be undone.` : 'This action cannot be undone.'}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="error"
          onConfirm={() => { deleteTask(task.id); showToast('Task deleted'); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

/* ── Inline Status Dropdown for list rows ── */
function RowStatusDropdown({ task }) {
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);

  return (
    <Select value={task.status} onValueChange={v => { updateTask(task.id, { status: v }); showToast(`Status changed to ${STATUS_LABELS[v]}`); }}>
      <SelectTrigger className="h-6 text-xs [&>svg]:hidden" style={{ background: 'transparent', border: 'none', padding: 0, minWidth: 'auto', gap: 0 }} onClick={e => e.stopPropagation()}>
        <Badge variant={STATUS_BADGE_VARIANTS[task.status]} label={STATUS_LABELS[task.status]} trailingIcon="solar:alt-arrow-down-linear" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/* ── Inline Assignee Dropdown for list rows ──
 * Mirrors the look of RowLabelDropdown: small pill in the row that
 * opens a portal-anchored picker. Sources its options from
 * useAppStore.taskProfiles (profiles table) with the current user
 * pinned at top with "(You)". When the row has no assignee, renders an
 * "Assign" empty-state pill in neutral-200 (same pattern as Add Label).
 */
function RowAssignDropdown({ task }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);

  // Build picker options: current user first (with "(You)"), then everyone else.
  const profiles = (() => {
    const seen = new Set();
    const list = [];
    if (currentUserProfile?.id) {
      list.push({ ...currentUserProfile, label: `${currentUserProfile.name} (You)` });
      seen.add(currentUserProfile.id);
    }
    (taskProfiles || []).forEach(p => {
      if (seen.has(p.id)) return;
      list.push({ ...p, label: p.name });
      seen.add(p.id);
    });
    return list;
  })();

  const filtered = profiles.filter(p => !search || (p.name || '').toLowerCase().includes(search.toLowerCase()));

  const pick = (profile) => {
    updateTask(task.id, { assigned_to: profile.name, assigned_to_id: profile.id || null });
    showToast(`Assigned to ${profile.name}`);
    setOpen(false);
    setSearch('');
  };

  const handleUnassign = () => {
    updateTask(task.id, { assigned_to: null, assigned_to_id: null });
    showToast('Unassigned');
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={btnRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }} onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
      {task.assigned_to ? (
        <button className={styles.assignPill} aria-label={`Assigned to ${task.assigned_to}. Click to change.`}>
          <Icon name="solar:user-linear" size={14} color="var(--neutral-300)" />
          <span>{task.assigned_to}</span>
        </button>
      ) : (
        <button className={styles.assignEmpty} aria-label="Assign">
          <Icon name="solar:user-linear" size={13} color="var(--neutral-200)" />
          Assign
        </button>
      )}
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setOpen(false); setSearch(''); }}>
          <div
            className={styles.simpleDropdown}
            style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.dropdownSearch}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
              <input
                className={styles.dropdownSearchInput}
                placeholder="Search assignees..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            {filtered.map(p => {
              const initials = (p.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <button key={p.id || p.name} className={styles.simpleDropItem} onClick={() => pick(p)}>
                  <Avatar variant="assignee" initials={initials} className={styles.avatarXs} />
                  <span>{p.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className={styles.simpleDropItem} style={{ color: 'var(--neutral-200)', cursor: 'default' }}>No matches</div>
            )}
            {task.assigned_to && (
              <button className={styles.simpleDropItem} style={{ color: 'var(--status-error)', borderTop: '0.5px solid var(--neutral-100)' }} onClick={handleUnassign}>
                <Icon name="solar:close-circle-linear" size={14} color="var(--status-error)" />
                Unassign
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Filter Chip (mirrors FilterBar's FilterChip) ── */
function TaskFilterChip({ filterDef, value, onSet, onClear }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Show the search input + avatars when the filter is people-shaped
  // (assigned_to / created_by / member). The other chips stay plain.
  const isPeopleChip = filterDef.iconKind === 'assignee' || filterDef.iconKind === 'patient';

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const selectedLabel = value ? filterDef.options.find(o => o.value === value)?.label || value : null;

  const filteredOptions = isPeopleChip && search
    ? filterDef.options.filter(o => (o.label || '').toLowerCase().includes(search.toLowerCase()))
    : filterDef.options;

  return (
    <div className={styles.chipWrap} ref={ref}>
      <button
        className={[styles.filterChip, value ? styles.filterChipActive : ''].filter(Boolean).join(' ')}
        onClick={() => setOpen(v => !v)}
      >
        {filterDef.label}
        {selectedLabel && <>
          <span style={{ color: 'var(--primary-200)' }}>:</span>
          <span className={styles.filterValue}>{selectedLabel}</span>
        </>}
        {value ? (
          <span
            className={styles.chipClear}
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
          >
            ✕
          </span>
        ) : (
          <Icon name="solar:alt-arrow-down-linear" size={14} />
        )}
      </button>
      {open && (
        <div className={styles.dropdown}>
          {isPeopleChip && (
            <div className={styles.dropdownSearch}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
              <input
                className={styles.dropdownSearchInput}
                placeholder={`Search ${filterDef.label.toLowerCase()}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {filteredOptions.map(opt => {
            const initials = isPeopleChip
              ? (opt.label || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              : '';
            return (
              <button
                key={opt.value}
                className={[styles.dropdownItem, value === opt.value ? styles.selected : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  if (value === opt.value) onClear();
                  else onSet(opt.value);
                  setOpen(false);
                }}
              >
                {isPeopleChip ? (
                  <Avatar variant={filterDef.iconKind} initials={initials} className={styles.avatarXs} />
                ) : (
                  <span className={styles.dropdownCheck}>
                    {value === opt.value ? '✓' : ''}
                  </span>
                )}
                {opt.label}
              </button>
            );
          })}
          {isPeopleChip && filteredOptions.length === 0 && (
            <div className={styles.dropdownItem} style={{ color: 'var(--neutral-200)', cursor: 'default' }}>
              No matches
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Skeleton Loading ── */
function SkeletonRow() {
  return (
    <div className={styles.taskRow}>
      <div className={styles.cellCheck}>
        <div className={`${styles.skeleton} ${styles.skeletonCircle}`} />
      </div>
      <div className={styles.cellTask}>
        <div className={styles.taskInfo}>
          <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '70%' }} />
          <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '40%', height: 10 }} />
        </div>
      </div>
      <div className={styles.cellP}>
        <div className={`${styles.skeleton} ${styles.skeletonSmall}`} />
      </div>
      <div className={styles.cellStatus}>
        <div className={`${styles.skeleton} ${styles.skeletonBadge}`} />
      </div>
      <div className={styles.cellDue}>
        <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '80%' }} />
      </div>
      <div className={styles.cellMember}>
        <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '60%' }} />
      </div>
      <div className={styles.cellLabels}>
        <div className={`${styles.skeleton} ${styles.skeletonBadge}`} />
      </div>
    </div>
  );
}

/* ── List View: Task Row ── */
function TaskRow({ task, onToggle, onTaskClick, hideAssignedTo }) {
  const isCompleted = task.status === 'completed';
  const labels = Array.isArray(task.labels) ? task.labels : [];
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);

  return (
    <div className={styles.taskRow} onClick={() => onTaskClick?.(task)}>
      <div className={styles.cellCheck}>
        <button
          className={`${styles.taskCheckbox} ${isCompleted ? styles.taskCheckboxChecked : ''}`}
          onClick={e => { e.stopPropagation(); onToggle(task); }}
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          {isCompleted && <Icon name="solar:check-read-linear" size={13} color="#fff" />}
        </button>
      </div>

      <div className={styles.cellTask}>
        <div className={styles.taskInfo}>
          {task.parent_task && (
            <span className={styles.parentLabel}>Parent Task : {task.parent_task}</span>
          )}
          {task.is_subtask ? (
            <div className={styles.subtaskRow}>
              <SubtaskIcon size={14} color="var(--primary-300)" />
              <span className={`${styles.taskName} ${isCompleted ? styles.taskNameDone : ''}`}>{task.name}</span>
            </div>
          ) : (
            <span className={`${styles.taskName} ${isCompleted ? styles.taskNameDone : ''}`}>{task.name}</span>
          )}
          <span className={styles.taskMeta}>
            {task.parent_task ? (task.created_by ? `By : ${task.created_by}` : '') : task.meta}
          </span>
        </div>
        <div className={styles.taskAttachments}>
          {task.attachments > 0 && (
            <span className={styles.attachBadge}>
              <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
              {task.attachments}
            </span>
          )}
          {task.comments > 0 && (
            <span className={styles.attachBadge}>
              <Icon name="solar:chat-round-line-linear" size={14} color="var(--neutral-300)" />
              {task.comments}
            </span>
          )}
        </div>
      </div>

      <div className={styles.cellP}>
        <PriorityIcon priority={task.priority} size={16} />
      </div>

      <div className={styles.cellStatus} onClick={e => e.stopPropagation()}>
        <RowStatusDropdown task={task} />
      </div>

      <div className={`${styles.cellDue} ${isOverdue(task) ? styles.dueMissed : ''}`} onClick={e => e.stopPropagation()}>
        <TaskDatePicker value={task.due_date} overdue={isOverdue(task)} onSelect={v => { updateTask(task.id, { due_date: v }); showToast('Due date updated'); }} />
      </div>

      {!hideAssignedTo && (
        <div className={styles.cellAssigned} onClick={e => e.stopPropagation()}>
          <RowAssignDropdown task={task} />
        </div>
      )}

      <div className={styles.cellMember}>
        <Icon name="solar:user-linear" size={14} color="var(--neutral-300)" />
        <span
          className={styles.memberLink}
          onClick={(e) => {
            e.stopPropagation();
            const state = useAppStore.getState();
            const match = state.patients.find(p => p.name === task.member)
              || (state.allPatients || []).find(p => p.name === task.member);
            if (match) state.openQuickView(match);
          }}
        >
          {task.member}
        </span>
      </div>

      <div className={styles.cellLabels} onClick={e => e.stopPropagation()}>
        <RowLabelDropdown task={task}>
          {labels.length > 0 ? (
            <>
              {labels.slice(0, 2).map(l => (
                <Badge key={l} variant="overflow" label={l} />
              ))}
              {labels.length > 2 && (
                <span className={styles.labelOverflow} title={labels.slice(2).join(', ')}>+{labels.length - 2}</span>
              )}
            </>
          ) : (
            <button className={styles.addLabel}>
              <Icon name="solar:tag-linear" size={13} color="var(--neutral-200)" />
              Add Label
            </button>
          )}
        </RowLabelDropdown>
      </div>

      <div className={styles.cellActions} onClick={e => e.stopPropagation()}>
        <RowActionMenu task={task} />
      </div>
    </div>
  );
}

/* ── List View: Status Group ── */
const PAGE_SIZE = 5;

function StatusGroup({ status, label: labelProp, tasks, onToggle, onTaskClick, hideAssignedTo, onAddTask }) {
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState(0);
  const label = labelProp || STATUS_LABELS[status];
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  // Reset to a valid page when the task list shrinks/grows past current page
  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);
  const paginated = tasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className={styles.statusGroup}>
      <div className={styles.groupHeader} onClick={() => setCollapsed(v => !v)}>
        <div className={styles.groupHeaderLeft}>
          <span className={styles.groupTitle}>{label}</span>
          <Badge variant="overflow" label={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`} />
        </div>
        <div className={styles.groupActions}>
          <ActionButton
            icon="solar:add-circle-linear"
            size="S"
            tooltip="Add task"
            onClick={e => { e.stopPropagation(); onAddTask?.(status); }}
          />
          <div style={{ width: 0.5, height: 16, background: 'var(--neutral-150)' }} />
          <ActionButton
            icon={collapsed ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'}
            size="S"
            tooltip={collapsed ? 'Expand' : 'Collapse'}
            onClick={e => { e.stopPropagation(); setCollapsed(v => !v); }}
          />
        </div>
      </div>
      {!collapsed && (
        <>
          {paginated.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} onTaskClick={onTaskClick} hideAssignedTo={hideAssignedTo} />)}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <Icon name="solar:alt-arrow-left-linear" size={14} />
              </button>
              <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
              <button className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <Icon name="solar:alt-arrow-right-linear" size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Kanban View: Card content (shared between real card and drag overlay) ── */
function KanbanCardContent({ task }) {
  const isCompleted = task.status === 'completed';
  const labels = Array.isArray(task.labels) ? task.labels : [];
  const memberInitials = task.member ? task.member.split(' ').map(w => w[0]).join('').slice(0, 2) : '';
  const assigneeInitials = task.assigned_to ? task.assigned_to.split(' ').map(w => w[0]).join('').slice(0, 2) : '';

  return (
    <>
      {/* Left priority color bar */}
      <div className={styles.cardBar}>
        <div
          className={styles.cardBarInner}
          style={{ background: PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.none }}
        />
      </div>

      {/* Card body */}
      <div className={styles.cardBody}>
        {/* Row 1: Priority icon + due date + checkbox */}
        <div className={styles.cardTop}>
          <div className={styles.cardTopLeft}>
            <PriorityIcon priority={task.priority} size={16} />
            <span className={`${styles.cardDue} ${isOverdue(task) ? styles.cardDueMissed : ''}`}>
              Due : {formatDateFriendly(task.due_date) === 'Today' || formatDateFriendly(task.due_date) === 'Tomorrow' || formatDateFriendly(task.due_date) === 'Yesterday' ? formatDateFriendly(task.due_date) : task.due_date}
            </span>
          </div>
          <button
            className={`${styles.taskCheckbox} ${isCompleted ? styles.taskCheckboxChecked : ''}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {isCompleted && <Icon name="solar:check-read-linear" size={13} color="#fff" />}
          </button>
        </div>

        {/* Row 2: Parent task (if subtask) */}
        {task.is_subtask && task.parent_task && (
          <span className={styles.cardParent}>
            <SubtaskIcon size={12} color="var(--primary-300)" />
            {task.parent_task}
          </span>
        )}

        {/* Row 3: Task title */}
        <span className={`${styles.cardTitle} ${isCompleted ? styles.taskNameDone : ''}`}>{task.name}</span>

        {/* Row 4: Labels */}
        {labels.length > 0 && (
          <div className={styles.cardLabels}>
            {labels.map(l => (
              <Badge key={l} variant="overflow" label={l} />
            ))}
          </div>
        )}

        {/* Row 5: Member (patient) + Assigned to (staff) */}
        <div className={styles.cardPeople}>
          <div className={styles.cardPerson}>
            <Avatar variant="patient" initials={memberInitials} className={styles.avatarXs} />
            <span
              className={`${styles.personName} ${styles.memberLink}`}
              onClick={(e) => {
                e.stopPropagation();
                const state = useAppStore.getState();
                const match = state.patients.find(p => p.name === task.member)
                  || (state.allPatients || []).find(p => p.name === task.member);
                if (match) state.openQuickView(match);
              }}
            >
              {task.member}
            </span>
            <Icon name="solar:arrow-right-up-linear" size={16} color="var(--neutral-200)" />
          </div>
          {task.assigned_to && (
            <div className={styles.cardPerson}>
              <Avatar variant="assignee" initials={assigneeInitials} className={styles.avatarXs} />
              <span className={styles.personName}>{task.assigned_to}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={styles.cardDivider} />

        {/* Row 6: Meta + linked counts */}
        <div className={styles.cardFooterRow}>
          <span className={styles.cardFooterMeta}>
            {task.is_subtask && task.parent_task ? (task.created_by ? `By : ${task.created_by}` : '') : task.meta}
          </span>
          <div className={styles.cardLinked}>
            {task.is_subtask && (
              <span className={styles.linkedItem}>
                <SubtaskIcon size={16} color="var(--primary-300)" />
                1
              </span>
            )}
            {task.attachments > 0 && (
              <span className={styles.linkedItem}>
                <Icon name="solar:paperclip-linear" size={16} color="var(--neutral-300)" />
                {task.attachments}
              </span>
            )}
            {task.comments > 0 && (
              <span className={styles.linkedItem}>
                <Icon name="solar:chat-round-line-linear" size={16} color="var(--neutral-300)" />
                {task.comments}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action menu */}
      <div className={styles.cardActionMenu} onClick={e => e.stopPropagation()}>
        <RowActionMenu task={task} />
      </div>
    </>
  );
}

/* ── Kanban View: Draggable Card ── */
function DraggableKanbanCard({ task, onToggle, onTaskClick }) {
  const wasDragging = useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: String(task.id),
    data: { type: 'task', task, status: task.status },
  });

  useEffect(() => {
    if (isDragging) wasDragging.current = true;
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleClick = useCallback(() => {
    if (wasDragging.current) {
      wasDragging.current = false;
      return;
    }
    onTaskClick?.(task);
  }, [task, onTaskClick]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.kanbanCard} ${isDragging ? styles.kanbanCardDragging : ''}`}
      {...attributes}
      {...listeners}
      onClick={handleClick}
    >
      <KanbanCardContent task={task} />
    </div>
  );
}

/* ── Kanban View: Droppable Column ── */
function DroppableKanbanColumn({ status, tasks, onToggle, onTaskClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: 'column', status },
  });

  return (
    <div className={`${styles.kanbanColumn} ${isOver ? styles.kanbanColumnOver : ''}`}>
      <div className={styles.kanbanColumnHeader}>
        <div className={styles.kanbanColumnTitle}>
          <span
            className={styles.kanbanStatusDot}
            style={{ background: STATUS_COLORS[status] }}
          />
          <span className={styles.kanbanStatusLabel}>{STATUS_LABELS[status]}</span>
          <Badge variant="overflow" label={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`} />
        </div>
        <div className={styles.kanbanColumnActions}>
          <span className={styles.kanbanSort}>Due Date</span>
          <Icon name="solar:alt-arrow-down-linear" size={14} color="var(--neutral-300)" />
          <ActionButton icon="solar:add-circle-linear" size="S" tooltip="Add task" />
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`${styles.kanbanCards} ${isOver ? styles.kanbanCardsOver : ''}`}
        data-status={status}
      >
        {tasks.map(t => (
          <DraggableKanbanCard key={t.id} task={t} onToggle={onToggle} onTaskClick={onTaskClick} />
        ))}
        {tasks.length === 0 && (
          <div className={styles.kanbanDropHint}>
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Kanban Board with DnD ── */
function KanbanBoard({ kanbanGroups, onToggle, onStatusChange, onTaskClick }) {
  const [activeTask, setActiveTask] = useState(null);
  const [overColumn, setOverColumn] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const allTasks = useMemo(() => {
    const map = {};
    kanbanGroups.forEach(g => g.tasks.forEach(t => { map[String(t.id)] = t; }));
    return map;
  }, [kanbanGroups]);

  const handleDragStart = useCallback((event) => {
    const task = allTasks[event.active.id];
    if (task) setActiveTask(task);
  }, [allTasks]);

  const resolveStatus = useCallback((over) => {
    if (!over) return null;
    const overData = over.data?.current;
    if (overData?.type === 'column') return overData.status;
    if (overData?.type === 'task') return overData.status;
    return null;
  }, []);

  const handleDragOver = useCallback((event) => {
    setOverColumn(resolveStatus(event.over));
  }, [resolveStatus]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumn(null);

    if (!over || !active) return;

    const draggedTask = allTasks[active.id];
    if (!draggedTask) return;

    const targetStatus = resolveStatus(over);
    if (targetStatus && targetStatus !== draggedTask.status) {
      onStatusChange(draggedTask.id, targetStatus);
    }
  }, [allTasks, resolveStatus, onStatusChange]);

  const customCollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCenter(args);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.kanbanWrap}>
        {kanbanGroups.map(g => (
          <DroppableKanbanColumn
            key={g.status}
            status={g.status}
            tasks={g.tasks}
            onToggle={onToggle}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{
        duration: 200,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeTask && (
          <div className={`${styles.kanbanCard} ${styles.kanbanCardOverlay}`}>
            <KanbanCardContent task={activeTask} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Empty State ── */
function EmptyState({ title, description, icon }) {
  return (
    <div className={styles.emptyState}>
      <Icon name={icon || 'solar:inbox-linear'} size={48} color="var(--neutral-200)" />
      <span className={styles.emptyTitle}>{title}</span>
      <span className={styles.emptyDescription}>{description}</span>
    </div>
  );
}

/* ── Add Task Drawer ── */
function AddTaskDrawer({ onClose, defaultStatus, initialMember, onTaskCreated }) {
  const initialStatus = defaultStatus || 'pending';
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState(initialStatus);
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [member, setMember] = useState(initialMember || '');
  const [pool, setPool] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const editorRef = useRef(null);

  const createTask = useAppStore(s => s.createTask);
  const showToast = useAppStore(s => s.showToast);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const allPatients = useAppStore(s => s.allPatients);
  const taskPools = useAppStore(s => s.taskPools);

  const assigneeOptions = useMemo(() => {
    const list = [];
    const seenNames = new Set();
    if (currentUserProfile && currentUserProfile.name) {
      list.push({ value: currentUserProfile.name, label: `${currentUserProfile.name} (You)` });
      seenNames.add(currentUserProfile.name);
    }
    (taskProfiles || []).forEach(p => {
      if (seenNames.has(p.name)) return;
      list.push({ value: p.name, label: p.name });
      seenNames.add(p.name);
    });
    if (list.length === 0) return ASSIGNEE_OPTIONS.map(n => ({ value: n, label: n }));
    return list;
  }, [taskProfiles, currentUserProfile]);

  const memberOptions = useMemo(() => {
    const names = (allPatients || []).map(p => p.name).filter(Boolean);
    return names.length > 0 ? names : MEMBER_OPTIONS;
  }, [allPatients]);

  const isDirty =
    name.trim() !== '' ||
    dueDate !== '' ||
    assignedTo !== '' ||
    member !== '' ||
    pool !== '' ||
    description.replace(/<[^>]*>/g, '').trim() !== '' ||
    selectedLabels.length > 0 ||
    priority !== 'medium' ||
    status !== initialStatus;

  const canSave = name.trim() !== '' && isDirty && name.length <= TITLE_MAX;

  const handleSave = async () => {
    if (!canSave) return;
    const me = currentUserProfile?.name || 'Dr. JeDee Potter';
    const meId = currentUserProfile?.id || null;
    // Resolve the picked assignee's profile id by name (taskProfiles
    // is the same dropdown source). Falls back to the current user.
    const pickedAssignee = assignedTo
      ? (taskProfiles || []).find(p => p.name === assignedTo)
      : null;
    const finalAssigneeName = pool ? null : (assignedTo || me);
    const finalAssigneeId = pool
      ? null
      : (pickedAssignee?.id || (assignedTo === me ? meId : null) || meId);
    const task = {
      name: name.trim().slice(0, TITLE_MAX),
      status,
      priority,
      due_date: dueDate || todayMMDDYYYY(),
      assigned_to: finalAssigneeName,
      assigned_to_id: finalAssigneeId,
      member: member || (allPatients?.[0]?.name) || 'Celia Gerhold',
      labels: selectedLabels,
      meta: pool ? `Pool : ${pool}` : '',
      description: description || '',
      pool: pool || null,
      mentions: [],
      attachments: 0,
      comments: 0,
      is_subtask: false,
      parent_task: null,
      parent_task_id: null,
      created_by: me,
      created_by_id: meId,
    };
    const result = await createTask(task);
    if (result) {
      showToast('Task created');
      onTaskCreated?.(result);
    }
  };

  const handleClose = () => {
    if (isDirty) setShowCloseConfirm(true);
    else onClose();
  };

  const toggleLabel = (l) => {
    setSelectedLabels(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  };

  return (
    <>
      <Drawer
        title="Add Task"
        onClose={handleClose}
        headerRight={
          <Button variant="primary" size="L" disabled={!canSave} onClick={handleSave}>
            Save Task
          </Button>
        }
      >
        <div className={styles.drawerContent}>
          {/* Task Name */}
          <div className={styles.drawerSection}>
            <span className={styles.drawerSectionLabel}>Task Name</span>
            <input
              className={`${styles.drawerTaskTitleInput} ${name.length > TITLE_MAX ? styles.inputInvalid : ''}`}
              style={{ margin: 0, width: '100%' }}
              placeholder="Enter task name..."
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            <div className={styles.fieldHelper}>
              <span className={styles.fieldError}>
                {name.length > TITLE_MAX ? `Title must be ${TITLE_MAX} characters or fewer` : ''}
              </span>
              <span className={`${styles.charCount} ${name.length > TITLE_MAX ? styles.charCountOver : ''}`}>
                {name.length}/{TITLE_MAX}
              </span>
            </div>
          </div>

          {/* Detail rows */}
          <div className={styles.drawerDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Status</span>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-sm w-[140px]" style={{ background: 'white' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Task Pool</span>
              <DetailDropdown
                value={pool}
                options={['— Direct assign —', ...(taskPools || []).map(p => p.name)]}
                onSelect={v => setPool(v === '— Direct assign —' ? '' : v)}
              >
                <span style={{ color: pool ? 'var(--neutral-400)' : 'var(--neutral-200)' }}>
                  {pool || '— Direct assign —'}
                </span>
              </DetailDropdown>
            </div>
            {!pool && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Assigned To</span>
                <DetailDropdown
                  value={assignedTo}
                  options={assigneeOptions}
                  onSelect={setAssignedTo}
                  renderOption={opt => {
                    const label = typeof opt === 'string' ? opt : opt.label;
                    const val = typeof opt === 'string' ? opt : opt.value;
                    const initials = (val || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <>
                        <Avatar variant="assignee" initials={initials} className={styles.avatarXs} />
                        <span>{label}</span>
                      </>
                    );
                  }}
                >
                  {assignedTo ? (
                    <>
                      <Avatar variant="assignee" initials={(assignedTo || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} className={styles.avatarXs} />
                      <span>{currentUserProfile?.name === assignedTo ? `${assignedTo} (You)` : assignedTo}</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--neutral-200)' }}>Select assignee</span>
                  )}
                </DetailDropdown>
              </div>
            )}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Due Date</span>
              <TaskDatePicker value={dueDate} onSelect={setDueDate} />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Priority</span>
              <DetailDropdown
                value={priority}
                options={PRIORITY_OPTIONS}
                onSelect={setPriority}
                renderOption={opt => (
                  <><PriorityIcon priority={opt} size={16} /> <span style={{ textTransform: 'capitalize' }}>{opt}</span></>
                )}
              >
                <PriorityIcon priority={priority} size={16} />
                <span style={{ textTransform: 'capitalize' }}>{priority}</span>
              </DetailDropdown>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Member</span>
              <DetailDropdown
                value={member}
                options={memberOptions}
                onSelect={setMember}
                renderOption={opt => {
                  const val = typeof opt === 'string' ? opt : opt.value;
                  const initials = (val || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <>
                      <Avatar variant="patient" initials={initials} className={styles.avatarXs} />
                      <span>{val}</span>
                    </>
                  );
                }}
              >
                {member ? (
                  <>
                    <Avatar variant="patient" initials={(member || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()} className={styles.avatarXs} />
                    <span>{member}</span>
                  </>
                ) : (
                  <span style={{ color: 'var(--neutral-200)' }}>Select member</span>
                )}
              </DetailDropdown>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Labels</span>
              <div className={styles.detailValueLabels}>
                {selectedLabels.map(l => (
                  <Badge key={l} variant="overflow" label={l} trailingIcon="solar:close-circle-linear" onClick={() => toggleLabel(l)} />
                ))}
                <CreatableLabelDropdown selectedLabels={selectedLabels} onToggle={toggleLabel} />
              </div>
            </div>
          </div>

          {/* Description with rich text editor */}
          <div className={styles.drawerSection}>
            <span className={styles.drawerSectionLabel}>Description</span>
            <div className={styles.descEditor}>
              <div
                ref={editorRef}
                className={styles.descEditable}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Add a description..."
                onInput={e => setDescription(e.currentTarget.innerHTML)}
              />
              <div className={styles.descToolbar}>
                <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
                <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
                <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
                <ActionButton icon="solar:text-cross-linear" size="S" tooltip="Strikethrough" onClick={() => document.execCommand('strikeThrough')} />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
              </div>
            </div>
          </div>
        </div>
      </Drawer>
      {showCloseConfirm && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-warning)"
          title="Discard unsaved task?"
          description="You have unsaved changes. Closing now will discard them."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          variant="error"
          onConfirm={() => { setShowCloseConfirm(false); onClose(); }}
          onCancel={() => setShowCloseConfirm(false)}
        />
      )}
    </>
  );
}

/* ── Task Detail Drawer ── */
const ASSIGNEE_OPTIONS = ['Dr. JeDee Potter', 'Deborah Hintz', 'Dr. Robert Frost', 'Celia Gerhold'];
const TASK_POOL_OPTIONS = ['Patient Outreach', 'Care Management', 'Follow-up', 'Documentation'];
const MEMBER_OPTIONS = ['Celia Gerhold', 'Ralph Kessler', 'Robert Langdon', 'Cameron Haley'];
const PRIORITY_OPTIONS = ['high', 'medium', 'low'];
const LABEL_OPTIONS = ['Hypertension', 'Exercise', 'Document Collection', 'Medication', 'Diabetes', 'Follow-up'];

function CreatableLabelDropdown({ selectedLabels, onToggle, children }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);
  const taskLabels = useAppStore(s => s.taskLabels);
  const createTaskLabel = useAppStore(s => s.createTaskLabel);
  const showToast = useAppStore(s => s.showToast);

  const filtered = taskLabels.filter(l => !search || l.toLowerCase().includes(search.toLowerCase()));
  const exact = taskLabels.find(l => l.toLowerCase() === search.trim().toLowerCase());
  const canCreate = search.trim() && !exact;

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
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => { setOpen(false); setSearch(''); }}>
          <div
            className={styles.simpleDropdown}
            style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.dropdownSearch}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
              <input
                className={styles.dropdownSearchInput}
                placeholder="Search or create..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
                autoFocus
              />
            </div>
            {filtered.map(l => (
              <button key={l} className={styles.simpleDropItem} onClick={() => onToggle(l)}>
                <input type="checkbox" checked={selectedLabels.includes(l)} readOnly style={{ accentColor: 'var(--primary-300)', width: 15, height: 15, flexShrink: 0 }} />
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

function DetailDropdown({ value, options, onSelect, icon, renderOption, children, searchable = true, multiSelect, selected = [] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);

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
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => { setOpen(false); setSearch(''); }}>
          <div
            className={styles.simpleDropdown}
            style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            {searchable && options.length > 3 && (
              <div className={styles.dropdownSearch}>
                <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
                <input className={styles.dropdownSearchInput} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
              </div>
            )}
            {filtered.map(opt => {
              const label = typeof opt === 'string' ? opt : opt.label;
              const val = typeof opt === 'string' ? opt : opt.value;
              const isChecked = multiSelect && selected.includes(val);
              return (
                <button key={val} className={styles.simpleDropItem} onClick={() => {
                  onSelect(val);
                  if (!multiSelect) { setOpen(false); setSearch(''); }
                }}>
                  {multiSelect && <input type="checkbox" checked={isChecked} readOnly style={{ accentColor: 'var(--primary-300)', width: 15, height: 15, flexShrink: 0 }} />}
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

const ACTIVITY_LOGS = [
  { user: 'John Doe', initials: 'JD', action: 'added a', target: 'Comment', type: 'comment', body: 'All patients who have been either admitted or discharged within last 29 days.' },
  { user: 'John Doe', initials: 'JD', action: 'changed the', target: 'Status', type: 'status', from: 'Pending', to: 'Completed' },
  { user: 'John Doe', initials: 'JD', action: 'changed the', target: 'Priority', type: 'priority', from: 'High', to: 'Medium' },
  { user: 'John Doe', initials: 'JD', action: 'added the', target: 'Description', type: 'description', from: 'None', to: 'Please collect the medication documents and gather before the appointment' },
  { user: 'John Doe', initials: 'JD', action: 'created the task.', target: '', type: 'created' },
];

const TITLE_MAX = 200;

function TaskDetailDrawer({ task, onClose, onSelectTask }) {
  const [activityTab, setActivityTab] = useState('All');
  const [activityToggle, setActivityToggle] = useState('Activity');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentExpanded, setCommentExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [subtaskName, setSubtaskName] = useState('');
  const titleRef = useRef(null);
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const createTask = useAppStore(s => s.createTask);
  const claimTask = useAppStore(s => s.claimTask);
  const showToast = useAppStore(s => s.showToast);
  const allTasks = useAppStore(s => s.tasks);
  const taskAuditLogs = useAppStore(s => s.taskAuditLogs);
  const fetchTaskAuditLog = useAppStore(s => s.fetchTaskAuditLog);
  const logTaskAudit = useAppStore(s => s.logTaskAudit);
  const taskPools = useAppStore(s => s.taskPools);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const allPatients = useAppStore(s => s.allPatients);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);

  useEffect(() => { if (task?.id) fetchTaskAuditLog(task.id); }, [task?.id]);

  if (!task) return null;

  const labels = Array.isArray(task.labels) ? task.labels : [];
  const memberInitials = task.member ? task.member.split(' ').map(w => w[0]).join('').slice(0, 2) : '';
  const assigneeInitials = task.assigned_to ? task.assigned_to.split(' ').map(w => w[0]).join('').slice(0, 2) : '';
  const subtasks = allTasks.filter(t => t.parent_task_id === task.id || (t.is_subtask && t.parent_task === task.name));
  const completedSubs = subtasks.filter(t => t.status === 'completed').length;
  const auditLog = taskAuditLogs[task.id] || [];

  // Dynamic dropdown sources — same shape as the AddTaskDrawer.
  const assigneeNames = (() => {
    const seen = new Set();
    const list = [];
    if (currentUserProfile?.name) { list.push(currentUserProfile.name); seen.add(currentUserProfile.name); }
    (taskProfiles || []).forEach(p => { if (p.name && !seen.has(p.name)) { list.push(p.name); seen.add(p.name); } });
    return list.length > 0 ? list : ASSIGNEE_OPTIONS;
  })();
  const memberNames = ((allPatients || []).map(p => p.name).filter(Boolean));
  const memberOptionsForDrawer = memberNames.length > 0 ? memberNames : MEMBER_OPTIONS;

  const handleStatusChange = (newStatus) => {
    if (newStatus === 'completed' && subtasks.length > 0 && completedSubs < subtasks.length) {
      showToast(`Cannot complete: ${subtasks.length - completedSubs} subtask(s) still open`);
      return;
    }
    updateTask(task.id, { status: newStatus });
    showToast(`Status changed to ${STATUS_LABELS[newStatus]}`);
  };

  const handleTitleSave = () => {
    const trimmed = titleDraft.trim().slice(0, TITLE_MAX);
    if (trimmed && trimmed !== task.name) {
      updateTask(task.id, { name: trimmed });
      showToast('Title updated');
    }
    setEditingTitle(false);
  };

  const handleAddSubtask = async () => {
    const trimmed = subtaskName.trim();
    if (!trimmed) return;
    const sub = {
      name: trimmed.slice(0, TITLE_MAX),
      status: 'pending',
      priority: task.priority || 'medium',
      due_date: task.due_date || todayMMDDYYYY(),
      assigned_to: task.assigned_to || currentUserProfile?.name || null,
      // Inherit assignee FK from parent when present, otherwise the
      // current user; either way keeps the new id-based filter honest.
      assigned_to_id: task.assigned_to_id || currentUserProfile?.id || null,
      member: task.member,
      labels: [],
      parent_task: task.name,
      parent_task_id: task.id,
      is_subtask: true,
      attachments: 0,
      comments: 0,
      meta: '',
      description: '',
      pool: null,
      mentions: [],
      created_by: currentUserProfile?.name || 'Current User',
      created_by_id: currentUserProfile?.id || null,
    };
    const created = await createTask(sub);
    if (created) {
      logTaskAudit(task.id, 'subtask_added', { to: trimmed });
      setSubtaskName('');
      setShowAddSubtask(false);
      showToast('Subtask added');
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    await deleteTask(task.id);
    showToast('Task deleted');
    onClose();
  };

  const handleClaim = async () => {
    await claimTask(task.id);
    showToast('Task claimed');
  };

  const handleAddComment = () => {
    const text = commentText.trim();
    if (!text) return;
    const mentions = (text.match(/@(\w+(?:\s+\w+)?)/g) || []).map(m => m.slice(1).trim());
    logTaskAudit(task.id, 'comment_added', { to: text });
    if (mentions.length > 0) {
      const existingMentions = Array.isArray(task.mentions) ? task.mentions : [];
      const newMentions = [...new Set([...existingMentions, ...mentions])];
      updateTask(task.id, { mentions: newMentions });
    }
    showToast('Comment added');
    setCommentText('');
    setCommentExpanded(false);
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleTitleSave(); }
    if (e.key === 'Escape') setEditingTitle(false);
  };

  const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2) : '';

  return (
    <Drawer title="Task Details" onClose={onClose}>
      <div className={styles.drawerContent}>
        {/* Toolbar */}
        <div className={styles.drawerToolbar}>
          <Select value={task.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-8 text-sm w-[120px]" style={{ background: 'white' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className={styles.drawerToolbarRight}>
            {task.pool && !task.assigned_to && (
              <Button variant="primary" size="S" onClick={handleClaim}>Claim Task</Button>
            )}
            <ActionButton icon="solar:paperclip-linear" size="L" tooltip="Attachments" />
            <span className={styles.iconDivider} />
            <ActionButton icon="solar:link-minimalistic-linear" size="L" tooltip="Copy link" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/#/tasks?taskId=${task.id}`); showToast('Link copied'); }} />
            <span className={styles.iconDivider} />
            <ActionButton icon="solar:clipboard-text-linear" size="L" tooltip="Copy ID" onClick={() => { navigator.clipboard?.writeText(String(task.id)); showToast('ID copied'); }} />
            <span className={styles.iconDivider} />
            <ActionButton icon="solar:trash-bin-trash-linear" size="L" tooltip="Delete" onClick={() => setShowDeleteConfirm(true)} />
          </div>
        </div>

        {/* Label + Title */}
        <div className={styles.drawerTitleBlock}>
          {task.is_subtask && task.parent_task && (
            <Badge variant="overflow" label={task.parent_task} />
          )}
          {labels.length > 0 && !task.is_subtask && (
            <Badge variant="overflow" label={labels[0]} />
          )}
          {editingTitle ? (
            <input
              ref={titleRef}
              className={styles.drawerTaskTitleInput}
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              autoFocus
            />
          ) : (
            <h3
              className={styles.drawerTaskTitle}
              onClick={() => { setTitleDraft(task.name); setEditingTitle(true); }}
            >
              {task.name}
            </h3>
          )}
        </div>

        {/* Detail rows */}
        <div className={styles.drawerDetails}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Assigned To</span>
            <DetailDropdown
              value={task.assigned_to}
              options={assigneeNames}
              onSelect={v => {
                const picked = (taskProfiles || []).find(p => p.name === v);
                updateTask(task.id, { assigned_to: v, assigned_to_id: picked?.id || null });
                showToast(`Assigned to ${v}`);
              }}
              renderOption={opt => (
                <><Avatar variant="assignee" initials={getInitials(opt)} className={styles.avatarXs} /> {opt}</>
              )}
            >
              <Avatar variant="assignee" initials={assigneeInitials} className={styles.avatarXs} />
              <span>{task.assigned_to || '—'}</span>
            </DetailDropdown>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Task Pool</span>
            <DetailDropdown
              value={task.pool || '— None —'}
              options={['— None —', ...taskPools.map(p => p.name)]}
              onSelect={v => {
                const next = v === '— None —' ? null : v;
                updateTask(task.id, { pool: next });
                showToast(next ? `Pool set to ${next}` : 'Removed from pool');
              }}
            />
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Due Date</span>
            <TaskDatePicker value={task.due_date} overdue={isOverdue(task)} onSelect={v => { updateTask(task.id, { due_date: v }); showToast('Due date updated'); }} />
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Priority</span>
            <DetailDropdown
              value={task.priority}
              options={PRIORITY_OPTIONS}
              onSelect={v => { updateTask(task.id, { priority: v }); showToast(`Priority set to ${v}`); }}
              renderOption={opt => (
                <><PriorityIcon priority={opt} size={16} /> <span style={{ textTransform: 'capitalize' }}>{opt}</span></>
              )}
            >
              <PriorityIcon priority={task.priority} size={16} />
              <span style={{ textTransform: 'capitalize' }}>{task.priority}</span>
            </DetailDropdown>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Member</span>
            <DetailDropdown
              value={task.member}
              options={memberOptionsForDrawer}
              onSelect={v => { updateTask(task.id, { member: v }); showToast(`Member set to ${v}`); }}
              renderOption={opt => (
                <><Avatar variant="patient" initials={getInitials(opt)} className={styles.avatarXs} /> {opt}</>
              )}
            >
              <Avatar variant="patient" initials={memberInitials} className={styles.avatarXs} />
              <span>{task.member}</span>
            </DetailDropdown>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Labels</span>
            <div className={styles.detailValueLabels}>
              {labels.map(l => (
                <Badge
                  key={l}
                  variant="overflow"
                  label={l}
                  trailingIcon="solar:close-circle-linear"
                  onClick={() => {
                    updateTask(task.id, { labels: labels.filter(x => x !== l) });
                    showToast(`Label "${l}" removed`);
                  }}
                />
              ))}
              <DetailDropdown
                value=""
                options={LABEL_OPTIONS.filter(l => !labels.includes(l))}
                onSelect={v => {
                  updateTask(task.id, { labels: [...labels, v] });
                  showToast(`Label "${v}" added`);
                }}
              >
                <Icon name="solar:add-circle-linear" size={14} color="var(--neutral-200)" />
              </DetailDropdown>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className={styles.drawerSection}>
          <span className={styles.drawerSectionLabel}>Description</span>
          {editingDesc ? (
            <div className={styles.descEditor}>
              <div
                className={styles.descEditable}
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: descDraft }}
                onInput={e => setDescDraft(e.currentTarget.innerHTML)}
              />
              <div className={styles.descToolbar}>
                <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
                <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
                <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
                <ActionButton icon="solar:text-cross-linear" size="S" tooltip="Strikethrough" onClick={() => document.execCommand('strikeThrough')} />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
                <div style={{ flex: 1 }} />
                <ActionButton icon="solar:close-circle-linear" size="S" tooltip="Discard" onClick={() => setEditingDesc(false)} />
                <ActionButton icon="solar:check-read-linear" size="S" tooltip="Save" onClick={() => { updateTask(task.id, { description: descDraft }); setEditingDesc(false); showToast('Description saved'); }} />
              </div>
            </div>
          ) : (
            <div
              className={styles.descriptionBox}
              onClick={() => { setDescDraft(task.description || ''); setEditingDesc(true); }}
              dangerouslySetInnerHTML={{ __html: task.description || '<span style="color: var(--neutral-200);">Click to add description...</span>' }}
            />
          )}
        </div>

        {/* Subtasks — show progress + list of children, allow adding new ones */}
        {!task.is_subtask && (
          <div className={styles.drawerSection}>
            <div className={styles.subtaskHeader}>
              <h4 className={styles.drawerSectionTitle}>
                Subtasks {subtasks.length > 0 && <span className={styles.subtaskCount}>{completedSubs}/{subtasks.length}</span>}
              </h4>
              <button className={styles.subtaskAddBtn} onClick={() => setShowAddSubtask(v => !v)}>
                <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
                Add Subtask
              </button>
            </div>
            {subtasks.length > 0 && (
              <div className={styles.subtaskProgressBar}>
                <div className={styles.subtaskProgressFill} style={{ width: `${(completedSubs / subtasks.length) * 100}%` }} />
              </div>
            )}
            {showAddSubtask && (
              <div className={styles.subtaskAddRow}>
                <input
                  className={styles.subtaskAddInput}
                  placeholder="Enter subtask name..."
                  maxLength={TITLE_MAX}
                  value={subtaskName}
                  onChange={e => setSubtaskName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setShowAddSubtask(false); setSubtaskName(''); } }}
                  autoFocus
                />
                <Button variant="primary" size="S" onClick={handleAddSubtask} disabled={!subtaskName.trim()}>Add</Button>
                <Button variant="secondary" size="S" onClick={() => { setShowAddSubtask(false); setSubtaskName(''); }}>Cancel</Button>
              </div>
            )}
            {subtasks.map(sub => (
              <div key={sub.id} className={styles.subtaskCard} onClick={() => onSelectTask?.(sub)}>
                <button
                  className={`${styles.taskCheckbox} ${sub.status === 'completed' ? styles.taskCheckboxChecked : ''}`}
                  aria-label={sub.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
                  onClick={e => {
                    e.stopPropagation();
                    updateTask(sub.id, { status: sub.status === 'completed' ? 'pending' : 'completed' });
                  }}
                >
                  {sub.status === 'completed' && <Icon name="solar:check-read-linear" size={13} color="#fff" />}
                </button>
                <div className={styles.subtaskCardBody}>
                  <div className={styles.subtaskCardRow}>
                    <PriorityIcon priority={sub.priority} size={16} />
                    <span className={`${styles.subtaskCardName} ${sub.status === 'completed' ? styles.subtaskCardNameDone : ''}`}>{sub.name}</span>
                    <Badge variant={STATUS_BADGE_VARIANTS[sub.status]} label={STATUS_LABELS[sub.status]} />
                    <span className={`${styles.subtaskCardDate} ${isOverdue(sub) ? styles.dueMissed : ''}`}>
                      {formatDateFriendly(sub.due_date)}
                    </span>
                  </div>
                  {(sub.attachments > 0 || sub.comments > 0) && (
                    <div className={styles.subtaskCardAttachments}>
                      {sub.attachments > 0 && (
                        <span className={styles.linkedItem}>
                          <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
                          {sub.attachments}
                        </span>
                      )}
                      {sub.comments > 0 && (
                        <span className={styles.linkedItem}>
                          <Icon name="solar:chat-round-line-linear" size={14} color="var(--neutral-300)" />
                          {sub.comments}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {subtasks.length === 0 && !showAddSubtask && (
              <div className={styles.subtaskEmpty}>No subtasks yet. Break this task down into smaller steps.</div>
            )}
          </div>
        )}
        {task.is_subtask && task.parent_task && (
          <div className={styles.drawerSection}>
            <span className={styles.drawerSectionLabel}>Parent Task</span>
            <button
              className={styles.subtaskParentLink}
              onClick={() => {
                const parent = allTasks.find(t => t.id === task.parent_task_id);
                if (parent) onSelectTask?.(parent);
              }}
            >
              <Icon name="solar:link-minimalistic-linear" size={14} color="var(--primary-300)" />
              {task.parent_task}
            </button>
          </div>
        )}

        {/* Activity */}
        <div className={styles.drawerSection}>
          <div className={styles.activityHeader}>
            <Toggle
              items={['Activity', 'Automations']}
              active={activityToggle}
              onChange={setActivityToggle}
              size="S"
            />
          </div>
          <div className={styles.activityTabs}>
            {['All', 'Comments', 'History'].map(tab => (
              <button
                key={tab}
                className={`${styles.activityTabBtn} ${activityTab === tab ? styles.activityTabActive : ''}`}
                onClick={() => setActivityTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Comment input — supports @mentions */}
          <div className={styles.commentInput}>
            <textarea
              placeholder="Add a comment, use @ to mention someone"
              rows={commentExpanded ? 3 : 1}
              className={styles.commentTextarea}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onFocus={() => setCommentExpanded(true)}
            />
            {commentExpanded && (
              <div className={styles.commentActions}>
                <button className={styles.commentCancel} onClick={() => { setCommentExpanded(false); setCommentText(''); }}>Cancel</button>
                <Button variant="primary" size="S" disabled={!commentText.trim()} onClick={handleAddComment}>Comment</Button>
              </div>
            )}
          </div>

          {/* Activity log — real audit entries */}
          <div className={styles.activityLog}>
            {auditLog
              .filter(l => activityTab === 'All'
                || (activityTab === 'Comments' && l.action_type === 'comment_added')
                || (activityTab === 'History' && l.action_type !== 'comment_added'))
              .map((log) => {
                const initials = (log.user_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2);
                const verbMap = {
                  created: 'created the task.',
                  status_changed: 'changed the Status',
                  priority_changed: 'changed the Priority',
                  due_date_changed: 'changed the Due Date',
                  assignee_changed: 'changed the Assignee',
                  label_added: 'added a Label',
                  label_removed: 'removed a Label',
                  description_changed: 'updated the Description',
                  renamed: 'renamed the task',
                  comment_added: 'added a Comment',
                  subtask_added: 'added a Subtask',
                  claimed: 'claimed the task',
                  deleted: 'deleted the task',
                };
                return (
                  <div key={log.id} className={styles.logEntry}>
                    <Avatar variant="patient" initials={initials} className={styles.avatarXs} />
                    <div className={styles.logBody}>
                      <div className={styles.logAction}>
                        <span className={styles.logUser}>{log.user_name}</span>
                        <span>{verbMap[log.action_type] || log.action_type}</span>
                      </div>
                      {log.action_type === 'comment_added' && log.to_value && (
                        <div className={styles.logComment}>
                          <p>{log.to_value}</p>
                        </div>
                      )}
                      {log.action_type === 'status_changed' && log.from_value && log.to_value && (
                        <div className={styles.logChange}>
                          <Badge variant={STATUS_BADGE_VARIANTS[log.from_value] || 'overflow'} label={STATUS_LABELS[log.from_value] || log.from_value} />
                          <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-200)" />
                          <Badge variant={STATUS_BADGE_VARIANTS[log.to_value] || 'overflow'} label={STATUS_LABELS[log.to_value] || log.to_value} />
                        </div>
                      )}
                      {log.action_type === 'priority_changed' && (
                        <div className={styles.logChange}>
                          <div className={styles.logChangeItem}>
                            <PriorityIcon priority={log.from_value} size={16} />
                            <span style={{ textTransform: 'capitalize' }}>{log.from_value}</span>
                          </div>
                          <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-200)" />
                          <div className={styles.logChangeItem}>
                            <PriorityIcon priority={log.to_value} size={16} />
                            <span style={{ textTransform: 'capitalize' }}>{log.to_value}</span>
                          </div>
                        </div>
                      )}
                      {(log.action_type === 'due_date_changed' || log.action_type === 'assignee_changed' || log.action_type === 'renamed' || log.action_type === 'label_added' || log.action_type === 'label_removed' || log.action_type === 'subtask_added' || log.action_type === 'claimed') && (
                        <div className={styles.logChange}>
                          {log.from_value && <span className={styles.logChangeText}>{log.from_value}</span>}
                          {log.from_value && log.to_value && <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-200)" />}
                          {log.to_value && <span className={styles.logChangeText}>{log.to_value}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            {auditLog.length === 0 && (
              <div className={styles.subtaskEmpty}>No activity yet.</div>
            )}
          </div>
        </div>
      </div>
      {showDeleteConfirm && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title="Delete this task?"
          description={subtasks.length > 0 ? `This task has ${subtasks.length} subtask(s). Deleting it will also delete all subtasks. This cannot be undone.` : 'This action cannot be undone.'}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="error"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </Drawer>
  );
}

/* ── Main View ── */
export function TasksView() {
  const tasks = useAppStore(s => s.tasks);
  const tasksLoading = useAppStore(s => s.tasksLoading);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const updateTask = useAppStore(s => s.updateTask);
  const tasksTab = useAppStore(s => s.tasksTab);
  const setTasksTab = useAppStore(s => s.setTasksTab);
  const tasksFilters = useAppStore(s => s.tasksFilters);
  const setTasksFilter = useAppStore(s => s.setTasksFilter);
  const clearTasksFilters = useAppStore(s => s.clearTasksFilters);
  const showTasksFilterBar = useAppStore(s => s.showTasksFilterBar);
  const toggleTasksFilterBar = useAppStore(s => s.toggleTasksFilterBar);
  const tasksViewMode = useAppStore(s => s.tasksViewMode);
  const setTasksViewMode = useAppStore(s => s.setTasksViewMode);
  const showToast = useAppStore(s => s.showToast);
  const createTask = useAppStore(s => s.createTask);
  const pendingAddTask = useAppStore(s => s.pendingAddTask);
  const clearPendingAddTask = useAppStore(s => s.clearPendingAddTask);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [addDrawerStatus, setAddDrawerStatus] = useState('pending');
  const [addDrawerInitialMember, setAddDrawerInitialMember] = useState(null);

  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const fetchTaskLabels = useAppStore(s => s.fetchTaskLabels);
  const fetchTaskPools = useAppStore(s => s.fetchTaskPools);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const allPatients = useAppStore(s => s.allPatients);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);

  useEffect(() => {
    fetchTasks();
    fetchTaskProfiles();
    fetchTaskLabels();
    fetchTaskPools();
    if (!allPatients || allPatients.length === 0) fetchAllPatients();
  }, []);

  useEffect(() => {
    if (!pendingAddTask) return;
    setAddDrawerStatus('pending');
    setAddDrawerInitialMember(pendingAddTask.member || null);
    setShowAddDrawer(true);
    clearPendingAddTask();
  }, [pendingAddTask]);

  // The user-scoped tabs (Assigned / Created / Mentions) require a real
  // signed-in profile to compare against; if there's no auth session
  // those filters short-circuit to an empty set rather than pretending
  // to be the seed user.
  const meId = currentUserProfile?.id || null;
  const meName = currentUserProfile?.name || null;

  // Match by FK first; fall back to name string for legacy rows where the
  // tasks_assignee_id_migration backfill couldn't find a matching profile
  // (e.g. seed rows assigned to "Dr. JeDee Potter"). When a row has BOTH
  // an id and a different-named text value, the id wins.
  const matchAssignee = (t) => {
    if (!meId && !meName) return false;
    if (t.assigned_to_id) return t.assigned_to_id === meId;
    return !!meName && t.assigned_to === meName;
  };
  const matchCreator = (t) => {
    if (!meId && !meName) return false;
    if (t.created_by_id) return t.created_by_id === meId;
    return !!meName && t.created_by === meName;
  };

  // Show all tasks in the list (parents + subtasks). Subtasks render with a
  // "Parent Task : ..." prefix and the subtask icon so they're visually nested.
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (tasksTab === 'all') {
      // No user filter — show every task in the org/DB.
    } else if (tasksTab === 'assigned') {
      result = result.filter(matchAssignee);
    } else if (tasksTab === 'pool') {
      result = result.filter(t => t.pool && !t.assigned_to && !t.assigned_to_id);
    } else if (tasksTab === 'created') {
      result = result.filter(matchCreator);
    } else if (tasksTab === 'mentions') {
      result = meName ? result.filter(t => Array.isArray(t.mentions) && t.mentions.includes(meName)) : [];
    }

    Object.entries(tasksFilters).forEach(([key, value]) => {
      if (!value) return;
      if (key === 'task_status') result = result.filter(t => t.status === value);
      else if (key === 'priority') result = result.filter(t => t.priority === value);
      else if (key === 'assigned_to') {
        // value is a profile.id from the dynamic filter chip; legacy
        // rows without an FK fall back to a name match against the
        // picked profile's display name.
        const pickedName = (taskProfiles || []).find(p => p.id === value)?.name;
        result = result.filter(t =>
          t.assigned_to_id === value || (pickedName && t.assigned_to === pickedName)
        );
      }
      else if (key === 'created_by') {
        const pickedName = (taskProfiles || []).find(p => p.id === value)?.name;
        result = result.filter(t =>
          t.created_by_id === value || (pickedName && t.created_by === pickedName)
        );
      }
      else if (key === 'member') result = result.filter(t => t.member === value);
      else if (key === 'labels') result = result.filter(t => Array.isArray(t.labels) && t.labels.includes(value));
    });

    return result;
  }, [tasks, tasksTab, tasksFilters, meName, taskProfiles]);

  const tabCounts = useMemo(() => ({
    all: tasks.length,
    assigned: tasks.filter(matchAssignee).length,
    pool: tasks.filter(t => t.pool && !t.assigned_to && !t.assigned_to_id).length,
    created: tasks.filter(matchCreator).length,
    mentions: meName ? tasks.filter(t => Array.isArray(t.mentions) && t.mentions.includes(meName)).length : 0,
  }), [tasks, meName]);

  const handleToggle = useCallback((task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTask(task.id, { status: newStatus });
  }, [updateTask]);

  const handleStatusChange = useCallback((taskId, newStatus) => {
    updateTask(taskId, { status: newStatus });
    showToast(`Task moved to ${STATUS_LABELS[newStatus]}`);
  }, [updateTask, showToast]);

  const sortedTasks = useMemo(() => {
    const sortBy = tasksFilters.sort_by;
    if (!sortBy) return filteredTasks;
    const sorted = [...filteredTasks];
    if (sortBy === 'due_date') {
      sorted.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        const pa = a.due_date.split('-'); const pb = b.due_date.split('-');
        const da = new Date(+pa[2], +pa[0] - 1, +pa[1]);
        const db = new Date(+pb[2], +pb[0] - 1, +pb[1]);
        return da - db;
      });
    } else if (sortBy === 'priority') {
      const order = { high: 0, medium: 1, low: 2, none: 3 };
      sorted.sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return sorted;
  }, [filteredTasks, tasksFilters.sort_by]);

  // Build the filter chip definitions with dynamic options for the
  // user/patient-driven filters. Other chips (View By / Sort By /
  // Status / Priority / Labels) keep their static option lists from
  // TASK_FILTER_DEFS. assigned_to and created_by use profile.id as
  // the value so the filter compares against the FK; member uses
  // patient name (no FK in tasks → patients yet).
  const filterDefs = useMemo(() => {
    const profileOpts = (taskProfiles || []).map(p => ({ value: p.id, label: p.name }));
    const memberOpts = (allPatients || []).map(p => ({ value: p.name, label: p.name }));
    return TASK_FILTER_DEFS
      .map(fd => {
        // iconKind switches the chip dropdown into people mode (search +
        // avatars) — same shape as the row-level RowAssignDropdown.
        if (fd.key === 'assigned_to') return profileOpts.length ? { ...fd, options: profileOpts, iconKind: 'assignee' } : fd;
        if (fd.key === 'created_by')  return profileOpts.length ? { ...fd, options: profileOpts, iconKind: 'assignee' } : fd;
        return fd;
      })
      // Insert a Member filter after Created By so it sits next to the
      // other identity-related chips. Skip when no patients are loaded
      // so the chip doesn't render with an empty dropdown.
      .flatMap(fd => {
        if (fd.key === 'created_by' && memberOpts.length) {
          return [fd, { key: 'member', label: 'Member', options: memberOpts, iconKind: 'patient' }];
        }
        return [fd];
      });
  }, [taskProfiles, allPatients]);

  const PRIORITY_ORDER = ['high', 'medium', 'low', 'none'];
  const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low', none: 'None' };

  const grouped = useMemo(() => {
    const viewBy = tasksFilters.view_by || 'status';
    if (viewBy === 'priority') {
      return PRIORITY_ORDER.reduce((acc, p) => {
        const items = sortedTasks.filter(t => (t.priority || 'none') === p);
        if (items.length) acc.push({ status: p, label: PRIORITY_LABELS[p], tasks: items });
        return acc;
      }, []);
    }
    if (viewBy === 'due_date') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const buckets = { overdue: [], today: [], upcoming: [], no_date: [] };
      sortedTasks.forEach(t => {
        if (!t.due_date) { buckets.no_date.push(t); return; }
        const p = t.due_date.split('-');
        const d = new Date(+p[2], +p[0] - 1, +p[1]); d.setHours(0, 0, 0, 0);
        if (d < today) buckets.overdue.push(t);
        else if (d.getTime() === today.getTime()) buckets.today.push(t);
        else buckets.upcoming.push(t);
      });
      const result = [];
      if (buckets.overdue.length) result.push({ status: 'overdue', label: 'Overdue', tasks: buckets.overdue });
      if (buckets.today.length) result.push({ status: 'today', label: 'Today', tasks: buckets.today });
      if (buckets.upcoming.length) result.push({ status: 'upcoming', label: 'Upcoming', tasks: buckets.upcoming });
      if (buckets.no_date.length) result.push({ status: 'no_date', label: 'No Due Date', tasks: buckets.no_date });
      return result;
    }
    return STATUS_ORDER.reduce((acc, status) => {
      const items = sortedTasks.filter(t => t.status === status);
      if (items.length) acc.push({ status, tasks: items });
      return acc;
    }, []);
  }, [sortedTasks, tasksFilters.view_by]);

  const kanbanGroups = STATUS_ORDER.map(status => ({
    status,
    tasks: sortedTasks.filter(t => t.status === status),
  }));

  const activeFilterCount = Object.keys(tasksFilters).length;
  const hideAssignedTo = !!tasksFilters.assigned_to;

  const renderContent = () => {
    if (tasksLoading && tasks.length === 0) {
      return (
        <div className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <div className={`${styles.thCell} ${styles.colCheck}`}>
              <ActionButton icon="solar:sort-from-top-to-bottom-linear" size="S" />
            </div>
            <div className={`${styles.thCell} ${styles.colTask}`}>Tasks</div>
            <div className={`${styles.thCell} ${styles.colP}`}>P</div>
            <div className={`${styles.thCell} ${styles.colStatus}`}>Status</div>
            <div className={`${styles.thCell} ${styles.colDue}`}>Due Date</div>
            {!hideAssignedTo && <div className={`${styles.thCell} ${styles.colAssigned}`}>Assigned To</div>}
            <div className={`${styles.thCell} ${styles.colMember}`}>Member</div>
            <div className={`${styles.thCell} ${styles.colLabels}`}>Labels</div>
          </div>
          {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
        </div>
      );
    }


    if (filteredTasks.length === 0) {
      return (
        <EmptyState
          title="No tasks found"
          description="Try adjusting your filters or switch to a different tab."
          icon="solar:magnifer-linear"
        />
      );
    }

    if (tasksViewMode === 'board') {
      return (
        <KanbanBoard
          kanbanGroups={kanbanGroups}
          onToggle={handleToggle}
          onStatusChange={handleStatusChange}
          onTaskClick={setSelectedTask}
        />
      );
    }

    return (
      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <div className={`${styles.thCell} ${styles.colCheck}`}>
            <ActionButton icon="solar:sort-from-top-to-bottom-linear" size="S" />
          </div>
          <div className={`${styles.thCell} ${styles.colTask}`}>Tasks</div>
          <div className={`${styles.thCell} ${styles.colP}`}>P</div>
          <div className={`${styles.thCell} ${styles.colStatus}`}>Status</div>
          <div className={`${styles.thCell} ${styles.colDue}`}>Due Date</div>
          {!hideAssignedTo && <div className={`${styles.thCell} ${styles.colAssigned}`}>Assigned To</div>}
          <div className={`${styles.thCell} ${styles.colMember}`}>Member</div>
          <div className={`${styles.thCell} ${styles.colLabels}`}>Labels</div>
          <div className={`${styles.thCell} ${styles.colActions}`} />
        </div>

        {grouped.map(g => (
          <StatusGroup key={g.status} status={g.status} label={g.label} tasks={g.tasks} onToggle={handleToggle} onTaskClick={setSelectedTask} hideAssignedTo={hideAssignedTo} onAddTask={(s) => { setAddDrawerStatus(s); setShowAddDrawer(true); }} />
        ))}
      </div>
    );
  };

  return (
    <div className={styles.wrapper}>
      <TopBar />

      <div className={styles.tabBar}>
        <div className={styles.tabLeft}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.tabItem} ${tasksTab === tab.key ? styles.active : ''}`}
              onClick={() => setTasksTab(tab.key)}
            >
              {tab.label}
              <Badge variant="overflow" label={String(tabCounts[tab.key])} />
            </button>
          ))}
        </div>
        <div className={styles.tabRight}>
          <Toggle
            items={VIEW_TOGGLE_ITEMS}
            active={tasksViewMode}
            onChange={setTasksViewMode}
            size="S"
          />
          <span className={styles.iconDivider} />
          <ActionButton
            icon="custom:filter"
            size="L"
            tooltip={showTasksFilterBar ? 'Hide filters' : 'Show filters'}
            onClick={toggleTasksFilterBar}
          />
          <span className={styles.iconDivider} />
          <Button variant="secondary" size="L" leadingIcon="solar:add-circle-linear" onClick={() => { setAddDrawerStatus('pending'); setShowAddDrawer(true); }}>
            Add Task
          </Button>
          <span className={styles.iconDivider} />
          <ActionButton icon="solar:settings-linear" size="L" tooltip="Settings" />
        </div>
      </div>

      {showTasksFilterBar && (
        <div className={styles.filterBar}>
          {filterDefs.map(fd => (
            <TaskFilterChip
              key={fd.key}
              filterDef={fd}
              value={tasksFilters[fd.key] || null}
              onSet={(val) => setTasksFilter(fd.key, val)}
              onClear={() => setTasksFilter(fd.key, null)}
            />
          ))}
          {activeFilterCount > 0 && (
            <span className={styles.activeCount}>{activeFilterCount} active</span>
          )}
          <span className={styles.filterSpacer} />
          <button className={styles.clearAll} onClick={clearTasksFilters}>Clear All</button>
        </div>
      )}

      {renderContent()}

      {selectedTask && (
        <TaskDetailDrawer
          task={tasks.find(t => t.id === selectedTask.id) || selectedTask}
          onClose={() => setSelectedTask(null)}
          onSelectTask={t => setSelectedTask(t)}
        />
      )}
      {showAddDrawer && (
        <AddTaskDrawer
          onClose={() => { setShowAddDrawer(false); setAddDrawerInitialMember(null); }}
          defaultStatus={addDrawerStatus}
          initialMember={addDrawerInitialMember}
          onTaskCreated={(task) => {
            setShowAddDrawer(false);
            setAddDrawerInitialMember(null);
            setSelectedTask(task);
          }}
        />
      )}
    </div>
  );
}
