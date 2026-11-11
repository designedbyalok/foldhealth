import { useEffect, useState } from 'react';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { Button } from '../../../components/Button/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { OnCallSchedulesTable } from '../../ooo/OnCallSchedulesTable';
import { OnCallScheduleDrawer } from '../../ooo/OnCallScheduleDrawer';
import styles from '../calendar/CalendarSettings.module.css';

const TABS = [
  { key: 'numbers', label: 'Phone Number' },
  { key: 'trees', label: 'Phone Trees' },
  { key: 'types', label: 'Communication Types' },
  { key: 'extensions', label: 'Extension Configuration' },
  { key: 'oncall', label: 'On-Call Schedule' },
  { key: 'blocked', label: 'Blocked Numbers' },
];

/** Settings → Calls. On-Call Schedule is built; the other tabs are coming soon. */
export function CallSettings() {
  const [tab, setTab] = useState('oncall');
  const schedules = useAppStore(s => s.onCallSchedules);
  const loading = useAppStore(s => s.onCallSchedulesLoading);
  const fetched = useAppStore(s => s.onCallSchedulesFetched);
  const fetchOnCallSchedules = useAppStore(s => s.fetchOnCallSchedules);
  const deleteOnCallSchedule = useAppStore(s => s.deleteOnCallSchedule);
  useEffect(() => { fetchOnCallSchedules?.(); }, [fetchOnCallSchedules]);
  const [drawer, setDrawer] = useState(null); // { schedule?, readOnly? }
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const newButton = (
    <Button variant="outline" leadingIcon="solar:add-circle-linear" onClick={() => setDrawer({})}>New</Button>
  );
  const onCall = tab === 'oncall';

  return (
    <div className={styles.wrapper}>
      <SectionTitleBar tabs={TABS} activeTab={tab} onTabChange={setTab} actions={[]} rightExtras={onCall ? newButton : null} />
      <div className={styles.content}>
        {onCall ? (
          <OnCallSchedulesTable
            schedules={schedules}
            loading={loading || !fetched}
            emptyState={(
              <div className={styles.empty}>
                <EmptyState
                  icon="solar:phone-calling-linear"
                  title="No On-Call Schedules yet"
                  description="Set who answers the phone tree on holidays and when staff are out of office."
                  action={newButton}
                />
              </div>
            )}
            onEdit={(schedule) => setDrawer({ schedule })}
            onView={(schedule) => setDrawer({ schedule, readOnly: true })}
            onDelete={setToDelete}
          />
        ) : (
          <div className={styles.empty}>
            <EmptyState icon="solar:phone-linear" title={`${TABS.find(t => t.key === tab)?.label} is coming soon`} />
          </div>
        )}
      </div>
      {drawer && (
        <OnCallScheduleDrawer schedule={drawer.schedule} readOnly={drawer.readOnly} onClose={() => setDrawer(null)} />
      )}
      {toDelete && (
        <ConfirmDialog
          variant="destructive"
          title="Delete On-Call Schedule?"
          description={`"${toDelete.name}" will be deleted. Calls on these dates will no longer route to ${(toDelete.users || [{ name: toDelete.userName }]).map(u => u.name).join(', ')}.`}
          confirmLabel="Delete Schedule"
          cancelLabel="Cancel"
          loading={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={async () => {
            setDeleting(true);
            const ok = await deleteOnCallSchedule(toDelete.id);
            setDeleting(false);
            if (ok) toast.success('On Call Schedule Deleted Successfully');
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}
