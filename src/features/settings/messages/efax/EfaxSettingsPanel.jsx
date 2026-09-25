import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { AvatarGroup } from '../../../../components/AvatarGroup/AvatarGroup';
import { Button } from '../../../../components/Button/Button';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { RingEmptyState } from '../../../../components/RingEmptyState/RingEmptyState';
import { SimpleTableSkeleton } from '../../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { Switch } from '../../../../components/Switch/Switch';
import { useAppStore } from '../../../../store/useAppStore';
import { EfaxNumberDrawer } from './EfaxNumberDrawer';
import styles from './EfaxSettings.module.css';

const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/**
 * Settings > Messages > eFax: the practice's eFax numbers with their linked
 * users and Active / Inactive status. `editing` is controlled by the host so
 * the tab bar's primary "Add eFax" action can open the drawer.
 *
 * @param {object}   props
 * @param {string}   [props.searchQuery]
 * @param {object|'new'|null} props.editing
 * @param {function} props.setEditing
 */
export function EfaxSettingsPanel({ searchQuery = '', editing, setEditing }) {
  const efaxNumbers = useAppStore(s => s.efaxNumbers);
  const loaded = useAppStore(s => s.efaxNumbersLoaded);
  const fetchEfaxNumbers = useAppStore(s => s.fetchEfaxNumbers);
  const addEfaxNumber = useAppStore(s => s.addEfaxNumber);
  const updateEfaxNumber = useAppStore(s => s.updateEfaxNumber);
  const deleteEfaxNumber = useAppStore(s => s.deleteEfaxNumber);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const currentActorName = useAppStore(s => s.currentActorName);
  const showToast = useAppStore(s => s.showToast);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => { fetchEfaxNumbers(); fetchPlatformUsers?.(); }, [fetchEfaxNumbers, fetchPlatformUsers]);

  const usersById = useMemo(() => new Map((platformUsers || []).map(u => [u.id, u])), [platformUsers]);
  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return efaxNumbers
      .map(n => ({ ...n, users: n.linkedUserIds.map(id => usersById.get(id)).filter(Boolean) }))
      .filter(n => !q || `${n.name} ${n.number} ${n.users.map(u => u.name).join(' ')}`.toLowerCase().includes(q))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [efaxNumbers, usersById, searchQuery]);

  const handleSave = (values) => {
    const updatedBy = currentActorName();
    if (editing && editing !== 'new') {
      updateEfaxNumber(editing.id, { ...values, updatedBy });
      showToast(`${values.name} updated`);
    } else {
      addEfaxNumber({ id: `efax-${new Date().getTime()}`, ...values, isActive: true, updatedBy });
      showToast(`${values.name} added`);
    }
    setEditing(null);
  };
  const toggleActive = (n, isActive) => {
    updateEfaxNumber(n.id, { isActive, updatedBy: currentActorName() });
    showToast(`${n.name} marked ${isActive ? 'Active' : 'Inactive'}`);
  };

  const drawer = editing && (
    <EfaxNumberDrawer
      key={editing === 'new' ? 'new' : editing.id}
      efax={editing === 'new' ? null : editing}
      users={platformUsers || []}
      existing={efaxNumbers}
      onSave={handleSave}
      onClose={() => setEditing(null)}
    />
  );

  if (!loaded) return <SimpleTableSkeleton rows={4} cols={5} />;

  if (!efaxNumbers.length) {
    return (
      <div className={styles.empty}>
        <RingEmptyState icon="solar:printer-linear" label="No eFax numbers added yet" />
        <Button variant="primary" size="L" leadingIcon="solar:add-circle-linear" onClick={() => setEditing('new')}>Add eFax</Button>
        {drawer}
      </div>
    );
  }

  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colName}>Name</th>
            <th className={styles.colNumber}>Number</th>
            <th>Linked Users</th>
            <th className={styles.colStatus}>Status</th>
            <th className={styles.colActions}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className={styles.noMatch}>No eFax numbers match your search.</td></tr>
          ) : rows.map(n => (
            <tr key={n.id} className={n.isActive ? undefined : styles.rowInactive}>
              <td>
                <button type="button" className={styles.nameLink} onClick={() => setEditing(n)}>{n.name}</button>
              </td>
              <td className={styles.number}>{n.number}</td>
              <td>
                {n.users.length ? (
                  <div className={styles.users}>
                    <AvatarGroup
                      variant="staff"
                      size="S"
                      max={3}
                      people={n.users.map(u => ({ id: u.id, name: u.name, initials: u.initials || initialsOf(u.name) }))}
                    />
                    <span className={styles.usersText}>
                      {n.users[0].name}
                      {n.users.length > 1 && <span className={styles.usersMore}> +{n.users.length - 1}</span>}
                    </span>
                  </div>
                ) : (
                  <span className={styles.muted}>No users linked</span>
                )}
              </td>
              <td>
                <Switch
                  checked={n.isActive}
                  onChange={v => toggleActive(n, v)}
                  label={n.isActive ? 'Active' : 'Inactive'}
                  ariaLabel={`${n.name} status`}
                />
              </td>
              <td>
                <div className={styles.actions}>
                  <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit eFax" onClick={() => setEditing(n)} />
                  <span className={styles.divider} />
                  <ActionButton icon="solar:trash-bin-minimalistic-linear" size="L" tooltip="Delete eFax" tooltipLeft onClick={() => setToDelete(n)} />
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
          description={`${toDelete.number} will be removed and its linked users will no longer be able to send faxes from it. This can't be undone.`}
          confirmLabel="Delete eFax"
          cancelLabel="Cancel"
          variant="error"
          onCancel={() => setToDelete(null)}
          onConfirm={() => {
            deleteEfaxNumber(toDelete.id);
            showToast(`${toDelete.name} deleted`);
            setToDelete(null);
          }}
        />
      )}
    </>
  );
}
