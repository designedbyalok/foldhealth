import { useMemo, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { SectionCustomizer } from '../../../../components/SectionCustomizer/SectionCustomizer';
import { useAppStore } from '../../../../store/useAppStore';
import { EMPTY_PANEL_LAYOUT, customizeRows } from '../patientPanelLayout';
import styles from './PanelCustomizeDrawer.module.css';

/** Rows back into a layout, keeping what was saved for tabs this surface doesn't show. */
function rowsToLayout(rows, previous) {
  const shown = new Set(rows.map(r => r.key));
  const keepOrder = (previous.tabs?.order || []).filter(k => !shown.has(k));
  const keepHidden = (previous.tabs?.hidden || []).filter(k => !shown.has(k));
  const widgets = { ...previous.widgets };
  rows.filter(r => r.items.length).forEach((r) => {
    widgets[r.key] = { order: r.items.map(i => i.key), hidden: r.items.filter(i => !i.on).map(i => i.key) };
  });
  return {
    tabs: { order: [...rows.map(r => r.key), ...keepOrder], hidden: [...rows.filter(r => !r.on).map(r => r.key), ...keepHidden] },
    widgets,
  };
}

const toSections = rows => rows.map(r => ({ key: r.key, label: r.label, on: r.on, items: r.widgets }));

/**
 * More > Customize on the patient profile's left panel: switch tabs and the
 * widgets inside them on or off and drag them into order. Changes apply on
 * Save, per user.
 */
export function PanelCustomizeDrawer({ layout, available, onSave, onClose }) {
  const showToast = useAppStore(s => s.showToast);
  const [sections, setSections] = useState(() => toSections(customizeRows(layout, available)));
  const defaults = useMemo(() => toSections(customizeRows(EMPTY_PANEL_LAYOUT, available)), [available]);
  const isDefault = JSON.stringify(sections) === JSON.stringify(defaults);

  const update = (key, fn) => setSections(prev => prev.map(s => (s.key === key ? fn(s) : s)));

  const toggleSection = (key, on) => {
    if (!on && sections.filter(s => s.on).length === 1) {
      showToast?.('Keep at least one tab shown');
      return;
    }
    // Back on with no widget on: all its widgets go on.
    update(key, s => ({ ...s, on, items: on && s.items.length && !s.items.some(i => i.on) ? s.items.map(i => ({ ...i, on: true })) : s.items }));
  };

  const toggleItem = (key, itemKey, on) => update(key, (s) => {
    const items = s.items.map(i => (i.key === itemKey ? { ...i, on } : i));
    // Switching off a tab's last widget switches the tab off too.
    if (!items.some(i => i.on) && sections.filter(x => x.on).length === 1) {
      showToast?.('Keep at least one tab shown');
      return s;
    }
    return { ...s, items, on: items.some(i => i.on) ? s.on : false };
  });

  const save = () => {
    const rows = sections.map(s => ({ key: s.key, on: s.on, items: s.items }));
    onSave(rowsToLayout(rows, layout));
    showToast?.('Panel layout saved');
    onClose();
  };

  return (
    <Drawer
      title="Customize Panel"
      onClose={onClose}
      secondaryAction={(
        <Button variant="outline" disabled={isDefault} onClick={() => setSections(defaults)}>
          Reset to Default
        </Button>
      )}
      primaryAction={<Button onClick={save}>Save</Button>}
    >
      <p className={styles.intro}>
        Choose which tabs and widgets show in this panel, and drag them into the order you want. Only you see this layout.
      </p>
      <SectionCustomizer
        sections={sections}
        itemNoun="widget"
        onReorderSections={keys => setSections(prev => keys.map(k => prev.find(s => s.key === k)))}
        onToggleSection={toggleSection}
        onReorderItems={(key, keys) => update(key, s => ({ ...s, items: keys.map(k => s.items.find(i => i.key === k)) }))}
        onToggleItem={toggleItem}
      />
    </Drawer>
  );
}
