import { useState } from 'react';
import { WorklistShell } from '../../../components/WorklistShell/WorklistShell';
import { Link } from '../../../components/Link/Link';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { BillingReportDrawer } from './BillingReportDrawer';
import { money, monthLabel } from './careProgramBillingData';
import styles from './CareProgramBilling.module.css';

const COLUMNS = [
  { key: 'month', label: 'Monthly Report', width: 240 },
  { key: 'amount', label: 'Est. Billing Amount', width: 200 },
  { key: 'patients', label: 'Total Patients', width: 160 },
  { key: 'ehr', label: 'Integrated EHR', width: 220 },
  { key: 'action', label: 'Action', width: 180 },
];
const PER_PAGE = 10;

/** Past monthly billing reports; each opens its billed members. */
export function BillingHistoryTab({ reports, loading }) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const total = reports.reduce((n, r) => n + (Number(r.estAmount) || 0), 0);
  const pageRows = reports.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className={styles.tab}>
      <div className={styles.top}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Total Billed Amount</span>
          <span className={styles.statValue}>{money(total)}</span>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <WorklistShell
          header={null}
          columns={COLUMNS}
          rows={pageRows}
          loading={loading}
          minTableWidth={1000}
          page={page}
          perPage={PER_PAGE}
          totalItems={reports.length}
          onPageChange={setPage}
          emptyState={(
            <div className={styles.empty}>
              <EmptyState icon="solar:bill-list-linear" title="No billing reports yet" />
            </div>
          )}
          renderRow={(r) => (
            <tr key={r.id} className={styles.row}>
              <td className={styles.td}><span className={styles.cellText}>{monthLabel(r.month)}</span></td>
              <td className={styles.td}><span className={`${styles.cellText} ${styles.num}`}>{money(r.estAmount)}</span></td>
              <td className={styles.td}><span className={`${styles.cellText} ${styles.num}`}>{r.members.length}</span></td>
              <td className={styles.td}>{r.integratedEhr ? <span className={styles.cellText}>{r.integratedEhr}</span> : <span className={styles.cellMuted}>-</span>}</td>
              <td className={styles.td}><Link onClick={() => setOpen(r)}>View Billing Report</Link></td>
            </tr>
          )}
        />
      </div>

      {open && (
        <BillingReportDrawer
          title={`Billing Report - ${monthLabel(open.month)}`}
          rows={open.members}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
