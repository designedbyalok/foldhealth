import { useMemo, useState } from 'react';
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
// ActivityLog entry shape. Handles the actions the store currently
// emits (created, status_changed, updated, deleted, note) plus the
// derived link/unlink verbs the drawer needs.
function mapBarrierAuditEntry(e) {
  const [from, to] = splitArrow(e.detail);
  const base = { id: e.id, actor: e.actor || '', at: e.createdAt, createdAt: e.createdAt, action: e.action };
  switch (e.action) {
    case 'note':
      return { ...base, verb: 'added a', field: 'Note', comment: e.detail };
    case 'status_changed':
      return { ...base, verb: 'changed the', field: 'Status', from, to, fromTone: 'grey', toTone: 'grey' };
    case 'created':
      // The barrier's very first row is a "created"; every subsequent
      // clone under a different goal is a "linked to goal" event.
      return { ...base, verb: e.linkedGoalTitle ? 'linked to' : 'added a', field: e.linkedGoalTitle || 'Barrier', comment: e.linkedGoalTitle ? undefined : undefined };
    case 'deleted':
      return { ...base, verb: e.linkedGoalTitle ? 'unlinked from' : 'removed the', field: e.linkedGoalTitle || 'Barrier' };
    case 'updated':
      if (e.detail && e.detail.startsWith('Renamed')) {
        return { ...base, verb: 'edited the', field: 'Barrier', comment: e.detail };
      }
      return { ...base, verb: 'edited the', field: 'Barrier' };
    case 'template_linked':
      return { ...base, verb: 'linked template', field: e.summary || 'Template' };
    case 'template_unlinked':
      return { ...base, verb: 'unlinked template', field: e.summary || 'Template' };
    default:
      return { ...base, verb: 'updated', field: e.summary || 'Barrier' };
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

  // Match every barrier row in the plan whose title is the same as
  // this one (title-based M:N shim over the 1:1 goal_id column).
  const normalizedTitle = (barrier?.title || '').trim().toLowerCase();
  const linkedBarrierRows = useMemo(
    () => barriersInPlan.filter(b => (b.title || '').trim().toLowerCase() === normalizedTitle),
    [barriersInPlan, normalizedTitle],
  );
  const linkedGoals = useMemo(() => (
    linkedBarrierRows
      .map(b => ({ barrierRowId: b.id, goal: goalsInPlan.find(g => g.id === b.goalId) }))
      .filter(x => !!x.goal)
  ), [linkedBarrierRows, goalsInPlan]);

  const linkedGoalIds = new Set(linkedGoals.map(x => x.goal.id));
  const availableGoals = useMemo(
    () => goalsInPlan.filter(g => !linkedGoalIds.has(g.id)),
    [goalsInPlan, linkedGoalIds],
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
  const [note, setNote] = useState('');
  const [notePlain, setNotePlain] = useState('');
  const submitNote = async () => {
    const body = (notePlain || note).replace(/<[^>]+>/g, '').trim();
    if (!body) return;
    await addCarePlanNote?.(patientId, program, body, {
      entityType: 'barrier',
      entityId: barrier.id,
      summary: `Note on ${barrier.title || 'barrier'}`,
    });
    setNote('');
    setNotePlain('');
    showToast?.('Note added');
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
  const barrierIdSet = useMemo(
    () => new Set(linkedBarrierRows.map(b => String(b.id))),
    [linkedBarrierRows],
  );
  const activityEntries = useMemo(() => {
    const rows = auditAll
      .filter(a => (a.entityType === 'barrier' || a.entityType === 'note')
        && barrierIdSet.has(String(a.entityId)))
      .map(a => {
        // Look up the goal each cloned row belongs to so linked/unlinked
        // reads as "linked to <goal>" instead of a bare "created".
        const cloneRow = linkedBarrierRows.find(b => String(b.id) === String(a.entityId));
        const linkedGoalTitle = cloneRow?.goalId ? goalIndex[cloneRow.goalId] : null;
        return mapBarrierAuditEntry({ ...a, linkedGoalTitle });
      })
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
    return rows;
  }, [auditAll, barrierIdSet, linkedBarrierRows, goalIndex]);

  const dirty = title.trim() !== (barrier.title || '') || status !== (barrier.status || 'Not Started');

  const handleUpdate = async () => {
    if (!dirty) return;
    // Persist across every clone that shares this barrier's title so
    // the M:N view stays coherent (rename + re-status is applied to
    // every linked-goal row).
    for (const row of linkedBarrierRows) {
      await savePatientCarePlanBarrier(patientId, program, {
        ...row,
        title: title.trim(),
        status,
      }, row.id);
    }
    showToast?.('Barrier updated');
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
    for (const goalId of goalIds) {
      await savePatientCarePlanBarrier(patientId, program, {
        goalId,
        title: title.trim() || barrier.title,
        description: barrier.description,
        status,
        priority: barrier.priority || 'medium',
      });
    }
    showToast?.(goalIds.length === 1
      ? `Linked to ${goalsInPlan.find(g => g.id === goalIds[0])?.title || 'goal'}`
      : `Linked to ${goalIds.length} goals`);
  };

  const handleUnlink = async () => {
    const target = unlinkConfirm;
    setUnlinkConfirm(null);
    if (!target) return;
    await deletePatientCarePlanBarrier(patientId, program.id, target.barrierRowId);
    showToast?.(`Unlinked from ${target.goal.title}`);
    // If the drawer's own row was just removed and we still have peer
    // rows to show, keep the drawer open — otherwise close.
    if (target.barrierRowId === barrier.id && linkedGoals.length <= 1) onClose?.();
  };

  const handleDeleteBarrier = async () => {
    setConfirmDeleteBarrier(false);
    for (const row of linkedBarrierRows) {
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
        headerRight={
          <>
            <Button
              variant="primary"
              size="M"
              disabled={!dirty}
              onClick={handleUpdate}
            >
              Update
            </Button>
            <span className={styles.headerDivider} aria-hidden />
          </>
        }
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
                  {linkedGoals.map(({ barrierRowId, goal }) => {
                    const target = formatGoalTarget(goal);
                    const duration = formatGoalDuration(goal);
                    const subtitle = [target, duration].filter(Boolean).join(' for ');
                    return (
                      <li key={barrierRowId} className={styles.linkRow}>
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
                            onClick={() => setUnlinkConfirm({ barrierRowId, goal })}
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
          <Textarea
            title="Add Note"
            placeholder="Add a note"
            value={note}
            onChange={(html, extra) => {
              setNote(typeof html === 'string' ? html : '');
              setNotePlain(typeof extra === 'string' ? extra : (typeof html === 'string' ? html : ''));
            }}
            richText
            attachment
            rows={3}
            bottomButton={{
              label: 'Add Note',
              onClick: submitNote,
              disabled: !(notePlain || note).replace(/<[^>]+>/g, '').trim(),
            }}
          />

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
