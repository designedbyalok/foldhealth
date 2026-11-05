import { Banner } from '../Banner/Banner';
import { useAppStore } from '../../store/useAppStore';
import styles from './DegradedBanner.module.css';

const LABELS = { ehr: 'Epic EHR', retell: 'Retell.ai', redis: 'Redis', supabase: 'Supabase' };

/** Full-width strip across the app when a backing service is degraded or down. */
export function DegradedBanner() {
  const systemHealth = useAppStore(s => s.systemHealth);
  if (!systemHealth) return null;

  const degraded = Object.entries(systemHealth).filter(([, v]) => v === 'degraded' || v === 'down');
  if (degraded.length === 0) return null;

  const hasDown = degraded.some(([, v]) => v === 'down');
  const names = degraded.map(([k]) => LABELS[k] || k);

  return (
    <Banner tone={hasDown ? 'danger' : 'warning'} className={styles.strip}>
      <strong className={styles.title}>{hasDown ? 'System Outage' : 'Degraded Performance'}: {names.join(', ')}.</strong>
      {' '}Some features may be limited. Contact engineering if issues persist.
    </Banner>
  );
}
