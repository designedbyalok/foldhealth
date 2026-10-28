import { useState } from 'react';
import { TabStrip } from '@/components/TabStrip/TabStrip';
import { HealthRecords } from '../records/HealthRecords';
import { CareTasks } from '../tasks/CareTasks';
import { Documents } from '../documents/Documents';
import { Claims } from '../claims/Claims';
import styles from './HomePage.module.css';

const TABS = [
  { key: 'tasks', label: 'Care Tasks' },
  { key: 'records', label: 'Health Records' },
  { key: 'documents', label: 'Documents' },
  { key: 'claims', label: 'Claims' },
];

// Home's right panel (frame 701:4555): Care Tasks, Health Records, Documents, Claims.
export function HomeTabs({ memberId }) {
  const [tab, setTab] = useState('tasks');
  return (
    <div className={styles.tabs}>
      <TabStrip items={TABS} activeKey={tab} onChange={setTab} fullWidth={false} />
      <div className={styles.tabBody}>
        {tab === 'tasks' && <CareTasks key={memberId} memberId={memberId} />}
        {tab === 'records' && <HealthRecords key={memberId} memberId={memberId} />}
        {tab === 'documents' && <Documents key={memberId} memberId={memberId} />}
        {tab === 'claims' && <Claims key={memberId} memberId={memberId} />}
      </div>
    </div>
  );
}
