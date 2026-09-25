import { Fragment, useRef, useState } from 'react';
import { ActionButton } from '../ActionButton/ActionButton';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { RingEmptyState } from '../RingEmptyState/RingEmptyState';
import styles from './ChartContainer.module.css';

/**
 * Fold Health ChartContainer: the card every chart sits in. Title with an
 * optional (i) definition, a subtitle, a grouped action bar (expand,
 * download, more), and a body for the chart. Figma Fold Pixel 1.0 567:45570.
 *
 * @param {object}   props
 * @param {string}   props.title
 * @param {string}   [props.info]          – Definition shown from the (i) icon
 * @param {string}   [props.subtitle]      – e.g. the date range the chart covers
 * @param {boolean}  [props.empty=false]   – Show the "No Data to show" state instead of children
 * @param {string}   [props.emptyLabel='No Data to show']
 * @param {number|string} [props.height]  – Fixed card height; the body takes what the
 *                                           header leaves. Keeps a row of charts level.
 * @param {number|string} [props.bodyHeight] – Fixed body height instead. Omit both to size to content.
 * @param {function} [props.onExpand]      – Omit to hide the expand action
 * @param {function} [props.onDownload]    – Omit to hide the download action
 * @param {{key:string,label:string,icon?:string}[]} [props.menuItems] – Items for the ••• menu
 * @param {function} [props.onMenuSelect]  – (key) => void
 * @param {string}   [props.className]
 * @param {object}   [props.style]         – Merged onto the card, e.g. a parent grid's placement
 */
const toCss = (v) => (typeof v === 'number' ? `${v}px` : v);

export function ChartContainer({
  title,
  info,
  subtitle,
  empty = false,
  emptyLabel = 'No Data to show',
  height,
  bodyHeight,
  onExpand,
  onDownload,
  menuItems,
  onMenuSelect,
  className,
  style,
  children,
}) {
  const moreRef = useRef(null);
  const [menuRect, setMenuRect] = useState(null);
  const hasMenu = menuItems?.length > 0;
  // Hairline dividers sit between actions, so build the list first.
  const actions = [
    onExpand && { key: 'expand', node: <ActionButton icon="solar:maximize-square-linear" size="S" tooltip="Expand" aria-label={`Expand ${title}`} state={empty ? 'disabled' : 'active'} onClick={onExpand} /> },
    onDownload && { key: 'download', node: <ActionButton icon="solar:download-minimalistic-linear" size="S" tooltip="Download" aria-label={`Download ${title}`} state={empty ? 'disabled' : 'active'} onClick={onDownload} /> },
    hasMenu && {
      key: 'more',
      node: (
        <span ref={moreRef} className={styles.menuAnchor}>
          <ActionButton
            icon="solar:menu-dots-linear"
            size="S"
            tooltip="More"
            aria-label={`More actions for ${title}`}
            onClick={() => setMenuRect(moreRef.current?.getBoundingClientRect() || null)}
          />
        </span>
      ),
    },
  ].filter(Boolean);
  const hasActions = actions.length > 0;

  return (
    <section
      className={[styles.container, height != null ? styles.fixedCard : '', className].filter(Boolean).join(' ')}
      style={height != null ? { ...style, '--chart-card-height': toCss(height) } : style}
      aria-label={title}
    >
      <header className={[styles.header, subtitle ? '' : styles.headerCompact].filter(Boolean).join(' ')}>
        <div className={styles.headText}>
          <div className={styles.titleRow}>
            <span className={styles.title}>{title}</span>
            {info && (
              <Tooltip label={info}>
                <span className={styles.info} role="img" aria-label={info}>
                  <Icon name="solar:info-circle-linear" size={16} color="var(--neutral-300)" />
                </span>
              </Tooltip>
            )}
          </div>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
        {hasActions && (
          <div className={styles.actions}>
            {actions.map((action, i) => (
              <Fragment key={action.key}>
                {i > 0 && <span className={styles.divider} aria-hidden="true" />}
                {action.node}
              </Fragment>
            ))}
          </div>
        )}
      </header>
      <div
        className={[styles.body, bodyHeight != null ? styles.fixed : ''].filter(Boolean).join(' ')}
        style={bodyHeight != null ? { '--chart-body-height': toCss(bodyHeight) } : undefined}
      >
        {empty ? (
          <div className={styles.empty}>
            <RingEmptyState icon="solar:chart-2-linear" label={emptyLabel} iconSize={31} />
          </div>
        ) : children}
      </div>
      {menuRect && (
        <MenuPopover
          anchorRect={menuRect}
          align="right"
          width={180}
          ariaLabel={`${title} actions`}
          items={menuItems}
          onSelect={(key) => { setMenuRect(null); onMenuSelect?.(key); }}
          onClose={() => setMenuRect(null)}
        />
      )}
    </section>
  );
}
