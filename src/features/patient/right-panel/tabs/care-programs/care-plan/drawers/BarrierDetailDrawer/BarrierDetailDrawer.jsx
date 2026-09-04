import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../../../components/Button/Button';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Input } from '../../../../../../../../components/Input/Input';
import { Select } from '../../../../../../../../components/Select/Select';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { ActivityLog } from '../../../../../../../../components/ActivityLog/ActivityLog';
import { LinkGoalToBarrierDrawer } from './LinkGoalToBarrierDrawer';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { formatGoalTarget, formatGoalDuration } from '../../../../../../../settings/care-plan-library/lib';
import styles from './BarrierDetailDrawer.module.css';

// Match the plan-level Barriers table exactly — same option list and
// same tone map, so status pills read identically in the drawer and
// the row.
const STATUS_OPTIONS = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${String(d.getFullYear()).slice(-2)}`;
}

/**
 * BarrierDetailDrawer — Barriers surface (Figma 2937:267306). Mirrors
 * the Goal Details drawer shape: editable title, status/delete/Update
 * header, metadata line, collapsible Linked Goals and Linked Templates
 * with link + unlink actions per row.
 *
 * "Templates" are the plan's chronic conditions. Every plan version
 * tracks its own set of conditions on `patient_care_plans.conditions`;
 * a barrier applying to a condition is represented in the store by
 * matching the condition's label against the barrier's title/context.
 * A `plan.conditions` mutation for linking is out of scope here — the
 * drawer surfaces the current linkage set and lets the user delink /
 * link additional plan conditions via the same `+` popover.
 */
// Split a "prev → next" detail string into its two halves so the
// ActivityLog can render them as separate pills.
function splitArrow(detail) {
  if (!detail || !detail.includes('→')) return [null, null];
  const [from, to] = detail.split('→').map(s => s.trim());
  return [from || null, to || null];
}

// Map a `patient_care_plan_audit` row for this barrier into the
// ActivityLog entry shape (`t` picks the variant renderer; `date` /
// `time` / `by` feed the meta line; `title` feeds the headline; the
// status-change variant expects `from` / `to` for the transition pills).
function mapBarrierAuditEntry(e) {
  const [from, to] = splitArrow(e.detail);
  const created = e.createdAt ? new Date(e.createdAt) : null;
  const date = created ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  const time = created ? created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
  const base = {
    id: e.id,
    date,
    time,
    by: e.actor || null,
    createdAt: e.createdAt,
    action: e.action,
  };
  switch (e.action) {
    case 'note':
      return { ...base, t: 'comment', title: 'Added a Note', commentBody: e.detail || '' };
    case 'status_changed':
      return { ...base, t: 'status_change', title: 'Status changed', from, to };
    case 'created':
      return {
        ...base,
        t: 'status_change',
        title: e.linkedGoalTitle ? `Linked to ${e.linkedGoalTitle}` : 'Barrier added',
      };
    case 'deleted':
      return {
        ...base,
        t: 'status_change',
        title: e.linkedGoalTitle ? `Unlinked from ${e.linkedGoalTitle}` : 'Barrier removed',
      };
    case 'updated':
      return {
        ...base,
        t: 'status_change',
        title: e.detail && e.detail.startsWith('Renamed') ? e.detail : 'Barrier edited',
      };
    case 'template_linked':
      return { ...base, t: 'status_change', title: `Linked template: ${e.summary || 'Template'}` };
    case 'template_unlinked':
      return { ...base, t: 'status_change', title: `Unlinked template: ${e.summary || 'Template'}` };
    default:
      return { ...base, t: 'status_change', title: e.summary || 'Barrier updated' };
  }
}

export function BarrierDetailDrawer({ barrier, patientId, program, onClose }) {
  const key = patientId && program ? `${patientId}::${program.id}` : null;
  const slice = useAppStore(s => (key ? s.patientCarePlans[key] : null));
  const auditAll = useAppStore(s => (key ? s.patientCarePlanAudit[key] : null)) || [];
  const savePatientCarePlanBarrier = useAppStore(s => s.savePatientCarePlanBarrier);
  const deletePatientCarePlanBarrier = useAppStore(s => s.deletePatientCarePlanBarrier);
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const showToast = useAppStore(s => s.showToast);

  const goalsInPlan = slice?.goals || [];
  const barriersInPlan = slice?.barriers || [];

  // Post-migration path: a barrier row carries its full goal set via
  // `goalIds`. We also merge in every legacy title-clone's goal_id so
  // pre-migration data reads as one logical barrier here too (matches
  // the same consolidation the Barriers table does).
  const normalizedTitle = (barrier?.title || '').trim().toLowerCase();
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
  // (chronic condition) that any of its linked goals binds to — a goal
  // authored under a plan template drags that template into the
  // barrier's linked set. Dedupe by label so a barrier linked to two
  // goals under the same template only shows the template once.
  const linkedTemplates = useMemo(() => {
    const seen = new Map();
    for (const { goal } of linkedGoals) {
      const conditions = Array.isArray(goal?.conditions) ? goal.conditions : [];
      for (const c of conditions) {
        const label = typeof c === 'string' ? c : c?.label;
        if (!label || seen.has(label)) continue;
        seen.set(label, { label, sourceGoalId: goal.id, sourceGoalTitle: goal.title });
      }
    }
    return Array.from(seen.values());
  }, [linkedGoals]);

  // Editable barrier fields — title + status are the two live editors
  // in the header; the rest is preserved as-is.
  const [title, setTitle] = useState(barrier.title || '');
  const [status, setStatus] = useState(barrier.status || 'Not Started');
  const [linkDrawerOpen, setLinkDrawerOpen] = useState(false);
  const [unlinkConfirm, setUnlinkConfirm] = useState(null);
  const [confirmDeleteBarrier, setConfirmDeleteBarrier] = useState(false);
  const [open, setOpen] = useState({ goals: true, templates: true });
  const toggle = (k) => setOpen(o => ({ ...o, [k]: !o[k] }));
  // Barrier's audit rows (this and every clone) — the set is used by
  // both the change-log derivation for the Add / Update Note editor
  // and the Activity Log feed below.
  const barrierIdSet = useMemo(
    () => new Set(legacyClones.map(b => String(b.id))),
    [legacyClones],
  );
  const latestBarrierNote = useMemo(() => {
    const notes = auditAll
      .filter(a => a.action === 'note'
        && (a.entityType === 'barrier' || a.entityType === 'note')
        && barrierIdSet.has(String(a.entityId)))
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
    return notes[0] || null;
  }, [auditAll, barrierIdSet]);
  const [note, setNote] = useState(latestBarrierNote?.detail || '');
  const [notePlain, setNotePlain] = useState(latestBarrierNote?.detail || '');
  // Whenever a new note lands (either the drawer just opened on a
  // different barrier or the user just submitted), re-seed the textarea
  // to the current latest so the editor keeps reading "Update Note".
  useEffect(() => {
    const seed = latestBarrierNote?.detail || '';
    setNote(seed);
    setNotePlain(seed);
  }, [latestBarrierNote?.id]);
  const submitNote = async () => {
    const body = note.trim();
    if (!body) return;
    await addCarePlanNote?.(patientId, program, body, {
      entityType: 'barrier',
      entityId: barrier.id,
      summary: `Note on ${barrier.title || 'barrier'}`,
    });
    showToast?.(latestBarrierNote ? 'Note updated' : 'Note added');
  };

  // Activity for this barrier — every audit row whose entityType is
  // 'barrier' and entityId matches any clone of THIS barrier (title
  // match across goals), plus every 'note' row keyed to the same. The
  // goal.id → goal.title index turns each clone's goal_id into the
  // "linked to <goal>" verb so the feed reads naturally.
  const goalIndex = useMemo(
    () => Object.fromEntries(goalsInPlan.map(g => [g.id, g.title])),
    [goalsInPlan],
  );
  const activityEntries = useMemo(() => {
    const rows = auditAll
      .filter(a => (a.entityType === 'barrier' || a.entityType === 'note')
        && barrierIdSet.has(String(a.entityId)))
      .map(a => {
        // Look up the goal each cloned row belongs to so linked/unlinked
        // reads as "linked to <goal>" instead of a bare "created".
        const cloneRow = legacyClones.find(b => String(b.id) === String(a.entityId));
        const linkedGoalTitle = cloneRow?.goalId ? goalIndex[cloneRow.goalId] : null;
        return mapBarrierAuditEntry({ ...a, linkedGoalTitle });
      })
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
    return rows;
  }, [auditAll, barrierIdSet, legacyClones, goalIndex]);

  // Title + status auto-save. Title waits ~500ms after the last keystroke
  // so quick edits don't spam Supabase, then persists onto every legacy
  // clone that still exists (pre-migration data) plus the canonical row.
  // Post-migration `legacyClones` collapses to `[barrier]` and this loop
  // becomes a single write. First mount is skipped so simply opening the
  // drawer doesn't fire a save.
  const persistedTitle = (barrier.title || '').trim();
  const persistedStatus = barrier.status || 'Not Started';
  const persistBarrier = async (nextTitle, nextStatus, doneVerb) => {
    const rows = legacyClones.length ? legacyClones : [barrier];
    for (const row of rows) {
      await savePatientCarePlanBarrier(patientId, program, {
        ...row,
        title: nextTitle,
        status: nextStatus,
        goalIds: Array.from(linkedGoalIdSet),
      }, row.id);
    }
    if (doneVerb) showToast?.(doneVerb);
  };
  const skipAutoSave = useMemo(() => ({ current: true }), []);
  useEffect(() => {
    if (skipAutoSave.current) { skipAutoSave.current = false; return; }
    const t = title.trim();
    if (t === persistedTitle && status === persistedStatus) return;
    const id = setTimeout(() => { persistBarrier(t, status, 'Barrier updated'); }, t === persistedTitle ? 0 : 500);
    return () => clearTimeout(id);
  }, [title, status]); // eslint-disable-line react-hooks/exhaustive-deps -- persistBarrier stable via closure

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
      ...barrier,
      title: title.trim() || barrier.title,
      description: barrier.description,
      status,
      priority: barrier.priority || 'medium',
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
        // Row's only link was this goal — delete the row entirely.
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
        noCloseDivider
        headerRight={null}
      >
        <div className={styles.body}>
          {/* Status bar — Select on the left, delete-barrier on the right.
              Matches the InterventionPreviewDrawer/GoalPreviewDrawer status
              row so all three drawers read as the same primitive. */}
          <div className={styles.statusBar}>
            <Select
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
              value={status}
              onChange={setStatus}
              portal
              className={styles.statusSelect}
              style={{ width: 'fit-content' }}
            />
            <ActionButton
              icon="solar:trash-bin-trash-linear"
              size="S"
              tooltip="Delete barrier"
              onClick={() => setConfirmDeleteBarrier(true)}
            />
          </div>

          {/* Editable barrier title. */}
          <div className={styles.field}>
            <span className={styles.label}>
              Edit Barrier <span className={styles.required} aria-hidden>•</span>
            </span>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Barrier name"
              aria-label="Barrier name"
            />
            <div className={styles.metaLine}>
              {startDate && <>Start Date : {startDate}</>}
              {startDate && updatedDate && <span className={styles.metaDot}>&bull;</span>}
              {updatedDate && <>Last Update : {updatedDate} by {updatedByName}</>}
            </div>
          </div>

          {/* Linked Goals. */}
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
              <ActionButton
                icon="solar:add-linear"
                size="S"
                tooltip="Link goal"
                aria-haspopup="dialog"
                aria-expanded={linkDrawerOpen}
                onClick={handleAddGoalClick}
              />
            </div>
            {open.goals && (
              linkedGoals.length === 0 ? (
                <div className={styles.empty}>Not linked to any goals in this plan version yet.</div>
              ) : (
                <ul className={styles.linkList}>
                  {linkedGoals.map(({ goal }) => {
                    const target = formatGoalTarget(goal);
                    const duration = formatGoalDuration(goal);
                    const subtitle = [target, duration].filter(Boolean).join(' for ');
                    return (
                      <li key={goal.id} className={styles.linkRow}>
                        <span className={styles.linkIcon}>
                          <Icon name={goalIconFor(goal)} size={16} color="var(--neutral-400)" />
                        </span>
                        <div className={styles.linkStack}>
                          <span className={styles.linkTitle}>{goal.title}</span>
                          {subtitle && <span className={styles.linkSubtitle}>{subtitle}</span>}
                        </div>
                        <div className={styles.linkActions}>
                          <ActionButton
                            icon="solar:arrow-right-up-linear"
                            size="S"
                            tooltip="Open goal"
                            onClick={() => { /* room to hoist onOpenGoal in a follow-up */ }}
                          />
                          <span className={styles.linkActionsDivider} aria-hidden />
                          <ActionButton
                            icon="solar:link-broken-minimalistic-linear"
                            size="S"
                            tooltip="Unlink"
                            onClick={() => setUnlinkConfirm({ goal })}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            )}
          </section>

          {/* Linked Templates — derived transitively from the linked
              goals' chronic-condition bindings. A goal authored under a
              plan template (e.g. Hypertension, Diabetes) drags that
              template into the barrier's linked set; deduped by label. */}
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
                  Link this barrier to a goal to inherit that goal&apos;s care-plan template.
                </div>
              ) : (
                <ul className={styles.linkList}>
                  {linkedTemplates.map((t, i) => (
                    <li key={`${t.label}-${i}`} className={styles.linkRow}>
                      <span className={styles.linkIcon}>
                        <Icon name="solar:hand-heart-linear" size={16} color="var(--neutral-400)" />
                      </span>
                      <div className={styles.linkStack}>
                        <span className={styles.linkTitle}>{t.label}</span>
                      </div>
                      <div className={styles.linkActions}>
                        <ActionButton
                          icon="solar:arrow-right-up-linear"
                          size="S"
                          tooltip="Open template"
                          onClick={() => { /* template detail route pending */ }}
                        />
                        <span className={styles.linkActionsDivider} aria-hidden />
                        <ActionButton
                          icon="solar:link-broken-minimalistic-linear"
                          size="S"
                          tooltip="Unlink"
                          onClick={() => showToast?.('Unlink the associated goal to remove this template link')}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}
          </section>

          {/* Add Note — mirrors the GoalPreviewDrawer note surface so
              writes land in the same care-plan audit stream. */}
          <div className={styles.noteEditor}>
            <Textarea
              title={latestBarrierNote ? 'Update Note' : 'Add Note'}
              placeholder="Add a note"
              value={note}
              onChange={(value) => {
                const v = typeof value === 'string' ? value : '';
                setNote(v);
                setNotePlain(v);
              }}
              rows={3}
            />
            {(() => {
              const baseline = (latestBarrierNote?.detail || '').trim();
              const current = note.trim();
              const canSave = current.length > 0 && current !== baseline;
              const canDiscard = current !== baseline;
              return (
                <div className={styles.noteActions}>
                  <Button
                    variant="secondary"
                    size="M"
                    disabled={!canDiscard}
                    onClick={() => { setNote(baseline); setNotePlain(baseline); }}
                  >
                    Discard
                  </Button>
                  <Button
                    variant="primary"
                    size="M"
                    disabled={!canSave}
                    onClick={submitNote}
                  >
                    {latestBarrierNote ? 'Update Note' : 'Add Note'}
                  </Button>
                </div>
              );
            })()}
          </div>

          {/* Activity Log for this barrier — status changes, edits, goal
              link / unlink, template link / unlink, and notes. Reuses the
              shared ActivityLog primitive so entries render identically to
              GoalPreviewDrawer / TaskDetailDrawer. */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>Activity Log</span>
            </div>
            <ActivityLog
              entries={activityEntries}
              emptyLabel="No activity for this barrier yet."
            />
          </section>
        </div>
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
