import { useMemo, useState } from 'react';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { AvatarGroup } from '../../components/AvatarGroup/AvatarGroup';
import { BulkBar } from '../../components/BulkBar/BulkBar';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { CollapseAllIcon } from '../../components/Icon/CollapseAllIcon';
import { ExpandAllIcon } from '../../components/Icon/ExpandAllIcon';
import { UserPickerPopover } from '../../components/UserPickerPopover/UserPickerPopover';
import { initialsOf } from './oooUtils';
import { byDepartment, NO_DEPARTMENT } from './openWork';
import { DeptGroup } from './ReassignParts';
import ooo from './ooo.module.css';
import styles from './reassign.module.css';

const checkState = (ids, selected) => {
  const n = ids.filter(id => selected.has(id)).length;
  return n === 0 ? false : n === ids.length ? true : 'indeterminate';
};

/**
 * Reassign Appointments' planner for any other kind of open work (tasks,
 * care programs): items by department (`location`), a covering provider for
 * a whole department or one item, Select All and bulk Reassign. Nothing
 * changes until the caller saves the plan (item id → { action: 'reassign',
 * to, toId }).
 *
 * @param {object}   props
 * @param {object[]} props.items       – Each with an `id` and `location` (department)
 * @param {function} props.renderMain  – (item) => the row's content (a task row,
 *   a care program row), between the checkbox and the assignee
 * @param {function} props.titleOf     – (item) => its name, for labels
 * @param {string}   props.noun        – "Task", "Program" (singular)
 * @param {string}   props.icon        – Solar icon for the empty state
 * @param {function} props.usersFor    – (department | null) => UserPickerPopover users,
 *   those who work there first
 * @param {object}   props.plan
 * @param {function} props.onPlan      – (updater: plan => plan) => void
 */
export function ReassignItemsPlanner({ items, renderMain, titleOf, noun, icon, usersFor, plan, onPlan }) {
  const [view, setView] = useState('collapsed');
  const [selected, setSelected] = useState(() => new Set());
  const [picker, setPicker] = useState(null); // { rect, ids, dept? }
  const [menu, setMenu] = useState(null);     // { rect, ids }

  const groups = useMemo(() => byDepartment(items), [items]);
  const deptOf = (id) => items.find(i => i.id === id)?.location;

  const assign = (ids, u) => onPlan(p => { const n = { ...p }; ids.forEach(id => { n[id] = { action: 'reassign', to: u.name, toId: u.realId || null }; }); return n; });
  const clear = (ids) => onPlan(p => { const n = { ...p }; ids.forEach(id => { delete n[id]; }); return n; });
  const toggle = (ids, on) => setSelected(s => { const n = new Set(s); ids.forEach(id => (on ? n.add(id) : n.delete(id))); return n; });
  const selectedIds = [...selected].filter(id => items.some(i => i.id === id));

  const keyOf = (p) => p?.toId || p?.to;
  const openPicker = (e, ids) => {
    const picked = [...new Set(ids.map(id => keyOf(plan[id])).filter(Boolean))];
    const depts = [...new Set(ids.map(deptOf))];
    setPicker({ rect: e.currentTarget.getBoundingClientRect(), ids, dept: depts.length === 1 ? depts[0] : null, selected: picked.length === 1 ? picked[0] : undefined });
  };

  const assigneeFor = (ids, label) => {
    const names = [...new Set(ids.filter(id => plan[id]?.action === 'reassign').map(id => plan[id].to))];
    if (names.length > 1) {
      return (
        <button type="button" className={ooo.assigneePicker} onClick={(e) => openPicker(e, ids)} aria-label={`Covering providers for ${label}`}>
          <AvatarGroup people={names.map(n => ({ name: n, initials: initialsOf(n) }))} variant="staff" size="XS" max={3} />
        </button>
      );
    }
    return (
      <AssigneeChange
        avatarOnly
        size="S"
        unassigned={!names.length}
        name={names[0]}
        initials={names[0] ? initialsOf(names[0]) : undefined}
        ariaLabel={names[0] ? `Covering provider: ${names[0]}` : `Pick a covering provider for ${label}`}
        onClick={(e) => openPicker(e, ids)}
      />
    );
  };
  // More Options, as on Reassign Appointments' rows: Clear sends the items
  // back to the away user (nothing reassigned).
  const more = (ids) => (
    <ActionButton
      icon="solar:menu-dots-linear"
      size="sm"
      tooltip="More Options"
      tooltipLeft
      aria-label="More options"
      onClick={(e) => setMenu({ rect: e.currentTarget.getBoundingClientRect(), ids })}
    />
  );
  const controls = (ids, label) => (
    <span className={styles.controls}>
      {assigneeFor(ids, label)}
      {more(ids)}
    </span>
  );
  const box = (ids, label) => (
    <Checkbox checked={checkState(ids, selected)} onCheckedChange={(v) => toggle(ids, v === true)} aria-label={label} />
  );

  if (!items.length) {
    return (
      <div className={styles.planner}>
        <div className={ooo.providersEmpty}>
          <EmptyState size="sm" icon={icon} title={`No open ${noun.toLowerCase()}s to reassign for these dates`} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.planner}>
      <div className={styles.plannerHead}>
        <span className={styles.plannerTitle}>Select Covering Providers</span>
        <span className={styles.plannerTools}>
          <span className={ooo.viewToggle} role="group" aria-label="View">
            <ActionButton tooltip="Collapse All" className={view === 'collapsed' ? ooo.viewToggleOn : undefined} aria-pressed={view === 'collapsed'} onClick={() => setView('collapsed')}>
              <CollapseAllIcon size={20} color="var(--neutral-300)" />
            </ActionButton>
            <ActionButton tooltip="Expand All" tooltipLeft className={view === 'expanded' ? ooo.viewToggleOn : undefined} aria-pressed={view === 'expanded'} onClick={() => setView('expanded')}>
              <ExpandAllIcon size={20} color="var(--neutral-300)" />
            </ActionButton>
          </span>
        </span>
      </div>
      <label className={styles.selectAll}>{box(items.map(i => i.id), 'Select all')}Select All</label>
      <div className={styles.list}>
        {groups.map(g => {
          const ids = g.items.map(i => i.id);
          return (
            <DeptGroup
              key={g.name}
              noun={noun}
              defaultOpen={view === 'expanded'}
              title={g.name}
              count={ids.length}
              lead={box(ids, `Select ${g.name}`)}
              controls={controls(ids, g.name)}
              items={g.items}
              renderItem={(it) => (
                <div key={it.id} className={styles.apptRow}>
                  <div className={styles.apptMain}>
                    {box([it.id], `Select ${titleOf(it)}`)}
                    {renderMain(it)}
                    <span className={styles.apptTrail}>{controls([it.id], titleOf(it))}</span>
                  </div>
                </div>
              )}
            />
          );
        })}
      </div>

      <BulkBar
        className={styles.bulkInDrawer}
        selectedIds={selectedIds}
        onClear={() => setSelected(new Set())}
        noun={`${noun}s`}
        actions={selectedIds.length ? [{
          label: 'Reassign',
          icon: 'solar:user-plus-rounded-linear',
          onClick: (ids, e) => {
            const depts = [...new Set(ids.map(deptOf))];
            setPicker({ rect: e.currentTarget.getBoundingClientRect(), ids, dept: depts.length === 1 ? depts[0] : null, clearSelection: true });
          },
        }] : []}
      />

      {picker && (
        <UserPickerPopover
          anchorRect={picker.rect}
          align="right"
          width={350}
          title="Select Provider"
          titleCaseSections
          users={usersFor(picker.dept && picker.dept !== NO_DEPARTMENT ? picker.dept : null)}
          selected={picker.selected}
          onSelect={(u) => { assign(picker.ids, u); if (picker.clearSelection) setSelected(new Set()); }}
          onUnassign={picker.selected ? () => clear(picker.ids) : undefined}
          onClose={() => setPicker(null)}
        />
      )}
      {menu && (
        <MenuPopover
          anchorRect={menu.rect}
          align="right"
          items={[{ key: 'clear', label: 'Clear', icon: 'solar:eraser-linear', disabled: !menu.ids.some(id => plan[id]) }]}
          onSelect={(key) => { if (key === 'clear') clear(menu.ids); setMenu(null); }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
