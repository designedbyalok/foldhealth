import { useState, useMemo } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { Select } from '../../../components/Select/Select';
import { useAppStore } from '../../../store/useAppStore';
import { Drawer } from '../../../components/Drawer/Drawer';
import { availableUsers } from '../../../data/chatGroups';
import { labelStyle, reqDot, inputStyle, availableRoles } from './GroupDetailDrawer.utils.jsx';
import { GroupDetailDrawerParticipants } from './GroupDetailDrawerParticipants';

export function GroupDetailDrawer() {
  const chatGroupDetailId = useAppStore(s => s.chatGroupDetailId);
  const setChatGroupDetailId = useAppStore(s => s.setChatGroupDetailId);
  const setAgentRulesGroupId = useAppStore(s => s.setAgentRulesGroupId);
  const setBusinessHoursOpen = useAppStore(s => s.setBusinessHoursOpen);
  const addChatGroup = useAppStore(s => s.addChatGroup);
  const updateChatGroup = useAppStore(s => s.updateChatGroup);
  const showToast = useAppStore(s => s.showToast);
  const chatGroupsData = useAppStore(s => s.chatGroupsData) || [];

  const group = chatGroupsData.find(g => g.id === chatGroupDetailId);
  const isNew = chatGroupDetailId === 'new';

  // Form state
  const [scope, setScope] = useState(isNew ? 'location' : 'global');
  const [location, setLocation] = useState('');
  const [groupName, setGroupName] = useState(isNew ? '' : (group?.name || ''));
  const [welcomeMsg, setWelcomeMsg] = useState(isNew ? '' : 'Hey this is a test');
  const [oooMsg, setOooMsg] = useState(isNew ? '' : 'test');

  // Participants state (functional)
  const [selectedUserIds, setSelectedUserIds] = useState(
    isNew ? ['u1', 'u2'] : ['u1', 'u2']
  );
  const [selectedRoleIds, setSelectedRoleIds] = useState(
    isNew ? ['r1', 'r2'] : ['r1', 'r2']
  );
  const [chatEnabled, setChatEnabled] = useState({});
  const [enableAll, setEnableAll] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTab, setSearchTab] = useState('users');
  const [searchOpen, setSearchOpen] = useState(false);

  const filteredSearchUsers = useMemo(() => {
    if (!searchQuery.trim()) return availableUsers;
    const q = searchQuery.toLowerCase();
    return availableUsers.filter(u => u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredSearchRoles = useMemo(() => {
    if (!searchQuery.trim()) return availableRoles;
    const q = searchQuery.toLowerCase();
    return availableRoles.filter(r => r.name.toLowerCase().includes(q));
  }, [searchQuery]);

  const selectedUserIdSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);
  const selectedRoleIdSet = useMemo(() => new Set(selectedRoleIds), [selectedRoleIds]);

  if (!group && !isNew) return null;

  const selectedUsers = availableUsers.filter(u => selectedUserIdSet.has(u.id));
  const selectedRoles = availableRoles.filter(r => selectedRoleIdSet.has(r.id));

  const toggleUser = (userId) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };
  const toggleRole = (roleId) => {
    setSelectedRoleIds(prev => prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]);
  };
  const removeUser = (userId) => setSelectedUserIds(prev => prev.filter(id => id !== userId));
  const removeRole = (roleId) => setSelectedRoleIds(prev => prev.filter(id => id !== roleId));

  const toggleChatForUser = (userId, val) => {
    setChatEnabled(prev => ({ ...prev, [userId]: val }));
  };
  const handleEnableAll = (val) => {
    setEnableAll(val);
    const newMap = {};
    for (const u of selectedUsers) {
      if (!u.isAgent) newMap[u.id] = val;
    }
    setChatEnabled(newMap);
  };
  const clearAll = () => { setSelectedUserIds([]); setSelectedRoleIds([]); setChatEnabled({}); };

  const handleConfigureRules = () => {
    if (!group) return;
    setChatGroupDetailId(null);
    setTimeout(() => setAgentRulesGroupId(group.id), 200);
  };
  const handleBusinessHours = (e) => {
    e.preventDefault();
    setChatGroupDetailId(null);
    setTimeout(() => setBusinessHoursOpen?.(true), 200);
  };

  const title = isNew ? 'Configure Chat Group' : 'Configure Chat Group';
  const ctaLabel = isNew ? 'Create' : 'Update';

  const headerRight = (
    <Button variant="primary" size="L" onClick={async () => {
      if (!groupName.trim()) { showToast('Group name is required'); return; }
      const userNames = [];
      for (const u of selectedUsers) {
        if (!u.isAgent) userNames.push(u.name);
      }
      const groupData = {
        name: groupName.trim(),
        users: userNames,
        roles: selectedRoles.map(r => r.name),
        location: scope === 'location' ? (location || 'Global Template') : 'Global Template',
        hasAgent: selectedUsers.some(u => u.isAgent),
        agentName: selectedUsers.find(u => u.isAgent)?.name || null,
        updatedBy: 'Current User',
      };
      if (isNew) {
        await addChatGroup(groupData);
        showToast('Group created');
      } else {
        await updateChatGroup(group.id, groupData);
        showToast('Group updated');
      }
      setChatGroupDetailId(null);
    }}>
      {ctaLabel}
    </Button>
  );

  return (
    <Drawer title={title} onClose={() => setChatGroupDetailId(null)} headerRight={headerRight}>
      {/* Create Group for */}
      <div style={{ marginBottom: 20 }}>
        <div style={labelStyle}>Create Group for {reqDot}</div>
        <div className="flex gap-6 mt-1" role="radiogroup">
          <span className="flex items-center gap-2">
            <RadioButton label="Location" checked={scope === 'location'} onChange={() => setScope('location')} />
            <Icon name="solar:info-circle-linear" size={13} color="var(--neutral-200)" />
          </span>
          <span className="flex items-center gap-2">
            <RadioButton label="Global (Template Only)" checked={scope === 'global'} onChange={() => setScope('global')} />
            <Icon name="solar:info-circle-linear" size={13} color="var(--neutral-200)" />
          </span>
        </div>
      </div>

      {/* Location dropdown (only when Location scope) */}
      {scope === 'location' && (
        <div style={{ marginBottom: 20 }}>
          <Select
            options={[
              { value: 'new-york', label: 'New York' },
              { value: 'los-angeles', label: 'Los Angeles' },
              { value: 'chicago', label: 'Chicago' },
              { value: 'houston', label: 'Houston' },
              { value: 'philadelphia', label: 'Philadelphia' },
              { value: 'san-antonio', label: 'San Antonio' },
              { value: 'phoenix', label: 'Phoenix' },
            ]}
            value={location}
            onChange={setLocation}
            placeholder="Choose the location"
          />
        </div>
      )}

      {/* Group Name */}
      <div style={{ marginBottom: 4 }}>
        <div style={labelStyle}>Group Name {reqDot}</div>
        <div style={{ position: 'relative' }}>
          <input aria-label="Group name" value={groupName} onChange={e => setGroupName(e.target.value.slice(0, 50))}
            placeholder="Enter group name e.g. ortho group" style={inputStyle} />
          <span style={{ position: 'absolute', right: 12, top: 9, fontSize: 12, color: 'var(--neutral-200)' }}>
            {groupName.length}/50
          </span>
        </div>
      </div>

      {/* Group Name Preview */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--neutral-200)', marginBottom: 6 }}>Group Name Preview</div>
        <div style={{ padding: '12px 16px', background: 'var(--neutral-50)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-50)', border: '1.5px solid var(--primary-200)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="solar:chat-round-dots-linear" size={16} color="var(--primary-300)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: 'var(--neutral-500)' }}>
              [patient_name] - <span style={{ color: 'var(--neutral-200)' }}>{groupName || 'Group Name'}</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--neutral-200)' }}>23:54</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>[patient_name] was added</div>
          </div>
        </div>
      </div>

      {/* Create Group With */}
      <GroupDetailDrawerParticipants
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchTab={searchTab}
        setSearchTab={setSearchTab}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        filteredSearchUsers={filteredSearchUsers}
        filteredSearchRoles={filteredSearchRoles}
        selectedUserIdSet={selectedUserIdSet}
        selectedRoleIdSet={selectedRoleIdSet}
        toggleUser={toggleUser}
        toggleRole={toggleRole}
        selectedUsers={selectedUsers}
        selectedRoles={selectedRoles}
        enableAll={enableAll}
        handleEnableAll={handleEnableAll}
        clearAll={clearAll}
        chatEnabled={chatEnabled}
        toggleChatForUser={toggleChatForUser}
        removeUser={removeUser}
        removeRole={removeRole}
        handleConfigureRules={handleConfigureRules}
        setChatEnabled={setChatEnabled}
      />

      {/* Welcome Message */}
      <div style={{ marginBottom: 20 }}>
        <div style={labelStyle}>Welcome Message <Icon name="solar:info-circle-linear" size={13} color="var(--neutral-200)" /></div>
        <div style={{ position: 'relative' }}>
          <textarea aria-label="Group welcome message" value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value.slice(0, 300))}
            placeholder="Write a welcome message for this group"
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }} />
          <span style={{ position: 'absolute', right: 12, bottom: 8, fontSize: 11, color: 'var(--neutral-200)' }}>
            {welcomeMsg.length}/300
          </span>
        </div>
      </div>

      {/* OOO Auto Reply */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...labelStyle, color: 'var(--neutral-200)' }}>Out Of Office - Auto Reply <Icon name="solar:info-circle-linear" size={13} color="var(--neutral-200)" /></div>
        <div style={{ position: 'relative' }}>
          <textarea aria-label="Automatic reply" value={oooMsg} onChange={e => setOooMsg(e.target.value.slice(0, 300))}
            placeholder="Set up an automatic reply"
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }} />
          <span style={{ position: 'absolute', right: 12, bottom: 8, fontSize: 11, color: 'var(--neutral-200)' }}>
            {oooMsg.length}/300
          </span>
        </div>
      </div>

      {/* Business Hours Link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={handleBusinessHours}
          style={{
            fontSize: 13, color: 'var(--primary-300)', fontWeight: 500, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer',
          }}
        >
          See Business Hours <Icon name="solar:arrow-right-up-linear" size={12} color="var(--primary-300)" />
        </button>
      </div>
    </Drawer>
  );
}
