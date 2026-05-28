import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { SearchIconButton } from '../../components/SearchIconButton/SearchIconButton';
import { Pagination } from '../../components/Pagination/Pagination';
import { ConfirmDialog } from '../../components/Modal/ConfirmDialog';
import { Checkbox } from '../../components/ui/checkbox';
import { CloseIcon } from '../../components/Icon/CloseIcon';
import { useAppStore } from '../../store/useAppStore';
import { EmailPreviewDrawer } from './EmailPreviewDrawer';
import styles from './ContentSettings.module.css';

// ────────────────────────────────────────────────────────────────────────────
// Bulk-select toggle icons (rounded square + check / × on top). Provided by
// design; kept inline as React components so they tint with currentColor.
// ────────────────────────────────────────────────────────────────────────────
function BulkSelectIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.33333 19.2672C5.60948 19.2672 5.83333 19.0434 5.83333 18.7672C5.83333 18.4911 5.60948 18.2672 5.33333 18.2672V18.7672V19.2672ZM18.1667 5.23276C18.1667 5.5089 18.3905 5.73276 18.6667 5.73276C18.9428 5.73276 19.1667 5.5089 19.1667 5.23276H18.6667H18.1667ZM10.6378 12.9816C10.4528 12.7766 10.1367 12.7604 9.93166 12.9454C9.72667 13.1305 9.71047 13.4466 9.89549 13.6516L10.2667 13.3166L10.6378 12.9816ZM12.0199 15.2592L12.3911 14.9242V14.9242L12.0199 15.2592ZM13.6525 15.3008L14.0056 15.6548V15.6548L13.6525 15.3008ZM18.3531 11.3196C18.5486 11.1246 18.549 10.808 18.3541 10.6125C18.1591 10.4169 17.8425 10.4165 17.6469 10.6115L18 10.9655L18.3531 11.3196ZM12 5.23276V5.73276H15.3333V5.23276V4.73276H12V5.23276ZM22 11.6983H21.5V15.5345H22H22.5V11.6983H22ZM15.3333 22V21.5H12V22V22.5H15.3333V22ZM5.33333 15.5345H5.83333V11.6983H5.33333H4.83333V15.5345H5.33333ZM12 22V21.5C10.4149 21.5 9.27493 21.499 8.40708 21.3858C7.55207 21.2744 7.03698 21.062 6.65774 20.6942L6.30964 21.0531L5.96155 21.4121C6.55862 21.9911 7.31736 22.2522 8.27778 22.3774C9.22535 22.501 10.4424 22.5 12 22.5V22ZM5.33333 15.5345H4.83333C4.83333 17.0439 4.83221 18.2277 4.96011 19.1504C5.09023 20.089 5.36234 20.8309 5.96155 21.4121L6.30964 21.0531L6.65774 20.6942C6.28064 20.3285 6.06459 19.8351 5.95064 19.013C5.83446 18.175 5.83333 17.073 5.83333 15.5345H5.33333ZM22 15.5345H21.5C21.5 17.073 21.4989 18.175 21.3827 19.013C21.2687 19.8351 21.0527 20.3285 20.6756 20.6942L21.0237 21.0531L21.3718 21.4121C21.971 20.8309 22.2431 20.089 22.3732 19.1504C22.5011 18.2277 22.5 17.0439 22.5 15.5345H22ZM15.3333 22V22.5C16.891 22.5 18.108 22.501 19.0556 22.3774C20.016 22.2522 20.7747 21.9911 21.3718 21.4121L21.0237 21.0531L20.6756 20.6942C20.2964 21.062 19.7813 21.2744 18.9263 21.3858C18.0584 21.499 16.9184 21.5 15.3333 21.5V22ZM15.3333 5.23276V5.73276C16.9184 5.73276 18.0584 5.73376 18.9263 5.84692C19.7813 5.9584 20.2964 6.17074 20.6756 6.53854L21.0237 6.17961L21.3718 5.82068C20.7747 5.24163 20.016 4.98054 19.0556 4.85531C18.108 4.73176 16.891 4.73276 15.3333 4.73276V5.23276ZM22 11.6983H22.5C22.5 10.1889 22.5011 9.00503 22.3732 8.0824C22.2431 7.14378 21.971 6.40182 21.3718 5.82068L21.0237 6.17961L20.6756 6.53854C21.0527 6.90426 21.2687 7.39769 21.3827 8.21972C21.4989 9.05774 21.5 10.1598 21.5 11.6983H22ZM12 5.23276V4.73276C10.4424 4.73276 9.22535 4.73176 8.27778 4.85531C7.31736 4.98054 6.55862 5.24163 5.96155 5.82068L6.30964 6.17961L6.65774 6.53854C7.03698 6.17074 7.55207 5.9584 8.40708 5.84692C9.27493 5.73376 10.4149 5.73276 12 5.73276V5.23276ZM5.33333 11.6983H5.83333C5.83333 10.1598 5.83446 9.05774 5.95064 8.21972C6.06459 7.39769 6.28064 6.90426 6.65774 6.53854L6.30964 6.17961L5.96155 5.82068C5.36234 6.40182 5.09023 7.14378 4.96011 8.0824C4.83221 9.00503 4.83333 10.1889 4.83333 11.6983H5.33333ZM10.8889 2V2.5H15.3333V2V1.5H10.8889V2ZM2 15.5345H2.5V10.6207H2H1.5V15.5345H2ZM2 15.5345H1.5C1.5 17.6104 3.23079 19.2672 5.33333 19.2672V18.7672V18.2672C3.75398 18.2672 2.5 17.0294 2.5 15.5345H2ZM15.3333 2V2.5C16.9127 2.5 18.1667 3.73783 18.1667 5.23276H18.6667H19.1667C19.1667 3.15688 17.4359 1.5 15.3333 1.5V2ZM10.8889 2V1.5C8.80748 1.5 7.19762 1.499 5.94748 1.66201C4.68449 1.82669 3.71344 2.16668 2.95365 2.90354L3.30175 3.26247L3.64984 3.6214C4.1918 3.09579 4.9192 2.80455 6.07677 2.65361C7.2472 2.501 8.78004 2.5 10.8889 2.5V2ZM2 10.6207H2.5C2.5 8.57421 2.50113 7.09119 2.65798 5.95973C2.81262 4.84425 3.11003 4.14493 3.64984 3.6214L3.30175 3.26247L2.95365 2.90354C2.19172 3.64248 1.83825 4.59035 1.66745 5.82241C1.49887 7.03848 1.5 8.60333 1.5 10.6207H2ZM10.2667 13.3166L9.89549 13.6516L11.6488 15.5942L12.0199 15.2592L12.3911 14.9242L10.6378 12.9816L10.2667 13.3166ZM13.6525 15.3008L14.0056 15.6548L18.3531 11.3196L18 10.9655L17.6469 10.6115L13.2995 14.9467L13.6525 15.3008ZM12.0199 15.2592L11.6488 15.5942C12.2682 16.2805 13.3514 16.3072 14.0056 15.6548L13.6525 15.3008L13.2995 14.9467C13.049 15.1965 12.6263 15.1848 12.3911 14.9242L12.0199 15.2592Z" fill="currentColor"/>
    </svg>
  );
}

function BulkSelectCloseIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.33333 19.2672C5.60948 19.2672 5.83333 19.0434 5.83333 18.7672C5.83333 18.4911 5.60948 18.2672 5.33333 18.2672V18.7672V19.2672ZM18.1667 5.23276C18.1667 5.5089 18.3905 5.73276 18.6667 5.73276C18.9428 5.73276 19.1667 5.5089 19.1667 5.23276H18.6667H18.1667ZM16.9215 17.1678C17.1197 17.3601 17.4363 17.3552 17.6285 17.157C17.8208 16.9588 17.8159 16.6422 17.6177 16.45L17.2696 16.8089L16.9215 17.1678ZM11.237 10.2618C11.0388 10.0695 10.7222 10.0744 10.53 10.2726C10.3377 10.4709 10.3426 10.7874 10.5408 10.9796L10.8889 10.6207L11.237 10.2618ZM17.6177 10.9796C17.8159 10.7874 17.8208 10.4708 17.6285 10.2726C17.4363 10.0744 17.1197 10.0695 16.9215 10.2618L17.2696 10.6207L17.6177 10.9796ZM10.5408 16.4499C10.3426 16.6422 10.3377 16.9587 10.53 17.157C10.7222 17.3552 11.0388 17.36 11.237 17.1678L10.8889 16.8089L10.5408 16.4499ZM12 5.23276V5.73276H15.3333V5.23276V4.73276H12V5.23276ZM22 11.6983H21.5V15.5345H22H22.5V11.6983H22ZM15.3333 22V21.5H12V22V22.5H15.3333V22ZM5.33333 15.5345H5.83333V11.6983H5.33333H4.83333V15.5345H5.33333ZM12 22V21.5C10.4149 21.5 9.27493 21.499 8.40708 21.3858C7.55207 21.2744 7.03698 21.062 6.65774 20.6942L6.30964 21.0531L5.96155 21.4121C6.55862 21.9911 7.31736 22.2522 8.27778 22.3774C9.22535 22.501 10.4424 22.5 12 22.5V22ZM5.33333 15.5345H4.83333C4.83333 17.0439 4.83221 18.2277 4.96011 19.1504C5.09023 20.089 5.36234 20.8309 5.96155 21.4121L6.30964 21.0531L6.65774 20.6942C6.28064 20.3285 6.06459 19.8351 5.95064 19.013C5.83446 18.175 5.83333 17.073 5.83333 15.5345H5.33333ZM22 15.5345H21.5C21.5 17.073 21.4989 18.175 21.3827 19.013C21.2687 19.8351 21.0527 20.3285 20.6756 20.6942L21.0237 21.0531L21.3718 21.4121C21.971 20.8309 22.2431 20.089 22.3732 19.1504C22.5011 18.2277 22.5 17.0439 22.5 15.5345H22ZM15.3333 22V22.5C16.891 22.5 18.108 22.501 19.0556 22.3774C20.016 22.2522 20.7747 21.9911 21.3718 21.4121L21.0237 21.0531L20.6756 20.6942C20.2964 21.062 19.7813 21.2744 18.9263 21.3858C18.0584 21.499 16.9184 21.5 15.3333 21.5V22ZM15.3333 5.23276V5.73276C16.9184 5.73276 18.0584 5.73376 18.9263 5.84692C19.7813 5.9584 20.2964 6.17074 20.6756 6.53854L21.0237 6.17961L21.3718 5.82068C20.7747 5.24163 20.016 4.98054 19.0556 4.85531C18.108 4.73176 16.891 4.73276 15.3333 4.73276V5.23276ZM22 11.6983H22.5C22.5 10.1889 22.5011 9.00503 22.3732 8.0824C22.2431 7.14378 21.971 6.40182 21.3718 5.82068L21.0237 6.17961L20.6756 6.53854C21.0527 6.90426 21.2687 7.39769 21.3827 8.21972C21.4989 9.05774 21.5 10.1598 21.5 11.6983H22ZM12 5.23276V4.73276C10.4424 4.73276 9.22535 4.73176 8.27778 4.85531C7.31736 4.98054 6.55862 5.24163 5.96155 5.82068L6.30964 6.17961L6.65774 6.53854C7.03698 6.17074 7.55207 5.9584 8.40708 5.84692C9.27493 5.73376 10.4149 5.73276 12 5.73276V5.23276ZM5.33333 11.6983H5.83333C5.83333 10.1598 5.83446 9.05774 5.95064 8.21972C6.06459 7.39769 6.28064 6.90426 6.65774 6.53854L6.30964 6.17961L5.96155 5.82068C5.36234 6.40182 5.09023 7.14378 4.96011 8.0824C4.83221 9.00503 4.83333 10.1889 4.83333 11.6983H5.33333ZM10.8889 2V2.5H15.3333V2V1.5H10.8889V2ZM2 15.5345H2.5V10.6207H2H1.5V15.5345H2ZM2 15.5345H1.5C1.5 17.6104 3.23079 19.2672 5.33333 19.2672V18.7672V18.2672C3.75398 18.2672 2.5 17.0294 2.5 15.5345H2ZM15.3333 2V2.5C16.9127 2.5 18.1667 3.73783 18.1667 5.23276H18.6667H19.1667C19.1667 3.15688 17.4359 1.5 15.3333 1.5V2ZM10.8889 2V1.5C8.80748 1.5 7.19762 1.499 5.94748 1.66201C4.68449 1.82669 3.71344 2.16668 2.95365 2.90354L3.30175 3.26247L3.64984 3.6214C4.1918 3.09579 4.9192 2.80455 6.07677 2.65361C7.2472 2.501 8.78004 2.5 10.8889 2.5V2ZM2 10.6207H2.5C2.5 8.57421 2.50113 7.09119 2.65798 5.95973C2.81262 4.84425 3.11003 4.14493 3.64984 3.6214L3.30175 3.26247L2.95365 2.90354C2.19172 3.64248 1.83825 4.59035 1.66745 5.82241C1.49887 7.03848 1.5 8.60333 1.5 10.6207H2ZM17.2696 16.8089L17.6177 16.45L14.4273 13.3559L14.0792 13.7148L13.7311 14.0737L16.9215 17.1678L17.2696 16.8089ZM14.0792 13.7148L14.4273 13.3559L11.237 10.2618L10.8889 10.6207L10.5408 10.9796L13.7311 14.0737L14.0792 13.7148ZM17.2696 10.6207L16.9215 10.2618L13.7311 13.3559L14.0792 13.7148L14.4273 14.0737L17.6177 10.9796L17.2696 10.6207ZM14.0792 13.7148L13.7311 13.3559L10.5408 16.4499L10.8889 16.8089L11.237 17.1678L14.4273 14.0737L14.0792 13.7148Z" fill="currentColor"/>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EmailsBulkBar — floating action bar that appears when ≥ 1 email selected.
// Mirrors components/BulkBar visuals but trimmed to just count + Delete + close.
// ────────────────────────────────────────────────────────────────────────────
function EmailsBulkBar({ count, onDelete, onClear, onExit }) {
  if (count === 0) return null;
  return createPortal(
    <div className={styles.bulkBar}>
      <div className={styles.bulkCount}>
        {/* Header checkbox: deselect-all (stays in bulk mode). */}
        <Checkbox checked={count > 0} onCheckedChange={onClear} style={{ width: 18, height: 18 }} />
        <span className={styles.bulkCountText}>{count} Selected</span>
      </div>
      <span className={styles.bulkDivider} />
      <Button
        variant="secondary"
        size="S"
        leadingIcon="solar:trash-bin-trash-linear"
        onClick={onDelete}
      >
        Delete
      </Button>
      <span className={styles.bulkDivider} />
      {/* Close button: exit bulk mode entirely (hides checkboxes + this bar). */}
      <button className={styles.bulkClose} title="Exit bulk select" onClick={onExit}>
        <CloseIcon size={18} color="var(--neutral-300)" />
      </button>
    </div>,
    document.body,
  );
}

// Compact "2h ago", "3d ago" formatter for the Last Updated column. Falls
// back to the date itself once we're past a week.
function formatRelative(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'Just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Skeleton row that matches the live email row layout — 5 columns + action
// cluster on the right. Reused for the initial load and per-page fetches.
function EmailRowSkeleton() {
  return (
    <tr className={styles.row}>
      <td className={styles.tdName}>
        <div className={styles.skelNameRow}>
          <div className={styles.nameLeading}>
            <span className={`${styles.skelBone} ${styles.skelIcon}`} />
          </div>
          <div className={styles.nameStack}>
            <span className={`${styles.skelBone} ${styles.skelTextLg}`} />
            <span className={`${styles.skelBone} ${styles.skelTextSm}`} />
          </div>
        </div>
      </td>
      <td className={styles.tdCategory}><span className={`${styles.skelBone} ${styles.skelChip}`} /></td>
      <td className={styles.tdSubject}><span className={`${styles.skelBone} ${styles.skelTextMd}`} /></td>
      <td className={styles.tdDate}><span className={`${styles.skelBone} ${styles.skelTextSm}`} /></td>
      <td className={styles.tdUpdatedBy}><span className={`${styles.skelBone} ${styles.skelTextMd}`} /></td>
      <td className={styles.tdAction}>
        <div className={styles.actionCell}>
          <span className={`${styles.skelBone} ${styles.skelDot}`} />
          <span className={`${styles.skelBone} ${styles.skelDot}`} />
          <span className={`${styles.skelBone} ${styles.skelDot}`} />
        </div>
      </td>
    </tr>
  );
}

const CONTENT_TABS = [
  { key: 'emails',     label: 'Emails' },
  { key: 'components', label: 'Components' },
  { key: 'forms',      label: 'Forms' },
  { key: 'sms',        label: 'SMS' },
  { key: 'push',       label: 'Push Notifications' },
  { key: 'media',      label: 'Media' },
  { key: 'articles',   label: 'Articles' },
];

const STATUS_BADGE = {
  running:   { variant: 'health-ok',     label: 'Running' },
  paused:    { variant: 'status-review', label: 'Paused' },
  scheduled: { variant: 'ai-neutral',    label: 'Scheduled' },
  draft:     { variant: 'compliance-na', label: 'Draft' },
  ended:     { variant: 'compliance-na', label: 'Ended' },
};

const STATUS_CYCLE = ['all', 'running', 'paused', 'scheduled', 'draft', 'ended'];

// ────────────────────────────────────────────────────────────────────────────
// Row-level kebab menu (Preview + Delete)
// ────────────────────────────────────────────────────────────────────────────
function RowMenu({ onPreview, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.right - 180 });
    setOpen(v => !v);
  };

  const wrap = (fn) => () => { setOpen(false); fn(); };

  return (
    <>
      <div ref={btnRef} style={{ display: 'inline-flex' }}>
        <ActionButton
          icon="solar:menu-dots-linear"
          size="S"
          tooltip="More"
          onClick={openMenu}
        />
      </div>
      {open && createPortal(
        <div className={styles.overflowScrim} onClick={() => setOpen(false)}>
          <div
            className={styles.overflowMenu}
            style={{ top: pos.top, left: pos.left }}
            onClick={e => e.stopPropagation()}
          >
            <button className={styles.overflowItem} onClick={wrap(onPreview)}>
              <Icon name="solar:eye-linear" size={15} color="var(--neutral-300)" />
              Preview
            </button>
            <button className={styles.overflowItem} onClick={wrap(onDuplicate)}>
              <Icon name="solar:copy-linear" size={15} color="var(--neutral-300)" />
              Duplicate
            </button>
            <button className={`${styles.overflowItem} ${styles.overflowItemDanger}`} onClick={wrap(onDelete)}>
              <Icon name="solar:trash-bin-trash-linear" size={15} color="var(--status-error)" />
              Delete
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Emails tab
// ────────────────────────────────────────────────────────────────────────────
function EmailsTab({
  searchVal,
  statusFilter,
  onPreview,
  onDuplicate,
  onDelete,
  bulkMode,
  selectedIds,
  onToggleId,
  onToggleAll,
}) {
  const emails                  = useAppStore(s => s.contentEmails);
  const total                   = useAppStore(s => s.contentEmailsTotal);
  const loading                 = useAppStore(s => s.contentEmailsLoading);
  const fetchContentEmails      = useAppStore(s => s.fetchContentEmails);
  const openContentEmailBuilder = useAppStore(s => s.openContentEmailBuilder);
  const showToast               = useAppStore(s => s.showToast);

  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Reset to page 1 whenever filters/search change so the user never lands on
  // an empty page (e.g. searching while on page 5 of unfiltered results).
  useEffect(() => { setPage(1); }, [searchVal, statusFilter]);

  // Server-side fetch — runs on mount and whenever pagination/filter inputs
  // change. Supabase returns only the rows for the current page plus a total
  // count, so the table never holds the full dataset in memory.
  useEffect(() => {
    fetchContentEmails?.({ page, perPage, search: searchVal, status: statusFilter });
  }, [fetchContentEmails, page, perPage, searchVal, statusFilter]);

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colName} />
            <col className={styles.colCategory} />
            <col className={styles.colSubject} />
            <col className={styles.colDate} />
            <col className={styles.colUpdatedBy} />
            <col className={styles.colAction} />
          </colgroup>
          <thead>
            <tr className={styles.headerRow}>
              <th>
                <div className={styles.nameHeader}>
                  {bulkMode ? (
                    <Checkbox
                      checked={
                        emails.length > 0 && emails.every(e => selectedIds.has(e.id))
                          ? true
                          : selectedIds.size > 0
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={() => onToggleAll(emails)}
                    />
                  ) : null}
                  <span>Name</span>
                </div>
              </th>
              <th>Category</th>
              <th>Subject</th>
              <th>Last Updated</th>
              <th>Last Updated By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: Math.max(1, perPage > 5 ? 5 : perPage) }).map((_, i) => (
                <EmailRowSkeleton key={`skel-${i}`} />
              ))
            ) : emails.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyState}>
                  <Icon name="solar:letter-linear" size={32} color="var(--neutral-150)" />
                  <p>No emails match the current filters.</p>
                </td>
              </tr>
            ) : (
              emails.map(campaign => {
                const isSelected = bulkMode && selectedIds.has(campaign.id);
                const handleNameClick = () => {
                  if (bulkMode) onToggleId(campaign.id);
                  else onPreview(campaign);
                };
                return (
                <tr key={campaign.id} className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}>
                  <td className={styles.tdName}>
                    <div
                      className={styles.nameLink}
                      role="button"
                      tabIndex={0}
                      onClick={handleNameClick}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNameClick(); }
                      }}
                    >
                      {/* Leading slot — same position in both modes so the table
                          doesn't shift when bulk-select toggles. */}
                      <div className={styles.nameLeading}>
                        {bulkMode ? (
                          <Checkbox
                            checked={selectedIds.has(campaign.id)}
                            onCheckedChange={() => onToggleId(campaign.id)}
                            // Stop the click from bubbling to the row handler —
                            // otherwise we'd double-toggle.
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <Icon name="solar:letter-linear" size={16} color="var(--neutral-300)" />
                        )}
                      </div>
                      <div className={styles.nameStack}>
                        <span className={styles.nameText}>{campaign.name}</span>
                        {campaign.description ? (
                          <span className={styles.nameDesc}>{campaign.description}</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className={styles.tdCategory}>
                    {campaign.category ? (
                      <Badge variant="ai-neutral" label={campaign.category} />
                    ) : (
                      <span className={styles.cellMuted}>—</span>
                    )}
                  </td>
                  <td className={styles.tdSubject}>
                    {campaign.subjectLine ? (
                      <span className={styles.subjectText} title={campaign.subjectLine}>
                        {campaign.subjectLine}
                      </span>
                    ) : (
                      <span className={styles.cellMuted}>—</span>
                    )}
                  </td>
                  <td className={styles.tdDate}>
                    <span className={styles.cellText}>{formatRelative(campaign.updatedAt)}</span>
                  </td>
                  <td className={styles.tdUpdatedBy}>
                    <span className={styles.cellText}>
                      {campaign.updatedByName || <span className={styles.cellMuted}>—</span>}
                    </span>
                  </td>
                  <td className={styles.tdAction}>
                    <div className={styles.actionCell}>
                      <ActionButton
                        icon="solar:pen-linear"
                        size="S"
                        tooltip="Edit template"
                        onClick={() => openContentEmailBuilder(campaign)}
                      />
                      <div className={styles.vDivider} />
                      <ActionButton
                        icon="solar:chart-linear"
                        size="S"
                        tooltip="Analytics"
                        onClick={() => showToast('Analytics – coming soon')}
                      />
                      <div className={styles.vDivider} />
                      <RowMenu
                        onPreview={() => onPreview(campaign)}
                        onDuplicate={() => onDuplicate(campaign)}
                        onDelete={() => onDelete(campaign)}
                      />
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 0 ? (
        <Pagination
          totalItems={total}
          currentPage={page}
          perPage={perPage}
          onPageChange={setPage}
          onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
        />
      ) : null}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Placeholder for unbuilt tabs
// ────────────────────────────────────────────────────────────────────────────
function PlaceholderTab({ label }) {
  return (
    <div className={styles.placeholder}>
      <Icon name="solar:document-text-linear" size={40} color="var(--neutral-150)" />
      <p className={styles.placeholderTitle}>{label}</p>
      <p className={styles.placeholderSub}>Coming soon</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────────────────────
const STATUS_FILTER_BADGE = STATUS_BADGE;

export function ContentSettings() {
  const openContentEmailBuilder = useAppStore(s => s.openContentEmailBuilder);
  const campaignBuilderSaving   = useAppStore(s => s.campaignBuilderSaving);
  const deleteCampaign          = useAppStore(s => s.deleteCampaign);
  const deleteCampaignsBulk     = useAppStore(s => s.deleteCampaignsBulk);
  const duplicateCampaign       = useAppStore(s => s.duplicateCampaign);
  const fetchContentEmails      = useAppStore(s => s.fetchContentEmails);

  // Tab state lives in the store so the URL hash (#/settings/content/<tab>)
  // round-trips with the active tab.
  const activeTab    = useAppStore(s => s.contentTab) || 'emails';
  const setActiveTab = useAppStore(s => s.setContentTab);

  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchVal, setSearchVal]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [previewCampaign, setPreviewCampaign] = useState(null);
  const [deleteTarget, setDeleteTarget]       = useState(null);
  const [deleting, setDeleting]               = useState(false);

  // Bulk-select mode: a Set keeps add/remove O(1) and is easy to clear when
  // exiting bulk mode or switching tabs.
  const [bulkMode, setBulkMode]               = useState(false);
  const [selectedIds, setSelectedIds]         = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen]   = useState(false);

  const toggleId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllOnPage = (rows) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = rows.every(r => next.has(r.id));
      if (allSelected) rows.forEach(r => next.delete(r.id));
      else rows.forEach(r => next.add(r.id));
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const exitBulkMode = () => { setBulkMode(false); clearSelection(); };

  const isEmails    = activeTab === 'emails';
  const statusBadge = STATUS_FILTER_BADGE[statusFilter];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await deleteCampaign(deleteTarget.id);
    setDeleting(false);
    if (ok) {
      setDeleteTarget(null);
      // Refresh the current page so totals are accurate.
      fetchContentEmails?.({ page: 1, perPage: 10, search: searchVal, status: statusFilter });
    }
  };

  const handleDuplicate = async (campaign) => {
    const fresh = await duplicateCampaign(campaign.id);
    if (fresh) {
      fetchContentEmails?.({ page: 1, perPage: 10, search: searchVal, status: statusFilter });
    }
  };

  const handleEditFromPreview = () => {
    const c = previewCampaign;
    setPreviewCampaign(null);
    if (c) openContentEmailBuilder(c);
  };

  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { setBulkDeleteOpen(false); return; }
    setDeleting(true);
    const ok = await deleteCampaignsBulk(ids);
    setDeleting(false);
    if (ok) {
      setBulkDeleteOpen(false);
      clearSelection();
      // Refresh the listing so totals + page contents are accurate.
      fetchContentEmails?.({ page: 1, perPage: 10, search: searchVal, status: statusFilter });
    }
  };

  // Reset bulk mode when leaving the Emails tab.
  useEffect(() => {
    if (activeTab !== 'emails') exitBulkMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          {CONTENT_TABS.map(tab => (
            <button
              key={tab.key}
              className={[styles.tab, activeTab === tab.key ? styles.tabActive : ''].filter(Boolean).join(' ')}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isEmails ? (
          <div className={styles.tabActions}>
            <div className={styles.searchWrap}>
              {searchOpen ? (
                <div className={styles.searchInput}>
                  <Icon name="solar:magnifer-linear" size={15} color="var(--neutral-300)" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search emails..."
                    value={searchVal}
                    onChange={e => setSearchVal(e.target.value)}
                  />
                  <button
                    className={styles.searchClose}
                    onClick={() => { setSearchOpen(false); setSearchVal(''); }}
                  >✕</button>
                </div>
              ) : (
                <SearchIconButton title="Search" onClick={() => setSearchOpen(true)} />
              )}
            </div>
            <span className={styles.tabDivider} />
            <ActionButton
              size="L"
              tooltip={bulkMode ? 'Exit bulk select' : 'Bulk select'}
              iconColor={bulkMode ? 'var(--primary-300)' : 'var(--neutral-300)'}
              onClick={() => {
                if (bulkMode) exitBulkMode();
                else setBulkMode(true);
              }}
            >
              {bulkMode ? <BulkSelectCloseIcon /> : <BulkSelectIcon />}
            </ActionButton>
            <span className={styles.tabDivider} />
            <ActionButton
              icon="custom:filter"
              size="L"
              tooltip="Filter"
              onClick={() => {
                const idx = STATUS_CYCLE.indexOf(statusFilter);
                setStatusFilter(STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
              }}
            />
            {statusBadge ? (
              <span
                className={styles.filterChip}
                onClick={() => setStatusFilter('all')}
                title="Clear filter"
              >
                <Badge variant={statusBadge.variant} label={statusBadge.label} />
              </span>
            ) : null}
            <span className={styles.tabDivider} />
            <Button
              variant="secondary"
              size="L"
              leadingIcon="solar:add-circle-linear"
              disabled={campaignBuilderSaving}
              onClick={() => openContentEmailBuilder(null)}
            >
              {campaignBuilderSaving ? 'Creating…' : 'New Email'}
            </Button>
          </div>
        ) : null}
      </div>

      <div className={styles.content}>
        {isEmails ? (
          <EmailsTab
            searchVal={searchVal}
            statusFilter={statusFilter}
            onPreview={setPreviewCampaign}
            onDuplicate={handleDuplicate}
            onDelete={setDeleteTarget}
            bulkMode={bulkMode}
            selectedIds={selectedIds}
            onToggleId={toggleId}
            onToggleAll={toggleAllOnPage}
          />
        ) : (
          <PlaceholderTab
            label={CONTENT_TABS.find(t => t.key === activeTab)?.label ?? ''}
          />
        )}
      </div>

      {/* Preview drawer */}
      {previewCampaign ? (
        <EmailPreviewDrawer
          campaign={previewCampaign}
          onClose={() => setPreviewCampaign(null)}
          onEdit={handleEditFromPreview}
        />
      ) : null}

      {/* Delete confirmation (single row) */}
      {deleteTarget ? (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Delete "${deleteTarget.name}"`}
          description="Are you sure you want to delete this email? This action cannot be undone."
          confirmLabel="Delete Email"
          cancelLabel="Cancel"
          variant="error"
          loading={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {/* Bulk delete confirmation */}
      {bulkDeleteOpen ? (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Delete ${selectedIds.size} email${selectedIds.size === 1 ? '' : 's'}`}
          description="Are you sure you want to delete the selected emails? This action cannot be undone."
          confirmLabel="Delete Emails"
          cancelLabel="Cancel"
          variant="error"
          loading={deleting}
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={handleBulkDeleteConfirm}
        />
      ) : null}

      {/* Floating bulk action bar — visible only when bulkMode + selections */}
      {bulkMode ? (
        <EmailsBulkBar
          count={selectedIds.size}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={clearSelection}
          onExit={exitBulkMode}
        />
      ) : null}
    </div>
  );
}
