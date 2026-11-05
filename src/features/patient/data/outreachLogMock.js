// Seed rows for the patient-profile Outreach feed, one per supported
// communication type so the timeline exercises every TypeDropdown option.
// Each row uses representative outcomes per the MLOV outreach_step_outcomes
// table. Lives in its own module so consumers (OutreachTab, and the HEDIS
// care gap drawer's tab count) can import it without tripping Fast Refresh's
// components-only export rule.
export const INITIAL_LOG_GROUPS = [
  {
    id: 'jan-2025', label: 'Jan 2025',
    logs: [
      {
        id: 1, type: 'Call', date: '01/29', time: '02:30 PM',
        author: 'Delores Conn (Co-Ordinator)',
        title: 'Outgoing Call', programs: ['SNP'],
        outcome: 'Enrolled', outcomeColor: 'var(--status-success)',
        note: 'Patient confirmed enrollment in SNP care plan, agreed to Friday TOC follow-up.',
        callDetails: {
          via: '(581) 824-1591', to: '(336) 812-2923', durationMin: 5,
          recordingUrl: '#', transcriptUrl: '#',
          transcript: [
            { speaker: 'Delores Conn', t: '00:09', text: 'Hi, Annette. Thanks for taking the time to speak with me today. How are you feeling?' },
            { speaker: 'Annette Brave', t: '00:27', text: "Hi, Doctor. I've been feeling pretty tired lately. And I've noticed a bit of shortness of breath over the past week…" },
          ],
        },
      },
      // Astrana-sourced (contact-level, no care program), exercises
      // the /api/v2/outreach POST surface with
      // `outreachSource: "Astrana"` and no careProgramTypeCode /
      // careProgramId. Surfaces the attribution chip and the
      // "Contact-level" badge. callDetailsMissing flags that the call
      // wasn't placed through Fold/Twilio.
      {
        id: 2, type: 'Call', date: '01/24', time: '09:15 AM',
        author: 'Marie Beauchamp (External CM)',
        title: 'Incoming Call', programs: [],
        outreachSource: 'Astrana',
        outcome: 'Spoke with patient', outcomeColor: 'var(--status-success)',
        note: 'External care manager reached patient to confirm Friday telehealth visit.',
        callDetailsMissing: true,
      },
      {
        id: 3, type: 'SMS', date: '01/21', time: '12:30 PM',
        author: 'Delores Conn (Co-Ordinator)',
        title: 'Outgoing SMS', programs: ['SNP'],
        outcome: 'Inactive Phone Line / Wrong Number', outcomeColor: 'var(--status-error)',
        note: 'Patient acknowledged appointment reminder, will arrive 5 min early.',
      },
      {
        id: 4, type: 'Email', date: '01/19', time: '10:15 AM',
        author: 'A. Beauchamp (Support)',
        title: 'Outgoing Email', programs: ['TOC'],
        outcome: 'Sent', outcomeColor: 'var(--status-success)',
        note: 'Sent post-discharge summary + medication reconciliation form.',
      },
      {
        id: 5, type: 'In Person', date: '01/17', time: '02:00 PM',
        author: 'Dr. Helen Yu (Provider)',
        title: 'In-Person Visit', programs: ['AWV'],
        outcome: 'Visit Completed', outcomeColor: 'var(--status-success)',
        note: 'Annual wellness visit done in clinic. Vitals captured, screening complete.',
      },
      {
        id: 6, type: 'Virtual', date: '01/15', time: '11:00 AM',
        author: 'Dr. Helen Yu (Provider)',
        title: 'Virtual Visit', programs: ['TOC'],
        outcome: 'Visit Completed', outcomeColor: 'var(--status-success)',
        note: 'Telehealth follow-up after hospital discharge. Reviewed meds; no red flags.',
      },
      {
        id: 7, type: 'Chat', date: '01/13', time: '04:30 PM',
        author: 'Delores Conn (Co-Ordinator)',
        title: 'Chat Message', programs: ['SNP'],
        outcome: 'Replied', outcomeColor: 'var(--status-success)',
        note: 'Patient responded in app chat: confirmed insurance card uploaded.',
      },
      {
        id: 8, type: 'Letter', date: '01/11', time: '12:30 PM',
        author: 'Delores Conn (Co-Ordinator)',
        title: 'Outgoing Letter', programs: ['SNP'],
        outcome: 'Mailed', outcomeColor: 'var(--status-warning)',
        note: 'Mailed annual benefit summary letter via USPS.',
      },
      {
        id: 9, type: 'General', date: '01/09', time: '09:00 AM',
        author: 'Delores Conn (Co-Ordinator)',
        title: 'General Outreach', programs: ['SNP'],
        outcome: 'Provider Communication', outcomeColor: 'var(--status-warning)',
        note: 'Coordinated with PCP office on referral status for cardiology consult.',
      },
    ],
  },
];

// Number of rows the feed renders on first paint.
export const OUTREACH_LOG_COUNT = INITIAL_LOG_GROUPS.reduce(
  (n, g) => n + (g.logs?.length ?? 0),
  0,
);
