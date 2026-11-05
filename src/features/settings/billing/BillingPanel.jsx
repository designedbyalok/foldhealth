import { useEffect, useState } from 'react';
import { ApcmBillingTable } from '../../apcm-billing/ApcmBillingTable';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { useAppStore } from '../../../store/useAppStore';
import { BillableTab } from './BillableTab';
import { BillingHistoryTab } from './BillingHistoryTab';
import { TimerSettingsTab } from './TimerSettingsTab';
import styles from './BillingPanel.module.css';

const TABS = [
  { key: 'apcm', label: 'APCM Billing' },
  { key: 'billable', label: 'Billable' },
  { key: 'history', label: 'Billing History' },
  { key: 'timer', label: 'Timer Access' },
];

export function BillingPanel() {
  const [activeTab, setActiveTab] = useState('apcm');
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchCareProgramBilling = useAppStore(s => s.fetchCareProgramBilling);
  const billable = useAppStore(s => s.billableClaims);
  const reports = useAppStore(s => s.billingReports);
  const timerSettings = useAppStore(s => s.billingTimerSettings);
  const fetched = useAppStore(s => s.careProgramBillingFetched);
  useEffect(() => { fetchCareProgramBilling(); }, [fetchCareProgramBilling]);
  const loading = !fetched;
  const isApcm = activeTab === 'apcm';

  return (
    <div className={styles.wrapper}>
      <SectionTitleBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={isApcm ? ['search', 'filter'] : []}
        searchPlaceholder="Search member, ID, or EHR ID…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filterActive={filtersOpen}
        onFilter={() => setFiltersOpen(o => !o)}
        rightExtras={isApcm ? (
          <ActionButton icon="solar:upload-minimalistic-linear" tooltip="Export" onClick={() => {}} />
        ) : null}
      />

      <div className={styles.content}>
        {isApcm && <ApcmBillingTable searchQuery={searchQuery} filtersOpen={filtersOpen} />}
        {activeTab === 'billable' && <BillableTab rows={billable} loading={loading} />}
        {activeTab === 'history' && <BillingHistoryTab reports={reports} loading={loading} />}
        {activeTab === 'timer' && <TimerSettingsTab settings={timerSettings} loading={loading} />}
      </div>
    </div>
  );
}
