import { Icon } from '../../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../../components/Icon/DownChevronIcon';
import { UnityIcon } from '../../../../../../../components/UnityIcon/UnityIcon';
import { RingEmptyState } from '../../../../../../../components/RingEmptyState/RingEmptyState';
import { Button } from '../../../../../../../components/Button/Button';
import { focusCarePlanPanel, closeCarePlanPanel } from '../../../../../hooks/useProgramPanelSplitActive';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { resolvePatientStoreId } from '../../../../../../../lib/resolvePatientStoreId';
import { closureReasonLabel, isProgramClosed } from '../../../../../data/programStatus';
import { instanceLabel, previousInstances } from '../../../../../data/programLifecycle';
import { pauseSummary } from '../../care-plan/lib/carePlanPause';
import styles from './ProgramDetailView.module.css';

const EMPTY = [];

// The Care Plan step while its plan is open as its own panel in the split,
// so the plan isn't edited in two places at once.
export function CarePlanInPanelNotice() {
  return (
    <div className={styles.stepPlaceholder}>
      <RingEmptyState icon="solar:sidebar-minimalistic-linear" label="Care plan is open in a separate panel">
        <div className={styles.carePlanNoticeActions}>
          <Button variant="outline" size="sm" onClick={closeCarePlanPanel}>Show Here</Button>
          <Button size="sm" onClick={focusCarePlanPanel}>Go to Panel</Button>
        </div>
      </RingEmptyState>
    </div>
  );
}

export function StepPlaceholder({ name }) {
  return (
    <div className={styles.stepPlaceholder}>
      <Icon name="solar:documents-linear" size={36} color="var(--neutral-150)" />
      <p className={styles.stepPlaceholderTitle}>{name}</p>
      <p className={styles.stepPlaceholderText}>This step is coming soon.</p>
    </div>
  );
}

export function DetailRow({ icon, label, value }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabelGroup}>
        <Icon name={icon} size={16} color="var(--neutral-400)" />
        <span className={styles.detailLabel}>{label}</span>
      </span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}

function CheckMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2.5 5L4.5 7L7.5 3" stroke="var(--status-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STATUS_LABEL = { completed: 'Completed', in_progress: 'In progress', skipped: 'Skipped', pending: 'Not started' };

function StepStatusIcon({ status }) {
  const label = STATUS_LABEL[status] || STATUS_LABEL.pending;
  if (status === 'completed') {
    return (
      <span className={styles.statusCompleted} role="img" aria-label={label} title={label}>
        <CheckMark />
      </span>
    );
  }
  if (status === 'in_progress') return <span className={styles.statusInProgress} role="img" aria-label={label} title={label} />;
  if (status === 'skipped') return <span className={styles.statusSkipped} role="img" aria-label={label} title={label} />;
  return <span className={styles.statusPending} role="img" aria-label={label} title={label} />;
}

// `recommended`: a care plan recommendation awaits approval on this step.
export function StepItem({ step, isActive, onClick, isChild, recommended = false }) {
  return (
    <button
      className={`${styles.stepItem} ${isActive ? styles.stepItemActive : ''} ${isChild ? styles.stepChild : ''}`}
      onClick={onClick}
    >
      <StepStatusIcon status={step.status} />
      <span className={isActive ? styles.stepNameActive : styles.stepName}>{step.name}</span>
      {recommended && (
        <span className={styles.recommendedMark} role="img" aria-label="Care plan recommendation awaiting approval" title="Care plan recommendation awaiting approval">
          <UnityIcon size={14} color="var(--primary-300)" />
        </span>
      )}
      {(step.mandatory || step.hasAlert) && <span className={styles.mandatoryDot} />}
    </button>
  );
}

export function SectionHeader({ name, expanded, onToggle }) {
  return (
    <button className={styles.sectionHeader} onClick={onToggle}>
      <DownChevronIcon
        size={16}
        color="var(--neutral-300)"
        className={styles.chevron}
        style={expanded ? undefined : { transform: 'rotate(-90deg)' }}
      />
      <span className={styles.sectionName}>{name}</span>
    </button>
  );
}

// Enrollment facts for this instance, and the program's other instances
// with how each ended.
function EnrollmentColumns({ program }) {
  const programs = useAppStore(s => s.careProgramsByPatient[resolvePatientStoreId(s, s.selectedPatientId)]) || EMPTY;
  const live = programs.find(p => p.id === program.id) || program;
  const previous = previousInstances(live, programs);
  const trigger = [live.triggerType, live.triggerDate].filter(Boolean).join(' · ');
  const closed = isProgramClosed(live.status);
  return (
    <>
      <div className={styles.expandCol}>
        <div className={styles.expandColTitle}>Enrollment</div>
        <div className={styles.expandRows}>
          <DetailRow icon="solar:hashtag-linear" label="Instance:" value={instanceLabel(live, programs)} />
          <DetailRow icon="solar:calendar-add-linear" label="Started:" value={live.startDate || '—'} />
          <DetailRow icon="solar:calendar-mark-linear" label="Planned End:" value={live.plannedEndDate || 'Not set'} />
          <DetailRow icon="solar:user-check-linear" label="Enrolled By:" value={live.enrolledBy || 'Not recorded'} />
          {trigger && <DetailRow icon="solar:bolt-linear" label="Trigger:" value={trigger} />}
          {live.status === 'Paused' && live.pause && (
            <DetailRow icon="solar:pause-circle-linear" label="Paused:" value={pauseSummary(live.pause)} />
          )}
          {closed && (
            <DetailRow
              icon="solar:close-circle-linear"
              label="Closed:"
              value={[live.endDate !== '—' && live.endDate, closureReasonLabel(live.closureReason) || live.status].filter(Boolean).join(' · ')}
            />
          )}
        </div>
      </div>
      {previous.length > 0 && (
        <div className={styles.expandCol}>
          <div className={styles.expandColTitle}>Previous Enrollments</div>
          <div className={styles.expandRows}>
            {previous.map(p => (
              <DetailRow
                key={p.id}
                icon="custom:history"
                label={`${instanceLabel(p, programs)}:`}
                value={[
                  [p.status, closureReasonLabel(p.closureReason)].filter(Boolean).join(' · '),
                  [p.startDate, p.endDate].filter(v => v && v !== '—').join(' to '),
                  p.assignee && p.assignee !== 'Unassigned' ? p.assignee : null,
                ].filter(Boolean).join(' · ')}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function ProgramDetailExpandPanel({ program }) {
  return (
    <div className={styles.expandPanel}>
      <EnrollmentColumns program={program} />
      <div className={styles.expandCol}>
        <div className={styles.expandColTitle}>Assessment &amp; Documentation</div>
        <div className={styles.expandRows}>
          <DetailRow icon="solar:document-add-linear" label="Assessment Done:" value="06/19/2025" />
          <DetailRow icon="solar:document-add-linear" label="Last HRA:" value="09/11/2024" />
          <DetailRow icon="solar:hand-heart-linear" label="Care Plan Due:" value="06/19/2025" />
          <DetailRow icon="solar:clock-circle-linear" label="Last Updated:" value="09/11/2024" />
        </div>
      </div>
      <div className={styles.expandCol}>
        <div className={styles.expandColTitle}>Care Coordination</div>
        <div className={styles.expandRows}>
          <DetailRow icon="solar:calendar-minimalistic-linear" label="ICT meeting:" value="06/19/2025" />
          <DetailRow icon="solar:double-alt-arrow-right-linear" label="Next Cadence:" value="09/11/2024" />
        </div>
      </div>
      <div className={styles.expandCol}>
        <div className={styles.expandColTitle}>Compliance &amp; Consent</div>
        <div className={styles.expandRows}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabelGroup}>
              <Icon name="solar:like-linear" size={16} color="var(--neutral-400)" />
              <span className={styles.detailLabel}>{program.code} Consent:</span>
            </span>
            <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
          </div>
        </div>
      </div>
      <div className={styles.expandCol}>
        <div className={styles.expandColTitle}>Plan &amp; Conditions</div>
        <div className={styles.expandRows}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Health Plan:</span>
            <Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" />
          </div>
          <div className={styles.condRow}>
            <span className={styles.detailLabel}>Diabetes Mellitus (DM)</span>
            <span className={styles.condBadge}>14 M</span>
          </div>
          <div className={styles.condRow}>
            <span className={styles.detailLabel}>Hypertension (HTN)</span>
            <span className={styles.condBadge}>13 M</span>
          </div>
          <div className={styles.condRow}>
            <span className={styles.detailLabel}>Cystic Fibrosis (CF)</span>
            <span className={styles.condBadge}>4 M</span>
          </div>
        </div>
      </div>
    </div>
  );
}
