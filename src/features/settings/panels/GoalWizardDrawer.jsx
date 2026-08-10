import { useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { CheckIcon } from '../../../components/Icon/CheckIcon';
import { Badge } from '../../../components/Badge/Badge';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Input } from '../../../components/Input/Input';
import { useAppStore } from '../../../store/useAppStore';
import { Switch } from '../../../components/Switch/Switch';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { GOAL_TEMPLATES } from '../../../data/goals'; // Templates are config, not DB data
import s from './GoalsPanel.module.css';

const WIZARD_LABELS = ['Describe', 'Configure', 'Steps', 'Review'];
const PROGRAMS = ['TCM', 'Outreach', 'Onboarding', 'Preventive', 'Billing'];
const MODES = [
  { value: 'all-mandatory', label: 'All mandatory required' },
  { value: 'sequential', label: 'Sequential order' },
  { value: 'any', label: 'Any step sufficient' },
];

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

  // Check if form has meaningful unsaved changes
  const isDirty = (() => {
    if (isEdit && editGoal) {
      // Compare current state against loaded goal
      return name !== editGoal.name ||
        desc !== (editGoal.description || '') ||
        program !== editGoal.program ||
        mode !== editGoal.mode ||
        steps.length !== editGoal.steps.length ||
        weighted !== (editGoal.weightedScoring || false) ||
        passingScore !== (editGoal.passingScore || 100);
    }
    // New goal — dirty if any field has content beyond step 0
    return step > 0 && (name.trim() || desc.trim() || steps.length > 0);
  })();

  const close = () => { setGoalWizard(false, null); resetForm(); };

  const handleClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      close();
    }
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

  const goBack = () => { if (step > 0) setStep(step - 1); };

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
    if (isEdit) { updateGoal(goalObj); } else { addGoal(goalObj); }
    close();
    showToast(isEdit ? 'Goal updated' : `Goal ${status === 'draft' ? 'saved as draft' : 'published'}`);
  };

  const useTemplate = (key) => {
    const t = GOAL_TEMPLATES[key];
    if (!t) return;
    setName(t.name); setProgram(t.program); setMode(t.mode); setDesc(t.desc);
    setSteps(t.steps.map(st => ({ ...st, id: `s${Date.now()}_${Math.random().toString(36).slice(2,6)}` })));
    setMetrics(t.metrics || []);
    setStep(1);
  };

  const generateFromNL = () => {
    if (!nlInput.trim()) return;
    setAiGenerating(true);
    setTimeout(() => {
      // Simulate AI generation
      const generatedName = nlInput.trim().length > 50 ? nlInput.trim().slice(0, 50) + '...' : nlInput.trim();
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
    setSteps([...steps, { ...newStep, id: `s${Date.now()}_${Math.random().toString(36).slice(2,6)}` }]);
    setNewStep({ name: '', type: 'mandatory', score: 10, desc: '', condition: '' });
    setShowAddStep(false);
    setStepsError(false);
  };

  const removeStep = (idx) => { setSteps(steps.filter((_, i) => i !== idx)); setEditingStepIdx(null); };
  const updateStep = (idx, updates) => setSteps(steps.map((st, i) => i === idx ? { ...st, ...updates } : st));

  const addMetricItem = () => {
    if (!newMetric.trim()) return;
    setMetrics([...metrics, newMetric.trim()]);
    setNewMetric('');
  };

  const removeMetric = (idx) => setMetrics(metrics.filter((_, i) => i !== idx));

  // ── Stepper — clickable on any visited step ──
  const renderStepper = () => (
    <div className={s.stepper}>
      {WIZARD_LABELS.map((label, i) => (
        <div key={label} style={{ display: 'contents' }}>
          <div
            className={`${s.wizStep} ${i === step ? s.wizStepActive : i < step ? s.wizStepDone : ''}`}
            onClick={() => setStep(i)}
            style={{ cursor: 'pointer' }}
          >
            <div className={s.wizStepNum}>{i < step ? <CheckIcon size={12} color="var(--primary-300)" /> : i + 1}</div>
            <span className={s.wizStepLabel}>{label}</span>
          </div>
          {i < WIZARD_LABELS.length - 1 && (
            <div className={`${s.wizConnector} ${i < step ? s.wizConnectorDone : ''}`} />
          )}
        </div>
      ))}
    </div>
  );

  // ── Page 0: Describe ──
  const renderDescribe = () => (
    <div className={step === 0 ? s.wizPageActive : s.wizPage}>
      <div className={s.sectionTitle}>
        <Icon name="solar:bot-linear" size={14} color="var(--primary-300)" />
        Describe Your Goal
      </div>
      <div className={s.nlBox}>
        <div className={s.nlBoxHeader}>
          <span className={s.nlBadge}>AI POWERED</span>
          <Button variant="secondary" size="S"
            onClick={() => setNlInput('Complete a post-discharge follow-up within 72 hours including identity verification, medication adherence check, symptom assessment, and scheduling based on severity.')}>
            Try Example
          </Button>
        </div>
        <textarea
          value={nlInput}
          onChange={e => setNlInput(e.target.value)}
          placeholder="Describe what the agent should accomplish. Be specific about step order, mandatory requirements, and dependencies..."
        />
        <div className={s.nlBoxFooter}>
          <span className={s.nlHint}>AI will generate steps, scoring, and success criteria</span>
          <Button variant="primary" size="S" leadingIcon="solar:magic-stick-3-linear"
            onClick={generateFromNL} disabled={aiGenerating}>
            {aiGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </div>
      {!isEdit && (
        <>
          <div style={{ fontSize: 11, color: 'var(--neutral-200)', marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Or start from a template
          </div>
          <div className={s.templateGrid}>
            {[
              { key: 'tcm', icon: 'solar:pill-linear', title: 'TCM Workflow', desc: 'Outreach → Medication → Symptom → Billing' },
              { key: 'outreach', icon: 'solar:phone-calling-linear', title: 'Patient Outreach', desc: 'Identify → Communicate → Schedule → Confirm' },
              { key: 'onboarding', icon: 'solar:smartphone-linear', title: 'App Onboarding', desc: 'Invite → Register → Walkthrough → First Action' },
              { key: 'monitoring', icon: 'solar:heart-pulse-linear', title: 'Chronic Monitoring', desc: 'Engage → Vitals → Medication → Alert' },
            ].map(t => (
              <div key={t.key} className={s.templateCard} onClick={() => useTemplate(t.key)}>
                <div className={s.templateCardTitle}><Icon name={t.icon} size={14} /> {t.title}</div>
                <div className={s.templateCardDesc}>{t.desc}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ── Page 1: Configure ──
  const renderConfigure = () => (
    <div className={step === 1 ? s.wizPageActive : s.wizPage}>
      {isEdit && (
        <div className={s.warnBox}><Icon name="solar:pen-linear" size={14} /><span>Editing a published goal. Changes apply to new runs.</span></div>
      )}
      <div className={s.formGroup}>
        <div className={s.formLabel}>Goal Name <span className={s.formReq} /></div>
        <Input type="text" value={name}
          onChange={e => { setName(e.target.value); setNameError(false); }}
          placeholder="e.g. TCM Full Program Completion"
          style={nameError ? { borderColor: 'var(--status-error)' } : undefined} />
        {nameError && <div className={`${s.formError} ${s.formErrorVisible}`}>Goal name is required</div>}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className={s.formGroup} style={{ flex: 1 }}>
          <div className={s.formLabel}>Program</div>
          <select className={s.formSelect} value={program} onChange={e => setProgram(e.target.value)}>
            {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className={s.formGroup} style={{ flex: 1 }}>
          <div className={s.formLabel}>Completion Mode</div>
          <select className={s.formSelect} value={mode} onChange={e => setMode(e.target.value)}>
            {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <div className={s.formGroup}>
        <div className={s.formLabel}>Description</div>
        <textarea className={s.formTextarea} value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="What is this goal about?" />
      </div>
    </div>
  );

  // ── Page 2: Steps ──
  const renderSteps = () => (
    <div className={step === 2 ? s.wizPageActive : s.wizPage}>
      {/* Weighted Scoring — single expandable container */}
      <div className={`${s.scoringContainer} ${weighted ? s.scoringContainerOpen : ''}`}>
        <div className={s.scoringToggle} onClick={() => setWeighted(!weighted)}>
          <div className={s.scoringToggleLabel}>
            <Icon name="solar:chart-linear" size={16} color="var(--primary-300)" />
            <div>
              <div className={s.scoringTitle}>Weighted Scoring</div>
              <div className={s.scoringSub}>Assign point values to steps and set a pass threshold</div>
            </div>
          </div>
          <Switch checked={weighted} onChange={() => setWeighted(!weighted)} />
        </div>
        {weighted && (
          <div className={s.thresholdRow}>
            <span className={s.thresholdLabel}>Pass Threshold</span>
            <input className={s.thresholdInput} type="number" min={1} max={1000} value={passingScore}
              onChange={e => { e.stopPropagation(); setPassingScore(parseInt(e.target.value) || 0); }} />
            <span className={s.thresholdUnit}>pts</span>
            <span className={s.thresholdTotal}>
              Total: {totalScore}pt
            </span>
          </div>
        )}
      </div>

      {/* Steps Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 16 }}>
        <div className={s.sectionTitle} style={{ marginBottom: 0 }}>
          <Icon name="solar:clipboard-list-linear" size={14} color="var(--neutral-300)" />
          Goal Steps
          <span style={{ fontSize: 12, color: 'var(--neutral-200)', fontWeight: 400, marginLeft: 8 }}>
            <span style={{ color: 'var(--status-success)' }}>●</span> Required <span style={{ color: 'var(--status-warning)' }}>●</span> Optional
          </span>
        </div>
        <Button variant="secondary" size="S" onClick={() => setShowAddStep(true)}>
          + Add Step
        </Button>
      </div>

      {/* Steps List */}
      {steps.map((st, i) => (
        editingStepIdx === i ? (
          /* Inline Edit Form */
          <div key={st.id || i} style={{ background: 'var(--neutral-50)', border: '0.5px solid var(--neutral-150)', borderRadius: 8, padding: 12, marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--primary-300)', marginBottom: 8 }}>Edit Step {i + 1}</div>
            <div className={s.addStepRow}>
              <Input type="text" value={st.name} style={{ flex: 2 }}
                onChange={e => updateStep(i, { name: e.target.value })} placeholder="Step name" />
              <select className={s.formSelect} value={st.type} style={{ flex: 1 }}
                onChange={e => updateStep(i, { type: e.target.value })}>
                <option value="mandatory">Required</option>
                <option value="conditional">Optional</option>
              </select>
              {weighted && (
                <input className={s.thresholdInput} type="number" min={1} max={999} value={st.score} style={{ width: 50 }}
                  onChange={e => updateStep(i, { score: parseInt(e.target.value) || 0 })} />
              )}
            </div>
            <textarea className={s.formTextarea} style={{ minHeight: 52, marginBottom: 8 }} value={st.desc || ''}
              onChange={e => updateStep(i, { desc: e.target.value })} placeholder="Step description" />
            <Input type="text" style={{ marginBottom: 8 }} value={st.condition || ''}
              onChange={e => updateStep(i, { condition: e.target.value })} placeholder="Dependency condition (optional)" />
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="primary" size="S" onClick={() => setEditingStepIdx(null)}>Save</Button>
              <Button variant="ghost" size="S" onClick={() => setEditingStepIdx(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          /* Step Display */
          <div key={st.id || i} className={s.stepItem}>
            <div className={s.stepNum}>{i + 1}</div>
            <div className={s.stepContent}>
              <div className={s.stepNameRow}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)' }}>{st.name}</span>
                <Badge variant={st.type === 'mandatory' ? 'compliance-pass' : 'status-queued'} label={st.type === 'mandatory' ? 'Required' : 'Optional'} />
                {weighted && <span className={s.scoreChip}>{st.score}pt</span>}
              </div>
              {st.desc && <div className={s.stepDesc}>{st.desc}</div>}
              {st.condition && (
                <div className={s.stepCondition}>
                  <Icon name="solar:link-linear" size={10} /> {st.condition}
                </div>
              )}
            </div>
            <div className={s.stepControls} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit step"
                onClick={() => setEditingStepIdx(i)} />
              <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
              <ActionButton icon="solar:trash-bin-minimalistic-linear" size="L" tooltip="Delete step"
                onClick={() => removeStep(i)} />
            </div>
          </div>
        )
      ))}

      {/* Add Step Form */}
      {showAddStep && (
        <div style={{ background: 'var(--neutral-50)', border: '0.5px dashed var(--neutral-150)', borderRadius: 8, padding: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 8 }}>New Step</div>
          <div className={s.addStepRow}>
            <Input type="text" placeholder="Step name" style={{ flex: 2 }} value={newStep.name}
              onChange={e => setNewStep({ ...newStep, name: e.target.value })} />
            <select className={s.formSelect} style={{ flex: 1 }} value={newStep.type}
              onChange={e => setNewStep({ ...newStep, type: e.target.value })}>
              <option value="mandatory">Required</option>
              <option value="conditional">Optional</option>
            </select>
            {weighted && (
              <input className={s.thresholdInput} type="number" min={1} max={999} value={newStep.score} style={{ width: 50 }}
                onChange={e => setNewStep({ ...newStep, score: parseInt(e.target.value) || 0 })} />
            )}
          </div>
          <textarea className={s.formTextarea} style={{ minHeight: 52, marginBottom: 8 }} placeholder="What does this step require?"
            value={newStep.desc} onChange={e => setNewStep({ ...newStep, desc: e.target.value })} />
          <Input type="text" style={{ marginBottom: 8 }} placeholder="Dependency condition (optional)"
            value={newStep.condition} onChange={e => setNewStep({ ...newStep, condition: e.target.value })} />
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="primary" size="S" onClick={addStepItem}>Add Step</Button>
            <Button variant="ghost" size="S" onClick={() => setShowAddStep(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {stepsError && <div className={`${s.formError} ${s.formErrorVisible}`}>At least one step is required</div>}
    </div>
  );

  // ── Page 3: Review ──
  const renderReview = () => (
    <div className={step === 3 ? s.wizPageActive : s.wizPage}>
      <div className={s.sectionTitle}>
        <CheckIcon size={14} color="#009B53" />
        Success Criteria
      </div>
      <p className={s.detailDescription}>
        Define what constitutes a successful goal completion beyond just step completion.
      </p>
      {metrics.length > 0 && (
        <div className={s.successContainer}>
          {metrics.map((m, i) => (
            <div key={i} className={s.successItem} style={{ fontSize: 14 }}>
              <CheckIcon size={14} color="#009B53" />
              <span style={{ flex: 1 }}>{m}</span>
              <CloseButton size={14} onClick={() => removeMetric(i)} className={s.metricRemove} label="Remove metric" />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Input type="text" placeholder="e.g. No escalated safety events" value={newMetric}
            onChange={e => setNewMetric(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMetricItem()} />
        </div>
        <Button variant="secondary" size="L" style={{ flexShrink: 0 }}
          onClick={addMetricItem}>+ Add</Button>
      </div>

      <hr className={s.divider} />
      <div className={s.sectionTitle}>
        <Icon name="solar:clipboard-list-linear" size={14} color="var(--neutral-300)" />
        Review Summary
      </div>
      <div className={s.successContainer}>
        <div className={s.reviewRow}>
          <div className={s.reviewLabel}>Goal Name</div>
          <div className={s.reviewValue}>{name || '—'}</div>
        </div>
        <div className={s.reviewRow} style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div className={s.reviewLabel}>Program</div>
            <div className={s.reviewValue}>{program}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className={s.reviewLabel}>Mode</div>
            <div className={s.reviewValue}>{MODES.find(m => m.value === mode)?.label || mode}</div>
          </div>
        </div>
        <div className={s.reviewRow}>
          <div className={s.reviewLabel}>Steps</div>
          <div className={s.reviewValue}>
            {steps.filter(st => st.type === 'mandatory').length} required, {steps.filter(st => st.type === 'conditional').length} optional
            {weighted && <span style={{ color: 'var(--neutral-300)', fontWeight: 400 }}> · Threshold: {passingScore}/{totalScore}pt</span>}
          </div>
        </div>
        {desc && (
          <div className={s.reviewRow}>
            <div className={s.reviewLabel}>Description</div>
            <div style={{ fontSize: 12, color: 'var(--neutral-400)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        )}
      </div>
    </div>
  );

  const headerRight = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {step >= 2 && !isEdit && (
        <Button variant="ghost" size="L" onClick={() => saveGoal('draft')}>Save Draft</Button>
      )}
      <Button variant="primary" size="L" onClick={goNext}>
        {step === 3 ? 'Publish Goal' : 'Next'}
      </Button>
    </div>
  );

  const discardDialog = showDiscardConfirm ? (
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
  ) : null;

  return (
    <Drawer
      title={isEdit ? 'Edit Goal' : 'Create New Goal'}
      onClose={handleClose}
      headerRight={headerRight}
    >
      {renderStepper()}
      {renderDescribe()}
      {renderConfigure()}
      {renderSteps()}
      {renderReview()}
      {discardDialog}
    </Drawer>
  );
}
