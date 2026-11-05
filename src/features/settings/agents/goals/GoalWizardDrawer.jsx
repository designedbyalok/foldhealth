import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { useAppStore } from '../../../../store/useAppStore';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { GOAL_TEMPLATES } from '../../../../data/goals';
import {
  GoalWizardStepper,
  GoalWizardDescribeStep,
  GoalWizardConfigureStep,
  GoalWizardStepsStep,
  GoalWizardReviewStep,
} from './GoalWizardStepPages';

export function GoalWizardDrawer() {
  const goalWizardOpen = useAppStore(st => st.goalWizardOpen);
  const goalWizardEditId = useAppStore(st => st.goalWizardEditId);
  const setGoalWizard = useAppStore(st => st.setGoalWizard);
  const addGoal = useAppStore(st => st.addGoal);
  const updateGoal = useAppStore(st => st.updateGoal);
  const showToast = useAppStore(st => st.showToast);
  const goalsData = useAppStore(st => st.goalsData) || [];

  const editGoal = goalWizardEditId ? goalsData.find(g => String(g.id) === String(goalWizardEditId)) : null;

  const [step, setStep] = useState(editGoal ? 1 : 0);
  const [name, setName] = useState(editGoal?.name || '');
  const [program, setProgram] = useState(editGoal?.program || 'TCM');
  const [mode, setMode] = useState(editGoal?.mode || 'all-mandatory');
  const [desc, setDesc] = useState(editGoal?.description || '');
  const [nlInput, setNlInput] = useState('');
  const [steps, setSteps] = useState(() => editGoal?.steps?.map(st => ({ ...st })) || []);
  const [metrics, setMetrics] = useState(() => editGoal?.successMetrics ? [...editGoal.successMetrics] : []);
  const [weighted, setWeighted] = useState(editGoal?.weightedScoring || false);
  const [passingScore, setPassingScore] = useState(editGoal?.passingScore || 100);
  const [showAddStep, setShowAddStep] = useState(false);
  const [newStep, setNewStep] = useState({ name: '', type: 'mandatory', score: 10, desc: '', condition: '' });
  const [newMetric, setNewMetric] = useState('');
  const [nameError, setNameError] = useState(false);
  const [stepsError, setStepsError] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [editingStepIdx, setEditingStepIdx] = useState(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  if (!goalWizardOpen) return null;

  const isEdit = !!goalWizardEditId;
  const totalScore = steps.reduce((a, st) => a + (st.score || 0), 0);

  const isDirty = (() => {
    if (isEdit && editGoal) {
      return name !== editGoal.name ||
        desc !== (editGoal.description || '') ||
        program !== editGoal.program ||
        mode !== editGoal.mode ||
        steps.length !== editGoal.steps.length ||
        weighted !== (editGoal.weightedScoring || false) ||
        passingScore !== (editGoal.passingScore || 100);
    }
    return step > 0 && (name.trim() || desc.trim() || steps.length > 0);
  })();

  const close = () => { setGoalWizard(false, null); resetForm(); };

  const handleClose = () => {
    if (isDirty) setShowDiscardConfirm(true);
    else close();
  };

  const resetForm = () => {
    setStep(0); setName(''); setProgram('TCM'); setMode('all-mandatory');
    setDesc(''); setNlInput(''); setSteps([]); setMetrics([]);
    setWeighted(false); setPassingScore(100); setShowAddStep(false);
    setNewStep({ name: '', type: 'mandatory', score: 10, desc: '', condition: '' });
    setNewMetric(''); setNameError(false); setStepsError(false);
  };

  const goNext = () => {
    if (step === 0) { setStep(1); return; }
    if (step === 1) {
      if (!name.trim()) { setNameError(true); return; }
      setNameError(false); setStep(2); return;
    }
    if (step === 2) {
      if (!steps.length) { setStepsError(true); return; }
      setStepsError(false); setStep(3); return;
    }
    if (step === 3) { saveGoal('active'); return; }
  };

  const saveGoal = (status) => {
    const goalObj = {
      id: isEdit ? goalWizardEditId : Date.now(),
      name: name.trim(),
      program,
      programColor: program === 'TCM' ? 'purple' : program === 'Outreach' ? 'blue' : 'amber',
      description: desc.trim(),
      status,
      weightedScoring: weighted,
      passingScore: weighted ? passingScore : 100,
      mode,
      steps: steps.map((st, i) => ({ ...st, id: st.id || `s${i}` })),
      successMetrics: metrics,
      agents: isEdit ? (editGoal?.agents || []) : [],
      completionRate: isEdit ? (editGoal?.completionRate || 0) : 0,
      totalRuns: isEdit ? (editGoal?.totalRuns || 0) : 0,
      created: isEdit ? (editGoal?.created || new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })) : new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
    };
    if (isEdit) updateGoal(goalObj);
    else addGoal(goalObj);
    close();
    showToast(isEdit ? 'Goal updated' : `Goal ${status === 'draft' ? 'saved as draft' : 'published'}`);
  };

  const useTemplate = (key) => {
    const t = GOAL_TEMPLATES[key];
    if (!t) return;
    setName(t.name); setProgram(t.program); setMode(t.mode); setDesc(t.desc);
    setSteps(t.steps.map(st => ({ ...st, id: `s${Date.now()}_${Math.random().toString(36).slice(2, 6)}` })));
    setMetrics(t.metrics || []);
    setStep(1);
  };

  const generateFromNL = () => {
    if (!nlInput.trim()) return;
    setAiGenerating(true);
    setTimeout(() => {
      const generatedName = nlInput.trim().length > 50 ? `${nlInput.trim().slice(0, 50)}...` : nlInput.trim();
      setName(generatedName);
      setDesc(nlInput.trim());
      setSteps([
        { id: `g${Date.now()}_1`, name: 'Patient Identification', type: 'mandatory', score: 20, desc: 'Verify patient identity and consent.', condition: null },
        { id: `g${Date.now()}_2`, name: 'Clinical Assessment', type: 'mandatory', score: 35, desc: 'Complete structured assessment per protocol.', condition: 'Requires: Patient Identified' },
        { id: `g${Date.now()}_3`, name: 'Documentation', type: 'mandatory', score: 30, desc: 'Record findings and update care plan.', condition: 'Requires: Assessment complete' },
        { id: `g${Date.now()}_4`, name: 'Follow-up Scheduling', type: 'conditional', score: 15, desc: 'Schedule next touchpoint if indicated.', condition: 'If follow-up needed' },
      ]);
      setMetrics(['All mandatory steps completed', 'Documentation submitted within 24 hours']);
      setAiGenerating(false);
      setStep(1);
    }, 1500);
  };

  const addStepItem = () => {
    if (!newStep.name.trim()) return;
    setSteps([...steps, { ...newStep, id: `s${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }]);
    setNewStep({ name: '', type: 'mandatory', score: 10, desc: '', condition: '' });
    setShowAddStep(false);
    setStepsError(false);
  };

  const removeStep = (idx) => { setSteps(steps.filter((_, i) => i !== idx)); setEditingStepIdx(null); };
  const updateStep = (idx, updates) => setSteps(steps.map((st, i) => (i === idx ? { ...st, ...updates } : st)));

  const addMetricItem = () => {
    if (!newMetric.trim()) return;
    setMetrics([...metrics, newMetric.trim()]);
    setNewMetric('');
  };

  const removeMetric = (idx) => setMetrics(metrics.filter((_, i) => i !== idx));

  const stepProps = {
    weighted, setWeighted, passingScore, setPassingScore, totalScore, steps,
    editingStepIdx, setEditingStepIdx, updateStep, removeStep,
    showAddStep, setShowAddStep, newStep, setNewStep, addStepItem, stepsError,
  };

  return (
    <Drawer
      title={isEdit ? 'Edit Goal' : 'Create New Goal'}
      onClose={handleClose}
      headerRight={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {step >= 2 && !isEdit && (
            <Button variant="ghost" onClick={() => saveGoal('draft')}>Save Draft</Button>
          )}
          <Button onClick={goNext}>
            {step === 3 ? 'Publish Goal' : 'Next'}
          </Button>
        </div>
      }
    >
      <GoalWizardStepper step={step} setStep={setStep} />
      <GoalWizardDescribeStep
        active={step === 0}
        isEdit={isEdit}
        nlInput={nlInput}
        setNlInput={setNlInput}
        aiGenerating={aiGenerating}
        generateFromNL={generateFromNL}
        useTemplate={useTemplate}
      />
      <GoalWizardConfigureStep
        active={step === 1}
        isEdit={isEdit}
        name={name}
        setName={setName}
        nameError={nameError}
        setNameError={setNameError}
        program={program}
        setProgram={setProgram}
        mode={mode}
        setMode={setMode}
        desc={desc}
        setDesc={setDesc}
      />
      <GoalWizardStepsStep active={step === 2} {...stepProps} />
      <GoalWizardReviewStep
        active={step === 3}
        metrics={metrics}
        removeMetric={removeMetric}
        newMetric={newMetric}
        setNewMetric={setNewMetric}
        addMetricItem={addMetricItem}
        name={name}
        program={program}
        mode={mode}
        steps={steps}
        weighted={weighted}
        passingScore={passingScore}
        totalScore={totalScore}
        desc={desc}
      />
      {showDiscardConfirm && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title="Discard unsaved changes?"
          description="You have unsaved changes in this goal. If you close now, all progress will be lost."
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          variant="error"
          onCancel={() => setShowDiscardConfirm(false)}
          onConfirm={() => { setShowDiscardConfirm(false); close(); }}
        />
      )}
    </Drawer>
  );
}
