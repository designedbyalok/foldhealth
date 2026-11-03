import { useAppStore } from '../../../../../../store/useAppStore';
import { ReasonDialog } from '@/components/ReasonDialog/ReasonDialog';
import { Badge } from '@/components/Badge/Badge';
import { Icon } from '@/components/Icon/Icon';
import { GBI_STATUS_TONE } from './tables/carePlanTableShared';
import { statusReasonRequired, statusReasonsFor } from './lib/gbiStatusReasons';
import styles from './GbiStatusReasonHost.module.css';

const NOUN = { goal: 'goal', intervention: 'intervention', barrier: 'barrier' };

/**
 * The reason dialog for a care plan status change (#62), opened by
 * requestGbiStatusReason from any status menu. Closing (Met / Resolved),
 * Discontinued and On Hold need a reason; other moves take one optionally.
 */
export function GbiStatusReasonHost() {
  const req = useAppStore(s => s.gbiStatusReasonRequest);
  const resolve = useAppStore(s => s.resolveGbiStatusReason);
  if (!req) return null;
  const { items, to } = req;
  const required = statusReasonRequired(to);
  const one = items.length === 1 ? items[0] : null;
  const kinds = [...new Set(items.map(i => i.type))];
  const noun = kinds.length === 1 ? NOUN[kinds[0]] : 'item';
  const froms = [...new Set(items.map(i => i.from).filter(Boolean))];

  return (
    <ReasonDialog
      key={`${to}:${items.map(i => i.id).join(',')}`}
      title={one ? `Change ${noun} status to ${to}?` : `Change ${items.length} ${noun}s to ${to}?`}
      description={one
        ? one.title
        : `${required ? 'A reason is required and is' : 'The reason is'} saved on each ${noun}'s status history.`}
      standardReasons={statusReasonsFor(to)}
      required={required}
      decision="pass"
      confirmLabel="Change Status"
      confirmTone="primary"
      notesPlaceholder="Add context an auditor or the next care manager should see"
      onCancel={() => resolve(null)}
      onSubmit={({ code, freeText }) => resolve({ reason: code || (freeText ? 'Other' : null), note: freeText || null })}
    >
      <div className={styles.change}>
        {froms.length === 1 && (
          <>
            <Badge size="S" tone={GBI_STATUS_TONE[froms[0]] || 'grey'} label={froms[0]} />
            <Icon name="solar:arrow-right-linear" size={14} color="var(--neutral-200)" />
          </>
        )}
        <Badge size="S" tone={GBI_STATUS_TONE[to] || 'grey'} label={to} />
        {!required && <span className={styles.optional}>Reason optional</span>}
      </div>
    </ReasonDialog>
  );
}
