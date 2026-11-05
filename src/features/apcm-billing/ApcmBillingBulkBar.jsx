import { Checkbox } from '../../components/Checkbox/Checkbox';
import { Button } from '../../components/Button/Button';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import styles from './ApcmBillingTable.module.css';

export function ApcmBillingBulkBar({
  allSelected,
  tabSelectedCount,
  onSelectAll,
  onTriggerBill,
  onClearSelection,
}) {
  return (
    <div className={styles.bulkBar}>
      <div className={styles.bulkCount}>
        <Checkbox
          checked={allSelected}
          onCheckedChange={onSelectAll}
          aria-label="Select all on page"
        />
        <span>{tabSelectedCount} selected</span>
      </div>
      <span className={styles.bulkDivider} />
      <Button
        size="sm"
        leadingIcon="solar:bill-list-linear"
        onClick={onTriggerBill}
      >
        Trigger Attestation
      </Button>
      <span className={styles.bulkDivider} />
      <ActionButton icon="solar:menu-dots-linear" tooltip="More options" onClick={() => {}} />
      <span className={styles.bulkDivider} />
      <CloseButton
        size={16}
        onClick={onClearSelection}
        className={styles.bulkClose}
        label="Clear selection"
      />
    </div>
  );
}
