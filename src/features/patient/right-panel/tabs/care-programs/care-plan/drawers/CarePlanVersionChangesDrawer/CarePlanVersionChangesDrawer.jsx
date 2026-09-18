import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { FilterChip } from '../../../../../../../../components/FilterChip/FilterChip';
import { DateRangePopover } from '../../../../../../../../components/DateRangePopover/DateRangePopover';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { ActivityLog, MetaLine, ViewMoreButton } from '../../../../../../../../components/ActivityLog/ActivityLog';
import { historyTimelineStyles as htStyles } from '../../../../../../../../components/HistoryTimeline/HistoryTimeline';
import {
  templateContents,
  templateOwnedTitles,
  withLiveLinks,
} from '../../lib/carePlanAuditTemplates';
import { NOTE_ACTIONS, netVersionRows } from '../../lib/carePlanVersions';
import { isMemberAssignee } from '../../tables/CarePlanInterventionsTable';
import styles from './CarePlanVersionChangesDrawer.module.css';

const EMPTY_ARR = [];
const ENTITY_NOUN = {
  goal: ['Goal', 'Goals'],
  intervention: ['Intervention', 'Interventions'],
  barrier: ['Barrier', 'Barriers'],
  plan: ['Plan', 'Plans'],
};
const TYPE_LABEL = {
  goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier',
  share: 'Share', plan: 'Plan',
};
const ACTION_LABEL = {
  status_changed: 'Status Updated', progress_changed: 'Progress Updated',
  value_changed: 'Value Updated', priority_changed: 'Priority Updated',
  category_changed: 'Category Updated', measure_changed: 'Measure Updated',
  target_changed: 'Target Updated', target_date_changed: 'Target Date Updated',
  duration_changed: 'Duration Updated', frequency_changed: 'Frequency Updated',
  conditions_changed: 'Conditions Updated', type_changed: 'Type Updated',
  assignee_changed: 'Assignee Updated', goal_link_changed: 'Linked Goal Updated',
  description_changed: 'Description Updated', updated: 'Edited',
  shared: 'Shared', restored: 'Restored',
};
// Short activity labels for the "Activity type" filter (the field that
// changed), derived from an audit row's action. Added/Removed are handled
// separately on the counted buckets.
const ACTIVITY_FROM_ACTION = {
  status_changed: 'Status', progress_changed: 'Progress', value_changed: 'Value',
  priority_changed: 'Priority', category_changed: 'Category', measure_changed: 'Measure',
  target_changed: 'Target', target_date_changed: 'Target Date', due_date_changed: 'Due Date',
  duration_changed: 'Duration', frequency_changed: 'Frequency', conditions_changed: 'Conditions',
  type_changed: 'Type', assignee_changed: 'Assignee', adherence_changed: 'Adherence',
  goal_link_changed: 'Linked Goal', description_changed: 'Description', updated: 'Edited',
  shared: 'Shared', restored: 'Restored',
};
// A change node's label (e.g. "Status Updated" or an extracted "Due Date")
// normalises to a filter value by dropping the trailing "Updated".
const normActivity = (label) => (label || '').replace(/\s+Updated$/i, '').trim();
// Entity labels shown in the "Change type" filter.
const ENTITY_FILTER_LABEL = {
  goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier',
  template: 'Template', note: 'Note', plan: 'Plan',
};

const TONED_ACTIONS = new Set(['status_changed', 'progress_changed']);
// A version mixes things that arrived in it with edits to things that were
// already there. Only the first kind carries a tag, so "new here" reads at a
// glance rather than having to be inferred from the heading.
const ADDED_TAG = { label: 'Added in this version', tone: 'success' };
const REMOVED_TAG = { label: 'Removed in this version', tone: 'error' };
const TONE_WORDS = [
  [/completed|high|good|achieved|met|on track/i, 'success'],
  [/moderate|in progress|partial|fair/i, 'warning'],
  [/poor|low|off track|not started|missed/i, 'error'],
];
function toneFor(value) {
  const hit = TONE_WORDS.find(([re]) => re.test(value || ''));
  return hit ? hit[1] : 'grey';
}

// How long the arrived-here highlight stays up.
const HIGHLIGHT_MS = 2000;

const MM_DD_YYYY = { month: '2-digit', day: '2-digit', year: 'numeric' };
const HH_MM = { hour: 'numeric', minute: '2-digit' };

// Short date for the date-range chip's active summary (e.g. "09/18/2026").
function fmtShortDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', MM_DD_YYYY);
}

// Numeric timestamp for sorting a node by when its change happened.
function tsOf(row) {
  const at = row?.createdAt ? new Date(row.createdAt).getTime() : NaN;
  return Number.isNaN(at) ? 0 : at;
}

// Every node came from an audit row, so it can say when it happened and who
// did it, the same way the History timeline does.
function stampOf(row) {
  const at = row?.createdAt ? new Date(row.createdAt) : null;
  const valid = at && !Number.isNaN(at.getTime());
  return {
    date: valid ? at.toLocaleDateString('en-US', MM_DD_YYYY) : null,
    time: valid ? at.toLocaleTimeString('en-US', HH_MM) : null,
    by: row?.actor || null,
  };
}

// Rail glyph per activity, so a node says what kind of change it is at a
// glance. Entity buckets carry the same icons the plan's own rows use.
const ENTITY_ICON = {
  goal: 'solar:flag-linear',
  // ActivityLog's own task glyph — an intervention is a task on the plan.
  intervention: 'solar:clipboard-check-linear',
  barrier: 'custom:barrier',
  plan: 'custom:care-plan',
};
const TEMPLATE_ICON = 'custom:care-plan';
const NOTE_ICON = 'solar:notes-linear';
const CHANGE_ICON = 'solar:refresh-linear';

function countLabel(type, n) {
  const [one, many] = ENTITY_NOUN[type] || [type, `${type}s`];
  return `${n} ${n === 1 ? one : many}`;
}

// One node per kind of change: additions and removals collapse into a counted
// heading listing what moved, and everything else keeps its own node so the
// before → after stays readable.
function buildNodes(rawRows, links) {
  const nodes = [];
  // Only the net difference between this signature and the previous one.
  const allRows = netVersionRows(rawRows);
  const templates = allRows.filter(r => r.entityType === 'template');
  // What a template brought in is listed under that template, not again as a
  // loose addition.
  const owned = templateOwnedTitles(templates);
  // Sharing only happens as part of signing, so it is folded into the version
  // rather than listed as a change of its own.
  const rows = allRows.filter(r => r.entityType !== 'template'
    && r.action !== 'shared'
    && !((r.action === 'created' || r.action === 'deleted')
      && owned.has((r.summary || '').trim().toLowerCase())));

  for (const t of templates) {
    const c = withLiveLinks(templateContents(t), links);
    // One summary line for the whole template — goals, interventions and
    // barriers together — rather than a heading per block.
    const totals = {
      goal: c.goals.length,
      intervention: c.interventions.length + c.goals.reduce((n, g) => n + g.interventions.length, 0),
      barrier: c.barriers.length + c.goals.reduce((n, g) => n + g.barriers.length, 0),
    };
    const summary = Object.keys(ENTITY_NOUN)
      .filter(type => totals[type] > 0)
      .map(type => countLabel(type, totals[type]))
      .join(' • ');
    const groups = [];
    if (c.goals.length) {
      groups.push({
        anchor: `${t.id}-goal`,
        // Each goal carries what the template linked to it, so the tree shows
        // the linkage instead of three unrelated lists.
        tree: c.goals.map(g => ({
          title: g.title,
          icon: ENTITY_ICON.goal,
          counts: [
            g.interventions.length && countLabel('intervention', g.interventions.length),
            g.barriers.length && countLabel('barrier', g.barriers.length),
          ].filter(Boolean).join(' • '),
          children: [
            ...g.interventions.map(title => ({ title, icon: ENTITY_ICON.intervention })),
            ...g.barriers.map(title => ({ title, icon: ENTITY_ICON.barrier })),
          ],
        })),
      });
    }
    // Anything the template brought that hangs off no goal of its own.
    for (const type of ['intervention', 'barrier']) {
      const loose = c[`${type}s`];
      if (!loose.length) continue;
      groups.push({
        anchor: `${t.id}-${type}`,
        tree: loose.map(title => ({ title, icon: ENTITY_ICON[type] })),
      });
    }
    nodes.push({
      id: t.id,
      anchor: t.id,
      icon: TEMPLATE_ICON,
      heading: `${t.summary} Template ${t.action === 'created' ? 'Added' : 'Removed'}`,
      tag: t.action === 'created' ? ADDED_TAG : REMOVED_TAG,
      stamp: stampOf(t),
      ts: tsOf(t),
      category: t.action === 'created' ? 'added' : 'removed',
      entityKind: 'template',
      activity: t.action === 'created' ? 'Added' : 'Removed',
      actor: t.actor || null,
      summary,
      groups,
    });
  }

  const bucket = (action, verb) => {
    const matching = rows.filter(r => r.action === action);
    for (const type of Object.keys(ENTITY_NOUN)) {
      const ofType = matching.filter(r => r.entityType === type);
      if (ofType.length === 0) continue;
      nodes.push({
        id: `${action}-${type}`,
        anchor: `${action}-${type}`,
        icon: ENTITY_ICON[type] || ENTITY_ICON.plan,
        // A counted bucket spans several rows; the newest one dates it.
        stamp: stampOf(ofType.at(-1)),
        ts: Math.max(...ofType.map(tsOf)),
        category: action === 'created' ? 'added' : 'removed',
        entityKind: type,
        activity: action === 'created' ? 'Added' : 'Removed',
        actor: ofType.at(-1)?.actor || null,
        heading: `${countLabel(type, ofType.length)} ${verb}`,
        tag: action === 'created' ? ADDED_TAG : REMOVED_TAG,
        items: ofType.map(r => r.summary).filter(Boolean),
      });
    }
  };
  bucket('created', 'added');
  bucket('deleted', 'removed');

  for (const r of rows) {
    if (r.action === 'created' || r.action === 'deleted') continue;
    if (NOTE_ACTIONS.has(r.action)) {
      const removed = r.action !== 'note';
      nodes.push({
        id: r.id,
        anchor: r.id,
        icon: NOTE_ICON,
        stamp: stampOf(r),
        ts: tsOf(r),
        category: 'note',
        entityKind: 'note',
        activity: 'Note',
        actor: r.actor || null,
        heading: removed ? 'Care Plan Note Removed' : 'Care Plan Note Updated',
        items: removed || !r.detail ? [] : [r.detail],
      });
      continue;
    }
    const type = TYPE_LABEL[r.entityType] || r.entityType;
    const heading = r.entityType === 'plan'
      ? `${r.summary} Updated`
      : `${type} - ${r.summary} Updated`;
    const arrow = (r.detail || '').split('→');
    if (arrow.length === 2) {
      let [from, to] = arrow.map(v => v.trim());
      let label = ACTION_LABEL[r.action] || r.action;
      const labelled = /^([A-Za-z][^:]{0,39}): (.*)$/.exec(from);
      if (labelled) {
        label = labelled[1];
        from = labelled[2].trim();
      }
      const toned = TONED_ACTIONS.has(r.action);
      // Assignee changes colour the person by role: patient → primary,
      // provider/staff → secondary (matches the assignee pills elsewhere).
      const isAssignee = r.action === 'assignee_changed' || normActivity(label).toLowerCase() === 'assignee';
      const assigneeTone = (v) => {
        const role = links?.classifyAssignee?.(v);
        return role === 'patient' ? 'primary' : role === 'provider' ? 'secondary' : 'grey';
      };
      const pickTone = (v) => (isAssignee ? assigneeTone(v) : toned ? toneFor(v) : 'grey');
      nodes.push({
        id: r.id,
        anchor: r.id,
        icon: CHANGE_ICON,
        stamp: stampOf(r),
        ts: tsOf(r),
        category: 'updated',
        entityKind: r.entityType,
        activity: normActivity(label) || ACTIVITY_FROM_ACTION[r.action] || 'Edited',
        actor: r.actor || null,
        heading,
        change: {
          label,
          from,
          to,
          fromTone: pickTone(from),
          toTone: pickTone(to),
        },
      });
      continue;
    }
    nodes.push({
      id: r.id,
      anchor: r.id,
      icon: ENTITY_ICON[r.entityType] || CHANGE_ICON,
      stamp: stampOf(r),
      ts: tsOf(r),
      category: 'updated',
      entityKind: r.entityType,
      activity: ACTIVITY_FROM_ACTION[r.action] || normActivity(ACTION_LABEL[r.action]) || 'Edited',
      actor: r.actor || null,
      heading,
      items: r.detail ? [r.detail] : [ACTION_LABEL[r.action] || r.action],
    });
  }
  return nodes;
}

/**
 * Care Plan version changes — the itemised view behind a History entry's
 * open arrow. Where the History card counts what moved, this names it.
 *
 * @param {Array}  props.rows      Audit rows belonging to one signed version.
 * @param {string} props.signedAt  ISO timestamp of that version's signature.
 * @param {string} [props.anchor]  Block to scroll to on open, set when the
 *   caller arrives from a count badge.
 * @param {object} [props.plan]    Current plan slice, used to infer template
 *   linkage for rows signed before it was recorded.
 */
export function CarePlanVersionChangesDrawer({ rows, signedAt, anchor, plan, patientId, onClose }) {
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const platformUsers = useAppStore(s => s.platformUsers) || EMPTY_ARR;
  // The patient's own name, so an assignee that IS the patient tones as a
  // member (primary) rather than a provider (secondary). Look across every
  // worklist slice by id or member id, like CarePlanSummaryView does.
  const patientName = useAppStore(s => {
    if (!patientId) return null;
    const buckets = [s.patients, s.allPatients, s.snpMembers, s.ccmMembers, s.hccMembers, s.awvMembers, s.jsaMembers];
    for (const list of buckets) {
      if (!Array.isArray(list)) continue;
      const hit = list.find(p => p && (p.id === patientId || String(p.memberId) === String(patientId)));
      if (hit?.name) return hit.name;
    }
    return null;
  });
  // patient → 'patient', anyone else with a name → 'provider', blank → null.
  const classifyAssignee = useCallback((name) => {
    if (!name || name === 'Unassigned') return null;
    const patients = patientName ? [{ name: patientName }] : [];
    return isMemberAssignee(name, platformUsers, patients) ? 'patient' : 'provider';
  }, [platformUsers, patientName]);

  const nodes = useMemo(
    () => buildNodes(rows || [], { plan, libraryGoals, classifyAssignee }),
    [rows, plan, libraryGoals, classifyAssignee],
  );

  // Newest change first by default; "Sort by" flips to oldest first.
  const [sortDesc, setSortDesc] = useState(true);
  const [dateRange, setDateRange] = useState([]); // [] or [startISO, endISO]
  const [userFilter, setUserFilter] = useState([]);       // actor names
  const [entityFilter, setEntityFilter] = useState([]);   // Goal / Intervention / …
  const [activityFilter, setActivityFilter] = useState([]); // Status / Due Date / …

  // Each filter only offers values actually present in this version.
  const userOptions = useMemo(
    () => [...new Set(nodes.map(n => n.actor).filter(Boolean))].sort(),
    [nodes],
  );
  const entityOptions = useMemo(() => {
    const present = new Set(nodes.map(n => n.entityKind).filter(Boolean));
    return Object.keys(ENTITY_FILTER_LABEL).filter(k => present.has(k)).map(k => ENTITY_FILTER_LABEL[k]);
  }, [nodes]);
  const activityOptions = useMemo(
    () => [...new Set(nodes.map(n => n.activity).filter(Boolean))].sort(),
    [nodes],
  );
  const labelToEntity = useMemo(
    () => Object.fromEntries(Object.entries(ENTITY_FILTER_LABEL).map(([k, v]) => [v, k])),
    [],
  );

  const displayNodes = useMemo(() => {
    const [rangeStart, rangeEnd] = dateRange.length === 2 ? dateRange : [];
    const startMs = rangeStart ? new Date(`${rangeStart}T00:00:00`).getTime() : null;
    const endMs = rangeEnd ? new Date(`${rangeEnd}T23:59:59.999`).getTime() : null;
    const users = new Set(userFilter);
    const entities = new Set(entityFilter.map(l => labelToEntity[l]).filter(Boolean));
    const activities = new Set(activityFilter);
    const filtered = nodes.filter(n => {
      if (startMs != null && n.ts < startMs) return false;
      if (endMs != null && n.ts > endMs) return false;
      if (users.size && !users.has(n.actor)) return false;
      if (entities.size && !entities.has(n.entityKind)) return false;
      if (activities.size && !activities.has(n.activity)) return false;
      return true;
    });
    // Stable sort by timestamp; equal timestamps keep their build order so a
    // template's blocks stay together.
    return filtered
      .map((n, i) => [n, i])
      .sort((a, b) => (sortDesc ? b[0].ts - a[0].ts : a[0].ts - b[0].ts) || a[1] - b[1])
      .map(([n]) => n);
  }, [nodes, dateRange, userFilter, entityFilter, activityFilter, sortDesc, labelToEntity]);

  const bodyRef = useRef(null);
  // Entries open by default; the toggle is there to fold long ones away.
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggle = (id) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Goals in a template tree fold their linked items away independently of the
  // entry they sit in, and likewise start open.
  const [foldedGoals, setFoldedGoals] = useState(() => new Set());
  const toggleGoal = (key) => setFoldedGoals(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  useEffect(() => {
    if (!anchor) return undefined;
    const el = bodyRef.current?.querySelector(`[data-anchor="${anchor}"]`);
    if (!el) return undefined;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // The anchor names a block, but the design flashes the whole entry it sits
    // in, so the highlight climbs to the row.
    const target = el.closest(`.${htStyles.row}`) || el;
    target.classList.add(styles.highlight);
    const timer = setTimeout(() => target.classList.remove(styles.highlight), HIGHLIGHT_MS);
    return () => {
      clearTimeout(timer);
      target.classList.remove(styles.highlight);
    };
  }, [anchor, displayNodes]);

  const at = signedAt ? new Date(signedAt) : null;
  const stamp = at && !Number.isNaN(at.getTime())
    ? `${at.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';

  const title = (
    <span className={styles.titleWrap}>
      <span>Care Plan</span>
      {stamp && <span className={styles.subtitle}>Version Dated {stamp}</span>}
    </span>
  );

  // The version is one moment in time, so entries carry no timestamps of their
  // own — the drawer's subtitle already dates them.
  const logEntries = displayNodes.map(node => ({
    t: 'care_plan_change',
    id: node.id,
    avatar: <Avatar type="icon" variant="others" size="S" iconName={node.icon || ENTITY_ICON.plan} />,
    render: () => {
      const open = !collapsed.has(node.id);
      return (
        <div data-anchor={node.anchor}>
          {node.stamp && <MetaLine entry={node.stamp} />}
          <div className={htStyles.headlineRow}>
            <span className={htStyles.headline}>{node.heading}</span>
            {node.tag && <Badge tone={node.tag.tone} size="S" label={node.tag.label} />}
            <ViewMoreButton expanded={open} onToggle={() => toggle(node.id)} />
          </div>
          {open && (
            <>
              {node.items?.length > 0 && (
                <ul className={styles.items}>
                  {node.items.map((item, k) => <li key={k}>{item}</li>)}
                </ul>
              )}
              {node.summary && (
                <div className={styles.summary}>
                  <span className={styles.groupHeading}>{node.summary}</span>
                </div>
              )}
              {node.groups?.map((group, gi) => (
                <div key={gi} className={styles.group} data-anchor={group.anchor}>
                  {group.tree.map((item, k) => {
                    const key = `${node.id}:${gi}:${k}`;
                    const hasChildren = item.children?.length > 0;
                    const shown = hasChildren && !foldedGoals.has(key);
                    return (
                      <div key={k} className={styles.treeItem}>
                        <div
                          className={[styles.treeRow, hasChildren ? styles.treeRowToggle : ''].filter(Boolean).join(' ')}
                          role={hasChildren ? 'button' : undefined}
                          tabIndex={hasChildren ? 0 : undefined}
                          aria-expanded={hasChildren ? shown : undefined}
                          onClick={hasChildren ? () => toggleGoal(key) : undefined}
                          onKeyDown={hasChildren ? (e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            toggleGoal(key);
                          } : undefined}
                        >
                          <Avatar type="icon" variant="others" size="XS" iconName={item.icon} />
                          <span className={styles.treeText}>
                            <span className={styles.treeTitle}>{item.title}</span>
                            {item.counts && (
                              <span className={styles.treeCounts}>
                                {item.counts}
                                <DownChevronIcon
                                  size={12}
                                  color="var(--neutral-300)"
                                  className={shown ? styles.chevronOpen : styles.chevron}
                                />
                              </span>
                            )}
                          </span>
                        </div>
                        {hasChildren && (
                          <div className={[styles.treeChildren, shown ? styles.treeChildrenOpen : ''].filter(Boolean).join(' ')}>
                            <div className={styles.treeChildrenInner}>
                              {item.children.map((child, ci) => (
                                <div key={ci} className={styles.treeChild}>
                                  <div className={styles.treeRow}>
                                    <Avatar type="icon" variant="others" size="S" iconName={child.icon} />
                                    <span className={styles.treeTitle}>{child.title}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {node.change && (
                <div className={styles.change}>
                  <span>{node.change.label}:</span>
                  <Badge tone={node.change.fromTone} size="S" label={node.change.from} />
                  <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-200)" />
                  <Badge tone={node.change.toTone} size="S" label={node.change.to} />
                </div>
              )}
            </>
          )}
        </div>
      );
    },
  }));

  // Full-width filter bar, mirroring the worklist FilterBar: date-range chip
  // (same DateRangePopover the worklists use) plus User / Change type /
  // Activity type / Sort by. Rendered in the Drawer's banner slot so it hugs
  // the drawer edges and stays pinned under the title while the list scrolls.
  const dateActive = dateRange.length === 2;
  const controls = nodes.length > 0 ? (
    <div className={styles.controls}>
      <FilterChip
        label="Date range"
        active={dateActive}
        activeSummary={dateActive ? `${fmtShortDate(dateRange[0])} – ${fmtShortDate(dateRange[1])}` : undefined}
        onClear={() => setDateRange([])}
        renderPopover={({ anchorRect, onClose: closePopover }) => (
          <DateRangePopover
            anchorRect={anchorRect}
            label="Date range"
            selected={dateRange}
            onChange={setDateRange}
            onClose={closePopover}
          />
        )}
      />
      {userOptions.length > 1 && (
        <FilterChip label="User" options={userOptions} selected={userFilter} onChange={setUserFilter} searchable />
      )}
      {entityOptions.length > 1 && (
        <FilterChip label="Change type" options={entityOptions} selected={entityFilter} onChange={setEntityFilter} />
      )}
      {activityOptions.length > 1 && (
        <FilterChip label="Activity type" options={activityOptions} selected={activityFilter} onChange={setActivityFilter} searchable />
      )}
      <FilterChip
        label="Sort by"
        singleSelect
        options={['Newest first', 'Oldest first']}
        selected={[sortDesc ? 'Newest first' : 'Oldest first']}
        onChange={(v) => setSortDesc((v[0] || 'Newest first') === 'Newest first')}
      />
    </div>
  ) : null;

  return (
    <Drawer title={title} onClose={onClose} banner={controls}>
      <div ref={bodyRef}>
        <ActivityLog entries={logEntries} emptyLabel="No changes match this filter." />
      </div>
    </Drawer>
  );
}
