import { MenuPopover } from '../../../../../../components/MenuPopover/MenuPopover';
import { PROGRAM_STATUS_OPTIONS } from '../../../../data/programStatus';
import { ROW_MENU_ITEMS } from './CareProgramsTab.utils';

export function CareProgramsTabMenus({ statusMenu, setStatusMenu, rowMenu, setRowMenu, visible, changeStatus, handleRowAction }) {
  return (
    <>
      {statusMenu && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align="left"
          width={180}
          ariaLabel="Change status"
          items={PROGRAM_STATUS_OPTIONS.map(s => ({
            key: s,
            label: <span style={{ color: 'var(--neutral-400)' }}>{s}</span>,
          }))}
          onSelect={(status) => {
            const program = visible.find(p => p.id === statusMenu.id);
            if (program) changeStatus(program, status);
          }}
          onClose={() => setStatusMenu(null)}
        />
      )}
      {rowMenu && (
        <MenuPopover
          anchorRect={rowMenu.rect}
          align="right"
          width={180}
          ariaLabel="Program actions"
          items={ROW_MENU_ITEMS}
          onSelect={(key) => {
            const program = visible.find(p => p.id === rowMenu.id);
            if (program) handleRowAction(key, program);
          }}
          onClose={() => setRowMenu(null)}
        />
      )}
    </>
  );
}
