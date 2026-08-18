import { useState } from 'react';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Avatar } from '../../components/Avatar/Avatar';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { GroupName, UsersGroupRoundedLinear } from './PopulationGroupsViewPanels.jsx';
import styles from './PopulationGroupsRow.module.css';

// Destructive and rarely-reached actions live behind the ⋯ menu, so the
// always-visible row keeps only Run Automation and Edit.
const MORE_ITEMS = [
  { key: 'download', icon: 'solar:download-minimalistic-linear', label: 'Download member list' },
  { key: 'delete', icon: 'solar:trash-bin-minimalistic-linear', label: 'Delete Group', danger: true },
];

/**
 * Single Population Groups row rendered inside WorklistShell. Base styling
 * comes from PopulationGroupsRow.module.css, which composes the shared
 * WorklistRow classes so this table matches TOC / AWV / HCC (row divider,
 * hover tint, sticky checkbox + name on the left, sticky actions on the
 * right, L-size action buttons with dividers).
 */
export function PopulationGroupsRow({ group, columns, hiddenSet, selected, onToggle, onEdit, onDelete, onDownload, onRowClick }) {
  const [moreAnchor, setMoreAnchor] = useState(null);

  // Middle columns come from the shared column defs so hide/reorder in the
  // Show Columns popover ripple through the body. `columns` (from
  // WorklistShell's row ctx) contains sticky-left + middle + sticky-right in
  // display order; sticky cells stay hardcoded below and only the
  // customisable middle band is iterated.
  const middleCols = (columns || []).filter(c => !c.sticky && !c.showCheckbox && c.renderCell);
  const visibleMiddle = hiddenSet ? middleCols.filter(c => !hiddenSet.has(c.key)) : middleCols;

  return (
    <tr
      className={[styles.row, selected ? styles.rowSelected : '', onRowClick ? styles.rowClickable : ''].filter(Boolean).join(' ')}
      onClick={onRowClick}
    >
      {/* Sticky-left checkbox */}
      <td className={`${styles.checkTd} ${styles.stickyLeft}`} style={{ left: 0 }} onClick={(e) => e.stopPropagation()}>
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

      {visibleMiddle.map(col => (
        <td key={col.key} data-col-key={col.key} className={styles.td}>
          {col.renderCell(group)}
        </td>
      ))}

      {/* Actions — sticky-right, L-size buttons with dividers */}
      <td className={`${styles.td} ${styles.stickyRight}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.actionsCell}>
          <ActionButton icon="solar:bolt-linear" size="L" tooltip="Run Automation" />
          <span className={styles.actionDivider} />
          <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit Group" onClick={onEdit} />
          <span className={styles.actionDivider} />
          <ActionButton
            icon="solar:menu-dots-linear"
            size="L"
            tooltip="More Options"
            onClick={(e) => setMoreAnchor(e.currentTarget)}
          />
        </div>
        {moreAnchor && (
          <MenuPopover
            anchorRef={{ current: moreAnchor }}
            items={MORE_ITEMS}
            width={220}
            ariaLabel={`More actions for ${group.name}`}
            onSelect={(key) => {
              setMoreAnchor(null);
              if (key === 'download') onDownload?.();
              if (key === 'delete') onDelete?.();
            }}
            onClose={() => setMoreAnchor(null)}
          />
        )}
      </td>
    </tr>
  );
}
