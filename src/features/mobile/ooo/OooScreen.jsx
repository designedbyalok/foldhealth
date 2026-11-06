import { useMemo } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { useOooRecords } from '../../ooo/useOooRecords';
import { OOO_ICON, canEdit, describeRange, oooStatus, recordsFor, sortRecords } from '../../ooo/oooUtils';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import common from '../mobile.module.css';
import styles from './ooo.module.css';

const TONE = { Upcoming: 'success', Ongoing: 'primary', Past: 'neutral' };

/**
 * The signed-in user's Out of Office records, as desktop Preferences → Out
 * of Office (OooPreferencesSection): ongoing, then upcoming, then past.
 * Past records are read-only; the rest open for editing.
 */
export function OooScreen() {
  const { push } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const { records, loading } = useOooRecords();
  const mine = useMemo(() => (me ? sortRecords(recordsFor(records, me)) : []), [records, me]);
  const now = new Date();

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Out of Office" />
      <div className={common.bodyWrap}>
        <div className={common.body}>
          {loading || !me ? <MobileListSkeleton count={3} height={96} /> : mine.length === 0 ? (
            <MobileEmpty
              icon={OOO_ICON}
              title="No Out of Office Records"
              description="Mark the dates you're away so your team knows."
              action={<Button size="lg" variant="outline" leadingIcon="solar:add-circle-linear" onClick={() => push('oooForm')}>New OOO Record</Button>}
            />
          ) : (
            <ul className={`${common.list} ${styles.records}`}>
              {mine.map(r => {
                const status = oooStatus(r, now);
                const { span, length } = describeRange(r.startAt, r.endAt);
                const editable = canEdit(r, now);
                const body = (
                  <>
                    <span className={styles.recordHead}>
                      <Badge tone={TONE[status]} variant="soft" size="lg" label={status} />
                      <span className={styles.recordLength}>{length}</span>
                    </span>
                    <span className={styles.recordSpan}>{span}</span>
                    <span className={styles.recordReason}>{r.reason || 'No reason added'}</span>
                    {r.autoReply && (
                      <span className={styles.recordMeta}>
                        <Icon name="solar:chat-round-check-linear" size={16} color="currentColor" />
                        Auto reply on
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={r.id}>
                    {editable ? (
                      <button type="button" className={styles.record} onClick={() => push('oooForm', { recordId: r.id })}>
                        <span className={styles.recordText}>{body}</span>
                        <Icon name="solar:alt-arrow-right-linear" size={16} className={styles.chevron} />
                      </button>
                    ) : (
                      <div className={styles.record}><span className={styles.recordText}>{body}</span></div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {!loading && mine.length > 0 && (
          <button type="button" className={common.fab} aria-label="New OOO record" onClick={() => push('oooForm')}>
            <Icon name="solar:add-circle-linear" size={32} color="currentColor" />
          </button>
        )}
      </div>
    </div>
  );
}
