import { FoldHealthLogo } from '@/components/FoldHealthLogo/FoldHealthLogo';
import styles from './Settings.module.css';

// Baked in by vite.patient.config.js (`define`).
// eslint-disable-next-line no-undef
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__).slice(0, 7) : 'dev';

export function AboutFold() {
  return (
    <div className={`${styles.stack} ${styles.narrow}`}>
      <div className={styles.about}>
        <FoldHealthLogo size={32} color="var(--primary-400)" />
        <span className={styles.main}>Fold Health</span>
      </div>
      <p className={styles.body}>
        Fold Health connects you with your care team: see your care plan and health records, message your team,
        book visits and manage care for your family in one place.
      </p>
      <p className={styles.note}>Version {VERSION}</p>
    </div>
  );
}
