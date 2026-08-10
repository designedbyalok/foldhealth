import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Button } from '../../../components/Button/Button';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { COMMENTS, DOCUMENTS, NOTES, CLAIMS, HISTORY } from '../data/ancillary';
import { ACTIVITY } from '../data/activity';
import { getIcdsForMember, getNotLinkedForMember } from '../data/icds';
import { OutreachTab as PatientOutreachTab } from '../../patient/left-panel/tabs/outreach/OutreachTab/OutreachTab';
import styles from './LeftWorkspace.module.css';

// Two tab sets depending on scope:
//   • ICD-level (opened from an ICD code) — Figma 1:45936:
//       Activity Log, Notes, Comments, Documents, Claims, History
//   • DOS-level (opened from the toolbar Activity Log icon) — Figma 1:48023:
//       Activity Log, Notes, Comments, Documents, Claims, Outreach, Worklog
const ICD_TABS = [
  { key: 'activity',  label: 'Activity Log',  countFor: () => null },
  { key: 'notes',     label: 'Notes',         countFor: () => NOTES.length },
  { key: 'comments',  label: 'Comments',      countFor: () => COMMENTS.length },
  { key: 'documents', label: 'Documents',     countFor: () => DOCUMENTS.length },
  { key: 'claims',    label: 'Claims',        countFor: () => CLAIMS.length },
  { key: 'history',   label: 'History',       countFor: () => null },
];
const DOS_TABS = [
  { key: 'activity',  label: 'Activity Log',  countFor: () => null },
  { key: 'notes',     label: 'Notes',         countFor: () => NOTES.length },
  { key: 'comments',  label: 'Comments',      countFor: () => COMMENTS.length },
  { key: 'documents', label: 'Documents',     countFor: () => DOCUMENTS.length },
  { key: 'claims',    label: 'Claims',        countFor: () => CLAIMS.length },
  { key: 'outreach',  label: 'Outreach',      countFor: () => null },
  { key: 'worklog',   label: 'Worklog',       countFor: () => null },
];

// Tabs that carry the filter row (Activity / Notes / Comments / Documents).
const FILTERED_TABS = new Set(['activity', 'notes', 'comments', 'documents']);

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
export function LeftWorkspace({ active, icdScope = null, onChange, onClose, member, currentDos = null }) {
  const isDosLevel = !icdScope;
  const tabs = isDosLevel ? DOS_TABS : ICD_TABS;
  // Worklog uses a DOS-only filter; the other filtered tabs use the full set.
  const showFilterRow = FILTERED_TABS.has(active) || (isDosLevel && active === 'worklog');

  // Pull the activity entries once at this level so the filter row can compute
  // its dropdown options (DOS / HCC / ICD / Recorded By) from the same source
  // the timeline renders from.
  // Merge live entries (user actions during this session) with the mock log.
  // Live entries land at the top; we re-insert today's group header if the
  // first mock entry isn't already a group divider for today.
  const liveLog = useAppStore(s => s.hccActivityLog[member?.name]);
  const rawActivity = useMemo(() => {
    const mock = ACTIVITY[member?.name] || ACTIVITY._default || [];
    if (!liveLog?.length) return mock;
    const todayLabel = (() => {
      const d = new Date();
      return d.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
    })();
    const header = mock[0]?.t === 'group' && mock[0]?.label === todayLabel
      ? []
      : [{ t: 'group', label: todayLabel }];
    return [...header, ...liveLog, ...mock];
  }, [liveLog, member?.name]);

  // Filter state — DOS is initialized to the currently-viewed DOS from the
  // patient banner so the chip reads "DOS · 07/04/2024" as an indication of
  // which DOS's activity is being shown. Re-sync if the parent flips DOS.
  const [filters, setFilters] = useState({
    dos: currentDos || null, hcc: null, icd: null, by: null, date: null,
  });
  useEffect(() => {
    setFilters(f => f.dos === currentDos ? f : { ...f, dos: currentDos || null });
  }, [currentDos]);

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));
  const clearAllFilters = () => setFilters({ dos: null, hcc: null, icd: null, by: null, date: null });

  // Options derived from the activity entries (plus DOS list from member).
  const filterOptions = useMemo(
    () => computeFilterOptions(rawActivity, member),
    [rawActivity, member],
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar}>
        <ActionButton
          icon="solar:alt-arrow-left-linear"
          size="S"
          tooltip="Collapse"
          onClick={onClose}
          className={styles.collapseBtn}
        />
        <span className={styles.tabBarDivider} />
        <div className={styles.tabRow}>
          {tabs.map((t) => {
            const isActive = active === t.key;
            const count = t.countFor?.();
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
            variant={active === 'worklog' ? 'worklog' : (isDosLevel ? 'dos' : 'icd')}
            filters={filters}
            options={filterOptions}
            onChange={setFilter}
            onClearAll={clearAllFilters}
            trailing={
              active === 'documents' ? <DocumentsTrailingAction member={member} /> :
              active === 'notes'     ? <NotesTrailingAction />                    :
              null
            }
          />
        )}

        {active === 'activity'  && <ActivityTab  member={member} rawEntries={rawActivity} filters={filters} />}
        {active === 'comments'  && <CommentsTab  member={member} />}
        {active === 'documents' && <DocumentsTab member={member} />}
        {active === 'notes'     && <NotesTab     member={member} />}
        {active === 'claims'    && <ClaimsTab    member={member} />}
        {active === 'outreach'  && <OutreachTab  member={member} />}
        {active === 'worklog'   && <WorklogTab   member={member} />}
        {active === 'history'   && <HistoryTab    member={member} />}
      </div>
    </div>
  );
}

// Filter row chip-key sets per variant (Figma 1:45950 / 1:48023):
//   • 'icd'     → Recorded By, Date
//   • 'dos'     → DOS, HCC Code, ICD Code, Recorded By, Date  (+ Clear All)
//   • 'worklog' → DOS only
const FILTER_KEYS = {
  icd:     ['by', 'date'],
  dos:     ['dos', 'hcc', 'icd', 'by', 'date'],
  worklog: ['dos'],
};
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
function computeFilterOptions(entries, member) {
  const dos = new Set((member?.dos_list || []).flatMap(d => d.date ? [d.date] : []));
  const hcc = new Set();
  const icd = new Set();
  const by  = new Set();
  const HCC_RE = /HCC\s*\d+/g;
  for (const e of entries) {
    if (e.t === 'group') continue;
    if (e.dos) dos.add(e.dos);
    if (e.by)  by.add(e.by);
    if (Array.isArray(e.icds)) e.icds.forEach(c => icd.add(c));
    if (typeof e.headline === 'string') {
      // Normalize "HCC18" / "HCC  18" → "HCC 18" so the dropdown isn't duplicated.
      (e.headline.match(HCC_RE) || []).forEach(c => hcc.add(c.replace(/^HCC\s*/, 'HCC ')));
    }
  }
  const cmp = (a, b) => a.localeCompare(b);
  return {
    dos:  [...dos].sort(cmp),
    hcc:  [...hcc].sort(cmp),
    icd:  [...icd].sort(cmp),
    by:   [...by].sort(cmp),
    date: DATE_PRESETS,
  };
}

/**
 * Returns true when an entry should be visible given the current filter set.
 * Each key is independent; a null filter value disables that constraint.
 */
function entryMatchesFilters(e, filters) {
  if (e.t === 'group') return true;
  if (filters.dos && e.dos !== filters.dos) return false;
  if (filters.by  && e.by  !== filters.by)  return false;
  if (filters.icd && !(Array.isArray(e.icds) && e.icds.includes(filters.icd))) return false;
  if (filters.hcc) {
    // Match either "HCC 18" or "HCC18" in the headline.
    const num = filters.hcc.replace(/^HCC\s*/, '');
    const re = new RegExp(`HCC\\s*${num}\\b`);
    if (!(typeof e.headline === 'string' && re.test(e.headline))) return false;
  }
  if (filters.date) {
    const d = parseEntryDate(e.date);
    if (!d || !matchesDatePreset(d, filters.date)) return false;
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

function FilterRow({ variant = 'icd', filters, options, onChange, onClearAll, trailing }) {
  const keys = FILTER_KEYS[variant] || FILTER_KEYS.icd;
  const hasAny = keys.some(k => filters?.[k] != null && filters[k] !== '');
  return (
    <div className={styles.filterRow}>
      <Icon name="solar:filter-linear" size={20} color="var(--neutral-300)" />
      <div className={styles.filterChips}>
        {keys.map((k) => (
          <FilterChip
            key={k}
            label={FILTER_LABEL[k]}
            value={filters?.[k] ?? null}
            options={options?.[k] || []}
            onChange={(v) => onChange?.(k, v)}
          />
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

/**
 * Filter chip with a click-to-open popover. Shows the label alone when
 * nothing is selected, or "Label · value" with a primary tint when selected.
 */
function FilterChip({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const isSelected = value != null && value !== '';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className={styles.filterChipWrap} ref={wrapRef}>
      <button
        type="button"
        className={[styles.filterChip, isSelected ? styles.filterChipSelected : ''].join(' ')}
        onClick={() => setOpen(o => !o)}
      >
        <span>{isSelected ? `${label} · ${value}` : label}</span>
        <Icon
          name="solar:alt-arrow-down-linear"
          size={16}
          color={isSelected ? 'var(--primary-300)' : 'var(--neutral-300)'}
        />
      </button>
      {open && (
        <div className={styles.filterMenu} role="listbox">
          {options.length === 0 ? (
            <div className={styles.filterMenuEmpty}>No options</div>
          ) : (
            options.map((opt) => (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={opt === value}
                className={[styles.filterMenuItem, opt === value ? styles.filterMenuItemActive : ''].join(' ')}
                onClick={() => { onChange?.(opt); setOpen(false); }}
              >
                {opt}
              </button>
            ))
          )}
          {isSelected && (
            <button
              type="button"
              className={styles.filterMenuClear}
              onClick={() => { onChange?.(null); setOpen(false); }}
            >
              Clear
            </button>
          )}
        </div>
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
  // ICD-level scope — when the Activity Log was opened by clicking an ICD
  // code, only show entries that touch that code. null = DOS-level (all).
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const clearIcd = useAppStore(s => s.clearDiagActivityIcd);

  // Track which month groups are collapsed. Empty set = everything expanded.
  // Keyed by the group's label (e.g. "JAN 2026") which is unique per month.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleGroup = (label) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  // Filter by (a) the ICD scope (if opened from a card), and (b) the filter
  // row's chip selections. Keep group headers, then strip any group headers
  // that no longer have any items beneath them.
  const entries = (() => {
    const kept = rawEntries.filter(e => {
      if (e.t === 'group') return true;
      if (activityIcd && !(Array.isArray(e.icds) && e.icds.includes(activityIcd))) return false;
      if (filters && !entryMatchesFilters(e, filters)) return false;
      return true;
    });
    return kept.filter((e, i) => {
      if (e.t !== 'group') return true;
      const next = kept[i + 1];
      return next && next.t !== 'group';
    });
  })();

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
      {/* ICD scope header — shows which ICD is filtered + a clear-to-DOS link. */}
      {activityIcd && (
        <div className={styles.activityScopeBar}>
          <span className={styles.activityScopeChip}>
            <Icon name="solar:document-text-linear" size={12} color="var(--primary-300)" />
            Activity · {activityIcd}
          </span>
          <button type="button" className={styles.activityScopeClear} onClick={clearIcd}>
            <Icon name="solar:close-circle-linear" size={13} color="var(--neutral-300)" />
            <span>Show all DOS activity</span>
          </button>
        </div>
      )}

      {!hasItems ? (
        <Empty label={activityIcd ? `No activity recorded for ${activityIcd}.` : 'No activity recorded yet.'} />
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
            <ActivityEntry key={it.key} item={it.item} isFirst={it.isFirst} isLast={it.isLast} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityEntry({ item, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ACT_ICON[item.t] || ACT_ICON.accept;
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

        {/* Accept entries get an "Undo All" affordance (Figma 278:169610)
            instead of a Details expander — matches the inline review flow. */}
        {item.t === 'accept' && (
          <button type="button" className={styles.tlUndoAll}>
            <Icon name="solar:undo-left-round-linear" size={12} color="var(--primary-300)" />
            <span>Undo All</span>
          </button>
        )}

        {/* Status transition (from → to) pills */}
        {(item.t === 'status_dos' || item.t === 'status_hcc') && item.from && item.to && (
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

        {/* Document attachment card */}
        {item.file && (
          <div className={styles.tlAttachment}>
            <span className={styles.tlFileBubble}>
              <Icon name="solar:file-text-linear" size={14} color="var(--neutral-300)" />
            </span>
            <div className={styles.tlFileText}>
              <div className={styles.tlFileName}>{item.file}</div>
              {item.fileType && <div className={styles.tlFileType}>{item.fileType}</div>}
            </div>
            <button type="button" className={styles.tlFilePreview} aria-label="Preview">
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
      <span className={styles.avatarBubble}>{initials}</span>
      <span className={styles.avatarName}>{name}</span>
    </span>
  );
}

// Two-letter initials from a "First Last" or "F. Last" name. Used by the
// generic Avatar in the Comments / Notes / Documents / History list rows.
const initialsOf = (name = '') =>
  name.split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase();

// ── Comments tab — Figma 1:53466 ─────────────────────────────────────────
// Timeline view (NOT a card list) matching the Activity Log pattern: each
// comment is a row with a chat-icon left rail + connector line, a meta line
// (`date · time · author(role)` + optional Edited badge), and the full body
// text below. Composer is a single-line input — Enter posts.
function CommentsTab() {
  const [items, setItems] = useState(COMMENTS);
  const [draft, setDraft] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const addActivityEntry = useAppStore(s => s.addActivityEntry);

  const addComment = () => {
    const body = draft.trim();
    if (!body) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
    const hours = now.getHours();
    const time = `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
    setItems(prev => [
      { id: `c${Date.now()}`, author: 'You', role: 'Coder', date, time, body },
      ...prev,
    ]);
    addActivityEntry({
      t: 'comment', by: 'You', role: 'Coder',
      icds: activityIcd ? [activityIcd] : undefined,
      headline: activityIcd ? `Added a Comment for ${activityIcd}` : 'Added a Comment',
      details: [{ note: body }],
    });
    setDraft('');
  };

  // Bucket comments by "Mon YYYY" header so the timeline can render a
  // collapsible group divider above each month chunk.
  const groups = useMemo(() => groupByMonth(items), [items]);

  const toggleGroup = (label) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  return (
    <div className={styles.scroll}>
      <input
        type="text"
        className={styles.commentComposer}
        placeholder="Add a comment"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) addComment(); }}
      />
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
                />
              ))}
            </div>
          );
        })}
      </div>
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

function CommentEntry({ item, isFirst, isLast }) {
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
        <div className={styles.tlMeta}>
          {item.date} • {item.time} • {item.author}({item.role})
          {item.edited && <span className={styles.commentEditedBadge}>Edited</span>}
        </div>
        <div className={styles.commentBody}>{item.body}</div>
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

function DocumentsTab() {
  const showToast = useAppStore(s => s.showToast);
  const uploaderOpen = useAppStore(s => s.hccDocsUploaderOpen);
  const uploaded = useAppStore(s => s.hccUploadedDocs);
  const list = useMemo(() => [...uploaded, ...DOCUMENTS], [uploaded]);

  return (
    <div className={styles.scroll}>
      {uploaderOpen && <DocumentsUploader />}
      <div className={styles.dataTable}>
        <div className={[styles.dataTableHead, styles.docsGrid].join(' ')}>
          <span>Document Name</span>
          <span>Status</span>
          <span />
        </div>
        {list.map((d) => {
          const status = DOC_STATUS_BADGE[d.status] || DOC_STATUS_BADGE.pending;
          const extLabel = DOC_EXT_LABEL[d.ext] || d.ext?.toUpperCase() || 'DOC';
          return (
            <div key={d.id} className={[styles.dataTableRow, styles.docsGrid].join(' ')}>
              <div className={styles.docCell}>
                <span className={styles.docExtIcon} data-ext={d.ext}>
                  <Icon name="solar:file-text-linear" size={14} color="var(--neutral-300)" />
                  <span className={styles.docExtTag}>{extLabel}</span>
                </span>
                <div className={styles.docCellText}>
                  <div className={styles.docCellName}>{d.name}</div>
                  <div className={styles.docCellMeta}>
                    {d.type} · {d.date}, {d.time} · {d.uploadedBy}({d.role})
                  </div>
                </div>
              </div>
              <Badge variant={status.variant} label={status.label} />
              <div className={styles.dataTableActions}>
                <ActionButton
                  icon="solar:menu-dots-linear"
                  size="S"
                  tooltip="More"
                  onClick={() => showToast('Document actions — coming soon')}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Inline document uploader widget — Figma 278:162482 ───────────────────
// Three-phase flow:
//   • empty    → dashed drop-zone with "Choose file"
//   • uploading → file row with name + size + green progress bar + X cancel
//   • ready    → file row with refresh/X + Document Type/Category dropdowns
//                + required Caption input + Upload/Cancel buttons
// On Upload: appends a 'pending' doc to the listing and logs to the Activity
// Log (ICD scope → both ICD & DOS-level logs; no scope → DOS-only).
const DOC_ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.csv,.xls,.xlsx';
const DOC_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DOC_TYPES = ['HCC Document', 'Clinical Note', 'Lab Result', 'Imaging', 'Other'];
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
  const recordHccUpload = useAppStore(s => s.recordHccUpload);
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const inputRef = useRef(null);

  // empty | uploading | ready
  const [phase, setPhase] = useState('empty');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [docType, setDocType] = useState(DOC_TYPES[0]);
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
    setDocType(DOC_TYPES[0]); setCategory(DOC_CATEGORIES[0]);
    setPhase('empty');
  };
  const startUpload = (f) => {
    if (!f) return;
    if (f.size > DOC_MAX_BYTES) { setError('File exceeds 5 MB.'); return; }
    setError(''); setFile(f); setProgress(0); setPhase('uploading');
  };
  const pick = () => inputRef.current?.click();
  const onPicked = (e) => { startUpload(e.target.files?.[0]); e.target.value = ''; };
  const onDrop = (e) => { e.preventDefault(); setDrag(false); startUpload(e.dataTransfer.files?.[0]); };

  const canSubmit = phase === 'ready' && file && caption.trim();
  const onSubmit = () => {
    if (!canSubmit) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const ext = extFromName(file.name);
    recordHccUpload({
      id: `du-${Date.now()}`,
      name: caption.trim(),
      ext,
      type: category,
      uploadedBy: 'You',
      role: 'Coder',
      date,
      time,
      status: 'pending',
    });
    addActivityEntry({
      t: 'upload', by: 'You', role: 'Coder',
      icds: activityIcd ? [activityIcd] : undefined,
      headline: activityIcd
        ? `Document Uploaded for ${activityIcd}`
        : 'Document Uploaded',
      file: file.name,
      fileType: category,
    });
    showToast(`Uploaded ${caption.trim()} — pending review.`);
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
          <div className={styles.docUploaderFormRow}>
            <label className={styles.docUploaderField}>
              <span className={styles.docUploaderFieldLabel}>Document Type</span>
              <select
                className={styles.docUploaderSelect}
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
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
          </div>
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
          <button type="button" className={styles.docFileRowIconBtn} onClick={onRemove} aria-label="Remove">
            <Icon name="solar:close-circle-linear" size={14} color="var(--neutral-300)" />
          </button>
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
function NotesTab() {
  const [items, setItems] = useState(NOTES);
  const [draft, setDraft] = useState('');
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  const addActivityEntry = useAppStore(s => s.addActivityEntry);

  const addNote = () => {
    const body = draft.trim();
    if (!body) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
    const hours = now.getHours();
    const time = `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
    setItems(prev => [
      { id: `n${Date.now()}`, author: 'You', role: 'Coder', date, time, body },
      ...prev,
    ]);
    addActivityEntry({
      t: 'create', by: 'You', role: 'Coder',
      icds: activityIcd ? [activityIcd] : undefined,
      headline: activityIcd ? `Added a Note for ${activityIcd}` : 'Added a Note',
      details: [{ note: body }],
    });
    setDraft('');
  };

  // Persist the Add Note panel state at the tab level so the trailing
  // "Add Note" toolbar button can open it (state is shared via a tiny
  // imperative handle on the window — simplest plumbing without a context).
  if (typeof window !== 'undefined') {
    window.__hccOpenAddNote = () => {
      const draftText = draft.trim();
      if (!draftText) return setDraft(' '); // nudge focus / show composer
      addNote();
    };
  }

  return (
    <div className={styles.scroll}>
      <div className={styles.dataTable}>
        <div className={[styles.dataTableHead, styles.notesGrid].join(' ')}>
          <span>Note Title</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {items.map((n) => (
          <div key={n.id} className={[styles.dataTableRow, styles.notesGrid].join(' ')}>
            <div className={styles.noteCell}>
              <div className={styles.noteCellTime}>{n.date}, {n.time}</div>
              <div className={styles.noteCellTitle}>{n.title || 'Clinical Progress Note'}</div>
              <div className={styles.noteCellMeta}>
                {n.signed ? 'Created & Signed by ' : 'Created by '}
                {n.author}({n.role})
              </div>
            </div>
            <Badge
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
      {/* Inline composer — appears below the table; Enter posts. */}
      <input
        type="text"
        className={[styles.commentComposer, styles.notesComposerInline].join(' ')}
        placeholder="Add a clinical note (Enter to post)…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) addNote(); }}
      />
    </div>
  );
}

// Trailing toolbar action for Notes — focuses the inline note composer.
function NotesTrailingAction() {
  return (
    <button
      type="button"
      className={styles.filterTrailingBtn}
      onClick={() => {
        const el = document.querySelector(`.${'notesComposerInline'.replace(/./g, c => c)}`)
          || document.querySelector('input[placeholder^="Add a clinical note"]');
        el?.focus();
      }}
    >
      <Icon name="solar:pen-new-square-linear" size={14} color="var(--primary-300)" />
      Add Note
    </button>
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

function ClaimsTab({ member }) {
  const openClaimPreview = useAppStore(s => s.openHccClaimPreview);

  return (
    <div className={styles.scroll}>
      <div className={styles.dataTable}>
        <div className={[styles.dataTableHead, styles.claimsGrid].join(' ')}>
          <span>Claim ID</span>
          <span>DOS</span>
          <span>Status</span>
          <span>Amount</span>
        </div>
        {CLAIMS.map((c) => (
          <div key={c.id} className={[styles.dataTableRow, styles.claimsGrid].join(' ')}>
            <button
              type="button"
              className={styles.claimIdLink}
              onClick={() => openClaimPreview(member, c.dos)}
            >
              {c.number || c.id}
            </button>
            <span className={styles.claimDate}>{c.dos}</span>
            <Badge variant={CLAIM_STATUS_BADGE[c.status] || 'toc-new'} label={c.status} />
            <span className={styles.claimAmount}>{c.amount}</span>
          </div>
        ))}
      </div>
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
// Table of every ICD on the selected DOS × work done by each Coder / Reviewer
// 1–3 (Support intentionally excluded — Figma 42:368051). Cells show a ✓ + the
// person + date once a role has acted, or "—" while still pending.
const WORKLOG_ROLES = ['Coder', 'Reviewer 1', 'Reviewer 2', 'Reviewer 3'];

// Parse the trailing "(Role)" off an ICD's `by` field → role index, or -1.
function roleIndexFromBy(by = '') {
  const m = by.match(/\(([^)]+)\)/);
  const role = (m?.[1] || '').trim();
  return WORKLOG_ROLES.indexOf(role);
}

function nameFromBy(by = '') {
  return by.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// How far through the chain an ICD has progressed. The role that last touched
// it (and every earlier role) is considered done; -1 means a support-only
// touch, so no Coder/Reviewer column is filled yet.
function reachedRole(icd) {
  return roleIndexFromBy(icd.by);
}

function WorklogTab({ member }) {
  const icds = getIcdsForMember(member?.name);
  const open = icds.filter((i) => i.status !== 'Accepted' && i.status !== 'Dismissed');
  const closed = icds.filter((i) => i.status === 'Accepted' || i.status === 'Dismissed');

  if (!icds.length) {
    return <Empty label="No ICDs recorded for this DOS." />;
  }

  const renderRows = (rows) => rows.map((icd) => {
    const reached = reachedRole(icd);
    const actorIdx = roleIndexFromBy(icd.by);
    return (
      <tr key={icd.code} className={styles.wlRow}>
        <td className={styles.wlIcd}>
          <span className={styles.wlCode}>{icd.code}</span>
          <span className={styles.wlDesc}>{icd.desc}</span>
        </td>
        {WORKLOG_ROLES.map((role, ri) => {
          const done = ri <= reached;
          const isActor = ri === actorIdx;
          return (
            <td key={role} className={styles.wlCell}>
              {done ? (
                <div className={styles.wlDone}>
                  <Icon name="solar:check-read-linear" size={12} color="var(--status-success)" />
                  {isActor && (
                    <>
                      <Avatar
                        variant="generic"
                        size={18}
                        initials={initialsOf(nameFromBy(icd.by))}
                        backgroundColor="var(--primary-50)"
                        borderColor="var(--primary-200)"
                        color="var(--primary-300)"
                      />
                      <span className={styles.wlDoneText}>
                        <span className={styles.wlWho}>{nameFromBy(icd.by)}</span>
                        <span className={styles.wlWhen}>{icd.last}</span>
                      </span>
                    </>
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
              {WORKLOG_ROLES.map((r) => <th key={r}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {open.length > 0 && (
              <>
                <tr className={styles.wlGroupRow}><td colSpan={WORKLOG_ROLES.length + 1}>Open ICDs</td></tr>
                {renderRows(open)}
              </>
            )}
            {closed.length > 0 && (
              <>
                <tr className={styles.wlGroupRow}><td colSpan={WORKLOG_ROLES.length + 1}>Closed ICDs</td></tr>
                {renderRows(closed)}
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
function HistoryTab() {
  return (
    <div className={styles.scroll}>
      <div className={styles.dataTable}>
        <div className={[styles.dataTableHead, styles.historyGrid].join(' ')}>
          <span>DOS</span>
          <span>HCC Code</span>
          <span>Claims</span>
          <span>ICD Status</span>
        </div>
        {HISTORY.map((h) => (
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
