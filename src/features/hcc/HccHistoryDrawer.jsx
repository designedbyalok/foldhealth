import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Icon } from '../../components/Icon/Icon';
import { Tabs } from '../../components/Tabs/Tabs';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { useAppStore } from '../../store/useAppStore';
import { EVENTS } from './activityLog';
// Reuse the shared HistoryTimeline primitive so every visual (rail /
// icon bubble / transition pills / file card / avatar swap) renders
// identically to the per-encounter timeline shown in the DiagPanel,
// per spec §2 we want one timeline component, four views.
import {
  HistoryTimelineEntry,
  statusIconConfig,
  historyTimelineStyles as htStyles,
} from '../../components/HistoryTimeline/HistoryTimeline';
import { timelineStatusIcon } from './StatusIcon';
import styles from './DiagPanel/LeftWorkspace.module.css';
import hccStyles from './HccHistoryDrawer.module.css';

// ── Per-event icon + tone treatment ──────────────────────────────────
// Maps an event_name to the visual params used by HistoryTimelineEntry's
// icon bubble (background + border + icon color). Falls back to
// severity-driven tones when an event isn't listed.
const EVENT_ICON = {
  // Intake
  'file.uploaded':                  { icon: 'solar:upload-minimalistic-linear', tone: 'neutral' },
  'sftp.file.detected':             { icon: 'solar:upload-square-linear',       tone: 'info'    },
  'batch.created':                  { icon: 'solar:layers-linear',              tone: 'info'    },
  'batch.processing_started':       { icon: 'solar:layers-linear',              tone: 'info'    },
  'batch.processing_completed':     { icon: 'solar:check-read-linear',          tone: 'success' },
  'batch.processing_partial_failure':{icon: 'solar:danger-circle-linear',       tone: 'warning' },
  'file.rejected.non_pdf':          { icon: 'solar:close-circle-linear',        tone: 'warning' },
  'file.rejected.invalid_filename': { icon: 'solar:close-circle-linear',        tone: 'warning' },
  // OCR
  'ocr.started':                    { icon: 'solar:scanner-linear',             tone: 'neutral' },
  'ocr.completed':                  { icon: 'solar:scanner-linear',             tone: 'success' },
  'ocr.failed':                     { icon: 'solar:close-circle-linear',        tone: 'error'   },
  'ocr.low_confidence':             { icon: 'solar:danger-circle-linear',       tone: 'warning' },
  // Matching
  'patient.matched':                { icon: 'solar:check-read-linear',          tone: 'success' },
  'patient.match_failed':           { icon: 'solar:danger-circle-linear',       tone: 'warning' },
  'patient.match_manual':           { icon: 'solar:user-plus-rounded-linear',   tone: 'info'    },
  'patient.identity_changed':       { icon: 'solar:users-group-rounded-linear', tone: 'warning' },
  // Review
  'encounter.approved':             { icon: 'solar:check-read-linear',          tone: 'success' },
  'encounter.rejected':             { icon: 'solar:close-circle-linear',        tone: 'error'   },
  'encounter.field_corrected':      { icon: 'solar:refresh-square-linear',      tone: 'warning' },
  'encounter.restored':             { icon: 'solar:undo-left-round-linear',     tone: 'info'    },
  'encounter.removed':              { icon: 'solar:trash-bin-trash-linear',     tone: 'error'   },
  // Worklist
  'worklist.row_created':           { icon: 'solar:add-circle-linear',          tone: 'success' },
  'worklist.row_merged':            { icon: 'solar:layers-linear',              tone: 'info'    },
  'assignee.changed':               { icon: 'solar:user-plus-rounded-linear',   tone: 'neutral' },
  'role.status_changed':            { icon: 'solar:eye-scan-linear',            tone: 'warning' },
  // ICD ops
  'icd.accepted':                   { icon: 'solar:check-read-linear',          tone: 'success' },
  'icd.dismissed':                  { icon: 'solar:close-circle-linear',        tone: 'error'   },
  'icd.created_manual':             { icon: 'solar:add-circle-linear',          tone: 'warning' },
  'icd.deleted':                    { icon: 'solar:trash-bin-trash-linear',     tone: 'error'   },
  'icd.overridden':                 { icon: 'solar:refresh-square-linear',      tone: 'warning' },
  'icd.merged':                     { icon: 'solar:layers-linear',              tone: 'info'    },
  'icd.status_changed':             { icon: 'solar:eye-scan-linear',            tone: 'warning' },
  'icd.comment_added':              { icon: 'solar:chat-round-linear',          tone: 'neutral' },
  'document.uploaded_for_icd':      { icon: 'solar:upload-minimalistic-linear', tone: 'neutral' },
  // Dedup
  'dedup.dos_match_found':          { icon: 'solar:layers-linear',              tone: 'info'    },
  'dedup.icd_net_new_merged':       { icon: 'solar:layers-linear',              tone: 'success' },
  'dedup.related_dos_created':      { icon: 'solar:add-circle-linear',          tone: 'info'    },
  'dedup.duplicate_detected':       { icon: 'solar:close-circle-linear',        tone: 'warning' },
  // Claim / ASM
  'claim.attached':                 { icon: 'solar:dollar-linear',              tone: 'info'    },
  'claim.matched':                  { icon: 'solar:check-read-linear',          tone: 'success' },
  'claim.not_found':                { icon: 'solar:danger-circle-linear',       tone: 'warning' },
  'asm.reevaluated':                { icon: 'solar:refresh-square-linear',      tone: 'info'    },
  'asm.file_generated':             { icon: 'solar:check-read-linear',          tone: 'success' },
  'asm.delete_entry_created':       { icon: 'solar:trash-bin-trash-linear',     tone: 'warning' },
  // Audit
  'patient.dos_changed':            { icon: 'solar:calendar-linear',            tone: 'warning' },
  'patient.field_edited':           { icon: 'solar:settings-linear',            tone: 'warning' },
};

// Visual params for the icon bubble, mirrors the shared ACT_ICON table
// so the bubble looks identical across every timeline view.
const TONE = {
  success: { bg: 'var(--status-success-light)', color: 'var(--status-success)', border: 'rgba(0,155,83,0.2)' },
  error:   { bg: 'var(--status-error-light)',   color: 'var(--status-error)',   border: 'rgba(215,40,37,0.2)' },
  warning: { bg: 'var(--status-warning-light)', color: 'var(--status-warning)', border: 'rgba(217,165,11,0.2)' },
  info:    { bg: 'var(--status-info-light)',    color: 'var(--status-info)',    border: 'rgba(20,94,204,0.2)' },
  neutral: { bg: 'var(--neutral-0)',            color: 'var(--neutral-300)',    border: 'var(--neutral-150)' },
};

// Two-letter initials from "First Last" / "F. Last".
const initialsOf = (name = '') =>
  String(name).split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase();

function formatTs(iso) {
  if (!iso) return { date: '', time: '', monthLabel: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '', monthLabel: '' };
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
  const hours = d.getHours();
  const time = `${((hours + 11) % 12) + 1}:${pad(d.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
  const monthLabel = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  return { date, time, monthLabel };
}

const DATE_PRESETS = ['Today', 'Last 7 days', 'Last 30 days', 'This month'];

// Compute filter dropdown options from the loaded feed so chips only show
// values that actually exist. Patient / Recorded By / DOS get deduped &
// sorted; Category & Date come from static lists.
function buildFilterOptions(feed) {
  const dos = new Set();
  const patient = new Set();
  const by = new Set();
  const category = new Set();
  feed.forEach(r => {
    if (r.dos) dos.add(r.dos);
    if (r.payload?.patientName) patient.add(r.payload.patientName);
    if (r.actor_name) by.add(r.actor_name);
    if (r.category) category.add(r.category);
  });
  const cmp = (a, b) => a.localeCompare(b);
  return {
    dos:      [...dos].sort(cmp),
    patient:  [...patient].sort(cmp),
    by:       [...by].sort(cmp),
    category: [...category].sort(cmp),
    date:     DATE_PRESETS,
  };
}

function parseUiDate(str) {
  const m = String(str || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[1] - 1, +m[2]);
}

function matchesDatePreset(d, preset) {
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const today = startOfDay(now);
  const that = startOfDay(d);
  if (preset === 'Today') return that.getTime() === today.getTime();
  if (preset === 'Last 7 days')  return today - that >= 0 && today - that <= 7  * 86400000;
  if (preset === 'Last 30 days') return today - that >= 0 && today - that <= 30 * 86400000;
  if (preset === 'This month')   return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return true;
}

// Multi-select filters: every chip carries a string[] of selected values.
// Empty array means "no filter"; any non-empty array matches ANY of its
// values (OR within a chip, AND across chips).
function rowMatchesFilters(row, filters) {
  if (filters.dos?.length      && !filters.dos.includes(row.dos)) return false;
  if (filters.patient?.length  && !filters.patient.includes(row.payload?.patientName || null)) return false;
  if (filters.by?.length       && !filters.by.includes(row.actor_name)) return false;
  if (filters.category?.length && !filters.category.includes(row.category)) return false;
  if (filters.date?.length) {
    const { date } = formatTs(row.ts);
    const d = parseUiDate(date);
    if (!d || !filters.date.some(preset => matchesDatePreset(d, preset))) return false;
  }
  return true;
}

// ── Entry renderer ──────────────────────────────────────────────────
// Mirrors LeftWorkspace.ActivityEntry but reads from the row schema in
// activityLog.js (event_name + payload) rather than the legacy `t`-based
// entry shape used by DiagPanel. Delegates the visual scaffolding to the
// shared HistoryTimelineEntry primitive.
function HistoryEntry({ row, isFirst, isLast }) {
  const def = EVENTS[row.event_name];
  const fallbackTone = { info: 'info', success: 'success', warning: 'warning', error: 'error' }[row.severity || def?.severity] || 'neutral';
  const iconCfg = EVENT_ICON[row.event_name] || { icon: 'solar:history-linear', tone: fallbackTone };
  const tone = TONE[iconCfg.tone] || TONE.neutral;
  const { date, time } = formatTs(row.ts);

  const fromStatus = row.payload?.fromStatus;
  const toStatus   = row.payload?.toStatus || row.payload?.status;
  const singleStatusVal = !fromStatus && toStatus ? toStatus : null;

  const fromName = row.payload?.fromName;
  const toName   = row.payload?.toName;
  const hasAvatarTransition = (row.event_name === 'assignee.changed' || row.event_name === 'patient.match_manual')
    && fromName && toName;

  const fileName = row.payload?.fileName || row.payload?.file;
  const hasFileCard = ['file.uploaded', 'sftp.file.detected', 'document.uploaded_for_icd', 'ocr.completed'].includes(row.event_name) && fileName;

  const commentBody = row.event_name === 'icd.comment_added' ? row.payload?.body : null;

  // Generic key/value dump for payload entries the headline doesn't
  // already surface. Renders inside the shared details card via the
  // detailsContent slot when the drawer needs its own layout.
  const hiddenKeys = new Set(['actor', 'actorId', 'actorRole', 'patientName', 'fromName', 'toName', 'fromStatus', 'toStatus', 'status', 'fileName', 'file', 'body', 'roleLabel', 'dos']);
  const detailRows = Object.entries(row.payload || {}).filter(([k, v]) => !hiddenKeys.has(k) && v != null && v !== '');
  const hasDetails = detailRows.length > 0;

  const item = {
    date,
    time,
    by: row.actor_name || undefined,
    role: row.actor_role || undefined,
    dos: row.dos || undefined,
    patient: row.payload?.patientName || undefined,
    headline: row.headline,
    from: fromStatus || undefined,
    to: fromStatus ? toStatus : undefined,
    file: hasFileCard ? fileName : undefined,
    fileType: hasFileCard ? row.payload?.fileType : undefined,
    fromAvatar: hasAvatarTransition ? { initials: initialsOf(fromName), name: fromName } : undefined,
    toAvatar:   hasAvatarTransition ? { initials: initialsOf(toName),   name: toName   } : undefined,
    commentBody: commentBody || undefined,
  };

  const detailsContent = hasDetails ? detailRows.map(([k, v], i) => {
    const isPatientList = Array.isArray(v) && v.length > 0
      && typeof v[0] === 'object' && ('patientName' in v[0] || 'dos' in v[0]);
    return (
      <div key={i} className={htStyles.detailRow}>
        <div className={htStyles.detailText}>
          <div className={htStyles.detailHcc}>{k}{Array.isArray(v) ? ` (${v.length})` : ''}</div>
          {isPatientList ? (
            <div className={htStyles.detailIcd}>
              {v.map((val, j) => (
                <div key={j}>
                  {val.patientName || '(unmatched)'}
                  {val.dos ? ` · DOS ${val.dos}` : ''}
                  {val.kind ? ` · ${val.kind}` : ''}
                </div>
              ))}
            </div>
          ) : (
            <div className={htStyles.detailIcd}>
              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </div>
          )}
        </div>
      </div>
    );
  }) : null;

  return (
    <HistoryTimelineEntry
      item={item}
      isFirst={isFirst}
      isLast={isLast}
      iconConfig={statusIconConfig(toStatus) || { icon: iconCfg.icon, color: tone.color, bg: tone.bg, border: tone.border }}
      singleStatus={singleStatusVal}
      renderStatusIcon={timelineStatusIcon}
      detailsContent={detailsContent}
      showDetailsToggle={hasDetails}
    />
  );
}

// ── Main drawer ─────────────────────────────────────────────────────
export function HccHistoryDrawer() {
  const open = useAppStore(s => s.hccHistoryDrawerOpen);
  const close = useAppStore(s => s.closeHccHistoryDrawer);
  const feed = useAppStore(s => s.hccActivityFeed);
  const loading = useAppStore(s => s.hccActivityFeedLoading);
  const fetchFeed = useAppStore(s => s.fetchHccActivityFeed);
  const reopenHccSkippedReview = useAppStore(s => s.reopenHccSkippedReview);

  // Tab toggle: 'activity' (timeline) vs 'documents' (one card per upload).
  const [tab, setTab] = useState('activity');

  // FilterChip state: each key is a string[] of selected values ([] = unset).
  // Matches the multi-select pattern used by the worklist's FilterChipBar so
  // the drawer's filters behave the same way (pick multiple DOSes, multiple
  // patients, etc.).
  const [filters, setFilters] = useState({ dos: [], patient: [], by: [], category: [], date: [] });
  const setFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));
  const clearAll = () => setFilters({ dos: [], patient: [], by: [], category: [], date: [] });
  const hasAnyFilter = Object.values(filters).some(v => Array.isArray(v) && v.length > 0);

  // Collapsible month groups: empty set = everything expanded.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleGroup = (label) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  useEffect(() => {
    if (open && feed.length === 0 && !loading) fetchFeed();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(() => buildFilterOptions(feed), [feed]);
  const filteredRows = useMemo(
    () => feed.filter(r => rowMatchesFilters(r, filters)),
    [feed, filters],
  );

  // Group by month, mirroring LeftWorkspace.ActivityTab's month sections.
  const groups = useMemo(() => {
    const out = [];
    let cur = null;
    filteredRows.forEach(r => {
      const { monthLabel } = formatTs(r.ts);
      if (!cur || cur.monthLabel !== monthLabel) {
        cur = { monthLabel, items: [] };
        out.push(cur);
      }
      cur.items.push(r);
    });
    return out;
  }, [filteredRows]);

  if (!open) return null;

  const hasItems = filteredRows.length > 0;

  return (
    <Drawer title="HCC Activity History" onClose={close}>
      {/* Tab toggle: Activity timeline vs Documents (one card per upload).
          Uses the shared TabStrip primitive so tab styling matches the app's
          top-level TabBar. Bleeds edge-to-edge inside the drawer body. */}
      <Tabs
        items={[
          { key: 'activity',  label: 'Activity',  icon: 'solar:history-linear' },
          { key: 'documents', label: 'Documents', icon: 'solar:document-text-linear' },
        ]}
        value={tab}
        onValueChange={setTab}
      />
      {tab === 'documents' ? (
        <DocumentsTab
          feed={feed}
          loading={loading}
          onReopenReview={(batch) => {
            // Rebuild the original encounter set for this batch's
            // filename and drop straight into the review phase with
            // only the skipped patients pre-loaded. Closes the history
            // drawer as a side-effect (handled inside the action).
            reopenHccSkippedReview?.({
              batchId: batch.batchId,
              fileName: batch.fileName,
              rejectedList: batch.rejectedList,
            });
          }}
        />
      ) : (
      <>
      {/* Filter row: DOS · Patient · Category · Recorded By · Date + Clear All.
          Uses the shared multi-select FilterChip so behaviour matches the
          worklist's FilterChipBar. Sits at a 0px gap directly under the
          TabStrip and bleeds edge-to-edge inside the drawer. */}
      <div className={hccStyles.filterRow}>
        <Icon name="solar:filter-linear" size={20} color="var(--neutral-300)" />
        <div className={hccStyles.filterChips}>
          <FilterChip label="DOS"         options={options.dos}      selected={filters.dos}      onChange={(v) => setFilter('dos', v)} />
          <FilterChip label="Patient"     options={options.patient}  selected={filters.patient}  onChange={(v) => setFilter('patient', v)} />
          <FilterChip label="Category"    options={options.category} selected={filters.category} onChange={(v) => setFilter('category', v)} />
          <FilterChip label="Recorded By" options={options.by}       selected={filters.by}       onChange={(v) => setFilter('by', v)} />
          <FilterChip label="Date"        options={options.date}     selected={filters.date}     onChange={(v) => setFilter('date', v)} />
        </div>
        <button
          type="button"
          className={hccStyles.clearAll}
          onClick={clearAll}
          disabled={!hasAnyFilter}
        >
          <Icon
            name="solar:close-circle-linear"
            size={12}
            color={hasAnyFilter ? 'var(--primary-300)' : 'var(--neutral-200)'}
          />
          Clear All
        </button>
      </div>

      {loading && feed.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--neutral-300)' }}>
          <Icon name="solar:history-linear" size={32} color="var(--neutral-200)" />
          <p>Loading activity…</p>
        </div>
      ) : !hasItems ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--neutral-300)' }}>
          <Icon name="solar:history-linear" size={32} color="var(--neutral-200)" />
          <p>{hasAnyFilter ? 'No activity matches the selected filters.' : 'No activity recorded yet.'}</p>
        </div>
      ) : (
        <div className={styles.timeline}>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.monthLabel);
            return (
              <div key={g.monthLabel}>
                <button
                  type="button"
                  className={[
                    styles.activityGroup,
                    isCollapsed ? styles.activityGroupCollapsed : '',
                  ].join(' ')}
                  onClick={() => toggleGroup(g.monthLabel)}
                  aria-expanded={!isCollapsed}
                >
                  <span>{g.monthLabel}</span>
                  <span className={styles.activityGroupChevron}>
                    <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-400)" />
                  </span>
                </button>
                {!isCollapsed && g.items.map((row, i) => (
                  <HistoryEntry
                    key={row.id || `${g.monthLabel}-${i}`}
                    row={row}
                    isFirst={i === 0}
                    isLast={i === g.items.length - 1}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </Drawer>
  );
}

/**
 * DocumentsTab: one card per upload batch.
 *
 * Reads the activity feed and groups rows by `scope.batchId`. Each batch
 * card surfaces: filename + uploaded-by + when, total encounters
 * extracted (from ocr.completed), and the accepted / rejected breakdown
 * from `batch.processing_completed`. Batches with rejected encounters
 * get a "Re-open Review" CTA so the user can revisit and add those
 * records that were skipped on the first pass.
 */
function DocumentsTab({ feed, loading, onReopenReview }) {
  const sftpBatches = useAppStore(s => s.hccSftpBatches) || [];
  const batches = useMemo(() => {
    // Combine: (a) in-flight queue from `hccSftpBatches` and
    // (b) historical batches reconstructed from the activity feed.
    // De-dupe by id, with the live queue winning so pending/ready
    // status stays accurate while OCR is in flight.
    const fromFeed = groupFeedByBatch(feed);
    const live = sftpBatches.map(b => ({
      batchId: b.id,
      fileName: b.fileName,
      ts: b.ingestedAt,
      actorName: b.source === 'sftp' ? 'SFTP' : 'You',
      totalExtracted: b.encounters?.length,
      approvedCount: 0,
      rejectedCount: 0,
      rejectedList: [],
      status: b.status === 'pending' ? 'processing' : 'ready',
    }));
    const seenIds = new Set(live.map(l => l.batchId));
    const merged = [
      ...live,
      ...fromFeed.filter(b => !seenIds.has(b.batchId)),
    ];
    merged.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    return merged;
  }, [feed, sftpBatches]);

  // Spec D: uploader filter. Build the unique uploader list from
  // the batches array so the dropdown only ever shows people who
  // have actually uploaded something.
  const uploaders = useMemo(() => {
    const set = new Set();
    batches.forEach(b => { if (b.actorName) set.add(b.actorName); });
    return ['All uploaders', ...Array.from(set).sort()];
  }, [batches]);
  const [uploaderFilter, setUploaderFilter] = useState('All uploaders');

  if (loading && batches.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--neutral-300)' }}>
        <Icon name="solar:document-text-linear" size={32} color="var(--neutral-200)" />
        <p>Loading documents…</p>
      </div>
    );
  }
  if (batches.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--neutral-300)' }}>
        <Icon name="solar:document-text-linear" size={32} color="var(--neutral-200)" />
        <p>No documents uploaded yet.</p>
      </div>
    );
  }

  const totals = batches.reduce((acc, b) => {
    acc.docs += 1;
    acc.added += b.approvedCount || 0;
    acc.skipped += b.rejectedCount || 0;
    return acc;
  }, { docs: 0, added: 0, skipped: 0 });

  const visibleBatches = uploaderFilter === 'All uploaders'
    ? batches
    : batches.filter(b => b.actorName === uploaderFilter);
  const visibleTotals = visibleBatches.reduce((acc, b) => {
    acc.docs += 1;
    acc.added += b.approvedCount || 0;
    acc.skipped += b.rejectedCount || 0;
    return acc;
  }, { docs: 0, added: 0, skipped: 0 });

  return (
    <div className={hccStyles.docsTab}>
      {/* Summary strip + uploader filter chip, Figma compliance for
          spec D (filter by uploader). */}
      <div className={hccStyles.docsHeaderRow}>
        <div className={hccStyles.docsSummary}>
          <span><strong>{visibleTotals.docs}</strong> document{visibleTotals.docs === 1 ? '' : 's'}</span>
          <span>·</span>
          <span><strong style={{ color: 'var(--status-success)' }}>{visibleTotals.added}</strong> added</span>
          <span>·</span>
          <span><strong style={{ color: 'var(--status-warning)' }}>{visibleTotals.skipped}</strong> skipped</span>
        </div>
        {uploaders.length > 2 && (
          <FilterChip
            label="Uploader"
            options={uploaders.slice(1)}
            selected={uploaderFilter === 'All uploaders' ? [] : [uploaderFilter]}
            onChange={(vals) => setUploaderFilter(vals[0] || 'All uploaders')}
          />
        )}
      </div>
      <div className={hccStyles.docsList}>
        {visibleBatches.map(batch => (
          <DocumentRow
            key={batch.batchId}
            batch={batch}
            onReopen={() => onReopenReview?.(batch)}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentRow({ batch, onReopen }) {
  const [expanded, setExpanded] = useState(false);
  const { fileName, ts, actorName, totalExtracted, approvedCount, rejectedCount, status, rejectedList } = batch;
  const { date, time } = formatTs(ts);
  const statusCls = (
    status === 'complete' ? hccStyles.docStatusComplete :
    status === 'partial'  ? hccStyles.docStatusPartial :
    status === 'ready'    ? hccStyles.docStatusReady :
    status === 'failed'   ? hccStyles.docStatusFailed :
    hccStyles.docStatusProcessing
  );
  const statusLabel = (
    status === 'complete' ? 'Complete' :
    status === 'partial'  ? 'Partial' :
    status === 'ready'    ? 'Ready' :
    status === 'failed'   ? 'Failed' :
    'Processing'
  );
  return (
    <div className={hccStyles.docRow}>
      <div className={hccStyles.docRowHead}>
        <span className={hccStyles.docIcon}>
          <Icon name="solar:document-text-linear" size={16} color="var(--primary-300)" />
        </span>
        <div className={hccStyles.docRowMain}>
          <div className={hccStyles.docRowName}>{fileName || 'Uploaded file'}</div>
          <div className={hccStyles.docRowMeta}>
            {actorName || 'Unknown'} · {date} {time}
            {typeof totalExtracted === 'number' && (
              <span> · {totalExtracted} encounter{totalExtracted === 1 ? '' : 's'} extracted</span>
            )}
          </div>
        </div>
        <span className={[hccStyles.docStatus, statusCls].join(' ')}>{statusLabel}</span>
      </div>

      {/* Counters strip: Added vs Skipped, color-coded so partial docs
          read at a glance. */}
      <div className={hccStyles.docCounters}>
        <span className={hccStyles.docCounter}>
          <Icon name="solar:check-circle-bold" size={12} color="var(--status-success)" />
          <strong>{approvedCount || 0}</strong> Added
        </span>
        <span className={hccStyles.docCounter}>
          <Icon name="solar:close-circle-bold" size={12} color="var(--status-warning)" />
          <strong>{rejectedCount || 0}</strong> Skipped
        </span>
        {(rejectedCount || 0) > 0 && (
          <button
            type="button"
            className={hccStyles.docReopenBtn}
            onClick={onReopen}
          >
            <Icon name="solar:undo-left-round-linear" size={12} color="var(--primary-300)" />
            Re-open Review
          </button>
        )}
        {(rejectedCount || 0) > 0 && (
          <button
            type="button"
            className={hccStyles.docExpandBtn}
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? 'Hide skipped' : 'View skipped'}
            <Icon
              name={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
              size={10}
              color="var(--neutral-300)"
            />
          </button>
        )}
      </div>

      {expanded && Array.isArray(rejectedList) && rejectedList.length > 0 && (
        <div className={hccStyles.docSkippedList}>
          <div className={hccStyles.docSkippedHead}>Skipped records ({rejectedList.length})</div>
          {rejectedList.map((item, i) => (
            <div key={i} className={hccStyles.docSkippedItem}>
              <Icon name="solar:user-circle-linear" size={12} color="var(--neutral-300)" />
              <span>{item.patientName || '(unmatched)'}</span>
              {item.dos && <span className={hccStyles.docSkippedDos}>· DOS {item.dos}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Reduce the activity feed into one summary record per batch.
 * Looks at:
 *  - file.uploaded   → fileName, actorName, pageCount
 *  - ocr.completed   → totalExtracted
 *  - batch.processing_completed → approvedCount, rejectedCount, rejectedList, ts
 * Falls back to ocr.started / batch.created when the batch is mid-flight.
 *
 * Returns newest-first.
 */
function groupFeedByBatch(feed) {
  const byBatch = new Map();
  feed.forEach(row => {
    const batchId = row.batch_id || row.payload?.batchId || row.scope?.batchId;
    if (!batchId) return;
    if (!byBatch.has(batchId)) byBatch.set(batchId, { batchId, rows: [] });
    byBatch.get(batchId).rows.push(row);
  });

  const out = [];
  byBatch.forEach(({ batchId, rows }) => {
    const upload = rows.find(r => r.event_name === 'file.uploaded');
    const ocrDone = rows.find(r => r.event_name === 'ocr.completed');
    const ocrStart = rows.find(r => r.event_name === 'ocr.started');
    const ocrFailed = rows.find(r => r.event_name === 'ocr.failed');
    const done = rows.find(r => r.event_name === 'batch.processing_completed');
    const latestTs = rows.reduce((max, r) => (r.ts > max ? r.ts : max), '');

    const fileName = upload?.payload?.fileName
      || done?.payload?.fileName
      || ocrDone?.payload?.fileName
      || ocrStart?.payload?.fileName
      || ocrFailed?.payload?.fileName
      || '(unnamed file)';

    let status;
    if (ocrFailed) {
      status = 'failed';
    } else if (done) {
      status = (done.payload?.rejectedCount || 0) > 0 ? 'partial' : 'complete';
    } else if (ocrDone) {
      status = 'ready';
    } else {
      status = 'processing';
    }

    out.push({
      batchId,
      fileName,
      ts: done?.ts || ocrDone?.ts || upload?.ts || latestTs,
      actorName: upload?.actor_name || upload?.payload?.actor || done?.payload?.actor || 'System',
      totalExtracted: ocrDone?.payload?.encounterCount,
      approvedCount: done?.payload?.approvedCount || 0,
      rejectedCount: done?.payload?.rejectedCount || 0,
      rejectedList: done?.payload?.rejectedList || [],
      status,
    });
  });

  // Newest first.
  out.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
  return out;
}
