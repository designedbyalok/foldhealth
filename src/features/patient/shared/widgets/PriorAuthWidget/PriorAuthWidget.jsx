import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../../components/Avatar/Avatar';
import { Badge } from '../../../../../components/Badge/Badge';
import { PanelSection, PanelSectionItem } from '../../../../../components/PanelSection/PanelSection';

const REQUESTS = [
  { id: 1, authNumber: '19112102700142400000', authDate: '11/18/23', status: 'Insurer Review', badgeVariant: 'warning' },
];

export function PriorAuthWidget() {
  return (
    <PanelSection
      icon="solar:document-medicine-linear"
      title="Prior Authorization Requests"
      actions={<ActionButton icon="solar:add-circle-linear" size="sm" tooltip="Add Prior Authorization" />}
    >
      {REQUESTS.map(r => (
        <PanelSectionItem
          key={r.id}
          leading={<Avatar type="icon" variant="patient" iconName="solar:document-text-linear" size="M" />}
          title={r.authNumber}
          meta={[`Auth Date ${r.authDate}`]}
          trailing={<Badge tone={r.badgeVariant} label={r.status} />}
        />
      ))}
    </PanelSection>
  );
}
