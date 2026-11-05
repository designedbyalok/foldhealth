import { Badge } from '../../../components/Badge/Badge';
import { LAB_ORDER_STATUS, EVIDENCE_STATUS, GAP_EVALUATION } from './labRules';

// Icon + label + colour for every lab-workflow status, so status never
// relies on colour alone.
const ORDER = {
  [LAB_ORDER_STATUS.draft]: { tone: 'grey', icon: 'solar:document-linear' },
  [LAB_ORDER_STATUS.ordered]: { tone: 'primary', icon: 'solar:clipboard-list-linear' },
  [LAB_ORDER_STATUS.awaiting]: { tone: 'warning', icon: 'solar:clock-circle-linear' },
  [LAB_ORDER_STATUS.collected]: { tone: 'info', icon: 'solar:test-tube-linear' },
  [LAB_ORDER_STATUS.inProcess]: { tone: 'info', icon: 'solar:refresh-circle-linear' },
  [LAB_ORDER_STATUS.resultAvailable]: { tone: 'primary', icon: 'solar:document-text-linear' },
  [LAB_ORDER_STATUS.completed]: { tone: 'success', icon: 'solar:check-circle-linear' },
  [LAB_ORDER_STATUS.cancelled]: { tone: 'error', icon: 'solar:close-circle-linear' },
};
const EVIDENCE = {
  [EVIDENCE_STATUS.qualifying]: { tone: 'success', icon: 'solar:check-circle-linear' },
  [EVIDENCE_STATUS.nonQualifying]: { tone: 'error', icon: 'solar:close-circle-linear' },
  [EVIDENCE_STATUS.pendingReview]: { tone: 'warning', icon: 'solar:clock-circle-linear' },
  [EVIDENCE_STATUS.outsidePeriod]: { tone: 'grey', icon: 'solar:calendar-minimalistic-linear' },
};
const GAP = {
  [GAP_EVALUATION.open]: { tone: 'error', icon: 'solar:danger-circle-linear' },
  [GAP_EVALUATION.inProgress]: { tone: 'warning', icon: 'solar:clock-circle-linear' },
  [GAP_EVALUATION.satisfied]: { tone: 'success', icon: 'solar:check-circle-linear' },
  [GAP_EVALUATION.notSatisfied]: { tone: 'error', icon: 'solar:close-circle-linear' },
};

function StatusBadge({ map, status, size = 'sm' }) {
  const cfg = map[status] || { tone: 'neutral', icon: 'solar:info-circle-linear' };
  return <Badge tone={cfg.tone} size={size} icon={cfg.icon} label={status} />;
}

export const LabOrderStatusBadge = (p) => <StatusBadge map={ORDER} {...p} />;
export const EvidenceStatusBadge = (p) => <StatusBadge map={EVIDENCE} {...p} />;
export const GapEvaluationBadge = (p) => <StatusBadge map={GAP} {...p} />;
