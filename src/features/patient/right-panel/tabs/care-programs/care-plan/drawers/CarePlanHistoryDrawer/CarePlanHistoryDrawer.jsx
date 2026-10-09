import { useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { ActivityLog, MetaLine, ViewMoreButton } from '../../../../../../../../components/ActivityLog/ActivityLog';
import { historyTimelineStyles as htStyles } from '../../../../../../../../components/HistoryTimeline/HistoryTimeline';
import { groupByMonth } from '../../../../../../../../components/Timeline/Timeline.utils';
import { AuditDetailCard } from '../../../../../../../../components/AuditDetailCard/AuditDetailCard';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { FilterChip } from '../../../../../../../../components/FilterChip/FilterChip';
import { Toggle } from '../../../../../../../../components/Toggle/Toggle';
import { RadioListPopover } from '../../../../../../../../components/RadioListPopover/RadioListPopover';
import { DateRangePopover } from '../../../../../../../../components/DateRangePopover/DateRangePopover';
import { parseLocalDate } from '../../../../../../../../lib/localDate';
import { Link } from '../../../../../../../../components/Link/Link';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { UnityPenToolIcon } from '../../../../../../../../components/Icon/UnityPenToolIcon';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { templateContents as templateContentsOnPlan } from '../../../../../../../../store/lib/carePlanStoreLib';
import { CarePlanVersionChangesDrawer } from '../CarePlanVersionChangesDrawer/CarePlanVersionChangesDrawer';
import { GoalPreviewDrawer } from '../GoalPreviewDrawer/GoalPreviewDrawer';
import { InterventionPreviewDrawer } from '../InterventionPreviewDrawer/InterventionPreviewDrawer';
import { BarrierDetailDrawer } from '../BarrierDetailDrawer/BarrierDetailDrawer';
import {
  TEMPLATE_RENEWAL_ACTIVITY,
  isTemplateRenewal,
  templateContents,
  templateOwnedTitles,
  withLiveLinks,
} from '../../lib/carePlanAuditTemplates';
import { NOTE_ACTIONS, netVersionRows } from '../../lib/carePlanVersions';
import { buildCarePlanHistory, filterHistoryEntries, HISTORY_TYPES } from '../../lib/carePlanHistory';
import { adherenceTone, goalProgressTone } from '../../lib/goalMetrics';
import styles from './CarePlanHistoryDrawer.module.css';


const TYPE_LABEL = { goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier', share: 'Share', plan: 'Plan' };
const ACTION_LABEL = {
  created: 'Added to Care Plan', updated: 'Edited', status_changed: 'Status Updated',
  progress_changed: 'Progress Updated', value_changed: 'Value Updated',
  deleted: 'Removed from Care Plan', shared: 'Shared', signed: 'Signed',
  note: 'Note', note_deleted: 'Note Removed', note_cleared: 'Note Removed',
  restored: 'Restored',
  priority_changed: 'Priority Updated', category_changed: 'Category Updated',
  measure_changed: 'Measure Updated', target_changed: 'Target Updated',
  target_date_changed: 'Target Date Updated', duration_changed: 'Duration Updated',
  frequency_changed: 'Frequency Updated', conditions_changed: 'Conditions Updated',
  type_changed: 'Type Updated', assignee_changed: 'Assignee Updated',
  goal_link_changed: 'Linked Goal Updated', description_changed: 'Description Updated',
};
// Only status and progress carry health; a priority of "High" is not a good
// outcome, so every other change renders its pills in grey.
const TONED_ACTIONS = new Set(['status_changed', 'progress_changed']);
// Long values read better as prose than as a pair of pills.
const PILL_MAX = 32;
// Every entry is a care plan event, so the rail carries the care plan glyph
// throughout rather than branching per action.
const CARE_PLAN_ICON = 'custom:care-plan';
// A change's own wording carries its health, so the from → to pills are toned
// off the value rather than off a status enum we don't have here.
const TONE_WORDS = [
  [/completed|high|good|achieved|met|on track/i, 'success'],
  [/moderate|in progress|partial|fair/i, 'warning'],
  [/poor|low|off track|not started|missed/i, 'error'],
];
function toneFor(value) {
  const hit = TONE_WORDS.find(([re]) => re.test(value || ''));
  return hit ? hit[1] : 'grey';
}

const MM_DD_YYYY = { month: '2-digit', day: '2-digit', year: 'numeric' };
const HH_MM = { hour: 'numeric', minute: '2-digit' };

// Additions and removals are summarised by count, matching the design's
// "Added to Care Plan: 2 Goals · 3 Interventions · 1 Barrier" row, so a
// version that added a dozen items stays one line instead of a dozen.
const ENTITY_NOUN = {
  goal: ['Goal', 'Goals'],
  intervention: ['Intervention', 'Interventions'],
  barrier: ['Barrier', 'Barriers'],
};
const ENTITY_ICON = {
  // The goal glyph the plan itself uses — mapPatientCarePlanGoalRow's default
  // and the icon on every goal row.
  goal: 'solar:flag-linear',
  intervention: 'solar:checklist-minimalistic-linear',
  barrier: 'custom:barrier',
};
function countBadges(rows, anchorFor) {
  return Object.keys(ENTITY_NOUN).map(type => {
    const n = rows.filter(r => r.entityType === type).length;
    if (!n) return null;
    const [one, many] = ENTITY_NOUN[type];
    return {
      label: `${n} ${n === 1 ? one : many}`,
      icon: ENTITY_ICON[type],
      onClick: anchorFor ? () => anchorFor(type) : undefined,
    };
  }).filter(Boolean);
}

function sectionFor(e) {
  const type = TYPE_LABEL[e.entityType] || e.entityType;
  const action = ACTION_LABEL[e.action] || e.action;
  const title = e.entityType === 'plan' ? e.summary : `${type} : ${e.summary}`;
  // A note reads as a care plan note whatever it hangs off, so the section is
  // titled by the event and the note itself is the body.
  if (NOTE_ACTIONS.has(e.action)) {
    const removed = e.action !== 'note';
    return {
      id: e.id,
      title: removed ? 'Care Plan Note Removed' : 'Care Plan Note Updated',
      // A removal names the note that went; its text is no longer the plan's.
      body: removed ? undefined : e.detail,
    };
  }
  // "90% - High → 85% - High" and friends become a from → to pill pair; any
  // other detail stays as prose. A config change names its own field, as
  // "Repeat: Off → On", and that label wins over the action's.
  const arrow = (e.detail || '').split('→');
  if (arrow.length === 2) {
    let [from, to] = arrow.map(s => s.trim());
    let label = action;
    const labelled = /^([A-Za-z][^:]{0,39}): (.*)$/.exec(from);
    if (labelled) {
      label = labelled[1];
      from = labelled[2].trim();
    }
    if (from.length <= PILL_MAX && to.length <= PILL_MAX) {
      const toned = TONED_ACTIONS.has(e.action);
      return {
        id: e.id,
        title,
        caption: `${label}:`,
        change: {
          from,
          to,
          fromTone: toned ? toneFor(from) : 'grey',
          toTone: toned ? toneFor(to) : 'grey',
        },
      };
    }
    return { id: e.id, title, caption: `${label}: ${from} → ${to}` };
  }
  return { id: e.id, title, caption: e.detail ? `${action}: ${e.detail}` : action };
}

function templateBadges(row, links, anchorFor) {
  // Resolved the same way the version drawer resolves it, so the counts match
  // the tree behind them.
  const c = withLiveLinks(templateContents(row), links);
  const totals = {
    goal: c.goals.length,
    intervention: c.interventions.length + c.goals.reduce((n, g) => n + g.interventions.length, 0),
    barrier: c.barriers.length + c.goals.reduce((n, g) => n + g.barriers.length, 0),
  };
  return Object.keys(ENTITY_NOUN).map(type => {
    const n = totals[type];
    if (!n) return null;
    const [one, many] = ENTITY_NOUN[type];
    // Interventions and barriers linked to a goal are shown under it, so their
    // own group only exists for the unlinked ones; the badge then falls back
    // to the template itself.
    const hasGroup = type === 'goal' || c[`${type}s`].length > 0;
    return {
      label: `${n} ${n === 1 ? one : many}`,
      icon: ENTITY_ICON[type],
      onClick: anchorFor ? () => anchorFor(hasGroup ? type : null) : undefined,
    };
  }).filter(Boolean);
}


// A counted section covers several entity types; clicking it lands on the
// first one the version actually touched.
function firstEntityType(rows) {
  return Object.keys(ENTITY_NOUN).find(type => rows.some(r => r.entityType === type))
    || 'goal';
}

function sectionsFor(group, openAt, links) {
  // Only the net difference between this signature and the previous one.
  const rows = netVersionRows(group.rows);
  const templates = rows.filter(r => r.entityType === 'template');
  // Items a template brought in are reported under that template, so they do
  // not also swell the loose "Added to Care Plan" count.
  const owned = templateOwnedTitles(templates);
  const isOwned = r => owned.has((r.summary || '').trim().toLowerCase());
  const plain = rows.filter(r => r.entityType !== 'template');
  const added = plain.filter(r => r.action === 'created' && !isOwned(r));
  const removed = plain.filter(r => r.action === 'deleted' && !isOwned(r));
  // Sharing only happens as part of signing, so it is not its own activity —
  // the attribution line above already names where the plan went.
  const rest = plain.filter(r => r.action !== 'created' && r.action !== 'deleted'
    && r.action !== 'shared');
  const sections = [];
  for (const t of templates) {
    if (isTemplateRenewal(t)) {
      sections.push({
        id: t.id,
        title: `${t.summary} Template ${TEMPLATE_RENEWAL_ACTIVITY[t.action]}`,
        caption: t.detail || '',
        badges: [],
        onClick: () => openAt?.(t.id),
      });
      continue;
    }
    sections.push({
      id: t.id,
      title: `${t.summary} Template ${t.action === 'created' ? 'Added' : 'Removed'}`,
      caption: t.action === 'created' ? 'Added to Care Plan:' : 'Removed from Care Plan:',
      badges: t.action === 'created'
        ? templateBadges(t, links, type => openAt?.(type ? `${t.id}-${type}` : t.id))
        : [],
      onClick: () => openAt?.(t.id),
    });
  }
  if (added.length) {
    sections.push({
      id: `${group.id}-added`,
      title: 'Added to Care Plan',
      badges: countBadges(added, type => openAt?.(`created-${type}`)),
      onClick: () => openAt?.(`created-${firstEntityType(added)}`),
    });
  }
  if (removed.length) {
    sections.push({
      id: `${group.id}-removed`,
      title: 'Removed from Care Plan',
      badges: countBadges(removed, type => openAt?.(`deleted-${type}`)),
      onClick: () => openAt?.(`deleted-${firstEntityType(removed)}`),
    });
  }
  sections.push(...rest.map(r => ({ ...sectionFor(r), onClick: () => openAt?.(r.id) })));
  if (group.signed.detail) {
    sections.push({ id: `${group.signed.id}-note`, title: 'Sign-off Note', body: group.signed.detail });
  }
  if (sections.length === 0) {
    sections.push({ id: group.id, title: 'No changes recorded in this version' });
  }
  return sections;
}

// Entries a month (or version) shows before folding the rest behind "Show N more".
const GROUP_PREVIEW = 10;

const LIVE_CHANGE_TYPES = new Set(['status', 'priority', 'progress', 'title', 'assignment']);

// A status change wears the icon of the status it moved to (the rail tile
// already takes that status's colour), as HCC status entries do. In Progress
// uses the design system's Pending status glyph.
const STATUS_ICON = {
  'Not Started': 'solar:minus-circle-linear',
  'In Progress': 'custom:pending',
  'On Hold': 'solar:pause-circle-linear',
  Met: 'solar:check-circle-linear',
  'Not Met': 'solar:close-circle-linear',
};
// Other progress changes show what changed.
const CHANGE_ICON = {
  priority: 'solar:ranking-linear',
  title: 'solar:pen-linear',
};

const DATE_PRESETS = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'This month'];

const fmtDay = iso => parseLocalDate(iso)?.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) || '';

// Whether an ISO time falls in a Date Range preset, or in `range` (two ISO
// days, inclusive) for Custom; no preset keeps everything.
function inDatePreset(preset, range = []) {
  if (!preset) return () => true;
  if (preset === 'Custom') {
    const from = parseLocalDate(range[0]);
    const to = parseLocalDate(range[1]);
    if (!from || !to) return () => true;
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).getTime();
    return iso => !!iso && new Date(iso).getTime() >= from.getTime() && new Date(iso).getTime() < end;
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = { Today: 0, 'Last 7 days': 7, 'Last 30 days': 30, 'Last 90 days': 90 }[preset];
  return (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (preset === 'This month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return day <= today && today - day <= days * 86400000;
  };
}

// Date Range picker: the presets, plus Custom, which opens the two-month range
// calendar the worklists use.
function DateRangeFilterPopover({ anchorRect, onClose, preset, range, onPick }) {
  const [custom, setCustom] = useState(false);
  if (custom) {
    return (
      <DateRangePopover
        anchorRect={anchorRect}
        label="Custom range"
        selected={range}
        onChange={next => onPick(next.length === 2 ? 'Custom' : null, next.length === 2 ? next : [])}
        onClose={onClose}
      />
    );
  }
  return (
    <RadioListPopover
      anchorRect={anchorRect}
      label="Date Range"
      options={[...DATE_PRESETS, 'Custom']}
      selected={preset ? [preset] : []}
      onChange={(next) => {
        if (next[0] === 'Custom') { setCustom(true); return; }
        onPick(next[0] || null, []);
        onClose();
      }}
      onClose={onClose}
    />
  );
}

// Timeline grouped by the version each entry belongs to: the unsigned draft,
// then each signed version newest first (its signature and everything done
// while it was current), then anything before the first signature.
function groupByVersion(entries) {
  const groups = new Map();
  const add = (key, label, e) => {
    if (!groups.has(key)) groups.set(key, { label, entries: [] });
    groups.get(key).entries.push(e);
  };
  const current = Math.max(0, ...entries.map(e => (e.kind === 'version' ? e.versionNumber : (e.version || 0))));
  const label = n => `Version ${n}${n === current ? ' · Current' : ''}`;
  const groupCurrent = {};
  groupCurrent[`v${current}`] = true;
  for (const e of entries) {
    if (e.kind === 'unsigned') add('unsigned', e.neverSigned ? 'Draft · Not Signed Yet' : `Version ${e.nextVersion} · Draft`, e);
    else if (e.kind === 'version') add(`v${e.versionNumber}`, label(e.versionNumber), e);
    else if (e.version) add(`v${e.version}`, label(e.version), e);
    else add('draft', 'Before Version 1', e);
  }
  const rank = key => (key === 'unsigned' ? Infinity : key === 'draft' ? -1 : Number(key.slice(1)));
  return [...groups.entries()]
    .sort(([a], [b]) => rank(b) - rank(a))
    .map(([key, g]) => ({
      ...g,
      current: !!groupCurrent[key],
      versionNumber: key.startsWith('v') ? Number(key.slice(1)) : null,
      draftOf: key === 'unsigned' && !g.entries[0]?.neverSigned ? g.entries[0]?.nextVersion : null,
    }));
}

// Care Plan History: one timeline, grouped by month like every activity log.
// A signature (and the draft waiting for one) is a single glanceable entry:
// what it changed as badges, the detail card under View more, and the full
// changes drawer from its open button. Progress on the signed plan, notes,
// readings and plan events are entries of their own, tagged with the version
// they happened on.
export function CarePlanHistoryDrawer({ patientId, program, onClose }) {
  const key = `${patientId}::${program.id}`;
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  const fetchCarePlanVersions = useAppStore(s => s.fetchCarePlanVersions);
  const audit = useAppStore(s => s.patientCarePlanAudit[key]);
  const versions = useAppStore(s => s.patientCarePlanVersions[key]);
  const plan = useAppStore(s => s.patientCarePlans[key]);
  const templates = useAppStore(s => s.carePlanTemplates);
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const currentUserName = useAppStore(s => s.currentUserProfile?.name);
  const links = useMemo(() => ({ plan, libraryGoals }), [plan, libraryGoals]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [openVersion, setOpenVersion] = useState(null);
  const [openItem, setOpenItem] = useState(null); // { type, item } shown over History
  const [allShown, setAllShown] = useState(() => new Set()); // group labels showing every entry
  const toggleAllShown = label => setAllShown(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });
  const [typeLabels, setTypeLabels] = useState([]);
  const [viewBy, setViewBy] = useState('month');
  const [datePreset, setDatePreset] = useState(null); // preset label, 'Custom', or null
  const [dateRange, setDateRange] = useState([]);     // [startISO, endISO] for Custom
  const [actors, setActors] = useState([]);
  const filtersActive = typeLabels.length > 0 || !!datePreset || actors.length > 0;
  const clearFilters = () => { setTypeLabels([]); setDatePreset(null); setDateRange([]); setActors([]); };

  useEffect(() => {
    if (audit === undefined) fetchCarePlanAudit(patientId, program.id);
  }, [audit, patientId, program.id, fetchCarePlanAudit]);
  useEffect(() => {
    if (versions === undefined) fetchCarePlanVersions(patientId, program.id);
  }, [versions, patientId, program.id, fetchCarePlanVersions]);

  const currentVersion = versions?.[0]?.versionNumber ?? null;

  const roleFor = useCallback(
    name => (currentUserName && name && name.toLowerCase() === currentUserName.toLowerCase() ? 'Current User' : null),
    [currentUserName],
  );
  const toggle = id => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const history = useMemo(() => {
    if (!audit || !versions) return [];
    // A template applied in a version is described the way signCarePlan
    // records one, from the plan as that version holds it.
    const templateDetail = (id, snapshot) => {
      const template = (templates || []).find(t => String(t.id) === String(id));
      return template ? JSON.stringify(templateContentsOnPlan(template, snapshot, libraryGoals)) : '';
    };
    return buildCarePlanHistory({ versions, audit, slice: plan, templates, templateDetail });
  }, [audit, versions, plan, templates, libraryGoals]);

  const selected = useMemo(
    () => new Set(HISTORY_TYPES.filter(t => typeLabels.includes(t.label)).map(t => t.key)),
    [typeLabels],
  );

  // The version tag that ends a meta line: "v3" plus a small grey Current
  // badge for the version the plan is on now, "v2" for an older one.
  const versionTag = n => (n === currentVersion
    ? (
      <span className={styles.versionTag}>
        v{n}
        <Badge size="S" tone="grey" label="Current" className={styles.currentBadge} />
      </span>
    )
    : `v${n}`);

  const metaFor = (at, by, context) => {
    const d = at ? new Date(at) : null;
    return (
      <MetaLine entry={{
        date: d ? d.toLocaleDateString('en-US', MM_DD_YYYY) : null,
        time: d ? d.toLocaleTimeString('en-US', HH_MM) : null,
        by: by || null,
        role: roleFor(by),
        context,
      }} />
    );
  };

  // A signature, or the draft waiting for one: headline, at-a-glance badges,
  // the detail card under View more, and the changes drawer from its corner.
  const renderVersion = (e) => {
    const isOpen = expanded.has(e.id);
    const group = {
      id: e.id,
      rows: [...e.rows].sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''))),
      signed: { id: e.id, detail: e.note || '' },
      createdAt: e.at,
    };
    const unsigned = e.kind === 'unsigned';
    const header = unsigned
      ? [e.neverSigned ? 'Not signed yet' : 'Unsigned changes', `Becomes v${e.nextVersion} when signed`]
      : [`Signed by: ${e.actor || 'Unknown'}`, `v${e.versionNumber}`, e.sharedTo].filter(Boolean);
    const openChanges = anchor => setOpenVersion({
      rows: group.rows, createdAt: e.at, anchor,
      versionNumber: unsigned ? e.nextVersion : e.versionNumber,
      current: !unsigned && e.versionNumber === currentVersion,
      draft: unsigned,
      signedBy: unsigned ? '' : e.actor,
    });
    const card = isOpen && (
      <div className={styles.detailsWrap}>
        <AuditDetailCard
          header={header}
          sections={sectionsFor(group, anchor => openChanges(anchor), links)}
          onOpen={() => openChanges(null)}
          openTooltip="View changes"
        />
      </div>
    );
    return (
      <>
        {e.at && metaFor(e.at, e.actor, unsigned ? undefined : versionTag(e.versionNumber))}
        <div className={htStyles.headlineRow}>
          <span className={htStyles.headline}>
            {unsigned
              ? (e.neverSigned ? 'Care Plan Drafted' : 'Care Plan Has Unsigned Changes')
              : 'Changes in Care Plan'}
          </span>
          {unsigned && viewBy !== 'version' && <Badge size="S" tone="warning" label={`Draft · v${e.nextVersion}`} />}
          {group.rows.length > 0 && <ViewMoreButton expanded={isOpen} onToggle={() => toggle(e.id)} />}
        </div>
        {card}
      </>
    );
  };

  const showMoreRow = (label, hidden, showAll) => ({
    t: 'care_plan_more',
    id: `${label}-more`,
    avatar: (
      <span className={styles.moreRailIcon} aria-hidden="true">
        <Icon name="solar:alt-arrow-up-linear" size={10} color="var(--primary-300)" />
        <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--primary-300)" />
      </span>
    ),
    render: () => (
      <button type="button" className={styles.moreLink} onClick={() => toggleAllShown(label)}>
        {showAll ? `Show fewer entries from ${label}` : `Show ${hidden} more ${hidden === 1 ? 'entry' : 'entries'} from ${label}`}
      </button>
    ),
  });

  const signedMarker = (e) => {
    const d = e.at ? new Date(e.at) : null;
    return {
      t: 'care_plan_signed',
      id: `${e.id}-signed`,
      avatar: (
        <span className={styles.signedRailIcon}>
          <UnityPenToolIcon size={24} />
        </span>
      ),
      render: () => (
        // Date • Time • what happened • who, the order every entry's meta
        // line reads in.
        <div className={styles.signedMarker}>
          {d && (
            <span className={styles.signedMeta}>
              {d.toLocaleDateString('en-US', MM_DD_YYYY)} • {d.toLocaleTimeString('en-US', HH_MM)} •
            </span>
          )}
          <span className={styles.signedPill}>
            <span className={styles.signedPillText}>Care Plan Signed as Version {e.versionNumber}</span>
          </span>
          {e.actor && <span className={styles.signedMeta}>• {e.actor}{roleFor(e.actor) ? ` (${roleFor(e.actor)})` : ''}</span>}
        </div>
      ),
    };
  };

  // Progress, notes, readings and plan events are ordinary activity-log
  // entries, so they read exactly like HCC's: a sentence headline, the
  // from → to pills under it, and the version in the meta line.
  // An entry about a goal, intervention or barrier still on the plan opens
  // that item's details over History.
  const ITEM_LIST = { goal: 'goals', intervention: 'interventions', barrier: 'barriers' };
  const openActionFor = (e) => {
    const list = ITEM_LIST[e.entityType];
    const item = list && e.entityId != null
      ? (plan?.[list] || []).find(x => String(x.id) === String(e.entityId))
      : null;
    if (!item) return {};
    return {
      onOpen: () => setOpenItem({ type: e.entityType, item }),
      openTooltip: `Open ${e.entityType}`,
    };
  };

  const activityItem = (e) => {
    const d = e.at ? new Date(e.at) : null;
    const base = {
      id: e.id,
      date: d ? d.toLocaleDateString('en-US', MM_DD_YYYY) : null,
      time: d ? d.toLocaleTimeString('en-US', HH_MM) : null,
      by: e.actor || null,
      role: roleFor(e.actor),
      // The version it happened on; the one the plan is on now says so.
      context: e.version ? versionTag(e.version) : 'Draft',
      // What happened, then the item it happened to in a quieter tone.
      title: e.headlineAction
        ? <>{e.headlineAction} <span className={styles.headlineSubject}>{e.headlineSubject}</span></>
        : e.headline,
      ...openActionFor(e),
    };
    if (e.type === 'progress') {
      // Progress and adherence read in their band colours ("3% - Low" red,
      // "70% - Moderate" amber, "85% - High" green), on the pills and on the
      // half-ring glyph in the rail, as they do on the goal and intervention.
      const toneOf = e.entityType === 'intervention' ? adherenceTone : goalProgressTone;
      const toTone = toneOf(e.to);
      return {
        ...base,
        t: 'status_change',
        avatar: <Avatar type="icon" variant={toTone === 'grey' ? 'others' : toTone} size="S" iconName="custom:in-progress" />,
        render: () => (
          <>
            <MetaLine entry={base} />
            <div className={htStyles.headlineRow}>
              <span className={htStyles.headline}>{base.title}</span>
            </div>
            <div className={htStyles.transition}>
              <Badge size="S" tone={toneOf(e.from)} label={e.from || 'None'} />
              <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
              <Badge size="S" tone={toTone} label={e.to || 'None'} />
            </div>
          </>
        ),
      };
    }
    if (e.type === 'assignment' && /^Assignee Changed for /.test(e.headline)) {
      // Who it moved between, as the activity log's avatar chips.
      const person = name => (!name || name === 'Unassigned' || name === 'None'
        ? null
        : { name, initials: name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() });
      return { ...base, t: 'assignee_change', fromAssignee: person(e.from), toAssignee: person(e.to) };
    }
    if (LIVE_CHANGE_TYPES.has(e.type)) {
      const icon = e.type === 'status'
        ? STATUS_ICON[e.to]
        : (e.type === 'assignment' ? 'solar:calendar-linear' : CHANGE_ICON[e.type]);
      return { ...base, t: 'status_change', icon, from: e.from || 'None', to: e.to || 'None' };
    }
    if (e.type === 'care_note' || e.type === 'item_note') {
      // The note's text waits behind "• View Note", the way HCC entries keep
      // their details one click away.
      const open = expanded.has(e.id);
      return {
        ...base,
        t: 'comment',
        render: () => (
          <>
            <MetaLine entry={base} />
            <div className={htStyles.headlineRow}>
              <span className={htStyles.headline}>{base.title}</span>
              {(e.body || e.previous) && (
                <ViewMoreButton expanded={open} onToggle={() => toggle(e.id)} label="View Note" leadingDot />
              )}
            </div>
            {open && (
              // Laid out like an HCC details card: what the note is on, the
              // note itself, then what it replaced.
              <div className={htStyles.detailsCard}>
                <div className={htStyles.detailRow}>
                  <div className={htStyles.detailText}>
                    <div className={htStyles.detailHcc}>
                      {e.title ? `${{ goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier' }[e.entityType] || 'Item'}: ${e.title}` : 'Care Plan Note'}
                    </div>
                    <div className={`${htStyles.detailIcd} ${styles.noteText}`}>{e.body || e.previous}</div>
                    {e.body && e.previous && (
                      <div className={htStyles.detailReason}>Previous note: {e.previous}</div>
                    )}
                    {!e.body && <div className={htStyles.detailReason}>Note removed</div>}
                  </div>
                </div>
              </div>
            )}
          </>
        ),
      };
    }
    if (e.type === 'value') {
      return {
        ...base,
        t: 'care_plan_value',
        icon: 'solar:graph-up-linear',
        outcome: `${e.value || 'No value'}${e.previous ? ` (previous ${e.previous})` : ''} • ${e.inTarget ? 'In target' : 'Out of target'}`,
        outcomeColor: e.inTarget ? 'var(--status-success)' : 'var(--status-error)',
      };
    }
    return { ...base, t: 'care_plan_event', icon: 'custom:history', outcome: e.detail || undefined };
  };

  const actorOptions = useMemo(
    () => [...new Set(history.map(e => e.actor).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [history],
  );

  const logEntries = useMemo(() => {
    const now = new Date().toISOString();
    const inDateRange = inDatePreset(datePreset, dateRange);
    // The draft waiting to be signed is pending, not past: it leads the
    // timeline whatever its last edit's date.
    const timeline = filterHistoryEntries(history, selected)
      .filter(e => e.kind === 'unsigned' || inDateRange(e.at))
      .filter(e => !actors.length || actors.includes(e.actor))
      .map(e => ({ ...e, createdAt: e.kind === 'unsigned' ? now : (e.at || now) }))
      .sort((a, b) => (a.kind === 'unsigned' ? -1 : b.kind === 'unsigned' ? 1 : 0));
    const groups = viewBy === 'version' ? groupByVersion(timeline) : groupByMonth(timeline);
    return groups.flatMap(month => {
      const items = month.entries.flatMap(e => {
        if (e.kind === 'activity') return [activityItem(e)];
        const entry = {
          t: 'care_plan_version',
          id: e.id,
          avatar: <Avatar type="icon" variant={e.kind === 'unsigned' ? 'warning' : 'others'} size="S" iconName={CARE_PLAN_ICON} />,
          render: () => renderVersion(e),
        };
        // A signature is the entry with what the version changed, closed by a
        // one-line marker (Figma ICD-Import 7121:161868) that divides it from
        // the activity before it.
        return e.kind === 'version' ? [entry, signedMarker(e)] : [entry];
      });
      // A busy month (or version) shows its first entries and folds the rest
      // behind one "Show N more" row.
      const hidden = items.length - GROUP_PREVIEW;
      const showAll = allShown.has(month.label);
      return [
        {
          t: 'group',
          label: month.label,
          // The current version reads "Version 3" plus a Current badge in the
          // same Unity treatment as the signature marker.
          display: month.current ? (
            <span className={styles.groupLabel}>
              Version {month.versionNumber}
              <span className={`${styles.signedPill} ${styles.currentPill}`}>
                <span className={styles.signedPillText}>Current</span>
              </span>
            </span>
          ) : month.draftOf ? (
            // The draft group carries its Draft badge here, not on the entry.
            <span className={styles.groupLabel}>
              Version {month.draftOf}
              <Badge size="S" tone="grey" label="Draft" />
            </span>
          ) : undefined,
        },
        ...(hidden > 0 && !showAll ? items.slice(0, GROUP_PREVIEW) : items),
        ...(hidden > 0 ? [showMoreRow(month.label, hidden, showAll)] : []),
      ];
    });
  }, [history, selected, expanded, roleFor, viewBy, datePreset, dateRange, actors, allShown]); // eslint-disable-line react-hooks/exhaustive-deps -- renderers close over links/state read at render

  const loading = audit === undefined || versions === undefined;

  return (
    <Drawer
      title="Care Plan History"
      onClose={onClose}
      banner={(
        <div className={styles.filterRow}>
          <Toggle
            size="S"
            items={[{ key: 'month', label: 'Month' }, { key: 'version', label: 'Versions' }]}
            active={viewBy}
            onChange={setViewBy}
          />
          <span className={styles.filterDivider} aria-hidden="true" />
          <FilterChip
            label="Activity Type"
            options={HISTORY_TYPES.map(t => t.label)}
            selected={typeLabels}
            onChange={setTypeLabels}
          />
          <FilterChip
            label="Date Range"
            active={!!datePreset}
            activeSummary={datePreset === 'Custom' ? `${fmtDay(dateRange[0])} – ${fmtDay(dateRange[1])}` : datePreset || undefined}
            onClear={() => { setDatePreset(null); setDateRange([]); }}
            renderPopover={({ anchorRect, onClose: closePopover }) => (
              <DateRangeFilterPopover
                anchorRect={anchorRect}
                onClose={closePopover}
                preset={datePreset}
                range={dateRange}
                onPick={(preset, range) => { setDatePreset(preset); setDateRange(range); }}
              />
            )}
          />
          <FilterChip
            label="Activity by"
            options={actorOptions}
            selected={actors}
            onChange={setActors}
          />
          <Link disabled={!filtersActive} onClick={clearFilters}>Clear All</Link>
        </div>
      )}
    >
      <ActivityLog
        relaxed
        entries={loading ? [] : logEntries}
        emptyLabel={loading ? 'Loading history…' : 'Nothing matches these filters.'}
      />
      {openItem?.type === 'goal' && (
        <GoalPreviewDrawer
          goal={openItem.item}
          patientId={patientId}
          program={program}
          onClose={() => setOpenItem(null)}
          onOpenIntervention={(i) => setOpenItem({ type: 'intervention', item: i })}
          onOpenBarrier={(b) => setOpenItem({ type: 'barrier', item: b })}
        />
      )}
      {openItem?.type === 'intervention' && (
        <InterventionPreviewDrawer
          intervention={openItem.item}
          patientId={patientId}
          program={program}
          onClose={() => setOpenItem(null)}
          onOpenGoal={(g) => setOpenItem({ type: 'goal', item: g })}
        />
      )}
      {openItem?.type === 'barrier' && (
        <BarrierDetailDrawer
          barrier={openItem.item}
          patientId={patientId}
          program={program}
          onClose={() => setOpenItem(null)}
          onOpenGoal={(g) => setOpenItem({ type: 'goal', item: g })}
        />
      )}
      {openVersion && (
        <CarePlanVersionChangesDrawer
          rows={openVersion.rows}
          signedAt={openVersion.createdAt}
          anchor={openVersion.anchor}
          plan={plan}
          patientId={patientId}
          versionNumber={openVersion.versionNumber}
          current={openVersion.current}
          draft={openVersion.draft}
          signedBy={openVersion.signedBy}
          onClose={() => setOpenVersion(null)}
        />
      )}
    </Drawer>
  );
}
