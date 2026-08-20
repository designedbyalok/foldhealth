import { useMemo, useState } from 'react';
import { WorklistShell } from '../../../components/WorklistShell/WorklistShell';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { useAppStore } from '../../../store/useAppStore';
import styles from './ruleBuilder.module.css';

/* Same column conventions as the other worklists: Member pinned left,
   demographic/criteria columns free, no bulk actions (read-only list). */
const COLUMNS = [
  { key: 'member', label: 'Members', sticky: 'left', left: 0, width: 260 },
  { key: 'age', label: 'Age', sortKey: 'age', sortType: 'number', width: 90 },
  { key: 'gender', label: 'Gender', width: 100 },
  { key: 'state', label: 'State', width: 90 },
  { key: 'membership', label: 'Membership Status', width: 160 },
  { key: 'engagement', label: 'Engagement', width: 130 },
];

const genderShort = (g) => (String(g || '').charAt(0).toUpperCase() || '—');

/**
 * QualifiedMembersTable — the "Qualified Members" tab of the dynamic group
 * detail screen: every patient whose profile satisfies the group's rule,
 * rendered through the shared WorklistShell (header hidden — the tab bar
 * above owns that chrome).
 */
export function QualifiedMembersTable({ members, loading, error, onRetry }) {
  const openQuickView = useAppStore(s => s.openQuickView);
  const patients = useAppStore(s => s.patients);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortDir, setSortDir] = useState(null);

  const sorted = useMemo(() => {
    if (!sortDir) return members;
    return members.toSorted((a, b) => (sortDir === 'asc' ? 1 : -1) * (Number(a.age) - Number(b.age)));
  }, [members, sortDir]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(sorted.length / perPage)));
  const pageRows = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  /* Quick View only understands the TOC patient shape, so the name is a
     link just for members that exist in that store slice. */
  const quickViewable = useMemo(() => new Set((patients || []).map(p => p.id)), [patients]);

  // Error state — clearly different from "no members" so clinical users don't
  // act on missing data.
  if (!loading && error) {
    return (
      <EmptyState
        icon="solar:danger-triangle-linear"
        title="Could not load members"
        description={`The patient data fetch failed: ${error}. This does NOT mean zero patients qualify — it means we couldn't check.`}
        actionLabel="Retry"
        onAction={onRetry}
      />
    );
  }

  // No qualifying patients — a proper empty state beats a headers-only table.
  if (!loading && members.length === 0) {
    return (
      <EmptyState
        icon="solar:users-group-rounded-linear"
        title="No qualified members"
        description="No patients match this group's rule yet. Adjust the conditions in Rule Design, or refresh after profile data changes."
      />
    );
  }

  return (
    <WorklistShell
      header={null}
      columns={COLUMNS}
      sortKey={sortDir ? 'age' : null}
      sortDir={sortDir || 'asc'}
      onSort={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))}
      rows={pageRows}
      renderRow={(m) => {
        const canOpen = quickViewable.has(m.id);
        return (
          <tr key={m.id} className={styles.qmRow}>
            <td className={`${styles.qmMembersTd} ${styles.qmStickyLeft}`} style={{ left: 0 }}>
              <div className={styles.qmPatientCell}>
                <div>
                  {canOpen ? (
                    <button
                      type="button"
                      className={styles.qmPatientNameLink}
                      onClick={() => openQuickView(patients.find(p => p.id === m.id))}
                    >
                      {m.name}
                    </button>
                  ) : (
                    <span className={styles.qmPatientName}>{m.name}</span>
                  )}
                  <span className={styles.qmPatientDemo}> ({genderShort(m.gender)}•{m.age}y)</span>
                  <div className={styles.qmPatientMeta}>
                    #{m.memberId} • {String(m.language || 'en').toUpperCase()}
                  </div>
                </div>
              </div>
            </td>
            <td className={styles.qmTd}>{m.age}</td>
            <td className={styles.qmTd}>{m.gender || '—'}</td>
            <td className={styles.qmTd}>{m.state || '—'}</td>
            <td className={styles.qmTd}>{m.membershipStatus || '—'}</td>
            <td className={styles.qmTd}>{m.engagement || '—'}</td>
          </tr>
        );
      }}
      loading={loading}
      emptyState="No patients qualify under the current rule."
      page={safePage}
      perPage={perPage}
      totalItems={sorted.length}
      onPageChange={setPage}
      onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
      minTableWidth={860}
    />
  );
}
