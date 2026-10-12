import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { TabStrip } from '../../../../../../../../components/TabStrip/TabStrip';
import { Toggle } from '../../../../../../../../components/Toggle/Toggle';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { BulkBar } from '../../../../../../../../components/BulkBar/BulkBar';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { PatientBanner } from '../../../../../../../../components/PatientBanner/PatientBanner';
import { findPatientRecord } from '../../lib/carePlanPrintSettings';
import { latestItemNote } from '../../lib/carePlanNotes';
import { GBI_STATUSES } from '../../CarePlanView/CarePlanViewSections';
import { GoalPreviewDrawer } from '../GoalPreviewDrawer/GoalPreviewDrawer';
import { InterventionPreviewDrawer } from '../InterventionPreviewDrawer/InterventionPreviewDrawer';
import { BarrierDetailDrawer } from '../BarrierDetailDrawer/BarrierDetailDrawer';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { carePlanKey } from '../../../../../../../../store/lib/carePlanStoreLib';
import { noteSummaryLookup } from '../../CarePlanView/carePlanLinkedItems';
import { CARE_PLAN_INTERVENTION_MENU } from '../../lib/carePlanInterventionMenu';
import { ReviewItemRow } from './ReviewItemRow';
import { CarePlanActivityBlock } from '../CarePlanActivityBlock/CarePlanActivityBlock';
import { PLAN_ACTIVITY_FILTERS, planActivityEntries } from './planActivityEntries';
import { ReviewDrawerSkeleton } from './ReviewDrawerSkeleton';
import { ReviewTimer } from './ReviewTimer';
import bones from '../../../../../../../../components/TableSkeleton/TableSkeleton.module.css';
import styles from './CarePlanReviewDrawer.module.css';

const KINDS = {
  goals: { kind: 'goal', noun: 'goal', title: 'Goals' },
  interventions: { kind: 'intervention', noun: 'intervention', title: 'Interventions' },
  barriers: { kind: 'barrier', noun: 'barrier', title: 'Barriers' },
};

// A group's icon from words in its condition (or category) name.
const GROUP_ICONS = [
  [/heart|hypertension|blood pressure|cardio/i, 'solar:heart-pulse-linear'],
  [/diabet|kidney|glucose/i, 'solar:waterdrops-linear'],
  [/medic|pharm/i, 'solar:pill-linear'],
  [/nutrition|diet|food/i, 'solar:leaf-linear'],
  [/activity|exercise|fall|mobility/i, 'solar:running-round-linear'],
  [/copd|asthma|respir/i, 'solar:wind-linear'],
  [/pain/i, 'solar:medical-kit-linear'],
  [/social|housing|transport/i, 'solar:home-2-linear'],
  [/hospital|care|coordination|transition/i, 'solar:health-linear'],
  [/lab/i, 'solar:test-tube-linear'],
];
const groupIcon = label => GROUP_ICONS.find(([re]) => re.test(label))?.[1] || 'solar:flag-linear';
// Goals group by their condition (the health area), falling back to a
// category that says something, else Other.
const goalGroupOf = g => g?.conditions?.[0] || (g?.category && g.category !== 'Others' ? g.category : 'Other');
const KIND_META = Object.fromEntries(CARE_PLAN_INTERVENTION_MENU.filter(i => i.key).map(i => [i.key, i]));
const DONE = new Set(['Met', 'Completed', 'Resolved']);
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// The call note is rich text: an emptied editor can still hold <br> or <p></p>.
const plainText = html => (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

function groupsFor(tab, items, goalsById) {
  const groups = new Map();
  const add = (label, icon, item) => {
    if (!groups.has(label)) groups.set(label, { label, icon, items: [] });
    groups.get(label).items.push(item);
  };
  for (const item of items) {
    if (tab === 'goals') {
      const label = goalGroupOf(item);
      add(label, groupIcon(label), item);
    } else if (tab === 'interventions') {
      // Under the health area of the goal they serve; unlinked ones by type.
      const goal = goalsById.get(item.goalId);
      const label = goal ? goalGroupOf(goal) : (KIND_META[item.kind]?.label || 'Other');
      add(label, goal ? groupIcon(label) : (KIND_META[item.kind]?.icon || 'solar:checklist-minimalistic-linear'), item);
    } else {
      const resolved = DONE.has(item.status);
      add(resolved ? 'Resolved' : 'Open', resolved ? 'solar:check-circle-linear' : 'solar:signpost-2-linear', item);
    }
  }
  // Biggest groups first, Other last.
  return [...groups.values()].sort((a, b) => (a.label === 'Other') - (b.label === 'Other') || b.items.length - a.items.length);
}

function fmtStamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function CallTimer({ seconds }) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return <Badge size="S" tone="success" icon="solar:phone-calling-linear" label={`On call · ${m}:${s}`} />;
}

/**
 * Review a patient's care plan on a call, opened from a worklist's Care Plan
 * Status. Goals, interventions and barriers are grouped and ticked off as
 * they are discussed; each expands to its dates, progress, status and a note
 * with quick tags. What was discussed and the call's general note are kept
 * on the review (care_plan_call_reviews) until Finish review.
 */
export function CarePlanReviewDrawer({ patientId, patientName, patient, program, onClose }) {
  const key = carePlanKey(patientId, program.id);
  const slice = useAppStore(s => s.patientCarePlans[key]);
  const loaded = useAppStore(s => !!s.patientCarePlanLoadedFor[key]);
  const audit = useAppStore(s => s.patientCarePlanAudit[key]);
  const review = useAppStore(s => s.carePlanReviews[key]);
  const noteReads = useAppStore(s => s.carePlanNoteReads);
  const me = useAppStore(s => s.currentUserProfile?.name || '');
  const onCall = useAppStore(s => String(s.activeCallPatient ?? '') === String(patientId));
  const callSeconds = useAppStore(s => s.activeCallSeconds);
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  const fetchCarePlanReviews = useAppStore(s => s.fetchCarePlanReviews);
  const fetchCarePlanNoteReads = useAppStore(s => s.fetchCarePlanNoteReads);
  const toggleItem = useAppStore(s => s.toggleCarePlanReviewItem);
  const markDiscussed = useAppStore(s => s.markCarePlanReviewItemDiscussed);
  const markManyDiscussed = useAppStore(s => s.markCarePlanReviewItemsDiscussed);
  const setItemTags = useAppStore(s => s.setCarePlanReviewItemTags);
  const saveCallNote = useAppStore(s => s.saveCarePlanReviewNote);
  const finishReview = useAppStore(s => s.finishCarePlanReview);
  const saveLive = useAppStore(s => s.saveCarePlanLiveField);
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const markNoteSeen = useAppStore(s => s.markCarePlanNoteSeen);
  const navigateToPatient = useAppStore(s => s.navigateToPatient);
  const showToast = useAppStore(s => s.showToast);

  useEffect(() => {
    fetchPatientCarePlan(patientId, program.id);
    fetchCarePlanAudit(patientId, program.id);
    fetchCarePlanReviews(patientId, program.id);
    fetchCarePlanNoteReads();
  }, [patientId, program.id, fetchPatientCarePlan, fetchCarePlanAudit, fetchCarePlanReviews, fetchCarePlanNoteReads]);

  const [tab, setTab] = useState('goals');
  const [activityFiltersOpen, setActivityFiltersOpen] = useState(false);
  // The review clock: Start review sets startedAt and brings up the note
  // composer; Stop freezes it. Finish review records the duration.
  const [startedAt, setStartedAt] = useState(null);
  const [stoppedAt, setStoppedAt] = useState(null);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null); // `${kind}:${id}` with its note open
  const [statusMenu, setStatusMenu] = useState(null); // { kind, items, rect }
  const [selected, setSelected] = useState(() => new Set()); // item ids on the current tab
  const [preview, setPreview] = useState(null); // { kind, item }: the item's own drawer
  // Patient context: the worklist row's details, filled in from the record.
  const record = useMemo(() => findPatientRecord(useAppStore.getState(), patientId), [patientId]);
  const banner = {
    initials: patient?.initials || (patientName || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    name: patient?.name || patientName,
    gender: record?.gender || patient?.gender,
    age: record?.age || patient?.age,
    dob: record?.dob,
    memberId: patient?.memberId || record?.memberId,
  };
  const open = review?.open || null;
  const discussed = open?.discussed || {};
  const [callNote, setCallNote] = useState(null); // null: not edited, shows the saved one
  const callNoteValue = callNote ?? open?.callNote ?? '';
  const callNoteFilled = !!plainText(callNoteValue);

  const lists = {
    goals: slice?.goals || [],
    interventions: slice?.interventions || [],
    barriers: slice?.barriers || [],
  };
  const noteFor = useMemo(() => noteSummaryLookup(audit || [], noteReads, me), [audit, noteReads, me]);
  const isDiscussed = (kind, id) => !!discussed[`${kind}:${id}`];
  const discussedCount = (t) => lists[t].filter(i => isDiscussed(KINDS[t].kind, i.id)).length;
  const totalDiscussed = Object.keys(KINDS).reduce((n, t) => n + discussedCount(t), 0);

  const listTab = KINDS[tab];
  const items = listTab ? lists[tab] : [];
  const highCount = items.filter(i => (i.priority || '').toLowerCase() === 'high').length;
  const notDiscussedCount = items.filter(i => !isDiscussed(listTab?.kind, i.id)).length;
  const visible = items.filter(i => (filter === 'high' ? (i.priority || '').toLowerCase() === 'high'
    : filter === 'pending' ? !isDiscussed(listTab.kind, i.id) : true));
  const done = listTab ? items.length - notDiscussedCount : 0;

  const signed = !!slice?.plan?.signedAt;
  const lastVisit = useAppStore(s => {
    const p = (s.patients || []).find(x => x.id === patientId) || (s.allPatients || []).find(x => x.id === patientId);
    return p?.lastVisit || p?.last_visit || null;
  });
  // The whole plan's activity, each row naming its goal / intervention / barrier.
  const activity = useMemo(() => {
    const titles = new Map();
    for (const list of [slice?.goals, slice?.interventions, slice?.barriers,
      slice?.retired?.goals, slice?.retired?.interventions, slice?.retired?.barriers]) {
      for (const it of list || []) titles.set(String(it.id), it.title);
    }
    return planActivityEntries(audit || [], titles);
  }, [audit, slice]);
  const lastReview = review?.history?.[0] || null;
  const openItem = (kind, item) => { setPreview({ kind, item }); markNoteSeen(kind, item.id); };
  const toggleExpanded = (kind, id) => {
    const k = `${kind}:${id}`;
    setExpanded(prev => (prev === k ? null : k));
    markNoteSeen(kind, id);
  };

  const finish = async () => {
    const note = callNote == null ? undefined : (plainText(callNote) ? callNote : '');
    const saved = await finishReview(patientId, program, note, { startedAt, stoppedAt });
    if (!saved) return;
    showToast(`Review finished · ${plural(totalDiscussed, 'item')} discussed`);
    onClose();
  };

  const headerRight = (
    <>
      {onCall && <CallTimer seconds={callSeconds || 0} />}
      <ActionButton
        icon="solar:square-top-down-linear"
        size="M"
        tooltip="Open care plan"
        tooltipBelow
        tooltipLeft
        onClick={() => { onClose(); navigateToPatient?.(patientId); }}
      />
      <span className={styles.headerDivider} aria-hidden="true" />
      {startedAt == null ? (
        <Button variant="primary" size="S" leadingIcon="solar:play-linear" onClick={() => setStartedAt(Date.now())}>
          Start review
        </Button>
      ) : (
        <ReviewTimer startedAt={startedAt} stoppedAt={stoppedAt} onStop={() => setStoppedAt(Date.now())} />
      )}
      <span className={styles.headerDivider} aria-hidden="true" />
    </>
  );

  return (
    <Drawer
      title={(
        <span className={styles.title}>
          {`Review ${program.code || program.name || ''} care plan`.replace(/\s+/g, ' ')}
          <Badge size="S" tone={signed ? 'success' : 'grey'} label={signed ? 'Signed' : 'Draft'} />
        </span>
      )}
      onClose={onClose}
      headerRight={headerRight}
      noCloseDivider
      bodyClassName={styles.drawerBody}
      footerClassName={styles.footerEnter}
      footer={startedAt != null && (
        <div className={styles.composer}>
          <Textarea
            richText
            placeholder="General note for this call"
            value={callNoteValue}
            onChange={(v) => setCallNote(typeof v === 'string' ? v : (v?.target?.value ?? ''))}
            rows={2}
          />
          <div className={styles.composerRow}>
            <span className={styles.composerHint}>
              {totalDiscussed ? `${plural(totalDiscussed, 'item')} discussed will be attached` : 'Tick items as you discuss them'}
            </span>
            <Button variant="secondary" size="M" onClick={finish} disabled={!totalDiscussed && !callNoteFilled}>
              Finish review
            </Button>
            <Button
              variant="primary"
              size="M"
              disabled={!callNoteFilled || callNoteValue === (open?.callNote || '')}
              onClick={async () => {
                const saved = await saveCallNote(patientId, program, callNoteValue);
                if (saved) { setCallNote(null); showToast('Call note saved'); }
              }}
            >
              Save call note
            </Button>
          </div>
        </div>
      )}
    >
      <div className={styles.context}>
        {/* Full width, like the patient header elsewhere in the app. */}
        <PatientBanner
          initials={banner.initials}
          name={banner.name}
          gender={banner.gender}
          age={banner.age}
          dob={banner.dob}
          memberId={banner.memberId ? `#${banner.memberId}` : undefined}
          patientId={patientId}
        />
        {/* When this plan was last reviewed with the patient. */}
        <div className={styles.reviewedStrip}>
          <Icon name="solar:history-linear" size={14} color="var(--neutral-300)" />
          {!review ? (
            <span className={`${bones.bone} ${styles.skStrip}`} />
          ) : lastReview ? (
            <span>
              Last reviewed on <strong>{fmtStamp(lastReview.finishedAt)}</strong>
              {lastReview.createdBy ? ` by ${lastReview.createdBy}` : ''}
              {` · ${plural(Object.keys(lastReview.discussed).length, 'item')} discussed`}
            </span>
          ) : (
            <span>Not reviewed with the patient yet</span>
          )}
          <span className={styles.planCounts}>
            {loaded && [plural(lists.goals.length, 'goal'), plural(lists.interventions.length, 'intervention'),
              plural(lists.barriers.length, 'barrier')].join(' · ')}
          </span>
        </div>
      </div>

      <div className={styles.tabs}>
        <TabStrip
          fullWidth={false}
          activeKey={tab}
          onChange={(k) => { setTab(k); setFilter('all'); setExpanded(null); setSelected(new Set()); }}
          items={[
            { key: 'goals', label: 'Goals', count: loaded ? lists.goals.length : undefined },
            { key: 'interventions', label: 'Interventions', count: loaded ? lists.interventions.length : undefined },
            { key: 'barriers', label: 'Barriers', count: loaded ? lists.barriers.length : undefined },
            { key: 'activity', label: 'Activity Log' },
          ]}
          trailing={tab === 'activity' ? (
            <ActionButton
              icon="custom:filter"
              size="S"
              tooltip="Filter activity"
              tooltipLeft
              active={activityFiltersOpen}
              onClick={() => setActivityFiltersOpen(v => !v)}
            />
          ) : null}
        />
      </div>

      {!loaded ? (
        <ReviewDrawerSkeleton />
      ) : listTab ? (
        <div className={styles.listPane}>
          <div className={styles.progressRow}>
            <span className={styles.progressText}>
              <strong>{done} of {items.length}</strong> {listTab.noun}s discussed
            </span>
            <Toggle
              size="S"
              active={filter}
              onChange={setFilter}
              items={[
                { key: 'all', label: 'All' },
                { key: 'high', label: `High priority ${highCount}` },
                { key: 'pending', label: `Not discussed ${notDiscussedCount}` },
              ]}
            />
          </div>
          <div className={styles.progressBar} aria-hidden="true">
            <span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
          </div>

          {visible.length === 0 ? (
            <p className={styles.empty}>
              {items.length === 0 ? `No ${listTab.noun}s on this care plan.` : `No ${listTab.noun}s match this filter.`}
            </p>
          ) : groupsFor(tab, visible, new Map(lists.goals.map(g => [g.id, g]))).map(group => (
            <section key={group.label} className={styles.group}>
              <div className={styles.groupHead}>
                <Icon name={group.icon} size={14} color="var(--neutral-300)" />
                <span className={styles.groupLabel}>{group.label}</span>
                <span className={styles.groupCount}>{group.items.length}</span>
              </div>
              <div className={styles.groupList}>
                {group.items.map(item => (
                  <ReviewItemRow
                    key={item.id}
                    kind={listTab.kind}
                    item={item}
                    discussed={discussed[`${listTab.kind}:${item.id}`]}
                    selected={selected.has(item.id)}
                    onToggleSelected={() => setSelected(prev => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                      return next;
                    })}
                    expanded={expanded === `${listTab.kind}:${item.id}`}
                    note={noteFor(listTab.kind, item.id)}
                    latestNote={expanded === `${listTab.kind}:${item.id}` ? latestItemNote(audit || [], [item.id], listTab.kind) : null}
                    onToggleDiscussed={() => toggleItem(patientId, program, listTab.kind, item.id)}
                    onToggleExpanded={() => toggleExpanded(listTab.kind, item.id)}
                    onTargetDate={(targetDate) => {
                      saveLive(patientId, program, 'goal', item.id, { targetDate });
                      markDiscussed(patientId, program, 'goal', item.id);
                    }}
                    onOpen={() => openItem(listTab.kind, item)}
                    onStatusMenu={(rect) => setStatusMenu({ kind: listTab.kind, items: [item], rect })}
                    onSaveNote={async (text, tags) => {
                      if (text.trim()) {
                        await addCarePlanNote(patientId, program, text.trim(), {
                          entityType: listTab.kind, entityId: item.id, summary: `Note on ${item.title}`,
                        });
                      }
                      await setItemTags(patientId, program, listTab.kind, item.id, tags);
                    }}
                  />
                ))}
              </div>
            </section>
          ))}

          <BulkBar
            className={styles.bulkBar}
            selectedIds={[...selected]}
            noun={selected.size === 1 ? capitalize(listTab.noun) : `${capitalize(listTab.noun)}s`}
            onClear={() => setSelected(new Set())}
            actions={[
              {
                label: 'Change status',
                icon: 'solar:refresh-circle-linear',
                onClick: (ids, e) => setStatusMenu({
                  kind: listTab.kind,
                  items: items.filter(i => selected.has(i.id)),
                  rect: e.currentTarget.getBoundingClientRect(),
                  bulk: true,
                }),
              },
              {
                label: 'Mark discussed',
                icon: 'solar:check-read-linear',
                variant: 'primary',
                onClick: async (ids) => {
                  await markManyDiscussed(patientId, program, listTab.kind, ids);
                  showToast(`${plural(ids.length, listTab.noun)} marked discussed`);
                  setSelected(new Set());
                },
              },
            ]}
          />
        </div>
      ) : (
        <div className={styles.activityPane}>
          <CarePlanActivityBlock
            entries={activity}
            lastVisit={lastVisit}
            filters={PLAN_ACTIVITY_FILTERS}
            defaultTab="since"
            filterRow
            filtersOpen={activityFiltersOpen}
            emptyLabel="No activity on this care plan yet."
          />
        </div>
      )}

      {statusMenu && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align={statusMenu.bulk ? 'left' : 'right'}
          width={160}
          ariaLabel="Change status"
          items={GBI_STATUSES.map(st => ({ key: st, label: st }))}
          onSelect={async (status) => {
            const changed = statusMenu.items.filter(i => i.status !== status);
            await Promise.all(changed.map(i => saveLive(patientId, program, statusMenu.kind, i.id, { status })));
            if (changed.length) await markManyDiscussed(patientId, program, statusMenu.kind, changed.map(i => i.id));
            if (statusMenu.bulk) {
              showToast(`${plural(statusMenu.items.length, listTab?.noun || 'item')} set to ${status}`);
              setSelected(new Set());
            }
          }}
          onClose={() => setStatusMenu(null)}
        />
      )}

      {/* The item's own drawer, on top of this one. */}
      {preview?.kind === 'goal' && (
        <GoalPreviewDrawer
          goal={preview.item}
          patientId={patientId}
          program={program}
          onClose={() => setPreview(null)}
          onOpenIntervention={(i) => setPreview({ kind: 'intervention', item: i })}
          onOpenBarrier={(b) => setPreview({ kind: 'barrier', item: b })}
        />
      )}
      {preview?.kind === 'intervention' && (
        <InterventionPreviewDrawer
          intervention={preview.item}
          patientId={patientId}
          program={program}
          onClose={() => setPreview(null)}
          onOpenGoal={(g) => setPreview({ kind: 'goal', item: g })}
        />
      )}
      {preview?.kind === 'barrier' && (
        <BarrierDetailDrawer
          barrier={preview.item}
          patientId={patientId}
          program={program}
          onClose={() => setPreview(null)}
          onOpenGoal={(g) => setPreview({ kind: 'goal', item: g })}
        />
      )}
    </Drawer>
  );
}
