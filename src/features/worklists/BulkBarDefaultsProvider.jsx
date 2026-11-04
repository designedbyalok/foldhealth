import { useMemo } from 'react';
import { BulkBarDefaults } from '../../components/BulkBar/BulkBarDefaults';
import { Icon } from '../../components/Icon/Icon';
import { BotIcon } from '../../components/Icon/BotIcon';
import { useAppStore } from '../../store/useAppStore';

const COMING_SOON = [
  { icon: 'solar:letter-opened-linear', label: 'Run Campaign' },
  { icon: 'solar:letter-linear', label: 'Send Email' },
  { icon: 'solar:chat-line-linear', label: 'Send SMS' },
  { icon: 'solar:calendar-minimalistic-linear', label: 'Schedule Appointment' },
  { icon: 'solar:hand-pills-linear', label: 'Medical Reconciliation' },
  { icon: 'solar:clipboard-add-linear', label: 'Send Assessment' },
  { icon: 'solar:book-linear', label: 'Send Education' },
  { icon: 'solar:checklist-minimalistic-linear', label: 'Create Task' },
  { icon: 'solar:tag-horizontal-linear', label: 'Set Tag' },
];

/**
 * The app's defaults for every BulkBar: the store's worklist selection when a
 * caller passes none, and the standard worklist actions when it passes no
 * `actions` (Change Assignee, Run Automation, and More: the coming-soon
 * actions, Invoke Agent, Remove from List).
 */
export function BulkBarDefaultsProvider({ children }) {
  const selectedIds = useAppStore(s => s.selectedIds);
  const onClear = useAppStore(s => s.clearSelected);
  const showToast = useAppStore(s => s.showToast);
  const setShowInvokeModal = useAppStore(s => s.setShowInvokeModal);

  const value = useMemo(() => ({
    selectedIds,
    onClear,
    actions: ({ onChangeAssignee }) => ({
      actions: [
        {
          label: 'Change Assignee',
          icon: 'solar:user-check-rounded-linear',
          onClick: (ids) => (onChangeAssignee ? onChangeAssignee(ids) : showToast('Change Assignee – coming soon')),
        },
        { label: 'Run Automation', icon: 'solar:bolt-linear', onClick: () => showToast('Run Automation – coming soon') },
      ],
      moreActions: [
        ...COMING_SOON.map(a => ({ ...a, onClick: () => showToast(`${a.label} – coming soon`) })),
        {
          label: 'Invoke Agent',
          iconElement: <BotIcon size={16} color="var(--neutral-400)" />,
          trailing: <Icon name="solar:alt-arrow-right-linear" size={16} color="var(--neutral-300)" />,
          onClick: () => setShowInvokeModal(true),
        },
        { divider: true },
        { label: 'Remove from List', icon: 'solar:trash-bin-2-linear', variant: 'destructive', onClick: () => showToast('Removed from list') },
      ],
    }),
  }), [selectedIds, onClear, showToast, setShowInvokeModal]);

  return <BulkBarDefaults.Provider value={value}>{children}</BulkBarDefaults.Provider>;
}
