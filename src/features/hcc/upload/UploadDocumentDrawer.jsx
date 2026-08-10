import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Input } from '../../../components/Input/Input';
import { Toggle } from '../../../components/Toggle/Toggle';
import { Select } from '../../../components/Select/Select';
import { Dropzone } from '../../../components/Dropzone/Dropzone';
import { DatePicker } from '../../../components/DatePicker/DatePicker';
import { DemoPhiStrip } from '../../../components/DemoPhiStrip/DemoPhiStrip';
import { IcdSearch } from '../../../components/IcdSearch/IcdSearch';
import { POS_SELECT_OPTIONS } from '../data/posCodes';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { getScoreStyle, getFieldConfidence } from '../data/confidence';
import { TabStrip } from '../../../components/TabStrip/TabStrip';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { useAppStore } from '../../../store/useAppStore';
import { runMockOcr, mandatoryFields, POS_LABEL } from './mockOcr';
import { PROVIDER_POOL_BY_VT } from '../reference/visitTypes';
import styles from './UploadDocumentDrawer.module.css';

// Accepted file types for clinical document upload. PDFs are the canonical
// source; Word docs cover dictated notes from EHRs that export to .docx;
// JPG/PNG cover scanned/photographed encounter sheets and lab reports.
// Keep the MIME and extension lists in sync — `accept=` uses extensions
// for cross-OS reliability, the runtime check uses MIME.
// Numbered step indicator shared between the picker (active=1) and the
// review phases (active=2). Keeps both surfaces visually anchored to the
// same flow so the user knows where they are.
/**
 * ProcessingPhase — shown while the AI extracts encounters from the
 * uploaded file. Mirrors the population-groups CSV processing surface:
 * animated hero, headline + filename, hint, and a primary Minimize +
 * outline Discard action pair. The actual extraction work runs in the
 * parent's useEffect — this view is purely the "please wait" canvas
 * the user can step away from.
 */
function ProcessingPhase({ fileName, onMinimize, onDiscard }) {
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

function StepIndicator({ activeStep = 1 }) {
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

const ACCEPT_EXT  = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff';
const ACCEPT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/tiff',
]);
const ACCEPT_LABEL = 'Supported formats: PDF, DOC, JPG, PNG, TIFF';
const isAcceptedFile = (file) => {
  if (!file) return false;
  if (ACCEPT_MIME.has(file.type)) return true;
  // Some browsers (older Safari, drag-drop from certain sources) report
  // an empty MIME — fall back to extension matching.
  return /\.(pdf|docx?|jpe?g|png|tiff?)$/i.test(file.name || '');
};

/**
 * UploadDocumentDrawer — three phases (picker · processing · review).
 * Implements the Jira "Individual Upload" path: Support picks a PDF,
 * OCR (mocked) extracts every encounter section across all patients,
 * each encounter is shown grouped by patient with editable fields and
 * field-level error chips, and Confirm fires `confirmHccUpload()` which
 * creates/merges HCC worklist rows.
 *
 * Drawer is mounted once in AppLayout, controlled by `hccUploadSession`.
 */
export function UploadDocumentDrawer() {
  const session = useAppStore(s => s.hccUploadSession);
  const setFile = useAppStore(s => s.setHccUploadFile);
  const setEncounters = useAppStore(s => s.setHccUploadEncounters);
  const appendEncounters = useAppStore(s => s.appendHccUploadEncounters);
  const patchEnc = useAppStore(s => s.patchHccUploadEncounter);
  const removeEnc = useAppStore(s => s.removeHccUploadEncounter);
  const addEnc = useAppStore(s => s.addHccUploadEncounter);
  const cancel = useAppStore(s => s.cancelHccUpload);
  const confirm = useAppStore(s => s.confirmHccUpload);
  const setPhase = useAppStore(s => s.setHccUploadPhase);
  const minimize = useAppStore(s => s.minimizeHccUpload);
  const minimized = useAppStore(s => s.hccUploadMinimized);
  const hccMembers = useAppStore(s => s.hccMembers);
  const createFromEncounter = useAppStore(s => s.hccCreateOrMergeFromEncounter);
  const showToast = useAppStore(s => s.showToast);

  // ── AI extraction effect ──────────────────────────────────────────
  // Lifted out of Inner so it keeps running even while the drawer is
  // minimized (HccUploadProcessingHost takes over the UI but the same
  // mock OCR pass produces the encounters). Pre-seed handling for
  // patient-context uploads stays here too.
  useEffect(() => {
    if (!session || session.phase !== 'processing' || !session.file) return;
    let cancelled = false;
    (async () => {
      const encounters = await runMockOcr(session.file, hccMembers);
      if (session.seededMemberId) {
        const seedMember = hccMembers.find(m => m.id === session.seededMemberId);
        if (seedMember) {
          for (const enc of encounters) {
            if (!enc.patient.matchedMemberId) {
              enc.patient.matchedMemberId = seedMember.id;
              enc.patient.matchConfidence = 100;
              enc.patient.name = enc.patient.name || seedMember.name;
            }
          }
        }
      }
      if (!cancelled) setEncounters(encounters);
    })();
    return () => { cancelled = true; };
  }, [session?.phase, session?.file, session?.seededMemberId, hccMembers, setEncounters]);

  // When the user closes the drawer while AI extraction is running we hide
  // the drawer but keep the session alive — HccUploadProcessingHost
  // (mounted in AppLayout) takes over with a floating progress chip.
  if (!session || minimized) return null;
  return <Inner
    session={session}
    setFile={setFile} setEncounters={setEncounters}
    appendEncounters={appendEncounters}
    patchEnc={patchEnc} removeEnc={removeEnc} addEnc={addEnc}
    cancel={cancel} confirm={confirm} setPhase={setPhase}
    minimize={minimize}
    hccMembers={hccMembers}
    createFromEncounter={createFromEncounter}
    showToast={showToast}
  />;
}

/**
 * PickerPhase — picker UI per Figma 121:81202 + 223:96599.
 *
 * Two-stage flow:
 *  1. Drop / pick one or more files → they appear in a staged list
 *     showing an animated "Uploading…" progress bar that completes
 *     in ~1.5s. Multiple files upload in parallel; user can keep
 *     dropping more.
 *  2. Once at least one file is "Complete", the Start Extraction
 *     footer button activates. Clicking it routes each completed
 *     file through queueHccDocumentForOcr (the existing background
 *     OCR queue), closes the drawer, and lets the bell notification
 *     pick the user up when extraction lands.
 *
 * "What happens next?" collapsible accordion sits between the
 * dropzone and the staged list, default collapsed.
 */
function PickerPhase({ showToast, cancel }) {
  const queueHccDocumentForOcr = useAppStore(s => s.queueHccDocumentForOcr);
  const createFromEncounter = useAppStore(s => s.hccCreateOrMergeFromEncounter);
  const openReviewForBatches = useAppStore(s => s.openHccReviewForBatches);
  const removeHccSftpBatch = useAppStore(s => s.removeHccSftpBatch);
  const fetchHccDocuments = useAppStore(s => s.fetchHccDocuments);
  // Persistent list of every extracted document (this session + past ones
  // loaded from Supabase). This — not local state — backs the Extracted
  // Records view, so past documents pending review / added / unreadable are
  // always visible when the picker reopens.
  const sftpBatches = useAppStore(s => s.hccSftpBatches) || [];
  // Each entry: { id, file, name, size, progress: 0-100,
  //   status: 'uploading' | 'extracting' } — a row lives here only while it
  //   uploads then extracts; once done its batch surfaces in `records`.
  const [staged, setStaged] = useState([]);
  const [activeBucket, setActiveBucket] = useState('review');
  // Guards so each staged row is only sent through extraction once.
  const startedRef = useRef(new Set());
  // Load past documents once on open (only when none are in memory, so we
  // never clobber an in-flight extraction from this session).
  const didFetchRef = useRef(false);
  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
    if ((useAppStore.getState().hccSftpBatches || []).length === 0) fetchHccDocuments?.();
  }, [fetchHccDocuments]);

  // Derive one Extracted Record per finished document (a document = one
  // patient with one-or-more DOS). Bucketed Added / Needs Review / Unreadable.
  const records = useMemo(
    () => sftpBatches.filter(b => b.status === 'done').map(documentToRecord),
    [sftpBatches],
  );

  // Drive the per-file upload progress animations.
  useEffect(() => {
    const uploading = staged.filter(s => s.status === 'uploading' && s.progress < 100);
    if (uploading.length === 0) return;
    const t = setTimeout(() => {
      setStaged(prev => prev.map(s => {
        if (s.status !== 'uploading') return s;
        const next = Math.min(100, s.progress + (10 + Math.random() * 15));
        return { ...s, progress: next, status: next >= 100 ? 'extracting' : 'uploading' };
      }));
    }, 120);
    return () => clearTimeout(t);
  }, [staged]);

  // Auto-extract: the moment a file finishes uploading it flips to
  // 'extracting' and OCR runs immediately — no "Start Extraction" button.
  // autoApply:false so we classify + apply here per the upload rules.
  useEffect(() => {
    const ready = staged.filter(s => s.status === 'extracting' && !startedRef.current.has(s.id));
    ready.forEach((row) => {
      startedRef.current.add(row.id);
      void extractOne(row);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged]);

  const extractOne = async (row) => {
    const name = row.name;
    try {
      const batchId = await queueHccDocumentForOcr?.(row.file, { autoApply: false });
      const batch = useAppStore.getState().hccSftpBatches.find(b => b.id === batchId);
      // A fully-confident document ("Added") is committed to the worklist
      // straight away; the batch itself surfaces in `records` via the derive.
      if (documentToRecord(batch).bucket === 'added') {
        (batch?.encounters || []).forEach((enc) => {
          try { createFromEncounter?.({ ...enc, _docName: name, _batchId: batchId }); }
          catch (err) { console.error('Auto-add failed for extracted record', err); }
        });
      }
    } finally {
      setStaged(prev => prev.filter(s => s.id !== row.id));
    }
  };

  // Keep the active bucket on a non-empty category as records land.
  useEffect(() => {
    const count = (k) => records.filter(r => r.bucket === k).length;
    if (records.length && count(activeBucket) === 0) {
      const next = EXTRACT_BUCKETS.find(b => count(b.key) > 0);
      if (next) setActiveBucket(next.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  // Spec H — manual UI uploads cap at 15 files OR 100 MB cumulative,
  // whichever is hit first. SFTP path is unrestricted (handled
  // server-side, not in the picker).
  const MAX_FILES = 15;
  const MAX_BATCH_BYTES = 100 * 1024 * 1024;
  // `bypassLimit` lets the demo "N Documents" chips stage more than the UI cap
  // (e.g. 20) without tripping the per-batch limit shown to real uploads.
  const handlePick = (filesOrFile, opts = {}) => {
    const arr = Array.isArray(filesOrFile) ? filesOrFile : [filesOrFile];
    const accepted = arr.filter(Boolean).filter(isAcceptedFile);
    if (accepted.length === 0) {
      showToast?.('Please upload a PDF, DOC, JPG, PNG, or TIFF file');
      return;
    }
    const capFiles = opts.bypassLimit ? Infinity : MAX_FILES;
    const capBytes = opts.bypassLimit ? Infinity : MAX_BATCH_BYTES;
    setStaged(prev => {
      const currentBytes = prev.reduce((s, x) => s + (x.size || 0), 0);
      const candidateRows = accepted.map((file) => ({
        id: `stg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        name: file.name,
        // Default to ~2.5MB for demo chips (no real file.size) so the
        // row matches Figma's "2.5MB / 30 MB" copy.
        size: file.size && file.size > 1024 ? file.size : (2.5 * 1024 * 1024),
        progress: 0,
        status: 'uploading',
      }));
      // Enforce the per-batch cap: count + cumulative bytes.
      const accepted2 = [];
      let runningCount = prev.length;
      let runningBytes = currentBytes;
      let droppedForCount = 0;
      let droppedForBytes = 0;
      for (const row of candidateRows) {
        if (runningCount >= capFiles) { droppedForCount += 1; continue; }
        if (runningBytes + row.size > capBytes) { droppedForBytes += 1; continue; }
        accepted2.push(row);
        runningCount += 1;
        runningBytes += row.size;
      }
      if (droppedForCount > 0 || droppedForBytes > 0) {
        showToast?.('You can upload up to 15 files or 100 MB at a time via the app. For larger batches, please use SFTP.');
      }
      return [...prev, ...accepted2];
    });
  };

  const removeStaged = (id) => setStaged(prev => prev.filter(s => s.id !== id));
  const removeRecord = (rec) => removeHccSftpBatch?.(rec.batchId || rec.id);
  // Review a flagged record — open the full-screen Document Review over every
  // extracted document, landing on the one the user clicked (Figma
  // 4999:156381). Previous/Next there steps through the rest.
  const reviewRecord = (rec) => {
    const batchIds = [...new Set(records.flatMap(r => r.batchId ? [r.batchId] : []))];
    cancel?.();
    openReviewForBatches?.(batchIds, rec?.batchId);
  };

  // Tab-driven view: Upload (dropzone), Review (needs-review + unreadable),
  // Added (added-to-worklist), Deleted (empty state). Parked was removed —
  // its rows are already visible under Review / Added / Deleted.
  const [activeTab, setActiveTab] = useState('upload');
  const reviewCount = records.filter(r => r.bucket === 'review' || r.bucket === 'unreadable').length;
  const addedCount = records.filter(r => r.bucket === 'added').length;
  const deletedCount = 0;
  const tabItems = [
    { key: 'upload',   label: 'Upload' },
    { key: 'review',   label: `Review (${reviewCount})` },
    { key: 'added',    label: `Added (${addedCount})` },
    { key: 'deleted',  label: `Deleted (${deletedCount})` },
  ];

  // Filter chip row. Toggled by the Filter icon at the right edge of the
  // tab bar. Chips use the shared FilterChip primitive so behaviour matches
  // the worklist and DiagPanel filter rows exactly.
  const [filterOpen, setFilterOpen] = useState(false);
  const [recordFilters, setRecordFilters] = useState({ by: [], date: [] });
  const uploaderOptions = useMemo(() => (
    [...new Set(records.map(r => r.actorName || 'You'))].toSorted()
  ), [records]);
  const dateOptions = useMemo(() => (
    [...new Set(records.map(r => shortDate(r.dateISO)).filter(Boolean))]
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  ), [records]);
  const filterActive = (recordFilters.by?.length || 0) + (recordFilters.date?.length || 0) > 0;
  const applyRecordFilters = (list) => list.filter((r) => {
    if (recordFilters.by?.length) {
      const who = r.actorName || 'You';
      if (!recordFilters.by.includes(who)) return false;
    }
    if (recordFilters.date?.length) {
      const stamp = shortDate(r.dateISO);
      if (!stamp || !recordFilters.date.includes(stamp)) return false;
    }
    return true;
  });
  const clearAllFilters = () => setRecordFilters({ by: [], date: [] });

  // Cron-sync info strip — dismissible, reappears on next drawer open (state
  // resets when PickerPhase mounts fresh). Content wired to the last SFTP
  // sync summary; falls back to sample copy while no sync has run this session.
  const lastSync = useAppStore.getState().hccLastCronSync || null;
  const [cronDismissed, setCronDismissed] = useState(false);
  const cronMsg = lastSync
    ? `Last sync ${lastSync.agoLabel} • ${lastSync.imported} Imported • ${lastSync.added} Added • ${lastSync.pending} Pending Review`
    : `Last sync 9h ago • ${records.length} Imported • ${addedCount} Added • ${reviewCount} Pending Review`;

  return (
    <div className={styles.pickerPhase2}>
      <div className={styles.tabRow}>
        <TabStrip
          items={tabItems}
          activeKey={activeTab}
          onChange={setActiveTab}
        />
        {activeTab !== 'upload' && (
          <button
            type="button"
            className={[styles.filterBtn, filterOpen || filterActive ? styles.filterBtnActive : ''].filter(Boolean).join(' ')}
            aria-label="Filter records"
            aria-pressed={filterOpen}
            onClick={() => setFilterOpen(v => !v)}
          >
            <Icon
              name="solar:filter-linear"
              size={16}
              color={filterOpen || filterActive ? 'var(--primary-300)' : 'var(--neutral-400)'}
            />
            {filterActive && !filterOpen && <span className={styles.filterBtnDot} aria-hidden="true" />}
          </button>
        )}
      </div>

      {!cronDismissed && (
        <div className={styles.cronStrip} role="status">
          <Icon name="solar:refresh-linear" size={14} color="var(--status-success)" />
          <span className={styles.cronStripText}>{cronMsg}</span>
          <button
            type="button"
            className={styles.cronStripAction}
            onClick={() => setActiveTab('review')}
          >
            Review
          </button>
          <span className={styles.cronStripDivider} />
          <CloseButton size={14} onClick={() => setCronDismissed(true)} className={styles.cronStripDismiss} label="Dismiss" />
        </div>
      )}

      {filterOpen && activeTab !== 'upload' && (
        <div className={styles.filterChipRow}>
          <FilterChip
            label="Uploaded By"
            options={uploaderOptions}
            selected={recordFilters.by}
            onChange={(vals) => setRecordFilters(f => ({ ...f, by: vals }))}
          />
          <FilterChip
            label="Uploaded Date"
            options={dateOptions}
            selected={recordFilters.date}
            onChange={(vals) => setRecordFilters(f => ({ ...f, date: vals }))}
          />
          {filterActive && (
            <Button
              variant="ghost"
              size="S"
              leadingIcon="solar:close-circle-linear"
              className={styles.filterChipClear}
              onClick={clearAllFilters}
            >
              Clear All
            </Button>
          )}
        </div>
      )}

      <div className={styles.tabContent}>
      {activeTab === 'upload' ? (
        <>
          {/* Upload card — PHI notice sits INSIDE the same card as the
              dropzone, sharing its border/radius so it reads as one surface
              (per Communications Figma 1-23639, integrated banner). */}
          <div className={styles.uploadCard}>
            <DemoPhiStrip variant="card-top" />
            <Dropzone
              accept={ACCEPT_EXT}
              acceptMime={ACCEPT_MIME}
              multiple
              icon="solar:upload-minimalistic-linear"
              helperText="Supported formats: PDF, DOC, JPG, or PNG"
              secondaryText="Max size: 100 MB"
              onPick={handlePick}
              onReject={() => showToast?.('Please upload a PDF, DOC, JPG, PNG, or TIFF file')}
              className={styles.dropzoneEmbedded}
            />
          </div>

          {staged.length > 0 && (
            <div className={styles.stagedList}>
              {staged.map(s => (
                <StagedFileRow
                  key={s.id}
                  file={s}
                  onRemove={() => removeStaged(s.id)}
                  onPreview={() => showToast?.(`Preview ${s.name} — coming soon`)}
                />
              ))}
            </div>
          )}

          {/* Demo helper — Upload tab only. */}
          <div className={styles.demoStrip}>
            <Icon name="solar:test-tube-linear" size={12} color="var(--neutral-300)" />
            <span className={styles.demoStripLabel}>Try demo files:</span>
            <button
              type="button"
              className={styles.demoChip}
              onClick={() => {
                const file = new File([new Blob(['%PDF-1.4 demo'])], 'demo-same-patient-multi-dos.pdf', { type: 'application/pdf' });
                handlePick(file);
              }}
            >
              1 Doc · Multi DOS
            </button>
            {[5, 10, 20].map(n => (
              <button
                key={n}
                type="button"
                className={styles.demoChip}
                onClick={() => {
                  const files = Array.from({ length: n }, (_, i) =>
                    new File([new Blob(['%PDF-1.4 demo'])], `demo-patient-${i}.pdf`, { type: 'application/pdf' }));
                  handlePick(files, { bypassLimit: true });
                }}
              >
                {n} Documents
              </button>
            ))}
          </div>
        </>
      ) : activeTab === 'review' ? (
        <ExtractedRecords
          records={applyRecordFilters(records.filter(r => r.bucket === 'review' || r.bucket === 'unreadable'))}
          activeBucket={activeBucket}
          setActiveBucket={setActiveBucket}
          onReview={reviewRecord}
          onDelete={removeRecord}
          tabScope="review"
        />
      ) : activeTab === 'added' ? (
        <ExtractedRecords
          records={applyRecordFilters(records.filter(r => r.bucket === 'added'))}
          activeBucket="added"
          setActiveBucket={setActiveBucket}
          onReview={reviewRecord}
          onDelete={removeRecord}
          tabScope="added"
        />
      ) : (
        <div className={styles.tabEmpty}>
          <div className={styles.tabEmptyIcon}>
            <Icon name="solar:file-remove-linear" size={28} color="var(--neutral-300)" />
          </div>
          <div className={styles.tabEmptyTitle}>No Deleted Records</div>
          <div className={styles.tabEmptyBody}>Records deleted during review will appear here.</div>
        </div>
      )}
      </div>

    </div>
  );
}

// ── Extracted-records classification ──────────────────────────────────
// The three buckets the "Extracted Records" view sorts into (Figma
// 4967:199663). Order matches the badge row.
const EXTRACT_BUCKETS = [
  { key: 'review',     label: 'Needs Review',      icon: 'solar:danger-circle-linear',   tone: 'review' },
  { key: 'unreadable', label: 'Unreadable',        icon: 'solar:danger-triangle-linear', tone: 'unreadable' },
  { key: 'added',      label: 'Added to Worklist', icon: 'solar:check-circle-linear',    tone: 'added' },
];

// Classify one extracted encounter. The document's OCR tier is the
// confidence signal: 'clean' means every field extracted at high (≥85%)
// confidence, 'degraded' means at least one field fell below the bar.
//  • 'added'  — clean extraction, patient matched, no mandatory field missing
//               → 100% confident, added straight to the worklist.
//  • 'review' — degraded extraction, a missing mandatory field, or the patient
//               couldn't be matched → needs a human pass.
function classifyEncounter(enc, tier) {
  const matched = !!enc.patient?.matchedMemberId;
  const noErrors = !enc.errors || enc.errors.length === 0;
  return (tier === 'clean' && matched && noErrors) ? 'added' : 'review';
}

// Map one extracted document (a batch = one patient with one-or-more DOS) to
// an Extracted Record. Unreadable → its own bucket; otherwise Added only when
// every DOS is fully confident, else Needs Review.
function documentToRecord(batch) {
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
function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

// Relative day heading — "Today • Jul 29, 2026" / "Yesterday • …" / weekday.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function dayHeading(iso) {
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
function ExtractedRecords({ records, activeBucket, setActiveBucket, onReview, onDelete, tabScope = null }) {
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
function groupByDay(rows) {
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
function RecordSection({ title, iconName, iconColor, rightAction, rows, onReview, onDelete, variant = 'added' }) {
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
function PdfDocIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.3929 4.05365L15.0585 4.42529V4.42529L15.3929 4.05365ZM19.3517 7.61654L19.0172 7.98819V7.98819L19.3517 7.61654ZM3.17157 20.8284L3.52513 20.4749H3.52513L3.17157 20.8284ZM20.8284 20.8284L20.4749 20.4749V20.4749L20.8284 20.8284ZM13 5L12.5 4.99831V5H13ZM5.16 13.68V13.18H4.66V13.68H5.16ZM10.32 13.68V13.18H9.82V13.68H10.32ZM10.32 18.96H9.82V19.46H10.32V18.96ZM15.96 13.68V13.18H15.46V13.68H15.96ZM14 22V21.5H10V22V22.5H14V22ZM2 14H2.5V10H2H1.5V14H2ZM22 13.5629H21.5V14H22H22.5V13.5629H22ZM15.3929 4.05365L15.0585 4.42529L19.0172 7.98819L19.3517 7.61654L19.6862 7.2449L15.7274 3.682L15.3929 4.05365ZM22 13.5629H22.5C22.5 11.8525 22.5101 10.8473 22.1107 9.95068L21.654 10.1541L21.1973 10.3575C21.4899 11.0146 21.5 11.7641 21.5 13.5629H22ZM19.3517 7.61654L19.0172 7.98819C20.3543 9.19151 20.9046 9.70039 21.1972 10.3575L21.654 10.1541L22.1108 9.95068C21.7114 9.05401 20.9576 8.38912 19.6862 7.2449L19.3517 7.61654ZM10.0298 2V2.5C11.5927 2.5 12.2448 2.50772 12.8301 2.73233L13.0092 2.26552L13.1884 1.79871C12.3898 1.49228 11.5169 1.5 10.0298 1.5V2ZM15.3929 4.05365L15.7274 3.682C14.6275 2.69205 13.9868 2.10511 13.1884 1.79871L13.0092 2.26552L12.8301 2.73233C13.4155 2.95697 13.9027 3.3851 15.0585 4.42529L15.3929 4.05365ZM10 22V21.5C8.10025 21.5 6.72573 21.4989 5.67754 21.358C4.64372 21.219 4.00253 20.9523 3.52513 20.4749L3.17157 20.8284L2.81802 21.182C3.51219 21.8762 4.39959 22.1952 5.54429 22.3491C6.6746 22.5011 8.12852 22.5 10 22.5V22ZM2 14H1.5C1.5 15.8715 1.49894 17.3254 1.65091 18.4557C1.80481 19.6004 2.12385 20.4878 2.81802 21.182L3.17157 20.8284L3.52513 20.4749C3.04772 19.9975 2.78098 19.3563 2.64199 18.3225C2.50106 17.2743 2.5 15.8998 2.5 14H2ZM14 22V22.5C15.8715 22.5 17.3254 22.5011 18.4557 22.3491C19.6004 22.1952 20.4878 21.8762 21.182 21.182L20.8284 20.8284L20.4749 20.4749C19.9975 20.9523 19.3563 21.219 18.3225 21.358C17.2743 21.4989 15.8998 21.5 14 21.5V22ZM22 14H21.5C21.5 15.8998 21.4989 17.2743 21.358 18.3225C21.219 19.3563 20.9523 19.9975 20.4749 20.4749L20.8284 20.8284L21.182 21.182C21.8762 20.4878 22.1952 19.6004 22.3491 18.4557C22.5011 17.3254 22.5 15.8715 22.5 14H22ZM2 10H2.5C2.5 8.10025 2.50106 6.72573 2.64199 5.67754C2.78098 4.64372 3.04772 4.00253 3.52513 3.52513L3.17157 3.17157L2.81802 2.81802C2.12385 3.51219 1.80481 4.39959 1.65091 5.54429C1.49894 6.6746 1.5 8.12852 1.5 10H2ZM10.0298 2V1.5C8.14833 1.5 6.68714 1.49895 5.55203 1.65087C4.40292 1.80466 3.51258 2.12346 2.81802 2.81802L3.17157 3.17157L3.52513 3.52513C4.00214 3.04811 4.64535 2.78113 5.68469 2.64203C6.73803 2.50105 8.12015 2.5 10.0298 2.5V2ZM13.0092 2.26552L12.5092 2.26383L12.5 4.99831L13 5L13.5 5.00169L13.5092 2.2672L13.0092 2.26552ZM18 10.1541V10.6541H21.654V10.1541V9.6541H18V10.1541ZM13 5H12.5C12.5 6.16438 12.4989 7.08796 12.596 7.8098C12.695 8.54603 12.9042 9.14682 13.3787 9.62132L13.7322 9.26777L14.0858 8.91421C13.8281 8.65648 13.6711 8.3019 13.5871 7.67656C13.5011 7.03683 13.5 6.19265 13.5 5H13ZM18 10.1541V9.6541C16.823 9.6541 15.9808 9.61478 15.3506 9.4944C14.7325 9.37631 14.3591 9.18749 14.0858 8.91421L13.7322 9.26777L13.3787 9.62132C13.8376 10.0803 14.4196 10.3346 15.163 10.4766C15.8944 10.6164 16.8199 10.6541 18 10.6541V10.1541ZM5.16 13.68V14.18H6.84V13.68V13.18H5.16V13.68ZM5.16 13.68H4.66V16.8H5.16H5.66V13.68H5.16ZM5.16 16.8H4.66V19.2H5.16H5.66V16.8H5.16ZM6.84 16.8V16.3H5.16V16.8V17.3H6.84V16.8ZM8.4 15.24H7.9C7.9 15.8254 7.42542 16.3 6.84 16.3V16.8V17.3C7.9777 17.3 8.9 16.3777 8.9 15.24H8.4ZM6.84 13.68V14.18C7.42542 14.18 7.9 14.6546 7.9 15.24H8.4H8.9C8.9 14.1023 7.9777 13.18 6.84 13.18V13.68ZM10.32 13.68H9.82V18.96H10.32H10.82V13.68H10.32ZM10.32 18.96V19.46H11.76V18.96V18.46H10.32V18.96ZM14.16 16.56H14.66V16.08H14.16H13.66V16.56H14.16ZM11.76 13.68V13.18H10.32V13.68V14.18H11.76V13.68ZM14.16 16.08H14.66C14.66 14.4784 13.3616 13.18 11.76 13.18V13.68V14.18C12.8093 14.18 13.66 15.0307 13.66 16.08H14.16ZM11.76 18.96V19.46C13.3616 19.46 14.66 18.1616 14.66 16.56H14.16H13.66C13.66 17.6094 12.8093 18.46 11.76 18.46V18.96ZM19.2 13.68V13.18H15.96V13.68V14.18H19.2V13.68ZM15.96 13.68H15.46V16.2H15.96H16.46V13.68H15.96ZM15.96 16.2H15.46V19.2H15.96H16.46V16.2H15.96ZM15.96 16.2V16.7H18.96V16.2V15.7H15.96V16.2Z" fill="currentColor"/>
    </svg>
  );
}

function ExtractedRow({ rec, onReview, onDelete, onOpenPatient }) {
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
function StagedFileRow({ file, onRemove, onPreview }) {
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
function WhatHappensNext() {
  const [open, setOpen] = useState(false);
  const STEPS = [
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
          {STEPS.map(s => (
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
function formatBytes(bytes) {
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
function PickerUploadQueue({ cancel }) {
  const batches = useAppStore(s => s.hccSftpBatches) || [];
  const openSftpReview = useAppStore(s => s.openHccSftpReview);
  if (batches.length === 0) return null;
  const ready = batches.filter(b => b.status === 'done').length;
  const pending = batches.filter(b => b.status === 'pending').length;
  return (
    <div className={styles.pickerQueue}>
      <div className={styles.pickerQueueHead}>
        <span className={styles.pickerQueueLabel}>
          <Icon name="solar:layers-linear" size={12} color="var(--neutral-400)" />
          Queue · {batches.length} document{batches.length === 1 ? '' : 's'}
        </span>
        {pending > 0 && (
          <span className={styles.pickerQueuePending}>
            <span className={styles.pickerQueuePendingDot} />
            {pending} extracting
          </span>
        )}
      </div>
      <ul className={styles.pickerQueueList}>
        {batches.map(b => (
          <li key={b.id} className={styles.pickerQueueItem}>
            <span className={styles.pickerQueueItemIcon}>
              {b.status === 'pending' ? (
                <span className={styles.pickerQueueSpinner} />
              ) : (
                <Icon name="solar:check-circle-bold" size={14} color="var(--status-success)" />
              )}
            </span>
            <span className={styles.pickerQueueItemName}>{b.fileName}</span>
            <span className={styles.pickerQueueItemStatus}>
              {b.status === 'pending'
                ? 'Extracting…'
                : `${b.encounters?.length || 0} encounter${(b.encounters?.length || 0) === 1 ? '' : 's'}`}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={styles.pickerQueueReviewBtn}
        disabled={ready === 0}
        onClick={() => {
          cancel?.();      // close the picker drawer
          openSftpReview?.();
        }}
      >
        <Icon name="solar:eye-linear" size={13} color={ready === 0 ? 'var(--neutral-300)' : '#fff'} />
        {ready === 0
          ? 'Waiting for first document…'
          : pending > 0
            ? `Review ${ready} ready · ${pending} still extracting`
            : `Review ${ready} document${ready === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}

/**
 * Two-line title for the review phase per Figma 32:64519. Top line:
 * "Document Processed & Extracted". Sub line: "{N} Gaps Recorded ·
 * {M} Member{s}".
 */
function ReviewTitle({ encounters, hccMembers }) {
  const memberCount = useMemo(() => {
    const keys = new Set(encounters.map(e => e.patient?.matchedMemberId || `__unmatched-${e.tempId}`));
    return keys.size;
  }, [encounters]);
  return (
    <span className={styles.reviewTitleBlock}>
      <span className={styles.reviewTitleTop}>Document Processed &amp; Extracted</span>
      <span className={styles.reviewTitleSub}>
        {encounters.length} Gaps Recorded · {memberCount} Member{memberCount === 1 ? '' : 's'}
      </span>
    </span>
  );
}

function Inner({ session, setFile, setEncounters, appendEncounters, patchEnc, removeEnc, addEnc, cancel, confirm, setPhase, minimize, hccMembers, createFromEncounter, showToast }) {
  const [drag, setDrag] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [filter, setFilter] = useState('all'); // all | error | mismatched | ready
  // Review phase is now table-only per the new Figma — Option 1 / master-detail
  // is gone. We still keep `layout` as a constant so the existing selection /
  // bulk-confirm logic that branches on it stays intact.
  const layout = 'table';
  const [appending, setAppending] = useState(false);
  const [pagePreview, setPagePreview] = useState(null); // { page } | null
  const openPagePreview = (page) => setPagePreview({ page: page || 1 });
  const closePagePreview = () => setPagePreview(null);
  const maxPage = useMemo(() => {
    const ps = (session.encounters || []).map(e => e.sourcePage || 0);
    return ps.length ? Math.max(...ps) : 0;
  }, [session.encounters]);
  // Bulk-select state for the table layout. A Set of encounter `_idx`
  // (the position in session.encounters). Empty = no selection → Confirm
  // falls back to "apply all" behavior (matches the card layout). Non-empty
  // → Confirm applies only selected, marks the rest as rejected, and the
  // History summary entry lists both buckets.
  const [selectedIdxs, setSelectedIdxs] = useState(() => new Set());
  // SinglePhase (Add a DOS) lifts its save handler up so the header
  // Save button can invoke the form's commit action. { save, canSave }
  // is updated from a useEffect inside SinglePhase whenever its state
  // changes; the header re-renders because setSingleSave triggers it.
  const [singleSave, setSingleSave] = useState({ save: () => {}, canSave: false });
  const toggleSelected = (idx) => setSelectedIdxs(prev => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });
  const setSelectedAll = (idxs, all) => setSelectedIdxs(prev => {
    const next = new Set(prev);
    if (all) idxs.forEach(i => next.add(i));
    else     idxs.forEach(i => next.delete(i));
    return next;
  });
  const fileInputRef = useRef(null);
  const appendInputRef = useRef(null);

  // (AI extraction effect lives in the parent UploadDocumentDrawer so
  // it keeps running while the drawer is minimized.)

  const queueHccDocumentForOcr = useAppStore(s => s.queueHccDocumentForOcr);
  const handleFileSelect = (file) => {
    if (!file) return;
    // Multi-type accept: PDF · DOC/DOCX · JPG · PNG · TIFF. Filter at both
    // accept attr + MIME/extension check.
    if (!isAcceptedFile(file)) {
      showToast('Please upload a PDF, DOC, JPG, PNG, or TIFF file');
      return;
    }
    // New behavior: queue the document into the shared multi-doc batch
    // list so the picker stays open and the user can fire-and-forget
    // additional uploads. OCR runs in the background; review all
    // together via the multi-doc drawer.
    queueHccDocumentForOcr?.(file);
  };

  // Group encounters by matched patient (or "unmatched" bucket).
  const groups = useMemo(() => {
    const map = new Map();
    (session.encounters || []).forEach((enc, idx) => {
      const key = enc.patient?.matchedMemberId || `__unmatched-${idx}`;
      if (!map.has(key)) map.set(key, { memberId: enc.patient?.matchedMemberId || null, encounters: [] });
      map.get(key).encounters.push({ ...enc, _idx: idx });
    });
    return Array.from(map.values());
  }, [session.encounters]);

  // Confirm gates on validity. In table layout with bulk selection active
  // we only validate the SELECTED rows — the unselected ones are about to
  // be rejected, so their errors / unmatched state don't block the action.
  // In card layout (or table with no selection) all encounters must be
  // valid, matching the original AC-8 / AC-9 contract.
  const canConfirm = useMemo(() => {
    const all = session.encounters || [];
    if (!all.length) return false;
    const isValid = (e) =>
      e.patient?.matchedMemberId &&
      (!e.errors || e.errors.length === 0);
    if (layout === 'table' && selectedIdxs.size > 0) {
      // Validate only the selected encounters.
      return Array.from(selectedIdxs).every(idx => {
        const e = all[idx];
        return e && isValid(e);
      });
    }
    return all.every(isValid);
  }, [session.encounters, layout, selectedIdxs]);

  const handleConfirm = () => {
    if (!canConfirm) return;
    // If the user has bulk-selected rows in table layout, only those get
    // applied. Others are rejected and recorded in the activity log.
    const acceptedIdxs = (layout === 'table' && selectedIdxs.size > 0)
      ? Array.from(selectedIdxs)
      : null;
    const summary = confirm(acceptedIdxs ? { acceptedIdxs } : undefined);
    const created = summary.created || 0;
    const updated = summary.updated || 0;
    const rejected = summary.rejected || 0;
    const parts = [];
    if (created) parts.push(`${created} created`);
    if (updated) parts.push(`${updated} updated`);
    if (rejected) parts.push(`${rejected} rejected`);
    showToast(parts.length ? parts.join(', ') : 'No changes applied');
    setSelectedIdxs(new Set());
  };

  // Append more encounters from a second PDF without dropping the
  // already-reviewed ones. Runs the same OCR pipeline and merges into
  // session.encounters.
  const handleAppendUpload = async (file) => {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      showToast('Please upload a PDF, DOC, JPG, PNG, or TIFF file');
      return;
    }
    setAppending(true);
    try {
      const more = await runMockOcr(file, hccMembers);
      appendEncounters(more);
      showToast(`Added ${more.length} more encounter${more.length === 1 ? '' : 's'} from ${file.name}`);
    } finally {
      setAppending(false);
      // Reset the input so picking the same file twice still fires onChange.
      if (appendInputRef.current) appendInputRef.current.value = '';
    }
  };

  // Phase-specific drawer title. Picker uses a single bold "Upload a
  // Document" line per Figma 121:81202. Back button removed per latest
  // direction — the popover on the worklist toolbar is the canonical
  // entry, so there's no chooser to step back to.
  const title = session.phase === 'picker' ? (
    <span className={styles.titleBlock}>
      <span className={styles.titleMain}>Add Records</span>
    </span>
  ) : session.phase === 'single' ? (
    <span className={styles.title}>
      {singleSave.patientName ? `Add DOS for ${singleSave.patientName}` : 'Add DOS'}
    </span>
  ) : (
    <span className={styles.title}>
      {session.phase === 'review'
        ? <ReviewTitle encounters={session.encounters} hccMembers={hccMembers} />
        : 'Add Records'}
    </span>
  );

  const headerRight = session.phase === 'picker' ? null
  : session.phase === 'single' ? (
    <Button
      variant="primary"
      size="S"
      disabled={!singleSave.canSave}
      onClick={singleSave.save}
    >
      Save to Worklist
    </Button>
  )
  : session.phase === 'review' ? (
    <>
      {/* Source-document peek: clicking opens the page-preview drawer
          at page 1. The badge shows the file's total page count. */}
      <button
        type="button"
        className={styles.headerDocBtn}
        onClick={() => openPagePreview(1)}
        title={session.file?.name || 'Source document'}
      >
        <Icon name="solar:document-text-linear" size={16} color="var(--neutral-400)" />
        <span className={styles.headerDocBadge}>{maxPage || 1}</span>
      </button>
      <span className={styles.headerDivider} />
      {/* Upload-more — append a second PDF's encounters into the current
          review session without losing edits. */}
      <Button
        variant="alt"
        size="S"
        leadingIcon={appending ? undefined : 'solar:add-circle-linear'}
        disabled={appending}
        onClick={() => appendInputRef.current?.click()}
      >
        {appending ? 'Processing…' : 'Add Record'}
      </Button>
      <input
        ref={appendInputRef}
        type="file"
        accept={ACCEPT_EXT}
        style={{ display: 'none' }}
        onChange={(e) => handleAppendUpload(e.target.files?.[0])}
      />
      <span className={styles.headerDivider} />
      <Button
        variant="primary"
        size="S"
        disabled={!canConfirm}
        onClick={handleConfirm}
      >
        Add to Worklist
      </Button>
    </>
  ) : null;

  // Only the review panel needs the wide canvas (master-detail layout).
  // Every other phase — including processing — uses the narrow 660px
  // shell so the centered processing hero reads correctly.
  const isWidePhase = session.phase === 'review';
  const drawerCls = [
    styles.drawer,
    isWidePhase ? styles.drawerExpanded : '',
  ].filter(Boolean).join(' ');

  return (
    <Drawer
      title={title}
      onClose={() => {
        // While AI extraction is running, closing the drawer minimizes
        // it to a floating progress chip instead of cancelling — the
        // user can keep working and we re-expand when extraction
        // completes. Every other phase still fully cancels.
        if (session.phase === 'processing') minimize();
        else cancel();
      }}
      className={drawerCls}
      bodyClassName={styles.body}
      headerRight={headerRight}
    >
      {session.phase === 'chooser' && (
        <ChooserPhase onPick={setPhase} />
      )}

      {session.phase === 'sftp' && (
        <SftpPhase showToast={showToast} />
      )}

      {session.phase === 'single' && (
        <SinglePhase
          hccMembers={hccMembers}
          batchId={session.id}
          showToast={showToast}
          createFromEncounter={createFromEncounter}
          onDone={cancel}
          onSaveApiChange={setSingleSave}
        />
      )}

      {session.phase === 'picker' && (
        <PickerPhase
          showToast={showToast}
          cancel={cancel}
        />
      )}

      {session.phase === 'processing' && (
        <ProcessingPhase
          fileName={session.file?.name}
          onMinimize={minimize}
          onDiscard={cancel}
        />
      )}

      {session.phase === 'review' && (
        <ReviewPhase
          encounters={session.encounters}
          groups={groups}
          hccMembers={hccMembers}
          patchEnc={patchEnc}
          removeEnc={removeEnc}
          addEnc={addEnc}
          setSelectedIdxOnAdd={setSelectedIdx}
          selectedIdx={selectedIdx}
          setSelectedIdx={setSelectedIdx}
          filter={filter}
          setFilter={setFilter}
          layout={layout}
          selectedIdxs={selectedIdxs}
          toggleSelected={toggleSelected}
          setSelectedAll={setSelectedAll}
          sourceFileName={session.file?.name}
          showToast={showToast}
          openPagePreview={openPagePreview}
        />
      )}
      {pagePreview && (
        <PagePreviewModal
          page={pagePreview.page}
          maxPage={maxPage || 1}
          fileName={session.file?.name || 'Uploaded document'}
          onChangePage={(p) => setPagePreview({ page: p })}
          onClose={closePagePreview}
        />
      )}
    </Drawer>
  );
}

/**
 * Status of a single encounter — drives status chip color and filter
 * bucketing. Priority: mismatched > error > ready.
 */
function encounterStatus(enc) {
  if (!enc.patient?.matchedMemberId) return 'mismatched';
  if (enc.errors && enc.errors.length > 0) return 'error';
  return 'ready';
}

// ── Chooser phase ──────────────────────────────────────────────────
// Three-card menu shown when the user opens Upload Document from the
// worklist toolbar (no patient seeded). Mirrors the Figma "Choose how
// you'd like to add team members" layout — first option primary-tinted,
// the other two secondary-tinted (matches Fold's purple/orange split).
function ChooserPhase({ onPick }) {
  const options = [
    {
      key: 'single', tone: 'primary',
      icon: 'solar:user-rounded-linear',
      title: 'Add a Single Encounter',
      desc: 'Manually add one encounter for a patient — pick the patient, add ICDs, attach the document.',
      cta: 'Add Encounter',
    },
    {
      key: 'picker', tone: 'secondary',
      icon: 'solar:users-group-rounded-linear',
      title: 'Upload Single Document',
      desc: 'Upload one PDF that contains encounters for one or more patients — AI extracts and groups them for review.',
      cta: 'Upload PDF',
    },
    {
      key: 'sftp', tone: 'neutral',
      icon: 'solar:server-2-linear',
      title: 'Upload Multiple Documents (SFTP)',
      desc: 'Drop multiple documents on the secure SFTP server — they\'ll be ingested automatically and queued for AI review.',
      cta: 'Open SFTP Details',
    },
  ];
  return (
    <div className={styles.chooserPhase}>
      <h3 className={styles.chooserHeading}>Choose how you'd like to add encounters</h3>
      <div className={styles.chooserCards}>
        {options.map(opt => (
          <button
            key={opt.key}
            type="button"
            className={`${styles.chooserCard} ${styles[`chooserCard_${opt.tone}`]}`}
            onClick={() => onPick(opt.key)}
          >
            <span className={styles.chooserIcon}>
              <Icon
                name={opt.icon}
                size={28}
                color={
                  opt.tone === 'primary'   ? 'var(--primary-300)'
                  : opt.tone === 'neutral' ? 'var(--neutral-400)'
                  :                          'var(--secondary-300)'
                }
              />
            </span>
            <span className={styles.chooserTitle}>{opt.title}</span>
            <span className={styles.chooserDesc}>{opt.desc}</span>
            <span className={`${styles.chooserCta} ${styles[`chooserCta_${opt.tone}`]}`}>
              {opt.cta}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SFTP phase ─────────────────────────────────────────────────────
// Informational card for option 3. The actual SFTP server is set up
// per-org via Settings → Integrations; here we just surface the path
// + a copy-to-clipboard affordance + an external link to the
// credentials manager (stubbed for now).
function SftpPhase({ showToast }) {
  const sftpPath = 'sftp://upload.foldhealth.com/<your-org>/hcc/inbox';
  const simulateSftpIngest = useAppStore(s => s.simulateSftpIngest);
  const cancel = useAppStore(s => s.cancelHccUpload);
  const sftpBatches = useAppStore(s => s.hccSftpBatches || []);
  const openHccSftpReview = useAppStore(s => s.openHccSftpReview);
  const pendingCount = sftpBatches.filter(b => b.status === 'pending').length;
  const readyCount = sftpBatches.filter(b => b.status === 'done').length;

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(sftpPath);
      showToast('SFTP path copied to clipboard');
    } catch {
      showToast('Could not copy — your browser blocked clipboard access');
    }
  };
  return (
    <div className={styles.sftpPhase}>
      <p className={styles.pickerSubtitle}>
        Bulk-upload via SFTP. Documents dropped at the path below are picked
        up by Astrana / Support and ingested into the AI review queue.
      </p>

      <div className={styles.sftpCard}>
        <div className={styles.sftpCardHeader}>
          <Icon name="solar:server-2-linear" size={20} color="var(--secondary-300)" />
          <span>SFTP inbox</span>
        </div>
        <div className={styles.sftpPathRow}>
          <code className={styles.sftpPath}>{sftpPath}</code>
          <button type="button" className={styles.sftpCopyBtn} onClick={copyPath}>
            <Icon name="solar:copy-linear" size={14} color="var(--primary-300)" />
            Copy
          </button>
        </div>
        <ul className={styles.sftpHints}>
          <li>Files: PDF, DOC, JPG, PNG, TIFF</li>
          <li>Naming: any — AI resolves patient + DOS from the document contents</li>
          <li>New files trigger a batch within ~5 minutes</li>
        </ul>
      </div>

      <div className={styles.sftpExternal}>
        <Icon name="solar:link-linear" size={14} color="var(--primary-300)" />
        <a
          href="https://foldhealth.example/sftp-credentials"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sftpExternalLink}
        >
          Manage SFTP credentials
        </a>
        <span className={styles.sftpExternalHint}>· opens in a new tab</span>
      </div>

      {/* Demo trigger — kicks off a batch of 3 dummy documents through
          the SFTP path so the multi-doc review drawer can be exercised
          without an actual SFTP connection. */}
      <div className={styles.sftpDemo}>
        <div className={styles.sftpDemoHead}>
          <Icon name="solar:bolt-linear" size={14} color="var(--primary-300)" />
          <span>Demo SFTP ingestion</span>
        </div>
        <p className={styles.sftpDemoBody}>
          Simulate 3 documents landing in the SFTP inbox. AI extraction runs
          in the background; you'll get a bell notification when the batch
          is ready for review.
        </p>
        <div className={styles.sftpDemoActions}>
          <Button
            variant="alt"
            size="S"
            leadingIcon="solar:cloud-upload-linear"
            onClick={async () => {
              cancel?.();  // close this drawer so the user goes back to the worklist
              await simulateSftpIngest?.();
            }}
          >
            Simulate Ingestion
          </Button>
          {(pendingCount > 0 || readyCount > 0) && (
            <button
              type="button"
              className={styles.sftpDemoReviewBtn}
              onClick={() => { cancel?.(); openHccSftpReview?.(); }}
            >
              <Icon
                name={pendingCount > 0 ? 'solar:loading-linear' : 'solar:document-text-linear'}
                size={13}
                color={pendingCount > 0 ? 'var(--neutral-400)' : 'var(--primary-300)'}
              />
              {pendingCount > 0
                ? `Extracting ${pendingCount} file${pendingCount === 1 ? '' : 's'}…`
                : `Review ${readyCount} ready file${readyCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Single-encounter form (option 1) ───────────────────────────────
// Manual entry path: pick a patient, add ICD chips, fill the encounter
// context, attach a document, Confirm. Routes through the existing
// hccCreateOrMergeFromEncounter so dedup + activity-log wiring all works.
function SinglePhase({ hccMembers, batchId, showToast, createFromEncounter, onDone, onSaveApiChange }) {
  const [patient, setPatient] = useState(null);   // selected hccMember or null
  const [patientQuery, setPatientQuery] = useState('');
  const [patientPickerOpen, setPatientPickerOpen] = useState(false);
  const patientPickerWrapRef = useRef(null);
  const patientInputRef = useRef(null);
  const patientMatches = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return hccMembers.slice(0, 20);
    return hccMembers
      .filter(m => (m.name || '').toLowerCase().includes(q))
      .slice(0, 20);
  }, [hccMembers, patientQuery]);

  // Close the member popover on outside click / Escape.
  useEffect(() => {
    if (!patientPickerOpen) return undefined;
    const onDoc = (e) => {
      if (patientPickerWrapRef.current && !patientPickerWrapRef.current.contains(e.target)) {
        setPatientPickerOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setPatientPickerOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [patientPickerOpen]);

  // Multiple DOS blocks — each an independent record for the same
  // patient. New blocks default empty; user fills date/provider/pos +
  // document type, drops a file, adds ICDs.
  const newDosBlock = () => ({
    id: `nd-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    dos: '',
    provider: '',
    pos: '',
    docType: '',
    file: null,
    icds: [],
  });
  const [dosBlocks, setDosBlocks] = useState(() => [newDosBlock()]);
  const patchBlock = (id, patch) => setDosBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  const addDosBlock = () => setDosBlocks(prev => [...prev, newDosBlock()]);
  const removeDosBlock = (id) => setDosBlocks(prev => prev.length > 1 ? prev.filter(b => b.id !== id) : prev);

  // Provider list is derived once from the reference pool — dedupe
  // across visit types so the Select shows every doctor the demo seeds.
  const providerOptions = useMemo(() => {
    const set = new Set();
    Object.values(PROVIDER_POOL_BY_VT).forEach(list => list.forEach(p => set.add(p)));
    return Array.from(set).sort().map(p => ({ value: p, label: p }));
  }, []);
  const canSave = !!patient && dosBlocks.every(b => (
    b.dos && b.provider && b.pos && b.docType && b.file
  ));

  const handleSave = () => {
    if (!canSave) return;
    let created = 0;
    dosBlocks.forEach((b) => {
      const result = createFromEncounter({
        tempId: `single-${b.id}`,
        patient: {
          name: patient.name,
          dob: patient.dob,
          matchedMemberId: patient.id,
          matchConfidence: 100,
        },
        dos: b.dos,
        provider: b.provider,
        pos: b.pos,
        posDesc: POS_LABEL[b.pos] || '',
        icds: b.icds.map(i => ({ code: i.code, valid: true })),
        _docName: b.file?.name || `Manual entry — ${patient.name} ${b.dos}.pdf`,
        _docType: b.docType || 'Progress Note',
        errors: [],
      });
      if (result.kind !== 'skipped') created += 1;
    });
    showToast(`Added ${created} DOS record${created === 1 ? '' : 's'} for ${patient.name}`);
    onDone?.();
  };

  // Publish { save, canSave, patientName } up to the drawer header on
  // every render so both the "Save" button state and the drawer's
  // contextual title reflect the form's current state.
  useEffect(() => {
    onSaveApiChange?.({ save: handleSave, canSave, patientName: patient?.name || '' });
    return () => onSaveApiChange?.({ save: () => {}, canSave: false, patientName: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave, patient?.id, patient?.name, dosBlocks]);

  return (
    <div className={styles.singlePhase}>
      {/* Member selector — the field itself is the search input. Focus
          reveals the match list in an absolutely-positioned popover so
          the DOS card below never shifts. */}
      <div className={styles.singleSection} ref={patientPickerWrapRef}>
        <label className={styles.singleLabel}>
          Member <span className={styles.singleReq}>•</span>
        </label>
        <div className={styles.singleMemberField}>
          {patient && !patientPickerOpen ? (
            <button
              type="button"
              className={styles.singleMemberSelected}
              onClick={() => {
                setPatientQuery('');
                setPatientPickerOpen(true);
                setTimeout(() => patientInputRef.current?.focus(), 0);
              }}
            >
              <Avatar variant="patient" initials={patient.in} />
              <span className={styles.singleMemberName}>{patient.name}</span>
              <span className={styles.singleMemberMeta}>
                ({[patient.g, patient.age, patient.memberId || patient.member_id]
                  .filter(Boolean)
                  .join(' • ')})
              </span>
            </button>
          ) : (
            <input
              ref={patientInputRef}
              type="text"
              className={styles.singleMemberInput}
              placeholder="Search and Select Member"
              value={patientQuery}
              autoFocus={patientPickerOpen}
              onFocus={() => setPatientPickerOpen(true)}
              onChange={(e) => { setPatientQuery(e.target.value); setPatientPickerOpen(true); }}
            />
          )}
          <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" />
        </div>
        {patientPickerOpen && (
          <div className={styles.singleMemberPop}>
            {patientMatches.length === 0 ? (
              <div className={styles.singleMemberEmpty}>No matches</div>
            ) : patientMatches.map(m => (
              <button
                key={m.id}
                type="button"
                className={styles.memberPickerItem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPatient(m);
                  setPatientQuery('');
                  setPatientPickerOpen(false);
                  patientInputRef.current?.blur();
                }}
              >
                <Avatar variant="patient" initials={m.in} />
                <span>{m.name}</span>
                <span className={styles.memberPickerMeta}>{m.memberId || m.member_id || ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Repeatable DOS blocks — layout mirrors HccAddDosDrawer's
          Patient-level Add DOS drawer: dropzone + 2×2 field grid +
          ICD list. */}
      {dosBlocks.map((block) => (
        <SingleDosCard
          key={block.id}
          block={block}
          providerOptions={providerOptions}
          patient={patient}
          onPatch={(patch) => patchBlock(block.id, patch)}
          onRemove={dosBlocks.length > 1 ? () => removeDosBlock(block.id) : null}
          showToast={showToast}
        />
      ))}

      {/* Add More DOS — dashed primary-tinted CTA. */}
      <button
        type="button"
        className={styles.addMoreDosBtn}
        onClick={addDosBlock}
      >
        <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
        Add More DOS
      </button>
    </div>
  );
}

/**
 * SingleDosCard — one DOS block inside the Add-DOS drawer. Layout
 * mirrors the Patient-level Add DOS drawer (`HccAddDosDrawer` →
 * `DosBlock`): expand-arrow + "DOS: {value}" header with Ready/Not
 * Ready badge + trash, a full-width Dropzone (or attached-file chip),
 * a 2×2 field grid (DOS · Rendering Provider · POS · Document Type),
 * and an ICD Codes section listing each pick as its own row.
 */
function SingleDosCard({ block, providerOptions, patient, onPatch, onRemove, showToast }) {
  const [collapsed, setCollapsed] = useState(false);
  const onPickFile = (file) => {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      showToast?.('Please upload a PDF, DOC, JPG, PNG, or TIFF file');
      return;
    }
    onPatch({ file });
  };
  return (
    <div className={styles.singleDosCard}>
      <div className={styles.singleDosHead}>
        <button
          type="button"
          className={styles.singleDosCollapse}
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expand DOS' : 'Collapse DOS'}
          aria-expanded={!collapsed}
        >
          <Icon
            name={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'}
            size={16}
            color="var(--neutral-400)"
          />
        </button>
        <span className={styles.singleDosTitle}>DOS: {block.dos || '-'}</span>
        <div className={styles.singleDosHeadSpacer} />
        {onRemove && (
          <button
            type="button"
            className={styles.singleTrashBtn}
            onClick={onRemove}
            aria-label="Remove DOS"
          >
            <Icon name="solar:trash-bin-trash-linear" size={16} color="var(--neutral-300)" />
          </button>
        )}
      </div>

      {!collapsed && (
      <div className={styles.singleDosBody}>
        {block.file ? (
          <div className={styles.singleFileChip}>
            <Icon name="solar:file-text-linear" size={14} color="var(--neutral-400)" />
            <span className={styles.singleFileName}>{block.file.name}</span>
            <button
              type="button"
              className={styles.singleFileRemove}
              onClick={() => onPatch({ file: null })}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <DemoPhiStrip />
            <Dropzone
              accept={ACCEPT_EXT}
              helperText="Supported formats: PDF, DOC, JPG, or PNG"
              secondaryText="Max size: 100 MB"
              icon="solar:upload-minimalistic-linear"
              onPick={onPickFile}
              onReject={() => showToast?.('Please upload a PDF, DOC, JPG, PNG, or TIFF file')}
            />
          </>
        )}

        <div className={styles.singleGrid}>
          <div className={styles.singleField}>
            <label className={styles.singleLabel}>
              DOS <span className={styles.singleReq}>•</span>
            </label>
            <DatePicker
              value={toIsoDate(block.dos)}
              onSelect={(iso) => onPatch({ dos: fromIsoDate(iso) })}
            />
          </div>
          <div className={styles.singleField}>
            <label className={styles.singleLabel}>
              Rendering Provider <span className={styles.singleReq}>•</span>
            </label>
            <Select
              options={providerOptions}
              value={block.provider}
              placeholder="Select Rendering Provider"
              searchable
              searchPlaceholder="Search providers…"
              onChange={(v) => onPatch({ provider: v })}
            />
          </div>
          <div className={styles.singleField}>
            <label className={styles.singleLabel}>
              POS <span className={styles.singleReq}>•</span>
            </label>
            <Select
              options={POS_SELECT_OPTIONS}
              value={block.pos}
              placeholder="Select Place of Service"
              searchable
              searchPlaceholder="Search POS code or name…"
              onChange={(v) => onPatch({ pos: v })}
            />
          </div>
          <div className={styles.singleField}>
            <label className={styles.singleLabel}>
              Document Type <span className={styles.singleReq}>•</span>
            </label>
            <Select
              options={DOC_TYPE_OPTIONS}
              value={block.docType}
              placeholder="Select Document Type"
              onChange={(v) => onPatch({ docType: v })}
            />
          </div>
        </div>

        <div className={styles.singleIcdSection}>
          <label className={styles.singleLabel}>ICD Codes</label>
          <IcdSearch
            placeholder="Search and Add ICD Code & Description, HCC Code & Description"
            excludeCodes={block.icds.map(i => i.code)}
            onSelect={(icd) => onPatch({
              icds: [...block.icds, { code: icd.code, desc: icd.title, hcc: icd.hcc || '', valid: true }],
            })}
          />
          {block.icds.map(icd => (
            <div key={icd.code} className={styles.singleIcdRow}>
              <span className={styles.singleIcdCode}>{icd.code}</span>
              <div className={styles.singleIcdMain}>
                <div className={styles.singleIcdDesc}>{icd.desc}</div>
                {icd.hcc && <div className={styles.singleIcdHcc}>{icd.hcc}</div>}
              </div>
              <button
                type="button"
                className={styles.singleTrashBtn}
                onClick={() => onPatch({ icds: block.icds.filter(x => x.code !== icd.code) })}
                aria-label={`Remove ${icd.code}`}
              >
                <Icon name="solar:trash-bin-trash-linear" size={14} color="var(--neutral-300)" />
              </button>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

// MM/DD/YYYY (state format used by handleSave) ↔ YYYY-MM-DD (native <input type="date">).
const toIsoDate = (mdy) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mdy || '');
  return m ? `${m[3]}-${m[1]}-${m[2]}` : '';
};
const fromIsoDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
};

const DOC_TYPE_OPTIONS = [
  { value: 'AWV', label: 'AWV Note' },
  { value: 'Progress Note', label: 'Progress Note' },
  { value: 'SOAP Note', label: 'SOAP Note' },
  { value: 'Lab', label: 'Lab' },
  { value: 'Other', label: 'Other' },
];

function ReviewPhase({ encounters, groups, hccMembers, patchEnc, removeEnc, addEnc, selectedIdx, setSelectedIdx, filter, setFilter, layout, selectedIdxs, toggleSelected, setSelectedAll, sourceFileName, showToast, openPagePreview }) {
  // Aggregate counts per status for the filter chips. The bucket keys
  // here must match what encounterStatus() returns ('error' singular,
  // 'mismatched', 'ready') — historically had a typo where the chip
  // initialized `errors: 0` and the increment created a new `error` key.
  const counts = useMemo(() => {
    const c = { all: encounters.length, error: 0, mismatched: 0, ready: 0 };
    encounters.forEach(e => { c[encounterStatus(e)]++; });
    return c;
  }, [encounters]);

  // Filter the master list. Filter keys must match encounterStatus()
  // return values for the predicate to match.
  const visibleGroups = useMemo(() => {
    if (filter === 'all') return groups;
    return groups
      .map(g => ({ ...g, encounters: g.encounters.filter(e => encounterStatus(e) === filter) }))
      .filter(g => g.encounters.length > 0);
  }, [groups, filter]);

  // If selected encounter is filtered out, jump to first visible one.
  useEffect(() => {
    const visibleIdxs = visibleGroups.flatMap(g => g.encounters.map(e => e._idx));
    if (visibleIdxs.length && !visibleIdxs.includes(selectedIdx)) {
      setSelectedIdx(visibleIdxs[0]);
    }
  }, [visibleGroups, selectedIdx, setSelectedIdx]);

  const selectedEnc = encounters.find((_, i) => i === selectedIdx) || null;
  const selectedMember = selectedEnc?.patient?.matchedMemberId
    ? hccMembers.find(m => m.id === selectedEnc.patient.matchedMemberId)
    : null;

  const handleRemove = (idx) => {
    removeEnc(idx);
    // After remove, indices shift — let the useEffect above refind a valid one.
    if (idx === selectedIdx) setSelectedIdx(Math.max(0, idx - 1));
  };

  const patientCount = new Set(
    encounters.map(e => e.patient?.matchedMemberId || `__unmatched-${e.tempId}`),
  ).size;

  return (
    <div className={styles.reviewPhase}>
      {/* Step indicator — mirrors the picker phase but with step 2 active. */}
      <div className={styles.reviewSteps}>
        <StepIndicator activeStep={2} />
      </div>
      {/* Stats bar + filter chips */}
      <div className={styles.statsBar}>
        <div className={styles.statsSummary}>
          <span><strong>{counts.all}</strong> encounter{counts.all === 1 ? '' : 's'}</span>
          <span>·</span>
          <span><strong>{patientCount}</strong> patient{patientCount === 1 ? '' : 's'}</span>
        </div>
        <div className={styles.filterChips}>
          {[
            { key: 'all',         label: 'All',         count: counts.all },
            { key: 'error',       label: 'Errors',      count: counts.error },
            { key: 'mismatched',  label: 'Mismatched',  count: counts.mismatched },
            { key: 'ready',       label: 'Ready',       count: counts.ready },
          ].map(f => (
            <button
              key={f.key}
              type="button"
              className={[styles.filterChip, filter === f.key ? styles.filterChipActive : ''].filter(Boolean).join(' ')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className={styles.filterChipCount}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk-action bar — two quick affordances pulled from the spec:
          "Accept All High Confidence" selects every encounter with
          match confidence ≥ 85 and no errors; "Review Flagged (N)"
          scrolls the first low-confidence / error row into view and
          jumps the filter to those rows. */}
      <div className={styles.bulkBar}>
        <div className={styles.bulkBarLeft}>
          <button
            type="button"
            className={styles.bulkBtnPrimary}
            onClick={() => {
              const highConf = encounters
                .map((e, i) => ({ e, i }))
                .filter(({ e }) => (e.patient?.matchConfidence ?? 0) >= 85 && (!e.errors || e.errors.length === 0))
                .map(({ i }) => i);
              setSelectedAll?.(highConf, true);
              showToast?.(`${highConf.length} high-confidence encounter${highConf.length === 1 ? '' : 's'} selected`);
            }}
          >
            <Icon name="solar:check-circle-linear" size={13} color="var(--status-success)" />
            Accept All High Confidence
          </button>
          <button
            type="button"
            className={styles.bulkBtnSecondary}
            disabled={counts.error === 0 && !encounters.some(e => (e.patient?.matchConfidence ?? 100) < 60)}
            onClick={() => {
              // Switch filter to errors so the user lands on the
              // flagged rows; if there are no errors but there are
              // low-confidence rows, surface those instead.
              const lowConf = encounters.find(e => (e.patient?.matchConfidence ?? 100) < 60);
              if (counts.error > 0) setFilter('error');
              else if (counts.mismatched > 0) setFilter('mismatched');
              else if (lowConf) showToast?.('No errors, but some rows are below 60% confidence');
              // Scroll the first flagged row into view on the next paint.
              setTimeout(() => {
                const row = document.querySelector(`[class*="encTableRowError"], [class*="encTableRowMismatch"]`);
                row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 50);
            }}
          >
            <Icon name="solar:flag-2-linear" size={13} color="var(--status-warning)" />
            Review Flagged ({counts.error + counts.mismatched})
          </button>
        </div>
        {selectedIdxs.size > 0 && (
          <div className={styles.bulkBarRight}>
            <Icon name="solar:check-square-linear" size={13} color="var(--primary-300)" />
            <span>
              <strong>{selectedIdxs.size}</strong> of {encounters.length} selected
              {' · '}
              on Add to Worklist the other {encounters.length - selectedIdxs.size} will be rejected
            </span>
          </div>
        )}
      </div>

      {/* Layout body — master-detail or editable table. */}
      {layout === 'table' ? (
        <TableLayout
          visibleGroups={visibleGroups}
          encounters={encounters}
          hccMembers={hccMembers}
          patchEnc={patchEnc}
          handleRemove={handleRemove}
          sourceFileName={sourceFileName}
          selectedIdxs={selectedIdxs}
          toggleSelected={toggleSelected}
          setSelectedAll={setSelectedAll}
          showToast={showToast}
          openPagePreview={openPagePreview}
        />
      ) : (
      <div className={styles.masterDetail}>
        {/* Master: encounter list grouped by patient */}
        <div className={styles.master}>
          {visibleGroups.length === 0 ? (
            <div className={styles.masterEmpty}>No encounters match this filter.</div>
          ) : visibleGroups.map((g) => {
            const member = g.memberId ? hccMembers.find(m => m.id === g.memberId) : null;
            const displayName = member?.name || g.encounters[0]?.patient?.name || 'Unmatched patient';
            return (
              <div key={g.memberId || `unmatched-${g.encounters[0]?._idx}`}>
                <div className={styles.patientGroupBanner}>
                  <Avatar variant="patient" initials={member?.in || (displayName.split(' ').map(p => p[0]).slice(0,2).join(''))} />
                  <span>{displayName}</span>
                  <span className={styles.patientGroupBannerCount}>
                    · {g.encounters.length} encounter{g.encounters.length === 1 ? '' : 's'}
                  </span>
                  {!member && <span className={styles.unmatchedBadge}>Unmatched</span>}
                  {member && (
                    /* Manual-encounter trigger — spawns a blank encounter
                       pre-linked to this patient so the user can add a DOS
                       that wasn't captured by OCR (e.g. a separate scanned
                       progress note). New row lands at the bottom of the
                       group and auto-selects so they can fill it in. */
                    <button
                      type="button"
                      className={styles.addEncounterBtn}
                      onClick={() => {
                        addEnc?.(member);
                        // Select the newly-appended row (it's now the last index).
                        setTimeout(() => {
                          const total = (encounters || []).length;
                          setSelectedIdx(total); // post-add the new row is at length-1 of NEW state
                        }, 0);
                      }}
                      title={`Add a new encounter for ${member.name}`}
                    >
                      <Icon name="solar:add-circle-linear" size={12} color="var(--primary-300)" />
                      Add encounter
                    </button>
                  )}
                </div>
                {g.encounters.map(enc => (
                  <MasterRow
                    key={enc.tempId}
                    enc={enc}
                    selected={enc._idx === selectedIdx}
                    onSelect={() => setSelectedIdx(enc._idx)}
                    onRemove={() => handleRemove(enc._idx)}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* Detail: editor for the selected encounter */}
        <div className={styles.detail}>
          {!selectedEnc ? (
            <div className={styles.detailEmpty}>Select an encounter to edit</div>
          ) : (
            <>
              <div className={styles.detailHeader}>
                <Avatar
                  variant="patient"
                  initials={selectedMember?.in || (selectedEnc.patient?.name || '?').split(' ').map(p => p[0]).slice(0,2).join('')}
                />
                <div className={styles.detailHeaderText}>
                  <span className={styles.detailHeaderName}>
                    {selectedMember?.name || selectedEnc.patient?.name || 'Unmatched patient'}
                  </span>
                  <span className={styles.detailHeaderMeta}>
                    DOS {selectedEnc.dos || '—'} · {selectedEnc.provider || '—'}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.detailRemoveBtn}
                  onClick={() => handleRemove(selectedIdx)}
                >
                  <Icon name="solar:trash-bin-trash-linear" size={14} color="var(--status-error)" />
                  Remove encounter
                </button>
              </div>
              <div className={styles.detailBody}>
                <EncounterCard
                  enc={selectedEnc}
                  hccMembers={hccMembers}
                  onPatch={(patch) => patchEnc(selectedIdx, patch)}
                />
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * Option 2 — flat editable table. Each row is one encounter with all
 * fields editable inline. Designed for keyboard-driven bulk review at
 * scale. Patient column shows the matched member's name (or a "Link
 * patient" picker for unmatched rows).
 */
function TableLayout({ visibleGroups, encounters, hccMembers, patchEnc, handleRemove, selectedIdxs, toggleSelected, setSelectedAll, sourceFileName, showToast, openPagePreview }) {
  // Keep the grouped shape — TableLayout now renders patient header rows
  // followed by their encounter rows so the same-patient cluster is
  // visually obvious (matches the master-detail panel grouping).
  const rows = useMemo(
    () => visibleGroups.flatMap(g => g.encounters),
    [visibleGroups],
  );

  const recalcErrors = (enc) => {
    const errors = [];
    if (!enc.patient?.name) errors.push('patientName');
    if (!enc.patient?.dob) errors.push('dob');
    if (!enc.dos) errors.push('dos');
    if (!enc.provider) errors.push('provider');
    if (!enc.pos) errors.push('pos');
    return errors;
  };

  const patchField = (idx, patch) => {
    const cur = encounters[idx];
    const next = {
      ...cur,
      ...patch,
      patient: { ...cur.patient, ...(patch.patient || {}) },
    };
    patchEnc(idx, { ...patch, errors: recalcErrors(next) });
  };

  if (rows.length === 0) {
    return <div className={styles.tableEmpty}>No encounters match this filter.</div>;
  }

  const visibleIdxs = rows.map(r => r._idx);
  const allSelected = visibleIdxs.length > 0 && visibleIdxs.every(i => selectedIdxs?.has(i));
  const someSelected = visibleIdxs.some(i => selectedIdxs?.has(i));

  return (
    <div className={styles.tableWrap}>
      <table className={styles.encTable}>
        <thead>
          <tr>
            <th className={styles.thCheck}>
              <Checkbox
                aria-label="Select all encounters"
                checked={allSelected ? true : (someSelected ? 'indeterminate' : false)}
                onCheckedChange={(v) => setSelectedAll?.(visibleIdxs, v === true)}
              />
            </th>
            <th className={styles.thPatient}>Member</th>
            <th className={styles.thDos}>DOS <span className={styles.thRequired}>*</span></th>
            <th className={styles.thProvider}>Rendering Provider <span className={styles.thRequired}>*</span></th>
            <th className={styles.thPos}>POS <span className={styles.thRequired}>*</span></th>
            <th className={styles.thIcds}>ICD Codes</th>
            <th className={styles.thStatus}>Status</th>
            <th className={styles.thActions}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((enc) => (
            <TableRow
              key={enc.tempId}
              enc={enc}
              hccMembers={hccMembers}
              onPatch={(patch) => patchField(enc._idx, patch)}
              onRemove={() => handleRemove(enc._idx)}
              checked={selectedIdxs?.has(enc._idx) || false}
              onToggle={() => toggleSelected?.(enc._idx)}
              sourceFileName={sourceFileName}
              showToast={showToast}
              openPagePreview={openPagePreview}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({ enc, hccMembers, onPatch, onRemove, checked, onToggle, sourceFileName, showToast, openPagePreview }) {
  const status = encounterStatus(enc);
  const errors = new Set(enc.errors || []);
  const isMatched = !!enc.patient?.matchedMemberId;
  const member = isMatched ? hccMembers.find(m => m.id === enc.patient.matchedMemberId) : null;
  const [picking, setPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState('');

  const rowCls = [
    styles.encTableRow,
    status === 'error' ? styles.encTableRowError : '',
    status === 'mismatched' ? styles.encTableRowMismatch : '',
  ].filter(Boolean).join(' ');

  const filteredMembers = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return hccMembers.slice(0, 6);
    return hccMembers.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      (m.memberId || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [hccMembers, pickQuery]);

  const handleLink = (m) => {
    onPatch({
      patient: {
        ...enc.patient,
        name: m.name,
        matchedMemberId: m.id,
        matchConfidence: 100,
      },
    });
    setPicking(false);
    setPickQuery('');
  };

  return (
    <tr className={rowCls}>
      <td className={styles.tdCheck}>
        <Checkbox
          aria-label="Select encounter"
          checked={!!checked}
          onCheckedChange={() => onToggle?.({ target: { checked: !checked } })}
        />
      </td>
      {/* Patient — chip when matched (clickable to swap), picker when
          unmatched or when the user has opened the swap UI. */}
      <td className={styles.tdPatient}>
        {picking ? (
          <div className={styles.tdPatientPicker}>
            {enc.patient?.idMismatch && (
              <div className={styles.tdPatientPickerHint} title="Document's Patient ID didn't match this Fold record exactly.">
                <Icon name="solar:danger-circle-bold" size={11} color="var(--status-warning)" />
                Document ID <strong>{enc.patient.patientId}</strong> · Fold ID <strong>{enc.patient.matchedMemberDisplayId || '—'}</strong>
              </div>
            )}
            <Input
              autoFocus
              placeholder="Search by name or Patient ID"
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
            />
            <div className={styles.tdPatientPickerList}>
              {filteredMembers.map(m => {
                const isCurrent = m.id === enc.patient?.matchedMemberId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={[styles.tdPatientPickerItem, isCurrent ? styles.tdPatientPickerItemActive : ''].filter(Boolean).join(' ')}
                    onClick={() => handleLink(m)}
                  >
                    <Avatar variant="patient" initials={m.in} />
                    <span className={styles.tdPatientPickerItemBody}>
                      <span className={styles.tdPatientPickerItemName}>{m.name}</span>
                      {m.memberId && (
                        <span className={styles.tdPatientPickerItemId}>{m.memberId}</span>
                      )}
                    </span>
                    {isCurrent && <span className={styles.tdPatientPickerCurrent}>Current</span>}
                  </button>
                );
              })}
            </div>
            {isMatched && (
              <button
                type="button"
                className={styles.tdPatientPickerCancel}
                onClick={() => { setPicking(false); setPickQuery(''); }}
              >
                Cancel
              </button>
            )}
          </div>
        ) : isMatched ? (
          <button
            type="button"
            className={styles.tdPatientMatched}
            onClick={() => setPicking(true)}
            title="Change matched patient"
          >
            <Avatar variant="patient" initials={member?.in || (enc.patient.name || '?').split(' ').map(p => p[0]).slice(0,2).join('')} />
            <span className={styles.tdPatientNameWrap}>
              <span className={styles.tdPatientName}>{member?.name || enc.patient.name}</span>
              {member && (
                <span className={styles.tdPatientMeta}>
                  {member.g || ''}{member.age ? `·${member.age}` : ''}
                  {member.memberId ? ` · ${member.memberId}` : ''}
                </span>
              )}
              {enc.patient?.idMismatch && (
                <span
                  className={styles.tdPatientIdMismatch}
                  title={`Document shows ID ${enc.patient.patientId}; Fold has ${member?.memberId || '—'}. Linked by name + DOB.`}
                >
                  <Icon name="solar:danger-circle-bold" size={10} color="var(--status-warning)" />
                  ID mismatch · doc: {enc.patient.patientId}
                </span>
              )}
            </span>
            <Icon name="solar:pen-2-linear" size={11} color="var(--neutral-300)" className={styles.tdPatientSwapIcon} />
          </button>
        ) : (
          <button
            type="button"
            className={styles.tdPatientLinkBtn}
            onClick={() => setPicking(true)}
            title="Link a Fold patient to this encounter"
          >
            <Icon name="solar:link-linear" size={12} color="var(--status-error)" />
            Link patient…
          </button>
        )}
      </td>
      {/* DOS — date input + per-field AI confidence chip. */}
      <td className={styles.tdField}>
        <Input
          variant={errors.has('dos') ? 'error' : 'default'}
          value={enc.dos || ''}
          placeholder="Enter DOS"
          onChange={(e) => onPatch({ dos: e.target.value })}
          className={styles.tdInput}
        />
        <FieldConfidence score={getFieldConfidence(enc, 'dos')} sourcePage={enc.sourcePage} sourceFileName={sourceFileName} onOpenSource={openPagePreview} />
      </td>
      {/* Rendering Provider — Select dropdown + confidence chip. */}
      <td className={styles.tdField}>
        <ProviderSelect
          value={enc.provider || ''}
          onChange={(v) => onPatch({ provider: v })}
          error={errors.has('provider')}
        />
        <FieldConfidence score={getFieldConfidence(enc, 'provider')} sourcePage={enc.sourcePage} sourceFileName={sourceFileName} onOpenSource={openPagePreview} />
      </td>
      {/* POS — Select dropdown + confidence chip. */}
      <td className={styles.tdField}>
        <PosSelect
          value={enc.pos || ''}
          onChange={(v) => onPatch({ pos: v, posDesc: POS_LABEL[v] || '' })}
          error={errors.has('pos')}
        />
        <FieldConfidence score={getFieldConfidence(enc, 'pos')} sourcePage={enc.sourcePage} sourceFileName={sourceFileName} onOpenSource={openPagePreview} />
      </td>
      {/* ICD Codes — chip + "+N" overflow + "+" add + confidence chip. */}
      <td className={styles.tdField}>
        <IcdChipStack
          icds={enc.icds || []}
          onRemove={(code) => onPatch({ icds: (enc.icds || []).filter(i => i.code !== code) })}
          onAdd={(item) => onPatch({ icds: [...(enc.icds || []), item] })}
          onEdit={(oldCode, item) => onPatch({
            icds: (enc.icds || []).map(i => i.code === oldCode ? { ...i, ...item } : i),
          })}
        />
        <FieldConfidence score={getFieldConfidence(enc, 'icds')} sourcePage={enc.sourcePage} sourceFileName={sourceFileName} onOpenSource={openPagePreview} />
      </td>
      {/* Status — second-to-last. Solid-text inline chip with leading icon. */}
      <td className={styles.tdStatus}>
        <span className={[
          styles.statusInline,
          status === 'ready' ? styles.statusInlineReady : '',
          status === 'error' ? styles.statusInlineError : '',
          status === 'mismatched' ? styles.statusInlineMismatch : '',
        ].filter(Boolean).join(' ')}>
          {status === 'ready' && <Icon name="solar:check-circle-bold" size={13} color="var(--status-success)" />}
          {status === 'error' && <Icon name="solar:danger-triangle-bold" size={13} color="var(--status-error)" />}
          {status === 'mismatched' && <Icon name="solar:question-circle-bold" size={13} color="var(--status-warning)" />}
          {status === 'ready' ? 'Ready' : status === 'error' ? 'Missing Fields' : 'Mismatched'}
        </span>
      </td>
      {/* Action — last column, sticky-right at right:0 so destructive
          affordances stay reachable at any horizontal scroll. */}
      <td className={styles.tdActions}>
        <button
          type="button"
          className={styles.tdLinkDocBtn}
          aria-label="View source page"
          title={enc.sourcePage ? `Source page ${enc.sourcePage}${sourceFileName ? ` of ${sourceFileName}` : ''}` : 'Source document'}
          onClick={() => openPagePreview?.(enc.sourcePage || 1)}
        >
          <Icon name="solar:document-text-linear" size={14} color="var(--neutral-300)" />
        </button>
        <button
          type="button"
          className={styles.tdRemoveBtn}
          onClick={onRemove}
          aria-label="Remove encounter"
          title="Remove encounter"
        >
          <Icon name="solar:trash-bin-trash-linear" size={14} color="var(--status-error)" />
        </button>
      </td>
    </tr>
  );
}

function CellInput({ value, onChange, error, placeholder, narrow }) {
  return (
    <td className={narrow ? styles.tdNarrow : ''}>
      <Input
        variant={error ? 'error' : 'default'}
        value={value || ''}
        placeholder={placeholder || ''}
        onChange={(e) => onChange(e.target.value)}
        className={styles.tdInput}
      />
    </td>
  );
}

/**
 * Compact ICD chip stack for the table layout. Shows first 2 chips and
 * a "+N" overflow that expands on click. Invalid (non-V28) codes render
 * struck-through.
 */
/**
 * FieldConfidence — minimal, text-only per-field confidence indicator.
 *
 * Renders the percent in the tier color (no pill, no icon). Hover
 * surfaces a richer popover explaining what the score means + what
 * the user should do at this tier. If a `sourcePage` is supplied,
 * shows a "View citation" link in the popover that opens the page
 * preview at that page. The percent text itself is also clickable
 * (same action) so the citation is reachable in one tap.
 */
function FieldConfidence({ score, sourcePage, sourceFileName, onOpenSource }) {
  const triggerRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  // Compute popover position on hover so it floats above the trigger
  // and is anchored to the screen (escapes the table's overflow-clip).
  useEffect(() => {
    if (!hover || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ left: r.left, top: r.top });
  }, [hover]);

  if (typeof score !== 'number') return null;
  if (score === 0) {
    return (
      <span className={[styles.fieldConf, styles.fieldConfMissing].join(' ')} title="No value detected by AI">
        —
      </span>
    );
  }
  let tier = 'Low';
  let tierCls = styles.fieldConfLow;
  let helpText = "Below 60%. AI is uncertain — verify against the source document before accepting.";
  if (score >= 85) {
    tier = 'High';
    tierCls = styles.fieldConfHigh;
    helpText = "85% or above. Strong match between the document and the field — safe to accept.";
  } else if (score >= 60) {
    tier = 'Medium';
    tierCls = styles.fieldConfMedium;
    helpText = "Between 60-84%. Review recommended before accepting.";
  }
  const canCite = typeof onOpenSource === 'function' && sourcePage;
  return (
    <span
      ref={triggerRef}
      className={[styles.fieldConfWrap, canCite ? styles.fieldConfWrapClickable : ''].join(' ')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className={[styles.fieldConf, tierCls].join(' ')}
        onClick={() => canCite && onOpenSource(sourcePage)}
        disabled={!canCite}
      >
        {score}%
      </button>
      {hover && createPortal(
        <span
          className={styles.fieldConfPop}
          role="tooltip"
          style={{
            // Position above the trigger; clamp so the popover stays
            // inside the viewport on narrow screens.
            left: Math.min(window.innerWidth - 280, Math.max(8, pos.left)),
            top:  Math.max(8, pos.top - 8),
          }}
        >
          <span className={[styles.fieldConfPopHead, tierCls].join(' ')}>
            AI Confidence · {tier} ({score}%)
          </span>
          <span className={styles.fieldConfPopBody}>{helpText}</span>
          {canCite && (
            <button
              type="button"
              className={styles.fieldConfPopCite}
              onMouseDown={(e) => {
                e.preventDefault();
                onOpenSource(sourcePage);
              }}
            >
              <Icon name="solar:document-text-linear" size={11} color="var(--primary-300)" />
              View citation · page {sourcePage}
              {sourceFileName && <span className={styles.fieldConfPopFile}> · {sourceFileName}</span>}
            </button>
          )}
        </span>,
        document.body,
      )}
    </span>
  );
}

/**
 * Provider select — picks from a small canned list. Real EHR data
 * would back this; for the mock we surface a representative dropdown.
 */
function ProviderSelect({ value, onChange, error }) {
  const options = useMemo(() => [
    'Dr. Sarah Connor',
    'Dr. Kevin Brown',
    'Dr. Laura Wilson',
    'Dr. Emily Carter',
    'Dr. Michael Thompson',
    'Dr. Christopher Davis',
    'Dr. Sarah Johnson',
    'Dr. Angela White',
    'Dr. David Anderson',
    'Dr. Eamon',
    'Dr. Helen Yu',
    'Dr. Indigo I',
    'Dr. Mallory Hayes',
    'Dr. Ulysses Horne',
    'Dr. Tatum',
    'Dr. Reed MacLeod',
    'Dr. Susan Park',
    'Dr. Alan Morse',
    'Dr. Calvin Reed',
    'Dr. Karen Mills',
  ], []);
  // Make sure the current value is present in the option list so the
  // Select shows it; otherwise prepend it.
  const items = useMemo(() => {
    const set = new Set(options);
    if (value && !set.has(value)) return [value, ...options];
    return options;
  }, [options, value]);
  return (
    <Select
      value={value}
      onChange={onChange}
      options={items.map(o => ({ value: o, label: o }))}
      placeholder="Select provider"
      variant={error ? 'error' : 'default'}
    />
  );
}

/**
 * Place-of-service select — backed by the canonical POS_LABEL map so
 * the dropdown label and underlying code stay in sync.
 */
function PosSelect({ value, onChange, error }) {
  const options = useMemo(() => Object.entries(POS_LABEL).map(([code, label]) => ({
    value: code,
    label: `${code}(${label})`,
  })), []);
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select POS"
      variant={error ? 'error' : 'default'}
    />
  );
}

/**
 * IcdPicker — small inline typeahead anchored to the chip stack's `+`
 * button. Searches the codebase's ICD library by code or description.
 * Used for both Add (new ICD) and Edit (replace an existing chip).
 */
function IcdPicker({ existingCodes, editingCode, onPick, onClose }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) onClose?.();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  return (
    <div ref={wrapRef} className={styles.icdPickerWrap}>
      <IcdSearch
        autoFocus
        excludeCodes={existingCodes.filter((c) => c !== editingCode)}
        placeholder={editingCode ? `Replace ${editingCode}…` : 'Search ICD by code or description'}
        onSelect={(icd) => onPick?.({ code: icd.code, desc: icd.title, hcc: icd.hcc || '', valid: true })}
      />
    </div>
  );
}

function IcdChipStack({ icds, onRemove, onAdd, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const [picker, setPicker] = useState(null); // null | 'add' | { editingCode }
  const shown = expanded ? icds : icds.slice(0, 1);
  const overflow = icds.length - shown.length;

  const handlePicked = (item) => {
    if (picker?.editingCode) {
      // Edit-mode: replace the selected chip's code with the new pick.
      onEdit?.(picker.editingCode, item);
    } else {
      onAdd?.(item);
    }
    setPicker(null);
  };

  return (
    <div className={styles.tdIcdsRow}>
      {shown.map(icd => (
        <span
          key={icd.code}
          className={[styles.icdChip, icd.valid === false ? styles.icdChipInvalid : ''].filter(Boolean).join(' ')}
          title={icd.desc || (icd.valid === false ? 'Not a V28 HCC code' : 'Click to edit')}
          onClick={() => setPicker({ editingCode: icd.code })}
        >
          {icd.code}
          <CloseButton
            size={10}
            onClick={(e) => { e.stopPropagation(); onRemove?.(icd.code); }}
            className={styles.icdChipClose}
            label={`Remove ${icd.code}`}
          />
        </span>
      ))}
      {overflow > 0 && (
        <button type="button" className={styles.icdOverflow} onClick={() => setExpanded(true)}>
          +{overflow}
        </button>
      )}
      {(onAdd || onEdit) && (
        <div className={styles.icdAddWrap}>
          <button
            type="button"
            className={styles.icdAddBtn}
            onClick={() => setPicker(picker === 'add' ? null : 'add')}
            aria-label="Add ICD"
          >
            <Icon name="solar:add-circle-linear" size={14} color="var(--neutral-300)" />
          </button>
          {picker && (
            <IcdPicker
              existingCodes={icds.map(i => i.code)}
              editingCode={picker.editingCode}
              onPick={handlePicked}
              onClose={() => setPicker(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One row in the master list. Shows DOS + provider, with a status chip
 * on the right and an inline trash. Clicking the row selects it (loads
 * the editor in the right panel).
 */
function MasterRow({ enc, selected, onSelect, onRemove }) {
  const status = encounterStatus(enc);
  const rowCls = [
    styles.masterRow,
    selected ? styles.masterRowSelected : '',
    status === 'error' ? styles.masterRowError : '',
    status === 'mismatched' ? styles.masterRowMismatch : '',
  ].filter(Boolean).join(' ');
  const chipCls = [
    styles.masterStatusChip,
    status === 'ready' ? styles.masterStatusReady : '',
    status === 'error' ? styles.masterStatusError : '',
    status === 'mismatched' ? styles.masterStatusMismatch : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={rowCls} onClick={onSelect}>
      <div className={styles.masterRowMain}>
        <span className={styles.masterRowDos}>{enc.dos || '— No DOS —'}</span>
        <span className={styles.masterRowMeta}>
          {enc.provider || '—'} · POS {enc.pos || '—'}
        </span>
      </div>
      <span className={styles.masterRowChips}>
        <span className={chipCls}>
          {status === 'ready' && <Icon name="solar:check-circle-bold" size={11} color="var(--status-success)" />}
          {status === 'error' && <Icon name="solar:danger-triangle-bold" size={11} color="var(--status-error)" />}
          {status === 'mismatched' && <Icon name="solar:question-circle-bold" size={11} color="var(--status-warning)" />}
          {status === 'ready' ? 'Ready' : status === 'error' ? 'Missing field' : 'Mismatch'}
        </span>
      </span>
      <span />
      <button
        type="button"
        className={styles.masterRemoveBtn}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="Remove encounter"
      >
        <Icon name="solar:trash-bin-trash-linear" size={13} color="var(--status-error)" />
      </button>
    </div>
  );
}

function EncounterCard({ enc, hccMembers, onPatch }) {
  const errors = new Set(enc.errors || []);
  const isMatched = !!enc.patient?.matchedMemberId;
  const [picking, setPicking] = useState(false);
  const [pickQuery, setPickQuery] = useState('');

  // Update errors when fields change. Mandatory: patientName, dob, dos, provider, pos.
  const patchAndRevalidate = (patch) => {
    const next = {
      ...enc,
      ...patch,
      patient: { ...enc.patient, ...(patch.patient || {}) },
    };
    const newErrors = [];
    if (!next.patient?.name) newErrors.push('patientName');
    if (!next.patient?.dob) newErrors.push('dob');
    if (!next.dos) newErrors.push('dos');
    if (!next.provider) newErrors.push('provider');
    if (!next.pos) newErrors.push('pos');
    onPatch({ ...patch, errors: newErrors });
  };

  const handleLinkMember = (member) => {
    patchAndRevalidate({
      patient: {
        ...enc.patient,
        name: member.name,
        matchedMemberId: member.id,
        matchConfidence: 100,
      },
    });
    setPicking(false);
    setPickQuery('');
  };

  const filteredMembers = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return hccMembers.slice(0, 8);
    return hccMembers.filter(m => (m.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [hccMembers, pickQuery]);

  const removeIcd = (code) => {
    onPatch({ icds: enc.icds.filter(i => i.code !== code) });
  };

  const addIcd = (item) => {
    onPatch({ icds: [...(enc.icds || []), { code: item.code, desc: item.desc, valid: true }] });
  };

  return (
    <div className={[styles.encounterCard, isMatched ? '' : styles.encounterCardMismatch].filter(Boolean).join(' ')}>
      {!isMatched && (
        <div className={styles.mismatchBanner}>
          <Icon name="solar:danger-triangle-bold" size={14} color="var(--status-error)" />
          <span className={styles.mismatchText}>
            Patient identity could not be matched at 100% confidence. Manually link before confirming.
          </span>
          {!picking && (
            <button className={styles.linkBtn} onClick={() => setPicking(true)}>
              Manually link
            </button>
          )}
        </div>
      )}

      {/* Re-match affordance — visible on matched encounters so the user
          can swap an auto-matched (or previously-linked) patient. Hidden
          while the picker is open to avoid two open trigger states. */}
      {isMatched && !picking && (
        <div className={styles.rematchRow}>
          <span className={styles.rematchText}>
            Matched to{' '}
            <strong>{enc.patient?.name || 'this patient'}</strong>.
          </span>
          <button
            type="button"
            className={styles.rematchBtn}
            onClick={() => setPicking(true)}
          >
            <Icon name="solar:refresh-square-linear" size={12} color="var(--primary-300)" />
            Change patient
          </button>
        </div>
      )}

      {/* Shared picker — opens from either the mismatch banner (Manually
          link) or the rematch row (Change patient). */}
      {picking && (
        <div className={styles.memberPicker}>
          <Input
            placeholder="Search Fold patients by name…"
            value={pickQuery}
            onChange={(e) => setPickQuery(e.target.value)}
            autoFocus
          />
          <div className={styles.memberPickerList}>
            {filteredMembers.map(m => {
              const isCurrent = m.id === enc.patient?.matchedMemberId;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={[styles.memberPickerItem, isCurrent ? styles.memberPickerItemActive : ''].filter(Boolean).join(' ')}
                  onClick={() => handleLinkMember(m)}
                >
                  <Avatar variant="patient" initials={m.in} />
                  <span>{m.name}</span>
                  <span className={styles.memberPickerMeta}>{m.memberId}</span>
                  {isCurrent && <span className={styles.memberPickerCurrent}>Current</span>}
                </button>
              );
            })}
          </div>
          {isMatched && (
            <button
              type="button"
              className={styles.memberPickerCancel}
              onClick={() => { setPicking(false); setPickQuery(''); }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      <div className={styles.encounterGrid}>
        <Field
          label="Patient Name"
          value={enc.patient?.name || ''}
          onChange={(v) => patchAndRevalidate({ patient: { ...enc.patient, name: v } })}
          error={errors.has('patientName')}
          required
        />
        <Field
          label="DOB"
          value={enc.patient?.dob || ''}
          onChange={(v) => patchAndRevalidate({ patient: { ...enc.patient, dob: v } })}
          error={errors.has('dob')}
          required
          placeholder="MM/DD/YYYY"
        />
        <Field
          label="DOS"
          value={enc.dos || ''}
          onChange={(v) => patchAndRevalidate({ dos: v })}
          error={errors.has('dos')}
          required
          placeholder="MM/DD/YYYY"
        />
        <Field
          label="Rendering Provider"
          value={enc.provider || ''}
          onChange={(v) => patchAndRevalidate({ provider: v })}
          error={errors.has('provider')}
          required
        />
        <Field
          label="POS"
          value={enc.pos || ''}
          onChange={(v) => patchAndRevalidate({ pos: v, posDesc: POS_LABEL[v] || '' })}
          error={errors.has('pos')}
          required
          placeholder="11, 12, 22, 02"
          hint={enc.posDesc || ''}
        />
        <Field
          label="Document Type"
          value={enc.docType || ''}
          onChange={(v) => onPatch({ docType: v })}
        />
      </div>

      <div className={styles.icdsSection}>
        <div className={styles.icdsLabel}>ICD Codes <span className={styles.icdsHint}>(V28-validated)</span></div>
        <div className={styles.icdsChipRow}>
          {(enc.icds || []).length === 0 ? (
            <span className={styles.icdsEmpty}>No ICDs extracted.</span>
          ) : enc.icds.map(icd => (
            <span
              key={icd.code}
              className={[styles.icdChip, icd.valid === false ? styles.icdChipInvalid : ''].filter(Boolean).join(' ')}
              title={icd.valid === false ? 'Not a V28 HCC code' : undefined}
            >
              {icd.code}
              <CloseButton
                size={12}
                onClick={() => removeIcd(icd.code)}
                className={styles.icdChipClose}
                label={`Remove ${icd.code}`}
              />
            </span>
          ))}
        </div>

        {/* Add ICD — typeahead over the catalog. Excludes codes already
            on this encounter so the user doesn't see false duplicates. */}
        <div className={styles.icdAddRow}>
          <IcdSearch
            placeholder="Add ICD — search by code or description (e.g. E11.9, COPD)…"
            excludeCodes={(enc.icds || []).map(i => i.code)}
            onSelect={(icd) => addIcd({ code: icd.code, desc: icd.title, hcc: icd.hcc || '' })}
          />
        </div>
      </div>

    </div>
  );
}

function Field({ label, value, onChange, error, required, placeholder, hint }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.fieldRequired}>*</span>}
      </span>
      <Input
        variant={error ? 'error' : 'default'}
        value={value || ''}
        placeholder={placeholder || ''}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <span className={styles.fieldErrorText}>
          <Icon name="solar:danger-triangle-bold" size={12} color="var(--status-error)" />
          Required field
        </span>
      )}
      {!error && hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

/**
 * PagePreviewModal — full-screen overlay showing a "scanned page" of the
 * uploaded document. Backed by a single dummy template (real OCR would
 * return PDF bytes or a page image URL). Page navigation via prev/next
 * + jump-to-page input. The dummy template renders the page number,
 * filename, and a sample chart-note-style body so the user gets a
 * believable visual.
 */
function PagePreviewModal({ page, maxPage, fileName, onChangePage, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft' && page > 1) onChangePage(page - 1);
      if (e.key === 'ArrowRight' && page < maxPage) onChangePage(page + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [page, maxPage, onChangePage, onClose]);

  return (
    <div className={styles.previewOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.previewShell} onClick={(e) => e.stopPropagation()}>
        <div className={styles.previewHeader}>
          <div className={styles.previewHeaderTitle}>
            <Icon name="solar:document-text-linear" size={16} color="var(--neutral-400)" />
            <span className={styles.previewHeaderName}>{fileName}</span>
            <span className={styles.previewHeaderPageOf}>Page {page} of {maxPage}</span>
          </div>
          <div className={styles.previewHeaderControls}>
            <button
              type="button"
              className={styles.previewNavBtn}
              disabled={page <= 1}
              onClick={() => onChangePage(page - 1)}
              aria-label="Previous page"
            >
              <Icon name="solar:alt-arrow-left-linear" size={14} color="var(--neutral-400)" />
            </button>
            <span className={styles.previewPageInput}>{page} / {maxPage}</span>
            <button
              type="button"
              className={styles.previewNavBtn}
              disabled={page >= maxPage}
              onClick={() => onChangePage(page + 1)}
              aria-label="Next page"
            >
              <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-400)" />
            </button>
            <span className={styles.headerDivider} />
            <CloseButton size={16} onClick={onClose} className={styles.previewCloseBtn} label="Close preview" />
          </div>
        </div>
        <div className={styles.previewBody}>
          <DummyPage page={page} fileName={fileName} />
        </div>
      </div>
    </div>
  );
}

/**
 * Single dummy page — looks like a scanned progress-note template. Deterministic
 * variation by page so each page reads as a distinct extract.
 */
function DummyPage({ page, fileName }) {
  // Deterministic per-page detail so prev/next reads as moving through a real PDF.
  const sample = DUMMY_PAGE_SAMPLES[(page - 1) % DUMMY_PAGE_SAMPLES.length];
  return (
    <div className={styles.dummyPage}>
      <div className={styles.dummyPageHeader}>
        <div>
          <div className={styles.dummyPageOrg}>Fold Health Medical Group</div>
          <div className={styles.dummyPageOrgSub}>123 Main Street · San Francisco, CA 94102 · (415) 555-0123</div>
        </div>
        <div className={styles.dummyPageHeaderRight}>
          <div>Document: {fileName}</div>
          <div>Page {page}</div>
        </div>
      </div>
      <h1 className={styles.dummyPageH1}>Progress Note</h1>
      <div className={styles.dummyPageMeta}>
        <div><strong>Patient:</strong> {sample.patient}</div>
        <div><strong>DOB:</strong> {sample.dob}</div>
        <div><strong>DOS:</strong> {sample.dos}</div>
        <div><strong>Provider:</strong> {sample.provider}</div>
      </div>
      <div className={styles.dummyPageSection}>
        <h2 className={styles.dummyPageH2}>Subjective</h2>
        <p>{sample.subjective}</p>
      </div>
      <div className={styles.dummyPageSection}>
        <h2 className={styles.dummyPageH2}>Objective</h2>
        <p>{sample.objective}</p>
      </div>
      <div className={styles.dummyPageSection}>
        <h2 className={styles.dummyPageH2}>Assessment &amp; Plan</h2>
        <p>{sample.assessment}</p>
        <ul className={styles.dummyPageIcdList}>
          {sample.icds.map(icd => (
            <li key={icd.code}><strong>{icd.code}</strong> — {icd.desc}</li>
          ))}
        </ul>
      </div>
      <div className={styles.dummyPageFooter}>
        Electronically signed · {sample.provider} · {sample.dos}
      </div>
    </div>
  );
}

const DUMMY_PAGE_SAMPLES = [
  {
    patient: 'William Jammy',
    dob: '01/15/1965',
    dos: '02/14/2026',
    provider: 'Dr. Sarah Connor, MD',
    subjective: 'Patient reports good adherence to current diabetes regimen. Denies polyuria, polydipsia, or hypoglycemic episodes. Continues to monitor BG twice daily; values trending 110-140 fasting.',
    objective: 'BP 132/84, HR 76, BMI 31.2. HbA1c 7.6 (last 6 mo: 8.1). LDL 88. eGFR 62. Foot exam normal, monofilament intact.',
    assessment: 'Type 2 DM with neuropathy — improving control. CHF stable on current regimen.',
    icds: [
      { code: 'E11.22', desc: 'T2DM with diabetic chronic kidney disease' },
      { code: 'I48.91', desc: 'Unspecified atrial fibrillation' },
    ],
  },
  {
    patient: 'William Jammy',
    dob: '01/15/1965',
    dos: '03/15/2026',
    provider: 'Dr. Sarah Connor, MD',
    subjective: 'Follow-up for CHF management. Patient reports increased fatigue and 3 lb weight gain over the past two weeks.',
    objective: 'BP 148/92, HR 88, weight up 3 lb. Mild bibasilar crackles. JVP 8 cm. Trace pretibial edema.',
    assessment: 'CHF with mild decompensation. Increase furosemide to 40mg BID. Recheck BMP in 1 week.',
    icds: [
      { code: 'I50.32', desc: 'Chronic diastolic (congestive) heart failure' },
    ],
  },
  {
    patient: 'Grace Hill',
    dob: '04/22/1954',
    dos: '02/18/2026',
    provider: 'Dr. Eamon, MD',
    subjective: 'Patient reports persistent low mood and anhedonia. PHQ-9 = 14. Denies SI. Currently on sertraline 100 mg daily.',
    objective: 'Affect blunted but appropriate. Speech normal. No psychomotor agitation. Cognition intact.',
    assessment: 'Major depressive disorder, recurrent, moderate. CKD stage 3b stable. Continue current regimen and re-screen at next visit.',
    icds: [
      { code: 'F33.1', desc: 'Major depressive disorder, recurrent, moderate' },
      { code: 'N18.4', desc: 'CKD stage 4' },
    ],
  },
  {
    patient: 'Annette Brave',
    dob: '08/12/1958',
    dos: '02/20/2026',
    provider: 'Dr. Mallory Hayes, MD',
    subjective: 'Routine follow-up. Patient reports good energy. Diabetes well controlled with metformin alone.',
    objective: 'BP 124/78. HbA1c 6.8. BMI 27.4. Foot exam normal.',
    assessment: 'T2DM well controlled. Continue current regimen.',
    icds: [
      { code: 'E11.42', desc: 'T2DM with diabetic polyneuropathy' },
    ],
  },
  {
    patient: 'Frank Green',
    dob: '06/30/1956',
    dos: '02/22/2026',
    provider: 'Dr. Indigo I, MD',
    subjective: 'Telehealth follow-up. Patient reports stable cardiac symptoms, no chest pain or PND.',
    objective: 'Self-reported BP 138/86, weight stable. Reports good adherence.',
    assessment: 'CHF and DM stable. No medication changes today.',
    icds: [
      { code: 'I50.21', desc: 'Acute systolic heart failure' },
      { code: 'E11.9', desc: 'T2DM without complications' },
    ],
  },
];
