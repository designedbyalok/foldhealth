import { SettingsSubNav } from './SettingsSubNav';
import { SECTION_LABELS } from './settingsNavItems';
import { useCan } from '../../lib/useCan';
import { settingsPermissionKey } from '../../lib/accessControl';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { AgentsTable } from './agents/AgentsTable';
import { MessagesSettings } from './messages/MessagesSettings';
import { EmbeddedComponentsSettings } from './embedded-components/EmbeddedComponentsSettings';
import { ContentSettings } from './content/ContentSettings';
import { AccountPanel } from './account/AccountPanel';
import { BillingPanel } from './billing/BillingPanel';
import { CalendarSettings } from './calendar/CalendarSettings';
import { MemberLeadsPanel } from './member-leads/MemberLeadsPanel';
import { CarePlanLibraryPanel } from './care-plan-library/panel/CarePlanLibraryPanel/CarePlanLibraryPanel';
import { AutomationsPanel } from '../automations/AutomationsPanel';
import { isAutomationsTakeover } from '../automations/automationsView';
import { CarePlanCreateView } from './care-plan-library/create/CarePlanCreateView/CarePlanCreateView';
import { CarePlanTemplateView } from './care-plan-library/templates';
import { CareProgramConfigPanel } from './care-program-config/CareProgramConfigPanel';
import { useAppStore } from '../../store/useAppStore';
import { useState } from 'react';
import { PublishVersionDrawer } from './care-plan-library/versions/PublishVersionDrawer';
import { useCanManageTemplates } from './care-plan-library/lib/useCanManageTemplates';
import { contentOf, todayIso } from './care-plan-library/lib/templateVersions';
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
  'content', 'care-plan-library', 'care-program-config', 'billing', 'account', 'calendar', 'automations',
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
  const saveCarePlanTemplateEpisode = useAppStore(s => s.saveCarePlanTemplateEpisode);
  const setCarePlanTab = useAppStore(s => s.setCarePlanTab);
  const showToast = useAppStore(s => s.showToast);
  const automationsView = useAppStore(s => s.automationsView);
  const templateVersioningReady = useAppStore(s => s.carePlanTemplateVersioningReady);
  const canManageTemplates = useCanManageTemplates();
  const [publishing, setPublishing] = useState(null); // { template, content, scope }
  const can = useCan();

  // Editing a template owns the whole Settings area, same as New Care Plan.
  if (carePlanTemplateScreen) {
    const { template } = carePlanTemplateScreen;
    // A published template changes by publishing its next version (supervisors)
    // or by a draft revision a supervisor approves. Drafts save in place.
    const versioned = template.status !== 'draft' && templateVersioningReady;
    return (
      <div className={styles.layout}>
        <CarePlanTemplateView
          template={template}
          onClose={() => setCarePlanTemplateScreen(null)}
          onSave={async (values) => {
            if (!versioned) {
              const saved = await saveCarePlanTemplate({ status: template.status, ...values }, template.id);
              if (saved) setCarePlanTemplateScreen(null);
              return;
            }
            // Categories are taken as edited, so removing the last one sticks.
            const content = { ...contentOf(template), ...contentOf({ ...template, ...values }), categories: values.categories ?? template.categories ?? [] };
            // Episodic or ongoing is a setting on the template, not versioned content.
            if (canManageTemplates) {
              setPublishing({ template, content, scope: values.scope, episode: values.episodeChanged ? values.episode : undefined });
              return;
            }
            const saved = await saveCarePlanTemplate({ ...content, status: 'draft', replacesTemplateId: template.id, episode: values.episode });
            if (!saved) return;
            showToast(`Changes saved as a draft revision of "${template.name}" for a supervisor to approve`);
            setCarePlanTab('drafts');
            setCarePlanTemplateScreen(null);
          }}
        />
        {publishing && (
          <PublishVersionDrawer
            template={publishing.template}
            content={publishing.content}
            onClose={() => setPublishing(null)}
            onPublished={async (res) => {
              if (publishing.scope) {
                const row = useAppStore.getState().carePlanTemplates.find(t => t.id === publishing.template.id);
                if (row) await saveCarePlanTemplate({ ...row, scope: publishing.scope, patientId: row.patientId }, row.id);
              }
              if (publishing.episode !== undefined) await saveCarePlanTemplateEpisode(publishing.template.id, publishing.episode);
              const when = res.version.effectiveDate > todayIso() ? ` effective ${res.version.effectiveDate.slice(5, 7)}/${res.version.effectiveDate.slice(8, 10)}/${res.version.effectiveDate.slice(0, 4)}` : '';
              const moved = res.pending === 'review'
                ? `${res.targeted} plan${res.targeted === 1 ? '' : 's'} move at their next review`
                : when ? `${res.targeted} plan${res.targeted === 1 ? '' : 's'} move then` : `${res.migrated} plan${res.migrated === 1 ? '' : 's'} migrated${res.failed ? `, ${res.failed} failed` : ''}`;
              showToast(`Version ${res.version.versionNumber} published${when}. ${moved}.`);
              setPublishing(null);
              setCarePlanTemplateScreen(null);
            }}
          />
        )}
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

  // Access Control hides sections in the sub-nav; this covers a link or a
  // typed URL that opens one anyway.
  if (!can(settingsPermissionKey(settingsNavItem))) {
    return (
      <div className={styles.layout}>
        <SettingsSubNavSlot activeItem={settingsNavItem} onItemClick={setSettingsNavItem} />
        <EmptyState
          icon="solar:shield-cross-linear"
          title="You don't have access to this section"
          description="Your role doesn't include it. Ask your practice administrator if you need it."
        />
      </div>
    );
  }

  // An open automation (builder, analytics, member trace) owns the whole Settings area.
  if (settingsNavItem === 'automations' && isAutomationsTakeover(automationsView)) {
    return (
      <div className={styles.layout}>
        <AutomationsPanel />
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
      ) : settingsNavItem === 'automations' ? (
        <AutomationsPanel />
      ) : settingsNavItem === 'care-program-config' ? (
        <CareProgramConfigPanel />
      ) : (
        <AgentsTable />
      )}
    </div>
  );
}
