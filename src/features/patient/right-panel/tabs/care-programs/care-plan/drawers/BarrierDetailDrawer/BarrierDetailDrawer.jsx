import { useMemo, useRef, useState } from 'react';
import { useScrollToSection } from '../../lib/useScrollToSection';
import { CarePlanItemNote } from '../CarePlanItemNote/CarePlanItemNote';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { EditableText } from '../../../../../../../../components/EditableText/EditableText';
import { Button } from '../../../../../../../../components/Button/Button';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Input } from '../../../../../../../../components/Input/Input';
import { Select } from '../../../../../../../../components/Select/Select';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { GbiProgressCell } from '../../tables/carePlanTableShared';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { CarePlanActivityBlock } from '../CarePlanActivityBlock/CarePlanActivityBlock';
import { useCarePlanItemActivity } from '../../lib/useCarePlanItemActivity';
import { LinkGoalToBarrierDrawer } from './LinkGoalToBarrierDrawer';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { useSignedCarePlan } from '../../lib/useSignedCarePlans';
import { formatGoalTarget, formatGoalDuration, formatGoalFrequency } from '../../../../../../../settings/care-plan-library/lib';
import { norm } from '../../CarePlanView/carePlanViewNorm';
import { TemplatePreviewDrawer } from '../TemplatePreviewDrawer/TemplatePreviewDrawer';
import { DetailDropdown } from '../../../../../../../tasks/TasksViewDropdowns';
import { PRIORITY_OPTIONS } from '../../../../../../../tasks/TasksView.utils';
import styles from './BarrierDetailDrawer.module.css';

// Stable fallback so memo deps don't change every render.
const NO_ITEMS = [];
import goalStyles from '../GoalPreviewDrawer/GoalPreviewDrawer.module.css';

import { BARRIER_STATUSES, gbiStatusMeta } from '../../lib/gbiStatus';
import { isCompletedStatus } from '../../tables/carePlanTableModel';
import { confirmStatusChange, statusReasonPatch } from '../../lib/confirmStatusChange';

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${String(d.getFullYear()).slice(-2)}`;
}

/**
 * BarrierDetailDrawer: Barriers surface (Figma 2937:267306). Mirrors
 * the Goal Details drawer shape: editable title, status/delete/Update
 * header, metadata line, collapsible Linked Goals and Linked Templates
 * with link + unlink actions per row.
 *
 * "Templates" are the plan's chronic conditions. Every plan version
 * tracks its own set of conditions on `patient_care_plans.conditions`;
 * a barrier applying to a condition is represented in the store by
 * matching the condition's label against the barrier's title/context.
 * A `plan.conditions` mutation for linking is out of scope here, the
 * drawer surfaces the current linkage set and lets the user delink /
 * link additional plan conditions via the same `+` popover.
 */


export function BarrierDetailDrawer({ barrier, patientId, program, onClose, onOpenGoal, consolidated = false, signedView = false, focusSection = null, readOnly = false, snapshot = null }) {
  // `readOnly` + `snapshot`: opened from a past version or an earlier
  // template run; items come from that copy, nothing can be changed and
  // empty sections are hidden.
  const ro = consolidated || readOnly;
  const key = patientId && program ? `${patientId}::${program.id}` : null;
  // `signedView`: opened from a surface that shows the plan as last signed
  // (Comprehensive Care Plan, Monitoring). The item is read from that copy
  // and the plan itself is not editable there; readings and notes are live
  // documentation, so those stay open.
  const liveSlice = useAppStore(s => (key ? s.patientCarePlans[key] : null));
  const signedSlice = useSignedCarePlan(signedView ? key : null);
  const slice = useMemo(() => (snapshot
    ? { ...liveSlice, goals: snapshot.goals || [], interventions: snapshot.interventions || [], barriers: snapshot.barriers || [] }
    : (signedView ? signedSlice : liveSlice)), [snapshot, signedView, signedSlice, liveSlice]);
  const auditAll = useAppStore(s => (key ? s.patientCarePlanAudit[key] : null)) || [];
  const savePatientCarePlanBarrier = useAppStore(s => s.savePatientCarePlanBarrier);
  const deletePatientCarePlanBarrier = useAppStore(s => s.deletePatientCarePlanBarrier);
  const showToast = useAppStore(s => s.showToast);
  const libraryBarriers = useAppStore(s => s.carePlanBarriers) || [];
  // Powers the shared activity block's "Since Last Visit" tab, same
  // selector shape the Goal preview drawer uses.
  const lastVisit = useAppStore(s => {
    const p = (s.patients || []).find(x => x.id === patientId)
      || (s.allPatients || []).find(x => x.id === patientId);
    return p?.lastVisit || p?.last_visit || null;
  });

  const goalsInPlan = slice?.goals || [];
  const barriersInPlan = slice?.barriers || [];

  // Post-migration path: a barrier row carries its full goal set via
  // `goalIds`. We also merge in every legacy title-clone's goal_id so
  // pre-migration data reads as one logical barrier here too (matches
  // the same consolidation the Barriers table does).
  // The drawer opens with a snapshot; saves land in the store, so read the
  // live row for anything compared against or written back.
  const liveBarrier = barriersInPlan.find(b => b.id === barrier?.id) || barrier;
  const normalizedTitle = (liveBarrier?.title || '').trim().toLowerCase();
  const legacyClones = useMemo(
    () => barriersInPlan.filter(b => (b.title || '').trim().toLowerCase() === normalizedTitle),
    [barriersInPlan, normalizedTitle],
  );
  const linkedGoalIdSet = useMemo(() => {
    const set = new Set();
    if (Array.isArray(barrier?.goalIds)) barrier.goalIds.forEach(id => id && set.add(id));
    for (const clone of legacyClones) {
      if (Array.isArray(clone.goalIds)) clone.goalIds.forEach(id => id && set.add(id));
      if (clone.goalId) set.add(clone.goalId);
    }
    return set;
  }, [barrier?.goalIds, legacyClones]);
  const linkedGoals = useMemo(() => (
    Array.from(linkedGoalIdSet)
      .map(gid => ({ goal: goalsInPlan.find(g => g.id === gid) }))
      .filter(x => !!x.goal)
  ), [linkedGoalIdSet, goalsInPlan]);
  const availableGoals = useMemo(
    () => goalsInPlan.filter(g => !linkedGoalIdSet.has(g.id)),
    [goalsInPlan, linkedGoalIdSet],
  );

  // A barrier is transitively linked to every care-plan template
  // (chronic condition) that any of its linked goals binds to, a goal
  // authored under a plan template drags that template into the
  // barrier's linked set. Dedupe by label so a barrier linked to two
  // goals under the same template only shows the template once.
  // Applied templates this barrier came from: the same title match the plan's
  // template chips filter by: the template lists this barrier, or one of the
  // goals it's linked to. (Template names often equal a condition's name, so
  // listing conditions here used to look right without being right.)
  const carePlanTemplates = useAppStore(s => s.carePlanTemplates) ?? NO_ITEMS;
  const libraryGoals = useAppStore(s => s.carePlanGoals) ?? NO_ITEMS;
  const linkedTemplates = useMemo(() => {
    const applied = slice?.plan?.appliedTemplateIds || [];
    const barrierKey = norm(liveBarrier?.title);
    const goalKeys = new Set(linkedGoals.map(({ goal }) => norm(goal?.title)));
    const goalTitleOf = (e) => norm((e?.id ? libraryGoals.find(g => g.id === e.id)?.title : null) || e?.title);
    return applied
      .map(id => carePlanTemplates.find(t => t.id === id))
      .filter(Boolean)
      .filter(t => (t.barriers || []).some(b => norm(b?.title) === barrierKey)
        || (t.goals || []).some(g => goalKeys.has(goalTitleOf(g))));
  }, [slice?.plan?.appliedTemplateIds, carePlanTemplates, libraryGoals, linkedGoals, liveBarrier?.title]);

  const [title, setTitle] = useState(barrier.title || '');
  const [description, setDescription] = useState(barrier.description || '');
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [status, setStatus] = useState(barrier.status || 'Not Started');
  // Typeahead: surface library barriers matching the current input so
  // the user can pick an existing entry instead of re-typing / creating
  // a near-duplicate. Guarded by focus so the list only shows while the
  // input is active.
  const [titleFocused, setTitleFocused] = useState(false);
  const titleSuggestions = useMemo(() => {
    const q = (title || '').trim().toLowerCase();
    if (!q) return [];
    const seen = new Set();
    const rows = [];
    for (const b of libraryBarriers) {
      const name = (b?.title || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (key === q) continue; // exact match, nothing to switch to
      if (!key.includes(q)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ id: b.id, title: name });
      if (rows.length >= 8) break;
    }
    return rows;
  }, [title, libraryBarriers]);
  // Terminal state: a closed barrier's record locks (no rename, no link /
  // unlink, no note edits). Users flip status back to In Progress / On Hold
  // to reopen the drawer for editing.
  // A closed barrier (Met / Resolved, or Discontinued / Not Applicable) opens
  // read-only; Not Met is still an open blocker, so it stays editable (same
  // rule as the plan's Closed Barriers group). Keyed to the saved status so
  // picking a closing status still shows Update, and reopening one does too.
  const isTerminal = isCompletedStatus(liveBarrier.status || 'Not Started');
  const [linkDrawerOpen, setLinkDrawerOpen] = useState(false);
  const [unlinkConfirm, setUnlinkConfirm] = useState(null);
  const [confirmDeleteBarrier, setConfirmDeleteBarrier] = useState(false);
  const [open, setOpen] = useState({ goals: true, templates: true });
  const toggle = (k) => setOpen(o => ({ ...o, [k]: !o[k] }));
  // Barrier's audit rows (this and every clone): the set is used by
  // both the change-log derivation for the Add / Update Note editor
  // and the Activity Log feed below.
  const barrierIdSet = useMemo(
    () => new Set(legacyClones.map(b => String(b.id))),
    [legacyClones],
  );
  const noteSectionRef = useRef(null);
  useScrollToSection(noteSectionRef, focusSection === 'notes', barrier?.id);

  // Activity for this barrier and every clone of it, drawn as the Care Plan
  // History draws it.
  const activityEntries = useCarePlanItemActivity({
    patientId,
    program,
    audit: auditAll,
    ids: [...barrierIdSet],
    goals: goalsInPlan,
  });

  // Title + status changes are staged locally and committed via the
  // header "Update" button: auto-save was rolling too many tiny writes
  // to Supabase for each keystroke / dropdown click. Note edits still
  // save via their own "Add Note" / "Update Note" button.
  const persistedTitle = (liveBarrier.title || '').trim();
  const persistedStatus = liveBarrier.status || 'Not Started';
  const persistBarrier = async (nextTitle, nextStatus, doneVerb) => {
    const rows = legacyClones.length ? legacyClones : [barrier];
    // A status change asks why first; every clone shares the one answer.
    const why = await confirmStatusChange(rows.map(item => ({ type: 'barrier', item })), nextStatus);
    if (!why) return;
    for (const row of rows) {
      await savePatientCarePlanBarrier(patientId, program, {
        ...row,
        ...(row.status !== nextStatus ? statusReasonPatch(row, why) : {}),
        title: nextTitle,
        status: nextStatus,
        description: description.trim(),
        goalIds: Array.from(linkedGoalIdSet),
      }, row.id);
    }
    if (doneVerb) showToast?.(doneVerb);
  };
  // The title saves on its own, so Update covers status + description only;
  // `title` is just the typing draft used for suggestions.
  const barrierDirty = status !== persistedStatus
    || description.trim() !== (liveBarrier.description || '').trim();

  // Title auto-saves on its own (status and description keep the Update
  // button). Every legacy clone is renamed so the table keeps one row.
  const titleElRef = useRef(null);
  const saveTitle = async (next) => {
    setTitleFocused(false);
    if (!next || next === persistedTitle) return;
    const rows = legacyClones.length ? legacyClones : [liveBarrier];
    await Promise.all(rows.map(row => savePatientCarePlanBarrier(patientId, program, {
      ...row,
      title: next,
      goalIds: Array.from(linkedGoalIdSet),
    }, row.id)));
  };
  // Priority saves on pick, like the title, on every legacy clone.
  const savePriority = async (next) => {
    if (!next || next === (liveBarrier.priority || 'medium')) return;
    const rows = legacyClones.length ? legacyClones : [liveBarrier];
    await Promise.all(rows.map(row => savePatientCarePlanBarrier(patientId, program, {
      ...row,
      priority: next,
      goalIds: Array.from(linkedGoalIdSet),
    }, row.id)));
  };
  const handleUpdateBarrier = async () => {
    if (!barrierDirty) return;
    await persistBarrier(persistedTitle, status, 'Barrier updated');
  };

  const handleAddGoalClick = () => {
    if (availableGoals.length === 0) {
      showToast?.('All goals in this plan version are already linked.');
      return;
    }
    setLinkDrawerOpen(true);
  };
  const handleLinkGoals = async (goalIds) => {
    if (!goalIds?.length) return;
    // Extend the canonical barrier's goal set; the join-table sync inside
    // savePatientCarePlanBarrier writes the new links.
    const nextGoalIds = Array.from(new Set([
      ...linkedGoalIdSet,
      ...goalIds.filter(Boolean),
    ]));
    await savePatientCarePlanBarrier(patientId, program, {
      ...liveBarrier,
      title: liveBarrier.title,
      description: liveBarrier.description,
      status,
      priority: liveBarrier.priority || 'medium',
      goalIds: nextGoalIds,
    }, barrier.id);
    showToast?.(goalIds.length === 1
      ? `Linked to ${goalsInPlan.find(g => g.id === goalIds[0])?.title || 'goal'}`
      : `Linked to ${goalIds.length} goals`);
  };

  const handleUnlink = async () => {
    const target = unlinkConfirm;
    setUnlinkConfirm(null);
    if (!target) return;
    const goalIdToRemove = target.goal?.id;
    if (!goalIdToRemove) return;
    // Drop the goal from every clone's `goalIds` and re-save so the join
    // table converges. If a legacy clone existed solely to link this
    // goal (pre-migration state), it gets fully removed.
    const rows = legacyClones.length ? legacyClones : [barrier];
    for (const row of rows) {
      const rowGoalIds = Array.isArray(row.goalIds) && row.goalIds.length > 0
        ? row.goalIds
        : (row.goalId ? [row.goalId] : []);
      const nextRowGoalIds = rowGoalIds.filter(gid => gid !== goalIdToRemove);
      if (rowGoalIds.length > 0 && nextRowGoalIds.length === 0) {
        // Row's only link was this goal, delete the row entirely.
        await deletePatientCarePlanBarrier(patientId, program.id, row.id);
      } else {
        await savePatientCarePlanBarrier(patientId, program, {
          ...row,
          goalIds: nextRowGoalIds,
        }, row.id);
      }
    }
    showToast?.(`Unlinked from ${target.goal.title}`);
    if (linkedGoals.length <= 1) onClose?.();
  };

  const handleDeleteBarrier = async () => {
    setConfirmDeleteBarrier(false);
    for (const row of legacyClones) {
      await deletePatientCarePlanBarrier(patientId, program.id, row.id);
    }
    showToast?.('Barrier removed from plan');
    onClose?.();
  };

  const startDate = fmtDate(barrier.createdAt);
  const updatedDate = fmtDate(barrier.updatedAt || barrier.createdAt);
  const updatedByName = barrier.updatedByName || barrier.createdByName || 'You';

  return (
    <>
      <Drawer
        title="Barriers"
        onClose={onClose}
        width={640}
        dockable
        noCloseDivider={isTerminal && !barrierDirty}
        headerRight={ro || (isTerminal && !barrierDirty) ? null : (
          <Button
            disabled={!barrierDirty}
            onClick={handleUpdateBarrier}
          >
            Update
          </Button>
        )}
      >
        <div className={styles.body}>
          {/* Status bar: Select on the left, delete-barrier on the right.
              Matches the InterventionPreviewDrawer/GoalPreviewDrawer status
              row so all three drawers read as the same primitive. */}
          <div className={styles.statusBar}>
            <Select
              options={BARRIER_STATUSES.map(s => ({ value: s, label: s, icon: gbiStatusMeta(s).icon }))}
              value={status}
              onValueChange={setStatus}
              disabled={readOnly}
              portal
              className={styles.statusSelect}
              style={{ width: 'fit-content' }}
            />
            {!ro && (
              <ActionButton
                icon="solar:trash-bin-trash-linear"
                size="sm"
                tooltip="Delete barrier"
                onClick={() => setConfirmDeleteBarrier(true)}
              />
            )}
          </div>

          {/* Barrier title: editable Input while active, or a read-only
              summary card once the barrier is closed. The card
              carries the barrier glyph, the plan-scoped meta line, and a
              small linked-goals chip so users still see the link count
              without the affordances that let them mutate it. The
              ro (Comprehensive Care Plan) tab forces this
              read-only branch too so nothing about the barrier's title
              can be mutated from that surface. */}
          {isTerminal || ro ? (
            <div className={styles.field}>
              <div className={styles.terminalCard}>
                <div className={styles.terminalHead}>
                  <span className={styles.terminalTitle}>{liveBarrier.title}</span>
                </div>
                {(description || barrier.description) && (
                  <p className={styles.descriptionText}>{description || barrier.description}</p>
                )}
                <div className={styles.metaLine}>
                  {startDate && <>Start Date : {startDate}</>}
                  {startDate && updatedDate && <span className={styles.metaDot}>&bull;</span>}
                  {updatedDate && <>Last Update : {updatedDate} by {updatedByName}</>}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.field}>
              {/* Title edits where it stands and saves on Enter / click away;
                  matching library barrier names show below while typing. */}
              <div className={styles.titleFieldWrap}>
                <span className={styles.priorityTrigger}>
                  <DetailDropdown
                    value={liveBarrier.priority || 'medium'}
                    options={PRIORITY_OPTIONS}
                    onSelect={savePriority}
                    searchable={false}
                    renderOption={(opt) => (
                      <>
                        <PriorityIcon priority={opt} size={16} />
                        <span style={{ textTransform: 'capitalize' }}>{opt}</span>
                      </>
                    )}
                  >
                    <PriorityIcon priority={liveBarrier.priority || 'medium'} size={20} />
                  </DetailDropdown>
                </span>
                <EditableText
                  value={liveBarrier.title || ''}
                  onCommit={saveTitle}
                  onDraftChange={(t) => { setTitle(t); setTitleFocused(true); }}
                  onEditEnd={() => setTitleFocused(false)}
                  elementRef={titleElRef}
                  placeholder="Barrier name"
                  ariaLabel="Barrier title"
                  className={goalStyles.titleText}
                />
                {titleFocused && titleSuggestions.length > 0 && (
                  <ul className={styles.titleSuggestions} role="listbox" aria-label="Existing barriers">
                    {titleSuggestions.map(sug => (
                      <li key={sug.id}>
                        <button
                          type="button"
                          className={styles.titleSuggestionRow}
                          role="option"
                          aria-selected="false"
                          // Keep focus in the title so picking replaces the
                          // text, then blur commits it like a typed edit.
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const el = titleElRef.current;
                            if (!el) return;
                            el.textContent = sug.title;
                            el.blur();
                          }}
                        >
                          {sug.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className={styles.metaLine}>
                {startDate && <>Start Date : {startDate}</>}
                {startDate && updatedDate && <span className={styles.metaDot}>&bull;</span>}
                {updatedDate && <>Last Update : {updatedDate} by {updatedByName}</>}
              </div>
              {/* The plan table is single-line now, so the drawer is where a
                  barrier's description is read and edited. */}
              <span className={styles.label}>Description</span>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What is getting in the way, and why"
                aria-label="Barrier description"
              />
            </div>
          )}

          {/* Linked Goals. */}
          {(!readOnly || linkedGoals.length > 0) && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <button
                type="button"
                className={styles.sectionToggle}
                onClick={() => toggle('goals')}
                aria-expanded={open.goals}
              >
                <span className={styles.sectionTitle}>Linked Goals</span>
                <DownChevronIcon
                  size={12}
                  color="var(--neutral-400)"
                  className={`${styles.sectionChevron} ${open.goals ? styles.sectionChevronOpen : ''}`}
                />
              </button>
              {!isTerminal && !ro && (
                <ActionButton
                  icon="solar:add-linear"
                  size="sm"
                  tooltip="Link goal"
                  aria-haspopup="dialog"
                  aria-expanded={linkDrawerOpen}
                  onClick={handleAddGoalClick}
                />
              )}
            </div>
            {open.goals && (
              linkedGoals.length === 0 ? (
                <div className={styles.empty}>Not linked to any goals in this plan version yet.</div>
              ) : (
                <ul className={styles.linkList}>
                  {linkedGoals.map(({ goal }) => {
                    const target = formatGoalTarget(goal);
                    const subtitle = [
                      target && `Target ${target}`,
                      target && formatGoalFrequency(goal),
                      formatGoalDuration(goal),
                    ].filter(Boolean).join(' • ');
                    return (
                      <li key={goal.id} className={styles.linkRow}>
                        <span className={styles.linkIcon}>
                          <Icon name={goalIconFor(goal)} size={16} color="var(--neutral-400)" />
                        </span>
                        <div className={styles.linkStack}>
                          <span className={styles.linkTitle}>{goal.title}</span>
                          {subtitle && <span className={styles.linkSubtitle}>{subtitle}</span>}
                        </div>
                        <div className={styles.linkActions} style={{ gap: 'var(--space-2)' }}>
                          <PriorityIcon priority={goal.priority} size={16} />
                          <span className={styles.linkActionsDivider} aria-hidden style={{ margin: 0 }} />
                          <GbiProgressCell progress={goal.progress} />
                          <span className={styles.linkActionsDivider} aria-hidden style={{ margin: 0 }} />
                          <ActionButton
                            icon="solar:arrow-right-up-linear"
                            size="sm"
                            tooltip="Open goal"
                            onClick={() => onOpenGoal?.(goal)}
                          />
                          {!isTerminal && !ro && (
                            <>
                              <span className={styles.linkActionsDivider} aria-hidden style={{ margin: 0 }} />
                              <ActionButton
                                icon="solar:link-broken-minimalistic-linear"
                                size="sm"
                                tooltip="Unlink"
                                onClick={() => setUnlinkConfirm({ goal })}
                              />
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            )}
          </section>
          )}

          {/* Linked Templates: derived transitively from the linked
              goals' chronic-condition bindings. A goal authored under a
              plan template (e.g. Hypertension, Diabetes) drags that
              template into the barrier's linked set; deduped by label. */}
          {(!readOnly || linkedTemplates.length > 0) && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <button
                type="button"
                className={styles.sectionToggle}
                onClick={() => toggle('templates')}
                aria-expanded={open.templates}
              >
                <span className={styles.sectionTitle}>Linked Templates</span>
                <DownChevronIcon
                  size={12}
                  color="var(--neutral-400)"
                  className={`${styles.sectionChevron} ${open.templates ? styles.sectionChevronOpen : ''}`}
                />
              </button>
            </div>
            {open.templates && (
              linkedTemplates.length === 0 ? (
                <div className={styles.empty}>
                  Not part of a care plan template applied to this plan.
                </div>
              ) : (
                <ul className={styles.linkList}>
                  {linkedTemplates.map(t => (
                    <li key={t.id} className={styles.linkRow}>
                      <span className={styles.linkIcon}>
                        <Icon name="solar:hand-heart-linear" size={16} color="var(--neutral-400)" />
                      </span>
                      <div className={styles.linkStack}>
                        <span className={styles.linkTitle}>{t.name}</span>
                        {(t.conditions || []).length > 0 && (
                          <span className={styles.linkSubtitle}>{t.conditions.join(', ')}</span>
                        )}
                      </div>
                      {/* Template links come from the linked goals and the
                          template contents, so they're not unlinked here. */}
                      <div className={styles.linkActions}>
                        <ActionButton
                          icon="solar:arrow-right-up-linear"
                          size="sm"
                          tooltip="Preview template"
                          onClick={() => setPreviewTemplate(t)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}
          </section>
          )}

          {!readOnly && <CarePlanItemNote
            ref={noteSectionRef}
            entityType="barrier"
            itemId={barrier.id}
            ids={[...barrierIdSet]}
            itemTitle={barrier.title}
            audit={auditAll}
            patientId={patientId}
            program={program}
          />}

          {/* Activity Log: shared block with Tabs (All / Since
              Last Visit) + Filter chip, matches the Goal preview
              drawer 1:1. Status changes, edits, goal link / unlink,
              template link / unlink, and notes all render through the
              same ActivityLog primitive. */}
          <CarePlanActivityBlock
            entries={activityEntries}
            lastVisit={lastVisit}
            emptyLabel="No activity for this barrier yet."
          />
        </div>
        {previewTemplate && (
        <TemplatePreviewDrawer template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
      )}
    </Drawer>

      {linkDrawerOpen && (
        <LinkGoalToBarrierDrawer
          goals={availableGoals}
          onClose={() => setLinkDrawerOpen(false)}
          onLink={handleLinkGoals}
        />
      )}


      {unlinkConfirm && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-warning)"
          title={`Unlink from "${unlinkConfirm.goal.title}"?`}
          description="This removes the barrier from that goal. It stays linked to any other goals it's attached to."
          confirmLabel="Unlink"
          cancelLabel="Cancel"
          onConfirm={handleUnlink}
          onCancel={() => setUnlinkConfirm(null)}
        />
      )}

      {confirmDeleteBarrier && (
        <ConfirmDialog
          icon="solar:trash-bin-trash-linear"
          iconColor="var(--status-error)"
          title="Delete this barrier?"
          description="This removes the barrier from every goal it's linked to in this plan version. This cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="error"
          onConfirm={handleDeleteBarrier}
          onCancel={() => setConfirmDeleteBarrier(false)}
        />
      )}
    </>
  );
}

// Pick a lightweight icon for the goal-row leading glyph based on the
// goal's category. Vitals get the heart-pulse (like the reference's BP
// icon); Exercise gets a running-man; the rest fall back to a generic
// target icon.
function goalIconFor(goal) {
  const c = (goal?.category || goal?.type || '').toLowerCase();
  if (c.startsWith('vital')) return 'solar:heart-pulse-linear';
  if (c.startsWith('exercise') || c.startsWith('activity')) return 'solar:running-linear';
  if (c.startsWith('diet')) return 'solar:donut-linear';
  if (c.startsWith('lab')) return 'solar:test-tube-linear';
  if (c.startsWith('assessment')) return 'solar:clipboard-list-linear';
  return 'solar:target-linear';
}
