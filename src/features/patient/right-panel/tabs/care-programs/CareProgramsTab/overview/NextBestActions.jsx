import { useState } from 'react';
import { DashboardCard } from '@/components/DashboardCard/DashboardCard';
import { SegmentedControl } from '@/components/SegmentedControl/SegmentedControl';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Icon } from '@/components/Icon/Icon';
import { DownChevronIcon } from '@/components/Icon/DownChevronIcon';
import styles from './CareProgramsOverview.module.css';

const ITEM_LABEL = { goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier' };

const VIEWS = [{ key: 'order', label: 'In Order' }, { key: 'program', label: 'By Program' }];
const KIND = {
  step: { icon: 'solar:checklist-minimalistic-linear', label: 'Program Step' },
  goal: { icon: 'solar:target-linear', label: 'Goal' },
  intervention: { icon: 'solar:checklist-minimalistic-linear', label: 'Intervention' },
  barrier: { icon: 'solar:flag-linear', label: 'Barrier' },
};
const LIMIT = 5;

// A care plan item's short status beside its title; its detail is the why line.
const ITEM_STATUS = { goal: ['Off target', 'danger'], intervention: ['Overdue', 'danger'], barrier: ['Unaddressed', 'warning'] };

function ActionRow({ row, n, current, onRun }) {
  const kind = KIND[row.kind];
  const isStep = row.kind === 'step';
  // A plan row's title already says what's wrong.
  const [status, tone] = isStep ? [row.detail.text, row.detail.urgent ? 'danger' : 'neutral'] : ITEM_STATUS[row.kind] || [];
  return (
    <li className={`${styles.nbaRow} ${current ? styles.nbaRowCurrent : ''}`}>
      <span className={`${styles.nbaNum} ${current ? styles.nbaNumCurrent : ''}`} aria-hidden="true">{n}</span>
      <div className={styles.nbaBody}>
        <span className={styles.nbaKind}>
          <Icon name={kind.icon} size={12} color="currentColor" />
          {row.label || kind.label}
        </span>
        <span className={styles.nbaTitleLine}>
          <span className={styles.nbaTitle}>{row.title}</span>
          {row.programs.map(p => <Badge key={p.id} size="sm" label={p.code} />)}
          {row.required && (
            <span className={styles.nbaRequired}>
              <Icon name="solar:danger-triangle-linear" size={12} color="currentColor" />Required
            </span>
          )}
          {/* "Required" is already the badge beside it. */}
          {status && !(row.required && status === 'Required') && (
            <span className={tone === 'danger' ? styles.textDanger : tone === 'warning' ? styles.textWarning : styles.nbaDetail}>{status}</span>
          )}
        </span>
        {!isStep && <span className={styles.nbaWhy}>{row.detail.text}</span>}
      </div>
      <div className={styles.nbaActions}>
        <Button size="sm" variant={current ? 'solid' : 'outline'} onClick={() => onRun(row)}>
          {isStep ? 'Open Step' : `Open ${ITEM_LABEL[row.kind]}`}
        </Button>
      </div>
    </li>
  );
}

/**
 * Next Best Actions (care plan redesign prototype): program steps and care
 * plan items that need doing, from nextBestActions. In Order shows the
 * sequence (the first is the one to do now); By Program groups them per
 * program. A step opens in a drawer; a goal, intervention or barrier opens
 * in its drawer.
 */
export function NextBestActions({ actions, programs, onRun }) {
  const [view, setView] = useState('order');
  // One program's actions read the same either way, so it's a single list.
  const grouped = programs.length > 1 && view === 'program';
  const [all, setAll] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const required = actions.filter(a => a.required).length;
  const shown = all ? actions : actions.slice(0, LIMIT);

  return (
    <DashboardCard
      icon="solar:checklist-minimalistic-linear"
      title="Next Best Actions"
      count={actions.length || null}
      actions={(
        <span className={styles.nbaHeadRight}>
          {required > 0 && <Badge size="sm" tone="danger" label={`${required} required`} />}
          {programs.length > 1 && <SegmentedControl size="sm" items={VIEWS} value={view} onValueChange={setView} />}
        </span>
      )}
    >
      {actions.length === 0 ? (
        <p className={styles.empty}>Nothing to do right now.</p>
      ) : !grouped ? (
        <>
          <ol className={styles.nbaList}>
            {shown.map((row, i) => <ActionRow key={row.key} row={row} n={i + 1} current={i === 0} onRun={onRun} />)}
          </ol>
          {actions.length > LIMIT && (
            <button type="button" className={styles.moreBtn} onClick={() => setAll(v => !v)}>
              {all ? 'Show Less' : `Show All ${actions.length}`}
              <DownChevronIcon size={12} color="currentColor" className={all ? styles.chevUp : undefined} />
            </button>
          )}
        </>
      ) : (
        <div className={styles.nbaGroups}>
          {programs.map(p => {
            const rows = actions.filter(a => a.programs.some(x => x.id === p.id));
            const req = rows.filter(a => a.required).length;
            const open = !collapsed[p.id];
            return (
              <section key={p.id} className={styles.nbaGroup}>
                <button type="button" className={styles.nbaGroupHead} aria-expanded={open} onClick={() => setCollapsed(c => ({ ...c, [p.id]: open }))}>
                  <DownChevronIcon size={14} color="var(--neutral-300)" className={open ? undefined : styles.chevRight} />
                  <span className={styles.nbaGroupName}>{p.name}</span>
                  <span className={styles.nbaGroupMeta}>{p.code} • {rows.length} {rows.length === 1 ? 'action' : 'actions'}</span>
                  {req > 0 && <Badge size="sm" tone="danger" label={`${req} required`} />}
                </button>
                {open && (rows.length ? (
                  <ol className={styles.nbaList}>
                    {rows.map((row, i) => <ActionRow key={row.key} row={row} n={i + 1} current={i === 0} onRun={onRun} />)}
                  </ol>
                ) : <p className={styles.empty}>Nothing open in this program.</p>)}
              </section>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}
