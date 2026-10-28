import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon/Icon';
import { Badge } from '@/components/Badge/Badge';
import { ActionButton } from '@/components/ActionButton/ActionButton';
import { FilterChip } from '@/components/FilterChip/FilterChip';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { money, serviceDate, STATUSES, statusOf } from './claimFormat';
import { ClaimDetailsDrawer } from './ClaimDetailsDrawer';
import styles from './Claims.module.css';

// Claims Log (frames 1114:6886, 1114:6763): status filter and date sort.
export function ClaimsLog({ claims }) {
  const [status, setStatus] = useState([]);
  const [recentFirst, setRecentFirst] = useState(true);
  const [open, setOpen] = useState(null);

  const rows = useMemo(() => {
    const picked = new Set(status);
    const keys = new Set(STATUSES.filter((s) => picked.has(s.label)).map((s) => s.key));
    const list = claims.filter((c) => !keys.size || keys.has(c.status));
    return recentFirst ? list : [...list].reverse();
  }, [claims, status, recentFirst]);

  return (
    <div className={styles.stack}>
      <div className={styles.logTools}>
        <ActionButton
          icon="solar:sort-vertical-linear"
          size="M"
          tooltip={recentFirst ? 'Recent first' : 'Oldest first'}
          tooltipLeft
          aria-label={recentFirst ? 'Sorted recent first; show oldest first' : 'Sorted oldest first; show recent first'}
          onClick={() => setRecentFirst((r) => !r)}
        />
        <FilterChip label="Status" options={STATUSES.map((s) => s.label)} selected={status} onChange={setStatus} singleSelect />
      </div>
      {rows.length === 0 ? (
        <div className={styles.card}>
          <EmptyState
            icon="solar:document-text-linear"
            title="No claims records available"
            description={claims.length ? 'No claims match this status.' : 'Claims from your visits will show here once your plan processes them.'}
          />
        </div>
      ) : (
        <ul className={styles.claimList}>
          {rows.map((c) => {
            const s = statusOf(c.status);
            return (
              <li key={c.id}>
                <button type="button" className={styles.claim} onClick={() => setOpen(c)}>
                  <span className={styles.claimHead}>
                    <span>Service Date: {serviceDate(c.service_date)}</span>
                    <Badge size="S" tone={s.tone} icon={s.icon} label={s.label} />
                  </span>
                  <span className={styles.claimBody}>
                    <Icon name="solar:document-text-linear" size={20} color="currentColor" />
                    <span className={styles.text}>
                      <span className={styles.main}>{c.provider_name}</span>
                      <span className={styles.sub}>{c.claim_number}</span>
                    </span>
                    <span className={styles.owes}>
                      <span className={styles.sub}>Member Owes</span>
                      <span className={styles.owesValue}>{money(c.balance_owed)}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && <ClaimDetailsDrawer claim={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
