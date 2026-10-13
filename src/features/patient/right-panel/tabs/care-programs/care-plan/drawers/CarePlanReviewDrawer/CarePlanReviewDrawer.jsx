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
import { GOAL_CATEGORIES, goalCategoryIcon, normalizeCategory } from '../../../../../../../settings/care-plan-library/lib/goalCategories';
import { ReviewItemRow } from './ReviewItemRow';
import { CarePlanHistoryView } from '../CarePlanHistoryDrawer/CarePlanHistoryDrawer';
import { BulkSelectToggle } from '../../../../../../../../components/BulkSelect/BulkSelectToggle';
import { ReviewNoteCard } from './ReviewNoteCard';
import { ReviewDrawerSkeleton } from './ReviewDrawerSkeleton';
import { ReviewTimer } from './ReviewTimer';
import { CompleteReviewPopover } from './CompleteReviewPopover';
import bones from '../../../../../../../../components/TableSkeleton/TableSkeleton.module.css';
import styles from './CarePlanReviewDrawer.module.css';

const KINDS = {
  goals: { kind: 'goal', noun: 'goal', title: 'Goals' },
  interventions: { kind: 'intervention', noun: 'intervention', title: 'Interventions' },
  barriers: { kind: 'barrier', noun: 'barrier', title: 'Barriers' },
};

const KIND_META = Object.fromEntries(CARE_PLAN_INTERVENTION_MENU.filter(i => i.key).map(i => [i.key, i]));
const KIND_ORDER = CARE_PLAN_INTERVENTION_MENU.filter(i => i.key).map(i => i.key);
const DONE = new Set(['Met', 'Completed', 'Resolved']);
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// The call note is rich text: an emptied editor can still hold <br> or <p></p>.
const plainText = html => (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

// Goals group by their goal category (Vitals, Labs, ...) and interventions by
// their type (Patient Education, Measure Vital, ...), in the library's order.
function groupsFor(tab, items) {
  const groups = new Map();
  const add = (label, icon, rank, item) => {
    if (!groups.has(label)) groups.set(label, { label, icon, rank, items: [] });
    groups.get(label).items.push(item);
  };
  for (const item of items) {
    if (tab === 'goals') {
      const category = normalizeCategory(item.category);
      add(category, goalCategoryIcon(category), GOAL_CATEGORIES.indexOf(category), item);
    } else if (tab === 'interventions') {
      const meta = KIND_META[item.kind];
      add(meta?.label || 'Other', meta?.icon || 'solar:checklist-minimalistic-linear', meta ? KIND_ORDER.indexOf(item.kind) : 99, item);
    } else {
      const resolved = DONE.has(item.status);
      add(resolved ? 'Resolved' : 'Open', resolved ? 'solar:check-circle-linear' : 'solar:signpost-2-linear', resolved ? 1 : 0, item);
    }
  }
  return [...groups.values()].sort((a, b) => (a.rank < 0 ? 98 : a.rank) - (b.rank < 0 ? 98 : b.rank));
}

function fmtDay(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
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
  const updateNote = useAppStore(s => s.updateCarePlanNote);
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilters, setHistoryFilters] = useState(true); // Activity Log filter row shown
  // The review clock: Start review sets startedAt and brings up the call
  // note composer; Stop (or Finish review) freezes it and opens the Complete
  // review popover with the note and what was covered.
  const [startedAt, setStartedAt] = useState(null);
  const [stoppedAt, setStoppedAt] = useState(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [baseSeconds, setBaseSeconds] = useState(0); // time the open review had already run
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null); // `${kind}:${id}` with its note open
  const [statusMenu, setStatusMenu] = useState(null); // { kind, items, rect }
  // Bulk select: the tab row's Select button shows the row checkboxes.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // item ids on the current tab
  const endSelecting = () => { setSelecting(false); setSelected(new Set()); };
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
  // Notes tab: the care plan's own notes, meaning its current care plan note
  // and every call note, newest first.
  const notes = useMemo(() => {
    const rows = audit || [];
    const out = [];
    const onPlan = a => a.entityType === 'plan' || (a.entityType === 'note' && !a.entityId);
    const newest = action => rows.filter(a => a.action === action && onPlan(a))
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))[0];
    const planNote = newest('note');
    const cleared = [newest('note_cleared'), newest('note_deleted')].filter(Boolean)
      .some(c => planNote && new Date(c.createdAt) >= new Date(planNote.createdAt));
    if (planNote && !cleared) out.push({ ...planNote, kind: 'plan' });
    // A call note's audit row points at its review, which holds the call length.
    const reviews = [review?.open, ...(review?.history || [])].filter(Boolean);
    for (const c of rows.filter(a => a.action === 'call_note')) {
      const r = reviews.find(x => String(x.id) === String(c.entityId));
      out.push({ ...c, kind: 'call', durationSeconds: r?.durationSeconds ?? null });
    }
    return out.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
  }, [audit, review]);
  const isMine = actor => !!actor && !!me && actor.toLowerCase() === me.toLowerCase();
  const isDiscussed = (kind, id) => !!discussed[`${kind}:${id}`];
  const discussedCount = (t) => lists[t].filter(i => isDiscussed(KINDS[t].kind, i.id)).length;
  const totalDiscussed = Object.keys(KINDS).reduce((n, t) => n + discussedCount(t), 0);
  // What this review covered, for the Complete review popover.
  const discussedItems = Object.entries(KINDS).flatMap(([t, k]) => lists[t]
    .filter(i => isDiscussed(k.kind, i.id))
    .map(i => ({ id: `${k.kind}:${i.id}`, kind: k.kind, title: i.title, status: i.status || 'Not Started' })));

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
  // The latest review, finished or not: an open review counts once anything
  // on it was saved (an item discussed or a call note).
  const lastReview = useMemo(() => {
    const done = review?.history?.[0];
    const open = review?.open;
    const openUsed = open && (Object.keys(open.discussed || {}).length || plainText(open.callNote));
    const candidates = [
      done && { at: done.finishedAt, by: done.createdBy, discussed: done.discussed, inProgress: false },
      // Not attributed: created_by is whoever opened it, not who worked on it last.
      openUsed && { at: open.updatedAt, by: null, discussed: open.discussed, inProgress: true },
    ].filter(Boolean);
    return candidates.sort((a, b) => new Date(b.at) - new Date(a.at))[0] || null;
  }, [review]);
  const openItem = (kind, item) => { setPreview({ kind, item }); markNoteSeen(kind, item.id); };
  const toggleExpanded = (kind, id) => {
    const k = `${kind}:${id}`;
    setExpanded(prev => (prev === k ? null : k));
    markNoteSeen(kind, id);
  };

  const completeReview = async () => {
    const note = callNote == null ? undefined : (plainText(callNote) ? callNote : '');
    const saved = await finishReview(patientId, program, note, { startedAt, stoppedAt, baseSeconds, discussedCount: totalDiscussed });
    if (!saved) return;
    showToast(`Review completed · ${plural(totalDiscussed, 'item')} discussed`);
    setCompleteOpen(false);
    setStartedAt(null);
    setStoppedAt(null);
    setCallNote(null);
  };
  // Resume picks the clock up where it stopped, leaving the pause out.
  const resumeReview = () => {
    setStartedAt(prev => prev + (Date.now() - stoppedAt));
    setStoppedAt(null);
    setCompleteOpen(false);
  };
  const openComplete = () => {
    if (stoppedAt == null) setStoppedAt(Date.now());
    setCompleteOpen(true);
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
        onClick={() => { onClose(); navigateToPatient?.(patientId, { programCode: program.code, carePlan: true }); }}
      />
      <span className={styles.headerDivider} aria-hidden="true" />
      {startedAt == null ? (
        <Button variant="primary" size="S" leadingIcon="solar:play-linear" onClick={() => { setBaseSeconds(open?.durationSeconds || 0); setStartedAt(Date.now()); }}>
          Start review
        </Button>
      ) : (
        <ReviewTimer
          startedAt={startedAt}
          stoppedAt={stoppedAt}
          onStop={openComplete}
          onOpenComplete={openComplete}
        />
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
              {totalDiscussed ? `${plural(totalDiscussed, 'item')} discussed will be attached` : 'Change statuses or mark items discussed as you go'}
            </span>
            <Button variant="secondary" size="M" onClick={openComplete}>
              Finish review
            </Button>
            <Button
              variant="primary"
              size="M"
              disabled={!callNoteFilled || callNoteValue === (open?.callNote || '')}
              onClick={async () => {
                const saved = await saveCallNote(patientId, program, callNoteValue, { startedAt, stoppedAt, baseSeconds });
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
              Last reviewed on <strong>{fmtDay(lastReview.at)}</strong>
              {lastReview.by ? ` by ${lastReview.by}` : ''}
              {/* The open review counts only items still on the plan, like its progress. */}
              {` · ${plural(lastReview.inProgress ? totalDiscussed : Object.keys(lastReview.discussed || {}).length, 'item')} discussed`}
              {lastReview.inProgress ? ' · In progress' : ''}
            </span>
          ) : (
            <span>Not reviewed with the patient yet</span>
          )}
        </div>
      </div>

      {!historyOpen && (
        <div className={styles.tabs}>
          <TabStrip
            fullWidth={false}
            activeKey={tab}
            onChange={(k) => { setTab(k); setFilter('all'); setExpanded(null); endSelecting(); }}
            items={[
              { key: 'goals', label: 'Goals', count: loaded ? lists.goals.length : undefined },
              { key: 'interventions', label: 'Interventions', count: loaded ? lists.interventions.length : undefined },
              { key: 'barriers', label: 'Barriers', count: loaded ? lists.barriers.length : undefined },
              { key: 'notes', label: 'Notes', count: loaded ? notes.length : undefined },
            ]}
            trailing={(
              <span className={styles.tabActions}>
                {listTab && loaded && (
                  <>
                    <BulkSelectToggle active={selecting} onToggle={() => (selecting ? endSelecting() : setSelecting(true))} />
                    <span className={styles.headerDivider} aria-hidden="true" />
                  </>
                )}
                <ActionButton
                  icon="custom:history"
                  size="L"
                  tooltip="Activity Log"
                  tooltipLeft
                  onClick={() => { endSelecting(); setHistoryOpen(true); }}
                />
              </span>
            )}
          />
        </div>
      )}

      {historyOpen ? (
        // Activity Log in place of the tabs: Care Plan History's filters and
        // timeline, from the last visit, with a way back.
        <CarePlanHistoryView patientId={patientId} program={program} lastVisit={lastVisit} sinceLastVisit compact>
          {(filterRow, content) => (
            <>
              <div className={styles.backRow}>
                <ActionButton icon="solar:arrow-left-linear" size="S" tooltip="Back to the care plan" onClick={() => setHistoryOpen(false)} />
                <span className={styles.backTitle}>Activity Log</span>
                <span className={styles.backAction}>
                  <ActionButton
                    icon="custom:filter"
                    size="S"
                    tooltip={historyFilters ? 'Hide filters' : 'Show filters'}
                    tooltipLeft
                    active={historyFilters}
                    onClick={() => setHistoryFilters(v => !v)}
                  />
                </span>
              </div>
              {historyFilters && filterRow}
              <div className={styles.activityLog}>{content}</div>
            </>
          )}
        </CarePlanHistoryView>
      ) : !loaded ? (
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
          ) : groupsFor(tab, visible).map(group => (
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
                    selecting={selecting}
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
            onClear={endSelecting}
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
                  endSelecting();
                },
              },
            ]}
          />
        </div>
      ) : (
        <div className={styles.noteList}>
          {notes.length === 0 ? (
            <p className={styles.empty}>No notes on this care plan yet.</p>
          ) : notes.map(n => (
            <ReviewNoteCard
              key={`${n.id}:${n.detail}`}
              note={n}
              canEdit={isMine(n.actor)}
              onSave={text => updateNote(patientId, program.id, n.id, text)}
            />
          ))}
        </div>
      )}


      {completeOpen && startedAt != null && stoppedAt != null && (
        <CompleteReviewPopover
          elapsedMs={baseSeconds * 1000 + (stoppedAt - startedAt)}
          discussed={discussedItems}
          note={callNoteValue}
          onNoteChange={setCallNote}
          onResume={resumeReview}
          onComplete={completeReview}
          onClose={() => setCompleteOpen(false)}
        />
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
              endSelecting();
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
