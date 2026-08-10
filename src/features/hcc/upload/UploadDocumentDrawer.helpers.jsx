import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { useAppStore } from '../../../store/useAppStore';
import styles from './UploadDocumentDrawer.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EXTRACT_BUCKETS = [
  { key: 'review', tone: 'warning', label: 'Needs Review' },
  { key: 'added', tone: 'success', label: 'Added' },
  { key: 'unreadable', tone: 'neutral', label: 'Unreadable' },
];

const WHAT_HAPPENS_NEXT_STEPS = [
  {
    n: 1,
    title: 'We extract key information',
    body: 'patient demographics, date of service, provider, place of service, and ICD codes.',
  },
  {
    n: 2,
    title: 'You review and confirm',
    body: 'Review each record and fix any flagged fields.',
  },
  {
    n: 3,
    title: 'Add or merge',
    body: 'Confirm to add a new worklist entry or merge into an existing one.',
  },
];

export function ProcessingPhase({ fileName, onMinimize, onDiscard }) {
  return (
    <div className={styles.processingPhase}>
      <div className={styles.processingHero}>
        <div className={styles.processingHeroRing} />
        <div className={styles.processingHeroInner}>
          <Icon name="solar:document-medicine-linear" size={32} color="var(--primary-300)" />
        </div>
      </div>
      <div className={styles.processingTitle}>Processing Document…</div>
      <div className={styles.processingSubtitle}>
        Running AI extraction on your file <strong>{fileName || 'uploaded file'}</strong>
      </div>
      <div className={styles.processingDividerLine} />
      <div className={styles.processingHint}>
        You can minimize this window and continue working while it processes.
      </div>
      <div className={styles.processingActions}>
        <Button variant="primary" size="s" onClick={onMinimize}>
          <Icon name="solar:minimize-square-2-linear" size={14} color="#fff" />
          Minimize
        </Button>
        <Button variant="alt" size="s" onClick={onDiscard}>
          <Icon name="solar:trash-bin-2-linear" size={14} color="var(--neutral-300)" />
          Discard
        </Button>
      </div>
      {fileName && (
        <div className={styles.processingFileCard}>
          <div className={styles.processingFileIcon}>
            <Icon name="solar:document-text-linear" size={16} color="var(--neutral-300)" />
          </div>
          <div className={styles.processingFileName}>{fileName}</div>
          <button
            type="button"
            className={styles.processingFileEye}
            title="Preview file"
          >
            <Icon name="solar:eye-linear" size={16} color="var(--neutral-300)" />
          </button>
        </div>
      )}
      <div className={styles.processingInfoBanner}>
        <Icon name="solar:info-circle-linear" size={16} color="var(--neutral-300)" />
        <span>
          Once extraction is complete, you'll review each record before it's added
          to the HCC worklist. All uploads are saved in the document history on
          worklist.
        </span>
      </div>
    </div>
  );
}

export function StepIndicator({ activeStep = 1 }) {
  return (
    <div className={styles.steps}>
      <div className={styles.step}>
        <span className={`${styles.stepBadge}${activeStep >= 1 ? '' : ` ${styles.stepBadgeIdle}`}`}>1</span>
        <span className={`${styles.stepLabel}${activeStep >= 1 ? '' : ` ${styles.stepLabelIdle}`}`}>Upload File</span>
      </div>
      <span className={styles.stepDivider} />
      <div className={styles.step}>
        <span className={`${styles.stepBadge}${activeStep >= 2 ? '' : ` ${styles.stepBadgeIdle}`}`}>2</span>
        <span className={`${styles.stepLabel}${activeStep >= 2 ? '' : ` ${styles.stepLabelIdle}`}`}>AI Review</span>
      </div>
    </div>
  );
}
export function classifyEncounter(enc, tier) {
  const matched = !!enc.patient?.matchedMemberId;
  const noErrors = !enc.errors || enc.errors.length === 0;
  return (tier === 'clean' && matched && noErrors) ? 'added' : 'review';
}

// Map one extracted document (a batch = one patient with one-or-more DOS) to
// an Extracted Record. Unreadable → its own bucket; otherwise Added only when
// every DOS is fully confident, else Needs Review.
export function documentToRecord(batch) {
  const encs = batch?.encounters || [];
  const dateISO = batch?.ingestedAt || null;
  const source = batch?.source === 'sftp' ? 'SFTP Server' : 'Manual Upload';
  const base = { id: batch?.id, batchId: batch?.id, fileName: batch?.fileName || 'Document', source, dateISO };
  if (batch?.ocrTier === 'unreadable' || encs.length === 0) {
    return {
      ...base,
      bucket: 'unreadable',
      reason: batch?.ocrTier === 'unreadable'
        ? 'Corrupted file'
        : 'Blank / white page upload',
    };
  }
  const bucket = encs.every(e => classifyEncounter(e, batch.ocrTier) === 'added') ? 'added' : 'review';
  const firstEnc = encs[0];
  return {
    ...base,
    bucket,
    patientName: firstEnc?.patient?.name || '',
    patientMemberId: firstEnc?.patient?.matchedMemberId || null,
    dosCount: encs.length,
  };
}

// "MM/DD/YYYY" for the record meta line ('' when the date is missing/invalid).
export function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

// Relative day heading — "Today • Jul 29, 2026" / "Yesterday • …" / weekday.
export function dayHeading(iso) {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const dateStr = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const prefix = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? WEEKDAYS[d.getDay()] : null;
  return prefix ? `${prefix} • ${dateStr}` : dateStr;
}

/**
 * ExtractedRecords — post-extraction results shown inside a tab
 * (Add Records drawer). Layout matches Paper 27A3-0:
 *   Section header ("Degraded Documents ⌄" + Review All)
 *     Day heading ("Today • …")
 *       Rounded card containing one row per record, dividers between rows
 * Legacy bucket-pill path retained for callers that pass no tabScope.
 */
export function ExtractedRecords({ records, activeBucket, setActiveBucket, onReview, onDelete, tabScope = null }) {
  const count = (k) => records.filter(r => r.bucket === k).length;
  // When wrapped by a tab, the tab is already the filter — show every record
  // passed in; otherwise fall back to activeBucket.
  const visible = tabScope ? records : records.filter(r => r.bucket === activeBucket);

  // Split records into sections per Paper 27A3-0. Degraded = 'review' bucket
  // (needs a coder pass); Unreadable = 'unreadable' bucket (retry-only).
  // Added tab shows a single Added section.
  const degraded = visible.filter(r => r.bucket === 'review');
  const unreadable = visible.filter(r => r.bucket === 'unreadable');
  const added = visible.filter(r => r.bucket === 'added');

  // Nothing extracted yet (this session or in history) → friendly empty state.
  if (records.length === 0) {
    return (
      <div className={styles.extracted}>
        {!tabScope && <div className={styles.extractedTitle}>Extracted Records</div>}
        <div className={styles.extractedEmptyState}>
          <Icon name="solar:documents-linear" size={28} color="var(--neutral-200)" />
          <div className={styles.extractedEmptyTitle}>No extracted documents yet</div>
          <div className={styles.extractedEmptyBody}>
            Upload a document above — extracted records pending review, added to the
            worklist, or unreadable will appear here.
          </div>
        </div>
      </div>
    );
  }

  // Legacy path — no tabScope, use bucket-pill row and one flat list.
  if (!tabScope) {
    const legacyGroups = groupByDay(visible);
    return (
      <div className={styles.extracted}>
        <div className={styles.extractedTitle}>Extracted Records</div>
        <div className={styles.bucketRow}>
          {EXTRACT_BUCKETS.map(b => {
            const active = activeBucket === b.key;
            return (
              <button
                key={b.key}
                type="button"
                className={[styles.bucketPill, active ? styles[`bucketPill_${b.tone}`] : ''].filter(Boolean).join(' ')}
                onClick={() => setActiveBucket(b.key)}
              >
                <Icon
                  name={b.icon}
                  size={14}
                  color={active ? 'currentColor' : 'var(--neutral-300)'}
                />
                {b.label}({count(b.key)})
              </button>
            );
          })}
        </div>
        {visible.length === 0 ? (
          <div className={styles.extractedEmpty}>No records in this category.</div>
        ) : (
          legacyGroups.map(([heading, rows]) => (
            <div key={heading} className={styles.extractedGroup}>
              <div className={styles.extractedGroupLabel}>{heading}</div>
              <div className={styles.extractedList}>
                {rows.map(r => (
                  <ExtractedRow key={r.id} rec={r} onReview={onReview} onDelete={onDelete} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // Tab-scoped path — render Paper 27A3-0 sections.
  return (
    <div className={styles.extracted}>
      {visible.length === 0 && (
        <div className={styles.extractedEmpty}>No records in this category.</div>
      )}

      {degraded.length > 0 && (
        <RecordSection
          title="Degraded Documents"
          iconName="solar:info-circle-linear"
          iconColor="var(--status-warning)"
          rightAction={{ label: `Review All (${degraded.length})`, icon: 'solar:magic-stick-3-linear', onClick: () => onReview(degraded[0]) }}
          rows={degraded}
          onReview={onReview}
          onDelete={onDelete}
          variant="degraded"
        />
      )}

      {unreadable.length > 0 && (
        <RecordSection
          title="Unreadable Documents"
          iconName="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          rows={unreadable}
          onReview={onReview}
          onDelete={onDelete}
          variant="unreadable"
        />
      )}

      {added.length > 0 && (
        <RecordSection
          title="Added Documents"
          iconName="solar:check-circle-linear"
          iconColor="var(--status-success)"
          rows={added}
          onReview={onReview}
          onDelete={onDelete}
          variant="added"
        />
      )}
    </div>
  );
}

// Bundle rows by their dayHeading — used inside RecordSection to draw a
// per-day heading above each group card.
export function groupByDay(rows) {
  const map = new Map();
  for (const r of rows) {
    const h = dayHeading(r.dateISO);
    if (!map.has(h)) map.set(h, []);
    map.get(h).push(r);
  }
  return Array.from(map.entries());
}

/**
 * RecordSection — one section (Degraded / Unreadable / Added). Header row
 * with a tone-tinted icon + collapsible chevron + optional "Review All"
 * link. Body groups records by day into rounded cards with dividers.
 */
export function RecordSection({ title, iconName, iconColor, rightAction, rows, onReview, onDelete, variant = 'added' }) {
  const [collapsed, setCollapsed] = useState(false);
  const groups = groupByDay(rows);
  const openDiagPanel = useAppStore(s => s.openDiagPanel);
  const openPatient = (rec) => {
    if (!rec?.patientMemberId) return;
    openDiagPanel?.(rec.patientMemberId);
  };
  const cardClass = [
    styles.recCard,
    variant === 'degraded' ? styles.recCardDegraded : '',
    variant === 'unreadable' ? styles.recCardUnreadable : '',
  ].filter(Boolean).join(' ');
  return (
    <section className={styles.recSection}>
      <header className={styles.recSectionHead}>
        <button
          type="button"
          className={styles.recSectionTitle}
          onClick={() => setCollapsed(v => !v)}
        >
          <Icon name={iconName} size={14} color={iconColor} />
          <span>{title}</span>
          <Icon
            name={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'}
            size={12}
            color="var(--neutral-400)"
          />
        </button>
        {rightAction && !collapsed && (
          <button type="button" className={styles.recSectionAction} onClick={rightAction.onClick}>
            <Icon name={rightAction.icon} size={14} color="var(--primary-300)" />
            {rightAction.label}
          </button>
        )}
      </header>
      {!collapsed && groups.map(([heading, dayRows]) => (
        <div key={heading} className={styles.recDay}>
          <div className={styles.recDayLabel}>{heading}</div>
          <div className={cardClass}>
            {dayRows.map(r => (
              <ExtractedRow
                key={r.id}
                rec={r}
                onReview={onReview}
                onDelete={onDelete}
                onOpenPatient={openPatient}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * ExtractedRow — one row inside a section card (Paper 27A3-0). Layout:
 * [PDF icon] filename                                  [action] | [kebab]
 *            source-line (+ error tag for unreadable)
 * Degraded → purple Review pill. Unreadable → outline Retry pill.
 * Added → eye + download icons. Legacy/no-context rows fall back to a
 * trash affordance.
 */
// Custom document-with-embedded-PDF-letters glyph — no Solar equivalent
// carries the inline "PDF" wordmark, so a raw SVG is kept here. Uses
// currentColor so a parent color rule tokens it (neutral-300 by default).
export function PdfDocIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.39 4.05L15.06 4.43V4.43L15.39 4.05ZM19.35 7.62L19.02 7.99V7.99L19.35 7.62ZM3.17 20.83L3.53 20.47H3.53L3.17 20.83ZM20.83 20.83L20.47 20.47V20.47L20.83 20.83ZM13 5L12.5 5V5H13ZM5.16 13.68V13.18H4.66V13.68H5.16ZM10.32 13.68V13.18H9.82V13.68H10.32ZM10.32 18.96H9.82V19.46H10.32V18.96ZM15.96 13.68V13.18H15.46V13.68H15.96ZM14 22V21.5H10V22V22.5H14V22ZM2 14H2.5V10H2H1.5V14H2ZM22 13.56H21.5V14H22H22.5V13.56H22ZM15.39 4.05L15.06 4.43L19.02 7.99L19.35 7.62L19.69 7.24L15.73 3.682L15.39 4.05ZM22 13.56H22.5C22.5 11.85 22.51 10.85 22.11 9.95L21.654 10.15L21.2 10.36C21.49 11.01 21.5 11.76 21.5 13.56H22ZM19.35 7.62L19.02 7.99C20.35 9.19 20.9 9.7 21.2 10.36L21.654 10.15L22.11 9.95C21.71 9.05 20.96 8.39 19.69 7.24L19.35 7.62ZM10.03 2V2.5C11.59 2.5 12.24 2.51 12.83 2.73L13.01 2.27L13.19 1.8C12.39 1.49 11.52 1.5 10.03 1.5V2ZM15.39 4.05L15.73 3.682C14.63 2.69 13.99 2.11 13.19 1.8L13.01 2.27L12.83 2.73C13.42 2.96 13.9 3.39 15.06 4.43L15.39 4.05ZM10 22V21.5C8.1 21.5 6.73 21.5 5.68 21.358C4.64 21.219 4 20.95 3.53 20.47L3.17 20.83L2.82 21.182C3.51 21.88 4.4 22.2 5.54 22.35C6.67 22.5 8.13 22.5 10 22.5V22ZM2 14H1.5C1.5 15.87 1.5 17.33 1.65 18.46C1.8 19.6 2.12 20.49 2.82 21.182L3.17 20.83L3.53 20.47C3.05 20 2.78 19.36 2.64 18.32C2.5 17.27 2.5 15.9 2.5 14H2ZM14 22V22.5C15.87 22.5 17.33 22.5 18.46 22.35C19.6 22.2 20.49 21.88 21.182 21.182L20.83 20.83L20.47 20.47C20 20.95 19.36 21.219 18.32 21.358C17.27 21.5 15.9 21.5 14 21.5V22ZM22 14H21.5C21.5 15.9 21.5 17.27 21.358 18.32C21.219 19.36 20.95 20 20.47 20.47L20.83 20.83L21.182 21.182C21.88 20.49 22.2 19.6 22.35 18.46C22.5 17.33 22.5 15.87 22.5 14H22ZM2 10H2.5C2.5 8.1 2.5 6.73 2.64 5.68C2.78 4.64 3.05 4 3.53 3.53L3.17 3.17L2.82 2.82C2.12 3.51 1.8 4.4 1.65 5.54C1.5 6.67 1.5 8.13 1.5 10H2ZM10.03 2V1.5C8.15 1.5 6.69 1.5 5.55 1.65C4.4 1.8 3.51 2.12 2.82 2.82L3.17 3.17L3.53 3.53C4 3.05 4.65 2.78 5.68 2.64C6.74 2.5 8.12 2.5 10.03 2.5V2ZM13.01 2.27L12.51 2.26L12.5 5L13 5L13.5 5L13.51 2.27L13.01 2.27ZM18 10.15V10.65H21.654V10.15V9.65H18V10.15ZM13 5H12.5C12.5 6.16 12.5 7.09 12.596 7.81C12.695 8.55 12.9 9.15 13.38 9.62L13.73 9.27L14.09 8.91C13.83 8.66 13.67 8.3 13.59 7.68C13.5 7.04 13.5 6.19 13.5 5H13ZM18 10.15V9.65C16.823 9.65 15.98 9.61 15.35 9.49C14.73 9.38 14.36 9.19 14.09 8.91L13.73 9.27L13.38 9.62C13.84 10.08 14.42 10.33 15.163 10.48C15.89 10.62 16.82 10.65 18 10.65V10.15ZM5.16 13.68V14.18H6.84V13.68V13.18H5.16V13.68ZM5.16 13.68H4.66V16.8H5.16H5.66V13.68H5.16ZM5.16 16.8H4.66V19.2H5.16H5.66V16.8H5.16ZM6.84 16.8V16.3H5.16V16.8V17.3H6.84V16.8ZM8.4 15.24H7.9C7.9 15.83 7.43 16.3 6.84 16.3V16.8V17.3C7.98 17.3 8.9 16.38 8.9 15.24H8.4ZM6.84 13.68V14.18C7.43 14.18 7.9 14.65 7.9 15.24H8.4H8.9C8.9 14.1 7.98 13.18 6.84 13.18V13.68ZM10.32 13.68H9.82V18.96H10.32H10.82V13.68H10.32ZM10.32 18.96V19.46H11.76V18.96V18.46H10.32V18.96ZM14.16 16.56H14.66V16.08H14.16H13.66V16.56H14.16ZM11.76 13.68V13.18H10.32V13.68V14.18H11.76V13.68ZM14.16 16.08H14.66C14.66 14.48 13.36 13.18 11.76 13.18V13.68V14.18C12.81 14.18 13.66 15.03 13.66 16.08H14.16ZM11.76 18.96V19.46C13.36 19.46 14.66 18.16 14.66 16.56H14.16H13.66C13.66 17.61 12.81 18.46 11.76 18.46V18.96ZM19.2 13.68V13.18H15.96V13.68V14.18H19.2V13.68ZM15.96 13.68H15.46V16.2H15.96H16.46V13.68H15.96ZM15.96 16.2H15.46V19.2H15.96H16.46V16.2H15.96ZM15.96 16.2V16.7H18.96V16.2V15.7H15.96V16.2Z" fill="currentColor"/>
    </svg>
  );
}

export function ExtractedRow({ rec, onReview, onDelete, onOpenPatient }) {
  const source = rec.source === 'SFTP Server' ? 'Imported via SFTP'
    : rec.source === 'Manual Upload' ? `Uploaded by ${rec.actorName || 'You'}`
    : rec.actorName ? `Uploaded by ${rec.actorName}`
    : 'Uploaded';
  const isDegraded = rec.bucket === 'review';
  const isUnreadable = rec.bucket === 'unreadable';
  const isAdded = rec.bucket === 'added';
  const showToast = useAppStore(s => s.showToast);
  const moreRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const handleDownload = () => {
    showToast?.(`Downloading ${rec.fileName}…`);
  };
  return (
    <div className={[styles.exRow, isDegraded ? styles.exRowDegraded : isUnreadable ? styles.exRowUnreadable : ''].filter(Boolean).join(' ')}>
      <span className={styles.pdfBadge} aria-hidden="true">
        <PdfDocIcon />
      </span>
      <div className={styles.exMain}>
        <div className={styles.exName}>{rec.fileName}</div>
        <div className={styles.exSubtitle}>
          <span>{source}</span>
          {isAdded && rec.patientName && (
            <>
              <span className={styles.exSubDot}>•</span>
              {rec.patientMemberId ? (
                <button
                  type="button"
                  className={styles.patientLink}
                  onClick={() => onOpenPatient?.(rec)}
                >
                  <span>{rec.patientName}</span>
                  <Icon name="solar:arrow-right-up-linear" size={12} color="var(--primary-300)" />
                </button>
              ) : (
                <span className={styles.patientLinkText}>{rec.patientName}</span>
              )}
            </>
          )}
          {isUnreadable && rec.reason && (
            <>
              <span className={styles.exSubDot}>•</span>
              <span className={styles.exError}>{rec.reason}</span>
            </>
          )}
        </div>
      </div>
      {isDegraded && (
        <button type="button" className={styles.exReviewBtn} onClick={() => onReview(rec)}>
          <Icon name="solar:magic-stick-3-linear" size={14} color="var(--neutral-0)" />
          Review
        </button>
      )}
      {isUnreadable && (
        <button type="button" className={styles.exRetryBtn} onClick={() => onReview(rec)}>
          <Icon name="solar:eye-linear" size={14} color="var(--neutral-500)" />
          Review
        </button>
      )}
      {isAdded && (
        <div className={styles.exAddedActions}>
          <ActionButton icon="solar:eye-linear" size="S" tooltip="View" onClick={() => onReview(rec)} />
          <ActionButton icon="solar:download-minimalistic-linear" size="S" tooltip="Download" onClick={handleDownload} />
        </div>
      )}
      {(isDegraded || isUnreadable) && (
        <>
          <span className={styles.exDivider} />
          <span ref={moreRef} className={styles.exMoreWrap}>
            <ActionButton
              icon="solar:menu-dots-linear"
              size="S"
              tooltip="More"
              onClick={() => setMenuOpen(v => !v)}
              aria-expanded={menuOpen}
            />
            {menuOpen && (
              <MenuPopover
                anchorRef={moreRef}
                onClose={() => setMenuOpen(false)}
                items={[
                  { key: 'download', label: 'Download', icon: 'solar:download-minimalistic-linear' },
                  { key: 'delete',   label: 'Delete',   icon: 'solar:trash-bin-trash-linear', danger: true },
                ]}
                onSelect={(key) => {
                  if (key === 'download') handleDownload();
                  else if (key === 'delete') onDelete(rec);
                }}
              />
            )}
          </span>
        </>
      )}
    </div>
  );
}


/**
 * StagedFileRow — single row in the staged-file list. While uploading
 * renders an animated progress bar + × remove. Once complete swaps to
 * a check + eye-preview + trash.
 */
export function StagedFileRow({ file, onRemove, onPreview }) {
  const sizeLabel = formatBytes(file.size);
  const isUploading = file.status === 'uploading';
  const isExtracting = file.status === 'extracting';
  const isBusy = isUploading || isExtracting;
  return (
    <div className={[styles.stagedRow, isBusy ? styles.stagedRowUploading : styles.stagedRowComplete].join(' ')}>
      <span className={styles.stagedIcon}>
        <Icon name="solar:file-text-linear" size={14} color="var(--neutral-300)" />
      </span>
      <div className={styles.stagedMain}>
        <div className={styles.stagedName}>{file.name}</div>
        <div className={styles.stagedMeta}>
          <span>{sizeLabel} <span className={styles.stagedMetaSep}>/</span> 30 MB</span>
          <span className={styles.stagedStatus}>
            <span className={styles.stagedSpinner} />
            {isUploading ? 'Uploading…' : 'Extracting…'}
          </span>
        </div>
        {isUploading && (
          <div className={styles.stagedProgressTrack}>
            <span
              className={styles.stagedProgressFill}
              style={{ width: `${Math.round(file.progress)}%` }}
            />
          </div>
        )}
      </div>
      <div className={styles.stagedActions}>
        {isUploading && (
          <CloseButton size={14} onClick={onRemove} className={styles.stagedActionBtn} label="Remove" />
        )}
      </div>
    </div>
  );
}

/**
 * WhatHappensNext — collapsible info accordion sitting under the
 * dropzone. Default collapsed (pill with bulb icon); expanded shows a
 * 3-step grid explaining the extract → review → confirm flow.
 */
export function WhatHappensNext() {
  const [open, setOpen] = useState(false);
  return (
    <div className={[styles.whatNext, open ? styles.whatNextOpen : ''].join(' ')}>
      <button type="button" className={styles.whatNextHead} onClick={() => setOpen(v => !v)}>
        <Icon name="solar:lightbulb-bolt-linear" size={14} color="var(--status-info, #145ECC)" />
        <span className={styles.whatNextHeadLabel}>What happens next?</span>
        <Icon
          name={open ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
          size={12}
          color="var(--status-info, #145ECC)"
        />
      </button>
      {open && (
        <div className={styles.whatNextSteps}>
          {WHAT_HAPPENS_NEXT_STEPS.map(s => (
            <div key={s.n} className={styles.whatNextCard}>
              <span className={styles.whatNextNum}>{s.n}</span>
              <div className={styles.whatNextTitle}>{s.title}</div>
              <div className={styles.whatNextBody}>{s.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Format a byte count as "X.X MB" / "X KB". */
export function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '0 MB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * PickerUploadQueue — inline list of documents the user has queued
 * from the picker. Each row shows filename + status (extracting /
 * ready). A "Review N" CTA opens the multi-doc review drawer once at
 * least one document has finished OCR. The picker itself stays open
 * so the user can drop additional files into the queue.
 */