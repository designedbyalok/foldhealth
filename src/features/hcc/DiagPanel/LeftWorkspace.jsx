import { useState, useMemo, useEffect, useRef, useId, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../components/Icon/DownChevronIcon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { Button } from '../../../components/Button/Button';
import { Badge } from '../../../components/Badge/Badge';
import { Switch } from '../../../components/Switch/Switch';
import { timelineStatusIcon } from '../StatusIcon';
import { recordMentionRoster } from '../recordParticipants';
import { FilterChip as SharedFilterChip } from '../../../components/FilterChip/FilterChip';
import { Tabs } from '../../../components/Tabs/Tabs';
import {
  commentsForMember,
  mentionsUser,
  NOTES as NOTES_MOCK,
  CLAIMS,
  HISTORY as HISTORY_MOCK,
} from '../data/ancillary';
import { getChartDocs, makeUploadedChartDoc } from '../data/chartDocs';
import { VISIT_TYPES } from '../reference/visitTypes';
import { ACTIVITY, getActivityFromDb } from '../data/activity';
import { getIcdsForMember, getNotLinkedForMember } from '../data/icds';
import { dosSourceLetter } from '../dosSource';
import { dosKey } from '../assignment/dosState';
import { staffById } from '../assignment/astranaStaff';
import { normalizeRole } from '../reviewedBy';
import { SYSTEM_USERS } from '../systemUsers';
import { OutreachTab as PatientOutreachTab } from '../../patient/left-panel/tabs/outreach/OutreachTab/OutreachTab';
import { DocEvidenceViewer } from './DocEvidenceViewer';
import { openStoredLink } from '../../../lib/openSafeUrl';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { CommentComposer } from '../../../components/CommentComposer/CommentComposer';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { commentAuthorLabel, currentAuthor, isCommentMine, mentionProfileIds } from './commentAuthor';
import { FailReasonInline, EditDocInline } from '../ChartDetailDrawerParts';
import {
  HistoryTimelineEntry,
  statusTone,
} from '../../../components/HistoryTimeline/HistoryTimeline';
import styles from './LeftWorkspace.module.css';

// Two tab sets depending on scope. Counts flow in per-render since
// Comments / Documents / Notes now come from Supabase (falling back to
// the local mock when the DB is empty).
//   • ICD-level (opened from an ICD code): Figma 1:45936:
//       Activity Log, Notes, Comments, Documents, Claims, History
//   • DOS-level (opened from the toolbar Activity Log icon), Figma 1:48023:
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
// dials in stays applied as they hop between tabs. Outreach is excluded,
// it embeds the patient-facing OutreachTab which has its own toolbar.
const FILTERED_TABS = new Set(['activity', 'notes', 'comments', 'documents', 'claims', 'history', 'worklog']);

/**
 * LeftWorkspace: appears when the DiagPanel expands. Hosts a tab nav across
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
}) {
  // Kick off the org-scoped ancillary fetch once, safe to call repeatedly,
  // the store guards on didFetch. Doing it here means every drawer open
  // primes Comments / Documents / Notes / History without threading a hook
  // through the top-level DiagPanel.
  const fetchHccDiagAncillary = useAppStore(s => s.fetchHccDiagAncillary);
  useEffect(() => { fetchHccDiagAncillary(); }, [fetchHccDiagAncillary]);
  const dbComments = useAppStore(s => s.hccDiagComments);
  const dbNotes    = useAppStore(s => s.hccDiagNotes);
  // Tab-label count must match what the Comments tab renders for this patient.
  const commentsForCount = useMemo(
    () => commentsForMember(dbComments, member?.id),
    [dbComments, member?.id],
  );
  const notesForCount    = dbNotes.length    ? dbNotes    : NOTES_MOCK;
  // Per-member claims: one row per claim-sourced DOS on the record.
  // claimForDos() reuses the CLAIMS fixture when the date matches or
  // synthesizes a stable row otherwise, so the Claims tab count and its
  // table always agree (both derive from the same member.dos_list).
  const memberClaims = useMemo(
    () => {
      const hasDoc = member?.ch != null;
      const claims = [];
      for (const d of member?.dos_list || []) {
        if (dosSourceLetter(d, hasDoc) === 'C') claims.push(claimForDos(d.date));
      }
      return claims;
    },
    [member?.dos_list, member?.ch],
  );
  // History is scoped to a specific ICD, it lists prior reviews of that
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
  // openDocId lives in the store so other surfaces, the DiagPanel Documents
  // toolbar button and DOS-row clicks in IcdDosCard, can jump straight into
  // the preview for a specific doc.
  const openDocId = useAppStore(s => s.diagOpenDocId);
  const setOpenDocId = useAppStore(s => s.setDiagOpenDocId);
  const isPreviewingDoc = active === 'documents' && !!openDocId;
  // Same treatment for the Claims tab, hide the filter row while a
  // specific claim's detail view is on-screen; filters only make sense
  // on the claims listing.
  const openClaimId = useAppStore(s => s.diagOpenClaimId);
  const isPreviewingClaim = active === 'claims' && !!openClaimId;
  // Every filtered tab uses the same 5-chip filter set (DOS / HCC / ICD /
  // Recorded By / Date). Docs tab hides the row while a document is being
  // previewed: filters only make sense on the listing.
  const showFilterRow = FILTERED_TABS.has(active) && !isPreviewingDoc && !isPreviewingClaim;

  // Real chart list for THIS record, same source the worklist Documents
  // column uses, so the tab count matches the column count exactly.
  const addedCharts    = useAppStore(s => s.hccAddedCharts?.[member?.id]);
  const chartStatus    = useAppStore(s => s.hccChartStatus?.[member?.id]);
  const removedCharts  = useAppStore(s => s.hccRemovedCharts?.[member?.id]);
  const charts = useMemo(
    () => (member ? getChartDocs(member, addedCharts || [], chartStatus || {}, removedCharts || []) : []),
    [member, addedCharts, chartStatus, removedCharts],
  );
  // Per-tab count override: 'documents' takes its count from the record's
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
  // Kick off the Activity-Log fetch on first render, didFetch inside
  // the store makes it a one-shot round-trip.
  const fetchHccGapActivity = useAppStore(s => s.fetchHccGapActivity);
  useEffect(() => { fetchHccGapActivity(); }, [fetchHccGapActivity]);
  const activityFromDb = useAppStore(s => s.hccGapActivity);
  // Session activity only lives in memory, so a comment someone else posted
  // (or you posted before a reload) never reached this timeline. Comments
  // are saved, so their "Added a Comment" entries are built from the saved
  // comments; the in-memory copies are dropped to avoid doubles.
  const savedCommentEntries = useMemo(() => {
    if (!dbComments.length) return [];
    return commentsForCount.map(c => ({
      t: 'comment',
      date: c.date,
      time: c.time,
      by: c.author,
      role: c.role,
      dos: c.dos || null,
      icds: c.icd ? [c.icd] : undefined,
      headline: c.icd ? `Added a Comment for ${c.icd}` : 'Added a Comment',
      details: c.body ? [{ note: c.body }] : undefined,
      commentId: c.id,
    }));
  }, [dbComments.length, commentsForCount]);
  const rawActivity = useMemo(() => {
    const mock = getActivityFromDb(activityFromDb, member?.name);
    const live = (liveLog || []).filter(e => !(e.t === 'comment' && /^Added a Comment/.test(e.headline || '')));
    const recent = [...live, ...savedCommentEntries];
    if (!recent.length) return mock;
    // Newest first, with a month header before each month's entries.
    recent.sort((a, b) => entryTimestamp(b) - entryTimestamp(a));
    const monthOf = (e) => (parseEntryDate(e.date) || new Date())
      .toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const out = [];
    let current = null;
    for (const e of recent) {
      const label = monthOf(e);
      if (label !== current) { out.push({ t: 'group', label }); current = label; }
      out.push(e);
    }
    // Skip the demo log's first header when it repeats the last live month.
    const rest = mock[0]?.t === 'group' && mock[0]?.label === current ? mock.slice(1) : mock;
    return [...out, ...rest];
  }, [liveLog, savedCommentEntries, member?.name, activityFromDb]);

  // Filter state, each chip carries an ARRAY (multi-select). Empty = filter
  // inactive (all records match). Nothing is preselected on open, so every
  // chip reads "Label ⌄" until the user narrows the view. The ICD chip is
  // kept in sync with the ICD card the user picked on the right panel
  // (diagActivityIcd): selecting a card populates filters.icd; unchecking it
  // in the chip clears the card selection too.
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const clearDiagActivityIcd = useAppStore(s => s.clearDiagActivityIcd);
  const [filters, setFilters] = useState(() => ({
    dos:  [],
    hcc:  [],
    icd:  activityIcd ? [activityIcd] : [],
    by:   [],
    date: [],
    type: [],
  }));
  const seedRef = useRef(member?.id);
  useEffect(() => {
    if (seedRef.current !== member?.id) {
      seedRef.current = member?.id;
      setFilters({
        dos:  [],
        hcc:  [],
        icd:  activityIcd ? [activityIcd] : [],
        by:   [],
        date: [],
        type: [],
      });
    }
  }, [member?.id, activityIcd]);
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
    // Un-picking the card-selected ICD via the chip should also clear the
    // card selection so the right-panel highlight stays in sync.
    if (key === 'icd' && activityIcd && Array.isArray(value) && !value.includes(activityIcd)) {
      clearDiagActivityIcd?.();
    }
  };
  const clearAllFilters = () => {
    setFilters({ dos: [], hcc: [], icd: [], by: [], date: [], type: [] });
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

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        <ActionButton
          icon="custom:collapse-sidebar"
          size="sm"
          tooltip="Collapse"
          onClick={onClose}
          className={styles.collapseBtn}
        />
        <span className={styles.tabBarDivider} />
        <Tabs
          items={tabs.map((t) => {
            const count = countForTab(t);
            return {
              key: t.key,
              label: typeof count === 'number' ? `${t.label}(${count})` : t.label,
            };
          })}
          value={active}
          onValueChange={onChange}
          embedded
        />
      </div>

      <div className={styles.body}>
        {/* Filter row. DOS-level → DOS/HCC/ICD/Recorded By/Date + Clear All.
            ICD-level → Recorded By/Date. Worklog → DOS only. Per-tab actions
            (Upload, Add Note) sit in the trailing slot to the right of the
            chips, separated by a vertical divider. */}
        {showFilterRow && (
          <FilterRow
            keys={active === 'activity' ? TIMELINE_FILTER_KEYS : active === 'comments' ? COMMENTS_FILTER_KEYS : FILTER_KEYS}
            filters={filters}
            options={filterOptions}
            onChange={setFilter}
            onClearAll={clearAllFilters}
            trailing={
              // Documents tab's Upload lives below the table as a dashed
              // CTA now (matches the "Add Secondary Insurance" pattern),
              // no trailing filter-row button anymore.
              active === 'documents' ? null :
              null
            }
          />
        )}

        {active === 'activity'  && <ActivityTab  member={member} rawEntries={rawActivity} filters={filters} />}
        {active === 'comments'  && (
          <CommentsTab
            member={member}
            filters={filters}
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

// Filter row chip set: the same 5 chips on every tab so a filter the user
// dials in on Timeline stays applied on Documents/Claims/etc.
const FILTER_KEYS = ['dos', 'hcc', 'icd', 'by', 'date'];
// Timeline only: the same chips plus Activity Type.
const TIMELINE_FILTER_KEYS = [...FILTER_KEYS, 'type'];
// Comments aren't filtered by DOS.
const COMMENTS_FILTER_KEYS = FILTER_KEYS.filter(k => k !== 'dos');
const FILTER_LABEL = {
  dos:  'DOS',
  hcc:  'HCC Code',
  icd:  'ICD Code',
  by:   'Recorded By',
  date: 'Date',
  type: 'Activity Type',
};

// Timeline entries carry many internal kinds (entry.t); the Activity Type
// filter groups them into the labels a reviewer thinks in. Order here is the
// order the options appear in the dropdown.
const ACTIVITY_TYPE_GROUPS = [
  ['Comment',        ['comment']],
  ['Clinical Note',  ['clinical_note']],
  ['Document',       ['upload', 'document-upload', 'doc-status', 'icds-merged-via-upload']],
  ['Status Change',  ['status_dos', 'status_hcc', 'status_role', 'status_change']],
  ['Assignment',     ['assign_coder', 'assignee_change']],
  ['ICD Added',      ['create']],
  ['ICD Accepted',   ['accept']],
  ['ICD Dismissed',  ['dismiss']],
  ['Deleted',        ['delete', 'delete_dos']],
  ['Override',       ['override']],
  ['Outreach',       ['outreach']],
  ['System',         ['system']],
];
const ACTIVITY_TYPE_BY_T = Object.fromEntries(
  ACTIVITY_TYPE_GROUPS.flatMap(([label, ts]) => ts.map(t => [t, label])),
);
const ACTIVITY_TYPE_ORDER = [...ACTIVITY_TYPE_GROUPS.map(([label]) => label), 'Other'];
function activityTypeOf(e) {
  return ACTIVITY_TYPE_BY_T[e?.t] || 'Other';
}

// Preset Date-filter ranges, evaluated against entry.date (MM/DD/YYYY).
const DATE_PRESETS = ['Today', 'Last 7 days', 'Last 30 days', 'This month'];

/**
 * Build the dropdown option lists for each filter chip from the activity
 * entries (plus member.dos_list for the DOS filter).
 */
export function computeFilterOptions(entries, member, extras = {}) {
  const dos = new Set((member?.dos_list || []).flatMap(d => d.date ? [d.date] : []));
  const hcc = new Set();
  const icd = new Set();
  const types = new Set();
  const HCC_RE = /HCC\s*\d+/g;
  // Strip a trailing "(Role)" suffix so "You (Coder)" and "You (QA)" collapse
  // to a single "You" option in the Recorded By list.
  const stripRole = (raw) => String(raw || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  for (const e of entries) {
    if (e.t === 'group') continue;
    types.add(activityTypeOf(e));
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
  // either source are excluded: so the dropdown never shows a name that
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
    dos:  [...dos].toSorted(cmp),
    hcc:  [...hcc].toSorted(cmp),
    icd:  [...icd].toSorted(cmp),
    by:   [...byPool].toSorted(cmp),
    date: DATE_PRESETS,
    // Only the types actually present in this timeline.
    type: ACTIVITY_TYPE_ORDER.filter(t => types.has(t)),
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
  if (filters.type?.length && !filters.type.includes(activityTypeOf(e))) return false;
  if (filters.dos?.length && !filters.dos.includes(e.dos)) return false;
  if (filters.by?.length  && !filters.by.includes(e.by))   return false;
  if (filters.icd?.length) {
    const icdSet = Array.isArray(e.icds) ? new Set(e.icds) : null;
    if (!icdSet || !filters.icd.some(c => icdSet.has(c))) return false;
  }
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
 * filter chip only constrains records that CARRY the relevant dimension,
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

export function FilterRow({ filters, options, onChange, onClearAll, trailing, keys = FILTER_KEYS }) {
  const hasAny = keys.some(k => Array.isArray(filters?.[k]) && filters[k].length > 0);
  return (
    <div className={styles.filterRow}>
      <div className={styles.filterChips}>
        {keys.map((k) => (
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
            rendered (per Figma): disabled when no filter is active. */}
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

// ── Activity Log tab: timeline view with connected vertical line ───────
//
// Matches the prototype's TLItem. Each non-group entry has a left rail
// (top connector + icon bubble + bottom connector) so the whole timeline
// reads visually linked. Group rows ("JAN 2026") break the rail and render
// as a section header. The row itself is rendered by the shared
// HistoryTimelineEntry primitive.

export function ActivityTab({ member, rawEntries: rawEntriesProp, filters }) {
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

  // Pre-compute first/last per visual group: needed so the timeline rail
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
  // status_dos / status_hcc / status_role are the only entry types that use
  // the from/to transition slot: the shared entry component reads any
  // truthy pair, so gate the props here to preserve the legacy behavior.
  const isStatusTransition = item.t === 'status_dos' || item.t === 'status_hcc' || item.t === 'status_role';
  const platformUsers = useAppStore(s => s.platformUsers);
  const baseItem = isStatusTransition
    ? item
    : { ...item, from: undefined, to: undefined };
  // Comment text gets the same @mention highlighting as the Comments tab.
  const commentNote = item.t === 'comment' && !item.commentBody ? item.details?.[0]?.note : null;
  const entryItem = commentNote
    ? { ...baseItem, commentBody: renderCommentBody(commentNote, platformUsers?.length ? platformUsers : SYSTEM_USERS) }
    : baseItem;
  return (
    <HistoryTimelineEntry
      item={entryItem}
      isFirst={isFirst}
      isLast={isLast}
      onPreviewFile={item.file ? previewDoc : undefined}
      renderStatusIcon={timelineStatusIcon}
    />
  );
}

// ── Comments tab: Figma 1:53466 ─────────────────────────────────────────
// Timeline view (NOT a card list) matching the Activity Log pattern: each
// comment is a row with a chat-icon left rail + connector line, a meta line
// (`date · time · author(role)` + optional Edited badge), and the full body
// text below. Composer is a single-line input, Enter posts.
export function CommentsTab({ filters, member: memberProp = null, memberOverride = null }) {
  // Scope the timeline to the patient whose DiagPanel we're rendering in.
  const dbComments = useAppStore(s => s.hccDiagComments);
  const diagPanelMemberIdEarly = useAppStore(s => s.diagPanelMemberId);
  const scopeMemberId = memberProp?.id || memberOverride?.id || diagPanelMemberIdEarly || null;
  const seed = useMemo(
    () => commentsForMember(dbComments, scopeMemberId),
    [dbComments, scopeMemberId],
  );
  const [items, setItems] = useState(seed);
  useEffect(() => { setItems(seed); }, [seed]);
  const visibleItems = useMemo(
    // DOS set on another tab mustn't silently narrow comments (no DOS chip here).
    () => items.filter(c => recordMatchesFilters(c, { ...filters, dos: [] })),
    [items, filters],
  );
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const addActivityEntry = useAppStore(s => s.addActivityEntry);
  const addHccDiagComment = useAppStore(s => s.addHccDiagComment);
  const updateHccDiagComment = useAppStore(s => s.updateHccDiagComment);
  const deleteHccDiagComment = useAppStore(s => s.deleteHccDiagComment);
  const logHccActivity = useAppStore(s => s.logHccActivity);
  const diagPanelMemberId = useAppStore(s => s.diagPanelMemberId);
  const hccMembers = useAppStore(s => s.hccMembers);
  // Every system user is listed; only people on this record (current or past
  // assignee, any role) can be @-mentioned, labelled with their role here.
  // Everyone else shows disabled as not part of the record.
  const dosAssignments = useAppStore(s => s.hccDosAssignments);
  const platformUsersForMentions = useAppStore(s => s.platformUsers);
  const mentionUsers = useMemo(() => {
    const recordMember = memberProp || memberOverride || hccMembers.find(m => m.id === scopeMemberId);
    return recordMentionRoster(recordMember, dosAssignments, platformUsersForMentions || []);
  }, [memberProp, memberOverride, hccMembers, scopeMemberId, dosAssignments, platformUsersForMentions]);
  const editComment = (id, body, mentions) => {
    // The edited body's chips are the comment's full mention set; the DB
    // trigger notifies only people who weren't mentioned before.
    const mentionIds = mentionProfileIds(mentions);
    setItems(prev => prev.map(c => c.id === id ? { ...c, body, mentionIds, edited: true } : c));
    updateHccDiagComment(id, body, mentionIds);
  };
  const removeComment = (id) => {
    setItems(prev => prev.filter(c => c.id !== id));
    deleteHccDiagComment(id);
  };

  const addComment = (body, mentions) => {
    if (!body) return;
    // Real identity, never the viewer-relative 'You' (that is computed at
    // render time). The DB trigger re-stamps both from the session anyway.
    const me = useAppStore.getState().currentUserProfile;
    const { author, authorId } = currentAuthor(me);
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
    // `memberOverride` lets callers outside the DiagPanel (e.g. the
    // Support Document Review drawer) scope the comment to their own
    // patient. Without it we fall back to the currently-focused DiagPanel
    // member so in-panel behavior is unchanged.
    const patient = memberOverride
      || hccMembers.find(m => m.id === diagPanelMemberId)
      || null;
    const dos = patient?.dos_list?.[0]?.date || null;
    const icd = activityIcd || null;
    const row = {
      id: `c${Date.now()}`,
      author: author || 'Unknown author',
      authorId,
      role: userRole,
      date, time, body, icd, dos,
      memberId: patient?.id || null,
      patientName: patient?.name || null,
      // Only real profile ids; the DB trigger turns these into notifications
      // for the mentioned people (not for the commenter).
      mentionIds: mentionProfileIds(mentions),
    };
    setItems(prev => [row, ...prev]);
    addHccDiagComment(row);
    addActivityEntry({
      _memberId: patient?.id,
      t: 'comment', by: row.author, role: userRole,
      icds: activityIcd ? [activityIcd] : undefined,
      headline: activityIcd ? `Added a Comment for ${activityIcd}` : 'Added a Comment',
      details: [{ note: body }],
    });
    logHccActivity?.({
      eventName: 'icd.comment_added',
      scope:     { patientId: patient?.id || diagPanelMemberId, icd: activityIcd || null, source: 'manual' },
      payload:   { actor: row.author, role: userRole, body, patientName: patient?.name },
    });
  };

  return (
    <CommentsTimeline
      items={visibleItems}
      mentionUsers={mentionUsers}
      onAdd={addComment}
      onEdit={editComment}
      onDelete={removeComment}
    />
  );
}

/**
 * The Comments timeline: the composer, comments grouped by month (newest
 * first) with an @mentions switch, and edit / delete on your own comments.
 * Data stays with the caller: `items` are the comments to show (`{ id,
 * author, authorId, role, date, time, body, mentionIds?, edited?, icd? }`),
 * and `onAdd(body, mentions)`, `onEdit(id, body, mentions)` and
 * `onDelete(id)` save the changes. Used by the HCC Comments tab and by
 * other drawers that keep comments of their own (Pharmacy Gap Details).
 */
export function CommentsTimeline({ items, mentionUsers, onAdd, onEdit, onDelete }) {
  // "@mentions" switch: narrow to comments that tag the logged-in user.
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const myName = useAppStore(s => s.currentUserProfile?.name);
  const mentionsMe = useCallback((c) => mentionsUser(c.body, myName), [myName]);
  const visibleItems = useMemo(
    () => (mentionsOnly ? items.filter(mentionsMe) : items),
    [items, mentionsOnly, mentionsMe],
  );
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [confirmDeleteComment, setConfirmDeleteComment] = useState(null);
  const editComment = onEdit;
  const removeComment = onDelete;
  const addComment = onAdd;

  // Bucket comments by "Mon YYYY" header so the timeline can render a
  // collapsible group divider above each month chunk.
  const groups = useMemo(() => groupByMonth(visibleItems), [visibleItems]);

  const toggleGroup = (label) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  return (
    <div className={styles.scroll}>
      <div className={styles.commentComposerWrap}>
        <CommentComposer
          users={mentionUsers}
          onSubmit={addComment}
        />
      </div>
      <div className={styles.timeline}>
        {items.length === 0 && (
          <EmptyState icon="solar:chat-round-line-linear" title="No comments added" description="Add a comment above to start the thread." />
        )}
        {/* With no matching comments there's no month header to sit beside,
            so the switch gets its own row (and stays reachable to turn off).
            With no comments at all there's nothing to filter: no row. */}
        {groups.length === 0 && items.length > 0 && (
          <div className={styles.commentsGroupRow}>
            <span className={styles.commentsEmpty}>
              {mentionsOnly ? 'No comments mention you.' : 'No comments yet.'}
            </span>
            <Switch className={styles.mentionsSwitch} labelGap="var(--space-1)" label="@mentions" checked={mentionsOnly} onChange={setMentionsOnly} />
          </div>
        )}
        {groups.map((g, gi) => {
          const isCollapsed = collapsed.has(g.label);
          const header = (
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
          );
          return (
            <div key={g.label}>
              {gi === 0 ? (
                <div className={styles.commentsGroupRow}>
                  {header}
                  <Switch className={styles.mentionsSwitch} labelGap="var(--space-1)" label="@mentions" checked={mentionsOnly} onChange={setMentionsOnly} />
                </div>
              ) : header}
              {!isCollapsed && g.items.map((c, i) => (
                <CommentEntry
                  key={c.id}
                  mentionUsers={mentionUsers}
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
// Date + time of an entry as a sortable number. Handles "1:13 PM" and 24h
// "14:45"; entries with no parseable date sort as "now" (they were just made).
function entryTimestamp(it) {
  const d = parseEntryDate(it.date);
  if (!d) return Date.now();
  const m = String(it.time || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (m) {
    let h = +m[1] % 12;
    if (!m[3]) h = +m[1];
    else if (m[3].toUpperCase() === 'PM') h += 12;
    d.setHours(h, +m[2]);
  }
  return d.getTime();
}

function groupByMonth(items) {
  const groups = new Map();
  const order = [];
  // Newest first inside every month, not just across months.
  const sorted = items.slice().sort((a, b) => entryTimestamp(b) - entryTimestamp(a));
  for (const it of sorted) {
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
  const re = new RegExp(`@(${escaped.join('|')})(?![A-Za-z])`, 'gi');
  const nodes = [];
  let lastIdx = 0;
  let key = 0;
  let match;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIdx) nodes.push(body.slice(lastIdx, match.index));
    nodes.push(
      <span key={`m-${key++}`} className={styles.mention}>{match[1]}</span>,
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < body.length) nodes.push(body.slice(lastIdx));
  return nodes.length ? nodes : body;
}

function CommentEntry({ item, isFirst, isLast, onEdit, onDelete, mentionUsers }) {
  const me = useAppStore(s => s.currentUserProfile);
  const isMine = isCommentMine(item, me);
  const authorLabel = commentAuthorLabel(item, me);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [item.body]);
  const role = normalizeRole(item.role);
  const platformUsers = useAppStore(s => s.platformUsers);
  const usersForMentions = platformUsers?.length ? platformUsers : SYSTEM_USERS;
  const kebabRef = useRef(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  return (
    <div className={styles.tlRow}>
      <div className={styles.tlRail}>
        {isFirst
          ? <span className={styles.tlConnectorTopFirst} />
          : <span className={styles.tlConnectorTop} />}
        <span
          className={styles.tlIcon}
          style={{ background: 'var(--neutral-0)', borderColor: 'var(--neutral-150)' }}
        >
          <Icon name="solar:chat-round-linear" size={14} color="var(--neutral-300)" />
        </span>
        {isLast
          ? <span className={styles.tlConnectorBottomLast} />
          : <span className={styles.tlConnectorBottom} />}
      </div>
      <div className={[styles.tlBody, isFirst ? styles.tlBodyFirst : '', isLast ? styles.tlBodyLast : ''].join(' ')}>
        <div className={styles.commentMetaRow}>
          <div className={styles.tlMeta}>
            {item.date} • {item.time} • {authorLabel} ({role})
            {item.icd && <> • ICD {item.icd}</>}
            {item.edited && <> • <span className={styles.commentEditedBadge}>Edited</span></>}
          </div>
          {isMine && !editing && (
            <div className={[styles.commentActions, menuAnchor ? styles.commentActionsOpen : ''].filter(Boolean).join(' ')}>
              <button
                ref={kebabRef}
                type="button"
                className={styles.commentActionBtn}
                aria-label="Comment actions"
                title="More"
                onClick={() => {
                  const r = kebabRef.current?.getBoundingClientRect();
                  if (r) setMenuAnchor(r);
                }}
              >
                <Icon name="solar:menu-dots-linear" size={14} color="currentColor" />
              </button>
              {menuAnchor && (
                <MenuPopover
                  anchorRect={menuAnchor}
                  width={168}
                  align="right"
                  items={[
                    { key: 'edit',   icon: 'solar:pen-linear', label: 'Edit' },
                    { key: 'delete', icon: 'solar:trash-bin-2-linear', label: 'Delete', danger: true },
                  ]}
                  onClose={() => setMenuAnchor(null)}
                  onSelect={(key) => {
                    setMenuAnchor(null);
                    if (key === 'edit') setEditing(true);
                    else if (key === 'delete') onDelete?.(item.id, item.body);
                  }}
                />
              )}
            </div>
          )}
        </div>
        {editing ? (
          <div className={styles.commentEditor}>
            <CommentComposer
              autoFocus
              users={mentionUsers}
              initialValue={item.body || ''}
              submitLabel="Save"
              cancelLabel="Cancel"
              onSubmit={(text, mentions) => {
                onEdit?.(item.id, text, mentions);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <>
            <div className={styles.commentBody}>{renderCommentBody(item.body, usersForMentions)}</div>
            {/* Comment attached to a workflow status transition (currently
                Coder → Record Requested). The from/to card sits under the
                comment it explains. */}
            {item.statusFrom && item.statusTo && (
              <div className={styles.commentStatusChange}>
                <div className={styles.commentStatusHeader}>Status Changed</div>
                <div className={styles.commentStatusPills}>
                  <Badge size="sm" tone={statusTone(item.statusFrom)} label={item.statusFrom} />
                  <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
                  <Badge size="sm" tone={statusTone(item.statusTo)} label={item.statusTo} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Reusable timeline scaffolding: used by CommentsTab only now. Kept here
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

// Trailing toolbar action: toggles the inline uploader widget that
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

// ── Documents tab: Figma 1:54865 ────────────────────────────────────────
// 2-column table: "Document Name | Status". Rows: file-type icon + filename
// + (type · date, time · uploadedBy(role)) meta, status Badge, menu-dots.
const DOC_EXT_LABEL = { pdf: 'PDF', doc: 'DOC', docx: 'DOC', img: 'IMG', png: 'IMG', jpg: 'IMG', xls: 'XLS', xlsx: 'XLS', csv: 'CSV' };
const DOC_STATUS_BADGE = {
  passed:  { variant: 'success', label: 'Passed'  },
  pending: { variant: 'warning',    label: 'Pending' },
  failed:  { variant: 'danger',    label: 'Failed'  },
};
const EMPTY_CHARTS = [];

function DocumentsTab({ member, icdScope, charts = EMPTY_CHARTS, openDocId, setOpenDocId, filters }) {
  const showToast = useAppStore(s => s.showToast);
  const uploaderOpen = useAppStore(s => s.hccDocsUploaderOpen);
  const toggleUploader = useAppStore(s => s.toggleHccDocsUploader);
  const removeChartDoc = useAppStore(s => s.removeChartDoc);
  const updateChartDocMeta = useAppStore(s => s.updateChartDocMeta);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name } | null
  const [rowMenu, setRowMenu] = useState(null); // { docId, anchorRect } | null
  const [editingDocId, setEditingDocId] = useState(null);
  // Single source of truth: `charts` is the RECORD's real docs from
  // hcc_added_charts (member-scoped). Both entry points, UploadChartDrawer
  // and the inline DocumentsUploader: write via addChartDoc, so this list
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
  // Clicking an ICD card opens the Documents pane with an icdScope, jump
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
  // Overflow scroll: arrow buttons appear when the tab strip can scroll.
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
              <DownChevronIcon size={14} color="currentColor" style={{ transform: 'rotate(90deg)' }} />
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
              // weight: mixing bold and linear made the failed icon look
              // heavier than the passed one at the same pixel size.
              const statusIcon = status === 'passed'
                ? { name: 'solar:check-circle-bold',  color: 'var(--status-success)', label: 'Passed' }
                : status === 'failed'
                  ? { name: 'solar:close-circle-bold', color: 'var(--status-error)',  label: 'Failed' }
                  : { name: 'solar:clock-circle-bold', color: 'var(--neutral-300)',   label: 'Pending' };
              // Each doc is a Badge pill: primary when open, grey otherwise.
              // The filename is the click target and the "open in a new tab"
              // arrow is a sibling anchor, so nothing interactive nests.
              return (
                <Badge
                  key={d.id}
                  size="md"
                  tone={isOpen ? 'primary' : 'neutral'}
                  className={styles.docsTabBadge}
                  label={(
                    <button
                      type="button"
                      className={styles.docsTabBadgeMain}
                      onClick={() => setOpenDocId(d.id)}
                      aria-pressed={isOpen}
                      title={`${d.name}: ${statusIcon.label}`}
                    >
                      <span className={styles.docsTabBadgeStatus} aria-hidden="true">
                        <Icon name={statusIcon.name} size={14} color={statusIcon.color} />
                      </span>
                      <span className={styles.docsTabBadgeName}>{d.name}</span>
                    </button>
                  )}
                  trailingIconElement={d.pdf ? (
                    <a
                      href={d.pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.docsTabExternalLink}
                      aria-label={`Open ${d.name} in a new tab`}
                      title="Open in new browser tab"
                      onClick={(e) => { e.stopPropagation(); openStoredLink(e, d.pdf); }}
                    >
                      <Icon name="solar:square-top-down-linear" size={12} color="currentColor" />
                    </a>
                  ) : null}
                />
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
              <DownChevronIcon size={14} color="currentColor" style={{ transform: 'rotate(-90deg)' }} />
            </button>
          )}
        </div>
        <div className={styles.docsViewerBody}>
          {/* Pass icdScope AND the currently-open doc so each tab renders
              its own file: uploaded docs open their real PDF/image URL;
              system-seeded defaults get a per-doc synthesized note tagged
              with the doc's name and type. */}
          <DocEvidenceViewer member={member} icdScope={icdScope} openDoc={openDoc} />
        </div>
      </div>
    );
  }

  // Applied only to the LISTING view, the doc-viewer tab strip and the
  // icd-scope auto-open logic still operate on the full list so opening a
  // doc from an ICD card doesn't depend on the filter state.
  const visibleList = list.filter(d => recordMatchesFilters(d, filters));

  return (
    <div className={styles.scroll}>
      {uploaderOpen && <DocumentsUploader />}
      {/* Dashed "Upload Document" CTA: the primary way to add a document
          from this tab, matching the "Add Secondary Insurance" pattern
          from EditPatientDrawer. Hides while the inline uploader is open;
          the uploader's own Cancel closes back to this CTA. */}
      {!uploaderOpen && (
        <button
          type="button"
          className={styles.uploadCta}
          onClick={toggleUploader}
        >
          <Icon name="solar:upload-minimalistic-linear" size={16} color="var(--primary-300)" />
          <span>Upload Document</span>
        </button>
      )}
      <div className={styles.dataTable}>
        <div className={[styles.dataTableHead, styles.docsGrid].join(' ')}>
          <span>Document Name</span>
          <span>Status</span>
          <span />
        </div>
        {visibleList.map((d) => {
          const status = DOC_STATUS_BADGE[d.status] || DOC_STATUS_BADGE.pending;
          const isEditing = editingDocId === d.id;
          return (
            <div key={d.id}>
              <div
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
                <Badge size="md" tone={status.variant} label={status.label} />
                <div className={styles.dataTableActions} onClick={(e) => e.stopPropagation()}>
                  <ActionButton
                    icon="solar:menu-dots-linear"
                    size="sm"
                    tooltip="More actions"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setRowMenu(prev => (prev?.docId === d.id ? null : { docId: d.id, anchorRect: r }));
                    }}
                  />
                </div>
              </div>
              {isEditing && (() => {
                const doc = charts.find(c => c.id === d.id);
                return (
                  <EditDocInline
                    doc={doc}
                    onCancel={() => setEditingDocId(null)}
                    onSave={({ caption, docType, visitType }) => {
                      updateChartDocMeta(member.id, d.id, {
                        n: caption,
                        caption,
                        t: docType,
                        vt: visitType || undefined,
                      });
                      showToast(`Updated ${caption}`);
                      setEditingDocId(null);
                    }}
                  />
                );
              })()}
            </div>
          );
        })}
      </div>
      {rowMenu && (() => {
        const doc = charts.find(c => c.id === rowMenu.docId);
        const label = doc?.n || doc?.caption || 'Document';
        return (
          <MenuPopover
            anchorRect={rowMenu.anchorRect}
            width={168}
            align="right"
            items={[
              { key: 'edit',   icon: 'solar:pen-linear', label: 'Edit' },
              { key: 'delete', icon: 'solar:trash-bin-2-linear', label: 'Delete', danger: true },
            ]}
            onClose={() => setRowMenu(null)}
            onSelect={(key) => {
              setRowMenu(null);
              if (key === 'edit') { setEditingDocId(rowMenu.docId); return; }
              if (key === 'delete') setConfirmDelete({ id: rowMenu.docId, name: label });
            }}
          />
        );
      })()}
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

// ── Inline document uploader widget: Figma 278:162482 ───────────────────
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
  const setChartDocStatus = useAppStore(s => s.setChartDocStatus);
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
  // Mandatory now: the reviewer must explicitly pick Pass or Fail before
  // uploading. Starting at null so the pills read as un-selected and the
  // Upload button stays disabled until a decision is recorded.
  const [docStatus, setDocStatus] = useState(null);
  const [failInline, setFailInline] = useState(false);
  const [failDetails, setFailDetails] = useState(null); // { reasons, note } | null
  const [category, setCategory] = useState(DOC_CATEGORIES[0]);
  const [visitType, setVisitType] = useState('');
  const [caption, setCaption] = useState('');

  // Simulated upload: progress 0→100 in ~1.2s, then phase='ready'.
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
    setDocStatus(null); setFailInline(false); setFailDetails(null);
    setCategory(DOC_CATEGORIES[0]);
    setVisitType('');
    setPhase('empty');
  };

  const handlePassClick = () => {
    setFailInline(false);
    setFailDetails(null);
    setDocStatus('Passed');
  };
  const handleFailClick = () => {
    if (docStatus === 'Failed') {
      // Second Fail click toggles the picker without wiping the reasons.
      setFailInline(v => !v);
      return;
    }
    setDocStatus('Failed');
    setFailDetails({ reasons: [], note: '' });
    setFailInline(true);
  };
  const startUpload = (f) => {
    if (!f) return;
    if (f.size > DOC_MAX_BYTES) { setError('File exceeds 5 MB.'); return; }
    // Pre-fill the caption with the file name, but never clobber a caption
    // the user already typed (swapping files updates an auto-filled one).
    setCaption(prev => (!prev.trim() || prev === file?.name) ? f.name : prev);
    setError(''); setFile(f); setProgress(0); setPhase('uploading');
  };
  const fileInputId = useId();
  const pick = () => inputRef.current?.click();
  const onPicked = (e) => { startUpload(e.target.files?.[0]); e.target.value = ''; };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); startUpload(e.dataTransfer.files?.[0]); };

  // Fail path additionally requires at least one reason (and a comment if
  // 'Other' is checked: that's the shared FailReasonInline vocabulary).
  const failReasonsValid = failDetails?.reasons?.length > 0
    && (!failDetails.reasons.includes('Other') || (failDetails.note || '').trim().length > 0);
  const statusValid = docStatus === 'Passed'
    || (docStatus === 'Failed' && failReasonsValid);
  const canSubmit = phase === 'ready' && file && caption.trim() && statusValid;
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
      visitType,
      status: docStatus,
    });
    addChartDoc(diagPanelMemberId, doc, file);
    // Mirror the UploadChartDrawer flow: doc's status also lands in
    // hcc_chart_status with the fail reasons + comment so the doc is fully
    // rehydratable across surfaces (worklist row, ChartDetailDrawer,
    // DiagPanel). addChartDoc alone only persists status inside hcc_added_charts.
    setChartDocStatus(diagPanelMemberId, doc.id, docStatus, {
      failReasons: docStatus === 'Failed' ? (failDetails?.reasons || []) : undefined,
      failNote:    docStatus === 'Failed' ? (failDetails?.note    || '') : undefined,
    });
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
    // Fail path: also log the doc-status event with the reason list so the
    // Timeline surface has the WHY of the failure, matching the shape the
    // ChartDetailDrawer + UploadChartDrawer entries use.
    if (docStatus === 'Failed' && failDetails) {
      const reasonText = (failDetails.reasons || []).join(', ');
      addActivityEntry({
        t: 'doc-status', by: 'You', role: userRole,
        headline: `Marked "${doc.n}" as Failed`,
        details: [{ note: failDetails.note ? `${reasonText}: ${failDetails.note}` : reasonText }],
        docId: doc.id,
      });
    }
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
    showToast(`Uploaded ${doc.n}, marked ${docStatus}.`);
    reset(); close();
  };
  const onCancel = () => { reset(); close(); };

  // Hidden file input (always mounted so picker works across phases).
  const hiddenInput = (
    <input
      id={fileInputId}
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
            htmlFor={fileInputId}
            className={[styles.docDropZone, drag ? styles.docDropZoneActive : ''].join(' ')}
            onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
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
          {/* Category + Visit Type share one row, Visit Type mirrors the
              HCC worklist's Visit Type column so a document uploaded from
              here can be linked back to the same encounter categories the
              DOS rows show. Visit Type is optional. */}
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
              <span className={styles.docUploaderFieldLabel}>Visit Type</span>
              <select
                className={styles.docUploaderSelect}
                value={visitType}
                onChange={(e) => setVisitType(e.target.value)}
              >
                <option value="">Select Visit Type</option>
                {VISIT_TYPES.map(vt => <option key={vt} value={vt}>{vt}</option>)}
              </select>
            </label>
          </div>
          {/* Document Status: required. Pass/Fail pills match the pattern
              from UploadChartDrawer; Fail opens the shared reason picker
              inline (controlled mode, no Confirm/Cancel, the outer Upload
              button saves everything on click). */}
          <div className={styles.docUploaderField}>
            <span className={styles.docUploaderFieldLabel}>
              Document Status <span className={styles.docUploaderRequired}>•</span>
            </span>
            <div className={styles.docStatusRow}>
              <button
                type="button"
                className={[styles.docStatusPill, docStatus === 'Passed' ? styles.docStatusPass : ''].filter(Boolean).join(' ')}
                onClick={handlePassClick}
              >
                Pass
              </button>
              <button
                type="button"
                className={[styles.docStatusPill, docStatus === 'Failed' ? styles.docStatusFail : ''].filter(Boolean).join(' ')}
                onClick={handleFailClick}
              >
                Fail
              </button>
            </div>
          </div>
          {failInline && (
            <div className={styles.docFailInlineWrap}>
              <FailReasonInline
                value={failDetails || { reasons: [], note: '' }}
                onChange={setFailDetails}
                hideActions
              />
            </div>
          )}
        </div>
      )}

      {error && <div className={styles.docUploaderError}>{error}</div>}

      <div className={styles.docUploaderActions}>
        <Button
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          Upload
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
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
          <div className={styles.docFileProgressBar} style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
      )}
    </div>
  );
}

// ── Notes tab: Figma 41:358849 ──────────────────────────────────────────
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
            <Badge size="md"
              tone="success"
              icon="solar:pen-new-square-linear"
              label={n.signed ? 'Signed' : 'Draft'}
            />
            <div className={styles.dataTableActions}>
              <ActionButton
                icon="solar:eye-linear"
                size="sm"
                tooltip="Preview"
                onClick={() => showToast('Preview: coming soon')}
              />
              <span className={styles.dataTableActionsDivider} />
              <ActionButton
                icon="solar:menu-dots-linear"
                size="sm"
                tooltip="More"
                onClick={() => showToast('Note actions: coming soon')}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Claims tab: Figma 41:364778 ─────────────────────────────────────────
// 4-col table: "Claim ID | DOS | Status | Amount". Claim ID is a primary
// button: clicking dispatches openHccClaimPreview to open the existing
// ClaimPreviewDrawer.
const CLAIM_STATUS_BADGE = {
  Paid:     'success',
  Pending:  'warning',
  Billed:   'info',
  Denied:   'danger',
  Rejected: 'danger',
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
    amount: '-',
    status: 'Billed',
    date: dos,
  };
}

function ClaimsTab({ member, filters, claims }) {
  // Clicking a claim opens its detail IN THIS SAME panel (Figma 10891:325889)
  // with a back arrow: no separate overlapping drawer.
  // Seed from `diagClaimDos` synchronously so the drawer's first render already
  // shows the detail view: avoids the list-→-detail flash when a worklist
  // claim DOS opens the panel.
  const [selected, setSelected] = useState(() => {
    const dos = useAppStore.getState().diagClaimDos;
    return dos ? claimForDos(dos) : null;
  });
  // Mirror the preview state to the store so LeftWorkspace can hide the
  // filter row while the detail view is on-screen (parity with Docs).
  const setDiagOpenClaimId = useAppStore(s => s.setDiagOpenClaimId);
  useEffect(() => {
    setDiagOpenClaimId(selected?.id || null);
    return () => setDiagOpenClaimId(null);
  }, [selected, setDiagOpenClaimId]);
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
            <Badge size="md" tone={CLAIM_STATUS_BADGE[c.status] || 'neutral'} label={c.status} />
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
    submissionDate: claim.date || '-',
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
          <Badge size="md" tone={CLAIM_STATUS_BADGE[claim.status] || 'neutral'} label={claim.status} />
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
//   • programs = unique HCC codes the patient has, both associated with the
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
// date once a role has acted, or "-" while still pending (Figma 4728:151809).
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
  // Each gap carries a canonical `kind`, Associated | Manual | Suspect |
  // Recapture: so bucketing is a straight partition, no reconstruction.
  // Mock is only a fallback for members not yet seeded into Supabase; we
  // dedupe by code + derive kind before bucketing so the mock path can't
  // render the same ICD twice.
  const gapDosActions = useAppStore(s => s.hccGapDosActions) || {};
  const dbGaps = useAppStore(s => s.hccDiagnosisGaps) || [];

  const rows = useMemo(() => {
    // 1. DB path: one row per (member, code) enforced by the unique index.
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
    // 2. Mock fallback: derive kind, then dedupe. Priority when the same
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
    const addressedSuspects = [];
    for (const icd of notLinkedMock) {
      if (!icd?.code) continue;
      const prefix = `${icd.code}|`;
      let matched = false;
      for (const k of Object.keys(gapDosActions)) {
        if (k.startsWith(prefix)) { matched = true; break; }
      }
      if (matched) {
        addressedSuspects.push({
          ...icd,
          kind: icd.type === 'Recapture' ? 'Recapture' : 'Suspect',
        });
      }
    }
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
  // a context chip: the fixture isn't partitioned by DOS, so we ignore it.
  const icds = rows.filter((i) => recordMatchesFilters(i, filters));
  // Bucket by the canonical `kind`. Each row lands in exactly one section.
  const manualIcds     = icds.filter((i) => i.kind === 'Manual');
  const suspectIcds    = icds.filter((i) => i.kind === 'Suspect' || i.kind === 'Recapture');
  const associatedIcds = icds.filter((i) => i.kind === 'Associated');

  // Engine state: canonical source for role assignees + timestamps. Reads
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
    // Mock fallback: used only when the engine hasn't recorded that role
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
                <span className={styles.wlPending}>-</span>
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

// ── History tab: Figma 1:65653 ──────────────────────────────────────────
// 4-col table: "DOS | HCC Code | Claims | ICD Status". Each row is one HCC
// review for a given DOS. icdStatus drives the trailing status pill button:
//   accepted → green check  •  dismissed → red close  •  open → grey dash.
function HistoryTab({ member, filters }) {
  const dbHistory = useAppStore(s => s.hccDiagHistoryEntries);
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const dosActions = useAppStore(s => s.hccGapDosActions);
  // ICD-scoped mode: the user opened History from an ICD card's clock
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
      // `hccGapDosActions` stores a plain enum string per key, not an
      // object: the earlier `action?.action` shape read undefined on
      // every row, so ICD Status always fell through to the "-" dash.
      const action = dosActions[key];
      const icdStatus =
        action === 'accepted' ? 'accepted'  :
        action === 'rejected' ? 'dismissed' :
        'open';
      return {
        id: key,
        dos: d.date,
        hccCode,
        hccName,
        reviewedAt: icd.last || d.date,
        by: (icd.by || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || '-',
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
                <span className={styles.historyStatusDash}>-</span>
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
  return <Empty label={`${label}: coming in Phase 3+`} />;
}

function Empty({ label }) {
  return (
    <div className={styles.empty}>
      <Icon name="solar:gallery-edit-linear" size={28} color="var(--neutral-200)" />
      <p>{label}</p>
    </div>
  );
}
