import { useMemo, useState } from 'react';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { ActivityLog } from '../../../../../components/ActivityLog/ActivityLog';
import { Avatar } from '../../../../../components/Avatar/Avatar';
import { FilterBar } from '../../../../worklists/FilterBar';
import { Icon } from '../../../../../components/Icon/Icon';
import { Input } from '../../../../../components/Input/Input';
import { Tabs } from '../../../../../components/Tabs/Tabs';
import { TimelineSkeleton } from '../../../../../components/TimelineSkeleton/TimelineSkeleton';
import { useAppStore } from '../../../../../store/useAppStore';
import { usePatientStream } from '../../../hooks/usePatientStream';
import { STREAM_CATEGORIES, filterStream } from '../../../data/patientStream';
import { TONE_COLOR, kindMeta } from './streamKinds';
import styles from './TimelineTab.module.css';

// The header's quick views (Figma 727:245146). A dotted view keeps the stream
// kinds it lists; the dot is the colour those kinds' tiles use.
const VISIT_KINDS = ['encounter', 'visit', 'in_person', 'ip_visit', 'er_visit', 'appointment', 'adt'];
const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'since', label: 'Since Last Visit' },
  { key: 'visits', label: 'Visits', dot: 'var(--accent-cyan)', kinds: VISIT_KINDS },
  { key: 'notes', label: 'Notes', dot: 'var(--accent-pink)', kinds: ['note'] },
  { key: 'labs', label: 'Labs/Imaging', dot: 'var(--accent-blue)', kinds: ['lab', 'imaging'] },
  { key: 'pami', label: 'PAMI', dot: 'var(--accent-light-green)', kinds: ['diagnosis', 'allergy', 'medication', 'med_start', 'med_stop', 'immunization'] },
  { key: 'procedure', label: 'Procedure', dot: 'var(--accent-amber)', kinds: ['procedure'] },
];
const VIEW_TABS = VIEWS.map(v => ({
  key: v.key,
  label: v.dot ? <><span className={styles.dot} style={{ color: v.dot }} aria-hidden="true">•</span>{v.label}</> : v.label,
}));

/** The events a quick view keeps. Since Last Visit: after the latest visit up to now. */
function inView(events, key) {
  const view = VIEWS.find(v => v.key === key);
  if (view?.kinds) return events.filter(e => view.kinds.includes(e.kind));
  if (key === 'since') {
    const now = Date.now();
    const last = events.filter(e => VISIT_KINDS.includes(e.kind) && e.at <= now).reduce((max, e) => Math.max(max, e.at), -Infinity);
    return Number.isFinite(last) ? events.filter(e => e.at > last) : events;
  }
  return events;
}

const FILTER_DEFS = [
  { key: 'categories', label: 'Category', primary: true },
  { key: 'kinds', label: 'Type', primary: true },
  { key: 'programs', label: 'Program', primary: true },
];

const matches = (e, q) => [e.title, e.detail, e.actor, e.program, kindMeta(e.kind).label]
  .some(v => v && String(v).toLowerCase().includes(q));

const CATEGORY_LABEL = Object.fromEntries(STREAM_CATEGORIES.map(c => [c.value, c.label]));
const CATEGORY_VALUE = Object.fromEntries(STREAM_CATEGORIES.map(c => [c.label, c.value]));
const pad = n => String(n).padStart(2, '0');
const monthLabel = d => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const duration = s => (s >= 60 ? `${Math.floor(s / 60)}m ${pad(s % 60)}s` : `${s}s`);

function KindTile({ kind }) {
  const k = kindMeta(kind);
  return (
    <Avatar
      variant="icon"
      size={24}
      backgroundColor={k.tint}
      borderColor={k.color}
      icon={<Icon name={k.icon} size={14} color={k.color} />}
    />
  );
}

// What "View details" lists: the event's kind and attribution, then its own fields.
function detailsOf(e) {
  return [
    { label: 'Type', value: kindMeta(e.kind).label },
    { label: 'Category', value: CATEGORY_LABEL[e.category] },
    { label: 'Recorded by', value: e.actor ? `${e.actor}${e.actorRole ? ` (${e.actorRole})` : ''}` : null },
    { label: 'Program', value: e.program },
    { label: 'Bills to', value: e.billingProgram && e.billingProgram !== e.program ? e.billingProgram : null },
    { label: 'Duration', value: e.durationSeconds ? duration(e.durationSeconds) : null },
    { label: 'Vendor', value: e.vendor },
    { label: 'Source', value: e.source },
    ...(e.facts || []),
  ];
}

/** Stream events -> ActivityLog entries, newest first, with a header per month. */
function toEntries(events) {
  const out = [];
  let month = null;
  events.forEach((e) => {
    const d = new Date(e.at);
    const label = monthLabel(d);
    if (label !== month) { out.push({ t: 'group', label }); month = label; }
    const hasTime = d.getHours() || d.getMinutes();
    out.push({
      t: 'outreach',
      avatar: <KindTile kind={e.kind} />,
      date: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`,
      time: hasTime ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
      by: e.actor,
      role: e.actorRole,
      context: [e.vendor && `via ${e.vendor}`, e.durationSeconds && duration(e.durationSeconds)].filter(Boolean).join(' · ') || null,
      title: e.title,
      badges: [e.program, e.billingProgram && e.billingProgram !== e.program ? `Bills to ${e.billingProgram}` : null].filter(Boolean),
      outcome: e.outcome || undefined,
      outcomeColor: TONE_COLOR[e.tone],
      details: detailsOf(e),
      note: e.detail || '',
    });
  });
  return out;
}

/**
 * The patient's full timeline: clinical events (labs, ADT, visits,
 * diagnoses, devices, medications, notes, assessments) and touchpoints
 * (calls, messages, visits, appointments) and program updates, newest first,
 * filterable by category, type and program. The Program Activity Log in Care
 * Management stays the per-program timeline.
 */
export function TimelineTab() {
  const patientId = useAppStore(s => s.selectedPatientId);
  const { events, loading } = usePatientStream(patientId);
  const [categories, setCategories] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [view, setView] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Options come from what this patient's stream actually has.
  const kindOptions = useMemo(() => [...new Set(events.map(e => kindMeta(e.kind).label))].sort(), [events]);
  const programOptions = useMemo(() => [...new Set(events.flatMap(e => [e.program, e.billingProgram]).filter(Boolean))].sort(), [events]);
  const labelToKinds = useMemo(() => {
    const m = new Map();
    events.forEach(e => m.set(kindMeta(e.kind).label, [...new Set([...(m.get(kindMeta(e.kind).label) || []), e.kind])]));
    return m;
  }, [events]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filteredEvents = filterStream(inView(events, view), {
      categories: categories.map(l => CATEGORY_VALUE[l]),
      kinds: kinds.flatMap(l => labelToKinds.get(l) || []),
      programs,
    });
    return q ? filteredEvents.filter(e => matches(e, q)) : filteredEvents;
  }, [events, view, query, categories, kinds, programs, labelToKinds]);
  const entries = useMemo(() => toEntries(shown), [shown]);
  const filterCount = categories.length + kinds.length + programs.length;
  const filtered = filterCount || view !== 'all' || query.trim();

  const closeSearch = () => { setSearchOpen(false); setQuery(''); };

  return (
    <div className={styles.wrapper}>
      <div className={styles.inner}>
      {/* Searching swaps the whole row for the search field (Figma 106:54694). */}
      {searchOpen ? (
        <div className={`${styles.toolbar} ${styles.searchRow}`}>
          <Input
            autoFocus
            leadingIcon="solar:magnifer-linear"
            placeholder="Search Timeline"
            aria-label="Search timeline"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
            trailingAction="solar:close-linear"
            trailingActionLabel="Close search"
            onTrailingAction={closeSearch}
            wrapperClassName={styles.searchField}
          />
        </div>
      ) : (
      <div className={styles.toolbar}>
        <Tabs
          variant="pill"
          className={styles.views}
          items={VIEW_TABS}
          value={view}
          onValueChange={setView}
          leading={(
            <>
              <ActionButton icon="solar:magnifer-linear" tooltip="Search" aria-label="Search timeline" onClick={() => setSearchOpen(true)} />
              <span className={styles.divider} aria-hidden="true" />
            </>
          )}
        />
        <span className={styles.divider} aria-hidden="true" />
        <ActionButton
          icon="custom:filter"
          tooltip="Filters"
          tooltipLeft
          aria-label="Filters"
          active={filtersOpen}
          count={filterCount ? String(filterCount) : undefined}
          onClick={() => setFiltersOpen(o => !o)}
        />
      </div>
      )}
      {filtersOpen && (
        <FilterBar
          variant="inline"
          multiSelect
          leading={null}
          filterDefs={programOptions.length ? FILTER_DEFS : FILTER_DEFS.filter(d => d.key !== 'programs')}
          filters={{ categories, kinds, programs }}
          onFilterChange={(key, vals) => ({ categories: setCategories, kinds: setKinds, programs: setPrograms })[key](vals)}
          onClearAll={() => { setCategories([]); setKinds([]); setPrograms([]); }}
          getOptions={def => ({
            categories: STREAM_CATEGORIES.map(c => CATEGORY_LABEL[c.value]),
            kinds: kindOptions,
            programs: programOptions,
          })[def.key]}
          showMoreFilters={false}
          showSaveFilter={false}
        />
      )}
      {loading
        ? <TimelineSkeleton rows={6} />
        : (
          <div className={styles.log}>
            <ActivityLog
              entries={entries}
              emptyLabel={filtered ? 'Nothing matches these filters.' : 'Nothing recorded for this patient yet.'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
