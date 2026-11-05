import { forwardRef } from 'react';
import { Icon } from '../Icon/Icon';
import { warnDeprecated } from '../../lib/legacyProps';
import styles from './Banner.module.css';

const TONE_ICON = {
  info: 'solar:info-circle-linear',
  success: 'solar:check-circle-linear',
  warning: 'solar:danger-triangle-linear',
  danger: 'solar:danger-triangle-linear',
};

/**
 * Banner: a message that stays put in the layout (not a toast): what an
 * action does, where its output goes, a deadline, a warning.
 *
 * @param {object} props
 * @param {'info'|'success'|'warning'|'danger'} [props.tone='info']
 * @param {'soft'|'outline'} [props.variant='soft'] – soft: tinted, neutral text.
 *   outline: tinted with a tone border and tone-coloured text, for a notice
 *   that has to stand out.
 * @param {'sm'|'md'} [props.size='md'] – sm is the compact in-flow form
 *   (Figma Eventus 17629:122416): tighter padding and a thin tinted border.
 * @param {string} [props.icon] – Solar icon; defaults to the tone's icon
 * @param {React.ReactNode} [props.meta] – short text at the right end (a date, a count)
 * @param {React.ReactNode} [props.action] – a link or button at the right end
 * @param {() => void} [props.onClose] – adds a dismiss (×) button
 *
 * Announced politely (`role="status"`); `tone="danger"` interrupts (`role="alert"`).
 */
export const Banner = forwardRef(function Banner(
  { tone = 'info', variant = 'soft', size = 'md', icon, meta, action, onClose, className, children, ...rest },
  ref,
) {
  if (tone === 'error') warnDeprecated('Banner', 'tone', 'error', 'tone="danger"');
  const t = tone === 'error' ? 'danger' : (TONE_ICON[tone] ? tone : 'info');
  if (children == null && meta == null) return null;
  const iconSize = variant === 'outline' ? 15 : size === 'sm' ? 16 : 14;
  return (
    <div
      ref={ref}
      role={t === 'danger' ? 'alert' : 'status'}
      data-tone={t}
      className={[styles.banner, styles[variant] || styles.soft, size === 'sm' ? styles.sm : '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon name={icon || TONE_ICON[t]} size={iconSize} color="currentColor" className={styles.icon} />
      <span className={styles.body}>{children}</span>
      {meta != null && <span className={styles.meta}>{meta}</span>}
      {action && <span className={styles.action}>{action}</span>}
      {onClose && (
        <button type="button" className={styles.close} onClick={onClose} aria-label="Dismiss">
          <Icon name="solar:close-linear" size={14} color="currentColor" />
        </button>
      )}
    </div>
  );
});
