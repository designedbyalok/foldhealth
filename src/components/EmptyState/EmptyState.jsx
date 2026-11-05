import { forwardRef } from 'react';
import { Icon } from '../Icon/Icon';
import { resolveSize } from '../../lib/legacyProps';
import styles from './EmptyState.module.css';

const GLYPH = { md: 46, sm: 30, xs: 18 };
const SIZE_CLASS = { sm: styles.sizeS, xs: styles.sizeXS };

/**
 * EmptyState: the concentric dashed-ring medallion (Figma) for a list, panel
 * or page with nothing to show, or that failed to load. A gradient disc holds
 * one linear Solar icon, ringed by two dashed circles, with a title, an
 * optional description and an optional action.
 *
 * @param {string|function} [props.icon='solar:inbox-linear'] – Solar linear icon
 *   name, or an icon component (called with `size` and `color`)
 * @param {React.ReactNode} [props.title] – the caption under the medallion
 *   (omit for the bare medallion)
 * @param {React.ReactNode} [props.description] – a second, explanatory line
 * @param {React.ReactNode} [props.action] – a button or link under the text
 * @param {'neutral'|'danger'} [props.tone='neutral'] – danger: the icon turns red,
 *   for "couldn't load"
 * @param {'md'|'sm'|'xs'} [props.size='md'] – md 120px medallion; sm 80px for
 *   inline slots; xs 48px beside text in a row
 * @param {number} [props.iconSize]
 * @param {React.ReactNode} [props.children] – extra content under the text
 */
export const EmptyState = forwardRef(function EmptyState(
  { icon = 'solar:inbox-linear', title, description, action, tone = 'neutral', size = 'md', iconSize, className, children, ...rest },
  ref,
) {
  const z = resolveSize('EmptyState', size === 'XS' ? 'xs' : size);
  const glyph = iconSize ?? GLYPH[z] ?? GLYPH.md;
  const color = tone === 'danger' ? 'var(--status-error)' : 'var(--neutral-200)';
  const hasText = title != null || description != null || action || children;
  return (
    <div
      ref={ref}
      data-tone={tone}
      className={[styles.emptyWrap, SIZE_CLASS[z], className].filter(Boolean).join(' ')}
      {...rest}
    >
      <div className={styles.emptyCard}>
        <div className={styles.emptyIcon}>
          <span className={styles.iconInner}>
            {typeof icon === 'function'
              ? (() => { const Glyph = icon; return <Glyph size={glyph} color={color} />; })()
              : <Icon name={icon} size={glyph} color={color} />}
          </span>
        </div>
        {hasText && (
          <div className={styles.emptyTextGroup}>
            {title != null && <p className={[styles.emptyText, description != null ? styles.emptyTitle : ''].filter(Boolean).join(' ')}>{title}</p>}
            {description != null && <p className={styles.emptyDescription}>{description}</p>}
            {action}
            {children}
          </div>
        )}
      </div>
    </div>
  );
});
