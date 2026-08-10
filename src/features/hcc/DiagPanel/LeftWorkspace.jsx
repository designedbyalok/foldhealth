import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Button } from '../../../components/Button/Button';
import { Badge } from '../../../components/Badge/Badge';
import { FilterChip as SharedFilterChip } from '../../../components/FilterChip/FilterChip';
import {
  COMMENTS as COMMENTS_MOCK,
  NOTES as NOTES_MOCK,
  CLAIMS,
  HISTORY as HISTORY_MOCK,
} from '../data/ancillary';
import { getChartDocs, makeUploadedChartDoc } from '../data/chartDocs';
import { ACTIVITY, getActivityFromDb } from '../data/activity';
import { getIcdsForMember, getNotLinkedForMember } from '../data/icds';
import { dosSourceLetter } from '../dosSource';
import { dosKey } from '../assignment/dosState';
import { staffById } from '../assignment/astranaStaff';
import { normalizeRole } from '../reviewedBy';
import { SYSTEM_USERS } from '../systemUsers';
import { OutreachTab as PatientOutreachTab } from '../../patient/left-panel/tabs/outreach/OutreachTab/OutreachTab';
import { DocEvidenceViewer } from './DocEvidenceViewer';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { CommentComposer } from '../../../components/CommentComposer/CommentComposer';
import { Avatar } from '../../../components/Avatar/Avatar';
import styles from './LeftWorkspace.module.css';

// Two tab sets depending on scope. Counts flow in per-render since
// Comments / Documents / Notes now come from Supabase (falling back to
// the local mock when the DB is empty).
//   • ICD-level (opened from an ICD code) — Figma 1:45936:
//       Activity Log, Notes, Comments, Documents, Claims, History
//   • DOS-level (opened from the toolbar Activity Log icon) — Figma 1:48023:
//       Activity Log, Notes, Comments, Documents, Claims, Outreach, Worklog
// Tab order: Documents → Claims → Timeline → Comments → Notes → History → Worklog.
// ("Activity Log" is renamed to "Timeline" per product; the tab key stays
// 'activity' to keep the store's active-tab persistence stable.)
const buildTabs = ({ commentsCount, notesCount, claimsCount }) => ([
  { key: 'documents', label: 'Documents',     countFor: () => null }, // computed from charts
  { key: 'claims',    label: 'Claims',        countFor: () => claimsCount },
  { key: 'activity',  label: 'Timeline',      countFor: () => null },
  { key: 'comments',  label: 'Comments',      countFor: () => commentsCount },
  { key: 'notes',     label: 'Notes',         countFor: () => notesCount },
  { key: 'history',   label: 'History',       countFor: () => null },
  { key: 'worklog',   label: 'Worklog',       countFor: () => null },
]);

// Every content tab shares the same filter row so a filter set the user
// dials in stays applied as they hop between tabs. Outreach is excluded —
// it embeds the patient-facing OutreachTab which has its own toolbar.
const FILTERED_TABS = new Set(['activity', 'notes', 'comments', 'documents', 'claims', 'history', 'worklog']);

/**
 * LeftWorkspace — appears when the DiagPanel expands. Hosts a tab nav across
 * the top and a content area below. The tab set + filter set depend on scope:
 *   • DOS-level (icdScope == null): 7 tabs incl. Outreach + Worklog; filter
 *     row carries DOS / HCC / ICD / Recorded By / Date.
 *   • ICD-level (icdScope set):     6 tabs incl. History; filter row carries
 *     Recorded By / Date only.
 *
 * Props:
 *  - active    (string)        Currently selected tab key.
 *  - icdScope  (string|null)   ICD code when scoped to one ICD; null = DOS-level.
 *  - onChange  (fn(string))    Switch tabs (scope preserved by the parent).
 *  - onClose   (fn)            Collapse the left workspace.
 *  - member    (member shape)  Data lookup for the tab-content components.
 */
export function LeftWorkspace({
  active,
  icdScope = null,
  onChange,
  onClose,
  member,
  pendingStatusChange = null,
  onConfirmStatusChange,
  onCancelStatusChange,
}) {
  // Kick off the org-scoped ancillary fetch once — safe to call repeatedly,
  // the store guards on didFetch. Doing it here means every drawer open
  // primes Comments / Documents / Notes / History without threading a hook
  // through the top-level DiagPanel.
  const fetchHccDiagAncillary = useAppStore(s => s.fetchHccDiagAncillary);
  useEffect(() => { fetchHccDiagAncillary(); }, [fetchHccDiagAncillary]);
  const dbComments = useAppStore(s => s.hccDiagComments);
  const dbNotes    = useAppStore(s => s.hccDiagNotes);
  const commentsForCount = dbComments.length ? dbComments : COMMENTS_MOCK;
  const notesForCount    = dbNotes.length    ? dbNotes    : NOTES_MOCK;
  // Per-member claims — one row per claim-sourced DOS on the record.
  // claimForDos() reuses the CLAIMS fixture when the date matches or
  // synthesizes a stable row otherwise, so the Claims tab count and its
  // table always agree (both derive from the same member.dos_list).
  const memberClaims = useMemo(
    () => {
      // A record with no document on file can't have any 'D'-sourced DOSs;
      // pass hasDoc so those dates re-bucket to Claim/Manual consistently.
      const hasDoc = member?.ch != null;
      return (member?.dos_list || [])
        .filter(d => dosSourceLetter(d.date, hasDoc) === 'C')
        .map(d => claimForDos(d.date));
    },
    [member?.dos_list, member?.ch],
  );
  // History is scoped to a specific ICD — it lists prior reviews of that
  // code. Hide the tab at DOS-level (icdScope null); it re-appears when the
  // user drills into an ICD via the ICD card or its History icon.
  const tabs = buildTabs({
    commentsCount: commentsForCount.length,
    notesCount: notesForCount.length,
    claimsCount: memberClaims.length,
  }).filter(t => t.key !== 'history' || !!icdScope);
  // If the user was on History when the ICD scope cleared, snap to the
  // first visible tab so the workspace doesn't render an orphaned pane
  // with no active tab button.
  useEffect(() => {
    if (active === 'history' && !icdScope) onChange?.(tabs[0]?.key || 'documents');
  }, [active, icdScope, onChange, tabs]);
  // openDocId lives in the store so other surfaces — the DiagPanel Documents
  // toolbar button and DOS-row clicks in IcdDosCard — can jump straight into
  // the preview for a specific doc.
  const openDocId = useAppStore(s => s.diagOpenDocId);
  const setOpenDocId = useAppStore(s => s.setDiagOpenDocId);
  const isPreviewingDoc = active === 'documents' && !!openDocId;
  // Every filtered tab uses the same 5-chip filter set (DOS / HCC / ICD /
  // Recorded By / Date). Docs tab hides the row while a document is being
  // previewed — filters only make sense on the listing.
  const showFilterRow = FILTERED_TABS.has(active) && !isPreviewingDoc;

  // Real chart list for THIS record — same source the worklist Documents
  // column uses, so the tab count matches the column count exactly.
  const addedCharts    = useAppStore(s => s.hccAddedCharts?.[member?.id]);
  const chartStatus    = useAppStore(s => s.hccChartStatus?.[member?.id]);
  const removedCharts  = useAppStore(s => s.hccRemovedCharts?.[member?.id]);
  const charts = useMemo(
    () => (member ? getChartDocs(member, addedCharts || [], chartStatus || {}, removedCharts || []) : []),
    [member, addedCharts, chartStatus, removedCharts],
  );
  // Per-tab count override — 'documents' takes its count from the record's
  // charts (not the static DOCUMENTS mock).
  const countForTab = (t) => {
    if (t.key === 'documents') return charts.length;
    return t.countFor?.();
  };

  // Pull the activity entries once at this level so the filter row can compute
  // its dropdown options (DOS / HCC / ICD / Recorded By) from the same source
  // the timeline renders from.
  // Merge live entries (user actions during this session) with the mock log.
  // Live entries land at the top; we re-insert today's group header if the
  // first mock entry isn't already a group divider for today.
  const liveLog = useAppStore(s => s.hccActivityLog[member?.name]);
  // Kick off the Activity-Log fetch on first render — didFetch inside
  // the store makes it a one-shot round-trip.
  const fetchHccGapActivity = useAppStore(s => s.fetchHccGapActivity);
  useEffect(() => { fetchHccGapActivity(); }, [fetchHccGapActivity]);
  const activityFromDb = useAppStore(s => s.hccGapActivity);
  const rawActivity = useMemo(() => {
    const mock = getActivityFromDb(activityFromDb, member?.name);
    if (!liveLog?.length) return mock;
    const todayLabel = (() => {
      const d = new Date();
      return d.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
    })();
    const header = mock[0]?.t === 'group' && mock[0]?.label === todayLabel
      ? []
      : [{ t: 'group', label: todayLabel }];
    return [...header, ...liveLog, ...mock];
  }, [liveLog, member?.name, activityFromDb]);

  // Filter state — each chip carries an ARRAY (multi-select). DOS is seeded
  // with every DOS the member has, so "all are selected by default" and the
  // user narrows the view by unchecking. Empty array = filter inactive (all
  // records match). The ICD chip is kept in sync with the ICD card the user
  // picked on the right panel (diagActivityIcd) — selecting a card populates
  // filters.icd; unchecking it in the chip clears the card selection too.
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const clearDiagActivityIcd = useAppStore(s => s.clearDiagActivityIcd);
  const memberDosList = useMemo(
    () => (member?.dos_list || []).flatMap(d => d.date ? [d.date] : []),
    [member?.dos_list],
  );
  const [filters, setFilters] = useState(() => ({
    dos:  memberDosList,
    hcc:  [],
    icd:  activityIcd ? [activityIcd] : [],
    by:   [],
    date: [],
  }));
  // Track whether the user has manually edited the DOS chip. While untouched,
  // mirror the full DOS option list into filters.dos so late-loading activity
  // entries (which can widen the option list) stay auto-selected. Once the
  // user unchecks anything, we stop auto-mirroring so their edit sticks.
  const dosCustomizedRef = useRef(false);
  const seedRef = useRef(member?.id);
  useEffect(() => {
    if (seedRef.current !== member?.id) {
      seedRef.current = member?.id;
      dosCustomizedRef.current = false;
      setFilters({
        dos:  memberDosList,
        hcc:  [],
        icd:  activityIcd ? [activityIcd] : [],
        by:   [],
        date: [],
      });
    }
  }, [member?.id, memberDosList, activityIcd]);
  // Mirror the card-selected ICD into the ICD chip. When the card gets
  // cleared, drop that ICD from the chip too.
  useEffect(() => {
    setFilters(f => {
      const target = activityIcd ? [activityIcd] : [];
      const same = f.icd.length === target.length
        && (target.length === 0 || f.icd[0] === target[0]);
      return same ? f : { ...f, icd: target };
    });
  }, [activityIcd]);

  const setFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
    if (key === 'dos') dosCustomizedRef.current = true;
    // Un-picking the card-selected ICD via the chip should also clear the
    // card selection so the right-panel highlight stays in sync.
    if (key === 'icd' && activityIcd && Array.isArray(value) && !value.includes(activityIcd)) {
      clearDiagActivityIcd?.();
    }
  };
  const clearAllFilters = () => {
    dosCustomizedRef.current = true;
    setFilters({ dos: [], hcc: [], icd: [], by: [], date: [] });
    if (activityIcd) clearDiagActivityIcd?.();
  };

  // Options derived from the activity entries (plus DOS list from member).
  // "Recorded By" options come from actual authors in the persisted records
  // (comments, notes, documents) plus the platform-user directory, so the
  // filter never shows a stale mock-activity author who never actually posted.
  const dbCommentsAll = useAppStore(s => s.hccDiagComments);
  const dbNotesAll    = useAppStore(s => s.hccDiagNotes);
  const dbDocsAll     = useAppStore(s => s.hccDiagDocumentsList);
  const platformUsersAll = useAppStore(s => s.platformUsers);
  const filterOptions = useMemo(
    () => computeFilterOptions(rawActivity, member, {
      comments: dbCommentsAll,
      notes: dbNotesAll,
      docs: dbDocsAll,
      platformUsers: platformUsersAll,
    }),
    [rawActivity, member, dbCommentsAll, dbNotesAll, dbDocsAll, platformUsersAll],
  );
  // Mirror the full DOS option list into filters.dos until the user edits
  // it. Keeps "default = all selected" true even when activity data loads
  // asynchronously and adds new DOS options after the initial render.
  useEffect(() => {
    if (dosCustomizedRef.current) return;
    setFilters(f => {
      const opts = filterOptions.dos || [];
      const same = f.dos.length === opts.length && opts.every(d => f.dos.includes(d));
      return same ? f : { ...f, dos: opts };
    });
  }, [filterOptions.dos]);

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        <ActionButton
          icon="custom:collapse-sidebar"
          size="S"
          tooltip="Collapse"
          onClick={onClose}
          className={styles.collapseBtn}
        />
        <span className={styles.tabBarDivider} />
        <div className={styles.tabRow}>
          {tabs.map((t) => {
            const isActive = active === t.key;
            const count = countForTab(t);
            return (
              <button
                key={t.key}
                type="button"
                className={[styles.tab, isActive ? styles.tabActive : ''].join(' ')}
                onClick={() => onChange(t.key)}
              >
                <span>{count != null ? `${t.label}(${count})` : t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.body}>
        {/* Filter row. DOS-level → DOS/HCC/ICD/Recorded By/Date + Clear All.
            ICD-level → Recorded By/Date. Worklog → DOS only. Per-tab actions
            (Upload, Add Note) sit in the trailing slot to the right of the
            chips, separated by a vertical divider. */}
        {showFilterRow && (
          <FilterRow
            filters={filters}
            options={filterOptions}
            onChange={setFilter}
            onClearAll={clearAllFilters}
            trailing={
              active === 'documents' ? <DocumentsTrailingAction member={member} /> :
              null
            }
          />
        )}

        {active === 'activity'  && <ActivityTab  member={member} rawEntries={rawActivity} filters={filters} />}
        {active === 'comments'  && (
          <CommentsTab
            member={member}
            filters={filters}
            pendingStatusChange={pendingStatusChange}
            onConfirmStatusChange={onConfirmStatusChange}
            onCancelStatusChange={onCancelStatusChange}
          />
        )}
        {active === 'documents' && (
          <DocumentsTab
            member={member}
            icdScope={icdScope}
            charts={charts}
            openDocId={openDocId}
            setOpenDocId={setOpenDocId}
            filters={filters}
          />
        )}
        {active === 'notes'     && <NotesTab     member={member} filters={filters} />}
        {active === 'claims'    && <ClaimsTab    member={member} filters={filters} claims={memberClaims} />}
        {active === 'outreach'  && <OutreachTab  member={member} />}
        {active === 'worklog'   && <WorklogTab   member={member} filters={filters} />}
        {active === 'history'   && <HistoryTab    member={member} filters={filters} />}
      </div>
    </div>
  );
}

// Filter row chip set — the same 5 chips on every tab so a filter the user
// dials in on Timeline stays applied on Documents/Claims/etc.
const FILTER_KEYS = ['dos', 'hcc', 'icd', 'by', 'date'];
const FILTER_LABEL = {
  dos:  'DOS',
  hcc:  'HCC Code',
  icd:  'ICD Code',
  by:   'Recorded By',
  date: 'Date',
};

// Preset Date-filter ranges, evaluated against entry.date (MM/DD/YYYY).
const DATE_PRESETS = ['Today', 'Last 7 days', 'Last 30 days', 'This month'];

/**
 * Build the dropdown option lists for each filter chip from the activity
 * entries (plus member.dos_list for the DOS filter).
 */
function computeFilterOptions(entries, member, extras = {}) {
  const dos = new Set((member?.dos_list || []).flatMap(d => d.date ? [d.date] : []));
  const hcc = new Set();
  const icd = new Set();
  const HCC_RE = /HCC\s*\d+/g;
  // Strip a trailing "(Role)" suffix so "You (Coder)" and "You (QA)" collapse
  // to a single "You" option in the Recorded By list.
  const stripRole = (raw) => String(raw || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  for (const e of entries) {
    if (e.t === 'group') continue;
    if (e.dos) dos.add(e.dos);
    if (Array.isArray(e.icds)) e.icds.forEach(c => icd.add(c));
    if (typeof e.headline === 'string') {
      // Normalize "HCC18" / "HCC  18" → "HCC 18" so the dropdown isn't duplicated.
      (e.headline.match(HCC_RE) || []).forEach(c => hcc.add(c.replace(/^HCC\s*/, 'HCC ')));
    }
  }
  // "Recorded By" options are sourced from platform users (canonical directory)
  // and augmented with the authors of the persisted records for this record
  // (comments / notes / documents). Mock activity-log authors that aren't in
  // either source are excluded — so the dropdown never shows a name that
  // could never legitimately post a record here.
  const byPool = new Set();
  for (const u of (extras.platformUsers || [])) {
    const name = stripRole(u.name);
    if (name) byPool.add(name);
  }
  for (const c of (extras.comments || [])) {
    const name = stripRole(c.author);
    if (name) byPool.add(name);
  }
  for (const n of (extras.notes || [])) {
    const name = stripRole(n.author);
    if (name) byPool.add(name);
  }
  for (const d of (extras.docs || [])) {
    const name = stripRole(d.uploadedBy || d.author);
    if (name) byPool.add(name);
  }
  const cmp = (a, b) => a.localeCompare(b);
  return {
    dos:  dos.toSorted(cmp),
    hcc:  hcc.toSorted(cmp),
    icd:  icd.toSorted(cmp),
    by:   byPool.toSorted(cmp),
    date: DATE_PRESETS,
  };
}

/**
 * Returns true when an activity entry passes the current filter set. Each
 * chip carries an array of selected values; an empty array disables that
 * constraint (i.e. "no filter"). ICD uses OR semantics: any overlap between
 * the entry's icds[] and the selected icds counts as a match. HCC codes are
 * matched inside the headline text so "HCC18" / "HCC 18" both hit.
 */
function entryMatchesFilters(e, filters) {
  if (e.t === 'group') return true;
  if (filters.dos?.length && !filters.dos.includes(e.dos)) return false;
  if (filters.by?.length  && !filters.by.includes(e.by))   return false;
  if (filters.icd?.length && !(Array.isArray(e.icds) && filters.icd.some(c => e.icds.includes(c)))) return false;
  if (filters.hcc?.length) {
    const ok = filters.hcc.some(h => {
      const num = String(h).replace(/^HCC\s*/, '');
      const re = new RegExp(`HCC\\s*${num}\\b`);
      return typeof e.headline === 'string' && re.test(e.headline);
    });
    if (!ok) return false;
  }
  if (filters.date?.length) {
    const d = parseEntryDate(e.date);
    if (!d) return false;
    if (!filters.date.some(p => matchesDatePreset(d, p))) return false;
  }
  return true;
}

/**
 * Loose matcher for the ancillary tabs (Comments / Notes / Documents /
 * Claims / History / Worklog rows). Each record is a plain object; each
 * filter chip only constrains records that CARRY the relevant dimension —
 * if the field is missing, that filter is ignored for the row. Same
 * empty-array = no-filter semantics as entryMatchesFilters.
 *
 * Field aliases:
 *   dos  → rec.dos
 *   hcc  → rec.hccCode | rec.hcc  (compared HCC-number-agnostic)
 *   icd  → rec.icd | rec.code  (worklog row's ICD lives in `code`)
 *   by   → rec.by | rec.author | rec.uploadedBy | rec.submittedBy
 *   date → rec.date | rec.reviewedAt | rec.last | rec.time (MM/DD/YYYY only)
 */
function recordMatchesFilters(rec, filters) {
  if (!rec) return true;
  if (filters?.dos?.length && rec.dos != null && !filters.dos.includes(rec.dos)) return false;
  if (filters?.hcc?.length) {
    const raw = rec.hccCode ?? rec.hcc;
    if (raw != null) {
      const norm = String(raw).match(/HCC\s*\d+/)?.[0]?.replace(/^HCC\s*/, 'HCC ') || String(raw);
      const wanted = filters.hcc.map(h => String(h).match(/HCC\s*\d+/)?.[0]?.replace(/^HCC\s*/, 'HCC ') || String(h));
      if (!wanted.includes(norm)) return false;
    }
  }
  if (filters?.icd?.length) {
    const code = rec.icd ?? rec.code;
    if (code != null && !filters.icd.includes(code)) return false;
  }
  if (filters?.by?.length) {
    const author = rec.by ?? rec.author ?? rec.uploadedBy ?? rec.submittedBy;
    if (author != null) {
      const name = String(author).replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (!filters.by.includes(name) && !filters.by.includes(author)) return false;
    }
  }
  if (filters?.date?.length) {
    const dateStr = rec.date ?? rec.reviewedAt ?? rec.last;
    if (dateStr != null) {
      const d = parseEntryDate(dateStr);
      if (d && !filters.date.some(p => matchesDatePreset(d, p))) return false;
    }
  }
  return true;
}

function parseEntryDate(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
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

function FilterRow({ filters, options, onChange, onClearAll, trailing }) {
  const hasAny = FILTER_KEYS.some(k => Array.isArray(filters?.[k]) && filters[k].length > 0);
  return (
    <div className={styles.filterRow}>
      <div className={styles.filterChips}>
        {FILTER_KEYS.map((k) => (
          <div key={k} className={styles.filterChipWrap}>
            <SharedFilterChip
              label={FILTER_LABEL[k]}
              options={options?.[k] || []}
              selected={filters?.[k] || []}
              onChange={(next) => onChange?.(k, next)}
            />
          </div>
        ))}
        {/* Clear All sits inline next to the last filter chip. Always
            rendered (per Figma) — disabled when no filter is active. */}
        <button
          type="button"
          className={styles.filterClearAll}
          onClick={onClearAll}
          disabled={!hasAny}
        >
          <Icon
            name="solar:close-circle-linear"
            size={12}
            color={hasAny ? 'var(--primary-300)' : 'var(--neutral-200)'}
          />
          Clear All
        </button>
      </div>
      {trailing && (
        <>
          <span className={styles.filterTrailingDivider} />
          {trailing}
        </>
      )}
    </div>
  );
}

// ── Activity Log tab — timeline view with connected vertical line ───────
//
// Matches the prototype's TLItem (lines 887–1019). Each non-group entry has
// a left rail with [top connector] + [icon bubble] + [bottom connector],
// keeping the whole timeline visually linked. Group rows ("JAN 2026") break
// the rail and render as a section header.

const ACT_ICON = {
  outreach:    { icon: 'solar:phone-linear',                 color: 'var(--secondary-300)',     bg: 'var(--secondary-100)',      border: 'rgba(244,122,62,0.2)',    dashed: false },
  status_dos:  { icon: 'solar:eye-scan-linear',              color: 'var(--status-warning)',     bg: 'var(--status-warning-light)', border: 'rgba(217,165,11,0.2)',    dashed: false },
  status_hcc:  { icon: 'solar:eye-scan-linear',              color: 'var(--status-warning)',     bg: 'var(--status-warning-light)', border: 'rgba(217,165,11,0.2)',    dashed: false },
  status_role: { icon: 'solar:refresh-circle-linear',        color: 'var(--primary-300)',        bg: 'var(--primary-50)',           border: 'rgba(107,68,168,0.2)',    dashed: false },
  accept:      { icon: 'solar:check-read-linear',            color: 'var(--status-success)',     bg: 'var(--status-success-light)', border: 'rgba(0,155,83,0.2)',      dashed: false },
  dismiss:     { icon: 'solar:close-circle-linear',          color: 'var(--status-error)',       bg: 'var(--status-error-light)',   border: 'rgba(215,40,37,0.2)',     dashed: false },
  delete:      { icon: 'solar:trash-bin-trash-linear',       color: 'var(--status-error)',       bg: 'var(--status-error-light)',   border: 'rgba(215,40,37,0.2)',     dashed: false },
  upload:      { icon: 'solar:upload-minimalistic-linear',   color: 'var(--neutral-300)',        bg: 'var(--neutral-0)',            border: 'var(--neutral-150)',      dashed: false },
  create:      { icon: 'solar:add-circle-linear',            color: 'var(--secondary-300)',      bg: 'var(--secondary-100)',        border: 'rgba(244,122,62,0.2)',    dashed: false },
  override:    { icon: 'solar:refresh-square-linear',        color: 'var(--secondary-300)',      bg: 'var(--secondary-100)',        border: 'rgba(244,122,62,0.2)',    dashed: false },
  comment:     { icon: 'solar:chat-round-linear',            color: 'var(--neutral-300)',        bg: 'var(--neutral-0)',            border: 'var(--neutral-150)',      dashed: false },
  assign_coder:{ icon: 'solar:user-plus-rounded-linear',     color: 'var(--neutral-300)',        bg: 'var(--neutral-0)',            border: 'var(--neutral-150)',      dashed: false },
};

const TRANS_BADGE = {
  Accepted:  'pillAccepted',
  Dismissed: 'pillDismissed',
  Deleted:   'pillDeleted',
  None:      'pillNone',
  Open:      'pillOpen',
  Returned:  'pillReturned',
  New:       'pillNew',
  Completed: 'pillCompleted',
  Audited:   'pillAudited',
  'In Progress': 'pillInProgress',
};

function ActivityTab({ member, rawEntries: rawEntriesProp, filters }) {
  const rawEntries = rawEntriesProp || ACTIVITY[member?.name] || ACTIVITY._default || [];

  // Track which month groups are collapsed. Empty set = everything expanded.
  // Keyed by the group's label (e.g. "JAN 2026") which is unique per month.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleGroup = (label) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  // Filter by the shared filter row's chip selections (ICD selection from
  // the right panel is mirrored into filters.icd upstream). Keep group
  // headers, then strip any header that no longer has items beneath it.
  const entries = (() => {
    const kept = rawEntries.filter(e => {
      if (e.t === 'group') return true;
      if (filters && !entryMatchesFilters(e, filters)) return false;
      return true;
    });
    return kept.filter((e, i) => {
      if (e.t !== 'group') return true;
      const next = kept[i + 1];
      return next && next.t !== 'group';
    });
  })();
  const anyFilterActive = FILTER_KEYS.some(k => Array.isArray(filters?.[k]) && filters[k].length > 0);

  const hasItems = entries.some(e => e.t !== 'group');

  // Pre-compute first/last per visual group — needed so the timeline rail
  // can omit the top connector on the first item below a group header and
  // the bottom connector on the last item before the next group / EOL.
  // Items beneath a collapsed group header are dropped from the render list.
  const items = (() => {
    let activeGroup = null; // label of the group whose items are currently being scanned
    const out = [];
    entries.forEach((item, i) => {
      if (item.t === 'group') {
        activeGroup = item.label;
        out.push({ kind: 'group', item, key: `g${i}` });
        return;
      }
      if (activeGroup && collapsed.has(activeGroup)) return; // skip hidden
      const prev = entries[i - 1];
      const next = entries[i + 1];
      const isFirst = !prev || prev.t === 'group';
      const isLast = !next || next.t === 'group';
      out.push({ kind: 'item', item, key: `i${i}`, isFirst, isLast });
    });
    return out;
  })();

  return (
    <div className={styles.scroll}>
      {!hasItems ? (
        <Empty label={anyFilterActive ? 'No activity matches the current filters.' : 'No activity recorded yet.'} />
      ) : (
        <div className={styles.timeline}>
          {items.map((it) => it.kind === 'group' ? (
            <button
              key={it.key}
              type="button"
              className={[
                styles.activityGroup,
                collapsed.has(it.item.label) ? styles.activityGroupCollapsed : '',
              ].join(' ')}
              onClick={() => toggleGroup(it.item.label)}
              aria-expanded={!collapsed.has(it.item.label)}
            >
              <span>{it.item.label}</span>
              <span className={styles.activityGroupChevron}>
                <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-400)" />
              </span>
            </button>
          ) : (
            <ActivityEntry key={it.key} item={it.item} isFirst={it.isFirst} isLast={it.isLast} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityEntry({ item, isFirst, isLast, member }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ACT_ICON[item.t] || ACT_ICON.accept;
  const setDiagLeftPanel = useAppStore(s => s.setDiagLeftPanel);
  const setDiagOpenDocId = useAppStore(s => s.setDiagOpenDocId);
  const addedCharts = useAppStore(s => s.hccAddedCharts[member?.id]);
  const chartStatus = useAppStore(s => s.hccChartStatus[member?.id]);
  const removedCharts = useAppStore(s => s.hccRemovedCharts[member?.id]);
  // Open the uploaded document in the Documents preview. Matches by
  // docId when available (new entries), falls back to filename lookup
  // for older activity records that predate the docId field.
  const previewDoc = () => {
    if (!member) return;
    const docs = getChartDocs(member, addedCharts || [], chartStatus || {}, removedCharts || []);
    const match = (item.docId && docs.find(d => d.id === item.docId))
      || (item.file && docs.find(d => d.n === item.file || d.caption === item.file));
    if (!match) return;
    setDiagLeftPanel('documents');
    setDiagOpenDocId(match.id);
  };
  const meta = [
    item.date,
    item.time,
    item.by + (item.role ? ` (${item.role})` : ''),
    item.dos ? `DOS (${item.dos})` : null,
  ].filter(Boolean).join(' • ');

  return (
    <div className={styles.tlRow}>
      <div className={styles.tlRail}>
        {!isFirst && <span className={styles.tlConnectorTop} />}
        <span
          className={[styles.tlIcon, cfg.dashed ? styles.tlIconDashed : ''].join(' ')}
          style={{ background: cfg.bg, borderColor: cfg.border }}
        >
          <Icon name={cfg.icon} size={14} color={cfg.color} />
        </span>
        {!isLast && <span className={styles.tlConnectorBottom} />}
      </div>

      <div className={[styles.tlBody, isFirst ? styles.tlBodyFirst : '', isLast ? styles.tlBodyLast : ''].join(' ')}>
        <div className={styles.tlMeta}>{meta}</div>
        <div className={styles.tlHeadlineRow}>
          <span className={styles.tlHeadline}>{item.headline}</span>
          {/* Details toggle — skipped for accept (uses Undo All) and comment
              (the comment body renders inline directly below the headline). */}
          {item.details && item.t !== 'accept' && item.t !== 'comment' && (
            <button
              type="button"
              className={styles.tlDetailsToggle}
              onClick={() => setExpanded(v => !v)}
            >
              <span className={styles.tlDot}>•</span>
              <span>Details</span>
              <Icon
                name={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                size={10}
                color="var(--neutral-300)"
              />
            </button>
          )}
        </div>

        {/* Inline comment body — replaces the Details/expand-card path for
            comment entries. Plain neutral-300 paragraph under the headline. */}
        {item.t === 'comment' && item.details?.[0]?.note && (
          <div className={styles.tlCommentBody}>{item.details[0].note}</div>
        )}

        {/* Status transition (from → to) pills */}
        {(item.t === 'status_dos' || item.t === 'status_hcc' || item.t === 'status_role') && item.from && item.to && (
          <div className={styles.tlTransition}>
            <span className={[styles.tlPill, styles[TRANS_BADGE[item.from] || 'pillOpen']].join(' ')}>
              {item.from}
            </span>
            <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
            <span className={[styles.tlPill, styles[TRANS_BADGE[item.to] || 'pillNew']].join(' ')}>
              {item.to}
            </span>
          </div>
        )}

        {/* Outreach tag */}
        {item.tag && (
          <div className={styles.tlTag}>{item.tag}</div>
        )}

        {/* Document attachment card — click anywhere to open the file in
            the Documents preview pane. Users can flip back to Timeline via
            the tab bar at the top of the workspace. */}
        {item.file && (
          <div
            className={styles.tlAttachment}
            role="button"
            tabIndex={0}
            onClick={previewDoc}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); previewDoc(); } }}
            title={`Preview ${item.file}`}
          >
            <span className={styles.tlFileBubble}>
              <Icon name="solar:file-text-linear" size={14} color="var(--neutral-300)" />
            </span>
            <div className={styles.tlFileText}>
              <div className={styles.tlFileName}>{item.file}</div>
              {item.fileType && <div className={styles.tlFileType}>{item.fileType}</div>}
            </div>
            <button
              type="button"
              className={styles.tlFilePreview}
              aria-label="Preview"
              onClick={(e) => { e.stopPropagation(); previewDoc(); }}
            >
              <Icon name="solar:eye-linear" size={14} color="var(--neutral-300)" />
            </button>
          </div>
        )}

        {/* Coder/assignee avatar transition */}
        {item.fromAvatar && item.toAvatar && (
          <div className={styles.tlAvatarTransition}>
            <AvatarPill {...item.fromAvatar} />
            <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
            <AvatarPill {...item.toAvatar} />
          </div>
        )}

        {/* Expanded details — per-ICD card */}
        {expanded && item.details && (
          <div className={styles.tlDetailsCard}>
            {item.details.map((d, i) => (
              <div key={i} className={styles.tlDetailRow}>
                <div className={styles.tlDetailText}>
                  <div className={styles.tlDetailHcc}>{d.hcc}</div>
                  <div className={styles.tlDetailIcd}>{d.icd}</div>
                  {d.reason && <div className={styles.tlDetailReason}>Reason: {d.reason}</div>}
                  {d.note && <div className={styles.tlDetailNote}>Note: {d.note}</div>}
                </div>
                {d.from && d.to && (
                  <div className={styles.tlDetailBadges}>
                    <span className={[styles.tlPill, styles[TRANS_BADGE[d.from] || 'pillNone']].join(' ')}>
                      {d.from}
                    </span>
                    <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
                    <span className={[styles.tlPill, styles[TRANS_BADGE[d.to] || 'pillAccepted']].join(' ')}>
                      {d.to}
                    </span>
                  </div>
                )}
                {!d.from && !d.to && (
                  <span className={[styles.tlPill, styles.pillDeleted].join(' ')}>Deleted</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AvatarPill({ initials, name }) {
  return (
    <span className={styles.avatarPill}>
      <Avatar variant="staff" initials={initials} />
      <span className={styles.avatarName}>{name}</span>
    </span>
  );
}

// ── Comments tab — Figma 1:53466 ─────────────────────────────────────────
// Timeline view (NOT a card list) matching the Activity Log pattern: each
// comment is a row with a chat-icon left rail + connector line, a meta line
// (`date · time · author(role)` + optional Edited badge), and the full body
// text below. Composer is a single-line input — Enter posts.
function CommentsTab({ filters, pendingStatusChange, onConfirmStatusChange, onCancelStatusChange }) {
  // Seed from Supabase (hcc_diag_comments); fall back to the local mock
  // while the DB is empty or unreachable. Local state supports optimistic
  // insert when the composer posts — persistence is a follow-up.
  const dbComments = useAppStore(s => s.hccDiagComments);
  const seed = dbComments.length ? dbComments : COMMENTS_MOCK;
  const [items, setItems] = useState(seed);
  useEffect(() => { setItems(seed); }, [seed]);
  const visibleItems = useMemo(
    () => items.filter(c => recordMatchesFilters(c, filters)),
    [items, filters],
  );
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [confirmDeleteComment, setConfirmDeleteComment] = useState(null);
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const addActivityEntry = useAppStore(s => s.addActivityEntry);
  const addHccDiagComment = useAppStore(s => s.addHccDiagComment);
  const updateHccDiagComment = useAppStore(s => s.updateHccDiagComment);
  const deleteHccDiagComment = useAppStore(s => s.deleteHccDiagComment);
  const logHccActivity = useAppStore(s => s.logHccActivity);
  const diagPanelMemberId = useAppStore(s => s.diagPanelMemberId);
  const hccMembers = useAppStore(s => s.hccMembers);
  const editComment = (id, body) => {
    setItems(prev => prev.map(c => c.id === id ? { ...c, body, edited: true } : c));
    updateHccDiagComment(id, body);
  };
  const removeComment = (id) => {
    setItems(prev => prev.filter(c => c.id !== id));
    deleteHccDiagComment(id);
  };

  const addComment = (body) => {
    if (!body) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
    const hours = now.getHours();
    const time = `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
    // Stamp the entry with the LOGGED-IN role, not a hardcoded 'Coder'.
    const userRole = useAppStore.getState().hccUserRole || 'Coder';
    // Capture the ICD/DOS this comment was dropped against, so the entry can
    // read "You(Coder) • DOS 03/08/2026 • ICD I50.23" in the timeline. ICD
    // comes from the right-panel card selection; DOS defaults to the first
    // DOS on the record (mirrors DiagPanel's currentDos derivation).
    const patient = hccMembers.find(m => m.id === diagPanelMemberId);
    const dos = patient?.dos_list?.[0]?.date || null;
    const icd = activityIcd || null;
    const row = { id: `c${Date.now()}`, author: 'You', role: userRole, date, time, body, icd, dos };
    setItems(prev => [row, ...prev]);
    addHccDiagComment(row);
    addActivityEntry({
      t: 'comment', by: 'You', role: userRole,
      icds: activityIcd ? [activityIcd] : undefined,
      headline: activityIcd ? `Added a Comment for ${activityIcd}` : 'Added a Comment',
      details: [{ note: body }],
    });
    logHccActivity?.({
      eventName: 'icd.comment_added',
      scope:     { patientId: diagPanelMemberId, icd: activityIcd || null, source: 'manual' },
      payload:   { actor: 'You', role: userRole, body, patientName: patient?.name },
    });
  };

  // Bucket comments by "Mon YYYY" header so the timeline can render a
  // collapsible group divider above each month chunk.
  const groups = useMemo(() => groupByMonth(visibleItems), [visibleItems]);

  const toggleGroup = (label) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  // Route the single composer's submit through the right handler: a
  // pending workflow transition takes priority (Coder → Record Requested),
  // otherwise it's a regular comment on the tab.
  const composerSubmit = pendingStatusChange
    ? (body) => onConfirmStatusChange?.(body)
    : addComment;

  return (
    <div className={styles.scroll}>
      <div className={styles.commentComposerWrap}>
        <CommentComposer
          onSubmit={composerSubmit}
          statusChange={pendingStatusChange ? {
            fromStatus: pendingStatusChange.from,
            toStatus: pendingStatusChange.to,
            onCancel: () => onCancelStatusChange?.(),
          } : null}
        />
      </div>
      <div className={styles.timeline}>
        {groups.map((g) => {
          const isCollapsed = collapsed.has(g.label);
          return (
            <div key={g.label}>
              <button
                type="button"
                className={[styles.activityGroup, isCollapsed ? styles.activityGroupCollapsed : ''].join(' ')}
                onClick={() => toggleGroup(g.label)}
                aria-expanded={!isCollapsed}
              >
                <span>{g.label}</span>
                <span className={styles.activityGroupChevron}>
                  <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-400)" />
                </span>
              </button>
              {!isCollapsed && g.items.map((c, i) => (
                <CommentEntry
                  key={c.id}
                  item={c}
                  isFirst={i === 0}
                  isLast={i === g.items.length - 1}
                  onEdit={editComment}
                  onDelete={(id, body) => setConfirmDeleteComment({ id, body })}
                />
              ))}
            </div>
          );
        })}
      </div>
      {confirmDeleteComment && (
        <ConfirmDialog variant="destructive"
          title="Delete comment?"
          description="This comment will be permanently removed. This can't be undone."
          confirmLabel="Delete"
          onCancel={() => setConfirmDeleteComment(null)}
          onConfirm={() => {
            removeComment(confirmDeleteComment.id);
            setConfirmDeleteComment(null);
          }}
        />
      )}
    </div>
  );
}

// Group an items[] of {date} into [{ label: 'Mon YYYY', items: [...] }] in
// descending order (newest first), matching the Activity Log convention.
function groupByMonth(items) {
  const groups = new Map();
  const order = [];
  for (const it of items) {
    const d = parseEntryDate(it.date) || new Date();
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    if (!groups.has(label)) {
      groups.set(label, { label, items: [], _ts: d.getTime() });
      order.push(label);
    }
    groups.get(label).items.push(it);
  }
  return order
    .map(l => groups.get(l))
    .sort((a, b) => b._ts - a._ts);
}

// Render a comment body with @mention tokens wrapped in a badge span. Names
// are matched greedily against the known platformUsers + SYSTEM_USERS fallback
// so full-name mentions (e.g. "@Abhay Pratap Chaudhary") remain intact.
function renderCommentBody(body, users) {
  if (!body) return null;
  const names = (users?.length ? users : []).flatMap(u => u.name ? [u.name] : []);
  // Longest-first so a full-name match wins over a first-name-only prefix.
  const sortedNames = names.slice().sort((a, b) => b.length - a.length);
  if (!sortedNames.length) return body;
  const escaped = sortedNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`@(${escaped.join('|')})`, 'g');
  const nodes = [];
  let lastIdx = 0;
  let key = 0;
  let match;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIdx) nodes.push(body.slice(lastIdx, match.index));
    nodes.push(
      <span key={`m-${key++}`} className={styles.mentionBadge}>@{match[1]}</span>,
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < body.length) nodes.push(body.slice(lastIdx));
  return nodes.length ? nodes : body;
}

function CommentEntry({ item, isFirst, isLast, onEdit, onDelete }) {
  const isMine = item.author === 'You';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body || '');
  useEffect(() => { setDraft(item.body || ''); }, [item.body]);
  const role = normalizeRole(item.role);
  const platformUsers = useAppStore(s => s.platformUsers);
  const usersForMentions = platformUsers?.length ? platformUsers : SYSTEM_USERS;
  const commit = () => {
    const next = draft.trim();
    if (!next || next === item.body) { setEditing(false); return; }
    onEdit?.(item.id, next);
    setEditing(false);
  };
  return (
    <div className={styles.tlRow}>
      <div className={styles.tlRail}>
        {!isFirst && <span className={styles.tlConnectorTop} />}
        <span
          className={styles.tlIcon}
          style={{ background: 'var(--neutral-0)', borderColor: 'var(--neutral-150)' }}
        >
          <Icon name="solar:chat-round-linear" size={14} color="var(--neutral-300)" />
        </span>
        {!isLast && <span className={styles.tlConnectorBottom} />}
      </div>
      <div className={[styles.tlBody, isFirst ? styles.tlBodyFirst : '', isLast ? styles.tlBodyLast : ''].join(' ')}>
        <div className={styles.commentMetaRow}>
          <div className={styles.tlMeta}>
            {item.date} • {item.time} • {item.author}({role})
            {item.dos && <> • DOS {item.dos}</>}
            {item.icd && <> • ICD {item.icd}</>}
            {item.edited && <span className={styles.commentEditedBadge}>Edited</span>}
          </div>
          {isMine && !editing && (
            <div className={styles.commentActions}>
              <button
                type="button"
                className={styles.commentActionBtn}
                aria-label="Edit comment"
                title="Edit"
                onClick={() => setEditing(true)}
              >
                <Icon name="solar:pen-linear" size={13} color="currentColor" />
              </button>
              <button
                type="button"
                className={styles.commentActionBtn}
                aria-label="Delete comment"
                title="Delete"
                onClick={() => onDelete?.(item.id, item.body)}
              >
                <Icon name="solar:trash-bin-2-linear" size={13} color="currentColor" />
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <div className={styles.commentEditor}>
            <input
              autoFocus
              type="text"
              className={styles.commentComposer}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                else if (e.key === 'Escape') { setDraft(item.body || ''); setEditing(false); }
              }}
            />
            <div className={styles.commentEditorActions}>
              <button type="button" className={styles.commentSaveBtn} onClick={commit} disabled={!draft.trim() || draft.trim() === item.body}>Save</button>
              <button type="button" className={styles.commentGhostBtn} onClick={() => { setDraft(item.body || ''); setEditing(false); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {/* Comment attached to a workflow status transition (currently
                Coder → Record Requested). Shows the from/to pills above the
                body so the reason lives next to the change it explains. */}
            {item.statusFrom && item.statusTo && (
              <div className={styles.commentStatusChange}>
                <div className={styles.commentStatusHeader}>Status Changed</div>
                <div className={styles.commentStatusPills}>
                  <span className={[styles.tlPill, styles[TRANS_BADGE[item.statusFrom] || 'pillNew']].join(' ')}>
                    {item.statusFrom}
                  </span>
                  <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
                  <span className={[styles.tlPill, styles[TRANS_BADGE[item.statusTo] || 'pillReturned']].join(' ')}>
                    {item.statusTo}
                  </span>
                </div>
              </div>
            )}
            <div className={styles.commentBody}>{renderCommentBody(item.body, usersForMentions)}</div>
          </>
        )}
      </div>
    </div>
  );
}

// Reusable timeline scaffolding — used by CommentsTab only now. Kept here
// because other tabs may opt in later; harmless if unused.
// eslint-disable-next-line no-unused-vars
function TimelineEntry({ icon, iconColor, iconBg, iconBorder, iconSize = 14, isFirst, isLast, onClick, children }) {
  const rail = (
    <div className={styles.tlRail}>
      {!isFirst && <span className={styles.tlConnectorTop} />}
      <span
        className={styles.tlIcon}
        style={{ background: iconBg || 'var(--neutral-0)', borderColor: iconBorder || 'var(--neutral-150)' }}
      >
        <Icon name={icon} size={iconSize} color={iconColor || 'var(--neutral-300)'} />
      </span>
      {!isLast && <span className={styles.tlConnectorBottom} />}
    </div>
  );
  const bodyCls = [styles.tlBody, isFirst ? styles.tlBodyFirst : '', isLast ? styles.tlBodyLast : ''].join(' ');
  if (onClick) {
    return (
      <button type="button" className={[styles.tlRow, styles.tlRowClickable].join(' ')} onClick={onClick}>
        {rail}
        <div className={bodyCls}>{children}</div>
      </button>
    );
  }
  return (
    <div className={styles.tlRow}>
      {rail}
      <div className={bodyCls}>{children}</div>
    </div>
  );
}

// Wrap a list of items into [{ label: 'Mon YYYY', items, _ts }] sorted DESC by
// the most-recent item, then render each group as a collapsible chevron+items
// block. Caller supplies the row renderer.
// eslint-disable-next-line no-unused-vars
function GroupedTimeline({ items, getDate, renderRow, emptyLabel = 'No entries.' }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const groups = useMemo(() => {
    const map = new Map();
    const order = [];
    for (const it of items) {
      const d = getDate(it) || new Date();
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      if (!map.has(label)) {
        map.set(label, { label, items: [], _ts: d.getTime() });
        order.push(label);
      }
      map.get(label).items.push(it);
    }
    return order.map(l => map.get(l)).sort((a, b) => b._ts - a._ts);
  }, [items, getDate]);

  const toggle = (label) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  if (!items.length) return <Empty label={emptyLabel} />;

  return (
    <div className={styles.timeline}>
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.label);
        return (
          <div key={g.label}>
            <button
              type="button"
              className={[styles.activityGroup, isCollapsed ? styles.activityGroupCollapsed : ''].join(' ')}
              onClick={() => toggle(g.label)}
              aria-expanded={!isCollapsed}
            >
              <span>{g.label}</span>
              <span className={styles.activityGroupChevron}>
                <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-400)" />
              </span>
            </button>
            {!isCollapsed && g.items.map((it, i) =>
              renderRow(it, i === 0, i === g.items.length - 1)
            )}
          </div>
        );
      })}
    </div>
  );
}

// Trailing toolbar action — toggles the inline uploader widget that
// renders above the documents table (Figma 278:162482). Replaces the old
// "open the UploadChartDrawer" behavior.
function DocumentsTrailingAction() {
  const toggle = useAppStore(s => s.toggleHccDocsUploader);
  const open = useAppStore(s => s.hccDocsUploaderOpen);
  return (
    <button
      type="button"
      className={[styles.filterTrailingBtn, open ? styles.filterTrailingBtnActive : ''].join(' ')}
      onClick={toggle}
    >
      <Icon name="solar:upload-minimalistic-linear" size={14} color="var(--primary-300)" />
      Upload
    </button>
  );
}

// ── Documents tab — Figma 1:54865 ────────────────────────────────────────
// 2-column table: "Document Name | Status". Rows: file-type icon + filename
// + (type · date, time · uploadedBy(role)) meta, status Badge, menu-dots.
const DOC_EXT_LABEL = { pdf: 'PDF', doc: 'DOC', docx: 'DOC', img: 'IMG', png: 'IMG', jpg: 'IMG', xls: 'XLS', xlsx: 'XLS', csv: 'CSV' };
const DOC_STATUS_BADGE = {
  passed:  { variant: 'status-completed', label: 'Passed'  },
  pending: { variant: 'status-queued',    label: 'Pending' },
  failed:  { variant: 'status-failed',    label: 'Failed'  },
};

function DocumentsTab({ member, icdScope, charts = [], openDocId, setOpenDocId, filters }) {
  const showToast = useAppStore(s => s.showToast);
  const uploaderOpen = useAppStore(s => s.hccDocsUploaderOpen);
  const removeChartDoc = useAppStore(s => s.removeChartDoc);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name } | null
  // Single source of truth: `charts` is the RECORD's real docs from
  // hcc_added_charts (member-scoped). Both entry points — UploadChartDrawer
  // and the inline DocumentsUploader — write via addChartDoc, so this list
  // covers both. Normalize into the row template's shape.
  const list = useMemo(() => {
    const extFromName = (name = '') => (/\.([a-z0-9]+)$/i.exec(name)?.[1] || '').toLowerCase();
    return charts.map((c) => ({
      id: c.id,
      name: c.n || c.caption || 'Document',
      type: c.t || 'Document',
      date: c.dateAdded || '',
      time: '',
      uploadedBy: (c.addedBy || '').split(' (')[0] || 'System',
      role: /(Support Team|Coder|QA|Compliance)/.exec(c.addedBy || '')?.[1] || '',
      status: (c.status || 'pending').toLowerCase(),
      // Real extension first (uploads carry ext/fname; display names are
      // captions and usually have none); Storage URLs embed the original
      // filename so they type correctly as a last resort.
      ext: c.ext || extFromName(c.fname) || extFromName(c.n || c.caption) || extFromName(c.pdf),
      pdf: c.pdf,
    }));
  }, [charts]);
  // If a doc gets removed while open, drop back to the listing.
  useEffect(() => {
    if (openDocId && !list.some(d => d.id === openDocId)) setOpenDocId(null);
  }, [openDocId, list, setOpenDocId]);
  // Clicking an ICD card opens the Documents pane with an icdScope — jump
  // straight into the tabbed viewer on that ICD's first doc. Uses a ref so
  // the effect only fires when the scope TRANSITIONS to a new ICD (a "back"
  // click clears openDocId but leaves icdScope, and shouldn't reopen).
  const lastIcdScopeRef = useRef(null);
  useEffect(() => {
    if (icdScope !== lastIcdScopeRef.current) {
      lastIcdScopeRef.current = icdScope;
      if (icdScope && list.length > 0) setOpenDocId(list[0].id);
    }
  }, [icdScope, list, setOpenDocId]);
  // Overflow scroll — arrow buttons appear when the tab strip can scroll.
  const tabsScrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return undefined;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [openDocId, list.length]);
  const scrollTabs = (dir) => {
    const el = tabsScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  // Browser-tab viewer when a doc is open (Paper 1UHT):
  //   [ ← back ]  [ ‹ ]  [ ✓ Doc A ] [ Doc B ] [ Doc C ] …  [ › ]
  // Every doc renders as a tab; a leading green check on the tab indicates
  // the document has passed review (derived from its worklist status).
  // Arrow buttons flank the strip and become active only when the tabs are
  // overflowing in that direction.
  if (openDocId) {
    const openDoc = list.find(d => d.id === openDocId) || list[0];
    return (
      <div className={styles.docsViewer}>
        <div className={styles.docsViewerTabBar}>
          <button
            type="button"
            className={styles.docsBackBtn}
            aria-label="Back to document list"
            title="Back to document list"
            onClick={() => setOpenDocId(null)}
          >
            <Icon name="solar:arrow-left-linear" size={18} color="currentColor" />
          </button>
          {(canScrollLeft || canScrollRight) && (
            <button
              type="button"
              className={[styles.docsScrollBtn, canScrollLeft ? '' : styles.docsScrollBtnDisabled].filter(Boolean).join(' ')}
              aria-label="Scroll tabs left"
              title="Previous documents"
              disabled={!canScrollLeft}
              onClick={() => scrollTabs(-1)}
            >
              <Icon name="solar:alt-arrow-left-linear" size={14} color="currentColor" />
            </button>
          )}
          <div className={styles.docsBrowserTabs} ref={tabsScrollRef}>
            {list.map((d) => {
              const isOpen = openDoc?.id === d.id;
              const status = (d.status || 'pending').toLowerCase();
              // Reflect the doc-review status on the tab itself so the user
              // sees at a glance which docs passed/failed/are still pending
              // without opening the drawer. Colours match the Fold status
              // legend (success green / error red / neutral for pending).
              // All three variants use `-bold` so the glyphs read as equal
              // weight — mixing bold and linear made the failed icon look
              // heavier than the passed one at the same pixel size.
              const statusIcon = status === 'passed'
                ? { name: 'solar:check-circle-bold',  color: 'var(--status-success)', label: 'Passed' }
                : status === 'failed'
                  ? { name: 'solar:close-circle-bold', color: 'var(--status-error)',  label: 'Failed' }
                  : { name: 'solar:clock-circle-bold', color: 'var(--neutral-300)',   label: 'Pending' };
              // Tab shell is a role=button div so we can nest a real anchor
              // (the "open in new browser tab" arrow) without triggering the
              // HTML "button inside button" invariant, which crashes Radix's
              // focus-trap when a modal opens over the drawer.
              return (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  className={[styles.docsBrowserTab, isOpen ? styles.docsBrowserTabActive : ''].filter(Boolean).join(' ')}
                  onClick={() => setOpenDocId(d.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenDocId(d.id); } }}
                  title={`${d.name} — ${statusIcon.label}`}
                >
                  <span className={styles.docsBrowserTabStatus} aria-hidden="true">
                    <Icon name={statusIcon.name} size={14} color={statusIcon.color} />
                  </span>
                  <span className={styles.docsBrowserTabName}>{d.name}</span>
                  {d.pdf && (
                    <a
                      href={d.pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.docsTabExternalLink}
                      aria-label={`Open ${d.name} in a new tab`}
                      title="Open in new browser tab"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Icon name="solar:square-top-down-linear" size={12} color="currentColor" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          {(canScrollLeft || canScrollRight) && (
            <button
              type="button"
              className={[styles.docsScrollBtn, canScrollRight ? '' : styles.docsScrollBtnDisabled].filter(Boolean).join(' ')}
              aria-label="Scroll tabs right"
              title="More documents"
              disabled={!canScrollRight}
              onClick={() => scrollTabs(1)}
            >
              <Icon name="solar:alt-arrow-right-linear" size={14} color="currentColor" />
            </button>
          )}
        </div>
        <div className={styles.docsViewerBody}>
          {/* Pass icdScope AND the currently-open doc so each tab renders
              its own file — uploaded docs open their real PDF/image URL;
              system-seeded defaults get a per-doc synthesized note tagged
              with the doc's name and type. */}
          <DocEvidenceViewer member={member} icdScope={icdScope} openDoc={openDoc} />
        </div>
      </div>
    );
  }

  // Applied only to the LISTING view — the doc-viewer tab strip and the
  // icd-scope auto-open logic still operate on the full list so opening a
  // doc from an ICD card doesn't depend on the filter state.
  const visibleList = list.filter(d => recordMatchesFilters(d, filters));

  return (
    <div className={styles.scroll}>
      {uploaderOpen && <DocumentsUploader />}
      <div className={styles.dataTable}>
        <div className={[styles.dataTableHead, styles.docsGrid].join(' ')}>
          <span>Document Name</span>
          <span>Status</span>
          <span />
        </div>
        {visibleList.map((d) => {
          const status = DOC_STATUS_BADGE[d.status] || DOC_STATUS_BADGE.pending;
          return (
            <div
              key={d.id}
              className={[styles.dataTableRow, styles.docsGrid, styles.dataTableRowClickable].join(' ')}
              role="button"
              tabIndex={0}
              onClick={() => setOpenDocId(d.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenDocId(d.id); } }}
            >
              <div className={styles.docCell}>
                <span className={styles.docThumb}>
                  <Icon name="custom:pdf-file" size={20} color="var(--neutral-400)" />
                </span>
                <div className={styles.docCellText}>
                  <div className={styles.docCellName}>{d.name}</div>
                  <div className={styles.docCellMeta}>
                    {[d.type, d.date, d.role ? `${d.uploadedBy} (${d.role})` : d.uploadedBy].filter(Boolean).join(' • ')}
                  </div>
                </div>
              </div>
              <Badge size="M" variant={status.variant} label={status.label} />
              <div className={styles.dataTableActions} onClick={(e) => e.stopPropagation()}>
                <ActionButton
                  icon="solar:trash-bin-trash-linear"
                  size="S"
                  tooltip="Delete document"
                  onClick={() => setConfirmDelete({ id: d.id, name: d.name })}
                />
              </div>
            </div>
          );
        })}
      </div>
      {confirmDelete && (
        <ConfirmDialog variant="destructive"
          title="Delete document?"
          description={`"${confirmDelete.name}" will be removed from this record. This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            removeChartDoc(member.id, confirmDelete.id);
            if (openDocId === confirmDelete.id) setOpenDocId(null);
            showToast(`Removed ${confirmDelete.name}`);
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}

// ── Inline document uploader widget — Figma 278:162482 ───────────────────
// Three-phase flow:
//   • empty    → dashed drop-zone with "Choose file"
//   • uploading → file row with name + size + green progress bar + X cancel
//   • ready    → file row with refresh/X + Caption (pre-filled with the file
//                name) + Document Category / Document Status dropdowns
//                + Upload/Cancel buttons
// On Upload: appends the doc (with the chosen Pass/Fail status) to the
// listing and logs to the Activity Log (ICD scope → both ICD & DOS-level
// logs; no scope → DOS-only).
const DOC_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.csv,.xls,.xlsx';
const DOC_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DOC_CATEGORIES = ['Discharge Summary', 'Consult Note', 'Lab Report', 'Imaging', 'Chart', 'Physical Therapy'];
// Dropdown labels → stored doc.status values ('Passed' | 'Failed').
const DOC_STATUSES = [
  { label: 'Pass', value: 'Passed' },
  { label: 'Fail', value: 'Failed' },
];

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extFromName(name = '') {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] || '').toLowerCase();
}

function DocumentsUploader() {
  const close = useAppStore(s => s.closeHccDocsUploader);
  const showToast = useAppStore(s => s.showToast);
  const addActivityEntry = useAppStore(s => s.addActivityEntry);
  const addChartDoc = useAppStore(s => s.addChartDoc);
  const logHccActivity = useAppStore(s => s.logHccActivity);
  const diagPanelMemberId = useAppStore(s => s.diagPanelMemberId);
  const hccMembers = useAppStore(s => s.hccMembers);
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const inputRef = useRef(null);

  // empty | uploading | ready
  const [phase, setPhase] = useState('empty');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [docStatus, setDocStatus] = useState(DOC_STATUSES[0].value);
  const [category, setCategory] = useState(DOC_CATEGORIES[0]);
  const [caption, setCaption] = useState('');

  // Simulated upload — progress 0→100 in ~1.2s, then phase='ready'.
  useEffect(() => {
    if (phase !== 'uploading') return undefined;
    let p = 0;
    let readyTimer = null;
    const id = setInterval(() => {
      p += 8 + Math.random() * 14;
      if (p >= 100) {
        setProgress(100);
        clearInterval(id);
        readyTimer = setTimeout(() => setPhase('ready'), 120);
      } else {
        setProgress(p);
      }
    }, 80);
    return () => { clearInterval(id); clearTimeout(readyTimer); };
  }, [phase]);

  const reset = () => {
    setFile(null); setProgress(0); setError(''); setCaption('');
    setDocStatus(DOC_STATUSES[0].value); setCategory(DOC_CATEGORIES[0]);
    setPhase('empty');
  };
  const startUpload = (f) => {
    if (!f) return;
    if (f.size > DOC_MAX_BYTES) { setError('File exceeds 5 MB.'); return; }
    // Pre-fill the caption with the file name — but never clobber a caption
    // the user already typed (swapping files updates an auto-filled one).
    setCaption(prev => (!prev.trim() || prev === file?.name) ? f.name : prev);
    setError(''); setFile(f); setProgress(0); setPhase('uploading');
  };
  const pick = () => inputRef.current?.click();
  const onPicked = (e) => { startUpload(e.target.files?.[0]); e.target.value = ''; };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); startUpload(e.dataTransfer.files?.[0]); };

  const canSubmit = phase === 'ready' && file && caption.trim();
  const canSubmitAndMember = canSubmit && diagPanelMemberId;
  const onSubmit = () => {
    if (!canSubmitAndMember) return;
    const patient = hccMembers.find(m => m.id === diagPanelMemberId);
    if (!patient) return;
    // Route through the same store action UploadChartDrawer uses so a doc
    // uploaded here is member-scoped, persists to hcc_added_charts, and
    // surfaces on BOTH the worklist row's Documents column and this tab
    // (they read the same chart list).
    const doc = makeUploadedChartDoc(patient, {
      file,
      caption: caption.trim(),
      docType: category,
      status: docStatus,
    });
    addChartDoc(diagPanelMemberId, doc, file);
    const userRole = useAppStore.getState().hccUserRole || 'Coder';
    addActivityEntry({
      t: 'upload', by: 'You', role: userRole,
      icds: activityIcd ? [activityIcd] : undefined,
      headline: activityIcd
        ? `Document Uploaded for ${activityIcd}`
        : 'Document Uploaded',
      file: doc.n,
      fileType: category,
    });
    logHccActivity?.({
      eventName: 'document.uploaded_for_icd',
      scope:     { patientId: diagPanelMemberId, icd: activityIcd || null, source: 'manual' },
      payload:   {
        actor: 'You',
        role: userRole,
        fileName: doc.n,
        fileType: category,
        patientName: patient?.name,
      },
    });
    showToast(`Uploaded ${doc.n} — marked ${docStatus}.`);
    reset(); close();
  };
  const onCancel = () => { reset(); close(); };

  // Hidden file input (always mounted so picker works across phases).
  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={DOC_ACCEPT}
      className={styles.docDropInput}
      onChange={onPicked}
    />
  );

  return (
    <div className={styles.docUploader}>
      <div className={styles.docUploaderHeader}>Upload Document</div>
      {hiddenInput}

      {phase === 'empty' && (
        <>
          <label
            className={[styles.docDropZone, drag ? styles.docDropZoneActive : ''].join(' ')}
            onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={pick}
          >
            <Icon name="solar:upload-minimalistic-linear" size={20} color="var(--neutral-300)" />
            <span className={styles.docDropText}>
              Drag and drop file here or{' '}
              <button type="button" className={styles.docDropChoose} onClick={(e) => { e.stopPropagation(); pick(); }}>
                Choose file
              </button>
            </span>
          </label>
          <div className={styles.docUploaderMeta}>
            <span>Supported formats: PDF, DOC, DOCX, PNG, JPG, CSV, XLS, XLSX</span>
            <span>Max size: 5 MB</span>
          </div>
        </>
      )}

      {(phase === 'uploading' || phase === 'ready') && (
        <DocUploaderFileRow
          file={file}
          phase={phase}
          progress={progress}
          onRefresh={() => { setProgress(0); setPhase('uploading'); }}
          onRemove={reset}
        />
      )}

      {phase === 'ready' && (
        <div className={styles.docUploaderForm}>
          <label className={styles.docUploaderField}>
            <span className={styles.docUploaderFieldLabel}>
              Caption <span className={styles.docUploaderRequired}>•</span>
            </span>
            <input
              type="text"
              className={styles.docUploaderInput}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="HCC80 Evidence Document"
            />
          </label>
          <div className={styles.docUploaderFormRow}>
            <label className={styles.docUploaderField}>
              <span className={styles.docUploaderFieldLabel}>Document Category</span>
              <select
                className={styles.docUploaderSelect}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {DOC_CATEGORIES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className={styles.docUploaderField}>
              <span className={styles.docUploaderFieldLabel}>Document Status</span>
              <select
                className={styles.docUploaderSelect}
                value={docStatus}
                onChange={(e) => setDocStatus(e.target.value)}
              >
                {DOC_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {error && <div className={styles.docUploaderError}>{error}</div>}

      <div className={styles.docUploaderActions}>
        <Button
          variant="primary"
          size="S"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          Upload
        </Button>
        <Button variant="secondary" size="S" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// File-row sub-component used in both 'uploading' (with progress bar + X) and
// 'ready' (with refresh + X) phases.
function DocUploaderFileRow({ file, phase, progress, onRefresh, onRemove }) {
  if (!file) return null;
  const ext = (extFromName(file.name) || 'doc').toUpperCase().slice(0, 4);
  return (
    <div className={styles.docFileRowWrap}>
      <div className={styles.docFileRow}>
        <span className={styles.docExtIcon}>
          <Icon name="solar:file-text-linear" size={14} color="var(--neutral-300)" />
          <span className={styles.docExtTag}>{ext === 'JPG' || ext === 'PNG' ? 'IMG' : ext}</span>
        </span>
        <div className={styles.docFileRowText}>
          <div className={styles.docFileRowName}>{file.name}</div>
          <div className={styles.docFileRowSize}>{formatBytes(file.size)}</div>
        </div>
        <div className={styles.docFileRowActions}>
          {phase === 'ready' && (
            <button type="button" className={styles.docFileRowIconBtn} onClick={onRefresh} aria-label="Re-upload">
              <Icon name="solar:refresh-circle-linear" size={16} color="var(--neutral-300)" />
            </button>
          )}
          <span className={styles.docFileRowDivider} />
          <CloseButton size={14} onClick={onRemove} className={styles.docFileRowIconBtn} label="Remove" />
        </div>
      </div>
      {phase === 'uploading' && (
        <div className={styles.docFileProgressTrack}>
          <div className={styles.docFileProgressBar} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

// ── Notes tab — Figma 41:358849 ──────────────────────────────────────────
// Timeline with note icon. Single-line "Add a note" composer.
function NotesTab({ filters }) {
  const dbNotes = useAppStore(s => s.hccDiagNotes);
  const seed = dbNotes.length ? dbNotes : NOTES_MOCK;
  const [items, setItems] = useState(seed);
  useEffect(() => { setItems(seed); }, [seed]);
  const visibleItems = useMemo(
    () => items.filter(n => recordMatchesFilters(n, filters)),
    [items, filters],
  );
  const showToast = useAppStore(s => s.showToast);

  return (
    <div className={styles.scroll}>
      <div className={styles.dataTable}>
        <div className={[styles.dataTableHead, styles.notesGrid].join(' ')}>
          <span>Note Title</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {visibleItems.map((n) => (
          <div key={n.id} className={[styles.dataTableRow, styles.notesGrid].join(' ')}>
            <div className={styles.noteCell}>
              <div className={styles.noteCellTime}>{n.date}, {n.time}</div>
              <div className={styles.noteCellTitle}>{n.title || 'Clinical Progress Note'}</div>
              <div className={styles.noteCellMeta}>
                {n.signed ? 'Created & Signed by ' : 'Created by '}
                {n.author}({n.role})
              </div>
            </div>
            <Badge size="M"
              variant="status-completed"
              icon="solar:pen-new-square-linear"
              label={n.signed ? 'Signed' : 'Draft'}
            />
            <div className={styles.dataTableActions}>
              <ActionButton
                icon="solar:eye-linear"
                size="S"
                tooltip="Preview"
                onClick={() => showToast('Preview — coming soon')}
              />
              <span className={styles.dataTableActionsDivider} />
              <ActionButton
                icon="solar:menu-dots-linear"
                size="S"
                tooltip="More"
                onClick={() => showToast('Note actions — coming soon')}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Claims tab — Figma 41:364778 ─────────────────────────────────────────
// 4-col table: "Claim ID | DOS | Status | Amount". Claim ID is a primary
// button — clicking dispatches openHccClaimPreview to open the existing
// ClaimPreviewDrawer.
const CLAIM_STATUS_BADGE = {
  Paid:     'status-completed',
  Pending:  'status-queued',
  Billed:   'status-scheduled',
  Denied:   'status-failed',
  Rejected: 'status-failed',
};

// Find the claim for a given DOS, or synthesize one when the DOS has no row in
// the mock CLAIMS list (claim-sourced DOSs on the worklist don't all live in
// the small fixture). The synthesized claim carries a deterministic number so
// re-opening the same DOS is stable.
function claimForDos(dos) {
  const match = CLAIMS.find((c) => c.dos === dos);
  if (match) return match;
  return {
    id: `syn-${dos}`,
    number: `CLM-${(dos || '').replace(/\D/g, '')}`,
    dos,
    amount: '—',
    status: 'Billed',
    date: dos,
  };
}

function ClaimsTab({ member, filters, claims }) {
  // Clicking a claim opens its detail IN THIS SAME panel (Figma 10891:325889)
  // with a back arrow — no separate overlapping drawer.
  const [selected, setSelected] = useState(null);
  // A DOS row's "Claim" link sets diagClaimDos; consume it once (clearing the
  // flag) so the detail auto-opens and re-clicking the same DOS re-triggers.
  const claimDos = useAppStore((s) => s.diagClaimDos);
  const clearDiagClaimDos = useAppStore((s) => s.clearDiagClaimDos);
  useEffect(() => {
    if (claimDos) {
      setSelected(claimForDos(claimDos));
      clearDiagClaimDos();
    }
  }, [claimDos, clearDiagClaimDos]);
  const visibleClaims = useMemo(
    () => (claims || []).filter(c => recordMatchesFilters(c, filters)),
    [claims, filters],
  );

  if (selected) {
    return <ClaimDetail member={member} claim={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className={styles.scroll}>
      <div className={styles.dataTable}>
        <div className={[styles.dataTableHead, styles.claimsGrid].join(' ')}>
          <span>Claim ID</span>
          <span>DOS</span>
          <span>Status</span>
          <span>Amount</span>
        </div>
        {visibleClaims.map((c) => (
          <div key={c.id} className={[styles.dataTableRow, styles.claimsGrid].join(' ')}>
            <button
              type="button"
              className={styles.claimIdLink}
              onClick={() => setSelected(c)}
            >
              {c.number || c.id}
            </button>
            <span className={styles.claimDate}>{c.dos}</span>
            <Badge size="M" variant={CLAIM_STATUS_BADGE[c.status] || 'toc-new'} label={c.status} />
            <span className={styles.claimAmount}>{c.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Build the inline claim-detail view model from the member + clicked claim.
// Diagnoses reuse the patient's ICD fixture; procedures are a representative
// mock (real claims service will replace this).
function buildClaimDetail(member, claim) {
  const allIcds = getIcdsForMember(member?.name) || [];
  const icds = allIcds.slice(0, 5).map((i) => ({ code: i.code, description: i.desc }));
  const cpts = [
    { cpt: '99285', description: 'Emergency department visit, high severity' },
    { cpt: '93005', description: 'Electrocardiogram, tracing only' },
    { cpt: '80048', description: 'Basic metabolic panel' },
  ];
  return {
    submissionDate: claim.date || '—',
    provider: { name: member?.rp || 'Dr. Katherine Moss', npi: '555555555', speciality: 'Emergency Medicine' },
    cpts,
    icds,
  };
}

// ── Inline claim detail (Figma 10891:325889) ─────────────────────────────
// Header (back + title) · Claim Information · Rendering Provider ·
// CPT Procedure Codes · ICD Codes on Claim.
function ClaimField({ label, value }) {
  return (
    <div className={styles.claimField}>
      <span className={styles.claimFieldLabel}>{label}</span>
      <span className={styles.claimFieldValue}>{value}</span>
    </div>
  );
}

function ClaimDetail({ member, claim, onBack }) {
  const detail = buildClaimDetail(member, claim);
  return (
    <div className={styles.scroll}>
      <div className={styles.claimDetailHead}>
        <button type="button" className={styles.claimBackBtn} onClick={onBack} aria-label="Back to claims">
          <Icon name="solar:arrow-left-linear" size={18} color="var(--neutral-400)" />
        </button>
        <span className={styles.claimDetailTitle}>Claim Details for DOS: {claim.dos}</span>
      </div>

      <section className={styles.claimSection}>
        <div className={styles.claimSectionHead}>
          <span className={styles.claimSectionTitle}>Claim Information</span>
          <Badge size="M" variant={CLAIM_STATUS_BADGE[claim.status] || 'toc-new'} label={claim.status} />
        </div>
        <div className={styles.claimInfoGrid}>
          <ClaimField label="Claims Number" value={claim.number} />
          <ClaimField label="Submission Date" value={detail.submissionDate} />
          <ClaimField label="Date of Service" value={claim.dos} />
        </div>
      </section>

      <section className={styles.claimSection}>
        <div className={styles.claimSectionHead}>
          <span className={styles.claimSectionTitle}>Rendering Provider</span>
        </div>
        <div className={styles.claimInfoGrid}>
          <ClaimField label="Name" value={detail.provider.name} />
          <ClaimField label="NPI" value={detail.provider.npi} />
          <ClaimField label="Speciality" value={detail.provider.speciality} />
        </div>
      </section>

      <section className={styles.claimSection}>
        <div className={styles.claimSectionHead}>
          <span className={styles.claimSectionTitle}>CPT Procedure Codes</span>
        </div>
        <table className={styles.claimCodeTable}>
          <thead>
            <tr><th>CPT Codes</th><th>Description</th></tr>
          </thead>
          <tbody>
            {detail.cpts.map((p) => (
              <tr key={p.cpt}>
                <td className={styles.claimCode}>{p.cpt}</td>
                <td className={styles.claimCodeDesc}>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.claimSection}>
        <div className={styles.claimSectionHead}>
          <span className={styles.claimSectionTitle}>ICD Codes on Claim</span>
        </div>
        <table className={styles.claimCodeTable}>
          <thead>
            <tr><th>ICD Codes</th><th>Description</th></tr>
          </thead>
          <tbody>
            {detail.icds.map((d) => (
              <tr key={d.code}>
                <td className={styles.claimCode}>{d.code}</td>
                <td className={styles.claimCodeDesc}>{d.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ── Outreach tab (DOS-level) ─────────────────────────────────────────────
// Reuses the patient QuickView OutreachTab so the UX is identical. HCC-only
// constraints applied via props:
//   • hideLogForRow + defaultLogFor='hcc-gaps' → log target is locked to HCC.
//   • Type is locked to Call inside OutreachTab whenever isHccGaps.
//   • programs = unique HCC codes the patient has — both associated with the
//     selected DOS (ICDS) AND not-associated-with-DOS (NOT_LINKED).
//   • Called To Number is pre-populated with the patient's PCP.
function OutreachTab({ member }) {
  const { programs, recipient } = useMemo(() => {
    // Unique HCC codes across the member's ICDS (associated with DOS) and
    // NOT_LINKED (not associated). Drop any "HCC Not Linked" placeholder.
    const set = new Set();
    [...getIcdsForMember(member?.name), ...getNotLinkedForMember(member?.name)]
      .forEach(i => {
        if (!i?.hcc || /not\s*linked/i.test(i.hcc)) return;
        // ICDS stores "HCC 18 - Diabetes…"; show just the leading HCC code.
        const m = i.hcc.match(/^HCC\s*\d+/);
        if (m) set.add(m[0].replace(/\s+/g, ' '));
      });
    const programs = [...set].sort();
    // Recipient defaults to the patient's PCP if available.
    const pcp = member?.pcp ? `${member.pcp} (PCP)` : null;
    return { programs, recipient: pcp };
  }, [member?.name, member?.pcp]);

  return (
    <PatientOutreachTab
      programs={programs}
      programsLabel="Select HCC Gaps"
      recipientOptions={recipient ? [recipient] : undefined}
      defaultCalledTo={recipient || undefined}
      defaultLogFor="hcc-gaps"
      hideLogForRow
    />
  );
}

// ── Worklog tab (DOS-level) ──────────────────────────────────────────────
// Table of every ICD on the selected DOS × work done by each role. Support
// handles the document-review step (recorded as "(Support Team)" in the data);
// Coder / QA / Compliance perform the ICD review. Cells show a ✓ + the person +
// date once a role has acted, or "—" while still pending (Figma 4728:151809).
const WORKLOG_ROLES = ['Support', 'Coder', 'QA', 'Compliance'];

// Map the "(Role)" token embedded in a `by` string to a worklog column index.
// Support activity is recorded as "(Support Team)"; every other role matches
// its column label directly.
function roleTokenToIndex(token = '') {
  const t = token.trim();
  if (t === 'Support' || t === 'Support Team') return 0;
  return WORKLOG_ROLES.indexOf(t);
}

// Parse the trailing "(Role)" off an ICD's `by` field → role index, or -1.
// DB-hydrated gaps can carry `by = null` when the row hasn't been touched
// yet, so coerce defensively.
function roleIndexFromBy(by) {
  if (!by || typeof by !== 'string') return -1;
  const m = by.match(/\(([^)]+)\)/);
  return roleTokenToIndex(m?.[1] || '');
}

function nameFromBy(by) {
  if (!by || typeof by !== 'string') return '';
  return by.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// Engine history entries store timestamps as ISO strings; the worklog
// shows them as MM/DD/YYYY to match the mock format used elsewhere.
function formatWorklogDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

// How far through the chain an ICD has progressed. The role that last touched
// it (and every earlier role) is considered done; -1 means a support-only
// touch, so no Coder/Reviewer column is filled yet.
function reachedRole(icd) {
  return roleIndexFromBy(icd.by);
}

function WorklogTab({ member, filters = {} }) {
  // Source of truth = hccDiagnosisGaps (DB-hydrated via DiagPanel's fetch).
  // Each gap carries a canonical `kind` — Associated | Manual | Suspect |
  // Recapture — so bucketing is a straight partition, no reconstruction.
  // Mock is only a fallback for members not yet seeded into Supabase; we
  // dedupe by code + derive kind before bucketing so the mock path can't
  // render the same ICD twice.
  const gapDosActions = useAppStore(s => s.hccGapDosActions) || {};
  const dbGaps = useAppStore(s => s.hccDiagnosisGaps) || [];

  const rows = useMemo(() => {
    // 1. DB path — one row per (member, code) enforced by the unique index.
    if (dbGaps.length > 0) {
      // Suspects only surface once acted on. Associated / Manual always show.
      return dbGaps.filter((g) => {
        const k = g.kind || 'Associated';
        if (k === 'Suspect' || k === 'Recapture') {
          const prefix = `${g.code}|`;
          return Object.keys(gapDosActions).some((key) => key.startsWith(prefix));
        }
        return true;
      });
    }
    // 2. Mock fallback — derive kind, then dedupe. Priority when the same
    //    code appears in both linkedMock and notLinkedMock (independent
    //    generator picks can collide): Manual > Recapture > Suspect > Associated.
    const linkedMock = member?.name ? (getIcdsForMember(member.name) || []) : [];
    const notLinkedMock = member?.name ? (getNotLinkedForMember(member.name) || []) : [];
    const linkedWithKind = linkedMock.map((i) => ({
      ...i,
      kind: i.type === 'Manual'    ? 'Manual'
          : i.type === 'Recapture' ? 'Recapture'
          : i.type === 'Suspect'   ? 'Suspect'
          : 'Associated',
    }));
    const addressedSuspects = notLinkedMock
      .filter((icd) => {
        if (!icd?.code) return false;
        const prefix = `${icd.code}|`;
        return Object.keys(gapDosActions).some((k) => k.startsWith(prefix));
      })
      .map((i) => ({ ...i, kind: i.type === 'Recapture' ? 'Recapture' : 'Suspect' }));
    const PRIORITY = { Manual: 4, Recapture: 3, Suspect: 2, Associated: 1 };
    const byCode = new Map();
    for (const icd of [...linkedWithKind, ...addressedSuspects]) {
      const prev = byCode.get(icd.code);
      if (!prev || PRIORITY[icd.kind] > PRIORITY[prev.kind]) {
        byCode.set(icd.code, icd);
      }
    }
    return Array.from(byCode.values());
  }, [dbGaps, member?.name, gapDosActions]);

  // Filter chips (ICD / HCC / Recorded By / Date) narrow the row set. DOS is
  // a context chip — the fixture isn't partitioned by DOS, so we ignore it.
  const icds = rows.filter((i) => recordMatchesFilters(i, filters));
  // Bucket by the canonical `kind`. Each row lands in exactly one section.
  const manualIcds     = icds.filter((i) => i.kind === 'Manual');
  const suspectIcds    = icds.filter((i) => i.kind === 'Suspect' || i.kind === 'Recapture');
  const associatedIcds = icds.filter((i) => i.kind === 'Associated');

  // Engine state — canonical source for role assignees + timestamps. Reads
  // the DOS assignment for the record's primary DOS so the worklog reflects
  // the same assignments the DiagPanel header shows.
  const hccDosAssignmentsMap = useAppStore(s => s.hccDosAssignments) || {};
  const primaryDos = member?.dos_list?.[0]?.date || member?.dos;
  const dosState = (member?.id && primaryDos)
    ? hccDosAssignmentsMap[dosKey(member.id, primaryDos, member.rp, member.pos)]
    : null;
  const legacyName = {
    Support:    member?.sup,
    Coder:      member?.cdr,
    QA:         member?.r1,
    Compliance: member?.r2,
  };
  const engineByRole = {
    Support:    dosState?.support,
    Coder:      dosState?.coder,
    QA:         dosState?.reviewer,
    Compliance: dosState?.reviewer2,
  };
  const TERMINAL = new Set(['Completed', 'Skipped', 'Rejected', 'Reject']);
  const roleData = {};
  for (const role of WORKLOG_ROLES) {
    const rs = engineByRole[role];
    const status = rs?.status || null;
    const engineDone = status ? TERMINAL.has(status) : false;
    const assignee = rs?.assignee ? (staffById(rs.assignee)?.name || null) : null;
    const historyLast = Array.isArray(rs?.history) && rs.history.length
      ? rs.history[rs.history.length - 1]
      : null;
    const whenIso = historyLast?.at || null;
    const engineWhen = whenIso ? formatWorklogDate(whenIso) : null;
    roleData[role] = {
      done: engineDone,
      name: assignee || legacyName[role] || null,
      when: engineWhen,
    };
  }

  if (!rows.length) {
    return <Empty label="No ICDs recorded for this DOS." />;
  }
  if (!icds.length) {
    return <Empty label="No ICDs match the current filters." />;
  }

  const renderRows = (rows) => rows.map((icd) => {
    // Mock fallback — used only when the engine hasn't recorded that role
    // yet, so pre-seed states still surface a name + date for the ICD's
    // last-known actor.
    const mockActor = roleIndexFromBy(icd.by);
    return (
      <tr key={icd.code} className={styles.wlRow}>
        <td className={styles.wlIcd}>
          <span className={styles.wlCode}>{icd.code}</span>
        </td>
        <td className={styles.wlDescCol}>
          <span className={styles.wlDesc}>{icd.desc}</span>
        </td>
        {WORKLOG_ROLES.map((role, ri) => {
          const info = roleData[role] || {};
          const done = info.done || ri <= mockActor;
          const name = info.name || (ri === mockActor ? nameFromBy(icd.by) : null);
          const when = info.when || (ri === mockActor ? icd.last : null);
          return (
            <td key={role} className={styles.wlCell}>
              {done ? (
                <div className={styles.wlDone}>
                  <span className={styles.wlCheckBadge}>
                    <Icon name="solar:check-read-linear" size={12} color="var(--status-success)" />
                  </span>
                  {(name || when) && (
                    <span className={styles.wlDoneText}>
                      {name && <span className={styles.wlWho}>{name}</span>}
                      {when && <span className={styles.wlWhen}>{when}</span>}
                    </span>
                  )}
                </div>
              ) : (
                <span className={styles.wlPending}>—</span>
              )}
            </td>
          );
        })}
      </tr>
    );
  });

  return (
    <div className={styles.scroll}>
      <div className={styles.wlTableWrap}>
        <table className={styles.wlTable}>
          <thead>
            <tr>
              <th className={styles.wlIcdHead}>ICD Code</th>
              <th className={styles.wlDescHead}>Description</th>
              {WORKLOG_ROLES.map((r) => <th key={r}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {associatedIcds.length > 0 && (
              <>
                <tr className={styles.wlGroupRow}><td colSpan={WORKLOG_ROLES.length + 2}>ICDs associated with DOS</td></tr>
                {renderRows(associatedIcds)}
              </>
            )}
            {manualIcds.length > 0 && (
              <>
                <tr className={styles.wlGroupRow}><td colSpan={WORKLOG_ROLES.length + 2}>Manually Added</td></tr>
                {renderRows(manualIcds)}
              </>
            )}
            {suspectIcds.length > 0 && (
              <>
                <tr className={styles.wlGroupRow}><td colSpan={WORKLOG_ROLES.length + 2}>Suspect &amp; Recaptured</td></tr>
                {renderRows(suspectIcds)}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── History tab — Figma 1:65653 ──────────────────────────────────────────
// 4-col table: "DOS | HCC Code | Claims | ICD Status". Each row is one HCC
// review for a given DOS. icdStatus drives the trailing status pill button:
//   accepted → green check  •  dismissed → red close  •  open → grey dash.
function HistoryTab({ member, filters }) {
  const dbHistory = useAppStore(s => s.hccDiagHistoryEntries);
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const dosActions = useAppStore(s => s.hccGapDosActions);
  // ICD-scoped mode — the user opened History from an ICD card's clock
  // counter. Show one row per DOS the ICD appears on for this member,
  // pulling HCC label from the ICD data and per-DOS status from the drawer's
  // action state (Accept / Dismiss / Open).
  const scopedItems = useMemo(() => {
    if (!activityIcd || !member) return null;
    const icd = getIcdsForMember(member.name).find(i => i.code === activityIcd);
    if (!icd) return [];
    const hccStr  = icd.hcc || '';
    const hccCode = hccStr.match(/HCC\s*\d+/)?.[0] || '';
    const hccName = hccStr.split(' - ')[1] || hccStr.replace(/^HCC\s*\d+\s*-?\s*/, '') || '';
    return (member.dos_list || []).map((d) => {
      const key = `${activityIcd}|${d.date}`;
      const action = dosActions[key];
      const icdStatus =
        action?.action === 'accept'  ? 'accepted'  :
        action?.action === 'dismiss' ? 'dismissed' :
        'open';
      return {
        id: key,
        dos: d.date,
        hccCode,
        hccName,
        reviewedAt: icd.last || d.date,
        by: (icd.by || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || '—',
        role: /\(([^)]+)\)/.exec(icd.by || '')?.[1] || '',
        claims: 1,
        icdStatus,
      };
    });
  }, [activityIcd, member, dosActions]);
  const items = scopedItems ?? (dbHistory.length ? dbHistory : HISTORY_MOCK);
  const visibleItems = useMemo(
    () => items.filter(h => recordMatchesFilters(h, filters)),
    [items, filters],
  );
  return (
    <div className={styles.scroll}>
      <div className={styles.dataTable}>
        <div className={[styles.dataTableHead, styles.historyGrid].join(' ')}>
          <span>DOS</span>
          <span>HCC Code</span>
          <span>Claims</span>
          <span>ICD Status</span>
        </div>
        {visibleItems.map((h) => (
          <div key={h.id} className={[styles.dataTableRow, styles.historyGrid].join(' ')}>
            <span className={styles.historyDos}>{h.dos}</span>
            <div className={styles.historyHcc}>
              <div className={styles.historyHccCode}>
                {h.hccCode} - {h.hccName}
              </div>
              <div className={styles.historyHccMeta}>
                Last Reviewed: {h.reviewedAt} • {h.by} ({h.role})
              </div>
            </div>
            <button type="button" className={styles.historyClaims} title={`${h.claims} claim${h.claims === 1 ? '' : 's'}`}>
              <Icon name="solar:bill-list-linear" size={12} color="var(--primary-300)" />
              {h.claims}
            </button>
            <span className={styles.historyIcdStatus}>
              {h.icdStatus === 'accepted' && (
                <span className={[styles.historyStatusPill, styles.historyStatusAccepted].join(' ')}>
                  <Icon name="solar:check-read-linear" size={14} color="var(--neutral-0)" />
                </span>
              )}
              {h.icdStatus === 'dismissed' && (
                <span className={[styles.historyStatusPill, styles.historyStatusDismissed].join(' ')}>
                  <Icon name="solar:close-circle-linear" size={14} color="var(--neutral-0)" />
                </span>
              )}
              {h.icdStatus !== 'accepted' && h.icdStatus !== 'dismissed' && (
                <span className={styles.historyStatusDash}>—</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Generic placeholder for tabs we haven't wired data for ──────────────
function ComingSoonTab({ label }) {
  return <Empty label={`${label} — coming in Phase 3+`} />;
}

function Empty({ label }) {
  return (
    <div className={styles.empty}>
      <Icon name="solar:gallery-edit-linear" size={28} color="var(--neutral-200)" />
      <p>{label}</p>
    </div>
  );
}
