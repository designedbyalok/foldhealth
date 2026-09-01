import { Icon } from '../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../components/Button/Button';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { CarePlanProgressRing } from '../../../../../../../components/CarePlanProgressRing/CarePlanProgressRing';
import styles from './CarePlanDuplicateFlag.module.css';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function ItemRow({ item, kind, children }) {
  const subtitle = item.subtitle || item.description || '';
  return (
    <div className={styles.row}>
      <PriorityIcon priority={item.priority} size={16} />
      <Icon name={item.icon || 'solar:flag-linear'} size={16} color="var(--neutral-300)" className={styles.itemIcon} />
      <span className={styles.text}>
        <span className={styles.title}>{item.title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {kind === 'goal' && <CarePlanProgressRing progress={item.progress || 0} />}
      <span className={styles.actions}>{children}</span>
    </div>
  );
}

/**
 * Possible Duplicate banner — raised when a goal / intervention / barrier is
 * added that matches one already on the patient's plans (this program or
 * another). Compares the Existing item against the New one and lets the
 * clinician resolve it. Figma SNP-Story 8464:289403.
 *
 * Per product scope the actions only ever mutate THIS plan's new item:
 *  • Ignore — keep both, dismiss the flag.
 *  • Existing · Accept This — drop the new item; the existing one stands.
 *  • Existing · Edit & Accept — drop the new item and open the existing one
 *    to edit (only when it lives in this plan).
 *  • New · Accept This — keep the new item (and drop the existing one when it
 *    is a same-plan duplicate).
 */
export function CarePlanDuplicateFlag({ flag, onIgnore, onAcceptExisting, onAcceptNew, onEditExisting }) {
  const { kind, newItem, existing } = flag;

  const existingMeta = [
    existing.createdBy && `Created : ${existing.createdBy}`,
    existing.startDate && `Start Date : ${fmtDate(existing.startDate)}`,
  ].filter(Boolean).join(' • ');
  const newMeta = newItem.createdBy ? `Created : ${newItem.createdBy}` : '';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          <Icon name="solar:danger-triangle-linear" size={16} color="var(--status-warning)" />
          Possible Duplicate
        </span>
        <button type="button" className={styles.ignore} onClick={onIgnore}>Ignore</button>
      </div>

      <div className={styles.body}>
        <div className={styles.side}>
          <div className={styles.sideHead}>
            <span className={styles.sideLabel}>Existing</span>
            <span className={styles.meta}>
              {existingMeta}
              {!existing.sameplan && existing.programCode && (
                <Badge tone="grey" size="S" label={existing.programCode} className={styles.programTag} />
              )}
            </span>
          </div>
          <ItemRow item={existing.item} kind={kind}>
            <Button variant="tertiary" size="S" onClick={onAcceptExisting}>Accept This</Button>
            {existing.sameplan && (
              <Button variant="secondary" size="S" onClick={onEditExisting}>Edit &amp; Accept</Button>
            )}
          </ItemRow>
        </div>

        <div className={`${styles.side} ${styles.sideNew}`}>
          <div className={styles.sideHead}>
            <span className={styles.sideLabel}>New</span>
            {newMeta && <span className={styles.meta}>{newMeta}</span>}
          </div>
          <ItemRow item={newItem} kind={kind}>
            <Button variant="tertiary" size="S" onClick={onAcceptNew}>Accept This</Button>
          </ItemRow>
        </div>
      </div>
    </div>
  );
}
