import { ActivityLog } from './ActivityLog';

export default {
  title: 'Data/ActivityLog',
  component: ActivityLog,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Shared per-record activity feed. Each entry\'s `t` selects a variant: `outreach` renders the full OutreachTab card (call details + transcript behind "View Note", or a `details` field list behind "View details"), `status_change` renders transition pills, `clinical_note` / `task` render a nested "View Details" card, `assignee_change` renders a from → to avatar transition, `upload` renders a file card, and `comment` renders an inline paragraph. Entries of `t: "group"` are collapsible month headers. Used by the HEDIS Care Gap Details drawer.',
      },
    },
  },
  argTypes: {
    example: {
      control: { type: 'select' },
      options: [
        'all-variants', 'outreach', 'status-change', 'assignee-change',
        'detail-cards', 'accept', 'dismiss', 'delete',
        'comment', 'upload', 'grouped-months', 'empty',
      ],
      description: 'Preset entry sets showcasing each entry variant. Overrides `entries` unless you edit `entries` directly.',
    },
    entries: {
      control: 'object',
      description:
        'Ordered feed. Group headers are `{ t: "group", label }`; every other item is a log entry keyed by `t`. Meta line reads `date`, `time`, `by`, `role`, `dos`. Editing this overrides the `example` preset.',
      table: { type: { summary: 'Array<Entry | GroupHeader>' } },
    },
    emptyLabel: {
      control: 'text',
      description: 'Shown when `entries` contains no non-group items.',
      table: { type: { summary: 'string' }, defaultValue: { summary: "'No activity recorded yet.'" } },
    },
  },
};

const meta = { date: '05/14/2026', time: '2:30 PM', by: 'Delores Conn', role: 'Co-Ordinator' };

const OUTREACH = {
  t: 'outreach',
  ...meta,
  title: '4th Outreach: Outgoing Call',
  outcome: 'Completed, Engaged',
  outcomeColor: 'var(--status-success)',
  note: 'Patient confirmed BP readings will be logged daily; agreed to next-week follow-up.',
  callDetails: {
    via: '(581) 824-1591',
    to: '(336) 812-2923',
    durationMin: 5,
    recordingUrl: '#',
    transcriptUrl: '#',
    transcript: [
      { speaker: 'Delores Conn', t: '00:09', text: 'Hi, Christian. Thanks for taking the time today. How are you feeling?' },
      { speaker: 'Christian Silva', t: '00:27', text: "I've been pretty tired lately, and a bit short of breath this past week." },
      { speaker: 'Delores Conn', t: '01:12', text: 'Understood: I want to make sure your PCP knows about that.' },
    ],
  },
};

const STATUS_CHANGE = {
  t: 'status_change',
  date: '04/28/2026', time: '11:15 AM', by: 'Alok Kumar',
  title: 'Status Changed',
  from: 'Open',
  to: 'Engaged',
};

const ASSIGNEE_CHANGE = {
  t: 'assignee_change',
  date: '04/22/2026', time: '10:00 AM', by: 'Alok Kumar',
  title: 'Assignee Changed',
  fromAssignee: { initials: 'DH', name: 'D. Hintz' },
  toAssignee: { initials: 'AK', name: 'Alok Kumar' },
};

const TASK = {
  t: 'task',
  date: '04/15/2026', time: '9:30 AM', by: 'Delores Conn', role: 'Co-Ordinator',
  title: 'Task Added',
  detailCard: {
    title: 'Request for Sign-off - Consolidated Clinical Note',
    locked: true,
    handle: true,
    assignee: 'Dr. Robert Langdon',
    status: 'Pending',
  },
};

const CLINICAL_NOTE = {
  t: 'clinical_note',
  date: '04/10/2026', time: '9:00 AM', by: 'Dr. Aldo Richman', dos: '04/10/2026',
  title: 'Clinical Note Added',
  detailCard: {
    subMeta: '04/10/2026, 09:00 • Dr. Aldo Richman • CBP Non-Visit N…',
    title: 'Consolidated Clinical Note',
    chip: '3 Gaps',
    subtitle: 'Submitted for Review to Dr. Robert Langdon',
    status: 'Pending Review',
    linkedGroups: true,
  },
};

const COMMENT = {
  t: 'comment',
  date: '04/02/2026', time: '3:45 PM', by: 'Alok Kumar',
  title: 'Added a Comment',
  commentBody:
    'Patient confirmed home BP monitor is calibrated; readings will be shared with PCP this week.',
};

const UPLOAD = {
  t: 'upload',
  date: '03/15/2026', time: '8:30 AM', by: 'Astrana Ingestion',
  title: 'Care Gap Detected from Document',
  file: 'CBP Progress Note - 03-15-2026.pdf',
  fileType: 'Visit Note',
};

// HCC audit variants: accept (double-check icon, success tint), dismiss
// (circle-X, error tint), delete (trash, error tint). Rail icon comes from
// ACT_ICON per `t`; body renders through GenericEntryBody so the headline
// carries the full "X Status Changed to Accept" copy the DiagPanel shows.
const ACCEPT = {
  t: 'accept',
  date: '01/24/2026', time: '12:30 PM', by: 'N. Richards', role: 'QA', dos: '07/04/2024',
  title: '2 ICD: E11.21, I48.91 Status Changed to Accept',
};

const DISMISS = {
  t: 'dismiss',
  date: '01/21/2026', time: '12:30 PM', by: 'Lucy Moen', role: 'Compliance', dos: '07/04/2024',
  title: 'ICD: I50.9 Status Changed to Dismiss',
};

const DELETE = {
  t: 'delete',
  date: '01/15/2026', time: '12:30 PM', by: 'D. Hintz', role: 'Coder', dos: '07/04/2024',
  title: 'ICD: F32.1(Manual) is Deleted',
};

// Preset entry sets: one per former variant story. The `example` control
// picks one; the `entries` object control still lets you hand-edit a feed.
const EXAMPLES = {
  'all-variants': {
    entries: [
      { t: 'group', label: 'May 2026' },
      OUTREACH,
      { t: 'group', label: 'April 2026' },
      STATUS_CHANGE,
      ASSIGNEE_CHANGE,
      TASK,
      CLINICAL_NOTE,
      COMMENT,
      { t: 'group', label: 'March 2026' },
      { t: 'outreach', date: '03/22/2026', time: '4:00 PM', by: 'Delores Conn', role: 'Co-Ordinator', title: '1st Outreach: Patient Chat', outcome: 'Scheduled with PCP' },
      UPLOAD,
      { t: 'group', label: 'January 2026' },
      ACCEPT,
      DISMISS,
      DELETE,
    ],
  },
  'outreach': {
    entries: [OUTREACH, {
      t: 'outreach', ...meta, title: 'HbA1c 9.4 %', outcome: 'Out of range', outcomeColor: 'var(--status-error)',
      details: [{ label: 'Type', value: 'Lab' }, { label: 'Range', value: '4.0–5.6 %' }, { label: 'Source', value: 'Quest' }],
      note: 'Rising since January; flagged for the diabetes goal.',
    }],
  },
  'status-change': { entries: [STATUS_CHANGE] },
  'assignee-change': {
    entries: [ASSIGNEE_CHANGE, { ...ASSIGNEE_CHANGE, title: 'Assignee Changed (from unassigned)', fromAssignee: null }],
  },
  'detail-cards': { entries: [TASK, CLINICAL_NOTE] },
  'accept': { entries: [ACCEPT] },
  'dismiss': { entries: [DISMISS] },
  'delete': { entries: [DELETE] },
  'comment': { entries: [COMMENT] },
  'upload': { entries: [UPLOAD] },
  'grouped-months': {
    entries: [
      { t: 'group', label: 'May 2026' },
      OUTREACH,
      { t: 'group', label: 'April 2026' },
      STATUS_CHANGE,
      COMMENT,
    ],
  },
  'empty': {
    entries: [{ t: 'group', label: 'May 2026' }],
    emptyLabel: 'No activity yet for this care gap.',
  },
};

export const Playground = {
  args: { example: 'all-variants' },
  render: ({ example, entries, emptyLabel }) => {
    const preset = EXAMPLES[example] || EXAMPLES['all-variants'];
    // A hand-edited `entries` control wins over the preset.
    return (
      <ActivityLog
        entries={entries?.length ? entries : preset.entries}
        emptyLabel={emptyLabel || preset.emptyLabel}
      />
    );
  },
};
