import { SettingsSubNav } from './SettingsSubNav';
import { SECTION_LABELS } from './settingsNavItems';
import { AgentsTable } from './agents/AgentsTable';
import { MessagesSettings } from './messages/MessagesSettings';
import { EmbeddedComponentsSettings } from './embedded-components/EmbeddedComponentsSettings';
import { ContentSettings } from './content/ContentSettings';
import { AccountPanel } from './account/AccountPanel';
import { BillingPanel } from './billing/BillingPanel';
import { CalendarSettings } from './calendar/CalendarSettings';
import { MemberLeadsPanel } from './member-leads/MemberLeadsPanel';
import { CarePlanLibraryPanel } from './care-plan-library/panel/CarePlanLibraryPanel/CarePlanLibraryPanel';
import { CarePlanCreateView } from './care-plan-library/create/CarePlanCreateView/CarePlanCreateView';
import { CarePlanTemplateView } from './care-plan-library/templates';
import { useAppStore } from '../../store/useAppStore';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { useFloatingSubNavSlot } from '../../components/FloatingSidebar/floatingSubNavSlot';
import styles from './SettingsLayout.module.css';

/**
 * SettingsSubNav lives inside the floating NavBar card when the user has
 * opted into the floating shape — same shape Population / Analytics /
 * Calls / Comms use. The feature's state (activeItem, click handler)
 * stays here; only the DOM moves via portal.
 */
function SettingsSubNavSlot({ activeItem, onItemClick }) {
  const sidebarShape = useAppStore(s => s.sidebarShape);
  const slot = useFloatingSubNavSlot();
  const floating = sidebarShape === 'floating' && slot;
  const el = <SettingsSubNav activeItem={activeItem} onItemClick={onItemClick} width={floating ? '100%' : 180} />;
  return floating ? createPortal(el, slot) : el;
}

// Nav items without a built panel yet. Rendering AgentsTable for these (the
// old fall-through) both showed the wrong screen and fired its Supabase
// queries; a static placeholder costs nothing.
const IMPLEMENTED = new Set([
  'agents', 'member/leads', 'messages', 'embedded-components',
  'content', 'care-plan-library', 'billing', 'account', 'calendar',
]);

function ComingSoonPanel({ label }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Icon name="solar:inbox-linear" size={40} color="var(--neutral-200)" />
        <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-300)', marginTop: '0.5rem' }}>{label}</div>
        <div style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-200)', marginTop: 4 }}>Coming soon</div>
      </div>
    </div>
  );
}

export function SettingsLayout() {
  const settingsNavItem = useAppStore(s => s.settingsNavItem);
  const setSettingsNavItem = useAppStore(s => s.setSettingsNavItem);
  const carePlanCreateOpen = useAppStore(s => s.carePlanCreateOpen);
  const setCarePlanCreateOpen = useAppStore(s => s.setCarePlanCreateOpen);
  const carePlanTemplateScreen = useAppStore(s => s.carePlanTemplateScreen);
  const setCarePlanTemplateScreen = useAppStore(s => s.setCarePlanTemplateScreen);
  const saveCarePlanTemplate = useAppStore(s => s.saveCarePlanTemplate);
  const setCarePlanTab = useAppStore(s => s.setCarePlanTab);
  const showToast = useAppStore(s => s.showToast);

  // Editing a template owns the whole Settings area, same as New Care Plan.
  if (carePlanTemplateScreen) {
    const { template } = carePlanTemplateScreen;
    return (
      <div className={styles.layout}>
        <CarePlanTemplateView
          template={template}
          onClose={() => setCarePlanTemplateScreen(null)}
          onSave={async (values) => {
            const saved = await saveCarePlanTemplate({ status: template.status, ...values }, template.id);
            if (saved) setCarePlanTemplateScreen(null);
          }}
        />
      </div>
    );
  }

  // The New Care Plan screen owns the whole Settings area — no sub-nav.
  if (carePlanCreateOpen) {
    return (
      <div className={styles.layout}>
        <CarePlanCreateView
          onClose={() => setCarePlanCreateOpen(false)}
          onSave={async (values) => {
            const saved = await saveCarePlanTemplate(values);
            if (!saved) return;
            showToast(`"${saved.name}" ${values.status === 'draft' ? 'saved as draft' : 'saved'}`);
            // Land on the tab the template just went to.
            setCarePlanTab(values.status === 'draft' ? 'drafts' : 'template');
            setCarePlanCreateOpen(false);
          }}
        />
      </div>
    );
  }

  if (!IMPLEMENTED.has(settingsNavItem)) {
    return (
      <div className={styles.layout}>
        <SettingsSubNavSlot activeItem={settingsNavItem} onItemClick={setSettingsNavItem} />
        <ComingSoonPanel label={SECTION_LABELS[settingsNavItem] || settingsNavItem} />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <SettingsSubNavSlot activeItem={settingsNavItem} onItemClick={setSettingsNavItem} />
      {settingsNavItem === 'messages' ? (
        <MessagesSettings />
      ) : settingsNavItem === 'embedded-components' ? (
        <EmbeddedComponentsSettings />
      ) : settingsNavItem === 'content' ? (
        <ContentSettings />
      ) : settingsNavItem === 'account' ? (
        <AccountPanel />
      ) : settingsNavItem === 'billing' ? (
        <BillingPanel />
      ) : settingsNavItem === 'calendar' ? (
        <CalendarSettings />
      ) : settingsNavItem === 'member/leads' ? (
        <MemberLeadsPanel />
      ) : settingsNavItem === 'care-plan-library' ? (
        <CarePlanLibraryPanel />
      ) : (
        <AgentsTable />
      )}
    </div>
  );
}
