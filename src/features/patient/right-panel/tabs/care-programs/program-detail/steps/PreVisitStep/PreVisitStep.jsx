import { useMemo, useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { AddIconMinimalist } from '../../../../../../../../components/Icon/AddIconMinimalist';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { WorklistShell } from '../../../../../../../../components/WorklistShell/WorklistShell';
import { RadioButton } from '../../../../../../../../components/RadioButton/RadioButton';
import { EmptyState } from '../../../../../../../../components/EmptyState/EmptyState';
import { CollapsibleContent } from '../../../../../../../../components/Collapsible/Collapsible';
import { preVisitForProgram } from '../../../../../../data/programActivityMock';
import { SnapshotForm } from '../SnapshotForm/SnapshotForm';
import styles from './PreVisitStep.module.css';

// Collapsible section shell (General Info / Care Team / Pre-visit Assessment).
function Section({ title, right, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <button type="button" className={styles.sectionToggle} onClick={() => setOpen(o => !o)}>
          <DownChevronIcon
            size={16}
            color="var(--neutral-300)"
            className={styles.chevron}
            style={!open ? { transform: 'rotate(-90deg)' } : undefined}
          />
          <span className={styles.sectionTitle}>{title}</span>
        </button>
        {right}
      </div>
      <CollapsibleContent open={open}>
        <div className={styles.sectionBody}>{children}</div>
      </CollapsibleContent>
    </div>
  );
}

// Icon + title sub-section header (used by the sectioned variant).
function SubHead({ icon, title }) {
  return (
    <div className={styles.subHead}>
      <Icon name={icon} size={16} color="var(--neutral-300)" />
      <span className={styles.subTitle}>{title}</span>
    </div>
  );
}

// Bordered key/value table (TOC / HIU / DM sub-sections).
function KeyValueTable({ rows }) {
  return (
    <div className={styles.kvTable}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.kvRow}>
          <span className={styles.kvLabel}>{label}</span>
          <span className={styles.kvValue}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// Stacked label-over-value cell (SNP General Info / Payer grid).
function StackCell({ label, value }) {
  return (
    <div className={styles.stackCell}>
      <span className={styles.stackLabel}>{label}</span>
      <span className={styles.stackValue}>{value}</span>
    </div>
  );
}

// Care Team columns: mirrors the grid this table replaced: 290 / fill / 40.
// The Role column keeps its vertical rule via `thStyle` on the header and
// `.careRole` on the body cells.
const CARE_TEAM_COLUMNS = [
  { key: 'role', label: 'Role', width: 290, thStyle: { borderRight: '0.5px solid var(--neutral-150)' } },
  { key: 'providers', label: 'Providers' },
  { key: 'action', label: '', width: 40 },
];

function CareTeam({ rows, showAddRole }) {
  return (
    <div className={styles.careTable}>
      <WorklistShell
        embedded
        header={null}
        columns={CARE_TEAM_COLUMNS}
        rows={rows}
        minTableWidth={0}
        renderRow={r => (
          <tr key={r.role} className={styles.careRow}>
            <td className={styles.careRole}>{r.role}</td>
            <td className={styles.careProvider}>
              <span className={styles.careProviderInner}>
                <Avatar variant="staff" size={24} initials={r.initials} />
                <span className={styles.careName}>{r.name}</span>
              </span>
            </td>
            <td className={styles.careActionCol}>
              <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" />
            </td>
          </tr>
        )}
      />
      {showAddRole && (
        <button type="button" className={styles.addRoleRow}>
          <AddIconMinimalist size={16} color="var(--neutral-300)" />
          <span>Add New Role</span>
        </button>
      )}
    </div>
  );
}

// SNP-only: numbered Yes/No questions with a mandatory indicator.
function PreVisitAssessment({ questions }) {
  const [answers, setAnswers] = useState(() => questions.map(() => 'Yes'));
  return (
    <div className={styles.assessment}>
      {questions.map((q, i) => (
        <div key={q} className={styles.question}>
          <div className={styles.questionText}>
            <span className={styles.questionNum}>{i + 1}.</span>
            <span className={styles.questionLabel}>{q}</span>
            <span className={styles.reqDot} aria-hidden="true" />
          </div>
          <div className={styles.questionOptions}>
            <RadioButton
              checked={answers[i] === 'Yes'}
              onChange={() => setAnswers(a => a.map((v, idx) => (idx === i ? 'Yes' : v)))}
              label="Yes"
            />
            <RadioButton
              checked={answers[i] === 'No'}
              onChange={() => setAnswers(a => a.map((v, idx) => (idx === i ? 'No' : v)))}
              label="No"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * ProgramSnapshotStep: the program's Snapshot step. Its "<CODE> Snapshot"
 * form from the Forms library, editable (SnapshotForm), then the Primary Care
 * Team. A program without a Snapshot form shows its General Info instead.
 */
export function ProgramSnapshotStep({ programCode, patientId, programId, triggerType, triggerDate }) {
  const config = preVisitForProgram(programCode);
  const trigger = useMemo(() => ({ type: triggerType, date: triggerDate }), [triggerType, triggerDate]);

  return (
    <div className={styles.container}>
      <SnapshotForm
        programCode={programCode}
        patientId={patientId}
        programId={programId}
        trigger={trigger}
        fallback={<GeneralInfo config={config} />}
      />
      <Section title="Primary Care Team">
        <CareTeam rows={config.careTeam} showAddRole={config.showAddRole} />
      </Section>
    </div>
  );
}

// The program's General Info (read only), for programs without a Snapshot form.
function GeneralInfo({ config }) {
  return (
    <Section title="General Info">
      {config.variant === 'snp' ? (
        <div className={styles.generalSnp}>
          <div className={styles.stackGrid}>
            {config.general.top.map(f => (
              <StackCell key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
          <div className={styles.payerTitle}>{config.general.payerTitle}</div>
          <div className={styles.payerGrid}>
            {config.general.payerCols.flat().map(f => (
              <StackCell key={f.label} label={f.label} value={f.value} />
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.sectioned}>
          {config.sections.map(sec => (
            <div key={sec.title} className={styles.subSection}>
              <SubHead icon={sec.icon} title={sec.title} />
              <KeyValueTable rows={sec.rows} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/**
 * PreVisitStep: the Pre-visit step, just the program's Pre-visit Assessment.
 * (General Info and Care Team are the Snapshot step.)
 */
export function PreVisitStep({ programCode }) {
  const config = preVisitForProgram(programCode);
  if (!config.assessment) {
    return <EmptyState icon="solar:clipboard-check-linear" title="No pre-visit assessment for this program" />;
  }
  return (
    <div className={styles.container}>
      <Section title="Pre-visit Assessment">
        <PreVisitAssessment questions={config.assessment} />
      </Section>
    </div>
  );
}
