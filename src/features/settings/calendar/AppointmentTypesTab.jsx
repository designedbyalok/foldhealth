import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { WorklistShell } from '../../../components/WorklistShell/WorklistShell';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Icon } from '../../../components/Icon/Icon';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { SearchIconButton } from '../../../components/SearchIconButton/SearchIconButton';
import { TruncatedText } from '../../../components/TruncatedText/TruncatedText';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { toast } from '../../../components/Toast/sonnerToast';
import { AppointmentTypeDrawer } from './AppointmentTypeDrawer';
import { UserAvailabilityDrawer } from './availability/UserAvailabilityDrawer';
import { DEFAULT_APPLICABLE_ROLES } from './availability/bulkAvailability';
import calendarStyles from './CalendarSettings.module.css';
import styles from './AppointmentTypesTab.module.css';

const PER_PAGE = 15;
const COLUMNS = [
  { key: 'name', label: 'Name', sticky: 'left', left: 0, width: 300 },
  { key: 'duration', label: 'Duration', width: 120 },
  { key: 'roles', label: 'Roles', width: 200 },
  { key: 'mode', label: 'Mode of Appointment', width: 180 },
  { key: 'span', label: 'Booking Span', width: 200 },
  { key: 'self', label: 'Member Self Schedule', width: 120 },
  { key: 'rsvp', label: 'RSVP Enabled', width: 110 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 148, thStyle: { boxShadow: 'inset 0.5px 0 0 var(--neutral-150)' } },
];

// Roles a type is open to: its own Applicable For, else the defaults.
const rolesOf = (t) => (Array.isArray(t.applicable_roles) ? t.applicable_roles : DEFAULT_APPLICABLE_ROLES);
const yesNo = (v) => (v == null ? '-' : v ? 'Yes' : 'No');

/**
 * Settings → Calendar → Appointment types: every visit type in a table (name
 * and description, duration, the roles it's open to, mode, how far ahead it
 * can be booked, whether members can book it themselves, RSVP). Actions:
 * Edit (the Appointment Type drawer), Add availability for this type (the
 * multi-user drawer with the type set), and Delete (after a confirm).
 */
export function AppointmentTypesTab({ tabs, activeTab, onTabChange }) {
  const types = useAppStore((s) => s.appointmentTypes);
  const fetchTypes = useAppStore((s) => s.fetchAppointmentTypes);
  const platformUsers = useAppStore((s) => s.platformUsers);
  const fetchPlatformUsers = useAppStore((s) => s.fetchPlatformUsers);
  const fetchUserAvailability = useAppStore((s) => s.fetchUserAvailability);
  const [editingId, setEditingId] = useState(null);
  const [availabilityFor, setAvailabilityFor] = useState(null); // a type name
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const editing = types.find(t => t.id === editingId);
  const deleteType = useAppStore((s) => s.deleteAppointmentType);
  const [deleting, setDeleting] = useState(null); // the type
  const [deleteBusy, setDeleteBusy] = useState(false);
  const confirmDelete = async () => {
    setDeleteBusy(true);
    const ok = await deleteType(deleting.id);
    setDeleteBusy(false);
    if (!ok) { toast.error('Appointment type could not be deleted. Try again.'); return; }
    toast.success('Appointment Type Deleted Successfully');
    setDeleting(null);
  };

  // Show the skeleton until the first fetch settles, unless types are already loaded.
  const [fetched, setFetched] = useState(() => types.length > 0);
  useEffect(() => {
    let alive = true;
    Promise.resolve(fetchTypes()).finally(() => { if (alive) setFetched(true); });
    return () => { alive = false; };
  }, [fetchTypes]);
  useEffect(() => { if (availabilityFor) { fetchPlatformUsers?.(); fetchUserAvailability?.(); } }, [availabilityFor, fetchPlatformUsers, fetchUserAvailability]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => types.filter(t => !q || `${t.name} ${t.description || ''}`.toLowerCase().includes(q)), [types, q]);
  const lastPage = Math.max(1, Math.ceil(shown.length / perPage));
  const pageNow = Math.min(page, lastPage);
  const rows = shown.slice((pageNow - 1) * perPage, pageNow * perPage);

  const tools = searchOpen ? (
    <SearchBar
      placeholder="Search appointment types"
      value={query}
      onChange={(e) => { setQuery(e.target.value); setPage(1); }}
      onClose={() => { setSearchOpen(false); setQuery(''); setPage(1); }}
    />
  ) : (
    <SearchIconButton tooltipBelow onClick={() => setSearchOpen(true)} />
  );

  const renderRow = (t) => (
    <tr key={t.id} className={styles.row}>
      <td className={`${styles.td} ${styles.stickyLeft}`} style={{ left: 0 }}>
        <span className={styles.typeCell}>
          {/* The type's own colour, as on the calendar, then name over description. */}
          <span className={styles.colorDot} style={{ background: t.color || 'var(--primary-300)' }} aria-hidden="true" />
          <span className={styles.typeText}>
            <span className={styles.typeName}>{t.name}</span>
            {t.description && <span className={styles.typeDesc}>{t.description}</span>}
          </span>
        </span>
      </td>
      <td className={styles.td}>{t.duration || '-'}</td>
      <td className={styles.td}><TruncatedText text={rolesOf(t).join(', ') || 'Everyone'} /></td>
      <td className={styles.td}>{t.mode || '-'}</td>
      <td className={styles.td}>{t.booking_span || '-'}</td>
      <td className={styles.td}>{yesNo(t.patient_bookable)}</td>
      <td className={styles.td}>{yesNo(t.rsvp_enabled)}</td>
      <td className={`${styles.td} ${styles.stickyRight}`}>
        <span className={`${styles.actionsCell} ${styles.actionsGap}`}>
          <ActionButton tooltip="Edit" tooltipLeft tooltipBelow aria-label={`Edit ${t.name}`} onClick={() => setEditingId(t.id)}>
            <Icon name="solar:pen-linear" size={16} color="var(--neutral-300)" />
          </ActionButton>
          <span className={styles.actionDivider} aria-hidden="true" />
          <ActionButton tooltip="Add availability for this type" tooltipLeft tooltipBelow aria-label={`Add availability for ${t.name}`} onClick={() => setAvailabilityFor(t.name)}>
            <Icon name="solar:clock-circle-linear" size={16} color="var(--neutral-300)" />
          </ActionButton>
          <span className={styles.actionDivider} aria-hidden="true" />
          <ActionButton tooltip="Delete" tooltipLeft tooltipBelow aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}>
            <Icon name="solar:trash-bin-minimalistic-linear" size={16} color="var(--neutral-300)" />
          </ActionButton>
        </span>
      </td>
    </tr>
  );

  return (
    <div className={calendarStyles.wrapper}>
      <SectionTitleBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} actions={[]} rightExtras={tools} />
      <div className={styles.tableWrap}>
        <WorklistShell
          header={null}
          columns={COLUMNS}
          rows={rows}
          renderRow={renderRow}
          loading={!fetched}
          emptyState={(
            <div className={calendarStyles.empty}>
              <EmptyState icon="solar:calendar-linear" title={q ? 'No appointment types match this search' : 'No appointment types yet'} />
            </div>
          )}
          minTableWidth={1378}
          fixedLayout
          page={pageNow}
          perPage={perPage}
          totalItems={shown.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
        />
      </div>
      {editing && <AppointmentTypeDrawer key={editing.id} type={editing} onClose={() => setEditingId(null)} />}
      {deleting && (
        <ConfirmDialog
          variant="destructive"
          title="Delete appointment type?"
          description={`${deleting.name} will be removed and can no longer be booked. Appointments already booked with it stay on the calendar.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loading={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
      {availabilityFor && (
        <UserAvailabilityDrawer
          bulk
          presetType={availabilityFor}
          users={(platformUsers || []).map(u => ({ ...u, role: u.clinicalRoles?.[0] || 'Staff' }))}
          onClose={() => setAvailabilityFor(null)}
        />
      )}
    </div>
  );
}
