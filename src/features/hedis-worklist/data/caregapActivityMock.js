// Care gap activity feed mock: one entry per ActivityLog variant so the
// HEDIS Care Gap drawer renders realistic data across outreach / status
// change / clinical note / task / assignee change / upload evidence /
// comment. Keyed by HEDIS member id. Also the seed source for the
// caregap_activity table (scripts/seed.js).
export const CAREGAP_ACTIVITY_MOCK = {
  'ap-001': [
    // Outreach: full OutreachTab.LogEntry shape (call details + transcript
    // + recording/transcript action buttons expand on "View Note").
    {
      id: 'a1-1', when: '2026-05-14T14:30:00', actor: 'Delores Conn (Co-Ordinator)', t: 'outreach',
      title: '4th Outreach: Outgoing Call', outcome: 'Completed, Engaged',
      callDetails: {
        via: '(581) 824-1591', to: '(336) 812-2923', durationMin: 5,
        recordingUrl: '#', transcriptUrl: '#',
        transcript: [
          { speaker: 'Delores Conn', t: '00:09', text: 'Hi, Carlos. Thanks for taking the time to speak with me today. How are you feeling?' },
          { speaker: 'Carlos Hernandez', t: '00:27', text: "Hi, Doctor. I've been feeling pretty tired lately. And I've noticed a bit of shortness of breath over the past week…" },
          { speaker: 'Delores Conn', t: '01:12', text: 'Understood: I want to make sure your PCP knows about that.' },
        ],
      },
      note: 'Patient confirmed BP readings will be logged daily; agreed to next-week follow-up.',
    },
    // Status change: transition pills only. No View Note.
    {
      id: 'a1-2', when: '2026-04-28T11:15:00', actor: 'Alok Kumar', t: 'status_change',
      title: 'Status Changed', from: 'Open', to: 'Engaged',
    },
    // Assignee change: from → to avatar transition.
    {
      id: 'a1-3', when: '2026-04-22T10:00:00', actor: 'Alok Kumar', t: 'assignee_change',
      title: 'Assignee Changed',
      fromAssignee: { initials: 'DH', name: 'D. Hintz' },
      toAssignee:   { initials: 'AK', name: 'Alok Kumar' },
    },
    // Task: nested detail card (handle icon, title + lock, assignee,
    // status pill, external-link icon).
    {
      id: 'a1-4', when: '2026-04-15T09:30:00', actor: 'Delores Conn (Co-Ordinator)', t: 'task',
      title: 'Task Added',
      detailCard: {
        title: 'Request for Sign-off - Consolidated Clinical Note',
        locked: true, handle: true,
        assignee: 'Dr. Robert Langdon',
        priority: 'medium',
        status: 'Pending',
      },
    },
    // Appointment: Figma 1230:74055. Leading calendar icon + title over
    // a "date, time · provider" subtitle, trailing status pill and an
    // arrow-out button that later opens the appointment drawer.
    {
      id: 'a1-4a', when: '2026-04-12T14:45:00', actor: 'Donny Darko', t: 'appointment',
      title: 'Appointment Scheduled',
      detailCard: {
        title: 'EED Follow up Checks',
        subtitle: '05/03/2026, 9:00 am – 9:30 am • Donny Darko',
        status: 'Pending',
      },
    },
    // Clinical Note: nested detail card (sub-meta, bold title + Gaps
    // chip, submitted-to subtitle, status pill, eye + kebab icons, linked
    // score groups link).
    {
      id: 'a1-5', when: '2026-04-10T09:00:00', actor: 'Dr. Aldo Richman', t: 'clinical_note',
      title: 'Clinical Note Added',
      detailCard: {
        subMeta: '04/10/2026, 09:00 • Dr. Aldo Richman • CBP Non-Visit N…',
        title: 'Consolidated Clinical Note',
        chip: '3 Gaps',
        subtitle: 'Submitted for Review to Dr. Robert Langdon',
        status: 'Pending Review',
        linkedGroups: true,
        gapCodes: ['CBP', 'BCS', 'COL'],
        gapNames: ['Controlling Blood Pressure', 'Breast Cancer Screening', 'Colorectal Cancer Screening'],
      },
    },
    // Comment: HCC inline paragraph under the headline.
    {
      id: 'a1-6', when: '2026-04-02T15:45:00', actor: 'Alok Kumar', t: 'comment',
      title: 'Added a Comment',
      commentBody: 'Patient confirmed home BP monitor is calibrated; readings will be shared with PCP this week.',
    },
    // Outreach: earlier attempt with no call details.
    {
      id: 'a1-7', when: '2026-03-22T16:00:00', actor: 'Delores Conn (Co-Ordinator)', t: 'outreach',
      title: '1st Outreach: Patient Chat', outcome: 'Scheduled with PCP',
    },
    // Document evidence: the source PDF the gap was detected from.
    // Anchors the timeline: shows *why* this care gap opened.
    {
      id: 'a1-8', when: '2026-03-15T08:30:00', actor: 'Astrana Ingestion', t: 'upload',
      title: 'Care Gap Detected from Document',
      file: 'CBP Progress Note - 03-15-2026.pdf', fileType: 'Visit Note',
    },
  ],
  'ap-002': [
    { id: 'a2-1', when: '2026-05-10T10:00:00', actor: 'Sarah Lee', t: 'outreach',
      title: '2nd Outreach, Outgoing Call', outcome: 'No answer, voicemail left' },
    { id: 'a2-2', when: '2026-04-18T13:45:00', actor: 'Marcus Chen', t: 'task',
      title: 'Task Added',
      detailCard: {
        title: 'Follow up for colorectal screening referral',
        handle: true, assignee: 'Marcus Chen', priority: 'medium', status: 'Pending',
      },
    },
  ],
};
