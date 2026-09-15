import { useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { ActivityLog, MetaLine, ViewMoreButton } from '../../../../../../../../components/ActivityLog/ActivityLog';
import { historyTimelineStyles as htStyles } from '../../../../../../../../components/HistoryTimeline/HistoryTimeline';
import { groupByMonth } from '../../../../../../../../components/Timeline/Timeline.utils';
import { AuditDetailCard } from '../../../../../../../../components/AuditDetailCard/AuditDetailCard';
import { CarePlanVersionChangesDrawer } from '../CarePlanVersionChangesDrawer/CarePlanVersionChangesDrawer';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import {
  templateContents,
  templateOwnedTitles,
  withLiveLinks,
} from '../../lib/carePlanAuditTemplates';
import {
  NOTE_ACTIONS,
  groupByVersion,
  netVersionRows,
  standaloneEvents,
  versionLabel,
} from '../../lib/carePlanVersions';
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

// A version can hold several share events; only the most recent one describes
// where the plan actually stands, so the attribution names that one. `rows` is
// oldest-first, so the last match is the latest share.
function latestShare(rows) {
  const last = [...rows].reverse().find(r => r.action === 'shared');
  return last?.summary || null;
}

// A counted section covers several entity types; clicking it lands on the
// first one the version actually touched.
function firstEntityType(rows) {
  return Object.keys(ENTITY_NOUN).find(type => rows.some(r => r.entityType === type))
    || 'goal';
}

// Collapsed gist of a version, as badges: how many templates it brought in and
// how many changes it made per entity. Built from the same net rows the
// expanded card uses, so the counts cannot disagree with what opens below.
function versionBadges(group) {
  const rows = netVersionRows(group.rows);
  const templates = rows.filter(r => r.entityType === 'template');
  const owned = templateOwnedTitles(templates);
  // A template's own goals and items are reported by its badge, not counted
  // again as individual changes.
  const plain = rows.filter(r => r.entityType !== 'template'
    && r.action !== 'shared'
    && !((r.action === 'created' || r.action === 'deleted')
      && owned.has((r.summary || '').trim().toLowerCase())));

  const badges = [];
  const addedTemplates = templates.filter(t => t.action === 'created').length;
  const removedTemplates = templates.filter(t => t.action === 'deleted').length;
  if (addedTemplates) {
    badges.push({ label: `${addedTemplates} Template${addedTemplates === 1 ? '' : 's'} Added`, icon: CARE_PLAN_ICON });
  }
  if (removedTemplates) {
    badges.push({ label: `${removedTemplates} Template${removedTemplates === 1 ? '' : 's'} Removed`, icon: CARE_PLAN_ICON });
  }
  for (const type of Object.keys(ENTITY_NOUN)) {
    const n = plain.filter(r => r.entityType === type).length;
    if (!n) continue;
    badges.push({ label: `${n} ${ENTITY_NOUN[type][0]} Change${n === 1 ? '' : 's'}`, icon: ENTITY_ICON[type] });
  }
  return badges;
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

// Read-only history of everything that happened to this program's care plan —
// edits, status changes, removals and shares (roadmap #9).
export function CarePlanHistoryDrawer({ patientId, program, onClose }) {
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  const key = `${patientId}::${program.id}`;
  const entries = useAppStore(s => s.patientCarePlanAudit[key]);
  const loading = useAppStore(s => s.patientCarePlanAuditLoading[key]);
  const currentUserName = useAppStore(s => s.currentUserProfile?.name);
  const plan = useAppStore(s => s.patientCarePlans[key]);
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const links = useMemo(() => ({ plan, libraryGoals }), [plan, libraryGoals]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [openVersion, setOpenVersion] = useState(null);

  useEffect(() => {
    if (entries === undefined) fetchCarePlanAudit(patientId, program.id);
  }, [entries, patientId, program.id, fetchCarePlanAudit]);

  const isCurrentUser = useCallback(
    (name) => Boolean(currentUserName && name && name.toLowerCase() === currentUserName.toLowerCase()),
    [currentUserName],
  );

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // ActivityLog takes a flat list: a `group` row opens each month, then one
  // entry per signed version rendering its own body.
  // A note or a restore can happen with no signature in sight, so each is its
  // own entry rather than part of a version's difference.
  const renderStandalone = (e) => {
    const at = e.createdAt ? new Date(e.createdAt) : null;
    const isNote = NOTE_ACTIONS.has(e.action);
    const removed = isNote && e.action !== 'note';
    const heading = isNote
      ? (removed ? 'Care Plan Note Removed' : 'Care Plan Note Updated')
      : e.summary;
    return (
      <>
        <MetaLine entry={{
          date: at ? at.toLocaleDateString('en-US', MM_DD_YYYY) : null,
          time: at ? at.toLocaleTimeString('en-US', HH_MM) : null,
          by: e.actor,
          role: isCurrentUser(e.actor) ? 'Current User' : null,
        }} />
        <div className={htStyles.headlineRow}>
          <span className={htStyles.headline}>{heading}</span>
        </div>
        {isNote && !removed && e.detail && (
          <div className={styles.noteBody}>{e.detail}</div>
        )}
      </>
    );
  };

  const logEntries = useMemo(() => {
    const versions = groupByVersion(entries || []);
    const events = standaloneEvents(entries || []).map(e => ({
      ...e,
      standalone: true,
      // groupByMonth reads createdAt, which both shapes already carry.
    }));
    const timeline = [...versions, ...events]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return groupByMonth(timeline).flatMap(month => [
      { t: 'group', label: month.label },
      ...month.entries.map(g => {
        if (g.standalone) {
          return {
            t: 'care_plan_event',
            id: g.id,
            avatar: (
              <Avatar
                type="icon"
                variant="others"
                size="S"
                iconName={NOTE_ACTIONS.has(g.action) ? 'solar:notes-linear' : 'custom:history'}
              />
            ),
            render: () => renderStandalone(g),
          };
        }
        const at = g.createdAt ? new Date(g.createdAt) : null;
        const isOpen = expanded.has(g.id);
        const version = versionLabel(g.signed);
        const badges = versionBadges(g);
        const header = [
          `Signed by: ${g.actor || 'Unknown'}`,
          version,
          latestShare(g.rows),
        ].filter(Boolean);
        return {
          t: 'care_plan_version',
          id: g.id,
          avatar: <Avatar type="icon" variant="others" size="S" iconName={CARE_PLAN_ICON} />,
          render: () => (
            <>
              <MetaLine entry={{
                date: at ? at.toLocaleDateString('en-US', MM_DD_YYYY) : null,
                time: at ? at.toLocaleTimeString('en-US', HH_MM) : null,
                by: g.actor,
                role: isCurrentUser(g.actor) ? 'Current User' : null,
              }} />
              <div className={htStyles.headlineRow}>
                <span className={htStyles.headline}>Care Plan Updated</span>
                <ViewMoreButton expanded={isOpen} onToggle={() => toggle(g.id)} />
              </div>
              {badges.length > 0 && (
                <div className={styles.summaryBadges}>
                  {badges.map(b => (
                    <Badge key={b.label} tone="grey" size="S" icon={b.icon} label={b.label} />
                  ))}
                </div>
              )}
              {isOpen && (
                <div className={styles.detailsWrap}>
                  <AuditDetailCard
                    header={header}
                    sections={sectionsFor(g, anchor => setOpenVersion({ ...g, anchor }), links)}
                    onOpen={() => setOpenVersion(g)}
                    openTooltip="View changes"
                  />
                </div>
              )}
            </>
          ),
        };
      }),
    ]);
  }, [entries, expanded, isCurrentUser]); // eslint-disable-line react-hooks/exhaustive-deps -- renderStandalone is derived from isCurrentUser

  return (
    <Drawer title="Care Plan History" onClose={onClose}>
      <ActivityLog
        entries={logEntries}
        emptyLabel={loading ? 'Loading history…' : 'No signed care plan versions yet.'}
      />
      {openVersion && (
        <CarePlanVersionChangesDrawer
          rows={openVersion.rows}
          signedAt={openVersion.createdAt}
          anchor={openVersion.anchor}
          plan={plan}
          onClose={() => setOpenVersion(null)}
        />
      )}
    </Drawer>
  );
}
