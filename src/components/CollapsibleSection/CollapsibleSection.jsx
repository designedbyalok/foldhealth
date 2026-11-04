import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../Collapsible/Collapsible';
import styles from './CollapsibleSection.module.css';

/**
 * CollapsibleSection: a bordered accordion card: an icon + title header that
 * folds the body away. Built on `Collapsible`, so it takes the same
 * `open` / `defaultOpen` / `onOpenChange`.
 *
 * First built for the Create Insurance Plan form's sections, and moved here so
 * other forms (the PAMI/Hx Social History drawer) share one implementation.
 *
 * @param {object}   props
 * @param {string}   [props.icon]           – Icon name, shown in primary-300
 * @param {string}   props.title
 * @param {boolean}  [props.open]
 * @param {boolean}  [props.defaultOpen=true]
 * @param {(open: boolean) => void} [props.onOpenChange]
 * @param {node}     props.children         – The section body
 */
export function CollapsibleSection({ icon, title, open, defaultOpen = true, onOpenChange, children }) {
  return (
    <Collapsible className={styles.card} open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className={styles.header}>
        {icon && <Icon name={icon} size={16} color="var(--primary-300)" />}
        <span className={styles.title}>{title}</span>
        <DownChevronIcon size={12} color="var(--neutral-300)" className={styles.chevron} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={styles.body}>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
