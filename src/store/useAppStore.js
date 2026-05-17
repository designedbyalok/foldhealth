import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { dbToJs, updatesToDb } from '../lib/patientMapper';
import { callDetailDbToJs, callDetailJsToDb } from '../lib/callDetailsMapper';
import { patients as fallbackPatients } from '../data/patients';
import { callDetails as fallbackCallDetails, enrichCallRecord } from '../data/callDetails';
import { goals as fallbackGoalsData } from '../data/goals';
import { chatGroups as fallbackChatGroups } from '../data/chatGroups';
import { generateFlowFromPrompt } from '../lib/flowGenerator';
import { kpiRowToJs, tsRowToJs, tableRowToJs, barRowToJs, configRowToJs, groupTimeSeries } from '../lib/analyticsMapper';
import { domainDbToJs, domainJsToDb, componentDbToJs, componentJsToDb, auditLogDbToJs } from '../lib/embedMapper';
import { FALLBACK_KPIS, FALLBACK_TIME_SERIES, FALLBACK_TABLES, FALLBACK_PROGRESS_BARS, FALLBACK_CONFIGS } from '../data/analyticsFallbacks';
import { FALLBACK_INBOX_ITEMS, FALLBACK_CHANNEL_ITEMS, FALLBACK_CALL_LINES, FALLBACK_CALL_SESSIONS } from '../data/callsConfig';
import { fallbackTasks } from '../data/tasks';
import { updateHash } from '../lib/router';
import { applyTheme, getResolvedTheme, getStoredTheme, subscribeToSystem } from '../lib/theme';
import { createBlock, createBlockTree, collectBlockTree, buildParentMap, cloneBlockTree, extractSubtree, cloneStoredTree } from '../features/email-builder/blockHelpers';
import { makeInitialDocument } from '../features/email-builder/initialDocument';

function parseTaskDateStr(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
  const [m, d, y] = parts;
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isPastDate(str) {
  const d = parseTaskDateStr(str);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function parseDuration(str) {
  const parts = (str || '00:00').split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}
function formatDuration(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function nextDate(lace) {
  const d = new Date();
  d.setDate(d.getDate() + (lace === 'High' ? 7 : lace === 'Medium' ? 14 : 30));
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

// Restore navigation state from sessionStorage on reload
const _savedPage = sessionStorage.getItem('activePage') || 'population';
const _savedTab = sessionStorage.getItem('activeTab') || 'toc-worklist';
const _savedSettingsTab = sessionStorage.getItem('settingsTab');

// Hydrate theme from localStorage so the store agrees with what the
// index.html blocking script already applied to <html>.
const _initialThemeSetting = getStoredTheme();
const _initialResolvedTheme = getResolvedTheme(_initialThemeSetting);

// ── Campaign row mapper ──
// Single source of truth for translating Supabase campaigns rows into the JS
// shape the UI consumes. Used by both fetchCampaigns (bulk load) and the
// CampaignBuilder (after an INSERT / UPDATE returns the row).
function campaignRowToJs(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    channel: row.channel || 'email',
    section: row.section || 'scheduled',
    audience: row.audience || 0,
    dynamic: row.dynamic || false,
    health: row.health,
    delivered: row.delivered,
    opened: row.opened,
    startDate: row.start_date,
    duration: row.duration,
    progress: row.progress || 0,
    executesIn: row.executes_in,
    enabled: row.enabled || false,
    emailTemplate: row.email_template,
    colorVariables: row.color_variables,
    // New Campaign builder fields ───────────────────────────────
    audienceInclude: row.audience_include || [],
    audienceExclude: row.audience_exclude || [],
    sendVia: row.send_via || ['email'],
    startMode: row.start_mode || 'immediately',
    startAt: row.start_at,
    endDate: row.end_date,
    campaignType: row.campaign_type || 'one_time',
    senderName: row.sender_name || '',
    sendFrom: row.send_from || '',
    subjectLine: row.subject_line || '',
  };
}

// Reverse: JS-shape patch → DB-shape patch. Only includes keys present in the
// patch so we never overwrite columns with `undefined`.
const CAMPAIGN_FIELD_MAP = {
  name: 'name',
  description: 'description',
  channel: 'channel',
  section: 'section',
  audience: 'audience',
  enabled: 'enabled',
  audienceInclude: 'audience_include',
  audienceExclude: 'audience_exclude',
  sendVia: 'send_via',
  startMode: 'start_mode',
  startAt: 'start_at',
  endDate: 'end_date',
  campaignType: 'campaign_type',
  senderName: 'sender_name',
  sendFrom: 'send_from',
  subjectLine: 'subject_line',
};
function campaignPatchToDb(patch) {
  const out = {};
  for (const [jsKey, value] of Object.entries(patch)) {
    const dbKey = CAMPAIGN_FIELD_MAP[jsKey];
    if (dbKey) out[dbKey] = value;
  }
  return out;
}

// Debounced auto-save for the Campaign builder. We coalesce rapid field edits
// (typing, slider drags) into one PATCH per 600ms window per campaign id.
const _campaignSaveTimers = new Map();
function scheduleCampaignSave(id, fn) {
  const existing = _campaignSaveTimers.get(id);
  if (existing) clearTimeout(existing);
  _campaignSaveTimers.set(id, setTimeout(() => {
    _campaignSaveTimers.delete(id);
    fn();
  }, 600));
}

export const useAppStore = create((set, get) => ({
  // ─── Theme ───────────────────────────────────────────────────────────
  // `theme` is the user's chosen setting: 'light' | 'dark' | 'system'
  // `resolvedTheme` is what's actually rendered: 'light' | 'dark'
  // (these diverge when theme === 'system' and OS preference is dark)
  theme: _initialThemeSetting,
  resolvedTheme: _initialResolvedTheme,
  setTheme: (next) => {
    const resolved = applyTheme(next);
    set({ theme: next, resolvedTheme: resolved });
  },
  // Called once from main.jsx — wires the OS preference listener
  // so 'system' theme follows live OS dark-mode toggles.
  _initThemeSubscriptions: () => {
    if (get()._themeSubscribed) return;
    set({ _themeSubscribed: true });
    subscribeToSystem(
      () => get().theme,
      (resolved) => set({ resolvedTheme: resolved })
    );
  },
  _themeSubscribed: false,

  // Pending add-task request — set by CreateNewPopover or WorklistRow "Add Task"
  pendingAddTask: null,

  // Top-level navigation (sidebar) — restored from sessionStorage
  activePage: _savedPage === 'builder' ? 'settings' : _savedPage,
  // Tab navigation within pages
  activeTab: _savedTab,
  subnavCollapsed: false,
  viewBy: 'window',

  // Sticky Notes
  stickyNotes: [],
  stickyNoteHistory: [],
  quickNotes: [],
  quickNoteHistory: [],
  fetchStickyNotes: async (patientId) => {
    const { data } = await supabase.from('sticky_notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: true });
    if (data) set({ stickyNotes: data });
  },
  fetchStickyNoteHistory: async (patientId) => {
    const { data } = await supabase.from('sticky_note_history').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
    if (data) set({ stickyNoteHistory: data });
  },
  createStickyNote: async (note) => {
    const { data, error } = await supabase.from('sticky_notes').insert(note).select().single();
    if (!error && data) {
      await supabase.from('sticky_note_history').insert({ sticky_note_id: data.id, patient_id: note.patient_id, author_name: note.author_name || 'You', action: 'added a Note', note_text: note.text, ehr_instance: note.ehr_profile || 'Central Profile' });
      get().fetchStickyNotes(note.patient_id);
      get().fetchStickyNoteHistory(note.patient_id);
    }
    return data;
  },
  updateStickyNote: async (id, updates, patientId) => {
    await supabase.from('sticky_notes').update(updates).eq('id', id);
    if (patientId) {
      await supabase.from('sticky_note_history').insert({ sticky_note_id: id, patient_id: patientId, author_name: updates.author_name || 'You', action: 'Updated a Note', note_text: updates.text, ehr_instance: updates.ehr_profile || 'Central Profile' });
      get().fetchStickyNotes(patientId);
      get().fetchStickyNoteHistory(patientId);
    }
  },
  deleteStickyNote: async (id, patientId) => {
    // Log the deletion as an audit activity before removing the note
    const { data: noteData } = await supabase.from('sticky_notes').select('*').eq('id', id).maybeSingle();
    if (noteData) {
      await supabase.from('sticky_note_history').insert({
        sticky_note_id: id,
        patient_id: patientId || noteData.patient_id,
        author_name: 'You',
        action: 'deleted a Note',
        note_text: noteData.text,
        ehr_instance: noteData.ehr_profile || 'Central Profile',
      });
    }
    await supabase.from('sticky_notes').delete().eq('id', id);
    if (patientId) {
      get().fetchStickyNotes(patientId);
      get().fetchStickyNoteHistory(patientId);
    }
  },

  // Quick Notes (global / home page)
  fetchQuickNotes: async () => {
    const { data } = await supabase.from('sticky_notes').select('*').eq('patient_id', 'global').order('created_at', { ascending: false });
    if (data) set({ quickNotes: data });
  },
  fetchQuickNoteHistory: async () => {
    const { data } = await supabase.from('sticky_note_history').select('*').eq('patient_id', 'global').order('created_at', { ascending: false });
    if (data) set({ quickNoteHistory: data });
  },
  createQuickNote: async (text) => {
    const note = { patient_id: 'global', text, author_name: 'You', ehr_profile: 'Quick Note' };
    const { data, error } = await supabase.from('sticky_notes').insert(note).select().single();
    if (!error && data) {
      await supabase.from('sticky_note_history').insert({ sticky_note_id: data.id, patient_id: 'global', author_name: 'You', action: 'added a Note', note_text: text, ehr_instance: 'Quick Note' });
      get().fetchQuickNotes();
      get().fetchQuickNoteHistory();
    }
    return data;
  },
  updateQuickNote: async (id, text) => {
    await supabase.from('sticky_notes').update({ text, author_name: 'You' }).eq('id', id);
    await supabase.from('sticky_note_history').insert({ sticky_note_id: id, patient_id: 'global', author_name: 'You', action: 'Updated a Note', note_text: text, ehr_instance: 'Quick Note' });
    get().fetchQuickNotes();
    get().fetchQuickNoteHistory();
  },
  deleteQuickNote: async (id) => {
    const { data: noteData } = await supabase.from('sticky_notes').select('*').eq('id', id).maybeSingle();
    if (noteData) {
      await supabase.from('sticky_note_history').insert({ sticky_note_id: id, patient_id: 'global', author_name: 'You', action: 'deleted a Note', note_text: noteData.text, ehr_instance: 'Quick Note' });
    }
    await supabase.from('sticky_notes').delete().eq('id', id);
    get().fetchQuickNotes();
    get().fetchQuickNoteHistory();
  },

  // P360 Profile data
  p360Profile: null,
  p360Loading: false,
  fetchP360Profile: async (patientId) => {
    set({ p360Loading: true });
    try {
      const { data, error } = await supabase
        .from('p360_profiles')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle();
      if (!error && data) {
        set({ p360Profile: data });
      } else {
        set({ p360Profile: null });
      }
    } catch {
      set({ p360Profile: null });
    }
    set({ p360Loading: false });
  },
  updateP360Profile: async (patientId, updates) => {
    const { error } = await supabase
      .from('p360_profiles')
      .update(updates)
      .eq('patient_id', patientId);
    if (!error) {
      // Refresh
      get().fetchP360Profile(patientId);
    }
    return !error;
  },

  // Patient detail view
  selectedPatientId: null,
  patientProfileTab: 'Care Management',
  navigateToPatient: (patientId) => {
    set({ selectedPatientId: patientId });
    const state = get();
    if (state.activePage !== 'population') set({ activePage: 'population' });
    import('../lib/router').then(m => m.updateHash?.(get()));
  },
  navigateBackToWorklist: () => {
    set({ selectedPatientId: null });
    import('../lib/router').then(m => m.updateHash?.(get()));
  },
  setPatientProfileTab: (tab) => set({ patientProfileTab: tab }),

  // Table
  patients: [],
  patientsLoading: true,
  patientsError: null,
  selectedIds: [],
  currentPage: 1,
  perPage: 10,
  searchQuery: '',

  // Filters
  activeFilters: {},  // { gender: 'F', language: 'es', lace: 'High', ... }
  activeSubnavList: 'TOC',  // which SubNav list is selected

  // Call Details
  _allCallDetails: [],   // full sorted dataset (DB + supplemental local)
  callDetails: [],
  callDetailsLoading: true,
  callDetailsHasMore: false,

  // Calls UI config (nav items, phone lines, session list) — loaded from Supabase
  callNavItems: [],       // inbox + channel nav items
  callLines: [],          // phone line dropdown options
  callSessions: [],       // middle-panel call list
  callsConfigLoading: true,

  // System Health (Phase 3)
  systemHealth: { ehr: 'ok', retell: 'ok', redis: 'ok', supabase: 'ok' },

  // Goals Directory
  goalsData: null, // null = not yet loaded, array = loaded from DB/fallback
  goalsLoading: true,
  goalDetailId: null,
  goalWizardOpen: false,
  goalWizardEditId: null,

  // Settings navigation (left subnav)
  settingsNavItem: sessionStorage.getItem('settingsNavItem') || 'agents',

  // Messages section
  messageTab: 'chat-settings',
  messagesUnreadCount: 0,
  pendingChatUserEmail: null,

  // Chat Groups (Messages > Chat Settings)
  chatGroupsData: null,
  chatGroupsLoading: true,
  chatGroupDetailId: null,
  agentRulesGroupId: null,
  businessHoursOpen: false,

  // Embedded Components
  embeddedComponentsTab: 'domain-registry',
  accountTab: 'users',
  componentWizardOpen: false,
  componentWizardEditId: null,
  componentPreviewId: null,

  // Agents (settings)
  agents: [],
  agentsLoading: true,
  settingsTab: _savedSettingsTab || 'agents',
  showCreateAgent: false,

  // Agent Builder (canvas)
  builderAgent: null,       // { id, name, prompt } of the agent being edited
  builderFlow: null,        // { id, nodes, edges, viewport, version }
  builderFlowLoading: false,
  builderSelectedNode: null, // id of currently selected node
  _pendingAgentId: null,    // set by router on refresh — triggers re-open in AppLayout
  _pendingCampaignBuilderId: null, // set by router on refresh — triggers campaign builder open
  _pendingEmailEditId: null,       // set by router on refresh — triggers email builder open
  builderVersions: [],      // list of saved versions
  builderPrompt: '',        // original creation prompt
  builderConfig: null,      // agent_config row for current agent
  builderConfigLoading: false,

  // UI state
  workflowPatient: null,
  workflowStep: 0,
  stepStates: {},
  callPopoverPatient: null,
  callPopoverBtnRef: null,
  outreachPopoverPatient: null,
  activeCallPatient: null,
  activeCallSeconds: 0,
  activeCallTimerRef: null,
  showInvokeModal: false,
  showCreateNew: false,
  showFilterBar: false,
  toast: null,
  toastSuccess: false,
  queueTabDot: false,
  callTimerRef: null,
  detailPatient: null,
  detailPatientCalls: [],
  activeCallRow: null,
  liveDrawerPatient: null,

  // ─── Supabase: Fetch patients ───
  fetchPatients: async () => {
    set({ patientsLoading: true, patientsError: null });
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Supabase patients fetch failed:', error.message);
      set({
        patients: [],
        patientsLoading: false,
        patientsError: error.message,
      });
    } else {
      // Build maps for merging: in-memory state (from active invocations) + fallback seed data
      const existing = get().patients;
      const overrides = {};
      for (const ep of existing) {
        if (ep.agentAssigned) overrides[ep.id] = ep;
      }
      const fallbackMap = {};
      for (const fp of fallbackPatients) {
        if (fp.agentAssigned) fallbackMap[fp.id] = fp;
      }

      const patients = data.map(dbToJs).map(p => {
        const isPeter = p.name === 'Peter Kim' || p.id === 'p11';
        const mem = overrides[p.id];
        const fb = fallbackMap[p.id];
        return {
          ...p,
          name: isPeter ? 'Clara Mitchell' : p.name,
          initials: isPeter ? 'CM' : p.initials,
          // Priority: in-memory invoke state > DB state > fallback seed data
          agentAssigned: mem?.agentAssigned || p.agentAssigned || fb?.agentAssigned || '',
          agentRole: mem?.agentRole || p.agentRole || fb?.agentRole || '',
          onCall: mem ? mem.onCall : (p.onCall || fb?.onCall || false),
          status: mem ? mem.status : (p.status !== 'scheduled' ? p.status : fb?.status || p.status),
          callDuration: mem ? mem.callDuration : (p.callDuration || fb?.callDuration),
          nextAction: mem?.nextAction || p.nextAction || fb?.nextAction,
        };
      });
      // Sort by numeric part of id (p1, p2, ... p10, p11, ...)
      patients.sort((a, b) => {
        const na = parseInt(a.id.replace(/\D/g, ''), 10);
        const nb = parseInt(b.id.replace(/\D/g, ''), 10);
        return na - nb;
      });
      set({
        patients,
        patientsLoading: false,
      });
    }
  },

  // ─── Supabase: Fetch call details — all records, client-side pagination ───
  fetchCallDetails: async () => {
    const PAGE_SIZE = 10;
    set({ callDetailsLoading: true });

    const { data, error } = await supabase
      .from('call_details')
      .select('*')
      .neq('call_type', 'ongoing')
      .order('started_at', { ascending: false });

    let combined;
    if (error) {
      console.warn('call_details fetch failed, using fallback:', error.message);
      combined = fallbackCallDetails
        .filter(c => c.callType !== 'ongoing')
        .map(enrichCallRecord);
    } else {
      const dbRecords = data.map(c => enrichCallRecord(callDetailDbToJs(c)));
      const dbIds = new Set(dbRecords.map(r => r.id));
      // Supplement with local-only records (incoming, declined) not yet seeded to DB
      const supplemental = fallbackCallDetails
        .filter(c => c.callType !== 'ongoing' && !dbIds.has(c.id))
        .map(enrichCallRecord);
      combined = [...dbRecords, ...supplemental];
    }

    // Sort by startedAt desc — naturally mixes call types by date
    combined.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));

    set({
      _allCallDetails: combined,
      callDetails: combined.slice(0, PAGE_SIZE),
      callDetailsLoading: false,
      callDetailsHasMore: combined.length > PAGE_SIZE,
    });
  },

  fetchMoreCallDetails: () => {
    const { _allCallDetails, callDetails, callDetailsLoading } = get();
    if (callDetailsLoading) return;
    const PAGE_SIZE = 10;
    const offset = callDetails.length;
    if (offset >= _allCallDetails.length) return;
    set(s => ({
      callDetails: [...s.callDetails, ..._allCallDetails.slice(offset, offset + PAGE_SIZE)],
      callDetailsHasMore: offset + PAGE_SIZE < _allCallDetails.length,
    }));
  },

  // ─── Supabase: Fetch calls UI config (nav items, phone lines, session list) ───
  fetchCallsConfig: async () => {
    set({ callsConfigLoading: true });
    const [navRes, linesRes, sessRes] = await Promise.allSettled([
      supabase.from('call_nav_items').select('*').order('sort_order'),
      supabase.from('call_lines').select('*').order('sort_order'),
      supabase.from('call_sessions').select('*').order('created_at'),
    ]);

    const mapNav = row => ({
      id: row.id,
      section: row.section,
      icon: row.icon || null,
      label: row.label,
      isCustomIcon: row.is_custom_icon,
      sortOrder: row.sort_order,
    });
    const mapLine = row => ({ id: row.id, label: row.label, phoneNumber: row.phone_number });
    const mapSession = row => ({
      id: row.id,
      name: row.name === 'Williamy Jammy' ? 'Clara Mitchell' : row.name,
      status: row.status,
      time: row.time, dir: row.dir, pinned: row.pinned, active: row.active,
    });

    const navData = navRes.status === 'fulfilled' ? (navRes.value.data || []) : [];
    const linesData = linesRes.status === 'fulfilled' ? (linesRes.value.data || []) : [];
    const sessData = sessRes.status === 'fulfilled' ? (sessRes.value.data || []) : [];

    const allNav = navData.map(mapNav);
    set({
      callNavItems: allNav.filter(i => i.section === 'inbox').length
        ? allNav
        : [...FALLBACK_INBOX_ITEMS, ...FALLBACK_CHANNEL_ITEMS],
      callLines: linesData.length ? linesData.map(mapLine) : FALLBACK_CALL_LINES,
      callSessions: sessData.length ? sessData.map(mapSession) : FALLBACK_CALL_SESSIONS,
      callsConfigLoading: false,
    });
  },

  // Helper: get call records for a patient
  getCallsForPatient: (patientId) => {
    return get().callDetails.filter(c => c.patientId === patientId);
  },

  // Helper: get latest call of a specific type
  getLatestCall: (patientId, callType) => {
    return get().callDetails.find(c => c.patientId === patientId && c.callType === callType);
  },

  // Create a new call record (on agent invoke)
  createCallRecord: (record) => {
    set(s => ({ callDetails: [enrichCallRecord(record), ...s.callDetails] }));
    // Persist to Supabase in background
    supabase.from('call_details').insert(callDetailJsToDb(record)).then(({ error }) => {
      if (error) console.warn('Failed to persist call record:', error.message);
    });
  },

  // Update an existing call record
  updateCallRecord: (callId, updates) => {
    set(s => ({
      callDetails: s.callDetails.map(c => c.id === callId ? { ...c, ...updates } : c)
    }));
  },

  // ─── Supabase: Persist a patient update ───
  persistPatient: async (id, updates) => {
    const dbUpdates = updatesToDb(updates);
    const { error } = await supabase
      .from('patients')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Failed to persist patient update:', error.message);
    }
  },

  // Actions
  setActivePage: (page) => { sessionStorage.setItem('activePage', page); set({ activePage: page }); updateHash(get); },

  // Navigation guard for full-screen takeovers. When the user clicks a Sidebar
  // entry while the EmailBuilder or CampaignBuilder is open, we don't want the
  // page to silently change underneath them — instead we ask the open builder
  // to handle the navigation, including any unsaved-changes confirmation it
  // owns. `pendingNavTarget` is the page we're trying to reach; the builder
  // clears it once it has decided what to do.
  pendingNavTarget: null,
  setPendingNavTarget: (page) => set({ pendingNavTarget: page }),
  requestNavigate: (page) => {
    const s = get();
    // Email Builder takeover — defer to its unsaved-changes flow.
    if (s.editingCampaignId) {
      set({ pendingNavTarget: page });
      return;
    }
    // Campaign Builder takeover — auto-saved on every edit, so we can close
    // and navigate immediately.
    if (s.campaignBuilderId) {
      set({ campaignBuilderId: null });
      sessionStorage.setItem('activePage', page);
      set({ activePage: page });
      updateHash(get);
      return;
    }
    // No takeover open — plain navigation.
    sessionStorage.setItem('activePage', page);
    set({ activePage: page });
    updateHash(get);
  },
  requestAddTask: (opts = {}) => {
    sessionStorage.setItem('activePage', 'tasks');
    set({ activePage: 'tasks', pendingAddTask: { member: opts.member || null } });
    updateHash(get);
  },
  clearPendingAddTask: () => set({ pendingAddTask: null }),
  setActiveTab: (tab) => { sessionStorage.setItem('activeTab', tab); set({ activeTab: tab }); updateHash(get); },
  setSettingsTab: (tab) => { sessionStorage.setItem('settingsTab', tab); set({ settingsTab: tab }); updateHash(get); },
  setShowCreateAgent: (v) => set({ showCreateAgent: v }),

  // Settings nav
  setSettingsNavItem: (item) => { sessionStorage.setItem('settingsNavItem', item); set({ settingsNavItem: item }); updateHash(get); },

  // Chat Groups actions
  setMessagesUnreadCount: (n) => set({ messagesUnreadCount: n }),
  setPendingChatUserEmail: (email) => set({ pendingChatUserEmail: email }),
  setMessageTab: (tab) => { set({ messageTab: tab }); updateHash(get); },
  setChatGroupDetailId: (id) => { set({ chatGroupDetailId: id }); updateHash(get); },
  setAgentRulesGroupId: (id) => { set({ agentRulesGroupId: id }); updateHash(get); },
  setBusinessHoursOpen: (open) => { set({ businessHoursOpen: open }); updateHash(get); },

  setEmbeddedComponentsTab: (tab) => { set({ embeddedComponentsTab: tab }); updateHash(get); },
  setAccountTab: (tab) => { set({ accountTab: tab }); updateHash(get); },
  setComponentWizard: (open, editId = null) => { set({ componentWizardOpen: open, componentWizardEditId: editId }); },
  setComponentPreviewId: (id) => { set({ componentPreviewId: id }); },

  fetchChatGroups: async () => {
    set({ chatGroupsLoading: true });
    const { data, error } = await supabase
      .from('chat_groups')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('chat_groups fetch failed, using fallback:', error.message);
      console.warn('Supabase chat_groups fetch failed:', error.message);
      set({ chatGroupsData: [], chatGroupsLoading: false });
    } else {
      const mapped = data.map(row => ({
        id: row.id,
        name: row.name,
        users: row.users || [],
        roles: row.roles || [],
        location: row.location || 'Global Template',
        updated: row.updated_at ? new Date(row.updated_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '',
        updatedBy: row.updated_by || '',
        activeChats: row.active_chats || 0,
        hasAgent: row.has_agent || false,
        agentName: row.agent_name || '',
      }));
      set({ chatGroupsData: mapped, chatGroupsLoading: false });
    }
  },

  addChatGroup: async (group) => {
    const row = {
      name: group.name,
      users: group.users || [],
      roles: group.roles || [],
      location: group.location || 'Global Template',
      updated_by: group.updatedBy || '',
      active_chats: 0,
      has_agent: group.hasAgent || false,
      agent_name: group.agentName || null,
    };
    let { data, error } = await supabase.from('chat_groups').insert(row).select();
    if (error) {
      console.warn('Failed to create chat group:', error.message);
      // Show user feedback
      get().showToast?.('Failed to save group. Please try again.');
      return;
    }
    if (data?.[0]) {
      const newGroup = {
        id: data[0].id, name: data[0].name, users: data[0].users || [], roles: data[0].roles || [],
        location: data[0].location, updated: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        updatedBy: data[0].updated_by || '', activeChats: 0, hasAgent: data[0].has_agent, agentName: data[0].agent_name || '',
      };
      set(s => ({ chatGroupsData: [newGroup, ...(s.chatGroupsData || [])] }));
      get().logAudit('ChatGroup', newGroup.id, newGroup.name, 'created', `Chat group created`, 'Lifecycle');
    }
  },

  updateChatGroup: async (id, updates) => {
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.users !== undefined) dbUpdates.users = updates.users;
    if (updates.roles !== undefined) dbUpdates.roles = updates.roles;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.hasAgent !== undefined) dbUpdates.has_agent = updates.hasAgent;
    if (updates.agentName !== undefined) dbUpdates.agent_name = updates.agentName;
    dbUpdates.updated_at = new Date().toISOString();
    const { error } = await supabase.from('chat_groups').update(dbUpdates).eq('id', id);
    if (error) { console.warn('Failed to update chat group:', error.message); return; }
    set(s => ({
      chatGroupsData: (s.chatGroupsData || []).map(g => g.id === id ? {
        ...g, ...updates,
        updated: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      } : g),
    }));
    const group = (get().chatGroupsData || []).find(g => g.id === id);
    get().logAudit('ChatGroup', id, group?.name || '', 'updated', Object.keys(updates).join(', ') + ' changed', 'Configuration');
  },

  deleteChatGroup: async (id) => {
    const group = (get().chatGroupsData || []).find(g => g.id === id);
    set(s => ({ chatGroupsData: (s.chatGroupsData || []).filter(g => g.id !== id) }));
    const { error } = await supabase.from('chat_groups').delete().eq('id', id);
    if (error) console.warn('Failed to delete chat group:', error.message);
    if (group) get().logAudit('ChatGroup', id, group.name, 'deleted', 'Chat group deleted', 'Lifecycle');
  },

  // Knowledge Base add trigger (used by AgentsTable to tell KnowledgeBasePanel to open add form)
  kbAddTrigger: false,
  setKbAddTrigger: (v) => set({ kbAddTrigger: v }),

  // Domain Registry add trigger (used by EmbeddedComponentsSettings to tell DomainRegistryPanel to open add modal)
  domainAddTrigger: false,
  setDomainAddTrigger: (v) => set({ domainAddTrigger: v }),

  // ── Embed Domains (Supabase-backed) ──
  embedDomains: [],
  embedDomainsLoading: false,
  fetchEmbedDomains: async () => {
    set({ embedDomainsLoading: true });
    const { data, error } = await supabase.from('embed_domains').select('*').order('id');
    if (error) { console.warn('[store] embed_domains fetch failed:', error.message); set({ embedDomainsLoading: false }); return; }
        set({ embedDomains: (data || []).map(domainDbToJs), embedDomainsLoading: false });
  },
  addEmbedDomain: async (domain) => {
    // Check for duplicate domain
    const existing = get().embedDomains.find(d => d.domain?.toLowerCase() === domain.domain?.toLowerCase());
    if (existing) {
      get().showToast(`Domain "${domain.domain}" is already registered`);
      return null;
    }
    const row = domainJsToDb(domain);
    const { data, error } = await supabase.from('embed_domains').insert(row).select();
    if (error) {
      console.warn('[store] addEmbedDomain failed:', error.message);
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        get().showToast(`Domain "${domain.domain}" already exists`);
      } else {
        get().showToast(`Failed to register domain: ${error.message}`);
      }
      return null;
    }
        const newDomain = domainDbToJs(data[0]);
    set(s => ({ embedDomains: [newDomain, ...s.embedDomains] }));
    get().logAudit('Domain', newDomain.id, newDomain.domain, 'created', `Registered — category: ${newDomain.category}, HIPAA: ${newDomain.hipaa}`, 'Lifecycle');
    return newDomain;
  },
  updateEmbedDomain: async (id, updates) => {
    const oldDomain = get().embedDomains.find(d => d.id === id);
    const dbUpdates = domainJsToDb(updates);
    await supabase.from('embed_domains').update(dbUpdates).eq('id', id);
    set(s => ({ embedDomains: s.embedDomains.map(d => d.id === id ? { ...d, ...updates } : d) }));
    const changes = [];
    if (oldDomain) {
      for (const key of Object.keys(updates)) {
        if (oldDomain[key] !== updates[key]) {
          changes.push({ field: key, from: String(oldDomain[key] || ''), to: String(updates[key] || ''), type: key === 'enabled' ? 'status' : 'text' });
        }
      }
    }
    get().logAudit('Domain', id, oldDomain?.domain || '', 'updated', Object.keys(updates).join(', ') + ' changed', 'Configuration', changes);
  },
  deleteEmbedDomain: async (id) => {
    // Block deletion if components reference this domain
    const compsUsingDomain = get().embedComponents.filter(c => c.domainId === id);
    if (compsUsingDomain.length > 0) {
      get().showToast(`Cannot delete — ${compsUsingDomain.length} component(s) use this domain. Remove or reassign them first.`);
      return false;
    }
    const domain = get().embedDomains.find(d => d.id === id);
    await supabase.from('embed_domains').delete().eq('id', id);
    set(s => ({ embedDomains: s.embedDomains.filter(d => d.id !== id) }));
    if (domain) get().logAudit('Domain', id, domain.domain, 'deleted', `Domain removed`, 'Lifecycle');
    return true;
  },
  toggleEmbedDomain: async (id) => {
    const domain = get().embedDomains.find(d => d.id === id);
    if (!domain) return;
    const newEnabled = !domain.enabled;
    await supabase.from('embed_domains').update({ enabled: newEnabled }).eq('id', id);
    set(s => ({ embedDomains: s.embedDomains.map(d => d.id === id ? { ...d, enabled: newEnabled } : d) }));
    get().logAudit('Domain', id, domain.domain, newEnabled ? 'enabled' : 'disabled', newEnabled ? 'Domain enabled' : 'Domain disabled', 'Status',
      [{ field: 'enabled', from: domain.enabled ? 'Enabled' : 'Disabled', to: newEnabled ? 'Enabled' : 'Disabled', type: 'status' }]);
  },

  // ── Embed Components (Supabase-backed) ──
  embedComponents: [],
  embedComponentsLoading: false,
  fetchEmbedComponents: async () => {
    set({ embedComponentsLoading: true });
    const { data, error } = await supabase.from('embed_components').select('*').order('id');
    if (error) { console.warn('[store] embed_components fetch failed:', error.message); set({ embedComponentsLoading: false }); return; }
        set({ embedComponents: (data || []).map(componentDbToJs), embedComponentsLoading: false });
  },
  addEmbedComponent: async (comp) => {
        const row = componentJsToDb(comp);
    const { data, error } = await supabase.from('embed_components').insert(row).select();
    if (error) { console.warn('[store] addEmbedComponent failed:', error.message); return null; }
        const newComp = componentDbToJs(data[0]);
    set(s => ({ embedComponents: [newComp, ...s.embedComponents] }));
    get().logAudit('Component', newComp.id, newComp.name, 'created', `Created on domain ${newComp.domain}`, 'Lifecycle');
    return newComp;
  },
  updateEmbedComponent: async (id, updates) => {
    const oldComp = get().embedComponents.find(c => c.id === id);
    const dbUpdates = componentJsToDb(updates);
    await supabase.from('embed_components').update(dbUpdates).eq('id', id);
    set(s => ({ embedComponents: s.embedComponents.map(c => c.id === id ? { ...c, ...updates } : c) }));
    // Build structured changes for rich audit log
    const changes = [];
    if (oldComp) {
      const trackFields = ['name', 'category', 'description', 'domain', 'url', 'visibleTo', 'activation', 'tokenLifetime', 'enabled'];
      for (const key of trackFields) {
        if (updates[key] !== undefined && String(oldComp[key] || '') !== String(updates[key] || '')) {
          changes.push({ field: key, from: String(oldComp[key] || ''), to: String(updates[key] || ''), type: key === 'enabled' ? 'status' : 'text' });
        }
      }
    }
    get().logAudit('Component', id, oldComp?.name || '', 'updated', Object.keys(updates).join(', ') + ' changed', 'Configuration', changes);
  },
  deleteEmbedComponent: async (id) => {
    const comp = get().embedComponents.find(c => c.id === id);
    await supabase.from('embed_components').delete().eq('id', id);
    set(s => ({ embedComponents: s.embedComponents.filter(c => c.id !== id) }));
    if (comp) get().logAudit('Component', id, comp.name, 'deleted', `Component removed`, 'Lifecycle');
  },
  toggleEmbedComponent: async (id) => {
    const comp = get().embedComponents.find(c => c.id === id);
    if (!comp) return;
    const newEnabled = !comp.enabled;
    await supabase.from('embed_components').update({ enabled: newEnabled }).eq('id', id);
    set(s => ({ embedComponents: s.embedComponents.map(c => c.id === id ? { ...c, enabled: newEnabled } : c) }));
    get().logAudit('Component', id, comp.name, newEnabled ? 'enabled' : 'disabled', newEnabled ? 'Component enabled' : 'Component disabled', 'Status',
      [{ field: 'enabled', from: comp.enabled ? 'Enabled' : 'Disabled', to: newEnabled ? 'Enabled' : 'Disabled', type: 'status' }]);
  },
  duplicateEmbedComponent: async (id) => {
    const comp = get().embedComponents.find(c => c.id === id);
    if (!comp) return null;
        const dup = { ...comp, name: comp.name + ' (Copy)', enabled: false, id: undefined };
    const row = componentJsToDb(dup);
    delete row.id;
    const { data, error } = await supabase.from('embed_components').insert(row).select();
    if (error) { console.warn('[store] duplicateEmbedComponent failed:', error.message); return null; }
        const newComp = componentDbToJs(data[0]);
    set(s => ({ embedComponents: [...s.embedComponents, newComp] }));
    get().logAudit('Component', newComp.id, newComp.name, 'created', `Duplicated from "${comp.name}"`, 'Lifecycle');
    return newComp;
  },

  // ── Audit Log (Supabase-backed) ──
  // changes: JSON string of [{field, from, to, type}] for rich diff display
  logAudit: async (entityType, entityId, entityName, action, details, category, changes) => {
    // Get the current user's full name from Supabase auth
    let userName = 'Current User';
    try {
      const { data } = await supabase.auth.getUser();
      const meta = data?.user?.user_metadata || {};
      if (meta.first_name && meta.last_name) userName = `${meta.first_name} ${meta.last_name}`;
      else if (meta.full_name) userName = meta.full_name;
      else if (data?.user?.email) userName = data.user.email.split('@')[0];
    } catch (e) { /* fallback to Current User */ }
    const row = {
      entity_type: entityType, entity_id: String(entityId), entity_name: entityName,
      action, user_name: userName, details: details || null,
      category: category || null,
    };
    // Store changes in the details field as JSON if provided
    if (changes && changes.length > 0) {
      row.details = JSON.stringify({ text: details, changes });
    }
    const { error } = await supabase.from('audit_logs').insert(row);
    if (error) console.warn('[store] logAudit failed:', error.message);
  },
  fetchAuditLogs: async (entityType, entityId) => {
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    const { data, error } = await query.limit(100);
    if (error) { console.warn('[store] fetchAuditLogs failed:', error.message); return []; }
        return (data || []).map(auditLogDbToJs);
  },

  // FAQs
  faqsData: null,
  fetchFaqs: async () => {
    const { data, error } = await supabase.from('faqs').select('*').order('id');
    if (error) { console.warn('[store] faqs fetch failed:', error.message); return; }
    set({ faqsData: data.map(r => ({ id: r.id, question: r.question, answer: r.answer, category: r.category, updatedAt: r.updated_at || r.created_at })) });
  },
  addFaq: async (faq) => {
    const row = { question: faq.question, answer: faq.answer, category: faq.category };
    const { data, error } = await supabase.from('faqs').insert(row).select();
    if (!error && data && data[0]) {
      const r = data[0];
      set(s => ({ faqsData: [...(s.faqsData || []), { id: r.id, question: r.question, answer: r.answer, category: r.category, updatedAt: new Date(r.updated_at || r.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) }] }));
    }
  },
  updateFaq: async (id, updates) => {
    const now = new Date().toISOString();
    await supabase.from('faqs').update({ ...updates, updated_at: now }).eq('id', id);
    set(s => ({ faqsData: (s.faqsData || []).map(f => f.id === id ? { ...f, ...updates, updatedAt: new Date(now).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) } : f) }));
  },
  deleteFaq: async (id) => {
    await supabase.from('faqs').delete().eq('id', id);
    set(s => ({ faqsData: (s.faqsData || []).filter(f => f.id !== id) }));
  },

  // Agent Rules
  agentRulesData: null,
  fetchAgentRules: async () => {
    const { data, error } = await supabase.from('agent_rules').select('*').order('sort_order');
    if (error) { console.warn('[store] agent_rules fetch failed:', error.message); return; }
    set({ agentRulesData: data.map(r => ({ id: r.id, name: r.name, type: r.type, locked: r.locked, enabled: r.enabled, condition: r.condition_text, action: r.action_text, priority: r.priority_label, sortOrder: r.sort_order })) });
  },
  addAgentRule: async (rule) => {
    const row = { name: rule.name, type: 'custom', locked: false, enabled: true, condition_text: rule.condition, action_text: rule.action, sort_order: rule.sortOrder || 99 };
    const { data, error } = await supabase.from('agent_rules').insert(row).select();
    if (!error && data) {
      const mapped = { id: data[0].id, name: data[0].name, type: 'custom', locked: false, enabled: true, condition: data[0].condition_text, action: data[0].action_text, sortOrder: data[0].sort_order };
      set(s => ({ agentRulesData: [...(s.agentRulesData || []), mapped] }));
    }
  },
  updateAgentRule: async (id, updates) => {
    const dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.enabled !== undefined) dbUpdates.enabled = updates.enabled;
    if (updates.condition !== undefined) dbUpdates.condition_text = updates.condition;
    if (updates.action !== undefined) dbUpdates.action_text = updates.action;
    await supabase.from('agent_rules').update(dbUpdates).eq('id', id);
    set(s => ({ agentRulesData: (s.agentRulesData || []).map(r => r.id === id ? { ...r, ...updates } : r) }));
  },
  deleteAgentRule: async (id) => {
    await supabase.from('agent_rules').delete().eq('id', id);
    set(s => ({ agentRulesData: (s.agentRulesData || []).filter(r => r.id !== id) }));
  },

  // Chat Participants
  participantsData: null,
  fetchParticipants: async () => {
    const { data, error } = await supabase.from('chat_participants').select('*').order('id');
    if (error) { console.warn('[store] chat_participants fetch failed:', error.message); return; }
    set({ participantsData: data.map(r => ({ id: r.id, name: r.name, role: r.role, type: r.type, isAgent: r.is_agent })) });
  },

  // Business Hours
  businessHoursData: null,
  fetchBusinessHoursData: async () => {
    const { data, error } = await supabase.from('business_hours').select('*').order('id');
    if (error) { console.warn('[store] business_hours fetch failed:', error.message); return; }
    set({ businessHoursData: data.map(r => ({ id: r.id, day: r.day_of_week, available: r.available, slots: r.slots })) });
  },
  updateBusinessHoursDay: async (id, updates) => {
    const dbUpdates = {};
    if (updates.available !== undefined) dbUpdates.available = updates.available;
    if (updates.slots !== undefined) dbUpdates.slots = updates.slots;
    await supabase.from('business_hours').update(dbUpdates).eq('id', id);
    set(s => ({ businessHoursData: (s.businessHoursData || []).map(d => d.id === id ? { ...d, ...updates } : d) }));
  },

  // Holidays
  holidaysData: null,
  fetchHolidays: async () => {
    const { data, error } = await supabase.from('holidays').select('*').order('date');
    if (error) { console.warn('[store] holidays fetch failed:', error.message); return; }
    set({ holidaysData: data.map(r => ({ id: r.id, date: r.date, name: r.name })) });
  },
  addHoliday: async (holiday) => {
    const { data, error } = await supabase.from('holidays').insert({ date: holiday.date, name: holiday.name }).select();
    if (!error && data) set(s => ({ holidaysData: [...(s.holidaysData || []), { id: data[0].id, date: data[0].date, name: data[0].name }] }));
  },
  deleteHoliday: async (id) => {
    await supabase.from('holidays').delete().eq('id', id);
    set(s => ({ holidaysData: (s.holidaysData || []).filter(h => h.id !== id) }));
  },

  // Goals actions
  setGoalDetailId: (id) => { set({ goalDetailId: id }); updateHash(get); },
  setGoalWizard: (open, editId) => { set({ goalWizardOpen: open, goalWizardEditId: editId || null }); updateHash(get); },

  fetchGoals: async () => {
    set({ goalsLoading: true });
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('goals fetch failed, using fallback:', error.message);
      set({ goalsData: fallbackGoalsData, goalsLoading: false });
    } else {
      // Map DB snake_case → JS camelCase
      const mapped = data.map(row => ({
        id: row.id,
        name: row.name,
        program: row.program,
        programColor: row.program_color || (row.program === 'TCM' ? 'purple' : row.program === 'Outreach' ? 'blue' : 'amber'),
        description: row.description || '',
        status: row.status || 'draft',
        weightedScoring: row.weighted_scoring || false,
        passingScore: row.passing_score || 100,
        mode: row.mode || 'all-mandatory',
        steps: row.steps || [],
        successMetrics: row.success_metrics || [],
        agents: row.agents || [],
        completionRate: row.completion_rate || 0,
        totalRuns: row.total_runs || 0,
        created: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      }));
      set({ goalsData: mapped, goalsLoading: false });
    }
  },

  addGoal: async (goal) => {
    // Optimistic update
    set(s => {
      const current = s.goalsData || [];
      return { goalsData: [goal, ...current] };
    });
    // Persist to Supabase
    const row = {
      id: goal.id,
      name: goal.name,
      program: goal.program,
      program_color: goal.programColor,
      description: goal.description,
      status: goal.status,
      weighted_scoring: goal.weightedScoring,
      passing_score: goal.passingScore,
      mode: goal.mode,
      steps: goal.steps,
      success_metrics: goal.successMetrics,
      agents: goal.agents,
      completion_rate: goal.completionRate,
      total_runs: goal.totalRuns,
    };
    const { error } = await supabase.from('goals').insert(row);
    if (error) console.warn('Failed to persist goal:', error.message);
    get().logAudit('Goal', goal.id, goal.name, 'created', `Goal created — program: ${goal.program}, status: ${goal.status}`, 'Lifecycle');
  },

  updateGoal: async (goal) => {
    // Optimistic update
    set(s => {
      const current = s.goalsData || [];
      return { goalsData: current.map(g => g.id === goal.id ? goal : g) };
    });
    // Persist to Supabase
    const row = {
      name: goal.name,
      program: goal.program,
      program_color: goal.programColor,
      description: goal.description,
      status: goal.status,
      weighted_scoring: goal.weightedScoring,
      passing_score: goal.passingScore,
      mode: goal.mode,
      steps: goal.steps,
      success_metrics: goal.successMetrics,
      agents: goal.agents,
    };
    const { error } = await supabase.from('goals').update(row).eq('id', goal.id);
    if (error) console.warn('Failed to update goal:', error.message);
    get().logAudit('Goal', goal.id, goal.name, 'updated', `Goal updated — ${goal.name}`, 'Configuration');
  },

  deleteGoal: async (id) => {
    const goal = (get().goalsData || []).find(g => g.id === id);
    set(s => ({ goalsData: (s.goalsData || []).filter(g => g.id !== id) }));
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) console.warn('Failed to delete goal:', error.message);
    if (goal) get().logAudit('Goal', id, goal.name, 'deleted', `Goal deleted`, 'Lifecycle');
  },

  toggleSubnav: () => set(s => ({ subnavCollapsed: !s.subnavCollapsed })),
  setViewBy: (v) => set({ viewBy: v, currentPage: 1 }),
  setActiveFilters: (filters) => set({ activeFilters: filters, currentPage: 1 }),
  setFilter: (key, value) => set(s => {
    const next = { ...s.activeFilters };
    if (value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    return { activeFilters: next, currentPage: 1 };
  }),
  clearAllFilters: () => set({ activeFilters: {}, currentPage: 1 }),
  setActiveSubnavList: (list) => { set({ activeSubnavList: list, currentPage: 1 }); updateHash(get); },

  fetchAgents: async () => {
    set({ agentsLoading: true });
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.warn('Failed to fetch agents:', error.message);
      set({ agents: [], agentsLoading: false });
    } else {
      // Sort by numeric part of id for consistent order
      data.sort((a, b) => {
        const na = parseInt(a.id.replace(/\D/g, ''), 10);
        const nb = parseInt(b.id.replace(/\D/g, ''), 10);
        return na - nb;
      });
      set({ agents: data, agentsLoading: false });
    }
  },

  updateAgent: async (id, updates) => {
    const agent = get().agents.find(a => a.id === id);
    set(s => ({
      agents: s.agents.map(a => a.id === id ? { ...a, ...updates } : a)
    }));
    await supabase.from('agents').update(updates).eq('id', id);
    get().logAudit('Agent', id, agent?.name || '', 'updated', Object.keys(updates).join(', ') + ' changed', 'Configuration');
  },

  // ─── Agent Builder actions ───
  openBuilder: (agent, prompt) => {
    sessionStorage.setItem('activePage', 'builder');
    set({ builderAgent: agent, activePage: 'builder', builderSelectedNode: null, builderPrompt: prompt || '' });
    get().fetchFlow(agent.id, prompt);
    updateHash(get);
  },

  closeBuilder: () => {
    sessionStorage.setItem('activePage', 'settings');
    set({ builderAgent: null, builderFlow: null, builderSelectedNode: null, builderVersions: [], builderPrompt: '', builderConfig: null, activePage: 'settings', _pendingAgentId: null });
    updateHash(get);
  },

  updateBuilderAgent: (patch) => set(s => ({
    builderAgent: s.builderAgent ? { ...s.builderAgent, ...patch } : s.builderAgent,
  })),

  /** Counter bumped when the toolbar Save attempts to save with invalid
   *  Global Settings. GlobalSettings listens to this and forces all
   *  required fields into the "touched" state so inline errors appear. */
  builderValidationAttempt: 0,
  bumpBuilderValidationAttempt: () => set(s => ({
    builderValidationAttempt: (s.builderValidationAttempt || 0) + 1,
  })),

  /** Returns { valid, errors } for the current agent's required global-settings
   *  fields. Errors keyed by field. Used by Save to gate version bumps and by
   *  GlobalSettings to disable its own Save Settings button. */
  validateBuilderAgent: () => {
    const a = get().builderAgent;
    const gs = a?.globalSettings || {};
    const errors = {};
    if (!String(gs.agentName || a?.name || '').trim()) errors.agentName = 'Agent Name is required';
    if (!String(gs.useCaseName || '').trim()) errors.useCaseName = 'Use Case is required';
    return { valid: Object.keys(errors).length === 0, errors };
  },

  setBuilderSelectedNode: (nodeId) => set({ builderSelectedNode: nodeId, builderActiveTransition: null }),
  builderActiveTransition: null,
  setBuilderActiveTransition: (idx) => set({ builderActiveTransition: idx }),

  fetchAgentConfig: async (agentId) => {
    set({ builderConfigLoading: true });
    const { data, error } = await supabase
      .from('agent_config')
      .select('*')
      .eq('agent_id', agentId)
      .maybeSingle();

    if (error) {
      console.warn('agent_config fetch failed:', error.message);
      set({ builderConfig: null, builderConfigLoading: false });
    } else {
      set({ builderConfig: data, builderConfigLoading: false });
    }
  },

  saveAgentConfig: async (agentId, configData) => {
    const row = {
      agent_id: agentId,
      agent_role: configData.agentRole,
      use_case_name: configData.useCaseName,
      description: configData.description,
      system_prompt: configData.systemPrompt,
      tone_of_voice: configData.toneOfVoice,
      voice: configData.voice,
      empathy_level: configData.empathyLevel,
      speaking_pace: configData.speakingPace,
      languages: configData.languages,
      adaptations: configData.adaptations,
      selected_policies: configData.selectedPolicies,
      population_type: configData.populationType,
      selected_worklist: configData.selectedWorklist || null,
      modality: configData.modality,
      phone: configData.phone,
      email: configData.email,
      office_hours: configData.officeHours,
      goal_ids: configData.goalIds,
    };

    const { data, error } = await supabase
      .from('agent_config')
      .upsert({ ...row }, { onConflict: 'agent_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('agent_config save failed:', error.message);
    } else {
      set({ builderConfig: data });
    }
    // Also update agent name on the agents table if changed
    if (configData.agentName) {
      const agent = get().builderAgent;
      if (agent && agent.name !== configData.agentName) {
        await get().updateAgent(agentId, { name: configData.agentName, use_case: configData.useCaseName });
      }
    }
    return !error;
  },

  fetchFlow: async (agentId, prompt) => {
    set({ builderFlowLoading: true });

    // Generate flow from prompt or use defaults
    const generated = prompt ? generateFlowFromPrompt(prompt) : null;

    const defaultNodes = generated?.nodes || [
      { id: 'start', type: 'startNode', position: { x: 200, y: 300 }, data: { label: 'Starts Here' } },
      { id: 'n1', type: 'conversationNode', position: { x: 380, y: 240 }, data: { label: 'Introduction & Patient Verification', prompt: 'Hello, this is the Fold Health care support assistant calling as part of your Transitions of Care follow-up program.\n\nI\'m reaching out because you were recently discharged from the hospital, and we want to make sure you\'re recovering safely.\n\nIs now a good time to talk for about 5 minutes?', nodeType: 'conversation', verified: true, transitions: [{ condition: 'If yes', target: 'Identity Verification' }, { condition: 'If no', target: 'Reschedule Node' }], guardrails: 'Do not share any patient data with the caller.' } },
      { id: 'n2', type: 'conversationNode', position: { x: 600, y: 100 }, data: { label: 'Identity Verification Node', prompt: 'To make sure I\'m speaking with the right person, could you please confirm your full name and date of birth?', nodeType: 'conversation', verified: true, transitions: [{ condition: 'Verified', target: 'Discharge Confirmation' }, { condition: 'Not verified', target: 'Transfer to Staff' }] } },
      { id: 'n3', type: 'conversationNode', position: { x: 550, y: 500 }, data: { label: 'Reschedule Node', prompt: 'No problem. When would be a better time for us to call you back?', nodeType: 'conversation', transitions: [{ condition: 'Save callback time', target: 'End' }] } },
      { id: 'end', type: 'endNode', position: { x: 900, y: 300 }, data: { label: 'End' } },
    ];
    const defaultEdges = generated?.edges || [
      { id: 'e-start-n1', source: 'start', target: 'n1', type: 'smoothstep', animated: true },
      { id: 'e-n1-n2', source: 'n1', target: 'n2', sourceHandle: 't-0', type: 'smoothstep' },
      { id: 'e-n1-n3', source: 'n1', target: 'n3', sourceHandle: 't-1', type: 'smoothstep' },
      { id: 'e-n3-end', source: 'n3', target: 'end', sourceHandle: 't-0', type: 'smoothstep' },
    ];

    try {
      const { data, error } = await supabase
        .from('agent_flows')
        .select('*')
        .eq('agent_id', agentId)
        .eq('is_current', true)
        .single();

      if (error || !data) {
        // Try to create a new flow in the DB
        const { data: newFlow, error: insertErr } = await supabase.from('agent_flows').insert({
          agent_id: agentId,
          version: '1.0',
          nodes: defaultNodes,
          edges: defaultEdges,
          is_current: true,
        }).select().single();

        if (insertErr) {
          // DB table may not exist yet - use local flow
          console.warn('agent_flows table not ready, using local flow:', insertErr.message);
          set({
            builderFlow: { id: 'local', nodes: defaultNodes, edges: defaultEdges, viewport: { x: 0, y: 0, zoom: 1 }, version: '1.0', agent_id: agentId },
            builderFlowLoading: false,
          });
          return;
        }

        set({
          builderFlow: newFlow || { id: 'local', nodes: defaultNodes, edges: defaultEdges, viewport: { x: 0, y: 0, zoom: 1 }, version: '1.0' },
          builderFlowLoading: false,
        });
      } else {
        set({ builderFlow: data, builderFlowLoading: false });
      }

      // Fetch all versions
      const { data: versions } = await supabase
        .from('agent_flows')
        .select('id, version, created_at, is_current')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (versions) set({ builderVersions: versions });
    } catch (err) {
      console.warn('Flow fetch error, using defaults:', err);
      set({
        builderFlow: { id: 'local', nodes: defaultNodes, edges: defaultEdges, viewport: { x: 0, y: 0, zoom: 1 }, version: '1.0' },
        builderFlowLoading: false,
      });
    }
  },

  saveFlow: async (nodes, edges, viewport) => {
    const { builderFlow, builderAgent } = get();
    if (!builderFlow || !builderAgent) return;

    const updates = { nodes, edges, viewport, updated_at: new Date().toISOString() };
    set(s => ({ builderFlow: { ...s.builderFlow, ...updates } }));

    await supabase.from('agent_flows').update(updates).eq('id', builderFlow.id);
    return true;
  },

  createFlowVersion: async (nodes, edges, viewport) => {
    const { builderFlow, builderAgent } = get();
    if (!builderFlow || !builderAgent) return;

    // Mark old as not current
    await supabase.from('agent_flows').update({ is_current: false }).eq('id', builderFlow.id);

    // Parse version
    const parts = (builderFlow.version || '1.0').split('.');
    const newVersion = parts[0] + '.' + (parseInt(parts[1] || 0) + 1);

    const { data: newFlow } = await supabase.from('agent_flows').insert({
      agent_id: builderAgent.id,
      version: newVersion,
      nodes,
      edges,
      viewport,
      is_current: true,
    }).select().single();

    if (newFlow) {
      set({ builderFlow: newFlow });
      // Refresh versions list
      const { data: versions } = await supabase
        .from('agent_flows')
        .select('id, version, created_at, is_current')
        .eq('agent_id', builderAgent.id)
        .order('created_at', { ascending: false });
      if (versions) set({ builderVersions: versions });

      // Also update agent version
      await supabase.from('agents').update({ version: newVersion }).eq('id', builderAgent.id);
    }
    return newVersion;
  },

  switchFlowVersion: async (flowId) => {
    const { builderAgent } = get();
    if (!builderAgent) return;

    // Unset current
    await supabase.from('agent_flows').update({ is_current: false }).eq('agent_id', builderAgent.id).eq('is_current', true);
    // Set new current
    await supabase.from('agent_flows').update({ is_current: true }).eq('id', flowId);
    // Re-fetch
    get().fetchFlow(builderAgent.id);
  },

  updateNodeData: (nodeId, dataUpdates) => {
    set(s => {
      if (!s.builderFlow) return {};
      const nodes = s.builderFlow.nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...dataUpdates } } : n
      );
      return { builderFlow: { ...s.builderFlow, nodes } };
    });
  },

  setCurrentPage: (page) => set({ currentPage: page }),
  setPerPage: (pp) => set({ perPage: pp, currentPage: 1 }),
  setSearchQuery: (q) => set({ searchQuery: q, currentPage: 1 }),

  selectPatient: (id) => set(s => ({
    selectedIds: s.selectedIds.includes(id)
      ? s.selectedIds.filter(x => x !== id)
      : [...s.selectedIds, id]
  })),
  selectAll: (ids) => set({ selectedIds: ids }),
  clearSelected: () => set({ selectedIds: [] }),

  // ─── HCC Worklist (Supabase-backed) ───
  hccMembers: [],
  hccMembersLoading: false,
  fetchHccMembers: async () => {
    set({ hccMembersLoading: true });
    const { data, error } = await supabase
      .from('hcc_members')
      .select('*')
      .order('create_date', { ascending: false });
    if (error) {
      console.error('fetchHccMembers error:', error.message);
      set({ hccMembers: [], hccMembersLoading: false });
      return;
    }
    const POS_MAP = { 'Walk-in': { code: '11', desc: 'Office' }, Telehealth: { code: '02', desc: 'Telehealth' } };
    const members = (data || []).map(row => {
      const dosList = row.dos_list || [];
      const pos = POS_MAP[row.visit_type] || { code: '', desc: row.visit_type || '' };
      return {
        id: row.id,
        memberId: row.member_id,
        in: row.initials,
        name: row.name,
        g: row.gender,
        age: row.age,
        cv: row.current_visit,
        tv: row.total_visits,
        dos_list: dosList,
        dos: dosList[row.current_visit ? row.current_visit - 1 : 0]?.date,
        visits: row.current_visit && row.total_visits ? `${row.current_visit} of ${row.total_visits} Visits` : null,
        ch: row.chart_count,
        docStatus: row.doc_status || [],
        open: row.open_icds,
        date: row.create_date,
        due: row.due_label,
        dueCol: row.due_color,
        sup: row.support_name, supS: row.support_status,
        cdr: row.coder_name, cdrS: row.coder_status,
        r1: row.reviewer1_name, r1s: row.reviewer1_status,
        r2: row.reviewer2_name, r2s: row.reviewer2_status,
        r3: row.reviewer3_name, r3s: row.reviewer3_status,
        rp: row.rendering_provider,
        vt: row.visit_type,
        raf: row.raf_score,
        ri: row.raf_impact,
        ru: row.risk_utilization,
        ipa: row.ipa,
        hp: row.health_plan,
        pcp: row.pcp,
        dec: row.decile,
        coh: row.cohort,
        rl: row.risk_level,
        ad: row.advillness,
        fr: row.frailty,
        language: row.language || 'en',
        pos: pos.code,
        posDesc: pos.desc,
      };
    });
    set({ hccMembers: members, hccMembersLoading: false });
  },

  // HCC Diagnosis Gaps (fetched per member from Supabase)
  hccDiagnosisGaps: [],
  hccDiagnosisGapsLoading: false,
  fetchHccDiagnosisGaps: async (memberName) => {
    set({ hccDiagnosisGapsLoading: true });
    const { data, error } = await supabase
      .from('hcc_diagnosis_gaps')
      .select('*')
      .eq('member_name', memberName)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('fetchHccDiagnosisGaps error:', error.message);
      set({ hccDiagnosisGaps: [], hccDiagnosisGapsLoading: false });
      return;
    }
    const gaps = (data || []).map(row => ({
      id: row.id,
      code: row.code,
      desc: row.description,
      hcc: row.hcc_category,
      status: row.status,
      type: row.type,
      docs: row.docs_count,
      cmts: row.comments_count,
      notes: row.notes_count,
      raf: row.raf_weight,
      last: row.last_activity,
      by: row.last_activity_by,
      dismissReason: row.dismiss_reason,
      isLinked: row.is_linked,
    }));
    set({ hccDiagnosisGaps: gaps, hccDiagnosisGapsLoading: false });
  },

  selectedHccIds: [],
  selectHccMember: (id) => set(s => ({
    selectedHccIds: s.selectedHccIds.includes(id)
      ? s.selectedHccIds.filter(x => x !== id)
      : [...s.selectedHccIds, id]
  })),
  selectAllHcc: (ids) => set({ selectedHccIds: ids }),
  clearHccSelected: () => set({ selectedHccIds: [] }),

  // ─── All Patients (unified TOC + HCC view, Supabase-backed) ───
  allPatients: [],
  allPatientsLoading: false,
  fetchAllPatients: async () => {
    set({ allPatientsLoading: true });
    const { data, error } = await supabase
      .from('all_patients')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      console.warn('fetchAllPatients error (falling back to combined TOC+HCC):', error.message);
      set({ allPatients: [], allPatientsLoading: false });
      return;
    }
    const rows = (data || []).map(r => ({
      id: r.id,
      source: r.source,
      name: r.name,
      initials: r.initials,
      gender: r.gender,
      age: r.age,
      memberId: r.member_id,
      email: r.email,
      phone: r.phone,
      language: r.language || 'en',
      city: r.city,
      state: r.state,
      tags: r.tags || [],
      groupNumber: r.group_number,
      familyId: r.family_id,
      uniqueMemberId: r.unique_member_id,
      coverageType: r.coverage_type,
      planCode: r.plan_code,
      employeeSsn: r.employee_ssn,
      memberSsn: r.member_ssn,
      subscriberHireDate: r.subscriber_hire_date,
      location: r.location,
      tpa: r.tpa,
      chronicConditions: r.chronic_conditions || [],
      pcp: r.pcp,
      pcpInitials: r.pcp_initials,
      lastVisit: r.last_visit,
      activeCareProgram: r.active_care_program,
      ccmConsent: r.ccm_consent,
      apcmConsent: r.apcm_consent,
      assignee: r.assignee,
      assigneeInitials: r.assignee_initials,
    }));
    set({ allPatients: rows, allPatientsLoading: false });
  },

  selectedAllPatientsIds: [],
  selectAllPatient: (id) => set(s => ({
    selectedAllPatientsIds: s.selectedAllPatientsIds.includes(id)
      ? s.selectedAllPatientsIds.filter(x => x !== id)
      : [...s.selectedAllPatientsIds, id]
  })),
  selectAllAllPatients: (ids) => set({ selectedAllPatientsIds: ids }),
  clearAllPatientsSelected: () => set({ selectedAllPatientsIds: [] }),

  // HCC DiagPanel drawer (Phase 2: read-only)
  diagPanelOpen: false,
  diagPanelMemberId: null,
  diagActiveTab: 'Codes',
  diagDosFilter: null,      // null = first DOS (member.dos_list[0]); 'ALL' = sweep; else a date string
  diagViewMode: 'HCC',      // 'HCC' (grouped) | 'ICD' (flat)
  openDiagPanel: (id) => set({
    diagPanelOpen: true,
    diagPanelMemberId: id,
    diagActiveTab: 'Codes',
    diagDosFilter: null,
    diagViewMode: 'HCC',
  }),
  closeDiagPanel: () => set({ diagPanelOpen: false, diagPanelMemberId: null }),
  setDiagActiveTab: (tab) => set({ diagActiveTab: tab }),
  setDiagDosFilter: (dos) => set({ diagDosFilter: dos }),
  setDiagViewMode: (mode) => set({ diagViewMode: mode }),

  // Quick View drawer — opened by clicking a patient name in any worklist
  quickViewPatient: null,
  openQuickView: (patient) => set({ quickViewPatient: patient }),
  closeQuickView: () => set({ quickViewPatient: null }),

  openWorkflow: (patientId) => {
    const p = get().patients.find(x => x.id === patientId);
    if (!p) return;
    const stepStates = {
      s1: p.status === 'completed' ? 'done' : (p.status === 'oncall' ? 'active' : 'pending'),
      s2: (p.tocStatus === 'enrolled' || p.tocStatus === 'engaged') ? 'active' : 'pending',
      s3: 'pending',
      s4: (p.status === 'scheduled' || p.status === 'queued') ? 'active' : 'pending'
    };
    set({ workflowPatient: p, workflowStep: 0, stepStates });
  },
  closeWorkflow: () => set({ workflowPatient: null }),

  setStepState: (stepId, state) => set(s => ({
    stepStates: { ...s.stepStates, [stepId]: state }
  })),

  updatePatient: (id, updates) => {
    // Optimistic local update
    set(s => ({
      patients: s.patients.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
    // Persist to Supabase in background
    get().persistPatient(id, updates);
  },

  saveWorkflow: () => {
    const { workflowPatient, stepStates } = get();
    if (!workflowPatient) return;
    const allDone = ['s1','s2','s3','s4'].every(s => stepStates[s] === 'done');
    let updates = {};
    if (allDone) {
      updates = { status: 'completed', goals: workflowPatient.goals || { met: 3, total: 4 }, nextAction: '__MED_REVIEW__' };
    } else if (stepStates.s4 === 'done') {
      updates = { status: 'scheduled', nextAction: 'Follow-up appointment confirmed' };
    } else if (stepStates.s3 === 'done') {
      updates = { status: 'scheduled', nextAction: 'Schedule follow-up appointment' };
    } else if (stepStates.s2 === 'done') {
      updates = { nextAction: 'Complete medication reconciliation' };
    }
    // Optimistic local update
    set(s => ({
      patients: s.patients.map(p => p.id === workflowPatient.id ? { ...p, ...updates } : p),
      workflowPatient: null,
      toast: 'Workflow saved successfully'
    }));
    // Persist to Supabase
    if (Object.keys(updates).length > 0) {
      get().persistPatient(workflowPatient.id, updates);
    }
  },

  invokeAgent: (patientIds, agentName, agentRole) => {
    const MAX_CONCURRENT = 3;
    const state = get();
    let activeCount = state.patients.filter(p => p.status === 'oncall' && p.onCall).length;
    const updated = state.patients.map(p => {
      if (!patientIds.includes(p.id)) return p;
      const newP = { ...p, agentAssigned: agentName, agentRole };
      if (p.status !== 'completed' && p.status !== 'failed') {
        if (activeCount < MAX_CONCURRENT) {
          newP.status = 'oncall';
          newP.onCall = true;
          newP.callDuration = '00:00';
          newP.nextAction = 'Live outreach in progress';
          activeCount++;
        } else {
          newP.status = 'queued';
          newP.onCall = false;
          newP.nextAction = 'Queued — waiting for available line';
        }
      }
      return newP;
    });
    set({ patients: updated, selectedIds: [], showInvokeModal: false, toastSuccess: true, queueTabDot: true });

    // Auto-navigate to the queue tab so users see their invoked patients
    const { setActiveTab } = get();
    setActiveTab('toc-queue');

    // Create call records for invoked patients and persist to Supabase
    for (const p of updated) {
      if (patientIds.includes(p.id)) {
        get().persistPatient(p.id, {
          agentAssigned: p.agentAssigned,
          agentRole: p.agentRole,
          status: p.status,
          onCall: p.onCall,
          callDuration: p.callDuration,
          nextAction: p.nextAction,
        });

        // Create an ongoing call record if patient went to oncall
        if (p.status === 'oncall') {
          // Find existing ongoing template from fallback data
          const existing = get().callDetails.find(c => c.patientId === p.id && c.callType === 'ongoing');
          const callId = 'cd-live-' + p.id + '-' + Date.now();
          get().createCallRecord({
            id: callId,
            patientId: p.id,
            callType: 'ongoing',
            agentName: agentName,
            startedAt: new Date().toLocaleString(),
            duration: '00:00',
            liveGoals: existing?.liveGoals || [
              { name: 'Patient Outreach', done: false, time: null },
              { name: 'Schedule ToC Appointment', done: false, time: null },
              { name: 'Medication Review', done: false, time: null },
            ],
            liveTranscript: existing?.liveTranscript || [],
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    get().startCallTimers();
    setTimeout(() => set({ toastSuccess: false }), 3500);
  },

  abortAllAgents: () => {
    const state = get();
    // Stop all call timers
    if (state.callTimerRef) {
      clearInterval(state.callTimerRef);
    }
    const updated = state.patients.map(p => {
      if (!p.agentAssigned) return p;
      const newP = { ...p, agentAssigned: '', agentRole: '', onCall: false, status: p.status === 'oncall' || p.status === 'queued' ? 'scheduled' : p.status };
      return newP;
    });
    set({ patients: updated, callTimerRef: null, queueTabDot: false, toast: 'All agent runs aborted' });
    // Persist changes
    for (const p of updated) {
      if (p.agentAssigned === '') {
        get().persistPatient(p.id, { agentAssigned: '', agentRole: '', onCall: false, status: p.status });
      }
    }
    setTimeout(() => set(s => s.toast === 'All agent runs aborted' ? { toast: null } : {}), 2800);
  },

  startCallTimers: () => {
    const existing = get().callTimerRef;
    if (existing) return;
    const ref = setInterval(() => {
      const state = get();
      const anyActive = state.patients.some(p => p.status === 'oncall' && p.onCall);
      if (!anyActive) {
        clearInterval(ref);
        set({ callTimerRef: null });
        return;
      }
      set(s => ({
        patients: s.patients.map(p => {
          if (p.status !== 'oncall' || !p.onCall) return p;
          const secs = parseDuration(p.callDuration || '00:00') + 1;
          return { ...p, callDuration: formatDuration(secs) };
        })
      }));
      // Note: call duration ticks are NOT persisted every second (too noisy).
      // They get persisted when the call ends.
    }, 1000);
    set({ callTimerRef: ref });
  },

  openCallPopover: (patientId, btnRef) => set({ callPopoverPatient: patientId, callPopoverBtnRef: btnRef }),
  closeCallPopover: () => set({ callPopoverPatient: null, callPopoverBtnRef: null }),

  startActiveCall: (patientId) => {
    const state = get();
    if (state.activeCallTimerRef) clearInterval(state.activeCallTimerRef);
    const updates = { status: 'oncall', onCall: true, callDuration: '00:00' };
    set(s => ({
      patients: s.patients.map(p => p.id === patientId ? { ...p, ...updates } : p),
      activeCallPatient: patientId,
      activeCallSeconds: 0,
      callPopoverPatient: null,
      callPopoverBtnRef: null
    }));
    get().persistPatient(patientId, updates);

    const ref = setInterval(() => {
      set(s => {
        const newSecs = s.activeCallSeconds + 1;
        const timeStr = formatDuration(newSecs);
        return {
          activeCallSeconds: newSecs,
          patients: s.patients.map(p => p.id === patientId ? { ...p, callDuration: timeStr } : p)
        };
      });
    }, 1000);
    set({ activeCallTimerRef: ref });
  },

  endActiveCall: () => {
    const { activeCallTimerRef, activeCallPatient, activeCallSeconds } = get();
    if (activeCallTimerRef) clearInterval(activeCallTimerRef);
    const updates = { status: 'scheduled', onCall: false, callDuration: formatDuration(activeCallSeconds) };
    set(s => ({
      patients: s.patients.map(p => p.id === activeCallPatient ? { ...p, ...updates } : p),
      activeCallPatient: null,
      activeCallSeconds: 0,
      activeCallTimerRef: null
    }));
    if (activeCallPatient) {
      get().persistPatient(activeCallPatient, updates);
    }
  },

  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => set(s => s.toast === msg ? { toast: null } : {}), 2800);
  },

  closeToast: () => set({ toast: null }),
  closeToastSuccess: () => set({ toastSuccess: false }),

  openDetail: (patientId, callRow = null) => {
    const p = get().patients.find(x => x.id === patientId);
    if (p) {
      const patientCalls = get().callDetails.filter(c => c.patientId === patientId);
      set({ detailPatient: p, detailPatientCalls: patientCalls, activeCallRow: callRow });
    }
  },
  closeDetail: () => set({ detailPatient: null, detailPatientCalls: [], activeCallRow: null }),

  openLiveDrawer: (patientId) => set({ liveDrawerPatient: patientId }),
  closeLiveDrawer: () => set({ liveDrawerPatient: null }),

  setShowInvokeModal: (v) => set({ showInvokeModal: v }),
  setShowCreateNew: (v) => set({ showCreateNew: v }),
  setShowFilterBar: (v) => set({ showFilterBar: v }),
  clearQueueTabDot: () => set({ queueTabDot: false }),

  nextDate,

  // ─── Analytics Data Layer ───
  analyticsCache: {},
  analyticsLoading: {},
  analyticsError: {},
  analyticsPeriod: '2026-03',
  analyticsTenant: 'default',
  analyticsPersona: 'exec',
  analyticsPractice: 'all',
  analyticsOrg: 'aco',
  analyticsPeriodMode: 'ytd',
  analyticsQuarter: 'Q4-2025',
  analyticsView: 'executive',

  setAnalyticsView: (v) => { set({ analyticsView: v }); updateHash(get); },
  setAnalyticsPeriod: (p) => { set({ analyticsPeriod: p, analyticsCache: {} }); },
  setAnalyticsTenant: (t) => { set({ analyticsTenant: t, analyticsCache: {} }); },
  setAnalyticsPersona: (p) => { set({ analyticsPersona: p, analyticsCache: {} }); },
  setAnalyticsPractice: (p) => { set({ analyticsPractice: p, analyticsCache: {} }); },
  setAnalyticsOrg: (o) => { set({ analyticsOrg: o, analyticsCache: {} }); },
  setAnalyticsPeriodMode: (m) => { set({ analyticsPeriodMode: m, analyticsCache: {} }); },
  setAnalyticsQuarter: (q) => { set({ analyticsQuarter: q, analyticsCache: {} }); },
  invalidateAnalyticsCache: () => set({ analyticsCache: {} }),

  fetchAnalytics: async (cacheKey, queryFn) => {
    const cache = get().analyticsCache[cacheKey];
    if (cache && Date.now() - cache.fetchedAt < 5 * 60 * 1000) return cache.data;
    set(s => ({
      analyticsLoading: { ...s.analyticsLoading, [cacheKey]: true },
      analyticsError: { ...s.analyticsError, [cacheKey]: null },
    }));
    try {
      const data = await queryFn();
      set(s => ({
        analyticsCache: { ...s.analyticsCache, [cacheKey]: { data, fetchedAt: Date.now() } },
        analyticsLoading: { ...s.analyticsLoading, [cacheKey]: false },
      }));
      return data;
    } catch (err) {
      set(s => ({
        analyticsLoading: { ...s.analyticsLoading, [cacheKey]: false },
        analyticsError: { ...s.analyticsError, [cacheKey]: err.message },
      }));
      return null;
    }
  },

  fetchViewKpis: async (viewId) => {
    const { analyticsTenant: t, analyticsPeriod: p } = get();
    const key = `kpis:${viewId}:${p}`;
    return get().fetchAnalytics(key, async () => {
      const { data, error } = await supabase
        .from('analytics_kpis').select('*')
        .eq('tenant_id', t).eq('view_key', viewId).eq('period', p)
        .maybeSingle();
      if (error || !data) return FALLBACK_KPIS[viewId] || { kpis: [], insight: null };
      return kpiRowToJs(data);
    });
  },

  fetchTimeSeries: async (seriesKeys) => {
    const { analyticsTenant: t, analyticsPeriod: p } = get();
    const key = `ts:${seriesKeys.join(',')}:${p}`;
    return get().fetchAnalytics(key, async () => {
      const { data, error } = await supabase
        .from('analytics_time_series').select('*')
        .eq('tenant_id', t).in('series_key', seriesKeys).eq('period', p);
      if (error || !data?.length) {
        const result = {};
        seriesKeys.forEach(k => { if (FALLBACK_TIME_SERIES[k]) result[k] = FALLBACK_TIME_SERIES[k]; });
        return result;
      }
      return groupTimeSeries(data);
    });
  },

  fetchViewTable: async (viewId, tableKey) => {
    const { analyticsTenant: t, analyticsPeriod: p } = get();
    const key = `tbl:${tableKey}:${p}`;
    return get().fetchAnalytics(key, async () => {
      const { data, error } = await supabase
        .from('analytics_tables').select('*')
        .eq('tenant_id', t).eq('table_key', tableKey).eq('period', p)
        .maybeSingle();
      if (error || !data) return FALLBACK_TABLES[tableKey] || { columns: [], rows: [] };
      return tableRowToJs(data);
    });
  },

  fetchProgressBars: async (viewId, barKey) => {
    const { analyticsTenant: t, analyticsPeriod: p } = get();
    const key = `bar:${barKey}:${p}`;
    return get().fetchAnalytics(key, async () => {
      const { data, error } = await supabase
        .from('analytics_progress_bars').select('*')
        .eq('tenant_id', t).eq('bar_key', barKey).eq('period', p)
        .maybeSingle();
      if (error || !data) return FALLBACK_PROGRESS_BARS[barKey] || [];
      return barRowToJs(data);
    });
  },

  fetchConfig: async (configKey) => {
    const { analyticsTenant: t } = get();
    const key = `cfg:${configKey}`;
    return get().fetchAnalytics(key, async () => {
      const { data, error } = await supabase
        .from('analytics_configs').select('*')
        .eq('tenant_id', t).eq('config_key', configKey)
        .maybeSingle();
      if (error || !data) return FALLBACK_CONFIGS[configKey] || {};
      return configRowToJs(data);
    });
  },

  // ── Appointment Types ──
  appointmentTypes: [],
  fetchAppointmentTypes: async () => {
    const { data, error } = await supabase
      .from('appointment_types')
      .select('*')
      .order('name');
    if (!error && data) set({ appointmentTypes: data });
  },

  // ── Appointments ──
  appointments: [],
  appointmentsLoading: false,
  fetchAppointments: async () => {
    set({ appointmentsLoading: true });
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('date', { ascending: true });
    if (!error && data) set({ appointments: data });
    set({ appointmentsLoading: false });
  },

  createAppointment: async (appt) => {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appt)
      .select()
      .single();
    if (error) { console.error('Create appointment error:', error); return null; }
    // Refresh list
    get().fetchAppointments();
    return data;
  },

  updateAppointment: async (id, updates) => {
    const { error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id);
    if (error) { console.error('Update appointment error:', error); return false; }
    get().fetchAppointments();
    return true;
  },

  deleteAppointment: async (id) => {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);
    if (error) { console.error('Delete appointment error:', error); return false; }
    get().fetchAppointments();
    return true;
  },

  // ── Campaign ──
  // (helper hoisted below; declared at module scope via const mapper above the store)
  campaignTab: 'active',
  setCampaignTab: (tab) => { set({ campaignTab: tab }); updateHash(get); },
  campaigns: [],
  campaignsLoading: false,
  // Builder takeover. `campaignBuilderId` is the campaigns.id we're editing in
  // the New Campaign full-screen view. It coexists with `editingCampaignId`:
  // when both are set, the EmailBuilder shows on top; closing it returns to
  // the CampaignBuilder. `campaignBuilderSaving` is "draft-row creation" — the
  // brief moment between "user clicked New Campaign" and "draft row exists".
  campaignBuilderId: null,
  campaignBuilderSaving: false,

  // Open the New Campaign builder. If campaignOrNull is null, insert a fresh
  // draft row first so we have an id to PATCH against on every subsequent
  // field edit (no need for a separate "create" submit step).
  openCampaignBuilder: async (campaignOrNull) => {
    if (campaignOrNull?.id) {
      set({ campaignBuilderId: campaignOrNull.id });
      updateHash(get);
      return campaignOrNull.id;
    }
    set({ campaignBuilderSaving: true });
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        name: 'Untitled Campaign',
        section: 'draft',
        channel: 'email',
        send_via: ['email'],
        start_mode: 'immediately',
        campaign_type: 'one_time',
      })
      .select('*')
      .single();
    set({ campaignBuilderSaving: false });
    if (error) {
      console.error('openCampaignBuilder insert error:', error);
      get().showToast('Could not create draft campaign');
      return null;
    }
    const fresh = campaignRowToJs(data);
    set(s => ({
      campaigns: [...s.campaigns, fresh],
      campaignBuilderId: fresh.id,
    }));
    updateHash(get);
    return fresh.id;
  },

  closeCampaignBuilder: () => {
    set({ campaignBuilderId: null });
    updateHash(get);
  },

  // Patch arbitrary fields on the campaign currently being built. Optimistic
  // local update + debounced Supabase PATCH so the UI feels instant and a
  // burst of edits collapses into one network call.
  updateCampaignFields: (patch) => {
    const id = get().campaignBuilderId;
    if (!id) return;
    set(s => ({
      campaigns: s.campaigns.map(c => c.id === id ? { ...c, ...patch } : c),
    }));
    scheduleCampaignSave(id, async () => {
      const dbPatch = campaignPatchToDb(patch);
      if (Object.keys(dbPatch).length === 0) return;
      const { error } = await supabase
        .from('campaigns')
        .update(dbPatch)
        .eq('id', id);
      if (error) console.error('updateCampaignFields error:', error);
    });
  },

  // Run / activate the campaign. Flushes any pending debounced save first,
  // then flips section → 'running' and enabled → true.
  runCampaignNow: async () => {
    const id = get().campaignBuilderId;
    if (!id) return false;
    // Flush pending debounced save synchronously so we don't lose the latest
    // field edit racing with this request.
    const pending = _campaignSaveTimers.get(id);
    if (pending) { clearTimeout(pending); _campaignSaveTimers.delete(id); }
    const { error } = await supabase
      .from('campaigns')
      .update({ section: 'running', enabled: true })
      .eq('id', id);
    if (error) {
      console.error('runCampaignNow error:', error);
      get().showToast('Could not start campaign');
      return false;
    }
    set(s => ({
      campaigns: s.campaigns.map(c => c.id === id ? { ...c, section: 'running', enabled: true } : c),
    }));
    get().showToast('Campaign started');
    return true;
  },

  // Hand-off from the CampaignBuilder to the EmailBuilder for "Edit Template".
  // Reuses the existing email-builder takeover; closing it returns to the
  // CampaignBuilder because campaignBuilderId stays set.
  openEmailTemplateFromCampaign: () => {
    const id = get().campaignBuilderId;
    if (!id) return;
    const campaign = get().campaigns.find(c => c.id === id);
    if (!campaign) return;
    get().openEmailBuilder(campaign);
  },
  fetchCampaigns: async () => {
    set({ campaignsLoading: true });
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('id', { ascending: true });
    if (error) {
      set({ campaignsLoading: false });
      return;
    }
    const campaigns = (data || []).map(campaignRowToJs);
    set({ campaigns, campaignsLoading: false });
  },

  fetchCampaignById: async (id) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return campaignRowToJs(data);
  },

  saveEmailTemplate: async () => {
    const s = get();
    if (!s.editingCampaignId || !s.emailDocument) return false;
    const { error } = await supabase
      .from('campaigns')
      .update({
        email_template: s.emailDocument,
        color_variables: s.colorVariables,
        updated_at: new Date().toISOString(),
      })
      .eq('id', s.editingCampaignId);
    if (error) {
      console.error('saveEmailTemplate error:', error);
      return false;
    }
    set(prev => ({
      campaigns: prev.campaigns.map(c =>
        c.id === s.editingCampaignId
          ? { ...c, emailTemplate: s.emailDocument, colorVariables: s.colorVariables }
          : c
      ),
    }));
    return true;
  },

  // Email builder takeover. editingCampaignId is the trigger; emailDocument is the
  // editable Reader-compatible document; selectedBlockId is what the right panel inspects.
  editingCampaignId: null,
  editingCampaignName: null,
  setEditingCampaignName: (name) => set({ editingCampaignName: name }),
  emailDocument: null,
  selectedBlockId: 'root',
  selectedColumnIdx: null,
  bulkSelectedIds: [],
  // When the user edits raw HTML in the Code tab, that string takes over the
  // preview canvas (rendered via an iframe). It can't round-trip back to the
  // JSON document, so it stays as an override until cleared.
  htmlPreviewOverride: null,
  setHtmlPreviewOverride: (html) => set({ htmlPreviewOverride: html }),
  setEmailDocument: (doc) => {
    get()._pushEmailHistory();
    set({ emailDocument: doc, htmlPreviewOverride: null });
  },

  // Pending HTML-import font substitution. When the parser surfaces font
  // families that aren't in the builder's Google Fonts catalogue, we hold
  // the parsed doc here and surface a dialog so the user can map each
  // unknown font to one we can load. The doc commits to emailDocument
  // only after the user confirms (or skips with the default mapping).
  pendingFontDoc: null,
  pendingUnknownFonts: [],
  openFontSubstitutionDialog: (doc, fonts) => set({ pendingFontDoc: doc, pendingUnknownFonts: fonts }),
  closeFontSubstitutionDialog: () => set({ pendingFontDoc: null, pendingUnknownFonts: [] }),

  // ── Undo / Redo for the email document ──
  // Snapshots the previous emailDocument before each mutation. Rapid edits
  // (color picker drag, resize drag) coalesce within a 400ms window so the
  // whole gesture counts as a single undo step.
  emailHistory: [],
  emailFuture: [],
  _lastEmailHistoryTime: 0,
  _pushEmailHistory: () => {
    const s = get();
    if (!s.emailDocument) return;
    const now = Date.now();
    const coalesce = now - s._lastEmailHistoryTime < 400 && s.emailHistory.length > 0;
    set(state => ({
      emailHistory: coalesce ? state.emailHistory : [...state.emailHistory.slice(-49), state.emailDocument],
      emailFuture: [],
      _lastEmailHistoryTime: now,
    }));
  },
  undoEmailEdit: () => set(s => {
    if (!s.emailDocument || s.emailHistory.length === 0) return {};
    const prev = s.emailHistory[s.emailHistory.length - 1];
    return {
      emailHistory: s.emailHistory.slice(0, -1),
      emailFuture: [s.emailDocument, ...s.emailFuture].slice(0, 50),
      emailDocument: prev,
      _lastEmailHistoryTime: 0,
    };
  }),
  redoEmailEdit: () => set(s => {
    if (!s.emailDocument || s.emailFuture.length === 0) return {};
    const next = s.emailFuture[0];
    return {
      emailFuture: s.emailFuture.slice(1),
      emailHistory: [...s.emailHistory.slice(-49), s.emailDocument],
      emailDocument: next,
      _lastEmailHistoryTime: 0,
    };
  }),

  // Named color variables — global "design tokens" for the open template.
  // Setting/picking a variable applies its hex; we don't persist a reference,
  // so updating a variable later does not retroactively change usages (matches
  // common email-design tool behaviour where colors are baked into the markup).
  colorVariables: [
    { name: 'Brand', hex: '#7C5CFA' },
    { name: 'Accent', hex: '#22C55E' },
    { name: 'Text', hex: '#3A485F' },
    { name: 'Muted', hex: '#7B8499' },
  ],
  addColorVariable: (variable) => set(s => ({ colorVariables: [...s.colorVariables, variable] })),
  updateColorVariable: (originalName, updates) => set(s => ({
    colorVariables: s.colorVariables.map(v => v.name === originalName ? { ...v, ...updates } : v),
  })),
  removeColorVariable: (name) => set(s => ({ colorVariables: s.colorVariables.filter(v => v.name !== name) })),

  // Recently used colors — capped MRU list shown above Variables in the
  // ColorPicker so users don't have to re-pick the same custom hex twice.
  // Hydrated from localStorage on boot; every commit re-saves the list.
  recentlyUsedColors: (() => {
    try {
      const raw = typeof localStorage !== 'undefined' && localStorage.getItem('eb_recent_colors');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    } catch { return []; }
  })(),
  pushRecentColor: (hex) => set(s => {
    if (typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex.trim())) return {};
    const upper = hex.trim().toUpperCase();
    const next = [upper, ...s.recentlyUsedColors.filter(c => c.toUpperCase() !== upper)].slice(0, 10);
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('eb_recent_colors', JSON.stringify(next)); } catch {}
    return { recentlyUsedColors: next };
  }),

  // Swap the existing header/footer for a different preset. Replaces by role
  // marker stored on the block; falls back to first/last child by convention.
  replaceHeaderFooter: (role, presetTree) => {
    get()._pushEmailHistory();
    return set(s => {
      if (!s.emailDocument) return {};
    const doc = { ...s.emailDocument };
    const root = doc.root;
    const childrenIds = [...(root.data.childrenIds || [])];
    // Find existing block by role; if none, default to first child for header,
    // last child for footer.
    let existingId = childrenIds.find(id => doc[id]?.data?.role === role);
    if (!existingId) {
      existingId = role === 'header' ? childrenIds[0] : childrenIds[childrenIds.length - 1];
    }
    if (existingId) {
      // Remove the existing block tree (the root child + any descendants we know about)
      const toRemove = collectBlockTree(doc, existingId);
      toRemove.forEach(id => { delete doc[id]; });
      const idx = childrenIds.indexOf(existingId);
      childrenIds.splice(idx, 1, presetTree.rootId);
    } else {
      if (role === 'header') childrenIds.unshift(presetTree.rootId);
      else childrenIds.push(presetTree.rootId);
    }
    Object.assign(doc, presetTree.blocks);
    doc.root = { ...root, data: { ...root.data, childrenIds } };
      return { emailDocument: doc, selectedBlockId: presetTree.rootId };
    });
  },
  openEmailBuilder: (campaign) => {
    const saved = campaign.emailTemplate;
    const defaultVars = [
      { name: 'Brand', hex: '#7C5CFA' },
      { name: 'Accent', hex: '#22C55E' },
      { name: 'Text', hex: '#3A485F' },
      { name: 'Muted', hex: '#7B8499' },
    ];
    // Self-heal: campaigns saved before the customHtml-precedence fix carry
    // a stale `customHtml` field alongside a fully parsed block tree. The
    // canvas/export still prefer blocks (PreviewCanvas + patchEmailHtml
    // now check `!hasBlocks`), but stripping the dead field at load means
    // the next save persists a clean doc and customHtml retires over time.
    let doc = saved || makeInitialDocument(campaign);
    if (doc?.root?.data?.customHtml &&
        (doc.root?.data?.childrenIds?.length ?? 0) > 0) {
      const { customHtml: _stale, ...restData } = doc.root.data;
      doc = { ...doc, root: { ...doc.root, data: restData } };
    }
    set({
      editingCampaignId: campaign.id,
      editingCampaignName: campaign.name,
      emailDocument: doc,
      colorVariables: campaign.colorVariables || defaultVars,
      selectedBlockId: 'root',
      emailHistory: [],
      emailFuture: [],
      _lastEmailHistoryTime: 0,
    });
    // Fire-and-forget — the picker reads from customHeaderPresets /
    // customFooterPresets which both default to [], so the builder renders
    // immediately and gets populated when the fetch resolves.
    get().fetchCustomPresets();
    updateHash(get);
  },
  closeEmailBuilder: () => {
    set({ editingCampaignId: null, editingCampaignName: null, emailDocument: null, selectedBlockId: 'root', selectedColumnIdx: null, bulkSelectedIds: [], htmlPreviewOverride: null, emailHistory: [], emailFuture: [], _lastEmailHistoryTime: 0 });
    updateHash(get);
  },

  // ── User-saved header/footer presets ──────────────────────────────────
  // Persisted in Supabase. Merged with the built-in HEADER_PRESETS /
  // FOOTER_PRESETS in the preset pickers so users see their saved templates
  // alongside the defaults. `tree` is the `{ rootId, blocks }` shape that
  // replaceHeaderFooter() consumes, re-IDed at apply time via cloneStoredTree.
  customHeaderPresets: [],
  customFooterPresets: [],

  fetchCustomPresets: async () => {
    const { data, error } = await supabase
      .from('email_header_footer_presets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      // Table not migrated yet → degrade silently rather than spamming errors.
      const msg = String(error.message || '');
      if (!msg.includes('does not exist') && !msg.includes('schema cache')) {
        console.error('fetchCustomPresets error:', error);
      }
      return;
    }
    const headers = [];
    const footers = [];
    for (const row of data || []) {
      const preset = {
        id: row.id,
        label: row.name,
        description: row.description || '',
        accent: row.accent || '#7C5CFA',
        tree: row.tree,
        isUserPreset: true,
      };
      if (row.role === 'header') headers.push(preset);
      else if (row.role === 'footer') footers.push(preset);
    }
    set({ customHeaderPresets: headers, customFooterPresets: footers });
  },

  saveCurrentAsPreset: async (role, { name, description }) => {
    const s = get();
    if (!s.emailDocument || (role !== 'header' && role !== 'footer')) return null;
    // Find the block in the doc carrying this role marker.
    const rootChildren = s.emailDocument.root?.data?.childrenIds || [];
    const rootId = rootChildren.find(id => s.emailDocument[id]?.data?.role === role);
    if (!rootId) {
      s.showToast(`No ${role} found in this template to save`);
      return null;
    }
    const tree = extractSubtree(s.emailDocument, rootId);
    const trimmedName = (name || '').trim() || `Custom ${role}`;
    const { data, error } = await supabase
      .from('email_header_footer_presets')
      .insert({
        role,
        name: trimmedName,
        description: (description || '').trim() || null,
        accent: '#7C5CFA',
        tree,
      })
      .select('*')
      .single();
    if (error) {
      const msg = String(error.message || '');
      if (msg.includes('does not exist') || msg.includes('schema cache')) {
        s.showToast('Run email_header_footer_presets migration to enable saving');
      } else {
        s.showToast(`Save failed — ${msg}`);
      }
      console.error('saveCurrentAsPreset error:', error);
      return null;
    }
    const fresh = {
      id: data.id,
      label: data.name,
      description: data.description || '',
      accent: data.accent || '#7C5CFA',
      tree: data.tree,
      isUserPreset: true,
    };
    set(prev => ({
      customHeaderPresets: role === 'header' ? [fresh, ...prev.customHeaderPresets] : prev.customHeaderPresets,
      customFooterPresets: role === 'footer' ? [fresh, ...prev.customFooterPresets] : prev.customFooterPresets,
    }));
    s.showToast(`Saved as ${role}: "${trimmedName}"`);
    return fresh;
  },

  // Rename / re-describe a saved preset. Only the metadata is updated —
  // the underlying tree stays the same so existing applies aren't affected.
  updateCustomPreset: async (id, role, { name, description }) => {
    const patch = {};
    if (typeof name === 'string') patch.name = name.trim();
    if (typeof description === 'string') patch.description = description.trim() || null;
    if (Object.keys(patch).length === 0) return false;
    const { error } = await supabase
      .from('email_header_footer_presets')
      .update(patch)
      .eq('id', id);
    if (error) {
      console.error('updateCustomPreset error:', error);
      get().showToast('Update failed');
      return false;
    }
    const apply = (list) => list.map(p => p.id === id ? { ...p, label: patch.name ?? p.label, description: patch.description ?? p.description } : p);
    set(prev => ({
      customHeaderPresets: role === 'header' ? apply(prev.customHeaderPresets) : prev.customHeaderPresets,
      customFooterPresets: role === 'footer' ? apply(prev.customFooterPresets) : prev.customFooterPresets,
    }));
    return true;
  },

  deleteCustomPreset: async (id, role) => {
    const { error } = await supabase
      .from('email_header_footer_presets')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('deleteCustomPreset error:', error);
      get().showToast('Delete failed');
      return false;
    }
    set(prev => ({
      customHeaderPresets: role === 'header'
        ? prev.customHeaderPresets.filter(p => p.id !== id)
        : prev.customHeaderPresets,
      customFooterPresets: role === 'footer'
        ? prev.customFooterPresets.filter(p => p.id !== id)
        : prev.customFooterPresets,
    }));
    return true;
  },

  // Apply a saved preset by re-IDing its stored tree and handing it to the
  // existing replaceHeaderFooter action. Built-in presets still go through
  // their preset.build(genId, name) entry point.
  applyCustomPreset: (role, preset) => {
    if (!preset?.tree) return;
    let counter = Date.now();
    const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
    const tree = cloneStoredTree(preset.tree, genId);
    if (tree) get().replaceHeaderFooter(role, tree);
  },
  setSelectedBlockId: (id) => set({ selectedBlockId: id, selectedColumnIdx: null, bulkSelectedIds: [] }),
  setSelectedColumnIdx: (idx) => set({ selectedColumnIdx: idx }),
  selectColumn: (blockId, colIdx) => set({ selectedBlockId: blockId, selectedColumnIdx: colIdx, bulkSelectedIds: [] }),
  setBulkSelectedIds: (ids) => set({ bulkSelectedIds: ids }),
  // Cmd/Shift-click on a block: build up a multi-selection from the
  // currently-selected single block + the clicked id. Re-clicking a block
  // already in the bulk set removes it. Single selection is cleared while
  // the bulk set is non-empty so the right panel switches to BulkDesignTab.
  toggleBulkSelected: (id) => set(s => {
    const current = new Set(s.bulkSelectedIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      // Seed with the existing single selection if there isn't already a
      // bulk list — gives the user "click A → cmd-click B" semantics.
      if (current.size === 0 && s.selectedBlockId && s.selectedBlockId !== id) {
        current.add(s.selectedBlockId);
      }
      current.add(id);
    }
    const ids = [...current];
    return { bulkSelectedIds: ids, selectedBlockId: ids.length === 1 ? ids[0] : null };
  }),
  updateBlock: (id, updater) => {
    get()._pushEmailHistory();
    set(s => {
      if (!s.emailDocument || !s.emailDocument[id]) return {};
      const block = s.emailDocument[id];
      const next = typeof updater === 'function' ? updater(block) : updater;
      return { emailDocument: { ...s.emailDocument, [id]: next } };
    });
  },
  addBlock: (type) => {
    get()._pushEmailHistory();
    return set(s => {
    if (!s.emailDocument) return {};
    let counter = Date.now();
    const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
    const tree = createBlockTree(type, genId);
    if (!tree) return {};
    const root = s.emailDocument.root;
    const bodyId = (root.data.childrenIds || []).find(id => s.emailDocument[id]?.data?.role === 'body');
    if (bodyId) {
      const body = s.emailDocument[bodyId];
      const props = { ...(body.data?.props || {}) };
      props.childrenIds = [...(props.childrenIds || []), tree.rootId];
      return {
        emailDocument: {
          ...s.emailDocument,
          [bodyId]: { ...body, data: { ...body.data, props } },
          ...tree.blocks,
        },
        selectedBlockId: tree.rootId,
      };
    }
    const updatedRoot = {
      ...root,
      data: { ...root.data, childrenIds: [...(root.data.childrenIds || []), tree.rootId] },
    };
    return {
      emailDocument: { ...s.emailDocument, root: updatedRoot, ...tree.blocks },
      selectedBlockId: tree.rootId,
    };
    });
  },
  // Move an existing block to a new parent slot.
  // target = { parentId, columnIdx?, index } where parentId is 'root' or a
  // block id (Container or ColumnsContainer). For ColumnsContainer parents,
  // columnIdx (0-2) chooses which column. Index is the insert position in
  // that children list.
  moveBlock: (blockId, target) => {
    get()._pushEmailHistory();
    return set(s => {
    if (!s.emailDocument || blockId === target.parentId) return {};
    const doc = { ...s.emailDocument };
    const map = buildParentMap(doc);
    const src = map[blockId];
    if (!src) return {};
    // Don't allow dropping a block into its own descendants.
    const subtree = collectBlockTree(doc, blockId);
    if (subtree.includes(target.parentId)) return {};

    const removeFrom = (parentId, columnIdx) => {
      if (parentId === 'root') {
        doc.root = { ...doc.root, data: { ...doc.root.data, childrenIds: doc.root.data.childrenIds.filter(id => id !== blockId) } };
      } else {
        const parent = doc[parentId];
        const data = { ...parent.data };
        const props = { ...(data.props || {}) };
        if (Array.isArray(props.childrenIds)) {
          props.childrenIds = props.childrenIds.filter(id => id !== blockId);
        } else if (Array.isArray(props.columns)) {
          const cols = props.columns.map((c, i) => i === columnIdx
            ? { ...c, childrenIds: (c.childrenIds || []).filter(id => id !== blockId) }
            : c
          );
          props.columns = cols;
        }
        data.props = props;
        doc[parentId] = { ...parent, data };
      }
    };

    const insertInto = (parentId, columnIdx, index) => {
      if (parentId === 'root') {
        const ids = [...doc.root.data.childrenIds];
        const clamped = Math.max(0, Math.min(index, ids.length));
        ids.splice(clamped, 0, blockId);
        doc.root = { ...doc.root, data: { ...doc.root.data, childrenIds: ids } };
      } else {
        const parent = doc[parentId];
        if (!parent) return;
        const data = { ...parent.data };
        const props = { ...(data.props || {}) };
        if (parent.type === 'ColumnsContainer') {
          const cols = (props.columns || []).map((c, i) => {
            if (i !== columnIdx) return c;
            const ids = [...(c.childrenIds || [])];
            const clamped = Math.max(0, Math.min(index, ids.length));
            ids.splice(clamped, 0, blockId);
            return { ...c, childrenIds: ids };
          });
          props.columns = cols;
        } else {
          const ids = [...(props.childrenIds || [])];
          const clamped = Math.max(0, Math.min(index, ids.length));
          ids.splice(clamped, 0, blockId);
          props.childrenIds = ids;
        }
        data.props = props;
        doc[parentId] = { ...parent, data };
      }
    };

    removeFrom(src.parentId, src.columnIdx);
    // After removal, the index inside the same parent shifts left if we removed
    // an earlier sibling. Adjust before inserting.
    let targetIndex = target.index;
    if (src.parentId === target.parentId && src.columnIdx === target.columnIdx && src.index < target.index) {
      targetIndex = target.index - 1;
    }
    insertInto(target.parentId, target.columnIdx, targetIndex);
    return { emailDocument: doc };
    });
  },

  // Drop a brand-new component (from the panel) at a specific spot.
  insertNewBlock: (type, target) => {
    get()._pushEmailHistory();
    return set(s => {
    if (!s.emailDocument) return {};
    let counter = Date.now();
    const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
    const tree = createBlockTree(type, genId);
    if (!tree) return {};
    const doc = { ...s.emailDocument, ...tree.blocks };
    if (target.parentId === 'root') {
      const ids = [...doc.root.data.childrenIds];
      const clamped = Math.max(0, Math.min(target.index, ids.length));
      ids.splice(clamped, 0, tree.rootId);
      doc.root = { ...doc.root, data: { ...doc.root.data, childrenIds: ids } };
    } else {
      const parent = doc[target.parentId];
      if (!parent) return {};
      const data = { ...parent.data };
      const props = { ...(data.props || {}) };
      if (parent.type === 'ColumnsContainer') {
        const cols = (props.columns || []).map((c, i) => {
          if (i !== target.columnIdx) return c;
          const ids = [...(c.childrenIds || [])];
          const clamped = Math.max(0, Math.min(target.index, ids.length));
          ids.splice(clamped, 0, tree.rootId);
          return { ...c, childrenIds: ids };
        });
        props.columns = cols;
      } else {
        const ids = [...(props.childrenIds || [])];
        const clamped = Math.max(0, Math.min(target.index, ids.length));
        ids.splice(clamped, 0, tree.rootId);
        props.childrenIds = ids;
      }
      data.props = props;
      doc[target.parentId] = { ...parent, data };
    }
    return { emailDocument: doc, selectedBlockId: tree.rootId };
    });
  },

  duplicateBlock: (id) => {
    get()._pushEmailHistory();
    return set(s => {
    if (!s.emailDocument || !s.emailDocument[id]) return {};
    const map = buildParentMap(s.emailDocument);
    const slot = map[id];
    if (!slot) return {};
    let counter = Date.now();
    const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
    const tree = cloneBlockTree(s.emailDocument, id, genId);
    if (!tree) return {};
    const doc = { ...s.emailDocument, ...tree.blocks };
    if (slot.parentId === 'root') {
      const ids = [...doc.root.data.childrenIds];
      ids.splice(slot.index + 1, 0, tree.rootId);
      doc.root = { ...doc.root, data: { ...doc.root.data, childrenIds: ids } };
    } else {
      const parent = doc[slot.parentId];
      const data = { ...parent.data };
      const props = { ...(data.props || {}) };
      if (parent.type === 'ColumnsContainer') {
        const cols = (props.columns || []).map((c, i) => {
          if (i !== slot.columnIdx) return c;
          const ids = [...(c.childrenIds || [])];
          ids.splice(slot.index + 1, 0, tree.rootId);
          return { ...c, childrenIds: ids };
        });
        props.columns = cols;
      } else {
        const ids = [...(props.childrenIds || [])];
        ids.splice(slot.index + 1, 0, tree.rootId);
        props.childrenIds = ids;
      }
      data.props = props;
      doc[slot.parentId] = { ...parent, data };
    }
    return { emailDocument: doc, selectedBlockId: tree.rootId };
    });
  },

  moveBlockUp: (id) => {
    const s = get();
    if (!s.emailDocument) return;
    const map = buildParentMap(s.emailDocument);
    const slot = map[id];
    if (!slot || slot.index === 0) return;
    s.moveBlock(id, { parentId: slot.parentId, columnIdx: slot.columnIdx, index: slot.index - 1 });
  },

  // Select the parent of the given block (root if no parent). Mirrors the
  // Shift+Enter keyboard shortcut so the block-toolbar button and the
  // keyboard surface a single behavior.
  selectParentBlock: (id) => {
    const s = get();
    if (!s.emailDocument || id === 'root') return;
    const map = buildParentMap(s.emailDocument);
    const parentId = map[id]?.parentId;
    if (parentId) s.setSelectedBlockId(parentId);
  },

  removeBlock: (id) => {
    get()._pushEmailHistory();
    return set(s => {
      if (!s.emailDocument || id === 'root' || !s.emailDocument[id]) return {};
    const doc = { ...s.emailDocument };
    const map = buildParentMap(doc);
    const slot = map[id];
    const toRemove = collectBlockTree(doc, id);
    toRemove.forEach(bid => { delete doc[bid]; });
    if (slot && slot.parentId !== 'root') {
      const parent = doc[slot.parentId];
      if (parent) {
        const data = { ...parent.data };
        const props = { ...(data.props || {}) };
        if (slot.columnIdx != null && Array.isArray(props.columns)) {
          props.columns = props.columns.map((c, i) => i === slot.columnIdx
            ? { ...c, childrenIds: (c.childrenIds || []).filter(cid => cid !== id) }
            : c
          );
        } else if (Array.isArray(props.childrenIds)) {
          props.childrenIds = props.childrenIds.filter(cid => cid !== id);
        }
        data.props = props;
        doc[slot.parentId] = { ...parent, data };
      }
    } else {
      doc.root = {
        ...doc.root,
        data: { ...doc.root.data, childrenIds: (doc.root.data.childrenIds || []).filter(c => c !== id) },
      };
    }
    return {
      emailDocument: doc,
      selectedBlockId: s.selectedBlockId === id ? 'root' : s.selectedBlockId,
    };
    });
  },

  // ── Tasks ──
  tasks: [],
  tasksLoading: true,
  tasksTab: 'all',
  tasksFilters: {},
  showTasksFilterBar: true,
  tasksViewMode: 'list',

  setTasksTab: (tab) => set({ tasksTab: tab }),
  setTasksViewMode: (mode) => set({ tasksViewMode: mode }),
  toggleTasksFilterBar: () => set(s => ({ showTasksFilterBar: !s.showTasksFilterBar })),
  setTasksFilter: (key, value) => {
    const filters = { ...get().tasksFilters };
    if (value == null) delete filters[key];
    else filters[key] = value;
    set({ tasksFilters: filters });
  },
  clearTasksFilters: () => set({ tasksFilters: {} }),

  fetchTasks: async () => {
    set({ tasksLoading: true });
    let { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      // Seed any missing demo task (matched by name). Users may genuinely
      // create multiple tasks with the same name, so we no longer dedupe.
      const existingNames = new Set(data.map(t => t.name));
      const missing = fallbackTasks.filter(t => !existingNames.has(t.name));
      if (missing.length > 0) {
        // Insert parents first (no parent_task_id), then subtasks (look up parent name → real id)
        const parents = missing.filter(t => !t.parent_task_id).map(({ id, parent_task_id, ...rest }) => rest);
        const subtasks = missing.filter(t => t.parent_task_id);
        let insertOk = true;

        if (parents.length > 0) {
          let { error: pErr } = await supabase.from('tasks').insert(parents);
          if (pErr && /column .* does not exist|schema cache/.test(pErr.message || '')) {
            const legacy = parents.map(({ pool, mentions, completed_at, description, ...rest }) => rest);
            ({ error: pErr } = await supabase.from('tasks').insert(legacy));
          }
          if (pErr) { console.error('Tasks seed error (parents):', pErr.message); insertOk = false; }
        }

        if (insertOk && subtasks.length > 0) {
          // Refetch to get real ids of inserted parents
          const { data: now } = await supabase.from('tasks').select('id, name');
          const nameToId = new Map((now || []).map(r => [r.name, r.id]));
          const subRows = subtasks.map(({ id, ...rest }) => ({
            ...rest,
            parent_task_id: nameToId.get(rest.parent_task) || null,
          }));
          let { error: sErr } = await supabase.from('tasks').insert(subRows);
          if (sErr && /column .* does not exist|schema cache/.test(sErr.message || '')) {
            const legacy = subRows.map(({ pool, mentions, completed_at, description, parent_task_id, ...rest }) => rest);
            ({ error: sErr } = await supabase.from('tasks').insert(legacy));
          }
          if (sErr) console.warn('Tasks seed error (subtasks):', sErr.message);
        }

        const refetch = await supabase.from('tasks').select('*').order('created_at', { ascending: true });
        data = refetch.data;
        error = refetch.error;
      }
    }

    if (error) {
      console.error('Tasks fetch error:', error.message);
      // Hard fallback: show local demo data so the page is never empty
      set({ tasks: fallbackTasks, tasksLoading: false });
      return;
    }

    // Soft fallback: if DB returned fewer tasks than the demo set (e.g. because
    // production DB doesn't have the seed and the seed insert failed silently),
    // merge in any fallback tasks whose name isn't already present.
    if ((data?.length || 0) < fallbackTasks.length) {
      const existingNames = new Set((data || []).map(t => t.name));
      const extras = fallbackTasks.filter(t => !existingNames.has(t.name));
      data = [...(data || []), ...extras];
    }

    // Auto-mark overdue pending tasks as missed
    const now = (data || []).map(t => {
      if (t.status === 'pending' && isPastDate(t.due_date)) {
        return { ...t, status: 'missed', due_missed: true };
      }
      if (t.status === 'completed' && t.due_missed) {
        return { ...t, due_missed: false };
      }
      return t;
    });
    const overdueIds = (data || [])
      .filter((t, i) => now[i] !== t && now[i].status === 'missed')
      .map(t => t.id);
    if (overdueIds.length > 0) {
      await supabase.from('tasks')
        .update({ status: 'missed', due_missed: true, updated_at: new Date().toISOString() })
        .in('id', overdueIds);
    }

    set({ tasks: now, tasksLoading: false });
  },

  createTask: async (task) => {
    const normalized = { ...task };
    if (normalized.status === 'pending' && isPastDate(normalized.due_date)) {
      normalized.status = 'missed';
      normalized.due_missed = true;
    } else if (normalized.status === 'missed') {
      normalized.due_missed = true;
    }
    if (normalized.status === 'completed' && !normalized.completed_at) {
      normalized.completed_at = new Date().toISOString();
    }
    const tempId = Date.now();
    const optimistic = { ...normalized, id: tempId };
    set(s => ({ tasks: [...s.tasks, optimistic] }));

    // Try insert with full schema; if fails due to missing column, retry with reduced payload
    let { data, error } = await supabase.from('tasks').insert(normalized).select().single();
    if (error && /column .* does not exist|schema cache/.test(error.message || '')) {
      const { parent_task_id, pool, mentions, completed_at, description, assigned_to_id, created_by_id, ...legacy } = normalized;
      ({ data, error } = await supabase.from('tasks').insert(legacy).select().single());
    }
    if (error) {
      console.error('Create task error:', error);
      set(s => ({ tasks: s.tasks.filter(t => t.id !== tempId) }));
      return null;
    }
    // Merge full payload back so UI keeps client-side fields even if DB ignored them
    const final = { ...normalized, ...data };
    set(s => ({ tasks: s.tasks.map(t => t.id === tempId ? final : t) }));
    get().logTaskAudit(final.id, 'created', { to: final.name });
    return final;
  },

  updateTask: async (id, updates) => {
    const prev = get().tasks.find(t => t.id === id);
    const merged = { ...(prev || {}), ...updates };
    const final = { ...updates };

    const overdue = isPastDate(merged.due_date);

    if ('status' in updates) {
      if (updates.status === 'completed') {
        final.due_missed = false;
        final.completed_at = new Date().toISOString();
      } else if (updates.status === 'missed') {
        final.due_missed = true;
        final.completed_at = null;
      } else if (updates.status === 'pending') {
        if (overdue) {
          final.status = 'missed';
          final.due_missed = true;
        } else {
          final.due_missed = false;
        }
        final.completed_at = null;
      }
    }
    if ('due_date' in updates && !('status' in updates) && merged.status !== 'completed') {
      if (overdue && merged.status !== 'missed') {
        final.status = 'missed';
        final.due_missed = true;
      } else if (!overdue && merged.status === 'missed') {
        final.status = 'pending';
        final.due_missed = false;
      }
    }

    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...final } : t) }));

    // Try DB update; gracefully retry without unknown columns
    let { error } = await supabase.from('tasks').update({ ...final, updated_at: new Date().toISOString() }).eq('id', id);
    if (error && /column .* does not exist|schema cache/.test(error.message || '')) {
      const { parent_task_id, pool, mentions, completed_at, description, assigned_to_id, created_by_id, ...legacy } = final;
      ({ error } = await supabase.from('tasks').update({ ...legacy, updated_at: new Date().toISOString() }).eq('id', id));
    }
    if (error) {
      console.warn('Update task error (optimistic update kept):', error.message);
    }

    // Audit logging
    if (prev) {
      Object.entries(updates).forEach(([key, val]) => {
        if (prev[key] === val) return;
        if (key === 'status') {
          get().logTaskAudit(id, 'status_changed', { field: 'status', from: prev.status, to: final.status });
        } else if (key === 'priority') {
          get().logTaskAudit(id, 'priority_changed', { field: 'priority', from: prev.priority, to: val });
        } else if (key === 'due_date') {
          get().logTaskAudit(id, 'due_date_changed', { field: 'due_date', from: prev.due_date || '(none)', to: val || '(none)' });
        } else if (key === 'assigned_to') {
          get().logTaskAudit(id, 'assignee_changed', { field: 'assigned_to', from: prev.assigned_to || '(unassigned)', to: val || '(unassigned)' });
        } else if (key === 'labels') {
          const oldL = prev.labels || []; const newL = val || [];
          const added = newL.filter(l => !oldL.includes(l));
          const removed = oldL.filter(l => !newL.includes(l));
          added.forEach(l => get().logTaskAudit(id, 'label_added', { field: 'labels', to: l }));
          removed.forEach(l => get().logTaskAudit(id, 'label_removed', { field: 'labels', from: l }));
        } else if (key === 'description' || key === 'meta') {
          get().logTaskAudit(id, 'description_changed', { field: 'description' });
        } else if (key === 'name') {
          get().logTaskAudit(id, 'renamed', { field: 'name', from: prev.name, to: val });
        }
      });
    }

    return true;
  },

  deleteTask: async (id) => {
    const prev = get().tasks;
    // Cascade-delete subtasks locally too
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id && t.parent_task_id !== id) }));
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Delete task error:', error);
      set({ tasks: prev });
      return false;
    }
    get().logTaskAudit(id, 'deleted');
    return true;
  },

  // ── Task Profiles (assignees from Settings → Users / profiles table) ──
  taskProfiles: [],
  currentUserProfile: null,
  fetchTaskProfiles: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData?.session?.user;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .order('full_name', { ascending: true });
    if (error || !data || data.length === 0) {
      set({ taskProfiles: [] });
      return;
    }
    const profiles = data.map(p => ({
      id: p.id,
      name: (p.full_name || p.email?.split('@')[0] || 'Unknown').trim(),
      email: p.email || '',
    }));
    let me = null;
    if (authUser) {
      me = profiles.find(p => p.id === authUser.id)
        || profiles.find(p => p.email && authUser.email && p.email.toLowerCase() === authUser.email.toLowerCase())
        || null;
      if (!me) {
        const meta = authUser.user_metadata || {};
        const meName = (meta.full_name || meta.first_name || authUser.email?.split('@')[0] || '').trim();
        if (meName) me = { id: authUser.id, name: meName, email: authUser.email || '' };
      }
    }
    set({ taskProfiles: profiles, currentUserProfile: me });
  },

  // ── Task Labels (custom labels stored in DB) ──
  taskLabels: [],
  fetchTaskLabels: async () => {
    const { data, error } = await supabase
      .from('task_labels')
      .select('name')
      .order('name', { ascending: true });
    if (error) {
      console.warn('task_labels fetch failed (run migration?):', error.message);
      set({ taskLabels: ['Hypertension', 'Exercise', 'Document Collection', 'Medication', 'Diabetes', 'Follow-up'] });
      return;
    }
    set({ taskLabels: (data || []).map(l => l.name) });
  },
  createTaskLabel: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    set(s => s.taskLabels.includes(trimmed) ? s : { taskLabels: [...s.taskLabels, trimmed].sort() });
    const { error } = await supabase.from('task_labels').insert({ name: trimmed });
    if (error && error.code !== '23505') {
      console.error('Create label error:', error.message);
    }
    return trimmed;
  },

  // ── Task Pools ──
  taskPools: [
    { name: 'Patient Outreach', description: 'Tasks queued for patient outreach team to claim' },
    { name: 'Care Management', description: 'Care management workflows awaiting clinical staff' },
    { name: 'Documentation', description: 'Chart review and documentation tasks' },
    { name: 'Follow-up', description: 'Post-visit follow-up tasks awaiting assignment' },
  ],
  fetchTaskPools: async () => {
    const { data, error } = await supabase.from('task_pools').select('name, description').order('name');
    if (!error && data && data.length > 0) {
      set({ taskPools: data });
    }
  },
  claimTask: async (taskId) => {
    const me = get().currentUserProfile;
    const claimer = me?.name || 'Current User';
    const claimerId = me?.id || null;
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return false;
    set(s => ({ tasks: s.tasks.map(t => t.id === taskId
      ? { ...t, assigned_to: claimer, assigned_to_id: claimerId, pool: null }
      : t) }));
    const fullPayload = { assigned_to: claimer, assigned_to_id: claimerId, pool: null, updated_at: new Date().toISOString() };
    let { error } = await supabase.from('tasks').update(fullPayload).eq('id', taskId);
    if (error && /column .* does not exist|schema cache/.test(error.message || '')) {
      const { assigned_to_id, pool, ...legacy } = fullPayload;
      ({ error } = await supabase.from('tasks').update(legacy).eq('id', taskId));
    }
    if (error) console.warn('Claim task error:', error.message);
    get().logTaskAudit(taskId, 'claimed', { field: 'assigned_to', from: '(unassigned)', to: claimer });
    return true;
  },

  // ── Task Audit Log ──
  taskAuditLogs: {}, // keyed by task_id → array of log entries

  fetchTaskAuditLog: async (taskId) => {
    if (!taskId) return [];
    const { data, error } = await supabase
      .from('task_audit_log')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('task_audit_log fetch failed (run migration?):', error.message);
      return get().taskAuditLogs[taskId] || [];
    }
    set(s => ({ taskAuditLogs: { ...s.taskAuditLogs, [taskId]: data || [] } }));
    return data || [];
  },

  logTaskAudit: async (taskId, actionType, opts = {}) => {
    if (!taskId) return;
    const me = get().currentUserProfile;
    const entry = {
      task_id: taskId,
      user_name: me?.name || 'System',
      user_id: me?.id || null,
      action_type: actionType,
      field_name: opts.field || null,
      from_value: opts.from != null ? String(opts.from) : null,
      to_value: opts.to != null ? String(opts.to) : null,
      created_at: new Date().toISOString(),
    };
    set(s => {
      const existing = s.taskAuditLogs[taskId] || [];
      return { taskAuditLogs: { ...s.taskAuditLogs, [taskId]: [{ ...entry, id: `local-${Date.now()}-${Math.random()}` }, ...existing] } };
    });
    const { error } = await supabase.from('task_audit_log').insert(entry);
    if (error && error.code !== 'PGRST204') {
      // Silently swallow if table missing; warn otherwise
      if (!error.message?.includes('task_audit_log') && !error.message?.includes('schema cache')) {
        console.warn('Audit log persist failed:', error.message);
      }
    }
  },
}));
