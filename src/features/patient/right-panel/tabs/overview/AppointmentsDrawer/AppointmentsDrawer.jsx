import { useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Icon } from '../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../../../components/Avatar/Avatar';
import { ALL_APPOINTMENTS } from '../../../../data/overviewMock';
import styles from './AppointmentsDrawer.module.css';

export function AppointmentsDrawer({ onClose }) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? ALL_APPOINTMENTS.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.role.toLowerCase().includes(search.toLowerCase())
      )
    : ALL_APPOINTMENTS;

  return (
    <Drawer title="Appointments" onClose={onClose}>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <button className={`${styles.filterBtn} ${styles.filterActive}`}>
            View By : Upcoming <Icon name="solar:alt-arrow-down-linear" size={14} />
          </button>
          <button className={styles.filterBtn}>
            Date <Icon name="solar:alt-arrow-down-linear" size={14} />
          </button>
        </div>
        <div className={styles.searchWrap}>
          <Icon name="solar:magnifer-linear" size={16} color="var(--neutral-200)" />
          <input aria-label="Search appointments"
            className={styles.searchInput}
            placeholder="Search Appointments"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.list}>
        {filtered.map(appt => (
          <div key={appt.id} className={styles.card}>
            <div className={styles.cardBody}>
              <div className={styles.cardTop}>
                <Avatar variant="staff" initials={appt.initials} />
                <span className={styles.providerName}>{appt.name}</span>
                <span className={styles.roleBadge}>{appt.role}</span>
              </div>
              <div className={styles.cardMeta}>{appt.dateTime}</div>
              <div className={styles.cardMeta}>{appt.location}</div>
            </div>
            <ActionButton icon="solar:menu-dots-linear" size="S" />
          </div>
        ))}
      </div>
    </Drawer>
  );
}
