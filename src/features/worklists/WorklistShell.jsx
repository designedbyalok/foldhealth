import { useMemo } from 'react';
import { WorklistShell as BaseWorklistShell } from '../../components/WorklistShell/WorklistShell';
import { splitWorklistColumns } from '../../components/WorklistShell/splitWorklistColumns';
import { useWorklistColumns } from './useWorklistColumns';

/**
 * WorklistShell with the user's column choices (order, hidden) saved per
 * worklist. `worklistKey` names the saved layout (e.g. 'toc-queue');
 * without it this is the plain WorklistShell.
 */
export function WorklistShell({ worklistKey, columns, ...rest }) {
  const { customisableColumns, hiddenByDefault } = useMemo(() => splitWorklistColumns(columns), [columns]);
  const columnPrefs = useWorklistColumns(worklistKey || '__off__', customisableColumns, { hiddenByDefault });
  return <BaseWorklistShell columns={columns} columnPrefs={worklistKey ? columnPrefs : undefined} {...rest} />;
}
