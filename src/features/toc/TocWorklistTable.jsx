import { QueueTable } from './queue/QueueTable';
import { TocEmptyState } from './TocEmptyState';
import { TOC_MIDDLE_COLUMNS } from './tocColumns';

/**
 * Standalone TOC worklist: queue table with the Agent Worklist column
 * set (Figma 3044:70430). The TCM Agent Queue tab keeps the original
 * queue columns.
 */
export function TocWorklistTable() {
  return (
    <QueueTable
      worklistKey="toc"
      programLabel="TOC IP"
      emptyState={<TocEmptyState />}
      middleColumns={TOC_MIDDLE_COLUMNS}
    />
  );
}
