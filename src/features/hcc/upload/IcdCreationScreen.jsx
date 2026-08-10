import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { Badge } from '../../../components/Badge/Badge';
import { Dropzone } from '../../../components/Dropzone/Dropzone';
import { DemoPhiStrip } from '../../../components/DemoPhiStrip/DemoPhiStrip';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { POS_LABEL } from './mockOcr';
import { Avatar } from '../../../components/Avatar/Avatar';
import { OCR_TIER_LABEL, OCR_TIER_TONE } from '../compliance';
import { HccSftpReviewDrawer } from './HccSftpReviewDrawer';
import styles from './IcdCreationScreen.module.css';

/**
 * ICD Creation — unified entry point for adding HCC records.
 *
 * Replaces the legacy 3-item popover (New Record Manually / Extract from
 * Document / Open SFTP Server) with a single screen that handles all
 * three flows in one surface:
 *
 *   Left  — Upload & Review Document (dropzone + "Sync via SFTP" trigger)
 *   Right — Session records list (extracted encounters waiting for confirm)
 *           with an "Add Manually" CTA when empty.
 *
 * Dropped files run through queueHccDocumentForOcr (the same pipeline as
 * SFTP ingest), so OCR tier + 5-point compliance are evaluated identically
 * regardless of how the doc entered the system.
 *
 * Wired from the HCC worklist's Upload Document toolbar button.
 */

// Demo files mapped to mockOcr's deterministic outputs — clicking one
// stages it in the queue exactly as if the user had dropped the real PDF.
// Each entry shows the OCR tier the file will land in so users can pick
// the scenario they want to walk through.
// Each sample maps to a DISTINCT patient so selecting several produces
// several unique patients to page through in review. Pick a few, then
// Start Extraction to see them categorized by OCR tier.
const SAMPLE_FILES = [
  { name: 'demo-same-patient-multi-dos.pdf', tier: 'clean',      label: 'William Jammy · 3 DOS' },
  { name: 'demo-grace-hill.pdf',             tier: 'clean',      label: 'Grace Hill · 2 DOS' },
  { name: 'demo-frank-green.pdf',            tier: 'clean',      label: 'Frank Green · 1 DOS' },
  { name: 'demo-brian-carter.pdf',           tier: 'clean',      label: 'Brian Carter · 1 DOS' },
  { name: 'demo-degraded-david-evans.pdf',   tier: 'degraded',   label: 'David Evans (Degraded)' },
  { name: 'demo-unreadable-fax.pdf',         tier: 'unreadable', label: 'Fax / failed OCR (Unreadable)' },
];

const ACCEPT_EXT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
const ACCEPT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

export function IcdCreationScreen() {
  const open = useAppStore(s => s.icdCreationOpen);
  const close = useAppStore(s => s.closeIcdCreation);
  const queueOcr = useAppStore(s => s.queueHccDocumentForOcr);
  const simulateSftp = useAppStore(s => s.simulateSftpIngest);
  const trackBatch = useAppStore(s => s.trackIcdCreationBatch);
  const showToast = useAppStore(s => s.showToast);
  const batches = useAppStore(s => s.hccSftpBatches) || [];
  const sessionIds = useAppStore(s => s.icdCreationSessionBatchIds) || [];
  const createFromEncounter = useAppStore(s => s.hccCreateOrMergeFromEncounter);
  // Reuse the existing manual-entry workflow inside UploadDocumentDrawer
  // (phase: 'single') so we don't have two competing manual forms.
  const startHccUpload    = useAppStore(s => s.startHccUpload);
  const setHccUploadPhase = useAppStore(s => s.setHccUploadPhase);

  const openExistingManualEntry = () => {
    // Close the ICD Creation surface and hand off to the canonical manual
    // entry workflow (UploadDocumentDrawer, phase: 'single'). When the
    // user finishes there, the added records show up next time they open
    // ICD Creation — no duplicated form to maintain here.
    close?.();
    startHccUpload?.(null);
    setHccUploadPhase?.('single');
  };

  // Review renders INLINE inside this surface (same drawer, no second
  // overlay) in AGGREGATE mode across every document in this session, so
  // the reviewer pages patient-by-patient across all uploaded docs (the
  // clicked doc is focused first).
  const openHccReviewInline = useAppStore(s => s.openHccReviewInline);
  const closeHccReviewInline = useAppStore(s => s.closeHccReviewInline);
  const reviewInline = useAppStore(s => s.hccReviewInline);
  const openExistingReview = (batchId) => {
    const ids = sessionBatches.map(b => b.id);
    openHccReviewInline?.(ids.length ? ids : [batchId], batchId);
  };
  const [whatNextOpen, setWhatNextOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // Staged-files queue — files are added here by the dropzone but OCR
  // doesn't run until Start Extraction. Each entry:
  //   { id, file, status: 'complete'|'extracting'|'done' }
  // 'complete' = upload finished, ready for extraction (per Figma 1:18181).
  const [queue, setQueue] = useState([]);
  const [extracting, setExtracting] = useState(false);

  if (!open) return null;

  // Encounters extracted in this session — the right panel's records list.
  // We pull them from the batches the store knows about, then filter to
  // only the ones added during this Upload Document session.
  const sessionBatches = batches.filter(b => sessionIds.includes(b.id));
  const sessionEncounters = sessionBatches.flatMap(b =>
    (b.encounters || []).map(e => ({ ...e, _batchId: b.id, _fileName: b.fileName, _ocrTier: b.ocrTier }))
  );

  // Once batches land in this session, the screen transforms from "upload
  // phase" to "results phase" — dropzone → categorized file list, single
  // records list → tabbed Pending/Added/Deleted (Figma 1:18602).
  const inResults = sessionBatches.length > 0;

  const handleDrop = (file) => {
    if (!file) return;
    // Stage the file — DON'T kick off OCR until the user clicks
    // Start Extraction. Matches Figma 1:18181: uploaded files appear
    // in a queue below the dropzone with eye/trash actions; OCR is a
    // separate explicit step.
    setQueue(prev => [...prev, {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      status: 'complete',
    }]);
  };

  const handleRemoveQueued = (id) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const handleStartExtraction = async () => {
    if (queue.length === 0 || extracting) return;
    setExtracting(true);
    setQueue(prev => prev.map(q => ({ ...q, status: 'extracting' })));
    // Run extraction on each queued file in parallel via the existing
    // pipeline. queueOcr returns the created batch id, so tracking is
    // race-free even though the calls resolve concurrently.
    await Promise.all(queue.map(async (q) => {
      const id = await queueOcr?.(q.file, { autoApply: false });
      if (id) trackBatch?.(id);
    }));
    setExtracting(false);
    setQueue([]); // queue clears once results land in the right panel
  };

  const handleDiscardQueue = () => setQueue([]);

  const handleSftpSync = async () => {
    setSyncing(true);
    const before = useAppStore.getState().hccSftpBatches || [];
    const beforeIds = new Set(before.map(b => b.id));
    await simulateSftp?.();
    const after = useAppStore.getState().hccSftpBatches || [];
    after.forEach(b => { if (!beforeIds.has(b.id)) trackBatch?.(b.id); });
    setSyncing(false);
  };

  const handleAddToWorklist = (enc) => {
    const r = createFromEncounter?.({ ...enc, _docName: enc._fileName });
    if (r?.kind === 'created' || r?.kind === 'updated') {
      showToast?.(`Added to worklist: ${enc.patient?.name || 'encounter'}`);
    }
  };

  return createPortal(
    <>
      <div className={styles.overlay} onClick={close} />
      <div className={styles.panel} role="dialog" aria-label="ICD Creation" aria-modal="true">
        {/* Title bar */}
        <header className={styles.titleBar}>
          <h2 className={styles.title}>ICD Creation</h2>
          <CloseButton size={20} onClick={close} className={styles.closeBtn} />
        </header>

        {reviewInline ? (
          /* Inline Document Review — renders in THIS surface instead of a
             second drawer (Figma 4001:179835). Back arrow returns to the
             categorized document list. */
          <div className={styles.reviewInlineHost}>
            <HccSftpReviewDrawer inline onExit={closeHccReviewInline} />
          </div>
        ) : (
        <div className={styles.body}>
          {/* ── Left: Upload & Review Document ───────────────────────── */}
          <section className={styles.leftCol}>
            <div className={styles.colHeader}>
              <h3 className={styles.colTitle}>Upload &amp; Review Document</h3>
              <Button
                variant="alt"
                size="S"
                leadingIcon="solar:refresh-linear"
                disabled={syncing}
                onClick={handleSftpSync}
              >
                {syncing ? 'Syncing…' : 'Sync via SFTP'}
              </Button>
            </div>

            {inResults ? (
              <CategorizedFileList batches={sessionBatches} onReview={openExistingReview} />
            ) : (
              <UploadPhase
                queue={queue}
                extracting={extracting}
                onRemoveQueued={handleRemoveQueued}
                onStart={handleStartExtraction}
                onDiscard={handleDiscardQueue}
                whatNextOpen={whatNextOpen}
                toggleWhatNext={() => setWhatNextOpen(v => !v)}
                onPick={handleDrop}
                onReject={(rejected) => showToast?.(`${rejected[0]?.name}: unsupported format`)}
              />
            )}
          </section>

          {/* ── Right: Session records ──────────────────────────────── */}
          <RightColumn
            inResults={inResults}
            sessionEncounters={sessionEncounters}
            onAdd={handleAddToWorklist}
            onAddManually={openExistingManualEntry}
          />
        </div>
        )}
      </div>
    </>,
    document.body,
  );
}

// ─── UploadPhase — initial dropzone + queue ─────────────────────────────

function UploadPhase({ queue, extracting, onRemoveQueued, onStart, onDiscard, whatNextOpen, toggleWhatNext, onPick, onReject }) {
  // Stage a sample as a synthetic File. mockOcr matches on filename so
  // the deterministic encounter set + tier come back exactly as expected.
  const pickSample = (s) => {
    const synthetic = new File([new Blob(['demo'], { type: 'application/pdf' })], s.name, { type: 'application/pdf' });
    Object.defineProperty(synthetic, 'size', { value: 2_500_000 });
    onPick(synthetic);
  };

  return (
    <>
      <DemoPhiStrip />
      <Dropzone
        accept={ACCEPT_EXT}
        acceptMime={ACCEPT_MIME}
        icon="solar:upload-minimalistic-linear"
        iconSize={28}
        onPick={onPick}
        onReject={onReject}
        helperText="Supported formats: PDF, DOC, JPG, or PNG"
        secondaryText="Max size: 100 MB"
      />

      {!extracting && (
        <div className={styles.samples}>
          <div className={styles.samplesHeader}>
            <Icon name="solar:gallery-linear" size={12} color="var(--neutral-300)" />
            <span>Try a sample document — pick several to see categorization</span>
          </div>
          <div className={styles.samplesList}>
            {SAMPLE_FILES.map(s => (
              <button
                key={s.name}
                type="button"
                className={styles.sampleChip}
                onClick={() => pickSample(s)}
                title={s.label}
              >
                <Icon name="solar:document-text-linear" size={12} color="var(--primary-300)" />
                <span>{s.label}</span>
                <span className={[styles.sampleTier, styles[`tier_${s.tier}`]].join(' ')}>
                  {s.tier}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {queue.length > 0 && (
        <ul className={styles.queueList}>
          {queue.map((q) => (
            <li key={q.id} className={styles.queueRow}>
              <Icon name="solar:document-text-linear" size={20} color="var(--primary-300)" />
              <div className={styles.queueMeta}>
                <div className={styles.queueName}>{q.file?.name || 'Document'}</div>
                <div className={styles.queueSub}>
                  {formatBytes(q.file?.size)} / 100 MB
                  <span className={styles.queueStatus}>
                    {q.status === 'extracting' ? (
                      <>
                        <span className={styles.dotProcessing} />
                        <span>Extracting…</span>
                      </>
                    ) : (
                      <>
                        <Icon name="solar:check-circle-bold" size={12} color="var(--status-success)" />
                        <span>Complete</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className={styles.queueActions}>
                <button type="button" className={styles.queueIconBtn} title="Preview" disabled={extracting}>
                  <Icon name="solar:eye-linear" size={16} color="var(--neutral-400)" />
                </button>
                <button
                  type="button"
                  className={styles.queueIconBtn}
                  title="Remove"
                  onClick={() => onRemoveQueued(q.id)}
                  disabled={extracting}
                >
                  <Icon name="solar:trash-bin-trash-linear" size={16} color="var(--neutral-400)" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {queue.length > 0 && (
        <div className={styles.queueFooter}>
          <Button
            variant="primary"
            size="M"
            leadingIcon="solar:magic-stick-3-linear"
            disabled={extracting}
            onClick={onStart}
          >
            {extracting ? 'Extracting…' : 'Start Extraction'}
          </Button>
          <Button variant="secondary" size="M" disabled={extracting} onClick={onDiscard}>
            Discard
          </Button>
        </div>
      )}

      <button
        type="button"
        className={styles.whatNext}
        onClick={toggleWhatNext}
        aria-expanded={whatNextOpen}
      >
        <Icon name="solar:lightbulb-bolt-linear" size={14} color="var(--primary-300)" />
        <span>What happens next?</span>
        <Icon
          name={whatNextOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-right-linear'}
          size={12}
          color="var(--neutral-300)"
        />
      </button>
      {whatNextOpen && (
        <ol className={styles.whatNextList}>
          <li>AI runs OCR + the 5-point compliance check on the document.</li>
          <li>Pages flagged as Unreadable route to Support for re-scan.</li>
          <li>Extracted records show on the right — confirm each one to add it to the worklist.</li>
        </ol>
      )}
    </>
  );
}

// ─── CategorizedFileList — post-extraction grouping by OCR tier ─────────

function CategorizedFileList({ batches, onReview }) {
  const groups = [
    { tier: 'clean',      label: 'Clean Documents',      docs: batches.filter(b => b.ocrTier === 'clean') },
    { tier: 'degraded',   label: 'Degraded Documents',   docs: batches.filter(b => b.ocrTier === 'degraded') },
    { tier: 'unreadable', label: 'Unreadable Documents', docs: batches.filter(b => b.ocrTier === 'unreadable') },
  ];

  return (
    <div className={styles.tierList}>
      {groups.map((g) => g.docs.length > 0 && (
        <TierSection key={g.tier} tier={g.tier} label={g.label} docs={g.docs} onReview={onReview} />
      ))}
    </div>
  );
}

function TierSection({ tier, label, docs, onReview }) {
  const [open, setOpen] = useState(true);
  const iconName = tier === 'clean'
    ? 'solar:check-circle-bold'
    : tier === 'degraded'
      ? 'solar:danger-circle-bold'
      : 'solar:close-circle-bold';
  const iconColor = tier === 'clean'
    ? 'var(--status-success)'
    : tier === 'degraded'
      ? 'var(--status-warning)'
      : 'var(--status-error)';

  return (
    <div className={styles.tierSection}>
      <button
        type="button"
        className={styles.tierHeader}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <Icon name={iconName} size={14} color={iconColor} />
        <span className={styles.tierLabel}>{label}</span>
        <span className={styles.tierCount}>({docs.length})</span>
        <Icon
          name={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
          size={12}
          color="var(--neutral-300)"
        />
      </button>
      {open && (
        <ul className={styles.tierDocList}>
          {docs.map(d => (
            <TierDocRow key={d.id} doc={d} tier={tier} onReview={onReview} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TierDocRow({ doc, tier, onReview }) {
  // Pass count = records (encounters) that came out clean — matched
  // member + no missing fields + no ID mismatch. Drives the inline
  // "✓ Pass · X/Y" badge per the design reference.
  const encounters = doc.encounters || [];
  const total = encounters.length;
  const passCount = encounters.filter(e =>
    !!e.patient?.matchedMemberId
    && (!Array.isArray(e.errors) || e.errors.length === 0)
    && !e.patient?.idMismatch
  ).length;
  const dateLabel = new Date(doc.ingestedAt || Date.now()).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const passTone = tier === 'unreadable'
    ? 'fail'
    : (passCount === total && total > 0 ? 'success' : 'partial');

  return (
    <li className={styles.tierDocRow}>
      <Icon name="solar:document-text-linear" size={20} color="var(--primary-300)" />
      <div className={styles.tierDocMeta}>
        <div className={styles.tierDocNameRow}>
          <span className={styles.tierDocName}>{doc.fileName}</span>
          {/* Inline check-count badge — sits directly next to the file
              name (✓ Pass · 12/12). Clicking it opens the document review
              (same target as the Review button). */}
          {total > 0 && (
            <button
              type="button"
              className={[styles.passPill, styles[`passPill_${passTone}`], tier !== 'unreadable' ? styles.passPillClickable : ''].filter(Boolean).join(' ')}
              onClick={tier !== 'unreadable' ? () => onReview(doc.id) : undefined}
              title={tier !== 'unreadable' ? 'Open document review' : undefined}
            >
              <Icon
                name={passTone === 'success' ? 'solar:check-circle-bold' : passTone === 'fail' ? 'solar:close-circle-bold' : 'solar:danger-circle-bold'}
                size={11}
                color="currentColor"
              />
              <span>Pass</span>
              <span className={styles.passPillDivider} />
              <span>{passCount}/{total}</span>
            </button>
          )}
        </div>
        <div className={styles.tierDocSub}>
          {dateLabel} · {total} Records Extracted
        </div>
      </div>
      {tier === 'unreadable' ? (
        <Button variant="secondary" size="S" leadingIcon="solar:refresh-linear">
          Retry
        </Button>
      ) : (
        <Button
          variant="primary"
          size="S"
          leadingIcon="solar:magic-stick-3-linear"
          onClick={() => onReview(doc.id)}
        >
          Review
        </Button>
      )}
      <button type="button" className={styles.queueIconBtn} title="More">
        <Icon name="solar:menu-dots-linear" size={16} color="var(--neutral-400)" />
      </button>
    </li>
  );
}

// ─── RightColumn — empty / records / manual / tabbed (results mode) ─────

function RightColumn({ inResults, sessionEncounters, onAdd, onAddManually }) {
  if (inResults) {
    return (
      <section className={styles.rightCol}>
        <TabbedRecords encounters={sessionEncounters} onAdd={onAdd} onAddManually={onAddManually} />
      </section>
    );
  }
  return (
    <section className={styles.rightCol}>
      {sessionEncounters.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Icon name="solar:clipboard-text-linear" size={32} color="var(--neutral-200)" />
          </div>
          <div className={styles.emptyTitle}>No Records Added Yet</div>
          <div className={styles.emptyMsg}>
            Records that have been successfully added to the worklist will appear here.
          </div>
          <Button variant="primary" size="M" leadingIcon="solar:pen-linear" onClick={onAddManually}>
            Add Manually
          </Button>
        </div>
      ) : (
        <RecordsList encounters={sessionEncounters} onAdd={onAdd} onAddManually={onAddManually} />
      )}
    </section>
  );
}

// ─── TabbedRecords — Pending Review / Added / Deleted (results mode) ─────

function TabbedRecords({ encounters, onAdd, onAddManually }) {
  const [tab, setTab] = useState('pending');

  const bucket = (s) => encounters.filter(e => (e._docStatus || 'pending') === s);
  const pendingEncs = bucket('pending');
  const addedEncs   = bucket('added');
  const deletedEncs = bucket('deleted');

  const isReady = (enc) => !!enc.patient?.matchedMemberId
    && (!Array.isArray(enc.errors) || enc.errors.length === 0)
    && !enc.patient?.idMismatch;
  const readyEncs = pendingEncs.filter(isReady);
  const needsReviewEncs = pendingEncs.filter(e => !isReady(e));

  return (
    <div className={styles.tabbedWrap}>
      <div className={styles.tabBar}>
        <button
          type="button"
          className={[styles.tab, tab === 'pending' ? styles.tabActive : ''].join(' ')}
          onClick={() => setTab('pending')}
        >
          Pending Review<span className={styles.tabCount}>({pendingEncs.length})</span>
        </button>
        <button
          type="button"
          className={[styles.tab, tab === 'added' ? styles.tabActive : ''].join(' ')}
          onClick={() => setTab('added')}
        >
          Added to Worklist<span className={styles.tabCount}>({addedEncs.length})</span>
        </button>
        <button
          type="button"
          className={[styles.tab, tab === 'deleted' ? styles.tabActive : ''].join(' ')}
          onClick={() => setTab('deleted')}
        >
          Deleted<span className={styles.tabCount}>({deletedEncs.length})</span>
        </button>
        <span className={styles.tabSpacer} />
        <Button variant="secondary" size="S" leadingIcon="solar:pen-linear" onClick={onAddManually}>
          Add New Record
        </Button>
      </div>

      <div className={styles.tabBody}>
        {tab === 'pending' && (
          <>
            {readyEncs.length > 0 && (
              <RecordsSection
                title="Ready Records"
                encs={readyEncs}
                onAdd={onAdd}
                showAddAll
                onAddAll={() => readyEncs.forEach(onAdd)}
              />
            )}
            {needsReviewEncs.length > 0 && (
              <RecordsSection
                title="Needs Review"
                encs={needsReviewEncs}
                onAdd={onAdd}
                needsReview
              />
            )}
            {pendingEncs.length === 0 && <EmptyTabState message="Nothing pending review." />}
          </>
        )}
        {tab === 'added'   && (addedEncs.length === 0
          ? <EmptyTabState message="No records added to the worklist yet." />
          : <RecordsSection title="Added to Worklist" encs={addedEncs} readOnly />
        )}
        {tab === 'deleted' && (deletedEncs.length === 0
          ? <EmptyTabState message="No deleted records." />
          : <RecordsSection title="Deleted" encs={deletedEncs} readOnly />
        )}
      </div>
    </div>
  );
}

function EmptyTabState({ message }) {
  return <div className={styles.tabEmpty}>{message}</div>;
}

function RecordsSection({ title, encs, onAdd, showAddAll, onAddAll, needsReview, readOnly }) {
  return (
    <div className={styles.section}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>{title}</div>
        {showAddAll && (
          <button type="button" className={styles.linkBtn} onClick={onAddAll}>
            + Add All to Worklist
          </button>
        )}
      </header>
      <ul className={styles.sectionList}>
        {encs.map((enc) => (
          <ReviewRow key={enc.tempId} enc={enc} onAdd={onAdd} needsReview={needsReview} readOnly={readOnly} />
        ))}
      </ul>
    </div>
  );
}

function ReviewRow({ enc, onAdd, needsReview, readOnly }) {
  const initials = (enc.patient?.name || '').split(/\s+/).flatMap(w => w[0] ? [w[0]] : []).slice(0, 2).join('').toUpperCase() || '??';
  const confidence = enc.patient?.matchConfidence || 0;
  const issueLabel = enc.patient?.idMismatch
    ? 'ID Mismatch'
    : (enc.errors?.length ? 'Missing Field' : null);

  return (
    <li className={[styles.reviewRow, needsReview ? styles.reviewRowNeeds : ''].filter(Boolean).join(' ')}>
      <div className={styles.reviewRowMain}>
        <Avatar variant="assignee" initials={initials} />
        <div className={styles.reviewRowName}>
          <div>{enc.patient?.name || 'Unknown patient'}</div>
          <div className={styles.reviewRowSub}>
            {enc.patient?.dob ? `DOB ${enc.patient.dob}` : ''} {enc.patient?.matchedMemberDisplayId ? `· ${enc.patient.matchedMemberDisplayId}` : ''}
          </div>
        </div>
        {issueLabel && (
          <span className={styles.reviewIssueBadge}>
            <Icon name="solar:danger-triangle-linear" size={11} color="var(--status-warning)" />
            {issueLabel}
          </span>
        )}
        {!needsReview && !readOnly && (
          <span className={styles.reviewReadyBadge}>
            <Icon name="solar:check-circle-bold" size={11} color="var(--status-success)" />
            <span>Ready</span>
            <span className={styles.reviewConfidence}>{confidence}%</span>
          </span>
        )}
        {!readOnly && (
          <button
            type="button"
            className={styles.reviewAddBtn}
            onClick={() => onAdd(enc)}
            disabled={needsReview}
            title={needsReview ? 'Resolve issues before adding' : 'Add to worklist'}
          >
            + Add
          </button>
        )}
      </div>
    </li>
  );
}

// ─── Right column: records list ────────────────────────────────────────

function RecordsList({ encounters, onAdd, onAddManually }) {
  return (
    <div className={styles.recordsWrap}>
      <header className={styles.recordsHeader}>
        <div>
          <div className={styles.recordsTitle}>Records</div>
          <div className={styles.recordsSubtitle}>{encounters.length} extracted</div>
        </div>
        <Button variant="secondary" size="S" leadingIcon="solar:pen-linear" onClick={onAddManually}>
          Add Manually
        </Button>
      </header>
      <ul className={styles.recordsList}>
        {encounters.map((enc) => (
          <li key={enc.tempId || `${enc.patient?.name}-${enc.dos}`} className={styles.recordCard}>
            <div className={styles.recordMain}>
              <div className={styles.recordTitleRow}>
                <div className={styles.recordName}>{enc.patient?.name || 'Unknown patient'}</div>
                {enc._ocrTier && (
                  <Badge size="M"
                    variant={enc._ocrTier === 'clean' ? 'success' : enc._ocrTier === 'degraded' ? 'warning' : 'error'}
                    label={`OCR · ${enc._ocrTier[0].toUpperCase()}${enc._ocrTier.slice(1)}`}
                  />
                )}
              </div>
              <div className={styles.recordMeta}>
                <span><strong>DOS</strong> {enc.dos || '—'}</span>
                <span><strong>Provider</strong> {enc.provider || '—'}</span>
                <span><strong>POS</strong> {enc.pos ? `${enc.pos} · ${POS_LABEL[enc.pos] || ''}` : '—'}</span>
              </div>
              <div className={styles.recordIcds}>
                {(enc.icds || []).map((c, i) => (
                  <span key={i} className={c.valid ? styles.icdChip : styles.icdChipInvalid}>{c.code}</span>
                ))}
              </div>
            </div>
            <div className={styles.recordActions}>
              <Button variant="primary" size="S" onClick={() => onAdd(enc)}>
                Add to Worklist
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)}${units[i]}`;
}
