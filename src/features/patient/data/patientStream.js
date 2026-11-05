import { parseLocalDate } from '../../../lib/localDate';

/**
 * The patient's event and touchpoint stream: every record the tables already
 * hold (clinical events, medication changes, CRM touchpoints, calls, notes,
 * appointments, assessments, program activity) as one event shape, newest
 * first. Each `from*` maps one source; buildPatientStream merges them.
 *
 * Event: { id, at (ms), category, kind, title, detail, actor, actorRole,
 *   program, billingProgram, outcome, tone, durationSeconds, vendor, source,
 *   facts: [{ label, value }] } (facts: the kind's own fields, for details)
 * Labs also carry name, value and unit.
 * category: 'clinical' | 'touchpoint' | 'program'
 */

export const STREAM_CATEGORIES = [
  { value: 'clinical', label: 'Clinical' },
  { value: 'touchpoint', label: 'Touchpoints' },
  { value: 'program', label: 'Program' },
];

const ms = d => (d instanceof Date ? d.getTime() : NaN);
const fmtNum = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// "10-08-2026" / "10/08/2026" / "2026-10-08" plus an optional "2:00 pm".
export function parseDateTime(date, time) {
  const s = String(date || '').trim();
  const us = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  const day = us ? new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2])) : parseLocalDate(s);
  if (!day) return null;
  const t = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(String(time || '').trim());
  if (t) {
    let h = Number(t[1]) % 12;
    if (/pm/i.test(t[3] || '')) h += 12;
    if (!t[3] && Number(t[1]) >= 12) h = Number(t[1]);
    day.setHours(h, Number(t[2]), 0, 0);
  }
  return day;
}

const ADT_TITLE = { admit: 'Admitted', discharge: 'Discharged', transfer: 'Transferred', ed: 'ED visit' };

export function fromClinicalEvent(e) {
  const meta = e.raw_meta || {};
  const at = ms(parseLocalDate(e.effective_date));
  const value = e.numeric_value != null ? Number(e.numeric_value) : null;
  const base = { id: `ce-${e.id}`, at, category: 'clinical', kind: e.event_type, source: e.source || null, program: null };
  switch (e.event_type) {
    case 'lab': {
      const low = e.reference_low != null ? Number(e.reference_low) : null;
      const high = e.reference_high != null ? Number(e.reference_high) : null;
      const out = value != null && ((high != null && value > high) || (low != null && value < low));
      return {
        ...base,
        // Name and value apart, so a result can be compared with the previous one.
        name: e.display,
        value,
        unit: e.unit || null,
        title: `${e.display}${value != null ? ` ${fmtNum(value)}${e.unit ? ` ${e.unit}` : ''}` : ''}`,
        detail: low != null || high != null ? `Range ${low ?? ''}${low != null && high != null ? '–' : ''}${high ?? ''}${e.unit ? ` ${e.unit}` : ''}` : null,
        outcome: value == null ? null : out ? 'Out of range' : 'In range',
        tone: out ? 'error' : 'success',
        facts: [
          { label: 'Result', value: value != null ? `${fmtNum(value)}${e.unit ? ` ${e.unit}` : ''}` : null },
          { label: 'Low', value: low != null ? `${low}${e.unit ? ` ${e.unit}` : ''}` : null },
          { label: 'High', value: high != null ? `${high}${e.unit ? ` ${e.unit}` : ''}` : null },
          { label: 'Code', value: e.code ? `${e.code_system || 'LOINC'} ${e.code}` : null },
        ],
      };
    }
    case 'adt':
      return {
        ...base,
        title: `${ADT_TITLE[meta.action] || 'Hospital event'}${meta.facility ? `: ${meta.facility}` : ''}`,
        detail: [e.display, meta.disposition && `Disposition: ${meta.disposition}`].filter(Boolean).join(' · ') || null,
        outcome: meta.followUp || null,
        tone: meta.action === 'admit' || meta.action === 'ed' ? 'warning' : null,
        facts: [
          { label: 'Facility', value: meta.facility || null },
          { label: 'Reason', value: e.display || null },
          { label: 'Disposition', value: meta.disposition || null },
          { label: 'Discharged', value: e.end_date || null },
          { label: 'Follow-up', value: meta.followUp || null },
        ],
      };
    case 'encounter':
      return {
        ...base, title: `Visit: ${e.display}`, detail: meta.summary || null, actor: meta.provider || null, outcome: e.status || null,
        facts: [{ label: 'Code', value: e.code ? `${e.code_system || 'CPT'} ${e.code}` : null }, { label: 'Status', value: e.status || null }],
      };
    case 'diagnosis':
      return {
        ...base, title: `${e.status === 'resolved' ? 'Resolved' : 'Diagnosis'}: ${e.display}`, actor: meta.provider || null,
        facts: [{ label: 'Code', value: e.code ? `${e.code_system || 'ICD-10'} ${e.code}` : null }, { label: 'Status', value: e.status || null }],
      };
    case 'device':
      return {
        ...base, title: `${e.display}${value != null ? ` ${fmtNum(value)}${e.unit ? ` ${e.unit}` : ''}` : ''}`,
        facts: [{ label: 'Device', value: meta.device || null }, { label: 'Reading', value: value != null ? `${fmtNum(value)}${e.unit ? ` ${e.unit}` : ''}` : null }],
      };
    case 'prom':
      return {
        ...base, title: e.display, outcome: meta.score != null ? `Score ${meta.score}` : null,
        facts: [{ label: 'Instrument', value: meta.instrument || null }, { label: 'Score', value: meta.score != null ? String(meta.score) : null }],
      };
    default:
      return {
        ...base, title: e.display, outcome: e.status || null,
        facts: [{ label: 'Code', value: e.code ? `${e.code_system ? `${e.code_system} ` : ''}${e.code}` : null }, { label: 'Status', value: e.status || null }],
      };
  }
}

/** A medication's start and stop as two events. */
export function fromMedication(m) {
  const out = [];
  const started = parseLocalDate(m.start);
  const stopped = parseLocalDate(m.stop);
  const facts = [{ label: 'Medication', value: m.name }, { label: 'Started', value: m.start || null }, { label: 'Stopped', value: m.stop || null }];
  if (started) out.push({ id: `med-${m.id}-start`, at: ms(started), category: 'clinical', kind: 'med_start', title: `Started ${m.name}`, tone: 'success', facts });
  if (stopped) {
    out.push({
      id: `med-${m.id}-stop`, at: ms(stopped), category: 'clinical', kind: 'med_stop', title: `Stopped ${m.name}`, outcome: m.stopReason || null,
      facts: [...facts, { label: 'Reason', value: m.stopReason || null }],
    });
  }
  return out;
}

const OUTCOME_TONE = { Completed: 'success', Failed: 'error', Pending: 'warning', 'In Progress': 'warning' };

export function fromCrmActivity(a) {
  return {
    id: `crm-${a.id}`,
    at: ms(new Date(a.occurredAt)),
    category: 'touchpoint',
    kind: a.channel || 'chat',
    title: a.title,
    detail: a.note || null,
    actor: a.performedBy || null,
    actorRole: a.performedByRole || null,
    program: a.programCode || null,
    billingProgram: a.billingProgram || null,
    durationSeconds: a.durationSeconds || null,
    vendor: a.vendorName || null,
    outcome: a.status || null,
    tone: OUTCOME_TONE[a.status] || null,
    facts: [{ label: 'Status', value: a.status || null }],
  };
}

export function fromCallSession(c) {
  return {
    id: `call-${c.id}`,
    at: ms(new Date(c.created_at)),
    category: 'touchpoint',
    kind: 'call',
    title: `${c.dir === 'incoming' ? 'Incoming' : 'Outgoing'} call${c.name ? ` · ${c.name}` : ''}`,
    outcome: c.status || null,
    facts: [{ label: 'Direction', value: c.dir || null }, { label: 'Contact', value: c.name || null }, { label: 'Status', value: c.status || null }],
  };
}

// "consolidated_visit_note" -> "Consolidated visit note"; adds "note" when the type lacks it.
function noteTitle(formType) {
  if (!formType) return 'Clinical note';
  // Abbreviations (SOAP, TCM) keep their capitals; other words go lower case.
  const words = String(formType).replace(/[_-]+/g, ' ').trim().split(/\s+/)
    .map(w => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase()));
  if (words[words.length - 1].toLowerCase() !== 'note') words.push('note');
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function fromClinicalNote(n) {
  return {
    id: `note-${n.id}`,
    at: ms(new Date(n.signed_at || n.created_at)),
    category: 'clinical',
    kind: 'note',
    title: noteTitle(n.form_type),
    actor: n.signed_by_name || n.author_name || null,
    outcome: n.status || null,
    facts: [
      { label: 'Author', value: n.author_name || null },
      { label: 'Signed by', value: n.signed_by_name || null },
      { label: 'Status', value: n.status || null },
    ],
  };
}

export function fromAppointment(a) {
  return {
    id: `appt-${a.id}`,
    at: ms(parseDateTime(a.date, a.time_start)),
    category: 'touchpoint',
    kind: 'appointment',
    title: a.appointment_type_name || 'Appointment',
    detail: [a.mode, a.location, a.reason_for_visit].filter(Boolean).join(' · ') || null,
    actor: a.primary_user || null,
    outcome: a.status || null,
    tone: /no.?show|cancel/i.test(a.status || '') ? 'error' : null,
    facts: [
      { label: 'When', value: [a.date, a.time_start].filter(Boolean).join(' ') || null },
      { label: 'Mode', value: a.mode || null },
      { label: 'Location', value: a.location || null },
      { label: 'Reason', value: a.reason_for_visit || null },
      { label: 'With', value: a.primary_user || null },
    ],
  };
}

export function fromAssessment(r, formNames = new Map()) {
  return {
    id: `form-${r.id}`,
    at: ms(new Date(r.completed_at || r.created_at)),
    category: 'clinical',
    kind: 'assessment',
    title: `${formNames.get(String(r.form_id)) || 'Assessment'} completed`,
    outcome: r.status === 'completed' ? 'Completed' : r.status || null,
    tone: r.status === 'completed' ? 'success' : null,
    facts: [{ label: 'Form', value: formNames.get(String(r.form_id)) || null }],
  };
}

export function fromProgramActivity(a) {
  return {
    id: `pa-${a.id}`,
    at: ms(new Date(a.occurredAt)),
    category: 'program',
    kind: 'program',
    title: a.title,
    actor: a.actorName || null,
    program: a.programCode || null,
    outcome: a.statusLabel || null,
    facts: [{ label: 'Status', value: a.statusLabel || null }],
  };
}

/** Every source, merged newest first; events without a usable time are dropped. */
export function buildPatientStream({
  clinicalEvents = [], medications = [], crm = [], calls = [], notes = [],
  appointments = [], assessments = [], formNames, programActivity = [],
} = {}) {
  return [
    ...clinicalEvents.map(fromClinicalEvent),
    ...medications.flatMap(fromMedication),
    ...crm.map(fromCrmActivity),
    ...calls.map(fromCallSession),
    ...notes.map(fromClinicalNote),
    ...appointments.map(fromAppointment),
    ...assessments.map(r => fromAssessment(r, formNames)),
    ...programActivity.map(fromProgramActivity),
  ]
    .filter(e => Number.isFinite(e.at))
    .sort((a, b) => b.at - a.at);
}

/** Events matching the picked categories, kinds and programs (empty = all). */
export function filterStream(events, { categories = [], kinds = [], programs = [] } = {}) {
  const c = new Set(categories);
  const k = new Set(kinds);
  const p = new Set(programs);
  return (events || []).filter(e => (!c.size || c.has(e.category))
    && (!k.size || k.has(e.kind))
    && (!p.size || p.has(e.program) || p.has(e.billingProgram)));
}
