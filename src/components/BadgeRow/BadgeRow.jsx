import { useLayoutEffect, useRef, useState } from 'react';
import { Badge } from '../Badge/Badge';
import { Tooltip } from '../Tooltip/Tooltip';
import styles from './BadgeRow.module.css';

const GAP = 4;

/**
 * BadgeRow — a wrapping row of badges clamped to `maxLines`, with the
 * remainder collapsed into a `+N` badge that lists them on hover. Same
 * treatment as the multi-select trigger, but over an arbitrary number of
 * lines so it works inside a table cell.
 *
 * Widths come from a hidden mirror of the full set (plus a worst-case "+N"),
 * so the visible row never flashes an over-long state while measuring.
 *
 * @param {object}   props
 * @param {string[]} props.items          – Badge labels
 * @param {number}   [props.maxLines=2]   – Lines to fill before overflowing
 * @param {string}   [props.tone='grey']
 * @param {'S'|'M'|'L'} [props.size='S']
 * @param {string}   [props.icon]         – Leading Solar icon on each item badge (not the +N)
 * @param {string}   [props.className]
 */
export function BadgeRow({ items = [], maxLines = 2, tone = 'grey', size = 'S', icon, className }) {
  const rowRef = useRef(null);
  const measureRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const itemsKey = items.join('|');

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return undefined;

    const recompute = () => {
      const available = row.clientWidth;
      const children = [...measure.children];
      if (children.length < 2 || available === 0) return;
      // Last mirrored child is the worst-case "+N"; the rest are the items.
      const widths = children.slice(0, -1).map(c => c.offsetWidth);
      const overflowWidth = children[children.length - 1].offsetWidth;

      // `used` only ever counts badges that were actually taken, so the
      // give-back pass below can subtract from it safely.
      let line = 1;
      let used = 0;
      let fit = 0;
      for (let i = 0; i < widths.length; i += 1) {
        const needed = used === 0 ? widths[i] : used + GAP + widths[i];
        if (needed <= available) {
          used = needed;
          fit += 1;
        } else if (line < maxLines && widths[i] <= available) {
          line += 1;
          used = widths[i];
          fit += 1;
        } else {
          break;
        }
      }

      // Anything left over needs the "+N" badge to fit too. On the last line
      // that means giving badges back — but never the first one: a lone "+N"
      // tells the reader nothing.
      if (fit < widths.length && line === maxLines) {
        while (fit > 1 && used + GAP + overflowWidth > available) {
          used -= GAP + widths[fit - 1];
          fit -= 1;
        }
      }
      setVisibleCount(fit || Math.min(1, widths.length));
    };

    const ro = new ResizeObserver(recompute);
    ro.observe(row);
    // rAF rather than a synchronous call — setting state in an effect body
    // cascades renders.
    const raf = requestAnimationFrame(recompute);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [itemsKey, maxLines]);

  if (items.length === 0) return null;

  const hidden = items.slice(visibleCount);

  return (
    <div ref={rowRef} className={[styles.row, className].filter(Boolean).join(' ')}>
      {items.slice(0, visibleCount).map(label => (
        <Badge key={label} tone={tone} size={size} label={label} icon={icon} />
      ))}
      {hidden.length > 0 && (
        <Tooltip label={hidden.join(', ')} maxWidth={280}>
          <Badge tone={tone} size={size} label={`+${hidden.length}`} />
        </Tooltip>
      )}
      <span ref={measureRef} className={styles.measure} aria-hidden="true">
        {items.map(label => <Badge key={label} tone={tone} size={size} label={label} icon={icon} />)}
        <Badge tone={tone} size={size} label={`+${items.length}`} />
      </span>
    </div>
  );
}
