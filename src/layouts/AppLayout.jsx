import { lazy, Suspense, useEffect } from 'react';
import { useCan } from '../lib/useCan';
import { navPermissionKey } from '../lib/accessControl';
import { EmptyState } from '../components/EmptyState/EmptyState';
import { AppSidebar } from '../components/Sidebar/AppSidebar';
import { SubNav } from '../components/SubNav/SubNav';
import { TopBar } from '../components/TopBar/TopBar';
import { TabBar } from './TabBar';
import { FilterBar } from '../components/FilterBar/FilterBar';
import { useSavedFilterActions } from '../features/hcc/useSavedFilterActions';
import { Pagination } from '../components/Pagination/Pagination';
import { ActiveCallCard } from '../components/ActiveCallCard/ActiveCallCard';
import { InvokeAgentModal } from '../components/InvokeAgentModal/InvokeAgentModal';
import { DegradedBanner } from '../components/DegradedBanner/DegradedBanner';
import { QueueSummaryBar } from '../features/toc/queue/QueueSummaryBar';
import { PgProcessingHost } from '../features/population-groups/PgProcessingHost';
import { Icon } from '../components/Icon/Icon';
import { useAppStore } from '../store/useAppStore';
import { parseHash } from '../lib/router';
import { useNotificationsFeed } from '../components/NotificationsPopover/useNotificationsFeed';
import { splitFullName } from '../lib/nameValidation';
import { Toaster } from '../components/Toast/Toast';
import { CallPopoverHost } from '../components/CallPopover/CallPopoverHost';
import { BrowserCallCard } from '../features/messages/comms/call/BrowserCallCard';
import { CommsDrawerHost } from '../features/messages/comms/CommsDrawerHost';
import { ReassignmentSummaryHost } from '../features/ooo/ReassignmentSummaryHost';
import { DesignReviewHost } from '../features/design-review/DesignReviewHost';
import { useProgramPanelSplitActive, useDiagPanelInSplit } from '../features/patient/hooks/useProgramPanelSplitActive';
import { supabase } from '../lib/supabase';
import styles from './AppLayout.module.css';
import { CaptureConsentDrawerHost } from '../features/patient/shared/CaptureConsentDrawer/CaptureConsentDrawerHost';
import { ConsentHistoryDrawer } from '../features/patient/shared/ConsentHistoryDrawer/ConsentHistoryDrawer';
import { ContactConsentDialog } from '../features/patient/shared/ContactConsentDialog/ContactConsentDialog';

// Lazy-loaded features. These pull in heavy deps (recharts, @xyflow, @schedule-x,
// @usewaypoint/email-builder, react-grid-layout) and are not used on the default
// landing view, so they should not be in the entry chunk.
const lz = (importer, name) => lazy(() => importer().then(m => ({ default: m[name] })));

const PatientDetailView = lz(() => import('../features/patient/PatientDetailView'), 'PatientDetailView');
const PopGroupRuleBuilder = lz(() => import('../features/population-groups/rule-builder/PopGroupRuleBuilder'), 'PopGroupRuleBuilder');
const CalendarPageView  = lz(() => import('../features/calendar/CalendarView'),     'CalendarView');
const HomeView          = lz(() => import('../features/home/HomeView'),             'HomeView');
const MessagesView      = lz(() => import('../features/messages/MessagesView'),     'MessagesView');
const CallsView         = lz(() => import('../features/calls/CallsView'),           'CallsView');
const TasksView         = lz(() => import('../features/tasks/TasksView'),           'TasksView');
const CampaignView      = lz(() => import('../features/campaign/CampaignView'),     'CampaignView');
const AnalyticsLayout   = lz(() => import('../features/analytics/AnalyticsLayout'), 'AnalyticsLayout');
const SettingsLayout    = lz(() => import('../features/settings/SettingsLayout'),   'SettingsLayout');
const AgentCanvas       = lz(() => import('../features/agent-builder/AgentCanvas'), 'AgentCanvas');
const EmailBuilder      = lz(() => import('../features/email-builder/EmailBuilder'), 'EmailBuilder');
const CampaignBuilder   = lz(() => import('../features/campaign/CampaignBuilder'),  'CampaignBuilder');
const FormBuilder       = lz(() => import('../features/forms/builder/FormBuilder'), 'FormBuilder');
const FormView          = lz(() => import('../features/forms/view/FormView'),       'FormView');

// Worklist tables: one renders per subnav list, so each loads on demand.
const WorklistTable        = lz(() => import('../features/toc/worklist/WorklistTable'), 'WorklistTable');
const QueueTable           = lz(() => import('../features/toc/queue/QueueTable'), 'QueueTable');
const TocWorklistTable     = lz(() => import('../features/toc/TocWorklistTable'), 'TocWorklistTable');
const HccWorklistTable     = lz(() => import('../features/hcc/HccWorklistTable'), 'HccWorklistTable');
const HedisWorklistTable   = lz(() => import('../features/hedis-worklist/HedisWorklistTable'), 'HedisWorklistTable');
const AwvWorklistTable     = lz(() => import('../features/awv-worklist/AwvWorklistTable'), 'AwvWorklistTable');
const CmpWorklistTable     = lz(() => import('../features/cmp-worklist/CmpWorklistTable'), 'CmpWorklistTable');
const PharmacyWorklistTable = lz(() => import('../features/pharmacy-worklist/PharmacyWorklistTable'), 'PharmacyWorklistTable');
const JsaWorklistTable     = lz(() => import('../features/jsa-worklist/JsaWorklistTable'), 'JsaWorklistTable');
const CcmWorklistTable     = lz(() => import('../features/ccm-worklist/CcmWorklistTable'), 'CcmWorklistTable');
const SnpWorklistTable     = lz(() => import('../features/snp-worklist/SnpWorklistTable'), 'SnpWorklistTable');
const AllPatientsTable     = lz(() => import('../features/all-patients/AllPatientsTable'), 'AllPatientsTable');
const PopulationGroupsView = lz(() => import('../features/population-groups/PopulationGroupsView'), 'PopulationGroupsView');

// Drawers and overlays — only mounted when their state is truthy, so lazy here
// keeps them out of the entry chunk entirely.
const DetailDrawer         = lz(() => import('../components/DetailDrawer/DetailDrawer'),                   'DetailDrawer');
const LiveDrawer           = lz(() => import('../components/LiveDrawer/LiveDrawer'),                       'LiveDrawer');
const QuickViewDrawer      = lz(() => import('../components/QuickViewDrawer/QuickViewDrawer'),             'QuickViewDrawer');
const CreateAgentDrawer    = lz(() => import('../features/settings/agents/CreateAgentDrawer'),              'CreateAgentDrawer');
const GoalDetailDrawer     = lz(() => import('../features/settings/agents/goals/GoalDetailDrawer'),        'GoalDetailDrawer');
const GoalWizardDrawer     = lz(() => import('../features/settings/agents/goals/GoalWizardDrawer'),        'GoalWizardDrawer');
const GroupDetailDrawer    = lz(() => import('../features/settings/messages/GroupDetailDrawer'),           'GroupDetailDrawer');
const AgentRulesDrawer     = lz(() => import('../features/settings/agents/AgentRulesDrawer'),              'AgentRulesDrawer');
const BusinessHoursDrawer  = lz(() => import('../features/settings/messages/BusinessHoursDrawer'),         'BusinessHoursDrawer');
const ComponentWizardDrawer= lz(() => import('../features/settings/embedded-components/ComponentWizardDrawer'), 'ComponentWizardDrawer');
const DiagPanel            = lz(() => import('../features/hcc/DiagPanel/DiagPanel'),                       'DiagPanel');
const UploadChartDrawer    = lz(() => import('../features/hcc/UploadChartDrawer'),                         'UploadChartDrawer');
const UploadDocumentDrawer = lz(() => import('../features/hcc/upload/UploadDocumentDrawer'),               'UploadDocumentDrawer');
const HccUploadProcessingHost = lz(() => import('../features/hcc/upload/HccUploadProcessingHost'),         'HccUploadProcessingHost');
const HccSftpReviewDrawer  = lz(() => import('../features/hcc/upload/HccSftpReviewDrawer'),                'HccSftpReviewDrawer');
const HccAddDosDrawer      = lz(() => import('../features/hcc/HccAddDosDrawer'),                           'HccAddDosDrawer');
const AddCareGapsDrawer    = lz(() => import('../features/hedis-worklist/AddCareGapsDrawer'),              'AddCareGapsDrawer');
const IcdCreationScreen    = lz(() => import('../features/hcc/upload/IcdCreationScreen'),                  'IcdCreationScreen');
const ClaimPreviewDrawer   = lz(() => import('../features/hcc/ClaimPreviewDrawer'),                        'ClaimPreviewDrawer');
const EditPatientDrawer    = lz(() => import('../features/patient/left-panel/tabs/profile/EditPatientDrawer/EditPatientDrawer'), 'EditPatientDrawer');
const AssessmentDrawer     = lz(() => import('../features/toc/queue/AssessmentDrawer'),                    'AssessmentDrawer');
const OutreachStatusDrawer = lz(() => import('../features/toc/queue/OutreachStatusDrawer'),                'OutreachStatusDrawer');
const AiTasksDrawer        = lz(() => import('../features/toc/AiTasksDrawer'),                             'AiTasksDrawer');

// Placeholder while a lazy chunk is in flight. Empty div keeps layout stable.
const LazyFallback = () => <div style={{ flex: 1 }} />;

function ComingSoonState({ listName }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '64px 24px', gap: 12,
    }}>
      <Icon name="solar:hourglass-line-linear" size={44} color="var(--neutral-200)" />
      <p style={{ fontSize: 'var(--font-xl)', fontWeight: 600, color: 'var(--neutral-400)', margin: 0 }}>
        {listName}
      </p>
      <p style={{ fontSize: 'var(--font-base)', margin: 0, textAlign: 'center', maxWidth: 320, color: 'var(--neutral-300)' }}>
        This worklist is coming soon. Check back for updates.
      </p>
    </div>
  );
}



function PopulationView() {
  const subnavCollapsed = useAppStore(s => s.subnavCollapsed);
  const activeTab = useAppStore(s => s.activeTab);
  const showFilterBar = useAppStore(s => s.showFilterBar);
  const activeSubnavList = useAppStore(s => s.activeSubnavList);
  // Floating sidebar absorbs the SubNav into its own card, so the standalone
  // page-column instance would duplicate it (and the collapse control). Hide
  // it here when that shape is active.
  const sidebarShape = useAppStore(s => s.sidebarShape);

  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const canSeePatient = useCan()('patient:details');
  const pgRuleBuilder = useAppStore(s => s.pgRuleBuilder);
  const setHccFilter = useAppStore(s => s.setHccFilter);
  const programSplit = useProgramPanelSplitActive();

  const isAwv = activeSubnavList === 'Annual Visit';
  const isJsa = activeSubnavList === 'JSA';
  const isPharmacy = activeSubnavList === 'Pharmacy';
  const isCmp = activeSubnavList === 'CMP';

  // Dynamic group rule builder — full-page takeover, no subnav
  if (pgRuleBuilder) {
    return (
      <div className={styles.main}>
        <TopBar />
        <div className={styles.content}>
          <Suspense fallback={<LazyFallback />}>
            <PopGroupRuleBuilder />
          </Suspense>
        </div>
      </div>
    );
  }

  // Patient detail view — full-page, no subnav. With a program open "in
  // right panel" the page is two cards (see PatientDetailView), so this
  // wrapper drops its own card chrome and the TopBar gives way to the
  // patient card's breadcrumb header.
  if (selectedPatientId && !canSeePatient) {
    return (
      <div className={styles.main}>
        <TopBar />
        <div className={styles.content}><NoAccessView /></div>
      </div>
    );
  }
  if (selectedPatientId) {
    return (
      <div className={styles.main} data-floating-split={programSplit || undefined}>
        {!programSplit && <TopBar />}
        <div className={styles.content}>
          <Suspense fallback={<LazyFallback />}>
            <PatientDetailView />
          </Suspense>
        </div>
        <CallPopoverHost />
        <BrowserCallCard />
        <CommsDrawerHost />
      </div>
    );
  }

  const isHcc = activeSubnavList === 'HCC';
  const isHedis = activeSubnavList === 'HEDIS';
  const isCcm = activeSubnavList === 'CCM';
  const isSnp = activeSubnavList === 'SNP';
  const isAllPatients = activeSubnavList === 'All Patients';
  const isPopulationGroup = activeSubnavList.startsWith('pg:');
  const isToc = activeSubnavList === 'TOC IP';
  const isTcm = activeSubnavList === 'TCM' || (!isHcc && !isHedis && !isCcm && !isAwv && !isJsa && !isCmp && !isPharmacy && !isAllPatients && !isPopulationGroup && !isToc && activeSubnavList !== 'My Patients' && !['Day Optimizer', 'Review HRA', 'IP Visits', 'High Risk', 'High Cost', 'SNP', 'JSA', 'Pharmacy', 'High Utilizers', 'DM', 'My Patients'].includes(activeSubnavList));
  const isComingSoon = ['Day Optimizer', 'Review HRA', 'IP Visits', 'High Risk', 'High Cost', 'High Utilizers', 'DM', 'My Patients'].includes(activeSubnavList);
  const pgFilter = activeSubnavList === 'pg:Static' ? 'Static' : activeSubnavList === 'pg:Dynamic' ? 'Dynamic' : 'All';

  const chromeless = isHcc || isHedis || isCcm || isSnp || isAwv || isJsa || isCmp || isPharmacy || isComingSoon || isPopulationGroup;

  return (
    <div className={styles.main}>
      <TopBar />
      <DegradedBanner />
      <div className={styles.bodyRow}>
        {sidebarShape !== 'floating' && <SubNav collapsed={subnavCollapsed} />}
        <div className={styles.content}>
          {/* CCM is otherwise chromeless, but we want the same TabBar header
              TOC uses (title tab + right-side action icons) so the two
              worklists share one visual pattern. */}
          {(!chromeless || isCcm) && <TabBar />}
          {!chromeless && showFilterBar && (
            <WorklistFilterBar leading={(isToc || (isTcm && activeTab === 'toc-queue')) ? null : undefined} />
          )}
          {isTcm && activeTab === 'toc-queue' && <QueueSummaryBar />}
          <Suspense fallback={<LazyFallback />}>
          {isHcc
              ? <HccWorklistTable />
              : isHedis
                ? <HedisWorklistTable />
                : isCcm
                  ? <CcmWorklistTable />
                : isSnp
                  ? <SnpWorklistTable />
                : isAwv
                  ? <AwvWorklistTable />
                : isJsa
                  ? <JsaWorklistTable />
                : isCmp
                  ? <CmpWorklistTable />
                : isPharmacy
                  ? <PharmacyWorklistTable />
                  : isAllPatients
                    ? <AllPatientsTable />
                    : isPopulationGroup
                      ? <PopulationGroupsView activeFilter={pgFilter} />
                      : isComingSoon
                        ? <ComingSoonState listName={activeSubnavList} />
                        : isToc
                          ? <TocWorklistTable />
                          : (activeTab === 'toc-worklist' ? <WorklistTable /> : <QueueTable />)}
          </Suspense>
          {!chromeless && <Pagination />}
        </div>
      </div>
    </div>
  );
}

function SettingsView() {
  // New Care Plan is a full-screen takeover: no TopBar, no Settings sub-nav —
  // just the app rail beside the card (Figma Care-Plan-Creation 14108:294859).
  const carePlanCreateOpen = useAppStore(s => s.carePlanCreateOpen);
  const carePlanTemplateScreen = useAppStore(s => s.carePlanTemplateScreen);
  // Those editors draw their own card. The floating body shell would wrap
  // that card in a second one, so the wrapper stays bare.
  const ownCard = carePlanCreateOpen || carePlanTemplateScreen;
  return (
    <div className={styles.main} data-floating-bare={ownCard || undefined}>
      {!ownCard && <TopBar />}
      <div className={styles.content}>
        <Suspense fallback={<LazyFallback />}>
          <SettingsLayout />
        </Suspense>
      </div>
    </div>
  );
}

function AnalyticsView() {
  return (
    <div className={styles.main}>
      <TopBar />
      <div className={styles.content}>
        <Suspense fallback={<LazyFallback />}>
          <AnalyticsLayout />
        </Suspense>
      </div>
    </div>
  );
}

function CalendarViewPage() {
  return (
    <div className={styles.main}>
      <TopBar />
      <div className={styles.content}>
        <Suspense fallback={<LazyFallback />}>
          <CalendarPageView />
        </Suspense>
      </div>
    </div>
  );
}

function NoAccessView() {
  return (
    <div className={styles.noAccess}>
      <EmptyState
        icon="solar:shield-cross-linear"
        title="You don't have access to this page"
        description="Your role doesn't include it. Ask your practice administrator if you need it."
      />
    </div>
  );
}

export function AppLayout() {
  const activePage = useAppStore(s => s.activePage);
  const builderAgent = useAppStore(s => s.builderAgent);

  const fetchOrgFeatures = useAppStore(s => s.fetchOrgFeatures);

  // Bell feed: resolves the signed-in profile, subscribes to this user's
  // notification rows, and resyncs after the tab/socket comes back.
  useNotificationsFeed();

  useEffect(() => { fetchOrgFeatures(); }, [fetchOrgFeatures]);

  // Access Control: which pages and Settings sections this user's roles see.
  const fetchAccessRoles = useAppStore(s => s.fetchAccessRoles);
  useEffect(() => { fetchAccessRoles(); }, [fetchAccessRoles]);
  const can = useCan();

  // Out of Office records drive the avatar badge everywhere, so they load
  // with the app rather than with any one screen.
  const fetchOooRecords = useAppStore(s => s.fetchOooRecords);
  useEffect(() => { fetchOooRecords(); }, [fetchOooRecords]);

  // Keep profiles in sync with auth.users. Self-signups and OAuth logins don't
  // go through the Invite flow, so profiles would otherwise stay empty for them.
  // First login inserts with safe defaults; later logins only refresh the
  // email, and fill in a name only when the profile has none. The profile owns
  // the name: an admin's correction ("CHINMAY GUMGAONKAR" to "Chinmay
  // Gumgaonkar") used to be overwritten from the sign-up metadata on the
  // user's next login.
  useEffect(() => {
    // getSession(), not getUser(): getUser() is a network round trip that
    // re-validates the token against the auth server, and this effect used to
    // block on it before it could do anything — the profile read behind it did
    // not start until ~4 s into a cold load. getSession() reads the locally
    // persisted session (including user_metadata) with no request at all.
    // Skipping server validation is safe here because everything below is
    // keyed to the session's own user id and gated by RLS: a tampered local
    // session cannot write another user's row. Same reasoning as
    // `_resolveWorklistUser` in the store.
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data?.session?.user;
      if (!user) return;
      const meta = user.user_metadata || {};
      const fullName = meta.full_name
        || [meta.first_name, meta.last_name].filter(Boolean).join(' ')
        || null;
      // Derive the parts from full_name when the provider only gave us a
      // single name. This used to run one way only — full_name FROM the parts
      // — so an OAuth signup (Google et al. supply just a full name) wrote
      // first_name/last_name NULL, and every later login refreshed the row
      // without ever filling them in. That is where 25 of the 27 broken
      // profiles came from. The DB trigger in
      // supabase/profiles_name_parts_migration.sql is the real guarantee;
      // doing it here too means the client sends correct data rather than
      // relying on the database to repair every write.
      const derived = splitFullName(fullName);
      const firstName = meta.first_name || derived.first || null;
      const lastName  = meta.last_name  || derived.last  || null;

      const names = { first_name: firstName, last_name: lastName, full_name: fullName };
      const identity = { id: user.id, email: user.email, updated_at: new Date().toISOString() };

      // Skip the write when this browser already synced these exact values.
      // Every profiles write is a realtime event that makes each open
      // Messages tab in the org re-read all profiles, so an unconditional
      // write per page load fanned out across everyone.
      const syncKey = `fold:profileSynced:${user.id}`;
      const fingerprint = JSON.stringify([user.email, fullName, firstName, lastName]);
      try { if (localStorage.getItem(syncKey) === fingerprint) return; } catch { /* storage blocked */ }

      // Write first, ask questions only if it missed. This was a
      // `select id` → then `update` or `insert`, i.e. two serialized round
      // trips on every single page load to do what is almost always one
      // UPDATE — the row already exists, because handle_new_user() inserts it
      // from an auth.users trigger at signup. `.select('id')` on the update
      // reports what it actually touched, so the INSERT fallback still covers
      // rows that predate that trigger. Common path: one request. Same
      // affected-rows pattern useUsersTab uses for its own writes.
      //
      // A single upsert would be shorter and wrong: INSERT has to supply
      // `status: 'Active'` and UPDATE must not, or every login would reset a
      // status an admin had set.
      const { data: updated } = await supabase
        .from('profiles')
        .update(identity)
        .eq('id', user.id)
        .select('id, full_name');

      if (updated?.length && !updated[0].full_name?.trim() && fullName) {
        await supabase.from('profiles').update(names).eq('id', user.id);
      }
      if (!updated || updated.length === 0) {
        // Identity fields only. `role` / `admin_role` / `clinical_roles` are
        // authorization fields and must be owned by the database (the
        // handle_new_user() trigger and column defaults), never chosen by the
        // client — otherwise a forged request could self-assign privileges.
        await supabase.from('profiles').insert({
          ...identity,
          ...names,
          status: 'Active',
        });
      }
      if (updated?.length) {
        try { localStorage.setItem(syncKey, fingerprint); } catch { /* storage blocked */ }
      }
    });
  }, []);

  // Re-open agent builder on page refresh when URL has agent edit path
  useEffect(() => {
    const pendingId = useAppStore.getState()._pendingAgentId;
    if (!pendingId || builderAgent) return undefined;
    // Try to find the agent in the already-loaded agents list
    const agents = useAppStore.getState().agents || [];
    const agent = agents.find(a => String(a.id) === String(pendingId));
    if (agent) {
      useAppStore.getState().openBuilder(agent);
      return undefined;
    }
    // Agent list may not be loaded yet — wait for it
    const unsub = useAppStore.subscribe((state) => {
      if (state.agents?.length && state._pendingAgentId) {
        const a = state.agents.find(ag => String(ag.id) === String(state._pendingAgentId));
        if (a) {
          useAppStore.getState().openBuilder(a);
          useAppStore.setState({ _pendingAgentId: null });
        }
        unsub();
      }
    });
    // Clear after 5s timeout to avoid lingering
    const timer = setTimeout(() => { unsub(); useAppStore.setState({ _pendingAgentId: null }); }, 5000);
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  // Re-open campaign builder or email builder on page refresh
  useEffect(() => {
    const state = useAppStore.getState();
    const pendingEmail = state._pendingEmailEditId;
    const pendingCampaign = state._pendingCampaignBuilderId;
    if (!pendingEmail && !pendingCampaign) return;

    const targetId = pendingEmail || pendingCampaign;

    (async () => {
      // Try bulk fetch first, then fall back to single-row fetch
      await useAppStore.getState().fetchCampaigns();
      let c = (useAppStore.getState().campaigns || []).find(
        camp => String(camp.id) === String(targetId)
      );
      if (!c) {
        const numId = isNaN(Number(targetId)) ? targetId : Number(targetId);
        c = await useAppStore.getState().fetchCampaignById(numId);
      }
      if (!c) {
        useAppStore.setState({
          _pendingEmailEditId: null, _pendingCampaignBuilderId: null,
          editingCampaignId: null, campaignBuilderId: null,
        });
        return;
      }
      if (pendingEmail) {
        useAppStore.getState().openEmailBuilder(c);
      } else {
        useAppStore.getState().openCampaignBuilder(c);
      }
      useAppStore.setState({ _pendingEmailEditId: null, _pendingCampaignBuilderId: null });
    })();
  }, []);

  // Re-open the form builder on page refresh of
  // #/settings/content/forms/{id}/{mode}[/{analyticsTab}]. openFormBuilder opens
  // on Edit; we then restore the tab from _pendingFormMode (via the store setters
  // so the URL stays in sync).
  useEffect(() => {
    const pendingForm = useAppStore.getState()._pendingFormEditId;
    if (!pendingForm) return;
    (async () => {
      const full = await useAppStore.getState().fetchFormById(
        isNaN(Number(pendingForm)) ? pendingForm : Number(pendingForm),
      );
      if (full) {
        const { _pendingFormMode: mode, _pendingFormAnalyticsTab: subTab } = useAppStore.getState();
        await useAppStore.getState().openFormBuilder(full);
        if (mode && mode !== 'edit') useAppStore.getState().setFormBuilderMode(mode);
        if (mode === 'analytics' && subTab) useAppStore.getState().setFormAnalyticsTab(subTab);
      } else {
        // Form is gone (deleted, or a stale/typo'd id). Reset builder state AND
        // leave the form-edit URL — otherwise onFormBuilderRoute stays true and
        // the takeover would show the loading fallback indefinitely.
        useAppStore.getState().showToast?.('Form not found');
        useAppStore.setState({ editingFormId: null, formBuilderForm: null });
        if (typeof window !== 'undefined') window.location.hash = '#/settings/content/forms';
      }
      useAppStore.setState({ _pendingFormEditId: null, _pendingFormMode: null, _pendingFormAnalyticsTab: null });
    })();
  }, []);

  const showCreateAgent = useAppStore(s => s.showCreateAgent);
  const detailPatient = useAppStore(s => s.detailPatient);
  const liveDrawerPatient = useAppStore(s => s.liveDrawerPatient);
  const goalDetailId = useAppStore(s => s.goalDetailId);
  const goalWizardOpen = useAppStore(s => s.goalWizardOpen);
  const chatGroupDetailId = useAppStore(s => s.chatGroupDetailId);
  const agentRulesGroupId = useAppStore(s => s.agentRulesGroupId);
  const businessHoursOpen = useAppStore(s => s.businessHoursOpen);
  const componentWizardOpen = useAppStore(s => s.componentWizardOpen);
  const diagPanelOpen = useAppStore(s => s.diagPanelOpen);
  // Opened in the side panel, it renders inside the patient split instead.
  const diagInSplit = useDiagPanelInSplit();
  const invitePatientOpen = useAppStore(s => s.invitePatientOpen);
  const closeInvitePatient = useAppStore(s => s.closeInvitePatient);
  const patientEditSection = useAppStore(s => s.patientEditSection);
  const patientEditPatient = useAppStore(s => s.patientEditPatient);
  const closePatientEdit = useAppStore(s => s.closePatientEdit);
  const quickViewPatient = useAppStore(s => s.quickViewPatient);
  const consentCapture = useAppStore(s => s.consentCapture);
  const closeConsentCapture = useAppStore(s => s.closeConsentCapture);
  const consentHistoryPatientId = useAppStore(s => s.consentHistoryPatientId);
  const closeConsentHistory = useAppStore(s => s.closeConsentHistory);
  const contactConsent = useAppStore(s => s.contactConsent);
  const closeContactConsent = useAppStore(s => s.closeContactConsent);
  const assessmentDrawerPatientId = useAppStore(s => s.assessmentDrawerPatientId);
  const outreachStatusDrawerPatientId = useAppStore(s => s.outreachStatusDrawerPatientId);
  const aiTasksDrawerPatientId = useAppStore(s => s.aiTasksDrawerPatientId);
  const editingCampaignId = useAppStore(s => s.editingCampaignId);
  const editingComponent = useAppStore(s => s.editingComponent);
  const campaignBuilderId = useAppStore(s => s.campaignBuilderId);
  const editingFormId = useAppStore(s => s.editingFormId);
  const formBuilderForm = useAppStore(s => s.formBuilderForm);
  const formViewId = useAppStore(s => s.formViewId);

  // Reload-safe form-builder detection. On a refresh of
  // #/settings/content/forms/{id}/{mode}, `editingFormId` is null until the
  // hydration effect below has fetched the form and called openFormBuilder —
  // an async gap during which the content list would otherwise render, so the
  // editor "flashed back to the list and returned". Reading the URL
  // synchronously here lets the builder takeover win on the very first paint.
  // App re-renders AppLayout on every hashchange, so this stays in sync with
  // client navigation too.
  const formRoute = parseHash();
  const onFormBuilderRoute =
    formRoute.page === 'settings' && formRoute.section === 'content'
    && formRoute.tab === 'forms' && !!formRoute.id;

  // Email Builder is a full-screen takeover when editing a campaign. Wins over
  // the CampaignBuilder so "Edit Template" from inside the campaign builder
  // pushes the email builder on top — closing it falls back to the campaign
  // builder (campaignBuilderId stays set).
  if (editingCampaignId || editingComponent) {
    return (
      <div className={styles.app}>
        <AppSidebar />
        <Suspense fallback={<LazyFallback />}>
          <EmailBuilder />
        </Suspense>
        <Toaster />
      </div>
    );
  }

  // Campaign Builder is a full-screen takeover for creating/editing the
  // metadata, scheduling, audience, and channel of a campaign.
  if (campaignBuilderId) {
    return (
      <div className={styles.app}>
        <AppSidebar />
        <Suspense fallback={<LazyFallback />}>
          <CampaignBuilder />
        </Suspense>
        <Toaster />
      </div>
    );
  }

  // Shareable form fill-view (#/f/{id}) — focused takeover for respondents.
  if (formViewId) {
    return (
      <div className={styles.app}>
        <Suspense fallback={<LazyFallback />}>
          <FormView />
        </Suspense>
        <Toaster />
      </div>
    );
  }

  // Form Builder is a focused full-screen takeover (no app sidebar — it has its
  // own header + close action that returns to #/settings/content/forms).
  // Rendered whenever the URL is a form-edit route, not only once the store's
  // editingFormId is set, so a reload never flashes the content list first.
  // While the form is still loading (reload, before fetchFormById resolves)
  // show the neutral fallback rather than an empty "Untitled Form" — the
  // not-found path redirects to the list, so this can't spin forever.
  if (editingFormId || onFormBuilderRoute) {
    return (
      <div className={styles.app}>
        <Suspense fallback={<LazyFallback />}>
          {formBuilderForm ? <FormBuilder /> : <LazyFallback />}
        </Suspense>
        <Toaster />
      </div>
    );
  }

  // Agent Builder is a full-screen takeover
  if (activePage === 'builder') {
    return (
      <div className={styles.app}>
        <AppSidebar />
        <Suspense fallback={<LazyFallback />}>
          <AgentCanvas />
        </Suspense>
        <Toaster />
      </div>
    );
  }

  // Wraps the active page in a single Suspense boundary so chart/grid/canvas
  // chunks load without dropping the whole shell. PopulationView is eager
  // (default landing area) so its fallback is a no-op.
  // The sidebar already hides pages a role can't see; this covers a link,
  // a keyboard shortcut or a typed URL that lands on one anyway.
  const pageAllowed = can(navPermissionKey(activePage === 'builder' ? 'settings' : activePage));
  const activeView = !pageAllowed ? <NoAccessView />
    : activePage === 'home' ? <HomeView />
    : activePage === 'messages' ? <MessagesView />
    : activePage === 'calls' ? <CallsView />
    : activePage === 'tasks' ? <TasksView />
    : activePage === 'analytics' ? <AnalyticsView />
    : activePage === 'settings' ? <SettingsView />
    : activePage === 'calendar' ? <CalendarViewPage />
    : activePage === 'campaign' ? <CampaignView />
    : <PopulationView />;

  return (
    <div className={styles.app}>
      <AppSidebar />
      <Suspense fallback={<LazyFallback />}>
        {activeView}
      </Suspense>

      <Suspense fallback={null}>
        {showCreateAgent && <CreateAgentDrawer />}
        <CallPopoverHost />
        <ActiveCallCard />
        <BrowserCallCard />
        <CommsDrawerHost />
        <InvokeAgentModal />
        {detailPatient && <DetailDrawer />}
        {liveDrawerPatient && <LiveDrawer />}
        {goalDetailId && <GoalDetailDrawer />}
        {goalWizardOpen && <GoalWizardDrawer />}
        {componentWizardOpen && <ComponentWizardDrawer />}
        {chatGroupDetailId && <GroupDetailDrawer />}
        {agentRulesGroupId && <AgentRulesDrawer />}
        {businessHoursOpen && <BusinessHoursDrawer />}
        {diagPanelOpen && !diagInSplit && <DiagPanel />}
        <UploadChartDrawer />{/* mounts itself only when hccUploadMember is set */}
        <UploadDocumentDrawer />{/* mounts itself only when hccUploadSession is set */}
        <HccUploadProcessingHost />{/* floats bottom-right while the upload is minimized */}
        <HccSftpReviewDrawer />{/* mounts itself only when hccSftpReviewOpen is true */}
        <HccAddDosDrawer />{/* mounts itself only when hccAddDosMember is set */}
        <AddCareGapsDrawer />{/* mounts itself only when addCareGapsMember is set */}
        <IcdCreationScreen />{/* mounts itself only when icdCreationOpen is true */}
        <ClaimPreviewDrawer />{/* mounts itself only when hccClaimPreview.open is true */}
        {invitePatientOpen && (
          <EditPatientDrawer mode="invite" onClose={closeInvitePatient} />
        )}
        {patientEditSection && patientEditPatient && (
          <EditPatientDrawer
            patient={patientEditPatient}
            initialSection={patientEditSection}
            onClose={closePatientEdit}
          />
        )}
        {quickViewPatient && <QuickViewDrawer />}
        {consentCapture && (
          <CaptureConsentDrawerHost
            key={`${consentCapture.patientId}:${consentCapture.scopeType || ''}:${consentCapture.scope || ''}`}
            {...consentCapture}
            onClose={closeConsentCapture}
          />
        )}
        {consentHistoryPatientId && (
          <ConsentHistoryDrawer key={consentHistoryPatientId} patientId={consentHistoryPatientId} onClose={closeConsentHistory} />
        )}
        {contactConsent && <ContactConsentDialog {...contactConsent} onClose={closeContactConsent} />}
        {assessmentDrawerPatientId && <AssessmentDrawer />}
        {outreachStatusDrawerPatientId && <OutreachStatusDrawer />}
        {aiTasksDrawerPatientId && <AiTasksDrawer />}
        <PgProcessingHost />
        <ReassignmentSummaryHost />{/* opens from a reassignment's "summary is ready" notification */}
        <DesignReviewHost />{/* the floating Design Signoff review box, while a review is active */}
      </Suspense>
      <Toaster />
    </div>
  );
}

// The shared filter bar for TCM / TOC IP and the other generic lists, with the
// saved-filter actions (Go Back to Filter, Save Changes, Copy Filter) for the
// list's selected saved filter.
function WorklistFilterBar(props) {
  const list = useAppStore(s => s.activeSubnavList) || 'TCM';
  const filters = useAppStore(s => s.activeFilters);
  const clearAllFilters = useAppStore(s => s.clearAllFilters);
  const savedActions = useSavedFilterActions(list, filters, clearAllFilters);
  return (
    <FilterBar
      {...props}
      // The primaries that fit show first; added filters follow and wrap.
      autoFit
      pinPrimary
      onClearAll={savedActions.onClearAll}
      clearAllLabel={savedActions.clearAllLabel}
      saveLabel={savedActions.saveLabel}
      saveMenuItems={savedActions.saveMenuItems}
      onSaveMenuSelect={savedActions.onSaveMenuSelect}
      hasActive={savedActions.edited || undefined}
    />
  );
}
