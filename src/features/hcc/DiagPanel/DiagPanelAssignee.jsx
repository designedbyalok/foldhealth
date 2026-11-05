import { Icon } from '../../../components/Icon/Icon';
import { AssigneeChange } from '../../../components/AssigneeChange/AssigneeChange';
import { RoleTooltip } from '../RoleTooltip';
import { RoleAssigneePicker } from '../RoleAssigneePicker';
import { ROLE_LABEL } from '../assignment/astranaStaff';
import { resolveCurrentAssignee } from '../HccWorklistRow.utils';

function UnassignedAssignTrigger({ role, memberId, dosDate }) {
  return (
    <RoleAssigneePicker
      role={role}
      memberId={memberId}
      dosDate={dosDate}
      align="right"
      reason="Assigned from DiagPanel"
      trigger={({ ref, onClick }) => (
        <RoleTooltip
          name="Unassigned"
          role={`Awaiting ${ROLE_LABEL[role] || role}: click to assign`}
          initials="-"
          variant="staff"
        >
          <AssigneeChange
            ref={ref}
            avatarOnly
            unassigned
            onClick={onClick}
            ariaLabel={`Assign ${ROLE_LABEL[role] || role}`}
          />
        </RoleTooltip>
      )}
    />
  );
}

export function AssigneeAvatar({ member, dosState, currentDos, locked = false, billed = false }) {
  const a = resolveCurrentAssignee(member, dosState);
  if (!a) return null;
  // Post-billing terminal state: same lock semantics as rejected but a
  // green Billed chip in place of the greyed assignee tile.
  if (billed || a.kind === 'billed') {
    return (
      <RoleTooltip name="Billed" role="Record submitted & billed" initials="$" variant="staff">
        <span
          title="Billed: record is read-only"
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'var(--status-success-light)',
            border: '0.5px solid rgba(0, 155, 83, 0.3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: 'var(--status-success)',
          }}
        >
          <Icon name="solar:dollar-linear" size={14} color="var(--status-success)" />
        </span>
      </RoleTooltip>
    );
  }
  if (a.kind === 'unassigned') {
    if (locked) {
      return (
        <span
          title="Rejected: assignee is locked"
          style={{
            width: 24, height: 24, borderRadius: 6,
            border: '1px dashed var(--neutral-200)',
            background: 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: 'var(--neutral-200)',
          }}
        >
          <Icon name="solar:user-plus-linear" size={12} color="var(--neutral-200)" />
        </span>
      );
    }
    return <UnassignedAssignTrigger role={a.role} memberId={member?.id} dosDate={currentDos} />;
  }

  if (a.kind === 'billing') {
    return (
      <RoleTooltip name="Billing Ready" role="All reviews complete" initials="✓" variant="staff">
        <span
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'var(--status-success-light)',
            border: '0.5px solid rgba(0, 155, 83, 0.3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: 'var(--status-success)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <Icon name="solar:check-circle-bold" size={14} color="var(--status-success)" />
        </span>
      </RoleTooltip>
    );
  }

  if (locked) {
    return (
      <RoleTooltip
        name={a.name}
        role={ROLE_LABEL[a.role] || a.role}
        initials={a.initials}
        variant="staff"
      >
        <span
          title={`${a.name}, assignee locked (record Rejected)`}
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'var(--secondary-100)', border: '0.5px solid var(--secondary-200)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 'var(--font-2xs)', fontWeight: 500, color: 'var(--secondary-300)',
            cursor: 'default', padding: 0,
          }}
        >
          {a.initials}
        </span>
      </RoleTooltip>
    );
  }
  return (
    <RoleAssigneePicker
      role={a.role}
      memberId={member?.id}
      dosDate={currentDos}
      currentName={a.name}
      align="right"
      reason="Reassigned from DiagPanel"
      trigger={({ ref, onClick }) => (
        <RoleTooltip
          name={a.name}
          role={ROLE_LABEL[a.role] || a.role}
          initials={a.initials}
          variant="staff"
        >
          {/* `name`/`role` intentionally omitted on AssigneeChange so its
              internal avatar-only tooltip stays quiet: the wrapping
              RoleTooltip already carries the hover card, and firing both
              would render two tips over the same trigger. */}
          <AssigneeChange
            ref={ref}
            avatarOnly
            initials={a.initials}
            onClick={onClick}
            ariaLabel={`Change ${ROLE_LABEL[a.role] || a.role} assignee (currently ${a.name})`}
          />
        </RoleTooltip>
      )}
    />
  );
}
