import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../components/Button/Button';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { EmptyState } from '../../../../components/EmptyState/EmptyState';
import { FilterChip } from '../../../../components/FilterChip/FilterChip';
import { Icon } from '../../../../components/Icon/Icon';
import { SimpleTableSkeleton } from '../../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { useAppStore } from '../../../../store/useAppStore';
import { collaboratorsOf, inboxType } from '../../../messages/comms/commsInboxes';
import { INBOX_TYPES } from './inboxesMock';
import { UserBadges } from '../UserBadges';
import { InboxDrawer } from './InboxDrawer';
import efax from '../efax/EfaxSettings.module.css';
import styles from './Inboxes.module.css';

const TYPE_ICON = { sms: 'solar:chat-square-linear', email: 'solar:letter-linear' };

/**
 * Settings > Messages > Inboxes: the practice's SMS numbers and Outlook
 * inboxes, each with its collaborators (the inbox's assignees). `editing` is
 * controlled by the host so the tab bar's "New Inbox" can open the drawer.
 *
 * @param {object}   props
 * @param {string}   [props.searchQuery]
 * @param {object|'new'|null} props.editing
 * @param {function} props.setEditing
 */
export function InboxesSettingsPanel({ searchQuery = '', editing, setEditing }) {
  const inboxes = useAppStore(s => s.commsInboxes);
  const loaded = useAppStore(s => s.commsInboxesLoaded);
  const fetchCommsInboxes = useAppStore(s => s.fetchCommsInboxes);
  const addCommsInbox = useAppStore(s => s.addCommsInbox);
  const updateCommsInbox = useAppStore(s => s.updateCommsInbox);
  const deleteCommsInbox = useAppStore(s => s.deleteCommsInbox);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const currentActorName = useAppStore(s => s.currentActorName);
  const showToast = useAppStore(s => s.showToast);
  const [types, setTypes] = useState([]);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => { fetchCommsInboxes(); fetchPlatformUsers?.(); }, [fetchCommsInboxes, fetchPlatformUsers]);

  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inboxes
      .map(i => ({ ...i, users: collaboratorsOf(i, platformUsers || []) }))
      .filter(i => !types.length || types.includes(inboxType(i)))
      .filter(i => !q || `${i.name} ${i.address} ${i.users.map(u => u.name).join(' ')}`.toLowerCase().includes(q))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [inboxes, platformUsers, searchQuery, types]);

  const handleSave = (values) => {
    const updatedBy = currentActorName();
    if (editing && editing !== 'new') {
      updateCommsInbox(editing.id, { ...values, collaboratorNames: undefined, updatedBy });
      showToast('Inbox Updated Successfully');
    } else {
      addCommsInbox({ id: `inbox-${new Date().getTime()}`, ...values, updatedBy });
      showToast('Inbox Added Successfully');
    }
    setEditing(null);
  };

  const drawer = editing && (
    <InboxDrawer
      key={editing === 'new' ? 'new' : editing.id}
      inbox={editing === 'new' ? null : editing}
      collaboratorIds={editing === 'new' ? [] : collaboratorsOf(editing, platformUsers || []).map(u => u.id)}
      users={platformUsers || []}
      existing={inboxes}
      onSave={handleSave}
      onClose={() => setEditing(null)}
    />
  );

  if (!loaded) return <SimpleTableSkeleton rows={4} cols={4} />;

  if (!inboxes.length) {
    return (
      <div className={efax.empty}>
        <EmptyState icon="solar:inbox-linear" title="No inboxes added yet" />
        <Button leadingIcon="solar:add-circle-linear" onClick={() => setEditing('new')}>New Inbox</Button>
        {drawer}
      </div>
    );
  }

  return (
    <>
      <div className={styles.filters}>
        <FilterChip label="Inbox Type" options={Object.values(INBOX_TYPES)} selected={types} onChange={setTypes} />
      </div>
      <table className={efax.table}>
        <thead>
          <tr>
            <th className={styles.colName}>Inbox Name</th>
            <th className={styles.colType}>Inbox Type</th>
            <th>Collaborators</th>
            <th className={efax.colActions}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className={efax.noMatch}>No inboxes match your search.</td></tr>
          ) : rows.map(i => (
            <tr key={i.id}>
              <td>
                <button type="button" className={efax.nameLink} onClick={() => setEditing(i)}>{i.name}</button>
                <div className={styles.address}>{i.address}</div>
              </td>
              <td>
                <span className={styles.type}>
                  <Icon name={TYPE_ICON[i.channel] || TYPE_ICON.sms} size={16} color="var(--neutral-300)" />
                  {inboxType(i)}
                </span>
              </td>
              <td>
                {i.users.length ? (
                  <UserBadges users={i.users} />
                ) : (
                  <span className={efax.muted}>No collaborators</span>
                )}
              </td>
              <td>
                <div className={efax.actions}>
                  <ActionButton icon="solar:pen-linear" tooltip="Edit Inbox" onClick={() => setEditing(i)} />
                  <span className={efax.divider} />
                  <ActionButton icon="solar:trash-bin-minimalistic-linear" tooltip="Delete Inbox" tooltipLeft onClick={() => setToDelete(i)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {drawer}
      {toDelete && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Delete "${toDelete.name}"`}
          description={`${toDelete.address} will be removed from Comms, and its collaborators will no longer be its assignees. This can't be undone.`}
          confirmLabel="Delete Inbox"
          cancelLabel="Cancel"
          variant="error"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            deleteCommsInbox(toDelete.id);
            showToast('Inbox Deleted Successfully');
            setToDelete(null);
          }}
        />
      )}
    </>
  );
}
