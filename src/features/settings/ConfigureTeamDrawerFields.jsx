import { useId } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Avatar } from '../../components/Avatar/Avatar';
import { capacityTone } from './teamTypeConfig';
import hoverStyles from './HoverCard.module.css';
import drawerStyles from './ConfigureTeamDrawer.module.css';

export function ConfigureTeamDrawerUserPicker({
  searchRef,
  userSearch,
  userMenuOpen,
  filteredUsers,
  utilizationFor,
  onSearchChange,
  onFocus,
  onAddMember,
}) {
  const uid = useId();
  return (
    <div className={drawerStyles.field}>
      <label className={drawerStyles.label} htmlFor={`${uid}-user-search`}>
        Create Team With <span className={drawerStyles.required}>*</span>
      </label>
      <div className={drawerStyles.userPickerWrap} ref={searchRef}>
        <input
          id={`${uid}-user-search`}
          type="text"
          className={drawerStyles.input}
          placeholder="Search user to add in a team"
          value={userSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onFocus}
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
                  onClick={() => onAddMember(u)}
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
  );
}

export function ConfigureTeamDrawerBasicFields({ name, teamType, teamTypeOptions, onNameChange, onTeamTypeChange }) {
  const uid = useId();
  return (
    <>
      <div className={drawerStyles.field}>
        <label className={drawerStyles.label} htmlFor={`${uid}-team-name`}>
          Team Name <span className={drawerStyles.required}>*</span>
        </label>
        <div className={drawerStyles.nameWrap}>
          <input
            id={`${uid}-team-name`}
            type="text"
            className={drawerStyles.input}
            value={name}
            maxLength={150}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Compliance Team"
          />
          <span className={drawerStyles.charCounter}>{name.length}/150</span>
        </div>
      </div>

      <div className={drawerStyles.field}>
        <label className={drawerStyles.label} htmlFor={`${uid}-team-type`}>
          Team Type <span className={drawerStyles.required}>*</span>
        </label>
        <select
          id={`${uid}-team-type`}
          className={drawerStyles.select}
          value={teamType}
          onChange={(e) => onTeamTypeChange(e.target.value)}
        >
          {teamTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    </>
  );
}
