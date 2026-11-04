import { forwardRef } from 'react';
import styles from './Skeleton.module.css';

/**
 * Skeleton: one shimmering placeholder block, the piece every loading layout
 * is built from (`TableSkeleton`, `CardSkeleton`, `TimelineSkeleton` and the
 * feature skeletons are arrangements of these). Hidden from screen readers;
 * put `aria-busy` on the region that is loading.
 *
 * Size it with `width` / `height` / `radius`, or with a class.
 *
 * @param {object} props
 * @param {number|string} [props.width]
 * @param {number|string} [props.height]
 * @param {number|string} [props.radius] – Corner radius (default 4px; '50%' for a circle)
 */
export const Skeleton = forwardRef(function Skeleton({ width, height, radius, className, style, ...rest }, ref) {
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={[styles.bone, className].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius, ...style }}
      {...rest}
    />
  );
});
