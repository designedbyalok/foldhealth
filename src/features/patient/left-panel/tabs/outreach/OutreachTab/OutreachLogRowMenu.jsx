import { useRef, useState } from 'react';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../../../../components/MenuPopover/MenuPopover';
import styles from './OutreachTab.module.css';

/** An outreach log's Edit / Delete overflow menu. */
export function LogRowMenu({ log, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  // A locked call (e.g. a pharmacy verification) is one fixed record.
  if ((!onEdit && !onDelete) || log.locked) return null;
  const items = [
    ...(onEdit ? [{ key: 'edit', icon: 'solar:pen-2-linear', label: 'Edit' }] : []),
    ...(onDelete ? [{ key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true }] : []),
  ];
  return (
    <span className={styles.logRowMenuWrap}>
      <ActionButton
        ref={btnRef}
        icon="solar:menu-dots-linear"
        size="sm"
        tooltip="More actions"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
      />
      {open && (
        <MenuPopover
          anchorRef={btnRef}
          items={items}
          onSelect={(key) => { if (key === 'edit') onEdit(log); else onDelete(log); }}
          onClose={() => setOpen(false)}
          width={140}
          ariaLabel="Log actions"
        />
      )}
    </span>
  );
}
