import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { Badge } from '../../components/Badge/Badge';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { WorklistShell } from '../../components/WorklistShell/WorklistShell';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { CloseIcon } from '../../components/Icon/CloseIcon';
import { useAppStore } from '../../store/useAppStore';
import { EmailPreviewDrawer } from './EmailPreviewDrawer';
import { formShareLink, copyToClipboard } from '../forms/formLink';
import styles from './ContentSettings.module.css';

// ────────────────────────────────────────────────────────────────────────────
// Bulk-select toggle icons (rounded square + check / × on top). Provided by
// design; kept inline as React components so they tint with currentColor.
// ────────────────────────────────────────────────────────────────────────────
function BulkSelectIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.33 19.27C5.61 19.27 5.83 19.04 5.83 18.77C5.83 18.49 5.61 18.27 5.33 18.27V18.77V19.27ZM18.17 5.23C18.17 5.51 18.39 5.73 18.67 5.73C18.94 5.73 19.17 5.51 19.17 5.23H18.67H18.17ZM10.64 12.98C10.45 12.78 10.14 12.76 9.93 12.95C9.73 13.13 9.71 13.45 9.9 13.65L10.27 13.32L10.64 12.98ZM12.02 15.26L12.39 14.92V14.92L12.02 15.26ZM13.65 15.3L14.01 15.65V15.65L13.65 15.3ZM18.35 11.32C18.55 11.12 18.549 10.808 18.35 10.61C18.16 10.42 17.84 10.42 17.65 10.61L18 10.97L18.35 11.32ZM12 5.23V5.73H15.33V5.23V4.73H12V5.23ZM22 11.7H21.5V15.53H22H22.5V11.7H22ZM15.33 22V21.5H12V22V22.5H15.33V22ZM5.33 15.53H5.83V11.7H5.33H4.83V15.53H5.33ZM12 22V21.5C10.41 21.5 9.27 21.499 8.41 21.39C7.55 21.27 7.04 21.062 6.66 20.69L6.31 21.05L5.96 21.41C6.56 21.99 7.32 22.25 8.28 22.38C9.23 22.501 10.44 22.5 12 22.5V22ZM5.33 15.53H4.83C4.83 17.04 4.83 18.23 4.96 19.15C5.09 20.089 5.36 20.83 5.96 21.41L6.31 21.05L6.66 20.69C6.28 20.33 6.06 19.84 5.95 19.013C5.83 18.175 5.83 17.073 5.83 15.53H5.33ZM22 15.53H21.5C21.5 17.073 21.5 18.175 21.38 19.013C21.27 19.84 21.05 20.33 20.68 20.69L21.02 21.05L21.37 21.41C21.971 20.83 22.24 20.089 22.37 19.15C22.5 18.23 22.5 17.04 22.5 15.53H22ZM15.33 22V22.5C16.891 22.5 18.108 22.501 19.06 22.38C20.016 22.25 20.77 21.99 21.37 21.41L21.02 21.05L20.68 20.69C20.3 21.062 19.78 21.27 18.93 21.39C18.06 21.499 16.92 21.5 15.33 21.5V22ZM15.33 5.23V5.73C16.92 5.73 18.06 5.73 18.93 5.85C19.78 5.96 20.3 6.17 20.68 6.54L21.02 6.18L21.37 5.82C20.77 5.24 20.016 4.98 19.06 4.86C18.108 4.73 16.891 4.73 15.33 4.73V5.23ZM22 11.7H22.5C22.5 10.19 22.5 9.01 22.37 8.08C22.24 7.14 21.971 6.4 21.37 5.82L21.02 6.18L20.68 6.54C21.05 6.9 21.27 7.4 21.38 8.22C21.5 9.06 21.5 10.16 21.5 11.7H22ZM12 5.23V4.73C10.44 4.73 9.23 4.73 8.28 4.86C7.32 4.98 6.56 5.24 5.96 5.82L6.31 6.18L6.66 6.54C7.04 6.17 7.55 5.96 8.41 5.85C9.27 5.73 10.41 5.73 12 5.73V5.23ZM5.33 11.7H5.83C5.83 10.16 5.83 9.06 5.95 8.22C6.06 7.4 6.28 6.9 6.66 6.54L6.31 6.18L5.96 5.82C5.36 6.4 5.09 7.14 4.96 8.08C4.83 9.01 4.83 10.19 4.83 11.7H5.33ZM10.89 2V2.5H15.33V2V1.5H10.89V2ZM2 15.53H2.5V10.62H2H1.5V15.53H2ZM2 15.53H1.5C1.5 17.61 3.23 19.27 5.33 19.27V18.77V18.27C3.75 18.27 2.5 17.03 2.5 15.53H2ZM15.33 2V2.5C16.91 2.5 18.17 3.74 18.17 5.23H18.67H19.17C19.17 3.16 17.44 1.5 15.33 1.5V2ZM10.89 2V1.5C8.81 1.5 7.2 1.499 5.95 1.66C4.68 1.83 3.71 2.17 2.95 2.9L3.3 3.26L3.65 3.62C4.19 3.1 4.92 2.8 6.08 2.65C7.25 2.501 8.78 2.5 10.89 2.5V2ZM2 10.62H2.5C2.5 8.57 2.5 7.09 2.66 5.96C2.81 4.84 3.11 4.14 3.65 3.62L3.3 3.26L2.95 2.9C2.19 3.64 1.84 4.59 1.67 5.82C1.5 7.04 1.5 8.6 1.5 10.62H2ZM10.27 13.32L9.9 13.65L11.65 15.59L12.02 15.26L12.39 14.92L10.64 12.98L10.27 13.32ZM13.65 15.3L14.01 15.65L18.35 11.32L18 10.97L17.65 10.61L13.3 14.95L13.65 15.3ZM12.02 15.26L11.65 15.59C12.27 16.28 13.35 16.31 14.01 15.65L13.65 15.3L13.3 14.95C13.049 15.2 12.63 15.18 12.39 14.92L12.02 15.26Z" fill="currentColor"/>
    </svg>
  );
}

function BulkSelectCloseIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.33 19.27C5.61 19.27 5.83 19.04 5.83 18.77C5.83 18.49 5.61 18.27 5.33 18.27V18.77V19.27ZM18.17 5.23C18.17 5.51 18.39 5.73 18.67 5.73C18.94 5.73 19.17 5.51 19.17 5.23H18.67H18.17ZM16.92 17.17C17.12 17.36 17.44 17.36 17.63 17.157C17.82 16.96 17.82 16.64 17.62 16.45L17.27 16.81L16.92 17.17ZM11.237 10.26C11.04 10.07 10.72 10.07 10.53 10.27C10.34 10.47 10.34 10.79 10.54 10.98L10.89 10.62L11.237 10.26ZM17.62 10.98C17.82 10.79 17.82 10.47 17.63 10.27C17.44 10.07 17.12 10.07 16.92 10.26L17.27 10.62L17.62 10.98ZM10.54 16.45C10.34 16.64 10.34 16.96 10.53 17.157C10.72 17.36 11.04 17.36 11.237 17.17L10.89 16.81L10.54 16.45ZM12 5.23V5.73H15.33V5.23V4.73H12V5.23ZM22 11.7H21.5V15.53H22H22.5V11.7H22ZM15.33 22V21.5H12V22V22.5H15.33V22ZM5.33 15.53H5.83V11.7H5.33H4.83V15.53H5.33ZM12 22V21.5C10.41 21.5 9.27 21.499 8.41 21.39C7.55 21.27 7.04 21.062 6.66 20.69L6.31 21.05L5.96 21.41C6.56 21.99 7.32 22.25 8.28 22.38C9.23 22.501 10.44 22.5 12 22.5V22ZM5.33 15.53H4.83C4.83 17.04 4.83 18.23 4.96 19.15C5.09 20.089 5.36 20.83 5.96 21.41L6.31 21.05L6.66 20.69C6.28 20.33 6.06 19.84 5.95 19.013C5.83 18.175 5.83 17.073 5.83 15.53H5.33ZM22 15.53H21.5C21.5 17.073 21.5 18.175 21.38 19.013C21.27 19.84 21.05 20.33 20.68 20.69L21.02 21.05L21.37 21.41C21.971 20.83 22.24 20.089 22.37 19.15C22.5 18.23 22.5 17.04 22.5 15.53H22ZM15.33 22V22.5C16.891 22.5 18.108 22.501 19.06 22.38C20.016 22.25 20.77 21.99 21.37 21.41L21.02 21.05L20.68 20.69C20.3 21.062 19.78 21.27 18.93 21.39C18.06 21.499 16.92 21.5 15.33 21.5V22ZM15.33 5.23V5.73C16.92 5.73 18.06 5.73 18.93 5.85C19.78 5.96 20.3 6.17 20.68 6.54L21.02 6.18L21.37 5.82C20.77 5.24 20.016 4.98 19.06 4.86C18.108 4.73 16.891 4.73 15.33 4.73V5.23ZM22 11.7H22.5C22.5 10.19 22.5 9.01 22.37 8.08C22.24 7.14 21.971 6.4 21.37 5.82L21.02 6.18L20.68 6.54C21.05 6.9 21.27 7.4 21.38 8.22C21.5 9.06 21.5 10.16 21.5 11.7H22ZM12 5.23V4.73C10.44 4.73 9.23 4.73 8.28 4.86C7.32 4.98 6.56 5.24 5.96 5.82L6.31 6.18L6.66 6.54C7.04 6.17 7.55 5.96 8.41 5.85C9.27 5.73 10.41 5.73 12 5.73V5.23ZM5.33 11.7H5.83C5.83 10.16 5.83 9.06 5.95 8.22C6.06 7.4 6.28 6.9 6.66 6.54L6.31 6.18L5.96 5.82C5.36 6.4 5.09 7.14 4.96 8.08C4.83 9.01 4.83 10.19 4.83 11.7H5.33ZM10.89 2V2.5H15.33V2V1.5H10.89V2ZM2 15.53H2.5V10.62H2H1.5V15.53H2ZM2 15.53H1.5C1.5 17.61 3.23 19.27 5.33 19.27V18.77V18.27C3.75 18.27 2.5 17.03 2.5 15.53H2ZM15.33 2V2.5C16.91 2.5 18.17 3.74 18.17 5.23H18.67H19.17C19.17 3.16 17.44 1.5 15.33 1.5V2ZM10.89 2V1.5C8.81 1.5 7.2 1.499 5.95 1.66C4.68 1.83 3.71 2.17 2.95 2.9L3.3 3.26L3.65 3.62C4.19 3.1 4.92 2.8 6.08 2.65C7.25 2.501 8.78 2.5 10.89 2.5V2ZM2 10.62H2.5C2.5 8.57 2.5 7.09 2.66 5.96C2.81 4.84 3.11 4.14 3.65 3.62L3.3 3.26L2.95 2.9C2.19 3.64 1.84 4.59 1.67 5.82C1.5 7.04 1.5 8.6 1.5 10.62H2ZM17.27 16.81L17.62 16.45L14.43 13.36L14.08 13.71L13.73 14.07L16.92 17.17L17.27 16.81ZM14.08 13.71L14.43 13.36L11.237 10.26L10.89 10.62L10.54 10.98L13.73 14.07L14.08 13.71ZM17.27 10.62L16.92 10.26L13.73 13.36L14.08 13.71L14.43 14.07L17.62 10.98L17.27 10.62ZM14.08 13.71L13.73 13.36L10.54 16.45L10.89 16.81L11.237 17.17L14.43 14.07L14.08 13.71Z" fill="currentColor"/>
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
            <span className={`${styles.leadingLayer} ${styles.leadingVisible}`}>
              <span className={`${styles.skelBone} ${styles.skelIcon}`} />
            </span>
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
// Emails tab — column defs for WorklistShell. Sort headers are omitted for
// now because the store fetches server-side and doesn't yet accept a sort
// param; the shell falls back to plain `<th>`s when `sortKey` is unset.
// ────────────────────────────────────────────────────────────────────────────
const EMAIL_COLUMNS = [
  { key: 'name',      label: 'Name',            sticky: 'left', left: 0, width: 320 },
  { key: 'category',  label: 'Category',        width: 160 },
  { key: 'subject',   label: 'Subject',         width: 280 },
  { key: 'updated',   label: 'Last Updated',    width: 140 },
  { key: 'updatedBy', label: 'Last Updated By', width: 180 },
  { key: 'action',    label: 'Action',          sticky: 'right', width: 120 },
];

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

  const renderRow = (campaign) => {
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
            {/* Leading slot — icon + checkbox stacked, cross-fading on
                bulk-mode toggle so the row never jumps. */}
            <div className={styles.nameLeading}>
              <span
                className={`${styles.leadingLayer} ${bulkMode ? styles.leadingHidden : styles.leadingVisible}`}
                aria-hidden={bulkMode}
              >
                <Icon name="solar:letter-linear" size={16} color="var(--neutral-300)" />
              </span>
              <span
                className={`${styles.leadingLayer} ${bulkMode ? styles.leadingVisible : styles.leadingHidden}`}
                aria-hidden={!bulkMode}
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selectedIds.has(campaign.id)}
                  onCheckedChange={() => onToggleId(campaign.id)}
                />
              </span>
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
  };

  return (
    <>
      <WorklistShell
        header={null}
        columns={EMAIL_COLUMNS}
        rows={emails}
        renderRow={renderRow}
        loading={loading}
        emptyState={
          <div className={styles.emptyState}>
            <Icon name="solar:letter-linear" size={32} color="var(--neutral-150)" />
            <p>No emails match the current filters.</p>
          </div>
        }
        page={page}
        perPage={perPage}
        totalItems={total}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
        minTableWidth={1200}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Forms tab — same shape as EMAIL_COLUMNS; "Subject" swaps for "Responses"
// (a numeric count of form submissions).
// ────────────────────────────────────────────────────────────────────────────
const FORM_COLUMNS = [
  { key: 'name',      label: 'Name',            sticky: 'left', left: 0, width: 320 },
  { key: 'category',  label: 'Category',        width: 160 },
  { key: 'responses', label: 'Responses',       width: 140 },
  { key: 'updated',   label: 'Last Updated',    width: 140 },
  { key: 'updatedBy', label: 'Last Updated By', width: 180 },
  { key: 'action',    label: 'Action',          sticky: 'right', width: 100 },
];

function FormRowMenu({ onCopyLink, onDuplicate, onDelete }) {
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
        <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" onClick={openMenu} />
      </div>
      {open && createPortal(
        <div className={styles.overflowScrim} onClick={() => setOpen(false)}>
          <div className={styles.overflowMenu} style={{ top: pos.top, left: pos.left }} onClick={e => e.stopPropagation()}>
            <button className={styles.overflowItem} onClick={wrap(onCopyLink)}>
              <Icon name="solar:link-linear" size={15} color="var(--neutral-300)" />
              Copy link
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

function FormRowSkeleton() {
  return (
    <tr className={styles.row}>
      <td className={styles.tdName}>
        <div className={styles.skelNameRow}>
          <div className={styles.nameLeading}>
            <span className={`${styles.leadingLayer} ${styles.leadingVisible}`}>
              <span className={`${styles.skelBone} ${styles.skelIcon}`} />
            </span>
          </div>
          <div className={styles.nameStack}>
            <span className={`${styles.skelBone} ${styles.skelTextLg}`} />
            <span className={`${styles.skelBone} ${styles.skelTextSm}`} />
          </div>
        </div>
      </td>
      <td className={styles.tdCategory}><span className={`${styles.skelBone} ${styles.skelChip}`} /></td>
      <td className={styles.tdSubject}><span className={`${styles.skelBone} ${styles.skelTextSm}`} /></td>
      <td className={styles.tdDate}><span className={`${styles.skelBone} ${styles.skelTextSm}`} /></td>
      <td className={styles.tdUpdatedBy}><span className={`${styles.skelBone} ${styles.skelTextMd}`} /></td>
      <td className={styles.tdAction}>
        <div className={styles.actionCell}>
          <span className={`${styles.skelBone} ${styles.skelDot}`} />
          <span className={`${styles.skelBone} ${styles.skelDot}`} />
        </div>
      </td>
    </tr>
  );
}

function FormsTab({ searchVal, onDuplicate, onDelete, bulkMode, selectedIds, onToggleId, onToggleAll }) {
  const forms             = useAppStore(s => s.contentForms);
  const total             = useAppStore(s => s.contentFormsTotal);
  const loading           = useAppStore(s => s.contentFormsLoading);
  const fetchContentForms = useAppStore(s => s.fetchContentForms);
  const openFormBuilder   = useAppStore(s => s.openFormBuilder);
  const showToast         = useAppStore(s => s.showToast);

  const copyLink = async (form) => {
    const ok = await copyToClipboard(formShareLink(form.id));
    showToast?.(ok ? 'Shareable form link copied' : 'Could not copy link');
  };

  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => { setPage(1); }, [searchVal]);
  useEffect(() => {
    fetchContentForms?.({ page, perPage, search: searchVal });
  }, [fetchContentForms, page, perPage, searchVal]);

  const renderRow = (form) => {
    const isSelected = bulkMode && selectedIds.has(form.id);
    const handleNameClick = () => {
      if (bulkMode) onToggleId(form.id);
      else openFormBuilder(form);
    };
    return (
      <tr key={form.id} className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}>
        <td className={styles.tdName}>
          <div
            className={styles.nameLink}
            role="button"
            tabIndex={0}
            onClick={handleNameClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNameClick(); } }}
          >
            <div className={styles.nameLeading}>
              <span className={`${styles.leadingLayer} ${bulkMode ? styles.leadingHidden : styles.leadingVisible}`} aria-hidden={bulkMode}>
                <Icon name="solar:document-text-linear" size={16} color="var(--neutral-300)" />
              </span>
              <span
                className={`${styles.leadingLayer} ${bulkMode ? styles.leadingVisible : styles.leadingHidden}`}
                aria-hidden={!bulkMode}
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox checked={selectedIds.has(form.id)} onCheckedChange={() => onToggleId(form.id)} />
              </span>
            </div>
            <div className={styles.nameStack}>
              <span className={styles.nameText}>{form.name}</span>
              {form.description ? <span className={styles.nameDesc}>{form.description}</span> : null}
            </div>
          </div>
        </td>
        <td className={styles.tdCategory}>
          {form.category ? <Badge variant="ai-neutral" label={form.category} /> : <span className={styles.cellMuted}>—</span>}
        </td>
        <td className={styles.tdSubject}>
          <span className={styles.cellText}>{form.responseCount ?? 0}</span>
        </td>
        <td className={styles.tdDate}>
          <span className={styles.cellText}>{formatRelative(form.updatedAt)}</span>
        </td>
        <td className={styles.tdUpdatedBy}>
          <span className={styles.cellText}>{form.updatedByName || <span className={styles.cellMuted}>—</span>}</span>
        </td>
        <td className={styles.tdAction}>
          <div className={styles.actionCell}>
            <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit form" onClick={() => openFormBuilder(form)} />
            <div className={styles.vDivider} />
            <FormRowMenu onCopyLink={() => copyLink(form)} onDuplicate={() => onDuplicate(form)} onDelete={() => onDelete(form)} />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <WorklistShell
      header={null}
      columns={FORM_COLUMNS}
      rows={forms}
      renderRow={renderRow}
      loading={loading}
      emptyState={
        <div className={styles.emptyState}>
          <Icon name="solar:document-text-linear" size={32} color="var(--neutral-150)" />
          <p>No forms yet. Click "New Form" to build one.</p>
        </div>
      }
      page={page}
      perPage={perPage}
      totalItems={total}
      onPageChange={setPage}
      onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
      minTableWidth={1200}
    />
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
  // Forms
  const openFormBuilder         = useAppStore(s => s.openFormBuilder);
  const formBuilderSaving       = useAppStore(s => s.formBuilderSaving);
  const deleteForm              = useAppStore(s => s.deleteForm);
  const deleteFormsBulk         = useAppStore(s => s.deleteFormsBulk);
  const duplicateForm           = useAppStore(s => s.duplicateForm);
  const fetchContentForms       = useAppStore(s => s.fetchContentForms);

  // Tab state lives in the store so the URL hash (#/settings/content/<tab>)
  // round-trips with the active tab.
  const activeTab    = useAppStore(s => s.contentTab) || 'emails';
  const setActiveTab = useAppStore(s => s.setContentTab);

  // searchInputVal is what the input shows (updates on every keystroke);
  // searchVal is the debounced value passed down to the data layer. Avoids
  // firing a Supabase request per keystroke.
  const [searchInputVal, setSearchInputVal] = useState('');
  const [searchVal, setSearchVal]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (searchInputVal === searchVal) return;
    const t = setTimeout(() => setSearchVal(searchInputVal), 250);
    return () => clearTimeout(t);
  }, [searchInputVal, searchVal]);

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
  const isForms     = activeTab === 'forms';
  const isListTab   = isEmails || isForms;
  const statusBadge = STATUS_FILTER_BADGE[statusFilter];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    let ok = false;
    try {
      ok = isForms ? await deleteForm(deleteTarget.id) : await deleteCampaign(deleteTarget.id);
    } finally {
      setDeleting(false);
    }
    if (ok) {
      setDeleteTarget(null);
      // Refresh the current page so totals are accurate.
      if (isForms) fetchContentForms?.({ page: 1, perPage: 10, search: searchVal, force: true });
      else fetchContentEmails?.({ page: 1, perPage: 10, search: searchVal, status: statusFilter });
    }
  };

  const handleDuplicate = async (row) => {
    if (isForms) {
      const fresh = await duplicateForm(row.id);
      if (fresh) fetchContentForms?.({ page: 1, perPage: 10, search: searchVal, force: true });
      return;
    }
    const fresh = await duplicateCampaign(row.id);
    if (fresh) fetchContentEmails?.({ page: 1, perPage: 10, search: searchVal, status: statusFilter });
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
    let ok = false;
    try {
      ok = isForms ? await deleteFormsBulk(ids) : await deleteCampaignsBulk(ids);
    } finally {
      setDeleting(false);
    }
    if (ok) {
      setBulkDeleteOpen(false);
      clearSelection();
      // Refresh the listing so totals + page contents are accurate.
      if (isForms) fetchContentForms?.({ page: 1, perPage: 10, search: searchVal, force: true });
      else fetchContentEmails?.({ page: 1, perPage: 10, search: searchVal, status: statusFilter });
    }
  };

  // Reset bulk mode + selection on any tab switch (selections are per-list).
  useEffect(() => {
    exitBulkMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const primaryActionLabel = isListTab
    ? isForms
      ? (formBuilderSaving ? 'Creating…' : 'New Form')
      : (campaignBuilderSaving ? 'Creating…' : 'New Email')
    : undefined;
  const primaryActionDisabled = isListTab && (isForms ? formBuilderSaving : campaignBuilderSaving);
  const onPrimaryAction = () => (isForms ? openFormBuilder(null) : openContentEmailBuilder(null));

  return (
    <div className={styles.wrapper}>
      <SectionTitleBar
        tabs={CONTENT_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={isListTab ? ['search'] : []}
        searchPlaceholder={isForms ? 'Search forms…' : 'Search emails…'}
        searchValue={searchInputVal}
        onSearchChange={setSearchInputVal}
        primaryActionLabel={primaryActionLabel}
        primaryActionDisabled={primaryActionDisabled}
        onPrimaryAction={onPrimaryAction}
        rightExtras={isListTab && (
          <>
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
            {isEmails && (
              <>
                <ActionButton
                  icon="custom:filter"
                  size="L"
                  tooltip="Filter"
                  onClick={() => {
                    const idx = STATUS_CYCLE.indexOf(statusFilter);
                    setStatusFilter(STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]);
                  }}
                />
                {statusBadge && (
                  <button
                    type="button"
                    className={styles.filterChip}
                    onClick={() => setStatusFilter('all')}
                    aria-label="Clear status filter"
                  >
                    <Badge variant={statusBadge.variant} label={statusBadge.label} />
                  </button>
                )}
              </>
            )}
          </>
        )}
      />

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
        ) : isForms ? (
          <FormsTab
            searchVal={searchVal}
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
          description={`Are you sure you want to delete this ${isForms ? 'form' : 'email'}? This action cannot be undone.`}
          confirmLabel={isForms ? 'Delete Form' : 'Delete Email'}
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
          title={`Delete ${selectedIds.size} ${isForms ? 'form' : 'email'}${selectedIds.size === 1 ? '' : 's'}`}
          description={`Are you sure you want to delete the selected ${isForms ? 'forms' : 'emails'}? This action cannot be undone.`}
          confirmLabel={isForms ? 'Delete Forms' : 'Delete Emails'}
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
