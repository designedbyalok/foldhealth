import { Avatar } from '../../../../../components/Avatar/Avatar';
import { Badge } from '../../../../../components/Badge/Badge';
import { PanelSection, PanelSectionItem } from '../../../../../components/PanelSection/PanelSection';
import styles from './SubscriptionWidget.module.css';

const SUBSCRIPTIONS = [
  { id: 1, name: 'Daily Subscription', period: 'Feb 11, 2025 – Mar 11, 2026', expiry: 'Expires in an hour', status: 'Active', badgeVariant: 'success', price: '$10/Day' },
];

export function SubscriptionWidget() {
  return (
    <PanelSection icon="solar:card-linear" title="Subscription">
      {SUBSCRIPTIONS.map(s => (
        <PanelSectionItem
          key={s.id}
          leading={<Avatar type="icon" variant="patient" iconName="solar:card-linear" size="M" />}
          title={s.name}
          meta={[s.period, s.expiry && <span className={styles.expiry}>{s.expiry}</span>]}
          trailing={(
            <>
              <span className={styles.price}>{s.price}</span>
              <Badge tone={s.badgeVariant} label={s.status} />
            </>
          )}
        />
      ))}
    </PanelSection>
  );
}
