import { Icon } from '../../../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { GbiStatusButton } from '../../tables/carePlanTableShared';
import { GbiLinkButton } from '../../tables/CarePlanLinkedPreview';
import styles from './GoalPreviewDrawer.module.css';

/**
 * Linked barriers inside the Goal Details drawer.
 *
 * Row shape is identical to `GoalLinkedInterventionsList` (which mirrors
 * BarrierDetailDrawer's Linked Goals list), so every drawer's linked
 * list reads as one primitive:
 *   [ icon ]  [ title / subtitle ]  [ status | (open) | unlink ]
 *
 * Barriers have no priority or assignee, so those slots are omitted.
 * `onOpen` is optional: when provided, the arrow-right-up action
 * surfaces the same way it does on the interventions list.
 */
export function GoalLinkedBarriersList({
  barriers,
  canEdit,
  onOpen,
  onStatusMenu,
  onRowMenu,
}) {
  return (
    <ul className={styles.intvLinkList}>
      {barriers.map((b) => (
        <li
          key={b.id}
          className={styles.intvLinkRow}
          role={onOpen ? 'button' : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onClick={onOpen ? () => onOpen(b) : undefined}
          onKeyDown={onOpen
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(b);
                }
              }
            : undefined}
        >
          <span className={styles.intvLinkIcon}>
            <Icon name="custom:barrier" size={16} color="var(--neutral-400)" />
          </span>
          <div className={styles.intvLinkStack}>
            <span className={styles.intvLinkTitle}>{b.title}</span>
            {b.subtitle && <span className={styles.intvLinkSubtitle}>{b.subtitle}</span>}
          </div>
          <div
            className={styles.intvLinkActions}
            style={{ gap: 'var(--space-2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {(b.linkedPreview?.goals?.length || 0) > 0 && (
              <>
                <GbiLinkButton data={b.linkedPreview} />
                <span className={styles.intvLinkActionsDivider} aria-hidden style={{ margin: 0 }} />
              </>
            )}
            <GbiStatusButton
              value={b.status || 'Not Started'} reason={b.statusReason}
              disabled={!canEdit}
              onOpen={(rect) => onStatusMenu?.({ kind: 'barrier', item: b, rect })}
            />
            {onOpen && (
              <>
                <span className={styles.intvLinkActionsDivider} aria-hidden style={{ margin: 0 }} />
                <ActionButton
                  icon="solar:arrow-right-up-linear"
                  size="sm"
                  tooltip="Open barrier"
                  onClick={() => onOpen(b)}
                />
              </>
            )}
            {/* Three-dot menu: Open, Unlink and the scope-aware
                Delete flow all live here so both rows carry the
                identical overflow control on the far right. */}
            <span className={styles.intvLinkActionsDivider} aria-hidden style={{ margin: 0 }} />
            <ActionButton
              icon="solar:menu-dots-linear"
              size="sm"
              tooltip="More"
              disabled={!onRowMenu}
              onClick={(e) => onRowMenu?.({ item: b, rect: e.currentTarget.getBoundingClientRect() })}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
