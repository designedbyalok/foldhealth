import { useEffect, useMemo, useState, useRef } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { useAppStore } from '../../store/useAppStore';
import { FALLBACK_USERS } from './fallbackUsers';
import { ASTRANA_STAFF, ROLE_LABEL } from '../hcc/assignment/astranaStaff';
import {
  TEAM_TYPE_OPTIONS,
  ASSIGN_TO_DIMENSIONS,
  KIND_LABEL,
  LEGACY_TIN_MAP,
  valueOptionsForDimension,
  capacityTone,
} from './teamTypeConfig';
import { HoverCard } from './HoverCard';
import hoverStyles from './HoverCard.module.css';

// System user pool — Settings → Account → Users merged with the Astrana
// HCC staff roster so HCC teams can pick the actual people who work the
// Support / Coder / Reviewer roles (which aren't in the generic profiles
// list). Deduped by id; Astrana wins on conflict because it carries the
// `tins` / `vendors` routing metadata.
const SYSTEM_USERS = (() => {
  const astrana = ASTRANA_STAFF.map(s => ({
    id: s.id,
    name: s.name,
    initials: s.initials,
    role: ROLE_LABEL[s.role] || s.role,
    status: s.active ? 'Active' : 'Inactive',
    source: 'astrana',
    tins: s.tins || [],
    vendors: s.vendors || [],
  }));
  const astranaIds = new Set(astrana.map(u => u.id));
  const account = [];
  for (const u of FALLBACK_USERS) {
    if (!astranaIds.has(u.id)) {
      account.push({ ...u, source: 'account', tins: [], vendors: [] });
    }
  }
  return [...astrana, ...account];
})();

import drawerStyles from './ConfigureTeamDrawer.module.css';

const NAME_MAX = 150;

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function todayMMDDYYYY() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

/**
 * ConfigureTeamDrawer — Figma 2609:12334.
 *
 * Props:
 *  - kind         'hcc' | 'care-program' | 'hedis'
 *  - editTeam     Optional existing team (from store) → drawer renders in
 *                 edit mode and prefills all fields.
 *  - onClose      function
 */
export function ConfigureTeamDrawer({ kind = 'hcc', editTeam = null, onClose }) {
  const addHccCareTeam = useAppStore(s => s.addHccCareTeam);
  const updateHccCareTeam = useAppStore(s => s.updateHccCareTeam);
  const existingTeams = useAppStore(s => s.hccCareTeams);

  const teamTypeOptions = TEAM_TYPE_OPTIONS[kind] || TEAM_TYPE_OPTIONS.hcc;
  const isEdit = !!editTeam;

  const [name, setName] = useState(editTeam?.name || '');
  const [teamType, setTeamType] = useState(editTeam?.teamType || teamTypeOptions[0]);
  // Team-level TIN allocation lives on member.assignTo rows (per-user TIN
  // routing) — no separate team-wide TIN picker. The legacy
  // editTeam.allocatedTins shape is preserved on save so existing data isn't
  // discarded if an admin later toggles the UI back.
  const allocatedTins = editTeam?.allocatedTins || [];
  const [members, setMembers] = useState(() => editTeam?.members || []);
  const [userSearch, setUserSearch] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef(null);

  // Re-fit Team Type if the kind prop ever changes (defensive — host typically
  // unmounts/remounts the drawer per kind).
  useEffect(() => {
    if (!teamTypeOptions.includes(teamType)) setTeamType(teamTypeOptions[0]);
  }, [teamTypeOptions, teamType]);

  // Close user-search dropdown on outside click.
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDoc = (e) => { if (!searchRef.current?.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [userMenuOpen]);

  // User picker — merged system users (Account → Users + Astrana HCC staff)
  // filtered by search query and excluding already-selected users.
  const selectedIds = new Set(members.map(m => m.userId));
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const result = [];
    for (const u of SYSTEM_USERS) {
      if (selectedIds.has(u.id)) continue;
      if (q
        && !u.name.toLowerCase().includes(q)
        && !(u.email || '').toLowerCase().includes(q)
        && !(u.role || '').toLowerCase().includes(q)) continue;
      result.push(u);
    }
    return result;
  }, [userSearch, members]);

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
    setUserSearch('');
    setUserMenuOpen(false);
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

  // Compute the user's total utilization — across committed teams PLUS
  // the live draft. This is what an admin needs to see to avoid
  // over-allocating the user globally. The breakdown popup lists the
  // contributions side-by-side (committed + "this team (draft)").
  const utilizationFor = (userId) => {
    let fromOtherTeams = 0;
    for (const t of existingTeams) {
      if (editTeam && t.id === editTeam.id) continue;
      for (const m of (t.members || [])) {
        if (m.userId === userId) fromOtherTeams += Number(m.capacityPct) || 0;
      }
    }
    const fromDraft = (members.find(m => m.userId === userId)?.capacityPct);
    return fromOtherTeams + (Number(fromDraft) || 0);
  };

  // Capacity breakdown by team — used by the Capacity Used hover popup.
  // Lists every team currently consuming this user's capacity, including a
  // pseudo-row for the in-progress draft so the math is transparent.
  const breakdownFor = (userId) => {
    const committed = [];
    for (const t of existingTeams) {
      if (editTeam && t.id === editTeam.id) continue;
      for (const m of (t.members || [])) {
        if (m.userId !== userId) continue;
        committed.push({
          teamName: t.name,
          teamType: t.teamType,
          pct: Number(m.capacityPct) || 0,
        });
      }
    }
    const draftMember = members.find(m => m.userId === userId);
    const draftPct = Number(draftMember?.capacityPct) || 0;
    if (draftPct > 0) {
      committed.push({
        teamName: `${name.trim() || 'This team'} (draft)`,
        teamType: teamType,
        pct: draftPct,
      });
    }
    return committed;
  };

  // Live TIN-utilization across all teams + the current draft. Replaces the
  // hardcoded TIN_DATA.assignedPct — admins see the true load on a TIN as
  // they allocate to it. We sum the pct values on Assign-To rows whose
  // dim=TIN and value=tin, capping at 100 for display sanity.
  const tinAssignedPct = (tin) => {
    if (!tin) return 0;
    let fromOtherTeams = 0;
    for (const t of existingTeams) {
      if (editTeam && t.id === editTeam.id) continue;
      for (const m of (t.members || [])) {
        for (const r of (m.assignTo || [])) {
          if (r.dim === 'TIN' && r.value === tin) fromOtherTeams += Number(r.pct) || 0;
        }
      }
    }
    let fromDraft = 0;
    for (const m of members) {
      for (const r of (m.assignTo || [])) {
        if (r.dim === 'TIN' && r.value === tin) fromDraft += Number(r.pct) || 0;
      }
    }
    return Math.min(100, fromOtherTeams + fromDraft);
  };

  // Users assigned to a given TIN (across all teams) — used by the
  // "Total Assigned Users" hover popup in each user's Assign-To section.
  const usersAssignedToTin = (tin) => {
    const result = [];
    for (const t of existingTeams) {
      for (const m of (t.members || [])) {
        let capacityPct = 0;
        let matched = false;
        for (const r of (m.assignTo || [])) {
          if (r.dim === 'TIN' && r.value === tin) {
            matched = true;
            capacityPct += Number(r.pct) || 0;
          }
        }
        if (!matched) continue;
        result.push({
          name: m.name,
          initials: m.initials,
          roles: m.roles,
          capacityPct,
        });
      }
    }
    return result;
  };

  // Block save if any member's Assign-To rows over-allocate their capacity.
  // (A user assigning 70% across rows when their capacity here is 50% is a
  // data-entry error — admins should resolve it before saving.)
  const anyOverAllocated = members.some(m => {
    const cap = Number(m.capacityPct) || 0;
    const sumPct = (m.assignTo || []).reduce((s, r) => s + (Number(r.pct) || 0), 0);
    return sumPct > cap;
  });
  const canSave =
    name.trim().length > 0 &&
    !!teamType &&
    members.length > 0 &&
    members.some(m => Number(m.capacityPct) > 0) &&
    !anyOverAllocated;

  const handleSave = () => {
    if (!canSave) return;
    const now = todayMMDDYYYY();
    const actor = 'You';
    const cleanMembers = members.map(m => {
      const assignTo = [];
      for (const r of (m.assignTo || [])) {
        if (!r.dim || !r.value) continue;
        assignTo.push({
          dim: r.dim,
          value: r.value,
          pct: Number(r.pct) || 0,
        });
      }
      return {
        ...m,
        capacityPct: Number(m.capacityPct) || 0,
        assignTo,
      };
    });
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
          <Button variant="primary" size="S" disabled={!canSave} onClick={handleSave}>Save</Button>
          <span className={drawerStyles.headerDivider} />
        </>
      }
    >
      <div className={drawerStyles.body}>
        {/* ── Team Name ── */}
        <div className={drawerStyles.field}>
          <label className={drawerStyles.label}>
            Team Name <span className={drawerStyles.required}>*</span>
          </label>
          <div className={drawerStyles.nameWrap}>
            <input
              type="text"
              className={drawerStyles.input}
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Compliance Team"
            />
            <span className={drawerStyles.charCounter}>
              {name.length}/{NAME_MAX}
            </span>
          </div>
        </div>

        {/* ── Team Type ── */}
        <div className={drawerStyles.field}>
          <label className={drawerStyles.label}>
            Team Type <span className={drawerStyles.required}>*</span>
          </label>
          <select
            className={drawerStyles.select}
            value={teamType}
            onChange={(e) => setTeamType(e.target.value)}
          >
            {teamTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        {/* ── Create Team With (searchable user picker) ── */}
        <div className={drawerStyles.field}>
          <label className={drawerStyles.label}>
            Create Team With <span className={drawerStyles.required}>*</span>
          </label>
          <div className={drawerStyles.userPickerWrap} ref={searchRef}>
            <input
              type="text"
              className={drawerStyles.input}
              placeholder="Search user to add in a team"
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setUserMenuOpen(true); }}
              onFocus={() => setUserMenuOpen(true)}
            />
            <Icon
              name="solar:alt-arrow-down-linear"
              size={12}
              color="var(--neutral-300)"
              className={drawerStyles.userPickerChevron}
            />
            {userMenuOpen && (
              <div className={drawerStyles.userMenu}>
                {filteredUsers.length === 0 ? (
                  <div className={drawerStyles.userMenuEmpty}>
                    {userSearch.trim() ? 'No matching users.' : 'All users already added.'}
                  </div>
                ) : filteredUsers.slice(0, 8).map(u => {
                  const used = utilizationFor(u.id);
                  const tone = capacityTone(used);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className={drawerStyles.userMenuItem}
                      onClick={() => addMember(u)}
                    >
                      <Avatar variant="assignee" initials={u.initials} />
                      <span className={drawerStyles.userMenuName}>{u.name}</span>
                      <span className={drawerStyles.userMenuRole}>{u.role}</span>
                      <span className={[hoverStyles.capChip, hoverStyles[`cap${tone[0].toUpperCase() + tone.slice(1)}`]].join(' ')}>
                        Capacity: {used}%
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Selected Users ── */}
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
                priorUtilization={utilizationFor(m.userId)}
                breakdown={breakdownFor(m.userId)}
                usersForTin={usersAssignedToTin}
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

/**
 * AssignValueSelect — custom dropdown for the Assign-To "value" column.
 * Replaces the native <select> so each dimension can render the right
 * kind of row:
 *   - TIN     → icon bubble + number + provider count + "Assigned: X%"
 *                (mirrors Figma 2609:12533, same look as Allocated TINs)
 *   - Staff   → avatar + name + role
 *   - Vendor  → plain text row
 *
 * Single-select. The trigger looks like an input field with a chevron
 * matching the dimension dropdown to its left.
 */
function AssignValueSelect({ dim, value, onChange, tinAssignedPct, staffAvailablePct }) {
  const rawOptions = valueOptionsForDimension(dim);
  // Replace each TIN option's stale assignedPct with the live value
  // computed from the draft + saved teams.
  const options = rawOptions.map(o =>
    o.kind === 'tin' && tinAssignedPct ? { ...o, assignedPct: tinAssignedPct(o.value) } : o,
  );
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find(o => o.value === value);
  const triggerLabel = selected ? selected.label : 'Select…';
  const isPlaceholder = !selected;

  return (
    <div className={drawerStyles.assignValueWrap} ref={wrapRef}>
      <button
        type="button"
        className={drawerStyles.assignValueTrigger}
        onClick={() => setOpen(v => !v)}
      >
        <span className={isPlaceholder ? drawerStyles.assignValuePlaceholder : drawerStyles.assignValueText}>
          {triggerLabel}
        </span>
        <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" />
      </button>
      {open && (
        <div className={drawerStyles.assignValueMenu}>
          {options.length === 0 ? (
            <div className={drawerStyles.userMenuEmpty}>No options.</div>
          ) : options.map(opt => {
            const isSelected = opt.value === value;
            const onPick = () => { onChange(opt.value); setOpen(false); };
            if (opt.kind === 'tin') {
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={drawerStyles.tinRow}
                  onClick={onPick}
                >
                  <span className={drawerStyles.tinIconBubble}>
                    <Icon name="solar:buildings-2-linear" size={14} color="var(--secondary-300)" />
                  </span>
                  <span className={drawerStyles.tinRowText}>
                    <span className={drawerStyles.tinRowNumber}>{opt.label}</span>
                    <span className={drawerStyles.tinRowProviders}>{opt.providers} Providers</span>
                  </span>
                  <span className={drawerStyles.tinRowAssigned}>Assigned: {opt.assignedPct}%</span>
                  {isSelected && (
                    <Icon name="solar:check-circle-bold" size={14} color="var(--primary-300)" />
                  )}
                </button>
              );
            }
            if (opt.kind === 'staff') {
              // Name on top, role underneath; available % chip on the right.
              const available = staffAvailablePct ? staffAvailablePct(opt.value) : null;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={drawerStyles.userMenuItem}
                  onClick={onPick}
                >
                  <Avatar variant="assignee" initials={opt.initials} />
                  <span className={drawerStyles.userMenuText}>
                    <span className={drawerStyles.userMenuName}>{opt.label}</span>
                    {opt.role && <span className={drawerStyles.userMenuRole}>{opt.role}</span>}
                  </span>
                  {available != null && (
                    <span className={drawerStyles.userMenuAvailable}>
                      Available: {available}%
                    </span>
                  )}
                  {isSelected && (
                    <Icon name="solar:check-circle-bold" size={14} color="var(--primary-300)" />
                  )}
                </button>
              );
            }
            // vendor / fallback — plain row
            return (
              <button
                key={opt.value}
                type="button"
                className={drawerStyles.vendorRow}
                onClick={onPick}
              >
                <span className={drawerStyles.vendorRowText}>{opt.label}</span>
                {isSelected && (
                  <Icon name="solar:check-circle-bold" size={14} color="var(--primary-300)" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── User card with nested Assign To rows ───────────────────────────────
function UserCard({ member, teamType, priorUtilization, breakdown = [], usersForTin, tinAssignedPct, staffAvailablePct, onPatch, onRemove, onPatchAssignTo }) {
  const dims = ASSIGN_TO_DIMENSIONS[teamType] || [];
  const capacity = Number(member.capacityPct) || 0;
  const totalAssigned = (member.assignTo || []).reduce((sum, r) => sum + (Number(r.pct) || 0), 0);
  // Allow negative — over-allocation is a real state admins need to see.
  const remaining = capacity - totalAssigned;
  const isOver = remaining < 0;
  const isGlobalOver = priorUtilization > 100;

  const addAssignRow = () => {
    onPatch({
      assignTo: [
        ...(member.assignTo || []),
        { dim: dims[0] || '', value: '', pct: 0 },
      ],
    });
  };
  const removeAssignRow = (idx) => {
    onPatch({ assignTo: (member.assignTo || []).filter((_, i) => i !== idx) });
  };

  return (
    <div className={drawerStyles.userCard}>
      <div className={drawerStyles.userCardHead}>
        <Avatar variant="assignee" initials={member.initials} />
        <div className={drawerStyles.userCardText}>
          <div className={drawerStyles.userCardName}>{member.name}</div>
          {member.roles && <div className={drawerStyles.userCardMeta}>{member.roles}</div>}
          <HoverCard
            placement="top"
            content={
              <>
                <div className={hoverStyles.cardTitle}>Capacity Breakdown</div>
                {breakdown.length === 0 ? (
                  <div className={hoverStyles.breakdownRow}>
                    <span className={hoverStyles.breakdownRole}>No other allocations.</span>
                  </div>
                ) : breakdown.map((b, i) => (
                  <div key={i} className={hoverStyles.breakdownRow}>
                    <div className={hoverStyles.breakdownLabel}>
                      <span className={hoverStyles.breakdownTeam}>{b.teamName}</span>
                      <span className={hoverStyles.breakdownRole}>(Role: {b.teamType})</span>
                    </div>
                    <span className={hoverStyles.breakdownPct}>{b.pct}%</span>
                  </div>
                ))}
              </>
            }
          >
            <span className={[drawerStyles.userCardMetaHover, isGlobalOver ? drawerStyles.assignNumOver : ''].join(' ')}>
              Capacity Used: {priorUtilization}%
            </span>
          </HoverCard>
        </div>
        <div className={drawerStyles.capacityWrap}>
          <input
            type="number"
            min={0} max={100}
            className={drawerStyles.capacityInput}
            value={member.capacityPct}
            onChange={(e) => onPatch({ capacityPct: e.target.value })}
          />
          <span className={drawerStyles.capacityPct}>%</span>
        </div>
        <CloseButton size={14} onClick={onRemove} className={drawerStyles.userRemoveBtn} label="Remove" />
      </div>

      {/* Assign To */}
      <div className={drawerStyles.assignToSection}>
        <div className={drawerStyles.assignToLabel}>Assign To</div>
        {(member.assignTo || []).map((row, i) => (
          <div key={i} className={drawerStyles.assignRow}>
            <select
              className={drawerStyles.assignDim}
              value={row.dim || dims[0] || ''}
              onChange={(e) => onPatchAssignTo(i, { dim: e.target.value, value: '' })}
            >
              {dims.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <AssignValueSelect
              dim={row.dim || dims[0]}
              value={row.value}
              onChange={(v) => onPatchAssignTo(i, { value: v })}
              tinAssignedPct={tinAssignedPct}
              staffAvailablePct={staffAvailablePct}
            />
            <div className={drawerStyles.assignPctWrap}>
              <input
                type="number"
                min={0} max={100}
                className={drawerStyles.assignPctInput}
                value={row.pct}
                onChange={(e) => onPatchAssignTo(i, { pct: e.target.value })}
              />
              <span className={drawerStyles.assignPctSuffix}>%</span>
            </div>
            <button type="button" className={drawerStyles.assignTrash} onClick={() => removeAssignRow(i)} aria-label="Remove row">
              <Icon name="solar:trash-bin-trash-linear" size={14} color="var(--neutral-300)" />
            </button>
          </div>
        ))}
        {(member.assignTo || []).length > 0 && (() => {
          // Aggregate users across every TIN this user is assigned to,
          // so the hover shows ALL teammates touching the same TIN buckets.
          const tinValues = [];
          const tinSeen = new Set();
          for (const r of (member.assignTo || [])) {
            if (r.dim !== 'TIN' || !r.value || tinSeen.has(r.value)) continue;
            tinSeen.add(r.value);
            tinValues.push(r.value);
          }
          const headerTin = tinValues[0] || '';
          const rows = [];
          for (const t of tinValues) {
            for (const u of (usersForTin?.(t) || [])) {
              rows.push({ ...u, tin: t });
            }
          }
          return (
            <HoverCard
              placement="top"
              content={
                <>
                  <div className={hoverStyles.cardTitle}>
                    {headerTin
                      ? <>Users assigned to TIN: <strong>{headerTin}</strong></>
                      : 'Users assigned to this allocation'}
                  </div>
                  {rows.length === 0 ? (
                    <div className={hoverStyles.userRowRole}>No users assigned to this TIN yet.</div>
                  ) : rows.map((u, i) => (
                    <div key={i} className={hoverStyles.userRow}>
                      <Avatar variant="assignee" initials={u.initials} />
                      <div className={hoverStyles.userRowText}>
                        <span className={hoverStyles.userRowName}>{u.name}</span>
                        {u.roles && <span className={hoverStyles.userRowRole}>{u.roles}</span>}
                      </div>
                      <span className={[hoverStyles.capChip, hoverStyles.capNeutral].join(' ')}>
                        Capacity: {u.capacityPct}%
                      </span>
                    </div>
                  ))}
                </>
              }
            >
              <span className={drawerStyles.assignTotalHover}>
                Total Assigned: {totalAssigned}%
              </span>
            </HoverCard>
          );
        })()}
        <div className={drawerStyles.assignFooter}>
          <button type="button" className={drawerStyles.addMoreBtn} onClick={addAssignRow} disabled={dims.length === 0}>
            <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
            Add More
          </button>
          <span className={drawerStyles.assignSummary}>
            <strong>Total Assigned:</strong>{' '}
            <span className={isOver ? drawerStyles.assignNumOver : undefined}>{totalAssigned}%</span>
            <span className={drawerStyles.assignSummaryDivider}>|</span>
            <strong>Remaining:</strong>{' '}
            <span className={isOver ? drawerStyles.assignNumOver : drawerStyles.assignNumOk}>
              {remaining}%
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
