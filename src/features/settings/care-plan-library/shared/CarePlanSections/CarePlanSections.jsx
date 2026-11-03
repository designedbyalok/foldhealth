import { useState } from 'react';
import { Badge } from '../../../../../components/Badge/Badge';
import { MenuPopover } from '../../../../../components/MenuPopover/MenuPopover';
import { PriorityIcon } from '../../../../../components/PriorityIcon/PriorityIcon';
import { PRIORITIES } from '../../../../patient/right-panel/tabs/care-programs/care-plan/CarePlanView/CarePlanViewSections';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import { CarePlanGoalsTable } from '../../../../patient/right-panel/tabs/care-programs/care-plan/tables/CarePlanGoalsTable';
import { CarePlanInterventionsTable } from '../../../../patient/right-panel/tabs/care-programs/care-plan/tables/CarePlanInterventionsTable';
import { CarePlanBarriersTable } from '../../../../patient/right-panel/tabs/care-programs/care-plan/tables/CarePlanBarriersTable';
import { SdohSection } from '../../../../patient/right-panel/tabs/care-programs/care-plan/sdoh/SdohSection';
import styles from './CarePlanSections.module.css';

/**
 * The Goals / Interventions / Barriers stack, rendered with the patient care
 * plan's own GBI tables. Shared by the template screen and New Care Plan so a
 * plan reads identically wherever it is being built or reviewed.
 */
export function CarePlanSections({
  goalRows, interventionRows, barrierRows, footer,
  onOpenGoal, onOpenIntervention,
  linkedForGoal, linkedForChild,
  onAddGoal, onAddIntervention, onAddBarrier,
  onRowMenuGoal, onRowMenuIntervention, onRowMenuBarrier,
  // (row, priority) => void: a barrier's priority was picked. Omitted, the
  // priority shows but can't be changed.
  onChangeBarrierPriority,
  sdoh,
}) {
  const [priorityMenu, setPriorityMenu] = useState(null); // { item, rect }
  // The "+" only appears where the caller can act on it, so a read-only
  // rendering of the same sections stays read-only.
  const section = (label, count, table, onAdd) => (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>{label}</span>
        <Badge size="sm" label={String(count)} />
        {onAdd && (
          <>
            <span className={styles.headDivider} aria-hidden="true" />
            <ActionButton size="sm" tooltip={`Add ${label.toLowerCase()}`} onClick={onAdd}>
              <AddIconMinimalist size={16} color="var(--neutral-300)" />
            </ActionButton>
          </>
        )}
      </div>
      {table}
    </div>
  );

  return (
    <div className={styles.sections}>
      {section('Goals', goalRows.length,
        <CarePlanGoalsTable
          rows={goalRows}
          canEdit={false}
          linked={linkedForGoal || (() => null)}
          template
          onOpenGoal={onOpenGoal || (() => {})}
          onRowMenu={onRowMenuGoal}
        />, onAddGoal)}
      {section('Interventions', interventionRows.length,
        <CarePlanInterventionsTable
          rows={interventionRows}
          canEdit={false}
          linked={linkedForChild || (() => null)}
          template
          onOpenIntervention={onOpenIntervention || (() => {})}
          onRowMenu={onRowMenuIntervention}
        />, onAddIntervention)}
      {section('Barriers', barrierRows.length,
        <CarePlanBarriersTable
          rows={barrierRows}
          canEdit={false}
          linked={linkedForChild || (() => null)}
          template
          onRowMenu={onRowMenuBarrier}
          onPriorityMenu={onChangeBarrierPriority ? ({ item, rect }) => setPriorityMenu({ item, rect }) : undefined}
        />, onAddBarrier)}
      {/* Social Needs (SDOH): needs by domain and suggested referrals
          (lib/useTemplateSdoh). Each domain card adds its own needs. */}
      {sdoh && section('Social Needs (SDOH)', sdoh.barriers.length,
        <SdohSection mode="template" {...sdoh} />)}
      {footer}
      {priorityMenu && (
        <MenuPopover
          anchorRect={priorityMenu.rect}
          align="left"
          width={160}
          ariaLabel="Change priority"
          items={PRIORITIES.map(p => ({ key: p, label: p.charAt(0).toUpperCase() + p.slice(1), iconElement: <PriorityIcon priority={p} size={16} /> }))}
          onSelect={(p) => { onChangeBarrierPriority(priorityMenu.item, p); setPriorityMenu(null); }}
          onClose={() => setPriorityMenu(null)}
        />
      )}
    </div>
  );
}
