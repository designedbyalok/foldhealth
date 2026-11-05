import { useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Tabs } from '../../../components/Tabs/Tabs';
import { useTableSort } from '../../../components/HeaderCell/useTableSort';
import { formatRange } from '../lib/analytics';
import { MEMBER_STATUSES, fmtDate, stepLabel, stoppedStep } from './analyticsUi';
import { MemberCell, MemberRowMenu, MemberTable } from './MemberTable';
import styles from './Analytics.module.css';

const EMPTY = {
  completed: 'No members completed the automation in this range',
  in_progress: 'No members are waiting on a step in this range',
  failed: 'No members failed in this range',
};

/**
 * Automation Overview drawer: members by outcome (Completed / In progress /
 * Failed) for the filtered range. A row opens that member's trace.
 */
export function OverviewDrawer({ automation, graphOf, members, range, tab, onTab, onOpenTrace, onClose }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const rows = useMemo(() => members
    .filter(m => m.status === tab)
    .map(m => {
      const stop = m.status === 'completed' ? null : stoppedStep(m, graphOf(m));
      return { ...m, name: m.patientName || '', stop };
    }), [members, tab, graphOf]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(rows, 'startedAt', 'desc');

  const counts = useMemo(() => Object.fromEntries(MEMBER_STATUSES.map(s => [s.key, members.filter(m => m.status === s.key).length])), [members]);

  const columns = [
    { key: 'name', label: 'Member name', sortField: 'name', render: r => <MemberCell name={r.patientName} at={r.startedAt} /> },
    ...(tab === 'in_progress' ? [{
      key: 'waiting',
      label: 'Waiting on',
      render: r => (r.stop
        ? (
          <span className={styles.cellStack}>
            <span>{stepLabel(r.stop.node)}</span>
            {r.stop.step?.until && <span className={styles.memberMeta}>Until {fmtDate(r.stop.step.until)}</span>}
          </span>
        )
        : <span className={styles.muted}>Next step</span>),
    }] : []),
    ...(tab === 'failed' ? [{
      key: 'reason',
      label: 'Failing reason',
      render: r => <span className={styles.errorText}>{r.failingReason || r.stop?.step?.error || 'Unknown error'}</span>,
    }] : []),
  ];

  return (
    <Drawer
      width={716}
      onClose={onClose}
      title="Automation Overview"
    >
      <div className={styles.drawerIntro}>
        <span className={styles.drawerSub}>{automation.name}</span>
        <span className={styles.drawerRange}>{formatRange(range)}</span>
      </div>
      <div className={styles.drawerTabs}>
        <Tabs
          items={MEMBER_STATUSES.map(s => ({ key: s.key, label: s.label, count: counts[s.key] }))}
          value={tab}
          onValueChange={k => { onTab(k); setPage(1); }}
        />
      </div>
      <MemberTable
        columns={columns}
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={k => requestSort(k)}
        onRowClick={r => onOpenTrace(r.id)}
        renderMenu={r => <MemberRowMenu member={r} patientId={r.patientId} patientName={r.patientName} />}
        emptyLabel={EMPTY[tab]}
        page={page}
        perPage={perPage}
        onPage={setPage}
        onPerPage={n => { setPerPage(n); setPage(1); }}
      />
    </Drawer>
  );
}
