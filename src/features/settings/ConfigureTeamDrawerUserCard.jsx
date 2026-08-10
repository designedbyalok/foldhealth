import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { ASSIGN_TO_DIMENSIONS } from './teamTypeConfig';
import { HoverCard } from './HoverCard';
import hoverStyles from './HoverCard.module.css';
import drawerStyles from './ConfigureTeamDrawer.module.css';
import { AssignValueSelect } from './ConfigureTeamDrawerAssignValueSelect';

// ── User card with nested Assign To rows ───────────────────────────────
export function UserCard({ member, teamType, priorUtilization, breakdown = [], usersForTin, tinAssignedPct, staffAvailablePct, onPatch, onRemove, onPatchAssignTo }) {
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
            aria-label="Capacity percent"
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
              aria-label="Assignment dimension"
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
                aria-label="Assignment percent"
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
