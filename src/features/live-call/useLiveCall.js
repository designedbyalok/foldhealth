import { create } from 'zustand';
import { supabase } from '../../lib/supabase';
import { fallbackScript, scriptFromRow } from './liveCallModel';

/* The live call workspace: the full-screen overlay opened from the floating
   call card. The script comes from live_call_scripts; the session (consent,
   lines shown, item decisions) lasts for the call, so minimising and
   expanding again picks up where it was. */

// The demo has no speech-to-text, so after consent the script plays a line
// at a time at this pace.
const LINE_MS = 3200;

const SESSION = {
  consent: 'pending',
  consentAt: null,
  shown: 0,
  held: false,
  muted: false,
  accepted: {},
  dismissed: {},
  edits: {},
  editing: null,
  editDraft: '',
  focus: null,
  filter: 'all',
  // Main area tab, the program shown on Care Plan, and program steps marked
  // on this call ({ [enrollmentId:stepId]: { program, step, status } }).
  tab: 'transcript',
  planProgramId: null,
  stepsThisCall: {},
  // Medication editor in the right rail (keyed by medication name).
  medOpen: null,
  medEdits: {},
  // Action item shown in full in the right rail.
  detailId: null,
  // Wrap Up Call, after the call ends.
  wrapOpen: false,
  wrapSeconds: 0,
  wrapEndedAt: null,
  disposition: 'Reached',
  summaryDraft: null,
};

let timer = null;
const stopTimer = () => { if (timer) clearInterval(timer); timer = null; };

export const useLiveCall = create((set, get) => ({
  open: false,
  patient: null,
  script: null,
  loading: false,
  ...SESSION,

  /** Load the patient's script (a new patient starts a fresh session); the overlay opens separately. */
  prepare: async (patient) => {
    const key = String(patient?.memberId || patient?.id || '');
    const cur = get().patient;
    if (cur && String(cur.memberId || cur.id) === key && get().script) return;
    stopTimer();
    set({ ...SESSION, open: false, patient, script: null, loading: true });
    const { data, error } = await supabase.from('live_call_scripts').select('*').eq('member_id', key).maybeSingle();
    let script = data ? scriptFromRow(data) : null;
    if (!script) {
      if (error) console.warn('live_call_scripts fetch failed, using the local script:', error.message);
      const { LIVE_CALL_SCRIPTS } = await import('./data/scripts');
      script = LIVE_CALL_SCRIPTS.find(s => s.memberId === key) || fallbackScript(patient);
    }
    set({ script, loading: false });
  },

  show: () => set({ open: true }),
  minimize: () => set({ open: false }),

  /** The call ended: stop the transcript and open the wrap-up. */
  startWrap: (seconds) => {
    stopTimer();
    set({ open: false, wrapOpen: true, wrapSeconds: seconds, wrapEndedAt: Date.now(), disposition: 'Reached', summaryDraft: null });
  },
  setDisposition: (disposition) => set({ disposition }),
  setSummaryDraft: (summaryDraft) => set({ summaryDraft }),

  /** Wrap-up saved or discarded: drop the session. */
  reset: () => { stopTimer(); set({ ...SESSION, open: false, patient: null, script: null }); },

  setConsent: (agreed) => {
    const at = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    set({ consent: agreed ? 'yes' : 'no', consentAt: at });
    if (agreed) get().play();
  },

  play: () => {
    stopTimer();
    const step = () => {
      const { shown, script, held, consent } = get();
      if (consent !== 'yes' || held || !script) return;
      if (shown >= script.lines.length) { stopTimer(); return; }
      set({ shown: shown + 1 });
    };
    step();
    timer = setInterval(step, LINE_MS);
  },

  skipAhead: () => { stopTimer(); set(s => ({ shown: s.script?.lines.length || 0 })); },

  toggleMute: () => set(s => ({ muted: !s.muted })),
  toggleHold: () => {
    const held = !get().held;
    set({ held });
    if (!held && get().consent === 'yes') get().play();
  },

  setFilter: (filter) => set({ filter }),
  setTab: (tab) => set({ tab }),
  setPlanProgramId: (planProgramId) => set({ planProgramId }),
  markStep: (program, step, status) => set(s => {
    const key = `${program.id}:${step.id}`;
    const stepsThisCall = { ...s.stepsThisCall };
    if (status) stepsThisCall[key] = { programCode: program.code, stepName: step.name, status };
    else delete stepsThisCall[key];
    return { stepsThisCall };
  }),
  openMed: (name) => set(s => ({ medOpen: s.medOpen === name ? null : name, detailId: null })),
  openDetail: (detailId) => set({ detailId, medOpen: null, focus: detailId }),
  closeDetail: () => set({ detailId: null }),
  closeMed: () => set({ medOpen: null }),
  saveMed: (name, rec) => set(s => ({ medEdits: { ...s.medEdits, [name]: rec }, medOpen: null })),
  focusItem: (id) => set({ focus: id }),
  accept: (id) => set(s => ({ accepted: { ...s.accepted, [id]: true }, editing: null })),
  acceptMany: (ids) => set(s => ({ accepted: { ...s.accepted, ...Object.fromEntries(ids.map(id => [id, true])) } })),
  undo: (id) => set(s => { const accepted = { ...s.accepted }; delete accepted[id]; return { accepted }; }),
  dismiss: (id) => set(s => ({ dismissed: { ...s.dismissed, [id]: true } })),
  startEdit: (id, title) => set({ editing: id, editDraft: title }),
  setEditDraft: (editDraft) => set({ editDraft }),
  saveEdit: () => set(s => ({ edits: { ...s.edits, [s.editing]: s.editDraft }, editing: null })),
  cancelEdit: () => set({ editing: null }),
}));
