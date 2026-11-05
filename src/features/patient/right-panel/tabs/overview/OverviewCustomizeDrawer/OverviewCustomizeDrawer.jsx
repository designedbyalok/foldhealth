import { useMemo, useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { SortableLanes } from '../../../../../../components/SortableLanes/SortableLanes';
import { useAppStore } from '../../../../../../store/useAppStore';
import { LANE_HINTS, LANE_LABELS, OVERVIEW_WIDGETS, normalizeOverviewLayout } from '../OverviewTab/overviewLayout';
import styles from './OverviewCustomizeDrawer.module.css';

const BY_KEY = Object.fromEntries(OVERVIEW_WIDGETS.map(w => [w.key, w]));
const laneKey = i => `lane-${i}`;

function toLanes(layout) {
  const hidden = new Set(layout.hidden);
  return layout.lanes.map((keys, i) => ({
    key: laneKey(i),
    title: LANE_LABELS[i],
    hint: LANE_HINTS[i],
    emptyText: 'Drop widgets here',
    items: keys.map(k => ({
      key: k,
      label: BY_KEY[k].label,
      meta: BY_KEY[k].sample ? 'Sample data' : undefined,
      disabled: hidden.has(k),
    })),
  }));
}

const laneItems = (lanes, i) => lanes.find(l => l.key === laneKey(i))?.items || [];

function toLayout(lanes) {
  return {
    lanes: [0, 1, 2].map(i => laneItems(lanes, i).map(it => it.key)),
    hidden: [0, 1, 2].flatMap(i => laneItems(lanes, i).filter(it => it.disabled).map(it => it.key)),
  };
}

function laneCount(lane) {
  const off = lane.items.filter(i => i.disabled).length;
  const on = lane.items.length - off;
  return off ? `${on} shown · ${off} hidden` : `${on} shown`;
}

/**
 * Overview > Customize: drag widgets within and between the three columns,
 * and hide or show them in place. Hidden widgets stay where they are, dimmed,
 * so showing one puts it back in the same spot. Applies on Save, per user.
 * The 2- and 1-column layouts fold the same three lanes.
 */
export function OverviewCustomizeDrawer({ layout, onSave, onClose }) {
  const showToast = useAppStore(s => s.showToast);
  const [lanes, setLanes] = useState(() => toLanes(layout));
  const defaults = useMemo(() => toLanes(normalizeOverviewLayout(undefined)), []);
  const isDefault = JSON.stringify(toLayout(lanes)) === JSON.stringify(toLayout(defaults));

  const toggle = itemKey => setLanes(prev => prev.map(l => ({
    ...l,
    items: l.items.map(i => (i.key === itemKey ? { ...i, disabled: !i.disabled } : i)),
  })));

  const save = () => {
    const next = toLayout(lanes);
    if (next.lanes.flat().length === next.hidden.length) {
      showToast?.('Keep at least one widget shown');
      return;
    }
    onSave(next);
    showToast?.('Overview layout saved');
    onClose();
  };

  return (
    <Drawer
      title="Customize Overview"
      onClose={onClose}
      secondaryAction={(
        <Button variant="outline" disabled={isDefault} onClick={() => setLanes(defaults)}>
          Reset to Default
        </Button>
      )}
      primaryAction={<Button onClick={save}>Save</Button>}
    >
      <p className={styles.intro}>
        Drag widgets between Overview, Care Management, and Actionables. Hover a widget to hide it; hidden widgets
        stay in place, dimmed, so you can show them again. On narrower screens Actionables stacks under Overview, and
        with one column all three stack in that order. Only you see this layout.
      </p>
      <SortableLanes
        lanes={lanes}
        onChange={setLanes}
        renderCount={laneCount}
        renderActions={item => (item.disabled ? (
          <ActionButton icon="solar:eye-closed-linear" size="sm" tooltip={`Show ${item.label}`} tooltipLeft onClick={() => toggle(item.key)} />
        ) : (
          <ActionButton icon="solar:eye-linear" size="sm" tooltip={`Hide ${item.label}`} tooltipLeft onClick={() => toggle(item.key)} />
        ))}
      />
    </Drawer>
  );
}
