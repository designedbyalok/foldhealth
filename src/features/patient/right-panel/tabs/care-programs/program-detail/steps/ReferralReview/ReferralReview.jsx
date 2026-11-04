import { useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../../../components/Icon/AddIconMinimalist';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { Button } from '../../../../../../../../components/Button/Button';
import { Toggle } from '../../../../../../../../components/Toggle/Toggle';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Checkbox } from '../../../../../../../../components/Checkbox/Checkbox';
import { WorklistShell } from '../../../../../../../../components/WorklistShell/WorklistShell';
import { REFERRAL_REVIEW_MOCK } from '../../../../../../data/referralReviewMock';
import styles from './ReferralReview.module.css';

const SUB_TABS = ['Program Related', 'All Referrals'];

// Mirrors the grid this table replaced: 36 / fill / fill / 150 / 140 / 170.
const REFERRAL_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 36 },
  { key: 'referredBy', label: 'Referred By' },
  { key: 'referredTo', label: 'Referred To' },
  { key: 'status', label: 'Status', width: 150 },
  { key: 'attachment', label: 'Attachment', width: 140 },
  { key: 'createdOn', label: 'Created On', width: 170 },
];

// Status → text tone. "Signed & Referred" reads as an in-progress (amber) state.
const STATUS_TONE = {
  'Signed & Referred': styles.statusWarning,
  Completed: styles.statusSuccess,
  Pending: styles.statusWarning,
  Declined: styles.statusError,
};

export function ReferralReview() {
  const [activeTab, setActiveTab] = useState('Program Related');
  const [selected, setSelected] = useState(() => new Set());

  const rows = REFERRAL_REVIEW_MOCK;
  const toggleAll = () => setSelected(prev => (prev.size === rows.length ? new Set() : new Set(rows.map(r => r.id))));
  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <ActionButton icon="solar:magnifer-linear" size="sm" tooltip="Search" />
        <span className={styles.tabDivider} />
        <Toggle size="sm" items={SUB_TABS} value={activeTab} onValueChange={setActiveTab} />
        <div className={styles.spacer} />
        <Button variant="soft" size="sm" leadingIconElement={<AddIconMinimalist size={14} />} trailingIconElement={<DownChevronIcon size={14} />}>
          New Order
        </Button>
        <span className={styles.tabDivider} />
        <ActionButton icon="solar:filter-linear" size="sm" tooltip="Filter" />
      </div>

      {/* Table */}
      <WorklistShell
        embedded
        header={null}
        columns={REFERRAL_COLUMNS}
        rows={rows}
        selectedIds={[...selected]}
        onSelectAll={toggleAll}
        onClearSelection={() => setSelected(new Set())}
        minTableWidth={0}
        renderRow={r => (
          <tr key={r.id} className={styles.row}>
            <td className={styles.checkCell}>
              <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select referral to ${r.referredToName}`} />
            </td>
            <td className={styles.providerCell}>
              <span className={styles.providerName}>{r.referredByName}</span>
              <span className={styles.providerRole}>{r.referredByRole}</span>
            </td>
            <td className={styles.providerCell}>
              <span className={styles.providerName}>{r.referredToName}</span>
              <span className={styles.providerRole}>{r.referredToRole}</span>
            </td>
            <td className={`${styles.statusCell} ${STATUS_TONE[r.status] || ''}`}>{r.status}</td>
            <td className={styles.attachCell}>
              {r.attachments > 0 ? (
                <span className={styles.attachChip}>
                  <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
                  {r.attachments} Attachment{r.attachments === 1 ? '' : 's'}
                </span>
              ) : <span className={styles.muted}>-</span>}
            </td>
            <td className={styles.createdCell}>{r.createdOn}</td>
          </tr>
        )}
      />
    </div>
  );
}
