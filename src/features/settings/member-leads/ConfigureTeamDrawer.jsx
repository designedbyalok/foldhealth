import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { TEAM_TYPE_OPTIONS, KIND_LABEL } from './teamTypeConfig';
import {
  makeId,
  todayMMDDYYYY,
  utilizationFor as calcUtilization,
  breakdownFor as calcBreakdown,
  tinAssignedPct as calcTinAssignedPct,
  usersAssignedToTin as calcUsersAssignedToTin,
  cleanMembersForSave,
  canSaveTeam,
} from './ConfigureTeamDrawer.utils';
import { UserCard } from './ConfigureTeamDrawerUserCard';
import { TIMER_PROGRAM_CODES } from '../billing/careProgramBillingData';
import {
  ConfigureTeamDrawerUserPicker,
  ConfigureTeamDrawerBasicFields,
} from './ConfigureTeamDrawerFields';
import drawerStyles from './ConfigureTeamDrawer.module.css';

// `defaultTeamType` preselects the Team Type for a new team (e.g. opened from
// Billing → Timer Access to add a CCM team).
export function ConfigureTeamDrawer({ kind = 'hcc', editTeam = null, defaultTeamType, onClose }) {
  const addHccCareTeam = useAppStore(s => s.addHccCareTeam);
  const updateHccCareTeam = useAppStore(s => s.updateHccCareTeam);
  const existingTeams = useAppStore(s => s.hccCareTeams);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);

  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  const systemUsers = useMemo(
    () => (platformUsers || []).map(u => ({ ...u, role: u.clinicalRoles?.[0] || 'Staff' })),
    [platformUsers],
  );

  const teamTypeOptions = TEAM_TYPE_OPTIONS[kind] || TEAM_TYPE_OPTIONS.hcc;
  const isEdit = !!editTeam;

  const [name, setName] = useState(editTeam?.name || '');
  const [teamType, setTeamType] = useState(editTeam?.teamType || defaultTeamType || teamTypeOptions[0]);
  const allocatedTins = editTeam?.allocatedTins || [];
  const [members, setMembers] = useState(() => editTeam?.members || []);

  useEffect(() => {
    if (!teamTypeOptions.includes(teamType)) setTeamType(teamTypeOptions[0]);
  }, [teamTypeOptions, teamType]);

  const availableUsers = useMemo(() => {
    const selectedIds = new Set(members.map(m => m.userId));
    return systemUsers.filter(u => !selectedIds.has(u.id));
  }, [systemUsers, members]);

  const ctx = { existingTeams, editTeam, members, name, teamType };
  const utilizationFor = (userId) => calcUtilization(userId, ctx);
  const breakdownFor = (userId) => calcBreakdown(userId, ctx);
  const tinAssignedPct = (tin) => calcTinAssignedPct(tin, ctx);
  const usersForTin = (tin) => calcUsersAssignedToTin(tin, existingTeams);

  const addMember = (u) => {
    setMembers(prev => [
      ...prev,
      {
        userId: u.id,
        name: u.name,
        initials: u.initials,
        roles: u.role || '',
        capacityPct: 0,
        assignTo: [],
      },
    ]);
  };
  const removeMember = (userId) => setMembers(prev => prev.filter(m => m.userId !== userId));
  const clearAllMembers = () => setMembers([]);
  const patchMember = (userId, patch) => setMembers(prev =>
    prev.map(m => m.userId === userId ? { ...m, ...patch } : m),
  );
  const patchAssignTo = (userId, idx, patch) => setMembers(prev =>
    prev.map(m => m.userId !== userId ? m : {
      ...m,
      assignTo: m.assignTo.map((row, i) => i === idx ? { ...row, ...patch } : row),
    }),
  );

  const canSave = canSaveTeam({ name, teamType, members });

  const handleSave = () => {
    if (!canSave) return;
    const now = todayMMDDYYYY();
    const actor = 'You';
    const cleanMembers = cleanMembersForSave(members);
    if (isEdit) {
      updateHccCareTeam(editTeam.id, {
        name: name.trim(),
        teamType,
        allocatedTins,
        members: cleanMembers,
        lastModifiedAt: now,
        lastModifiedBy: actor,
      });
    } else {
      addHccCareTeam({
        id: makeId('team'),
        name: name.trim(),
        kind,
        teamType,
        allocatedTins,
        createdAt: now,
        createdBy: actor,
        lastModifiedAt: now,
        lastModifiedBy: actor,
        members: cleanMembers,
      });
    }
    onClose?.();
  };

  return (
    <Drawer
      title={`Configure ${KIND_LABEL[kind] || 'Team'} Team`}
      onClose={onClose}
      noCloseDivider
      headerRight={
        <>
          <Button disabled={!canSave} onClick={handleSave}>Save</Button>
          <span className={drawerStyles.headerDivider} />
        </>
      }
    >
      <div className={drawerStyles.body}>
        <ConfigureTeamDrawerBasicFields
          name={name}
          teamType={teamType}
          teamTypeOptions={teamTypeOptions}
          onNameChange={setName}
          onTeamTypeChange={setTeamType}
        />

        <ConfigureTeamDrawerUserPicker
          availableUsers={availableUsers}
          utilizationFor={utilizationFor}
          onAddMember={addMember}
        />

        {members.length > 0 && (
          <div className={drawerStyles.selectedSection}>
            <div className={drawerStyles.selectedHeader}>
              <span className={drawerStyles.selectedTitle}>Selected Users</span>
              <button type="button" className={drawerStyles.clearAllBtn} onClick={clearAllMembers}>
                <Icon name="solar:close-circle-linear" size={12} color="var(--status-error)" />
                Clear All Selection
              </button>
            </div>
            {members.map(m => (
              <UserCard
                key={m.userId}
                member={m}
                teamType={teamType}
                showBillableCheck={kind === 'care-program' && TIMER_PROGRAM_CODES.includes(teamType)}
                priorUtilization={utilizationFor(m.userId)}
                breakdown={breakdownFor(m.userId)}
                usersForTin={usersForTin}
                tinAssignedPct={tinAssignedPct}
                staffAvailablePct={(uid) => Math.max(0, 100 - utilizationFor(uid))}
                onPatch={(patch) => patchMember(m.userId, patch)}
                onRemove={() => removeMember(m.userId)}
                onPatchAssignTo={(idx, patch) => patchAssignTo(m.userId, idx, patch)}
              />
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
