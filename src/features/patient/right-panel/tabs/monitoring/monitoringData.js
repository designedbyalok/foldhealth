// Patient Monitoring: seed + row mappers for the P360 Monitoring tab.
//
// The snapshot is keyed by member id. The Today feed's top scenario (a
// post-discharge CHF / TCM episode) binds to the first adult patient in
// all_patients (member 11103), so the rich prototype snapshot is seeded there;
// clicking "Take over" / the patient name in Today lands on this view.
//
// Identity (name, age, gender, PCP, payer) comes from the live patient record
// at render time: this data is only the clinical monitoring overlay.

export const MONITORING_SEED = {
  // Amy Phillips · member 11103 · the discharge/TCM episode from the prototype.
  '11103': {
    memberId: '11103',
    bannerText: 'Discharged Mercy General 8/21 6:40 AM · CHF exacerbation · TCM contact required',
    bannerDue: 'due 5:00 PM today',
    phoneFlags: 'SMS ok · no voicemail',
    riskRaf: 2.104,
    riskTrend: '↑ 12 mo',
    riskTier: 'High',
    utilEd90d: 2,
    utilIp90d: 1,
    utilNote: 'IP 8/18–8/21 Mercy General',
    continuityLast: 'Tara (agent) · today 10:20 AM · call',
    continuityNext: 'Wed 8/26, 9:40 AM',
    daysSinceDischarge: 0,
    dischargeLabel: 'discharged Aug 21',
    programMinutes: 6,
    programMinutesThreshold: 20,
    thresholdLabel: 'threshold by 8/31',
    openTasks: 3,
    adherence: 44,
    headerChips: [
      { label: 'TCM' },
      { label: 'CCM 6/20' },
      { label: '0 gaps · none open', tone: 'success' },
      { label: 'PDC 88% · all classes', tone: 'success' },
      { label: 'AWV Done 3/12' },
      { label: 'Lives alone', tone: 'warning' },
    ],
    programs: [
      {
        code: 'TCM',
        name: 'Transition of Care: IP',
        progress: '3 of 7 · contact window met',
        next: 'Next: 7-day visit · Wed 8/26',
        steps: [
          { label: 'ADT trigger · enrolled', meta: 'Aug 21', status: 'done' },
          { label: 'First contact (2-day)', meta: 'Met · Aug 21', status: 'done' },
          { label: 'Med reconciliation', meta: 'Aug 21', status: 'done' },
          { label: 'Discharge risk assessment', sub: 'due with first visit · you', status: 'current', action: 'Fill now' },
          { label: '7-day visit', sub: 'due Aug 26 · Dr. Chen · you', status: 'current', action: 'Schedule' },
          { label: '14-day visit', sub: 'due Sep 4', status: 'upcoming', action: 'Schedule' },
          { label: '30-day MRP · complete', sub: 'due Sep 20', status: 'upcoming' },
        ],
      },
      {
        code: 'CCM',
        name: 'Chronic Care Management: September',
        progress: '1 of 5 · cycle day 4 of 30',
        next: 'Next: 14 min to threshold',
        steps: [],
      },
    ],
    timeline: [
      { text: 'Discharged Mercy General 8/21 6:40 AM after 3-day CHF admission.', source: 'ADT' },
      { text: 'Tara reached them 10:20 AM, med-confusion trigger, escalated to you.', source: 'Agent' },
      { text: 'BNP 890 on admission (was 480 in June).', source: 'Lab' },
      { text: 'Furosemide stopped; torsemide 20 mg started at discharge.', source: 'Disch. summary' },
      { text: 'No PCP visit scheduled yet, 7-day window closes Fri 8/28.', source: 'Sched' },
    ],
    story: [
      {
        at: '8/21 10:20 AM',
        category: 'agent',
        title: 'Tara · TCM first contact · call 4:12',
        body: 'Reached Amy 26 min after the ADT event. Confirmed home, has both med bottles on counter. New torsemide unfamiliar, trigger for med-confusion workflow.',
      },
      {
        at: '8/21 6:40 AM',
        category: 'clinical',
        title: 'Discharged: Mercy General',
        body: 'CHF exacerbation (I50.23), 3-day stay. Disposition: home; lives alone. Discharge list: stop furosemide, start torsemide 20 mg.',
        icon: 'solar:danger-triangle-linear',
        iconTone: 'error',
      },
      {
        at: '8/21 8:05 AM',
        category: 'outreach',
        title: 'Post-discharge SMS sent',
        body: 'Automated check-in with med-list link. Delivered; no reply yet.',
      },
      {
        at: '8/20 2:30 PM',
        category: 'plan',
        title: 'TCM care plan applied',
        body: 'CHF transition template linked. 7-day and 14-day visit milestones added to open tasks.',
      },
      {
        at: '8/18 9:15 PM',
        category: 'clinical',
        title: 'Admitted: Mercy General ED',
        body: 'Presented with dyspnea and +8 lb weight gain over 10 days. BNP 890 on admission (480 in June). Admitted to telemetry.',
        icon: 'solar:heart-pulse-linear',
        iconTone: 'info',
      },
      {
        at: '8/18 4:00 PM',
        category: 'billing',
        title: 'TCM episode opened',
        body: 'ADT trigger logged for billing window. First-contact and med-rec milestones pending.',
      },
    ],
    tasks: [
      { title: 'TCM contact: due today 5:00 PM', sub: 'Overdue risk · 4h left', tone: 'error' },
      { title: 'Medication reconciliation vs discharge list', sub: 'During first contact', tone: 'warning' },
      { title: 'Schedule 7-day visit', sub: 'Window closes Thu 8/27', tone: 'default' },
    ],
    goals: [
      { text: 'Stay out of the hospital and keep living in my own house', conf: '6/10' },
    ],
    gaps: [
      { label: 'Med rec post-discharge', meta: 'TCM req.' },
      { label: 'Pneumococcal vaccine', meta: 'overdue 3 mo' },
    ],
  },
};

const TONE_TO_PRIORITY = { error: 'high', warning: 'medium', default: 'low' };

export function monitoringTaskSourceKey(memberId, index) {
  return `monitoring-${memberId}-${index}`;
}

function formatDueMmDdYyyy(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`;
}

export function buildMonitoringTaskPayload(patient, snapshotTask, index) {
  const today = new Date();
  const memberId = String(patient.memberId || patient.id);
  const tone = snapshotTask.tone || 'default';
  return {
    name: snapshotTask.title,
    status: tone === 'error' ? 'missed' : 'pending',
    priority: TONE_TO_PRIORITY[tone] || 'medium',
    due_date: tone === 'error' ? formatDueMmDdYyyy(today) : '',
    patient_id: patient.id,
    member: patient.name,
    program_code: 'TCM',
    source_key: monitoringTaskSourceKey(memberId, index),
  };
}

/** Idempotently materialize monitoring snapshot tasks into the shared task store. */
export async function ensureMonitoringTasksForPatient(patient, snapshotTasks, { getState, createTask }) {
  if (!patient?.id || !snapshotTasks?.length || !createTask) return;
  const memberId = String(patient.memberId || patient.id);
  for (let i = 0; i < snapshotTasks.length; i++) {
    const sourceKey = monitoringTaskSourceKey(memberId, i);
    const exists = getState().tasks.some((t) => t.source_key === sourceKey);
    if (exists) continue;
    await createTask(buildMonitoringTaskPayload(patient, snapshotTasks[i], i), { skipAudit: true });
  }
}

/** Map monitoring snapshot rail tasks into the TasksTab data shape. */
export function monitoringTasksToTabData(tasks) {
  const pending = [];
  const overdue = [];
  (tasks || []).forEach((t, i) => {
    const item = {
      id: `monitoring-rail-${i}`,
      title: t.title,
      priority: TONE_TO_PRIORITY[t.tone] || 'medium',
      due: '',
      subtasks: 0,
      attachments: 0,
      comments: 0,
      assignee: '',
      assigneeInitials: '',
    };
    if (t.tone === 'error') overdue.push(item);
    else pending.push(item);
  });
  return { pending, overdue, completed: [] };
}

// app object → Supabase row (snake_case). Used by scripts/seed.js.
export function monitoringToRow(m) {
  return {
    member_id: m.memberId,
    banner_text: m.bannerText ?? null,
    banner_due: m.bannerDue ?? null,
    phone_flags: m.phoneFlags ?? null,
    risk_raf: m.riskRaf ?? null,
    risk_trend: m.riskTrend ?? null,
    risk_tier: m.riskTier ?? null,
    util_ed_90d: m.utilEd90d ?? null,
    util_ip_90d: m.utilIp90d ?? null,
    util_note: m.utilNote ?? null,
    continuity_last: m.continuityLast ?? null,
    continuity_next: m.continuityNext ?? null,
    days_since_discharge: m.daysSinceDischarge ?? null,
    discharge_label: m.dischargeLabel ?? null,
    program_minutes: m.programMinutes ?? null,
    program_minutes_threshold: m.programMinutesThreshold ?? null,
    threshold_label: m.thresholdLabel ?? null,
    open_tasks: m.openTasks ?? null,
    adherence: m.adherence ?? null,
    header_chips: m.headerChips ?? [],
    programs: m.programs ?? [],
    timeline: m.timeline ?? [],
    story: m.story ?? [],
    tasks: m.tasks ?? [],
    goals: m.goals ?? [],
    gaps: m.gaps ?? [],
  };
}

// Supabase row (snake_case) → app object. Used by the store's fetch.
export function mapMonitoringRow(row) {
  return {
    memberId: row.member_id,
    bannerText: row.banner_text,
    bannerDue: row.banner_due,
    phoneFlags: row.phone_flags,
    riskRaf: row.risk_raf,
    riskTrend: row.risk_trend,
    riskTier: row.risk_tier,
    utilEd90d: row.util_ed_90d,
    utilIp90d: row.util_ip_90d,
    utilNote: row.util_note,
    continuityLast: row.continuity_last,
    continuityNext: row.continuity_next,
    daysSinceDischarge: row.days_since_discharge,
    dischargeLabel: row.discharge_label,
    programMinutes: row.program_minutes,
    programMinutesThreshold: row.program_minutes_threshold,
    thresholdLabel: row.threshold_label,
    openTasks: row.open_tasks,
    adherence: row.adherence,
    headerChips: row.header_chips || [],
    programs: row.programs || [],
    timeline: row.timeline || [],
    story: row.story || [],
    tasks: row.tasks || [],
    goals: row.goals || [],
    gaps: row.gaps || [],
  };
}
