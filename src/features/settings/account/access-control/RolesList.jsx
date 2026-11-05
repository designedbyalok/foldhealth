import { useState } from 'react';
import { Button } from '../../../../components/Button/Button';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { SearchIconButton } from '../../../../components/SearchIconButton/SearchIconButton';
import { SearchBar } from '../../../../components/SearchBar/SearchBar';
import { MenuPopover } from '../../../../components/MenuPopover/MenuPopover';
import { Input } from '../../../../components/Input/Input';
import { roleMenuItems } from './accessControlUtils';
import styles from './AccessControl.module.css';

/** The inline name field for a new role or a rename: Enter or ✓ saves, Esc or ✕ cancels. */
function RoleNameField({ initial = '', onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  const save = () => { if (value.trim()) onSave(value.trim()); };
  return (
    <div className={styles.nameField}>
      <Input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Enter the Role Name"
        aria-label="Role name"
        wrapperClassName={styles.nameInput}
      />
      <ActionButton icon="solar:check-read-linear" size="sm" tooltip="Save" disabled={!value.trim()} onClick={save} />
      <ActionButton icon="solar:close-circle-linear" size="sm" tooltip="Cancel" onClick={onCancel} />
    </div>
  );
}

export function RolesList({
  roles, selectedId, userCounts, canEdit, creating, renamingId,
  onSelect, onStartCreate, onCancelCreate, onCreate, onCancelRename, onRename, onMenu,
}) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(null); // { role, rect }

  const q = query.trim().toLowerCase();
  const visible = q ? roles.filter(r => r.name.toLowerCase().includes(q)) : roles;

  return (
    <div className={styles.rolesPane}>
      <div className={styles.rolesHead}>
        {searching ? (
          <SearchBar
            value={query}
            onChange={e => setQuery(e.target.value)}
            onClose={() => { setSearching(false); setQuery(''); }}
            placeholder="Search roles"
            fullWidth
          />
        ) : (
          <>
            <h2 className={styles.paneTitle}>Roles</h2>
            <div className={styles.headActions}>
              <SearchIconButton onClick={() => setSearching(true)} />
              {canEdit && (
                <>
                  <span className={styles.headerDivider} />
                  <Button variant="outline" leadingIcon="solar:add-circle-linear" onClick={onStartCreate} disabled={creating}>
                    New Role
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className={styles.rolesScroll}>
        {creating && <RoleNameField onSave={onCreate} onCancel={onCancelCreate} />}
        {visible.map(role => (
          renamingId === role.id ? (
            <RoleNameField key={role.id} initial={role.name} onSave={name => onRename(role, name)} onCancel={onCancelRename} />
          ) : (
            <div
              key={role.id}
              role="button"
              tabIndex={0}
              className={[styles.roleCard, role.id === selectedId ? styles.roleCardActive : ''].filter(Boolean).join(' ')}
              onClick={() => onSelect(role.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(role.id); } }}
            >
              <div className={styles.roleText}>
                <span className={styles.roleName}>{role.name}</span>
                <span className={styles.roleMeta}>{userCounts[role.id] || 0} {userCounts[role.id] === 1 ? 'User' : 'Users'}</span>
              </div>
              {canEdit && (
                <ActionButton
                  icon="solar:menu-dots-linear"
                  size="sm"
                  tooltip="More actions"
                  onClick={(e) => { e.stopPropagation(); setMenu({ role, rect: e.currentTarget.getBoundingClientRect() }); }}
                />
              )}
            </div>
          )
        ))}
        {visible.length === 0 && !creating && (
          <p className={styles.noMatch}>No roles match “{query}”.</p>
        )}
      </div>

      {menu && (
        <MenuPopover
          anchorRect={menu.rect}
          items={roleMenuItems(menu.role, canEdit)}
          onSelect={(key) => { const role = menu.role; setMenu(null); onMenu(key, role); }}
          onClose={() => setMenu(null)}
          ariaLabel={`${menu.role.name} actions`}
        />
      )}
    </div>
  );
}
