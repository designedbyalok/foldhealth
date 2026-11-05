import { MenuPopover } from '@/components/MenuPopover/MenuPopover';
import { PriorityIcon } from '@/components/PriorityIcon/PriorityIcon';
import { PRIORITIES } from './CarePlanViewSections';
import { gbiStatusMenuItems } from '../tables/carePlanTableShared';
import { CARE_PLAN_INTERVENTION_MENU } from '../lib/carePlanInterventionMenu';
import { CarePlanLinkDrawer } from '../drawers/CarePlanLinkDrawer/CarePlanLinkDrawer';
import { LinkExistingItemsPopover } from '../drawers/GoalPreviewDrawer/LinkExistingItemsPopover';

/** Row/bulk menus, link popover, and link drawer (presentation only). */
export function CarePlanViewOverlays(o) {
  const {
    statusMenu, changeStatus, setStatusMenu,
    bulkMenu, bulkSetPriority, bulkSetStatus, setBulkMenu,
    linkOwner, patientId, program, patientName, setLinkOwner,
    rowMenuItems, intvTypeMenu, setIntvTypeMenu, setTaskGoalId, setTaskDrawerOpen, setIntvSpecialDrawer,
    linkPopover, linkCandidates, setLinkPopover, confirmLinkExisting,
    priorityMenu, changePriority, setPriorityMenu,
    barrierAddGoalIdRef, setAddBarriersDrawerOpen, setDeleteTarget, setBarrierDrawer, showToast,
  } = o;

  return (
    <>
      {/* Status change menu (goals + interventions + barriers) */}
      {statusMenu && (statusMenu.kind === 'goal' || statusMenu.kind === 'intv' || statusMenu.kind === 'barrier') && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align="left"
          width={180}
          ariaLabel="Change status"
          items={gbiStatusMenuItems(statusMenu.kind, statusMenu.item?.status)}
          onSelect={changeStatus}
          onClose={() => setStatusMenu(null)}
        />
      )}

      {bulkMenu && (
        <MenuPopover
          anchorRect={bulkMenu.rect}
          align="left"
          width={180}
          ariaLabel={bulkMenu.type === 'priority' ? 'Set priority for selected' : 'Set status for selected'}
          items={bulkMenu.type === 'priority'
            ? PRIORITIES.map(p => ({ key: p, label: p.charAt(0).toUpperCase() + p.slice(1), iconElement: <PriorityIcon priority={p} size={16} /> }))
            : gbiStatusMenuItems(bulkMenu.barriersOnly ? 'barrier' : 'goal')}
          onSelect={bulkMenu.type === 'priority' ? bulkSetPriority : bulkSetStatus}
          onClose={() => setBulkMenu(null)}
        />
      )}

      {linkOwner && (
        <CarePlanLinkDrawer
          patientId={patientId}
          program={program}
          patientName={patientName}
          owner={linkOwner}
          onClose={() => setLinkOwner(null)}
        />
      )}

      {/* Row overflow menu (rename / remove) */}
      {statusMenu && (statusMenu.kind === 'goal-menu' || statusMenu.kind === 'intv-menu' || statusMenu.kind === 'barrier-menu') && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          width={statusMenu.kind === 'goal-menu' ? 232 : 160}
          ariaLabel="Row actions"
          items={rowMenuItems(statusMenu.kind)}
          onSelect={(k) => {
            const kind = statusMenu.kind;
            const isGoal = kind === 'goal-menu';
            const isBarrier = kind === 'barrier-menu';
            const item = statusMenu.item;
            const rect = statusMenu.rect;
            setStatusMenu(null);
            if (k === 'add-intv') { setIntvTypeMenu({ rect, goalId: item.id }); return; }
            if (k === 'link-intv') { setLinkPopover({ kind: 'intervention', goalId: item.id, rect, selected: new Set() }); return; }
            if (k === 'add-barrier') { barrierAddGoalIdRef.current = item.id; setAddBarriersDrawerOpen(true); return; }
            if (k === 'link-barrier') { setLinkPopover({ kind: 'barrier', goalId: item.id, rect, selected: new Set() }); return; }
            if (k === 'delete') setDeleteTarget({ kind: isGoal ? 'goal' : isBarrier ? 'barrier' : 'intv', id: item.id, name: item.title, item });
            else if (k === 'rename' && isBarrier) setBarrierDrawer({ barrier: item });
            // Intervention "Edit" goes straight to the kind-specific
            // editor, skipping the Preview drawer. No `previewOnClose`
            // is set here: closing the editor returns to the plan
            // screen, matching what the user picked from the menu.
            else if (k === 'rename' && !isGoal) setIntvSpecialDrawer({ kind: item.kind, intervention: item });
            // Goal rename happens inline via EditableTitle; nudge the user there.
            else if (k === 'rename' && isGoal) showToast('Open the goal to review details, use Remove to delete it.');
          }}
          onClose={() => setStatusMenu(null)}
        />
      )}

      {/* Row-menu "Add Intervention": pick a type, then open its editor
          pre-linked to the goal the row belongs to. */}
      {intvTypeMenu && (
        <MenuPopover
          anchorRect={intvTypeMenu.rect}
          align="right"
          width={200}
          ariaLabel="Add intervention"
          items={CARE_PLAN_INTERVENTION_MENU}
          onSelect={(key) => {
            const goalId = intvTypeMenu.goalId;
            setIntvTypeMenu(null);
            if (key === 'patient-task' || key === 'internal-task') { setTaskGoalId(goalId); setTaskDrawerOpen(key); }
            else setIntvSpecialDrawer({ kind: key, presetGoalId: goalId });
          }}
          onClose={() => setIntvTypeMenu(null)}
        />
      )}

      {/* Row-menu "Link existing intervention / barrier": staged checkbox
          list, committed with the Link button. */}
      {linkPopover && (() => {
        const items = linkCandidates(linkPopover.kind, linkPopover.goalId)
          .map(it => ({ ...it, checked: linkPopover.selected.has(it.id) }));
        return (
          <LinkExistingItemsPopover
            anchorRect={linkPopover.rect}
            width={280}
            ariaLabel={`Link existing ${linkPopover.kind}`}
            title={`Link existing ${linkPopover.kind === 'intervention' ? 'interventions' : 'barriers'}`}
            items={items}
            emptyLabel={`No ${linkPopover.kind === 'intervention' ? 'interventions' : 'barriers'} to link.`}
            onToggle={(id, checked) => setLinkPopover(p => {
              const selected = new Set(p.selected);
              if (checked) selected.add(id); else selected.delete(id);
              return { ...p, selected };
            })}
            confirmLabel="Link"
            confirmDisabled={linkPopover.selected.size === 0}
            onConfirm={confirmLinkExisting}
            onClose={() => setLinkPopover(null)}
          />
        );
      })()}

      {/* Priority change menu (goals / barriers / interventions) */}
      {priorityMenu && (
        <MenuPopover
          anchorRect={priorityMenu.rect}
          align="left"
          width={160}
          ariaLabel="Change priority"
          items={PRIORITIES.map(p => ({ key: p, label: p.charAt(0).toUpperCase() + p.slice(1), iconElement: <PriorityIcon priority={p} size={16} /> }))}
          onSelect={changePriority}
          onClose={() => setPriorityMenu(null)}
        />
      )}
    </>
  );
}
