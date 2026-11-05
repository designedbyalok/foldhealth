import { useMemo, useRef, useState } from 'react';
import { ActionButton } from '@/components/ActionButton/ActionButton';
import { Badge } from '@/components/Badge/Badge';
import { LinkageTree } from '@/components/LinkageTree/LinkageTree';
import { MenuPopover } from '@/components/MenuPopover/MenuPopover';
import { SimpleTableSkeleton } from '@/components/SimpleTableSkeleton/SimpleTableSkeleton';
import { formatGoalTarget, formatGoalFrequency } from '../../../../../../settings/care-plan-library/lib';
import { gbiStatusMeta } from '../lib/gbiStatus';
import { GBI_STATUS_TONE } from '../tables/carePlanTableShared';
import { barrierGoalIds } from './carePlanLinkedItems';

const UNLINKED = '__unlinked';
const INTV_ICON = 'solar:checklist-minimalistic-linear';
const BARRIER_ICON = 'solar:signpost-2-linear';

const statusBadge = (status) => (status ? (
  <Badge tone={GBI_STATUS_TONE[status] || 'neutral'} size="sm" icon={gbiStatusMeta(status).icon} label={status} />
) : null);

/** "Link to goal": adds a goal to a barrier, or moves an intervention (one goal each). */
function LinkToGoalButton({ item, goals, onPick }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const linked = new Set(item.goalIds);
  const options = goals
    .filter(g => !linked.has(String(g.id)))
    .map(g => ({ key: String(g.id), icon: g.icon || 'solar:flag-linear', label: g.title }));
  return (
    <>
      <ActionButton
        ref={ref}
        icon="solar:link-linear"
        size="sm"
        tooltip={options.length ? 'Link to goal' : 'Linked to every goal'}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!options.length}
        onClick={() => setOpen(v => !v)}
      />
      {open && (
        <MenuPopover
          anchorRef={ref}
          align="right"
          width={320}
          ariaLabel="Link to goal"
          items={options}
          onSelect={(key) => { setOpen(false); onPick(key); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The care plan's Linkage view: each goal with the interventions and
 * barriers linked to it nested beneath, then everything not linked to a
 * goal in an Unlinked group. Dragging a child to another goal moves its
 * link there; dropping it on Unlinked removes the link it was dragged from.
 * Writes go through the same save calls as the drawers, so the store logs
 * goal_linked / goal_unlinked history as usual.
 */
export function CarePlanLinkageSection({
  goals, interventions, barriers, allGoals, loading, canEdit,
  patientId, program, saveIntervention, saveBarrier, showToast,
  onOpenGoal, onOpenIntervention, onOpenBarrier,
}) {
  const goalById = useMemo(() => new Map(allGoals.map(g => [String(g.id), g])), [allGoals]);

  const groups = useMemo(() => {
    const existing = (ids) => ids.filter(id => goalById.has(id));
    const intvItems = interventions.map(i => ({
      key: `intervention:${i.id}`,
      kind: 'intervention',
      record: i,
      goalIds: existing(i.goalId != null ? [String(i.goalId)] : []),
      title: i.title,
      icon: i.icon || INTV_ICON,
      meta: 'Intervention',
      trailing: statusBadge(i.status),
      onOpen: () => onOpenIntervention(i),
    }));
    const barrierItems = barriers.map((b) => {
      const ids = existing(barrierGoalIds(b).map(String));
      return {
        key: `barrier:${b.id}`,
        kind: 'barrier',
        record: b,
        goalIds: ids,
        title: b.title,
        icon: BARRIER_ICON,
        meta: ids.length > 1 ? `Barrier • Linked to ${ids.length} goals` : 'Barrier',
        trailing: statusBadge(b.status),
        onOpen: () => onOpenBarrier(b),
      };
    });
    const children = [...intvItems, ...barrierItems];
    return [
      ...goals.map(g => ({
        key: String(g.id),
        title: g.title,
        icon: g.icon || 'solar:flag-linear',
        meta: [formatGoalTarget(g) && `Target ${formatGoalTarget(g)}`, formatGoalFrequency(g)].filter(Boolean).join(' • ') || 'Goal',
        trailing: statusBadge(g.status),
        onOpen: () => onOpenGoal(g),
        emptyText: 'No interventions or barriers linked yet',
        items: children.filter(c => c.goalIds.includes(String(g.id))),
      })),
      {
        key: UNLINKED,
        title: 'Unlinked',
        unlinked: true,
        emptyText: 'Every intervention and barrier is linked to a goal.',
        items: children.filter(c => c.goalIds.length === 0),
      },
    ];
  }, [goals, interventions, barriers, goalById, onOpenGoal, onOpenIntervention, onOpenBarrier]);

  const relink = async (item, fromKey, toKey) => {
    const from = fromKey === UNLINKED ? null : fromKey;
    const to = toKey === UNLINKED ? null : toKey;
    const { record } = item;
    if (item.kind === 'intervention') {
      // Interventions keep the goal's own id type, as the goal drawer saves it.
      await saveIntervention(patientId, program, { ...record, goalId: to ? goalById.get(to).id : null }, record.id);
    } else {
      let ids = barrierGoalIds(record).map(String);
      if (from) ids = ids.filter(id => id !== from);
      if (to && !ids.includes(to)) ids = [...ids, to];
      await saveBarrier(patientId, program, { ...record, goalIds: ids, goalId: ids[0] || null }, record.id);
    }
    showToast?.(to
      ? `Linked "${item.title}" to ${goalById.get(to).title}`
      : `Unlinked "${item.title}" from ${goalById.get(from)?.title || 'its goal'}`);
  };

  if (loading) return <SimpleTableSkeleton rows={4} cols={3} />;

  return (
    <LinkageTree
      groups={groups}
      readOnly={!canEdit}
      onMove={relink}
      renderItemActions={(item, groupKey) => (
        <>
          <LinkToGoalButton
            item={item}
            goals={goals}
            // An intervention has one goal, so linking it elsewhere moves it.
            onPick={(goalKey) => relink(item, item.kind === 'intervention' ? groupKey : UNLINKED, goalKey)}
          />
          {groupKey !== UNLINKED && (
            <ActionButton
              icon="solar:link-broken-minimalistic-linear"
              size="sm"
              tooltip="Unlink from goal"
              onClick={() => relink(item, groupKey, UNLINKED)}
            />
          )}
        </>
      )}
    />
  );
}
