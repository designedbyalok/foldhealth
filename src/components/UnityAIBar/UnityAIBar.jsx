import { Icon } from '../Icon/Icon';
import { UnityIcon } from '../UnityIcon/UnityIcon';
import styles from './UnityAIBar.module.css';

/**
 * UnityAIBar: the "Compose … with UnityAI · + Generate …" strip from the
 * Communications compose designs (Figma Communications 1:24088 / 1:24499).
 * The host decides what Generate does.
 *
 * @param {string}   [props.label='Compose email with UnityAI']
 * @param {string}   [props.actionLabel='Generate Email']
 * @param {function} props.onGenerate
 * @param {boolean}  [props.generating] – shows "Generating…" and disables the action
 */
export function UnityAIBar({ label = 'Compose email with UnityAI', actionLabel = 'Generate Email', onGenerate, generating = false }) {
  return (
    <div className={styles.bar}>
      <UnityIcon size={16} color="var(--primary-300)" />
      <span className={styles.label}>{label}</span>
      <button type="button" className={styles.action} onClick={onGenerate} disabled={generating}>
        <Icon name={generating ? 'solar:refresh-linear' : 'solar:add-square-linear'} size={16} color="currentColor" className={generating ? styles.spin : undefined} />
        {generating ? 'Generating…' : actionLabel}
      </button>
    </div>
  );
}
