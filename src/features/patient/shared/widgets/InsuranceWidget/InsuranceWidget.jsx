import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../../components/Avatar/Avatar';
import { Badge } from '../../../../../components/Badge/Badge';
import { PanelSection, PanelSectionDivider, PanelSectionItem } from '../../../../../components/PanelSection/PanelSection';
import styles from './InsuranceWidget.module.css';

const POLICIES = [
  { id: 1, name: 'BlueCross Blue Shield', status: 'Insured', badgeVariant: 'success', relationship: 'Self' },
  { id: 2, name: 'American Heritage-Workplace Division', status: 'Expired', badgeVariant: 'danger', relationship: 'Mother' },
];

export function InsuranceWidget() {
  return (
    <PanelSection
      icon="solar:shield-check-linear"
      title="Insurance"
      actions={(
        <>
          <span className={styles.lastChecked}>Last checked 02/19/2024</span>
          <ActionButton icon="solar:refresh-linear" size="sm" tooltip="Refresh" />
          <PanelSectionDivider />
          <ActionButton icon="solar:add-circle-linear" size="sm" tooltip="Add Insurance" />
        </>
      )}
    >
      {POLICIES.map(p => (
        <PanelSectionItem
          key={p.id}
          leading={<Avatar type="icon" variant="patient" iconName="solar:umbrella-linear" size="M" />}
          title={p.name}
          meta={[p.relationship]}
          trailing={<Badge tone={p.badgeVariant} label={p.status} />}
        />
      ))}
    </PanelSection>
  );
}
