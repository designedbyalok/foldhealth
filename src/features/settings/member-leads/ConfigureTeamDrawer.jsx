import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Banner } from '../../../components/Banner/Banner';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { activeOooFor } from '../../ooo/oooUtils';
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

  // Team members out of office now: auto-assignment skips them until they're back.
  const oooRecords = useAppStore(s => s.oooRecords);
  const awayMembers = useMemo(() => members
    .map(m => ({ userId: m.userId, name: m.name, record: activeOooFor(oooRecords, { id: m.userId || null, name: m.name }) }))
    .filter(x => x.record), [members, oooRecords]);
  const mdY = (v) => { const d = new Date(v); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`; };
  const awayDates = (r) => `${mdY(r.startAt)} – ${mdY(r.endAt)}`;
  const awayById = new Map(awayMembers.map(x => [x.userId, x.record]));

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
      <div className={awayMembers.length ? `${drawerStyles.body} ${drawerStyles.bodyBanner}` : drawerStyles.body}>
        {awayMembers.length > 0 && (
          <Banner tone="info" size="sm">
            {awayMembers.length === 1 ? (
              `${awayMembers[0].name} is out of office until ${mdY(awayMembers[0].record.endAt)} and is skipped from auto-assignment.`
            ) : (
              <>
                {/* Several: the count, with who and when on hover. */}
                <Tooltip
                  label={(
                    <span className={drawerStyles.awayList}>
                      {awayMembers.map(x => <span key={x.userId || x.name}>{x.name} • {awayDates(x.record)}</span>)}
                    </span>
                  )}
                  placement="bottom"
                  align="left"
                  maxWidth={320}
                >
                  <span className={drawerStyles.awayCount}>{awayMembers.length} users</span>
                </Tooltip>
                {' '}are out of office and skipped from auto-assignment until they&apos;re back.
              </>
            )}
          </Banner>
        )}
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
                outOfOffice={awayById.has(m.userId) ? awayDates(awayById.get(m.userId)) : null}
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
