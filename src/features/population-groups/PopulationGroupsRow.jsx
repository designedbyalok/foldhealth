import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Avatar } from '../../components/Avatar/Avatar';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { GroupName, UsersGroupRoundedLinear } from './PopulationGroupsViewPanels.jsx';
import styles from './PopulationGroupsRow.module.css';

/**
 * Single Population Groups row rendered inside WorklistShell. Base styling
 * comes from PopulationGroupsRow.module.css, which composes the shared
 * WorklistRow classes so this table matches TOC / AWV / HCC (row divider,
 * hover tint, sticky checkbox + name on the left, sticky actions on the
 * right, L-size action buttons with dividers).
 */
export function PopulationGroupsRow({ group, selected, onToggle, onEdit }) {
  return (
    <tr className={[styles.row, selected ? styles.rowSelected : ''].filter(Boolean).join(' ')}>
      {/* Sticky-left checkbox */}
      <td className={`${styles.checkTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select ${group.name}`}
        />
      </td>

      {/* Sticky-left group name + avatar */}
      <td className={`${styles.membersTd} ${styles.stickyLeft}`} style={{ left: 36 }}>
        <div className={styles.groupCell}>
          <Avatar variant="patient" initials={<UsersGroupRoundedLinear size={16} color="var(--primary-300)" />} />
          <GroupName name={group.name} />
        </div>
      </td>

      {/* Active members */}
      <td className={styles.td}>{group.count != null ? group.count : '–'}</td>

      {/* Inactive members */}
      <td className={styles.td}>{group.inactive != null ? group.inactive : '–'}</td>

      {/* Type */}
      <td className={styles.td}>{group.type}</td>

      {/* Created / updated dates */}
      <td className={styles.td}>{group.created}</td>
      <td className={styles.td}>{group.updated}</td>

      {/* Actions — sticky-right, L-size buttons with dividers */}
      <td className={`${styles.td} ${styles.stickyRight}`}>
        <div className={styles.actionsCell}>
          <ActionButton icon="solar:bolt-linear" size="L" tooltip="Run Automation" />
          <span className={styles.actionDivider} />
          <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit Group" onClick={onEdit} />
          <span className={styles.actionDivider} />
          <ActionButton icon="solar:trash-bin-minimalistic-linear" size="L" tooltip="Delete Group" />
          <span className={styles.actionDivider} />
          <ActionButton icon="solar:menu-dots-linear" size="L" tooltip="More Options" />
        </div>
      </td>
    </tr>
  );
}
