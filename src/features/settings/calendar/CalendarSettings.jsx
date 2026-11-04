import { useState } from 'react';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { HolidaysTab } from './HolidaysTab';
import { OooRecordsTab } from './OooRecordsTab';
import { UserAvailabilityTab } from './availability/UserAvailabilityTab';
import { AppointmentTypesTab } from './AppointmentTypesTab';
import styles from './CalendarSettings.module.css';

const TABS = [
  { key: 'practice', label: 'Practice availability' },
  { key: 'users', label: 'User availability' },
  { key: 'ooo', label: 'OOO Records' },
  { key: 'types', label: 'Appointment types' },
  { key: 'suggestions', label: 'Suggestions' },
  { key: 'manage', label: 'Manage calendar' },
  { key: 'holidays', label: 'Holiday configuration' },
];

export function CalendarSettings() {
  const [tab, setTab] = useState('users');
  // OOO Records owns its tab row's tools (search, filters, New OOO Record).
  if (tab === 'ooo') return <OooRecordsTab tabs={TABS} activeTab={tab} onTabChange={setTab} />;
  if (tab === 'holidays') return <HolidaysTab tabs={TABS} activeTab={tab} onTabChange={setTab} />;
  if (tab === 'users') return <UserAvailabilityTab tabs={TABS} activeTab={tab} onTabChange={setTab} />;
  if (tab === 'types') return <AppointmentTypesTab tabs={TABS} activeTab={tab} onTabChange={setTab} />;
  return (
    <div className={styles.wrapper}>
      <SectionTitleBar
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        actions={[]}
      />
      <div className={styles.content}>
        <div className={styles.empty}>
          <EmptyState icon="solar:calendar-linear" title={`${TABS.find(t => t.key === tab)?.label} is coming soon`} />
        </div>
      </div>
    </div>
  );
}
