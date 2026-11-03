import { useEffect, useMemo } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { ActivityLog, MetaLine } from '../../../../components/ActivityLog/ActivityLog';
import { Badge } from '../../../../components/Badge/Badge';
import { historyTimelineStyles as htStyles } from '../../../../components/HistoryTimeline/HistoryTimeline';
import { TimelineSkeleton } from '../../../../components/TimelineSkeleton/TimelineSkeleton';
import { toActivityLogEntries } from '../../../hedis-worklist/CareGapDetailDrawer.utils';
import { useAppStore } from '../../../../store/useAppStore';
import styles from './ExportHistoryDrawer.module.css';

const FORMATS = {
  pdf: { label: 'PDF', icon: 'solar:file-download-linear' },
  html: { label: 'HTML', icon: 'solar:code-file-linear' },
  print: { label: 'Print', icon: 'solar:printer-minimalistic-linear' },
};

// Meta line and title as ActivityLog draws them, then what the export
// covered as white badges.
function renderExport(entry) {
  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title}</span>
      </div>
      {entry.badges.length > 0 && (
        <div className={styles.badges}>
          {entry.badges.map(b => <Badge key={b.label} variant="outline" size="sm" icon={b.icon} label={b.label} />)}
        </div>
      )}
    </>
  );
}

/**
 * Employer Impact Report → History: every export of the report (Download
 * PDF, Download HTML, Print), newest first, month by month, with who
 * exported it, the format, and the employer and dates it covered.
 *
 * @param {object}   props
 * @param {function} props.onClose
 */
export function ExportHistoryDrawer({ onClose }) {
  const exportsList = useAppStore(s => s.employerReportExports);
  const loading = useAppStore(s => s.employerReportExportsLoading);
  const fetched = useAppStore(s => s.employerReportExportsFetched);
  const fetchExports = useAppStore(s => s.fetchEmployerReportExports);

  useEffect(() => { fetchExports(); }, [fetchExports]);

  const entries = useMemo(() => toActivityLogEntries(exportsList.map((r) => {
    const f = FORMATS[r.format] || FORMATS.pdf;
    return {
      t: 'export',
      when: r.exported_at,
      actor: r.exported_by || 'Unknown',
      // Print sends the report's PDF to the printer, so its format is PDF.
      title: r.format === 'print' ? 'Report Printed (PDF)' : `Report Exported (${f.label})`,
      icon: f.icon,
      badges: [
        r.employer && { label: r.employer, icon: 'solar:buildings-2-linear' },
        r.time_frame && { label: r.time_frame, icon: 'solar:clock-circle-linear' },
        r.date_range && { label: r.date_range, icon: 'solar:calendar-linear' },
      ].filter(Boolean),
      render: renderExport,
    };
  })), [exportsList]);

  return (
    <Drawer title="Export History" onClose={onClose}>
      {!fetched || (loading && !exportsList.length)
        ? <TimelineSkeleton rows={4} />
        : <ActivityLog entries={entries} emptyLabel="No exports yet. Exports from the Print drawer show up here." />}
    </Drawer>
  );
}
