import { Drawer } from '../../components/Drawer/Drawer';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import styles from './AttestationModal.module.css';

export function AttestationResultView({ isAccept, selectedCount, onDone }) {
  return (
    <Drawer
      title="APCM Billing Attestation"
      onClose={onDone}
    >
      <div className={styles.resultBody}>
        <div className={`${styles.resultIcon} ${isAccept ? styles.resultIconSuccess : styles.resultIconDecline}`}>
          <Icon
            name={isAccept ? 'solar:check-circle-linear' : 'solar:close-circle-linear'}
            size={32}
            color={isAccept ? 'var(--status-success)' : 'var(--status-error)'}
          />
        </div>
        <p className={styles.resultTitle}>
          {isAccept ? 'Claim Generation In Progress' : 'Billing Not Generated'}
        </p>
        <p className={styles.resultMsg}>
          {isAccept
            ? `Patient claim generation is in progress for ${selectedCount} patient${selectedCount !== 1 ? 's' : ''}. You will be notified once the claims have been processed.`
            : `Billing has not been generated as the consent to bill has been declined for ${selectedCount} patient${selectedCount !== 1 ? 's' : ''}.`}
        </p>
        <Button onClick={onDone}>Done</Button>
      </div>
    </Drawer>
  );
}
