import { Icon } from '../Icon/Icon';
import styles from './DemoPhiStrip.module.css';

/**
 * "Demo platform. Do not upload real PHI, use the provided demo files."
 * notice strip. Rendered above every file-upload widget so demo sessions
 * are self-labeling and no one accidentally drops production data in.
 *
 * Variants:
 *   default: bordered, rounded standalone card. Drop above a Dropzone.
 *   card-top: no self border/radius, only a bottom divider. Use as the
 *                first row inside a shared card whose border wraps both
 *                the strip and the Dropzone below.
 */
export function DemoPhiStrip({ variant = 'default', className }) {
  const cls = [
    styles.strip,
    variant === 'card-top' ? styles.stripCardTop : '',
    className || '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} role="note">
      <Icon name="solar:shield-warning-linear" size={14} color="var(--neutral-200)" />
      <div className={styles.text}>
        <strong>Demo platform.</strong> Do not upload real PHI: use the provided demo files.
      </div>
    </div>
  );
}
