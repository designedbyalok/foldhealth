import { useState } from 'react';
import { Icon } from '../../../../components/Icon/Icon';
import { CheckIcon } from '../../../../components/Icon/CheckIcon';
import { Badge } from '../../../../components/Badge/Badge';
import { Button } from '../../../../components/Button/Button';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { useAppStore } from '../../../../store/useAppStore';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import s from './GoalsPanel.module.css';

export function GoalDetailDrawer() {
  const goalDetailId = useAppStore(st => st.goalDetailId);
  const setGoalDetailId = useAppStore(st => st.setGoalDetailId);
  const setGoalWizard = useAppStore(st => st.setGoalWizard);
  const showToast = useAppStore(st => st.showToast);
  const goalsData = useAppStore(st => st.goalsData) || [];
  const addGoal = useAppStore(st => st.addGoal);
  const deleteGoal = useAppStore(st => st.deleteGoal);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const goal = goalsData.find(g => g.id === goalDetailId);
  if (!goal) return null;

  const requiredSteps = goal.steps.filter(st => st.type === 'mandatory');
  const optionalSteps = goal.steps.filter(st => st.type === 'conditional');
  const totalScore = goal.steps.reduce((a, st) => a + (st.score || 0), 0);

  const handleEdit = () => {
    const id = goal.id;
    // Close detail + open wizard in one store batch to avoid hash conflicts
    useAppStore.setState({ goalDetailId: null, goalWizardOpen: true, goalWizardEditId: id });
  };

  const handleDuplicate = () => {
    const newGoal = {
      ...structuredClone(goal),
      id: Date.now(),
      name: goal.name + ' (Copy)',
      status: 'draft',
      completionRate: 0,
      totalRuns: 0,
      created: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    };
    addGoal(newGoal);
    setGoalDetailId(null);
    showToast('Goal duplicated as draft');
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteGoal(goal.id);
    } finally {
      setDeleting(false);
    }
    setShowDeleteConfirm(false);
    setGoalDetailId(null);
    showToast('Goal deleted');
  };

  // Simplified header: Edit button + more menu (instead of 3 buttons)
  const headerRight = (
    <div className={s.detailHeaderActions}>
      <Button variant="outline" size="sm" leadingIcon="solar:pen-linear" onClick={handleEdit}>Edit</Button>
      <div className={s.moreMenuWrap}>
        <ActionButton icon="solar:menu-dots-bold" tooltip="More" onClick={() => setShowMore(!showMore)} />
        {showMore && (
          <div className={s.moreMenu}>
            <button className={s.moreMenuItem} onClick={() => { handleDuplicate(); setShowMore(false); }}>
              <Icon name="solar:copy-linear" size={14} color="var(--neutral-300)" />
              Duplicate as Draft
            </button>
            <button className={`${s.moreMenuItem} ${s.moreMenuDanger}`} onClick={() => { setShowDeleteConfirm(true); setShowMore(false); }}>
              <Icon name="solar:trash-bin-minimalistic-linear" size={14} />
              Delete Goal
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Drawer
        title={goal.name}
        onClose={() => setGoalDetailId(null)}
        headerRight={headerRight}
      >
        {/* Program + Status bar */}
        <div className={s.detailTopBar}>
          <Badge tone={goal.programColor === 'purple' ? 'primary' : goal.programColor === 'blue' ? 'info' : 'warning'} label={goal.program} />
          <Badge tone={goal.status === 'active' ? 'success' : 'warning'} label={goal.status === 'active' ? 'Active' : 'Draft'} />
          {goal.weightedScoring && (
            <span className={s.detailScoreInfo}>
              <Icon name="solar:chart-linear" size={12} color="var(--primary-300)" />
              Weighted &middot; Pass: {goal.passingScore}/{totalScore}pt
            </span>
          )}
        </div>

        {/* Description */}
        {goal.description && (
          <p className={s.detailDescription}>{goal.description}</p>
        )}

        {/* Stats row */}
        <div className={s.detailStats}>
          <div className={s.detailStat}>
            <div className={s.detailStatVal}>{goal.completionRate}%</div>
            <div className={s.detailStatLabel}>Completion</div>
          </div>
          <div className={s.detailStat}>
            <div className={s.detailStatVal}>{goal.totalRuns.toLocaleString()}</div>
            <div className={s.detailStatLabel}>Total Runs</div>
          </div>
          <div className={s.detailStat}>
            <div className={s.detailStatVal}>{goal.agents.length}</div>
            <div className={s.detailStatLabel}>Linked Agents</div>
          </div>
        </div>

        {/* Steps: Required */}
        <div className={s.detailSectionHeader}>
          <Icon name="solar:clipboard-list-linear" size={14} color="var(--neutral-300)" />
          <span>Required Steps ({requiredSteps.length})</span>
        </div>
        <div className={s.stepTimeline}>
          {requiredSteps.map((step, i) => (
            <div key={step.id} className={s.stepTimelineItem}>
              <div className={`${s.stepIcon} ${s.stepIconRequired}`}>
                <CheckIcon size={14} color="#009B53" />
              </div>
              <div className={`${s.stepBody} ${s.stepBodyRequired}`}>
                <div className={s.stepName}>
                  <span>{i + 1}. {step.name}</span>
                  <div className={s.stepNameRight}>
                    {goal.weightedScoring && <span className={s.scoreChip}>{step.score}pt</span>}
                    <Badge tone="success" label="Required" />
                  </div>
                </div>
                <div className={s.stepNote}>{step.desc}</div>
                {step.condition && (
                  <div className={s.stepDependency}>
                    <Icon name="solar:link-linear" size={10} /> {step.condition}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Steps: Optional */}
        {optionalSteps.length > 0 && (
          <>
            <div className={s.detailSectionHeader}>
              <Icon name="solar:star-linear" size={14} color="var(--neutral-300)" />
              <span>Optional Steps ({optionalSteps.length})</span>
            </div>
            <div className={s.stepTimeline}>
              {optionalSteps.map((step, i) => (
                <div key={step.id} className={s.stepTimelineItem}>
                  <div className={`${s.stepIcon} ${s.stepIconOptional}`}>
                    <Icon name="solar:alt-arrow-right-linear" size={14} />
                  </div>
                  <div className={s.stepBody}>
                    <div className={s.stepName}>
                      <span>{requiredSteps.length + i + 1}. {step.name}</span>
                      <div className={s.stepNameRight}>
                        {goal.weightedScoring && <span className={s.scoreChip}>{step.score}pt</span>}
                        <Badge tone="warning" label="Optional" />
                      </div>
                    </div>
                    <div className={s.stepNote}>{step.desc}</div>
                    {step.condition && (
                      <div className={s.stepDependency}>
                        <Icon name="solar:link-linear" size={10} /> {step.condition}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <hr className={s.divider} />

        {/* Success Criteria */}
        {goal.successMetrics.length > 0 && (
          <>
            <div className={s.detailSectionHeader}>
              <CheckIcon size={14} color="#009B53" />
              <span>Success Criteria</span>
            </div>
            <div className={s.successContainer}>
              {goal.successMetrics.map((m, i) => (
                <div key={i} className={s.successItem}>
                  <CheckIcon size={14} color="#009B53" /> {m}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Linked Agents */}
        {goal.agents.length > 0 && (
          <>
            <hr className={s.divider} />
            <div className={s.detailSectionHeader}>
              <Icon name="solar:bot-linear" size={14} color="var(--neutral-300)" />
              <span>Linked Agents ({goal.agents.length})</span>
            </div>
            <div className={s.agentChipRow}>
              {goal.agents.map(a => (
                <span key={a} className={s.agentChip}>
                  <Icon name="solar:bot-linear" size={12} /> {a}
                </span>
              ))}
            </div>
          </>
        )}
      </Drawer>

      {showDeleteConfirm && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Delete "${goal.name}"`}
          description="Are you sure you want to delete this goal? All steps, success criteria, and run history will be permanently removed. This action cannot be undone."
          confirmLabel="Delete Goal"
          cancelLabel="Cancel"
          variant="error"
          loading={deleting}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
