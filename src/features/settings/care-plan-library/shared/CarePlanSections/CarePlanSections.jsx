import { Badge } from '../../../../../components/Badge/Badge';
import { CarePlanGoalsTable } from '../../../../patient/right-panel/tabs/care-programs/care-plan/tables/CarePlanGoalsTable';
import { CarePlanInterventionsTable } from '../../../../patient/right-panel/tabs/care-programs/care-plan/tables/CarePlanInterventionsTable';
import { CarePlanBarriersTable } from '../../../../patient/right-panel/tabs/care-programs/care-plan/tables/CarePlanBarriersTable';
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
}) {
  const section = (label, count, table) => (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>{label}</span>
        <Badge tone="grey" size="S" label={String(count)} />
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
        />)}
      {section('Interventions', interventionRows.length,
        <CarePlanInterventionsTable
          rows={interventionRows}
          canEdit={false}
          linked={linkedForChild || (() => null)}
          template
          onOpenIntervention={onOpenIntervention || (() => {})}
        />)}
      {section('Barriers', barrierRows.length,
        <CarePlanBarriersTable
          rows={barrierRows}
          canEdit={false}
          linked={linkedForChild || (() => null)}
          template
        />)}
      {footer}
    </div>
  );
}
