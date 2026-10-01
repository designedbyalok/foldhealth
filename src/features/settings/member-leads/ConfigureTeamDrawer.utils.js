export const NAME_MAX = 150;

export function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function todayMMDDYYYY() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

export function utilizationFor(userId, { existingTeams, editTeam, members }) {
  let fromOtherTeams = 0;
  for (const t of existingTeams) {
    if (editTeam && t.id === editTeam.id) continue;
    for (const m of (t.members || [])) {
      if (m.userId === userId) fromOtherTeams += Number(m.capacityPct) || 0;
    }
  }
  const fromDraft = members.find(m => m.userId === userId)?.capacityPct;
  return fromOtherTeams + (Number(fromDraft) || 0);
}

export function breakdownFor(userId, { existingTeams, editTeam, members, name, teamType }) {
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
      teamType,
      pct: draftPct,
    });
  }
  return committed;
}

export function tinAssignedPct(tin, { existingTeams, editTeam, members }) {
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
}

export function usersAssignedToTin(tin, existingTeams) {
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
}

export function cleanMembersForSave(members) {
  return members.map(m => {
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
}

export function canSaveTeam({ name, teamType, members }) {
  const anyOverAllocated = members.some(m => {
    const cap = Number(m.capacityPct) || 0;
    const sumPct = (m.assignTo || []).reduce((s, r) => s + (Number(r.pct) || 0), 0);
    return sumPct > cap;
  });
  return (
    name.trim().length > 0 &&
    !!teamType &&
    members.length > 0 &&
    members.some(m => Number(m.capacityPct) > 0) &&
    !anyOverAllocated
  );
}
