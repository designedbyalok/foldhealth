import { Avatar } from '../../../components/Avatar/Avatar';
import { Select } from '../../../components/Select/Select';
import { Input } from '../../../components/Input/Input';
import { capacityTone } from './teamTypeConfig';
import { NAME_MAX } from './ConfigureTeamDrawer.utils';
import hoverStyles from './HoverCard.module.css';
import drawerStyles from './ConfigureTeamDrawer.module.css';

export function ConfigureTeamDrawerUserPicker({ availableUsers, utilizationFor, onAddMember }) {
  const options = availableUsers.map(u => {
    const available = Math.max(0, 100 - utilizationFor(u.id));
    const tone = capacityTone(available);
    return {
      value: u.id,
      searchText: [u.name, u.email, u.role].filter(Boolean).join(' '),
      label: (
        <span className={drawerStyles.userOption}>
          <Avatar variant="assignee" initials={u.initials} />
          <span className={drawerStyles.userMenuText}>
            <span className={drawerStyles.userMenuName}>{u.name}</span>
            <span className={drawerStyles.userMenuRole}>{u.role}</span>
          </span>
          <span className={[hoverStyles.capChip, hoverStyles[`cap${tone[0].toUpperCase() + tone.slice(1)}`]].join(' ')}>
            Capacity: {available}%
          </span>
        </span>
      ),
    };
  });
  return (
    <Select
      label="Create Team With"
      required
      options={options}
      value={null}
      onChange={(id) => {
        const user = availableUsers.find(u => u.id === id);
        if (user) onAddMember(user);
      }}
      placeholder="Search user to add in a team"
      searchable
      searchPlaceholder="Search by name, email or role"
      emptyText="No matching users."
    />
  );
}

export function ConfigureTeamDrawerBasicFields({ name, teamType, teamTypeOptions, onNameChange, onTeamTypeChange }) {
  return (
    <>
      <Input
        label="Team Name"
        required
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="e.g. Compliance Team"
        maxLength={NAME_MAX}
        characterLimit={NAME_MAX}
      />
      <Select
        label="Team Type"
        required
        options={teamTypeOptions.map(opt => ({ value: opt, label: opt }))}
        value={teamType}
        onChange={onTeamTypeChange}
      />
    </>
  );
}
