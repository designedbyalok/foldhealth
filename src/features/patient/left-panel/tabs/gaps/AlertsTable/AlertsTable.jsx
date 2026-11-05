import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { ProfileTable } from '../../../../../../components/ProfileTable/ProfileTable';
import { profileRowClass, profileCellClass } from '../../../../../../components/ProfileTable/profileTableClasses';
import { ALERT_ITEMS } from '../../../../data/careGapsMock';
import { GAP_TABLE_COLUMNS } from '../gapTableColumns';
import styles from './AlertsTable.module.css';

function FlagIcon({ severity }) {
  const color = severity === 'error' ? '#D72825' : '#D9A50B';
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2.5 1.5V12.5" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M2.5 2H10C10 2 8.5 4 8.5 5.5C8.5 7 10 9 10 9H2.5V2Z" fill={color}/>
    </svg>
  );
}

function AlertRow({ item }) {
  return (
    <tr className={`${profileRowClass} ${styles.row}`}>
      <td className={profileCellClass}>
        <div className={styles.content}>
          <span className={styles.title}>{item.title}</span>
          <div className={styles.meta}>
            <FlagIcon severity={item.severity} />
            <span className={styles.metaDot}>•</span>
            <span className={styles.metaText}>{item.category} • {item.time}</span>
          </div>
        </div>
      </td>
      <td className={profileCellClass}>
        <span className={styles.status}>{item.status}</span>
      </td>
      <td className={profileCellClass}>
        <div className={styles.moreBtn}>
          <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" />
        </div>
      </td>
    </tr>
  );
}

export function AlertsTable() {
  return (
    <div className={styles.wrapper}>
      <ProfileTable
        columns={GAP_TABLE_COLUMNS}
        rows={ALERT_ITEMS}
        renderRow={item => <AlertRow key={item.id} item={item} />}
      />
    </div>
  );
}
