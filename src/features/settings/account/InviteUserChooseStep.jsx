import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { Drawer } from '../../../components/Drawer/Drawer';
import styles from './AccountPanel.module.css';

export function InviteUserChooseStep({ onClose, onChooseSingle, onChooseBulk }) {
  return (
    <Drawer title="Invite User" onClose={onClose}>
      <div className={styles.inviteChoose}>
        <p className={styles.inviteChooseTitle}>Choose how you'd like to add team members</p>
        <div className={styles.inviteCard} onClick={onChooseSingle}>
          <Icon name="solar:user-plus-linear" size={32} color="var(--primary-300)" />
          <h4>Single Invite</h4>
          <p>Invite one team member at a time by filling out a form</p>
          <Button variant="outline">Invite Individual</Button>
        </div>
        <div className={`${styles.inviteCard} ${styles.inviteCardBulk}`} onClick={onChooseBulk}>
          <Icon name="solar:users-group-rounded-linear" size={32} color="var(--secondary-300)" />
          <h4>Bulk Import</h4>
          <p>Upload a CSV file to add multiple team members at once</p>
          <Button variant="outline" className={styles.inviteCardBulkButton}>Import Multiple</Button>
        </div>
      </div>
    </Drawer>
  );
}
