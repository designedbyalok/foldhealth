import { useState } from 'react';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { AvatarGroup } from '../../components/AvatarGroup/AvatarGroup';
import { BulkBar } from '../../components/BulkBar/BulkBar';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { UserPickerPopover } from '../../components/UserPickerPopover/UserPickerPopover';
import { PRIORITY_ORDER, PRIORITY_LABELS } from '../tasks/TasksView.utils';
import { initialsOf } from './oooUtils';
import { DeptGroup } from './ReassignParts';
import { NO_DEPARTMENT } from './openWork';
import ooo from './ooo.module.css';
import styles from './reassign.module.css';

// Tasks group by status (Missed first, then Pending) or by priority (High
// first, no priority last).
const STATUS_GROUPS = [{ key: 'missed', name: 'Missed' }, { key: 'pending', name: 'Pending' }];
const statusOf = (it) => (it.status === 'missed' ? 'missed' : 'pending');
const priorityOf = (it) => {
  const p = String(it.priority || 'none').toLowerCase();
  return PRIORITY_ORDER.includes(p) ? p : 'none';
};
const GROUPINGS = {
  status: (items) => STATUS_GROUPS.map(g => ({ ...g, items: items.filter(i => statusOf(i) === g.key) })),
  priority: (items) => PRIORITY_ORDER.map(p => ({
    key: p,
    name: p === 'none' ? 'No Priority' : PRIORITY_LABELS[p],
    items: items.filter(i => priorityOf(i) === p),
  })),
};
const GROUP_VIEWS = [{ key: 'status', label: 'Status' }, { key: 'priority', label: 'Priority' }];

const checkState = (ids, selected) => {
  const n = ids.filter(id => selected.has(id)).length;
  return n === 0 ? false : n === ids.length ? true : 'indeterminate';
};

/**
 * Reassign Appointments' planner for any other kind of open work (tasks,
 * care programs): tasks grouped by status or priority (`grouped`, with a
 * toggle in the header), anything else one
 * flat list; a covering provider per item or per group, Select All and bulk
 * Reassign. Nothing
 * changes until the caller saves the plan (item id → { action: 'reassign',
 * to, toId }).
 *
 * @param {object}   props
 * @param {object[]} props.items       – Each with an `id` and `location` (department)
 * @param {function} props.renderMain  – (item) => the row's content (a task row,
 *   a care program row), between the checkbox and the assignee
 * @param {function} props.titleOf     – (item) => its name, for labels
 * @param {{ label: string, icon: string, onSelect: function }} [props.rowAction] – The row's "…"
 *   action, e.g. View Task / View Program: (item) => void
 * @param {string}   props.noun        – "Task", "Program" (singular)
 * @param {string}   props.icon        – Solar icon for the empty state
 * @param {function} props.usersFor    – (department | null) => UserPickerPopover users,
 *   those who work there first
 * @param {boolean}  [props.grouped] – Group tasks, by status (default) or priority
 * @param {object}   props.plan
 * @param {function} props.onPlan      – (updater: plan => plan) => void
 */
export function ReassignItemsPlanner({ items, renderMain, titleOf, noun, icon, usersFor, plan, onPlan, rowAction, grouped = false }) {
  const [selected, setSelected] = useState(() => new Set());
  const [groupBy, setGroupBy] = useState('status');
  const [picker, setPicker] = useState(null); // { rect, ids, dept? }
  const [menu, setMenu] = useState(null);     // { rect, item }

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
  // More Options on a row: View Task / View Program (`rowAction`).
  const more = (item) => rowAction && (
    <ActionButton
      icon="solar:menu-dots-linear"
      size="sm"
      tooltip="More Options"
      tooltipLeft
      aria-label="More options"
      onClick={(e) => setMenu({ rect: e.currentTarget.getBoundingClientRect(), item })}
    />
  );
  const controls = (ids, label, item) => (
    <span className={styles.controls}>
      {assigneeFor(ids, label)}
      {item && more(item)}
    </span>
  );
  const box = (ids, label) => (
    <Checkbox checked={checkState(ids, selected)} onCheckedChange={(v) => toggle(ids, v === true)} aria-label={label} />
  );

  const row = (it, flat) => (
    <div key={it.id} className={flat === true ? `${styles.apptRow} ${styles.flatRow}` : styles.apptRow}>
      <div className={styles.apptMain}>
        {box([it.id], `Select ${titleOf(it)}`)}
        {renderMain(it)}
        <span className={styles.apptTrail}>{controls([it.id], titleOf(it), it)}</span>
      </div>
    </div>
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
      <div className={`${styles.plannerHead} ${styles.plannerHeadFlat}`}>
        <span className={styles.plannerTitle}>Select Covering Providers</span>
        {grouped && <SegmentedControl size="sm" items={GROUP_VIEWS} value={groupBy} onValueChange={setGroupBy} aria-label="View tasks by" />}
      </div>
      <label className={styles.selectAll}>{box(items.map(i => i.id), 'Select all')}Select All</label>
      {grouped ? (
        <div className={styles.list}>
          {GROUPINGS[groupBy](items).filter(g => g.items.length).map(g => {
            const ids = g.items.map(i => i.id);
            return (
              <DeptGroup
                key={g.key}
                noun={noun}
                defaultOpen
                title={g.name}
                count={ids.length}
                lead={box(ids, `Select ${g.name}`)}
                controls={controls(ids, g.name)}
                items={g.items}
                renderItem={row}
              />
            );
          })}
        </div>
      ) : (
        // Every item in one card, a row each.
        <div className={styles.flatList}>
          {items.map(it => row(it, true))}
        </div>
      )}

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
          items={[{ key: 'view', label: rowAction.label, icon: rowAction.icon }]}
          onSelect={() => { rowAction.onSelect(menu.item); setMenu(null); }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
