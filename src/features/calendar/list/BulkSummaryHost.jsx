import { useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { BulkSummaryDrawer } from './BulkSummaryDrawer';

/**
 * The bulk job summary drawer (rescheduling, cancellation), opened from
 * anywhere through the store. Loads the jobs on start, so ones kept in this
 * browser (before the migration runs) bring their notifications back after a
 * reload.
 */
export function BulkSummaryHost() {
  const jobId = useAppStore(s => s.bulkSummaryJobId);
  const close = useAppStore(s => s.closeBulkSummary);
  const fetchJobs = useAppStore(s => s.fetchBulkJobs);
  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  return jobId ? <BulkSummaryDrawer key={jobId} jobId={jobId} onClose={close} /> : null;
}
