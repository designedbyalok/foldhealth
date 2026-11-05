import { useMemo, useState } from 'react';
import { DashboardCard, DashboardCardBody } from '../../../../../../components/DashboardCard/DashboardCard';
import { QuickActionTile } from '../../../../../../components/QuickActionTile/QuickActionTile';
import { Button } from '../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../../../../components/MenuPopover/MenuPopover';
import { CheckboxListPopover } from '../../../../../../components/CheckboxListPopover/CheckboxListPopover';
import { useAppStore } from '../../../../../../store/useAppStore';
import styles from './overviewCards.module.css';

// Per-user pins, saved with the other panel layouts (user_panel_layouts).
const LAYOUT_KEY = 'patientOverviewQuickActions';
const MAX_PINNED = 6;

// Ordered by how often a care manager reaches for them. Call / Chat / SMS
// are deliberately absent: they already live in the patient header.
const QUICK_ACTIONS = [
  { key: 'add-note', label: 'Add Note', icon: 'solar:notes-linear' },
  { key: 'add-task', label: 'Add Task', icon: 'solar:checklist-linear' },
  { key: 'schedule', label: 'Schedule', icon: 'solar:calendar-add-linear' },
  { key: 'care-plan', label: 'Care Plan', icon: 'solar:clipboard-list-linear' },
  { key: 'assessment', label: 'Assessment', icon: 'solar:clipboard-check-linear' },
  { key: 'education', label: 'Education', icon: 'solar:book-linear' },
  { key: 'referral', label: 'Create Referral', icon: 'solar:arrow-right-up-linear' },
  { key: 'enroll', label: 'Enroll in Program', icon: 'solar:user-plus-linear' },
  { key: 'automation', label: 'Run Automation', icon: 'solar:bolt-linear' },
  { key: 'print', label: 'Print Clinical Profile', icon: 'solar:printer-linear' },
];
const DEFAULT_PINNED = QUICK_ACTIONS.slice(0, MAX_PINNED).map(a => a.key);
const BY_KEY = Object.fromEntries(QUICK_ACTIONS.map(a => [a.key, a]));
const BY_LABEL = Object.fromEntries(QUICK_ACTIONS.map(a => [a.label, a]));

export function QuickActionsCard({ overview, actions }) {
  const saved = useAppStore(s => s.panelLayouts[LAYOUT_KEY]);
  const savePanelLayout = useAppStore(s => s.savePanelLayout);
  const setPatientProfileTab = useAppStore(s => s.setPatientProfileTab);
  const showToast = useAppStore(s => s.showToast);
  const [menuRect, setMenuRect] = useState(null);
  const [customizeRect, setCustomizeRect] = useState(null);

  const pinned = useMemo(() => {
    const keys = (saved?.pinned || DEFAULT_PINNED).filter(k => BY_KEY[k]);
    return keys.length ? keys : DEFAULT_PINNED;
  }, [saved]);
  const overflow = QUICK_ACTIONS.filter(a => !pinned.includes(a.key));

  // A due assessment (an open "send form" suggestion) flags the tile.
  const dueForm = (overview?.suggestedActions || []).find(a => a.action === 'send-form' && a.status === 'open');

  const run = (key) => {
    switch (key) {
      case 'add-note': actions.addNote(); return;
      case 'add-task': actions.addTask(); return;
      case 'schedule': actions.schedule(); return;
      case 'care-plan': actions.openCarePlan(); return;
      case 'enroll': setPatientProfileTab('Care Programs'); return;
      case 'print': window.print(); return;
      default: showToast(`${BY_KEY[key].label} is coming soon`);
    }
  };

  const savePins = (labels) => {
    const keys = labels.map(l => BY_LABEL[l]?.key).filter(Boolean);
    if (keys.length > MAX_PINNED) {
      showToast(`Pin up to ${MAX_PINNED} actions`);
      return;
    }
    if (keys.length === 0) return;
    savePanelLayout(LAYOUT_KEY, { pinned: keys });
  };

  return (
    <DashboardCard
      icon="solar:widget-add-linear"
      title="Quick Actions"
      actions={(
        <>
          <Button variant="ghost" size="sm" onClick={(e) => setCustomizeRect(e.currentTarget.getBoundingClientRect())}>Pin actions</Button>
          {overflow.length > 0 && (
            <ActionButton icon="solar:menu-dots-bold" size="sm" tooltip="More actions" onClick={(e) => setMenuRect(e.currentTarget.getBoundingClientRect())} />
          )}
        </>
      )}
    >
      <DashboardCardBody className={styles.quickGrid}>
        <div className={styles.quickGridInner}>
          {pinned.map(k => {
            const a = BY_KEY[k];
            const attention = k === 'assessment' && !!dueForm;
            return (
              <QuickActionTile
                key={k}
                icon={a.icon}
                label={a.label}
                attention={attention}
                attentionLabel={attention ? dueForm.title : undefined}
                onClick={() => run(k)}
              />
            );
          })}
        </div>
      </DashboardCardBody>
      {menuRect && (
        <MenuPopover
          anchorRect={menuRect}
          width={220}
          align="right"
          ariaLabel="More quick actions"
          items={overflow.map(a => ({ key: a.key, icon: a.icon, label: a.label }))}
          onSelect={(key) => { setMenuRect(null); run(key); }}
          onClose={() => setMenuRect(null)}
        />
      )}
      {customizeRect && (
        <CheckboxListPopover
          anchorRect={customizeRect}
          label={`Pin up to ${MAX_PINNED} actions`}
          options={QUICK_ACTIONS.map(a => a.label)}
          selected={pinned.map(k => BY_KEY[k].label)}
          onChange={savePins}
          onClose={() => setCustomizeRect(null)}
          showClear={false}
          width={240}
        />
      )}
    </DashboardCard>
  );
}
