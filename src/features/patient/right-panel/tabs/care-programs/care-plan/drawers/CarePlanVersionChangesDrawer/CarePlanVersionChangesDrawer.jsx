import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { FilterChip } from '../../../../../../../../components/FilterChip/FilterChip';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { ActivityLog, MetaLine, ViewMoreButton } from '../../../../../../../../components/ActivityLog/ActivityLog';
import { historyTimelineStyles as htStyles } from '../../../../../../../../components/HistoryTimeline/HistoryTimeline';
import {
  TEMPLATE_RENEWAL_ACTIVITY,
  isTemplateRenewal,
  templateContents,
  templateOwnedTitles,
  withLiveLinks,
} from '../../lib/carePlanAuditTemplates';
import { NOTE_ACTIONS, netVersionRows } from '../../lib/carePlanVersions';
import { computeDueDate, isMemberAssignee } from '../../tables/CarePlanInterventionsTable';
import { GbiLinkButton } from '../../tables/CarePlanLinkedPreview';
import { linkedForChild, linkedForGoal } from '../../CarePlanView/carePlanLinkedItems';
import { formatGoalDuration, formatGoalTarget, normalizeCategory } from '../../../../../../../settings/care-plan-library/lib';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { KIND_LABELS } from '../../../../../../../settings/care-plan-library/interventions/shared/interventionKinds';
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
// Additions and removals read from the rail: a green plus or a red minus.
// Edits keep the item's own glyph in grey.
const CATEGORY_RAIL = {
  added: { icon: 'solar:add-circle-linear', variant: 'success' },
  removed: { icon: 'solar:minus-circle-linear', variant: 'error' },
};
// The timeline is sectioned by what changed, in this order.
const SECTIONS = [
  ['template', 'Templates'], ['goal', 'Goals'], ['intervention', 'Interventions'],
  ['barrier', 'Barriers'], ['note', 'Notes'], ['plan', 'Care Plan'],
];
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

// "Label: from → to" in an audit row's detail, with the tones its badges take.
function changeOf(r, links) {
  const arrow = (r.detail || '').split('→');
  if (arrow.length !== 2) return null;
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
  return { label, from, to, fromTone: pickTone(from), toTone: pickTone(to) };
}

// "Created 10/01/2026 • Due 11/01/2026 • Recurring" for an intervention's task.
function interventionSchedule(item) {
  const created = item.createdAt ? new Date(item.createdAt) : null;
  const due = computeDueDate(item).formatted;
  return [
    created && !Number.isNaN(created.getTime()) && `Created ${created.toLocaleDateString('en-US', MM_DD_YYYY)}`,
    due ? `Due ${due}` : 'No due date',
    item.config?.repeat ? 'Recurring' : 'One-time',
  ].filter(Boolean).join(' • ');
}

// Title, type and target of an added or removed item, with what it linked to
// in the same snapshot (the same data the plan's link button previews).
// Nested in a template (Figma Mar-Present 4089:2765) a goal reads its target
// and duration bare, and the row carries the item's priority.
function entityDetails(type, item, fallbackTitle, scope, { nested = false } = {}) {
  const title = item?.title || fallbackTitle || '';
  if (!item) return { title, typeLabel: null, subline: null, linked: null, priority: null };
  const priority = nested ? item.priority || null : null;
  if (type === 'goal') {
    const target = formatGoalTarget(item);
    return {
      title,
      typeLabel: item.category ? normalizeCategory(item.category) : null,
      subline: nested
        ? [target, formatGoalDuration(item)].filter(Boolean).join(' • ') || null
        : (target ? `Target: ${target}` : null),
      linked: linkedForGoal(item, scope),
      priority,
    };
  }
  return {
    title,
    typeLabel: type === 'intervention' ? (KIND_LABELS[item.kind] || null) : null,
    subline: type === 'intervention' ? interventionSchedule(item) : null,
    linked: linkedForChild(item, scope),
    priority,
  };
}

// What a template brought, as Goals / Interventions / Barriers sections of
// item rows. Items are matched by title in the snapshot the template lived
// in; one the snapshot lacks still lists, linked by the template's own record.
function templateSections(contents, scope) {
  const byTitle = (type, title) => (scope?.[`${type}s`] || []).find(x => norm(x.title) === norm(title)) || null;
  const asLinks = titles => titles.map(title => ({ id: title, title }));
  const goals = contents.goals.map(g => {
    const item = byTitle('goal', g.title);
    const details = entityDetails('goal', item, g.title, scope, { nested: true });
    if (!item) details.linked = { interventions: asLinks(g.interventions), barriers: asLinks(g.barriers) };
    return { key: `goal:${g.title}`, ...details };
  });
  const childRows = (type, titles) => [...new Set(titles)].map(title => {
    const item = byTitle(type, title);
    const details = entityDetails(type, item, title, scope, { nested: true });
    if (!item) {
      const owners = contents.goals.filter(g => g[`${type}s`].includes(title));
      details.linked = { goals: asLinks(owners.map(g => g.title)) };
    }
    return { key: `${type}:${title}`, ...details };
  });
  return [
    { type: 'goal', rows: goals },
    { type: 'intervention', rows: childRows('intervention', [...contents.goals.flatMap(g => g.interventions), ...contents.interventions]) },
    { type: 'barrier', rows: childRows('barrier', [...contents.goals.flatMap(g => g.barriers), ...contents.barriers]) },
  ].filter(sec => sec.rows.length);
}

const norm = v => (v || '').trim().toLowerCase();

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
  const kept = allRows.filter(r => r.entityType !== 'template'
    && r.action !== 'shared'
    && !((r.action === 'created' || r.action === 'deleted')
      && owned.has((r.summary || '').trim().toLowerCase())));
  // Changes inside a template that was already on the plan read as an update
  // to that template, not as loose edits.
  const rows = kept.filter(r => !r.template);
  const byTemplate = new Map();
  for (const r of kept.filter(row => row.template)) {
    if (!byTemplate.has(r.template.id)) byTemplate.set(r.template.id, { template: r.template, rows: [] });
    byTemplate.get(r.template.id).rows.push(r);
  }
  for (const { template, rows: changed } of byTemplate.values()) {
    const newest = changed.reduce((a, b) => (tsOf(b) > tsOf(a) ? b : a));
    const priority = changed.find(r => r.entityType === 'plan');
    const sections = ['goal', 'intervention', 'barrier'].map(type => ({
      type,
      rows: changed.filter(r => r.entityType === type).map(r => {
        if (r.action === 'created' || r.action === 'deleted') {
          const scope = r.scope || links.plan;
          const item = r.item || (scope?.[`${type}s`] || []).find(x => String(x.id) === String(r.entityId)) || null;
          const dot = CATEGORY_RAIL[r.action === 'created' ? 'added' : 'removed'].variant;
          return { key: r.id, dot, ...entityDetails(type, item, r.summary, scope, { nested: true }) };
        }
        return { key: r.id, title: r.summary, change: changeOf(r, links), detail: r.detail };
      }),
    })).filter(sec => sec.rows.length);
    nodes.push({
      id: `template-updated-${template.id}`,
      anchor: template.id,
      icon: CHANGE_ICON,
      heading: `${template.name || 'Template'} Template Updated`,
      stamp: stampOf(newest),
      ts: tsOf(newest),
      category: 'updated',
      entityKind: 'template',
      activity: 'Updated',
      actor: newest.actor || null,
      sections,
      change: priority ? changeOf(priority, links) : null,
    });
  }

  for (const t of templates.filter(isTemplateRenewal)) {
    nodes.push({
      id: t.id,
      anchor: t.id,
      icon: TEMPLATE_ICON,
      heading: `${t.summary} Template ${TEMPLATE_RENEWAL_ACTIVITY[t.action]}`,
      stamp: stampOf(t),
      ts: tsOf(t),
      category: 'updated',
      entityKind: 'template',
      activity: TEMPLATE_RENEWAL_ACTIVITY[t.action],
      actor: t.actor || null,
      items: t.detail ? [t.detail] : [],
    });
  }
  for (const t of templates.filter(r => !isTemplateRenewal(r))) {
    const c = withLiveLinks(templateContents(t), links);
    nodes.push({
      id: t.id,
      anchor: t.id,
      icon: TEMPLATE_ICON,
      heading: `${t.summary} Template ${t.action === 'created' ? 'Added' : 'Removed'}`,
      stamp: stampOf(t),
      ts: tsOf(t),
      category: t.action === 'created' ? 'added' : 'removed',
      entityKind: 'template',
      activity: t.action === 'created' ? 'Added' : 'Removed',
      actor: t.actor || null,
      sections: templateSections(c, t.scope || links.plan),
    });
  }

  // Each goal, intervention and barrier added or removed is its own entry.
  // The row carries the item and the snapshot it lived in; rows from before
  // snapshots were kept fall back to the plan as it is now.
  for (const r of rows) {
    if (r.action !== 'created' && r.action !== 'deleted') continue;
    if (!ENTITY_ICON[r.entityType] || r.entityType === 'plan') continue;
    const scope = r.scope || links.plan;
    const item = r.item
      || (scope?.[`${r.entityType}s`] || []).find(x => String(x.id) === String(r.entityId))
      || null;
    nodes.push({
      id: r.id,
      anchor: `${r.action}-${r.entityType}`,
      icon: ENTITY_ICON[r.entityType],
      stamp: stampOf(r),
      ts: tsOf(r),
      category: r.action === 'created' ? 'added' : 'removed',
      entityKind: r.entityType,
      activity: r.action === 'created' ? 'Added' : 'Removed',
      actor: r.actor || null,
      entity: entityDetails(r.entityType, item, r.summary, scope),
    });
  }

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
    const change = changeOf(r, links);
    if (change) {
      nodes.push({
        id: r.id,
        anchor: r.id,
        icon: CHANGE_ICON,
        stamp: stampOf(r),
        ts: tsOf(r),
        category: 'updated',
        entityKind: r.entityType,
        activity: normActivity(change.label) || ACTIVITY_FROM_ACTION[r.action] || 'Edited',
        actor: r.actor || null,
        heading,
        change,
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

// A row's dot on a template section's line: grey, or green / red for an item
// added to or removed from a template already on the plan.
function ChainDot({ tone = 'grey' }) {
  return <span className={`${styles.chainDot} ${styles[`chainDot-${tone}`] || ''}`} aria-hidden />;
}

// One goal, intervention or barrier: title over its target or schedule, the
// type at the right and, on hover, the link button before it. Rows nested in
// a template (`chained`) sit on their section's line behind a dot.
function EntityRow({ entity, anchor, chained = false }) {
  const { title, typeLabel, subline, linked, priority, dot } = entity;
  return (
    <div data-anchor={anchor} className={styles.entity}>
      {chained && <ChainDot tone={dot} />}
      <div className={styles.entityText}>
        <span className={htStyles.headline}>{title}</span>
        {subline && <div className={styles.target}>{subline}</div>}
      </div>
      <span className={styles.entityRight}>
        <span className={styles.entityLink}>
          <GbiLinkButton data={linked} keepSlot />
        </span>
        {typeLabel && <Badge tone="grey" size="S" label={typeLabel} />}
        {priority && <PriorityIcon priority={priority} size={16} />}
      </span>
    </div>
  );
}

// An edit to an item inside a template: its title over "Label: from → to".
function ChangeRow({ row }) {
  return (
    <div className={styles.entity}>
      <ChainDot />
      <div className={styles.entityText}>
        <span className={htStyles.headline}>{row.title}</span>
        {row.change ? (
          <div className={styles.change}>
            <span>{row.change.label}:</span>
            <Badge tone={row.change.fromTone} size="S" label={row.change.from} />
            <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-200)" />
            <Badge tone={row.change.toTone} size="S" label={row.change.to} />
          </div>
        ) : (
          row.detail && <div className={styles.target}>{row.detail}</div>
        )}
      </div>
    </div>
  );
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
export function CarePlanVersionChangesDrawer({ rows, signedAt, anchor, plan, patientId, onClose, versionNumber = null, current = false, draft = false, signedBy = '' }) {
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

  const [entityFilter, setEntityFilter] = useState([]);   // Goal / Intervention / …
  const [activityFilter, setActivityFilter] = useState([]); // Status / Due Date / …

  // Each filter only offers values actually present in this version.
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
    const entities = new Set(entityFilter.map(l => labelToEntity[l]).filter(Boolean));
    const activities = new Set(activityFilter);
    const filtered = nodes.filter(n => {
      if (entities.size && !entities.has(n.entityKind)) return false;
      if (activities.size && !activities.has(n.activity)) return false;
      return true;
    });
    // Newest first, stable: equal timestamps keep their build order so a
    // template's blocks stay together.
    return filtered
      .map((n, i) => [n, i])
      .sort((a, b) => b[0].ts - a[0].ts || a[1] - b[1])
      .map(([n]) => n);
  }, [nodes, entityFilter, activityFilter, labelToEntity]);

  const bodyRef = useRef(null);
  // Entries open by default; the toggle is there to fold long ones away.
  // Templates are the exception: they start folded, since each can bring
  // dozens of items.
  const [collapsed, setCollapsed] = useState(() => new Set());
  // A count badge that points into a template opens that template.
  const [openTemplates, setOpenTemplates] = useState(() => new Set(
    anchor ? nodes.filter(n => n.entityKind === 'template' && (anchor === n.id || anchor.startsWith(`${n.id}-`))).map(n => n.id) : [],
  ));
  const flip = setter => id => setter(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggle = flip(setCollapsed);
  const toggleTemplate = flip(setOpenTemplates);
  // A template's Goals / Interventions / Barriers fold on their own.
  const [foldedSections, setFoldedSections] = useState(() => new Set());
  const toggleSection = flip(setFoldedSections);

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
    ? `${at.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} • ${at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';

  // "Care Plan • Version 3", with the version's state beside it: Current
  // (as the Versions view marks it) or Draft for unsigned changes.
  const title = (
    <span className={styles.titleWrap}>
      <span className={styles.titleRow}>
        {versionNumber ? `Care Plan • Version ${versionNumber}` : 'Care Plan'}
        {current && !draft && (
          <span className={styles.currentPill}>
            <span className={styles.currentPillText}>Current</span>
          </span>
        )}
        {draft && <Badge size="S" tone="grey" label="Draft" />}
      </span>
      {stamp && (
        <span className={styles.subtitle}>
          {draft ? `Last edited • ${stamp}` : [signedBy && `Signed by ${signedBy}`, stamp].filter(Boolean).join(' • ')}
        </span>
      )}
    </span>
  );

  const sectioned = SECTIONS.flatMap(([kind, label]) => {
    const inSection = displayNodes.filter(n => (n.entityKind || 'plan') === kind);
    return inSection.length ? [{ t: 'group', label }, ...inSection] : [];
  });
  const known = new Set(SECTIONS.map(([kind]) => kind));
  const rest = displayNodes.filter(n => !known.has(n.entityKind || 'plan'));

  const logEntries = [...sectioned, ...rest].map(node => (node.t === 'group' ? node : {
    t: 'care_plan_change',
    id: node.id,
    avatar: (
      // A two-line item (title over target) drops its icon to the middle of
      // the pair; the spacer carries the rail line down to it.
      <span className={node.entity?.subline ? styles.railCentered : styles.railPlain}>
        <Avatar
          type="icon"
          variant={CATEGORY_RAIL[node.category]?.variant || 'others'}
          size="S"
          iconName={CATEGORY_RAIL[node.category]?.icon || node.icon || ENTITY_ICON.plan}
        />
      </span>
    ),
    render: () => {
      if (node.entity) return <EntityRow entity={node.entity} anchor={node.anchor} />;
      const isTemplate = node.entityKind === 'template';
      const open = isTemplate ? openTemplates.has(node.id) : !collapsed.has(node.id);
      return (
        <div data-anchor={node.anchor}>
          {node.stamp && <MetaLine entry={node.stamp} />}
          <div className={htStyles.headlineRow}>
            <span className={htStyles.headline}>{node.heading}</span>
            {(!isTemplate || node.sections?.length > 0 || node.items?.length > 0 || node.change) && (
              <ViewMoreButton
                leadingDot
                expanded={open}
                onToggle={() => (isTemplate ? toggleTemplate(node.id) : toggle(node.id))}
              />
            )}
          </div>
          {open && (
            <>
              {node.items?.length > 0 && (
                <ul className={styles.items}>
                  {node.items.map((item, k) => <li key={k}>{item}</li>)}
                </ul>
              )}
              {node.sections?.map(sec => (
                <div key={sec.type} className={styles.nestedSection} data-anchor={`${node.id}-${sec.type}`}>
                  {(() => {
                    const key = `${node.id}:${sec.type}`;
                    const shown = !foldedSections.has(key);
                    return (
                      <>
                        <button
                          type="button"
                          className={styles.sectionToggle}
                          aria-expanded={shown}
                          onClick={() => toggleSection(key)}
                        >
                          <span className={styles.sectionBranch} aria-hidden />
                          <span className={styles.sectionChevron}>
                            <DownChevronIcon
                              size={12}
                              color="var(--primary-300)"
                              className={shown ? undefined : styles.sectionChevronFolded}
                            />
                          </span>
                          {ENTITY_NOUN[sec.type][1]}
                        </button>
                        {shown && sec.rows.map(row => (row.change !== undefined
                          ? <ChangeRow key={row.key} row={row} />
                          : <EntityRow key={row.key} entity={row} chained />))}
                      </>
                    );
                  })()}
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

  // Change type / Activity type, in the Drawer's banner slot so they hug the
  // drawer edges and stay pinned under the title while the list scrolls.
  const controls = entityOptions.length > 1 || activityOptions.length > 1 ? (
    <div className={styles.controls}>
      {entityOptions.length > 1 && (
        <FilterChip label="Change type" options={entityOptions} selected={entityFilter} onChange={setEntityFilter} />
      )}
      {activityOptions.length > 1 && (
        <FilterChip label="Activity type" options={activityOptions} selected={activityFilter} onChange={setActivityFilter} searchable />
      )}
    </div>
  ) : null;

  return (
    <Drawer title={title} onClose={onClose} banner={controls}>
      <div ref={bodyRef} className={controls ? styles.timeline : undefined}>
        <ActivityLog entries={logEntries} emptyLabel="No changes match this filter." />
      </div>
    </Drawer>
  );
}
