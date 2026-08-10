import { Icon } from '../../../components/Icon/Icon';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Badge } from '../../../components/Badge/Badge';
import { CheckboxTick } from '../../../components/CheckboxTick/CheckboxTick';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { Switch } from '../../../components/Switch/Switch';
import { labelStyle, reqDot, inputStyle } from './GroupDetailDrawer.utils.jsx';

export function GroupDetailDrawerParticipants(props) {
  const {
    searchQuery, setSearchQuery, searchTab, setSearchTab, searchOpen, setSearchOpen,
    filteredSearchUsers, filteredSearchRoles, selectedUserIdSet, selectedRoleIdSet,
    toggleUser, toggleRole, selectedUsers, selectedRoles,
    enableAll, handleEnableAll, clearAll, chatEnabled, toggleChatForUser, removeUser, removeRole,
    handleConfigureRules, setChatEnabled,
  } = props;
  return (
    <>
      {/* Create Group With */}
      <div style={{ marginBottom: 20 }}>
        <div style={labelStyle}>Create Group With <Icon name="solar:info-circle-linear" size={13} color="var(--neutral-200)" /> {reqDot}</div>

        {/* Search input with dropdown */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'text' }}
            onClick={() => setSearchOpen(true)}>
            <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search user and care team roles to add in group"
              style={{ border: 'none', outline: 'none', fontSize: 13, color: 'var(--neutral-400)', fontFamily: "'Inter', sans-serif", flex: 1, background: 'transparent' }}
            />
          </div>

          {/* Search Dropdown */}
          {searchOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setSearchOpen(false)} />
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-150)', borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,.1)', maxHeight: 280, overflow: 'hidden',
                marginTop: 4,
              }}>
                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '0.5px solid var(--neutral-150)' }}>
                  {['users', 'roles'].map(tab => (
                    <div key={tab} onClick={() => setSearchTab(tab)} style={{
                      flex: 1, textAlign: 'center', padding: '10px 0', fontSize: 13, cursor: 'pointer',
                      color: searchTab === tab ? 'var(--neutral-500)' : 'var(--neutral-200)',
                      fontWeight: searchTab === tab ? 600 : 400,
                      borderBottom: searchTab === tab ? '2px solid var(--neutral-500)' : '2px solid transparent',
                    }}>
                      {tab === 'users' ? 'Users' : 'Care Team Roles'}
                    </div>
                  ))}
                </div>

                {/* List */}
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {searchTab === 'users' ? filteredSearchUsers.map(u => {
                    const isSelected = selectedUserIdSet.has(u.id);
                    const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                    return (
                      <div
                        key={u.id}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => toggleUser(u.id)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleUser(u.id); } }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                          borderBottom: '0.5px solid var(--neutral-75)', cursor: 'pointer',
                        }}
                      >
                        <CheckboxTick checked={isSelected} size={16} />
                        <Avatar variant={u.isAgent ? 'agent' : 'assignee'} initials={initials} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-500)' }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{u.role}</div>
                        </div>
                      </div>
                    );
                  }) : filteredSearchRoles.map(r => {
                    const isSelected = selectedRoleIdSet.has(r.id);
                    return (
                      <div
                        key={r.id}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => toggleRole(r.id)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRole(r.id); } }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                          borderBottom: '0.5px solid var(--neutral-75)', cursor: 'pointer',
                        }}
                      >
                        <CheckboxTick checked={isSelected} size={16} />
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-500)' }}>{r.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Selected Users and Roles */}
        {(selectedUsers.length > 0 || selectedRoles.length > 0) && (
          <div style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 4, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--neutral-150)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-500)' }}>Selected Users and Roles</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--neutral-300)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={enableAll} onChange={e => handleEnableAll(e.target.checked)}
                    style={{ accentColor: 'var(--primary-300)' }} />
                  Enable all 1:1 Chat
                </label>
                <Button variant="danger" size="S" leadingIcon="solar:close-circle-linear" onClick={clearAll}>Clear All Selection</Button>
              </div>
            </div>

            {/* Users section */}
            {selectedUsers.length > 0 && (
              <div style={{ padding: '4px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--neutral-200)' }}>Users</span>
                  <span style={{ fontSize: 11, color: 'var(--neutral-200)', display: 'flex', alignItems: 'center', gap: 2 }}>
                    Allow 1:1 Chat
                    <Tooltip
                      maxWidth={200}
                      label={
                        <>
                          <p>Enable 1:1 Chat</p>
                          <p style={{ marginTop: 2, opacity: 0.8 }}>Allows patients from the selected location to initiate 1:1 chats with users or user roles that have this setting enabled.</p>
                        </>
                      }
                    >
                      <span style={{ cursor: 'help', display: 'inline-flex' }}>
                        <Icon name="solar:info-circle-linear" size={11} color="var(--neutral-200)" />
                      </span>
                    </Tooltip>
                  </span>
                </div>
                {selectedUsers.map(p => {
                  const initials = p.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                      borderBottom: '0.5px solid var(--neutral-75)',
                    }}>
                      <Avatar variant={p.isAgent ? 'agent' : 'assignee'} initials={initials} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: 'var(--neutral-500)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.name}
                          {p.isAgent && <Badge variant="ai-care" label="AI Agent" />}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{p.role}</div>
                      </div>
                      {p.isAgent ? (
                        <Button variant="tertiary" size="S" leadingIcon="solar:settings-linear" trailingIcon="solar:alt-arrow-right-linear" onClick={handleConfigureRules}>
                          Configure Rules
                        </Button>
                      ) : (
                        <>
                          <Switch checked={chatEnabled[p.id] || false} onChange={(val) => toggleChatForUser(p.id, val)} />
                          <ActionButton icon="solar:close-circle-linear" size="L" tooltip="Remove user" onClick={() => removeUser(p.id)} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Care Team Roles section */}
            {selectedRoles.length > 0 && (
              <div style={{ padding: '4px 14px', paddingBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--neutral-200)', padding: '6px 0' }}>Care Team Roles</div>
                {selectedRoles.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: '0.5px solid var(--neutral-75)',
                  }}>
                    <span style={{ fontSize: 14, color: 'var(--neutral-500)' }}>{r.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Switch checked={chatEnabled[r.id] || false} onChange={(val) => setChatEnabled(prev => ({ ...prev, [r.id]: val }))} />
                      <ActionButton icon="solar:close-circle-linear" size="L" tooltip="Remove role" onClick={() => removeRole(r.id)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
