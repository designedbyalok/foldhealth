import { Icon } from '../../components/Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import styles from '../../components/FilterBar/FilterBar.module.css';

/** The TOC worklist's Outreach Window / Outreach Status switch, shown in its FilterBar. */
export function DefaultViewByToggle() {
  const viewBy = useAppStore(s => s.viewBy);
  const setViewBy = useAppStore(s => s.setViewBy);
  return (
    <div className={styles.viewByToggle}>
      <button
        className={[styles.viewByBtn, viewBy === 'window' ? styles.active : ''].filter(Boolean).join(' ')}
        onClick={() => setViewBy('window')}
      >
        <Icon name="solar:sort-from-top-to-bottom-bold" size={14} />
        Outreach Window
      </button>
      <button
        className={[styles.viewByBtn, viewBy === 'status' ? styles.active : ''].filter(Boolean).join(' ')}
        onClick={() => setViewBy('status')}
      >
        <Icon name="solar:list-down-bold" size={14} />
        Outreach Status
      </button>
    </div>
  );
}
