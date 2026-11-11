import { Icon } from '../../components/Icon/Icon';
import { BotIcon } from '../../components/Icon/BotIcon';
import { Badge } from '../../components/Badge/Badge';
import { laceTone } from '../../lib/riskTone';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import rowStyles from './worklist/WorklistRow.module.css';
import styles from './tocColumns.module.css';
import { hasAgentConnected, outreachStatusLabel, resolveAiTaskCount } from './tocOutcome';
import { AiOutcomeCell } from './tocColumnCells/AiOutcomeCell';
import { AssessmentCell } from './tocColumnCells/AssessmentCell';
import { assessmentLabel, resolveAssessmentStatus } from './tocAssessment';
import { OutreachCell } from './tocColumnCells/OutreachCell';
import { StackCell } from './tocColumnCells/StackCell';
import { contactState, medRecState, parseMdy as parseDischargeDay, relayState, visitState } from './tocDischarge';

const PROGRAM_SUB_STATUS = {
  enrolled: { variant: 'success', label: 'Enrolled', icon: 'solar:check-circle-bold' },
  engaged: { variant: 'info', label: 'Engaged', icon: 'solar:link-round-bold' },
  attempted: { variant: 'warning', label: 'Attempted', icon: 'solar:history-bold' },
  new: { variant: 'neutral', label: 'New', icon: 'solar:star-bold' },
  oncall: { variant: 'primary', label: 'On Call', icon: 'solar:phone-calling-bold' },
};

const ADMIT_CLASS = { IP: 'Inpatient', ED: 'Emergency' };

const TAG_VARIANT_BY_TONE = {
  grey:  'neutral',
  blue:  'info',
  green: 'success',
  amber: 'warning',
  red:   'danger',
};

const SAMPLE_TAGS = [
  { label: 'Diabetes', tone: 'blue' },
  { label: 'Hypertension', tone: 'amber' },
  { label: 'High Risk', tone: 'red' },
  { label: 'CHF', tone: 'red' },
  { label: 'COPD', tone: 'amber' },
  { label: 'Needs Transportation', tone: 'grey' },
  { label: 'Fall Risk', tone: 'amber' },
  { label: 'Polypharmacy', tone: 'blue' },
];

const CARE_TEAM = {
  nurse: ['PoojaNurse CFC Hills', 'Michelle Ling', 'Robin Berg'],
  coordinator: ['Chemy Maa', 'Delores Conn', 'Daniel Arsulo'],
  socialWorker: ['Robin Berg', 'Ignacio Beer', 'Daniel Arsulo'],
  chw: ['Ignacio Beer', 'shravank 7hills', 'Chemy Maa'],
};

const HUMAN_OUTREACH = ['Michelle Ling', 'Robin Berg', 'Chemy Maa', 'Delores Conn'];

const BAND = { background: 'var(--primary-50)' };
const BAND_LEFT = { ...BAND, borderLeft: '0.5px solid var(--primary-200)' };
const BAND_RIGHT = { ...BAND, borderRight: '0.5px solid var(--primary-200)' };
const BAND_TH = { background: 'var(--primary-50)' };
const BAND_TH_LEFT = { ...BAND_TH, borderLeft: '0.5px solid var(--primary-200)' };
const BAND_TH_RIGHT = { ...BAND_TH, borderRight: '0.5px solid var(--primary-200)' };

function hashPick(id, list) {
  const n = String(id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return list[n % list.length];
}

function initialsFrom(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('') || '-';
}

function programSubStatus(p) {
  return PROGRAM_SUB_STATUS[p.tocStatus] || PROGRAM_SUB_STATUS.new;
}

function riskIq(p) {
  if (p.riskIq) return p.riskIq;
  if (p.lace === 'High') return 'High';
  if (p.lace === 'Medium') return 'Moderate';
  if (p.lace === 'Low') return 'Low';
  return 'Undetermined';
}

const LACE_RANK = { High: 0, Medium: 1, Low: 2 };
const RISK_RANK = { High: 0, Moderate: 1, Low: 2, Undetermined: 3 };

function parseMdy(s) {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (!m) return null;
  return Date.UTC(+m[3], +m[1] - 1, +m[2]);
}

export function resolveLastOutreachBy(p) {
  if (!hasAgentConnected(p)) return { name: null, isAgent: false };
  if (p.lastOutreachBy) {
    return { name: p.lastOutreachBy, isAgent: p.lastOutreachBy === 'TOC Agent' };
  }
  const n = String(p.id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  if (n % 3 !== 0) return { name: 'TOC Agent', isAgent: true };
  return { name: HUMAN_OUTREACH[n % HUMAN_OUTREACH.length], isAgent: false };
}

export function resolveCareTeamName(p, field, salt = '') {
  if (p[field]) return p[field];
  const pool = field === 'nurseCoach' ? CARE_TEAM.nurse
    : field === 'coordinator' ? CARE_TEAM.coordinator
      : field === 'socialWorker' ? CARE_TEAM.socialWorker
        : CARE_TEAM.chw;
  return hashPick(`${p.id}${salt}`, pool);
}

/** Sort fields for useTableSort: dates as UTC timestamps, acuity as rank. */
export function enrichTocRow(p) {
  return {
    ...p,
    programSubStatusSort: programSubStatus(p).label,
    admitClassSort: ADMIT_CLASS[p.tocType] || 'Inpatient',
    laceSort: LACE_RANK[p.lace] ?? 3,
    aiOutcomeSort: outreachStatusLabel(p) || '',
    assessmentSort: assessmentLabel(),
    aiTasksSort: resolveAiTaskCount(p),
    nextActionDueSort: parseMdy(p.dueOn || p.nextOutreach),
    outreachSort: parseMdy(p.outreachDate || p.callDate),
    lastOutreachBySort: resolveLastOutreachBy(p).name || '',
    nurseCoachSort: resolveCareTeamName(p, 'nurseCoach'),
    coordinatorSort: resolveCareTeamName(p, 'coordinator', '-c'),
    socialWorkerSort: resolveCareTeamName(p, 'socialWorker', '-s'),
    chwSort: resolveCareTeamName(p, 'communityHealthWorker', '-h'),
    startDateSort: parseMdy(p.startDate),
    lastAdmissionSort: parseMdy(p.lastAdmission),
    radarSort: p.radar || 'Undetermined',
    riskIqSort: RISK_RANK[riskIq(p)] ?? 3,
    carePlanStatusSort: p.carePlanStatus || 'none',
    facilitySort: p.facility || '',
    dischargeSort: parseDischargeDay(p.dischargeDate)?.getTime() ?? 0,
    contactSort: contactState(p).sort,
    medRecSort: { Pending: 0, 'Not started': 1 }[medRecState(p).label] ?? 2,
  };
}

/**
 * The discharge workflow columns (care management redesign prototype),
 * first and shown by default; the Agent Worklist columns follow, hidden by
 * default and available in the column picker.
 */
const DISCHARGE_COLUMNS = [
  {
    key: 'facility',
    label: 'Facility',
    sortKey: 'facilitySort',
    sortType: 'alpha',
    width: 200,
    tdClassName: rowStyles.td,
    renderCell: (p) => <StackCell top={p.facility || '-'} sub={p.admitReason} />,
  },
  {
    key: 'discharged',
    label: 'Discharged',
    sortKey: 'dischargeSort',
    sortType: 'generic',
    width: 130,
    tdClassName: rowStyles.td,
    renderCell: (p) => <StackCell top={p.dischargeDate || '-'} sub={p.dischargeTime} />,
  },
  {
    key: 'contact2d',
    label: '2-Day Contact',
    sortKey: 'contactSort',
    sortType: 'generic',
    width: 150,
    tdClassName: rowStyles.td,
    renderCell: (p) => {
      const c = contactState(p);
      return <Badge size="md" tone={c.tone} label={c.label} />;
    },
  },
  {
    key: 'relay',
    label: 'Relay',
    width: 240,
    tdClassName: rowStyles.td,
    renderCell: (p) => {
      const r = relayState(p);
      return (
        <span className={styles.stack}>
          <span><Badge size="md" tone={r.tone} label={r.label} icon={r.tone === 'neutral' ? undefined : 'solar:cpu-bolt-linear'} /></span>
          {r.sub && <span className={styles.stackSub}>{r.sub}</span>}
        </span>
      );
    },
  },
  {
    key: 'visitWindow',
    label: 'Visit Window',
    width: 180,
    tdClassName: rowStyles.td,
    renderCell: (p) => {
      const v = visitState(p);
      return <Badge size="md" tone={v.tone} label={v.label} />;
    },
  },
  {
    key: 'medRec',
    label: 'Med Rec',
    sortKey: 'medRecSort',
    sortType: 'generic',
    width: 130,
    tdClassName: rowStyles.td,
    renderCell: (p) => {
      const m = medRecState(p);
      return <Badge size="md" tone={m.tone} label={m.label} />;
    },
  },
];

function RoleAssignee({ name, initials, field, patient, ctx, pickerTitle }) {
  const users = (ctx.platformUsers || []).map(u => ({
    id: u.id,
    name: u.name,
    initials: u.initials,
    role: u.clinicalRoles?.[0] || '',
  }));
  const onSelect = (u) => ctx.updatePatient?.(patient.id, {
    [field]: u.name,
    [`${field}Initials`]: u.initials,
  });
  if (!name) {
    return <AssigneeChange unassigned users={users} onSelect={onSelect} pickerTitle={pickerTitle} />;
  }
  return (
    <AssigneeChange
      name={name}
      initials={initials}
      showRole={false}
      users={users}
      onSelect={onSelect}
      pickerTitle={pickerTitle}
    />
  );
}

function OutreachByCell({ patient }) {
  const { name, isAgent } = resolveLastOutreachBy(patient);
  if (!name) return <span className={styles.dash}>-</span>;
  return (
    <span className={styles.person}>
      {isAgent ? (
        <BotIcon size={16} color="var(--neutral-400)" />
      ) : (
        <Icon name="solar:user-rounded-linear" size={16} color="var(--neutral-400)" />
      )}
      <span className={styles.outreachByName}>{name}</span>
    </span>
  );
}

function DateCell({ value }) {
  return <span className={value ? styles.date : styles.dash}>{value || '-'}</span>;
}

function sampleTags(p) {
  if (p.tags?.length) return { tags: p.tags, tagsMore: p.tagsMore || 0 };
  const start = String(p.id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % SAMPLE_TAGS.length;
  const count = 1 + (start % 2);
  const tags = Array.from({ length: count }, (_, i) => SAMPLE_TAGS[(start + i) % SAMPLE_TAGS.length]);
  const tagsMore = start % 3 === 0 ? 2 : 0;
  return { tags, tagsMore };
}

function TagCell({ patient }) {
  const { tags, tagsMore } = sampleTags(patient);
  if (!tags.length) return <span className={styles.dash}>-</span>;
  return (
    <span className={styles.tagCell}>
      {tags.map(t => (
        <Badge
          key={t.label}
          size="md"
          tone={TAG_VARIANT_BY_TONE[t.tone] || 'neutral'}
          label={t.label}
        />
      ))}
      {tagsMore > 0 ? <span className={styles.tagMore}>+{tagsMore} More</span> : null}
    </span>
  );
}

/**
 * TOC worklist middle columns: matches Agent Worklist Figma 3044:70430.
 * Sticky Members / Actions stay in QueueRow.
 */
const AGENT_WORKLIST_COLUMNS = [
  {
    key: 'programSubStatus',
    label: 'Program Sub Status',
    sortKey: 'programSubStatusSort',
    sortType: 'generic',
    tdClassName: rowStyles.td,
    renderCell: (p) => {
      const cfg = programSubStatus(p);
      return <Badge size="md" tone={cfg.variant} label={cfg.label} icon={cfg.icon} />;
    },
  },
  {
    key: 'admitClass',
    label: 'Admit Class',
    sortKey: 'admitClassSort',
    sortType: 'generic',
    tdClassName: rowStyles.td,
    renderCell: (p) => <DateCell value={ADMIT_CLASS[p.tocType] || 'Inpatient'} />,
  },
  {
    key: 'tocAcuity',
    label: 'TOC Acuity',
    sortKey: 'laceSort',
    sortType: 'priority',
    tdClassName: rowStyles.td,
    renderCell: (p) => (
      <Badge size="md" tone={laceTone(p.lace || 'low')} label={p.lace || 'Low'} />
    ),
  },
  {
    key: 'outreachStatus',
    label: 'AI Outcome',
    sortKey: 'aiOutcomeSort',
    sortType: 'generic',
    tdClassName: `${rowStyles.td} ${styles.agentBandTd}`,
    tdStyle: BAND_LEFT,
    thStyle: BAND_TH_LEFT,
    renderCell: (p, ctx) => (
      <AiOutcomeCell
        patient={p}
        onOpen={() => ctx.openOutreachStatusDrawer(p.id)}
      />
    ),
  },
  {
    key: 'assessment',
    label: 'AI Assessment',
    sortKey: 'assessmentSort',
    sortType: 'alpha',
    width: 200,
    tdClassName: `${rowStyles.td} ${styles.assessmentTd}`,
    tdStyle: BAND,
    thStyle: { ...BAND_TH, minWidth: 200 },
    renderCell: (p, ctx) => (
      <AssessmentCell
        patient={p}
        onOpen={() => ctx.openAssessmentDrawer(p.id, {
          prefilled: resolveAssessmentStatus(p) === 'completed',
        })}
      />
    ),
  },
  {
    key: 'aiTasks',
    label: 'AI Tasks',
    sortKey: 'aiTasksSort',
    sortType: 'number',
    tdClassName: `${rowStyles.td} ${styles.agentBandTd}`,
    tdStyle: BAND_RIGHT,
    thStyle: BAND_TH_RIGHT,
    renderCell: (p, ctx) => {
      const taskCount = resolveAiTaskCount(p);
      return taskCount > 0
        ? (
          <button
            type="button"
            className={styles.assessmentBtn}
            onClick={(e) => { e.stopPropagation(); ctx.openAiTasksDrawer(p.id); }}
            aria-label={`Open AI tasks for ${p.name}`}
          >
            <Badge size="md" tone="primary" label={String(taskCount)} />
          </button>
        )
        : <span className={styles.dash}>-</span>;
    },
  },
  {
    key: 'outreach',
    label: 'Outreach',
    sortKey: 'outreachSort',
    sortType: 'date',
    tdClassName: rowStyles.td,
    renderCell: (p, ctx) => (
      <OutreachCell
        patient={p}
        onOpen={() => ctx.openOutreachStatusDrawer(p.id)}
      />
    ),
  },
  {
    key: 'lastOutreachBy',
    label: 'Last Outreach By',
    sortKey: 'lastOutreachBySort',
    sortType: 'alpha',
    tdClassName: rowStyles.td,
    renderCell: (p) => <OutreachByCell patient={p} />,
  },
  {
    key: 'nextActionDue',
    label: 'Next Action Due',
    sortKey: 'nextActionDueSort',
    sortType: 'date',
    tdClassName: rowStyles.td,
    renderCell: (p) => <DateCell value={p.dueOn || p.nextOutreach} />,
  },
  {
    key: 'assignee',
    label: 'Assignee',
    sortKey: 'assignee',
    sortType: 'alpha',
    tdClassName: rowStyles.td,
    renderCell: (p, ctx) => (
      <RoleAssignee
        name={p.assignee}
        initials={p.assigneeInitials}
        field="assignee"
        patient={p}
        ctx={ctx}
        pickerTitle="Change assignee"
      />
    ),
  },
  {
    key: 'nurseCoach',
    label: 'Nurse/Health Coach',
    sortKey: 'nurseCoachSort',
    sortType: 'alpha',
    tdClassName: rowStyles.td,
    renderCell: (p, ctx) => {
      const name = resolveCareTeamName(p, 'nurseCoach');
      return (
        <RoleAssignee
          name={name}
          initials={p.nurseCoachInitials || initialsFrom(name)}
          field="nurseCoach"
          patient={p}
          ctx={ctx}
          pickerTitle="Change nurse / health coach"
        />
      );
    },
  },
  {
    key: 'coordinator',
    label: 'Coordinator',
    sortKey: 'coordinatorSort',
    sortType: 'alpha',
    tdClassName: rowStyles.td,
    renderCell: (p, ctx) => {
      const name = resolveCareTeamName(p, 'coordinator', '-c');
      return (
        <RoleAssignee
          name={name}
          initials={p.coordinatorInitials || initialsFrom(name)}
          field="coordinator"
          patient={p}
          ctx={ctx}
          pickerTitle="Change coordinator"
        />
      );
    },
  },
  {
    key: 'socialWorker',
    label: 'Social Worker',
    sortKey: 'socialWorkerSort',
    sortType: 'alpha',
    tdClassName: rowStyles.td,
    renderCell: (p, ctx) => {
      const name = resolveCareTeamName(p, 'socialWorker', '-s');
      return (
        <RoleAssignee
          name={name}
          initials={p.socialWorkerInitials || initialsFrom(name)}
          field="socialWorker"
          patient={p}
          ctx={ctx}
          pickerTitle="Change social worker"
        />
      );
    },
  },
  {
    key: 'communityHealthWorker',
    label: 'Com. Health Worker',
    sortKey: 'chwSort',
    sortType: 'alpha',
    tdClassName: rowStyles.td,
    renderCell: (p, ctx) => {
      const name = resolveCareTeamName(p, 'communityHealthWorker', '-h');
      return (
        <RoleAssignee
          name={name}
          initials={p.communityHealthWorkerInitials || initialsFrom(name)}
          field="communityHealthWorker"
          patient={p}
          ctx={ctx}
          pickerTitle="Change community health worker"
        />
      );
    },
  },
  {
    key: 'startDate',
    label: 'Start Date',
    sortKey: 'startDateSort',
    sortType: 'date',
    tdClassName: rowStyles.td,
    renderCell: (p) => <DateCell value={p.startDate} />,
  },
  {
    key: 'lastAdmission',
    label: 'Last Admission',
    sortKey: 'lastAdmissionSort',
    sortType: 'date',
    tdClassName: rowStyles.td,
    renderCell: (p) => <DateCell value={p.lastAdmission} />,
  },
  {
    key: 'radar',
    label: 'Radar',
    sortKey: 'radarSort',
    sortType: 'generic',
    tdClassName: rowStyles.td,
    renderCell: (p) => <span className={styles.radar}>{p.radar || 'Undetermined'}</span>,
  },
  {
    key: 'riskIq',
    label: 'Risk IQ',
    sortKey: 'riskIqSort',
    sortType: 'priority',
    tdClassName: rowStyles.td,
    renderCell: (p) => {
      const value = riskIq(p);
      const tone = value === 'High' ? styles.riskHigh
        : value === 'Moderate' ? styles.riskModerate
          : value === 'Low' ? styles.riskLow
            : '';
      return <span className={`${styles.risk} ${tone}`}>{value}</span>;
    },
  },
  {
    key: 'readmission',
    label: 'Readmission',
    sortKey: 'readmission',
    sortType: 'generic',
    tdClassName: rowStyles.td,
    renderCell: (p) => (
      p.readmission === 'Yes'
        ? <Badge size="md" tone="danger" label="Yes" />
        : <Badge size="md" label="No" />
    ),
  },
  {
    key: 'carePlanStatus',
    label: 'Care Plan Status',
    sortKey: 'carePlanStatusSort',
    sortType: 'generic',
    tdClassName: rowStyles.td,
    renderCell: (p) => (
      p.carePlanStatus === 'updated'
        ? <Badge size="md" tone="success" label="Updated" icon="solar:check-circle-linear" />
        : p.carePlanStatus === 'pending'
          ? <Badge size="md" tone="warning" label="Pending" icon="solar:clock-circle-linear" />
          : <Badge size="md" label="No Care Plan" />
    ),
  },
  {
    key: 'tags',
    label: 'Tags',
    width: 320,
    tdClassName: rowStyles.td,
    tdStyle: { minWidth: 320 },
    thStyle: { minWidth: 320 },
    renderCell: (p) => <TagCell patient={p} />,
  },
];

export const TOC_MIDDLE_COLUMNS = [
  ...DISCHARGE_COLUMNS,
  ...AGENT_WORKLIST_COLUMNS.map(c => ({ ...c, defaultHidden: true })),
];
