import { Icon } from '../Icon/Icon';
import styles from './InfoBar.module.css';

/**
 * InfoBar — pinned informational banner used above forms, drawers, and
 * sync surfaces to explain what an action does or where its output goes.
 *
 * Canonical usage: place it flush against the top of a scroll region as
 * a persistent nudge (e.g. "All signed notes sync to the patient's
 * EHR."). Not a toast or a dismissible alert — the message stays put.
 *
 * @param {object}   props
 * @param {node}     props.children       – message body (string or nodes)
 * @param {string}   [props.icon]         – Solar icon name (defaults to
 *                                          `solar:info-circle-linear`)
 * @param {'info'|'success'|'warning'|'error'} [props.tone='info'] – tint
 *                                          for the icon + surface
 * @param {'banner'|'inline'} [props.variant='banner'] – 'inline' is the compact
 *                                          in-flow alert (Figma Eventus 17629:122416):
 *                                          16px icon, tighter padding, thin tinted border
 * @param {string}   [props.className]    – layout hook for the caller
 * @param {function} [props.onClose]      – adds a close (×) at the end, for a
 *                                          message the user may dismiss
 */
export function InfoBar({ children, icon = 'solar:info-circle-linear', tone = 'info', variant = 'banner', className, onClose }) {
  const toneClass = styles[`tone-${tone}`] || styles['tone-info'];
  return (
    <div className={[styles.root, toneClass, variant === 'inline' ? styles.inline : '', className].filter(Boolean).join(' ')} role="status">
      <Icon name={icon} size={variant === 'inline' ? 16 : 14} color="currentColor" className={styles.icon} />
      <span className={styles.body}>{children}</span>
      {onClose && (
        <button type="button" className={styles.close} onClick={onClose} aria-label="Dismiss">
          <Icon name="solar:close-linear" size={14} color="currentColor" />
        </button>
      )}
    </div>
  );
}
