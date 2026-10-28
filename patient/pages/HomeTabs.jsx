import { useState } from 'react';
import { TabStrip } from '@/components/TabStrip/TabStrip';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { HealthRecords } from '../records/HealthRecords';
import { CareTasks } from '../tasks/CareTasks';
import { Documents } from '../documents/Documents';
import styles from './HomePage.module.css';

const TABS = [
  { key: 'tasks', label: 'Care Tasks' },
  { key: 'records', label: 'Health Records' },
  { key: 'documents', label: 'Documents' },
  { key: 'claims', label: 'Claims' },
];

const SOON = {
  claims: { icon: 'solar:wallet-money-linear', title: 'Claims are coming soon', description: 'Your coverage and claims will show here.' },
};

// Home's right panel (frame 701:4555): Care Tasks, Health Records, Documents, Claims.
export function HomeTabs({ memberId }) {
  const [tab, setTab] = useState('tasks');
  const soon = SOON[tab];
  return (
    <div className={styles.tabs}>
      <TabStrip items={TABS} activeKey={tab} onChange={setTab} fullWidth={false} />
      <div className={styles.tabBody}>
        {tab === 'tasks' && <CareTasks key={memberId} memberId={memberId} />}
        {tab === 'records' && <HealthRecords key={memberId} memberId={memberId} />}
        {tab === 'documents' && <Documents key={memberId} memberId={memberId} />}
        {soon && (
          <div className={styles.card}>
            <EmptyState icon={soon.icon} title={soon.title} description={soon.description} />
          </div>
        )}
      </div>
    </div>
  );
}
