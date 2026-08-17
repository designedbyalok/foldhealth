import { Icon } from '../../../components/Icon/Icon';
import { CheckIcon } from '../../../components/Icon/CheckIcon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Switch } from '../../../components/Switch/Switch';
import s from './GoalsPanel.module.css';
import { WIZARD_LABELS, PROGRAMS, MODES } from './GoalWizardStepPages.constants';

export function GoalWizardStepper({ step, setStep }) {
  return (
    <div className={s.stepper}>
      {WIZARD_LABELS.map((label, i) => (
        <div key={label} style={{ display: 'contents' }}>
          <button
            type="button"
            aria-current={i === step ? 'step' : undefined}
            className={`${s.wizStep} ${i === step ? s.wizStepActive : i < step ? s.wizStepDone : ''}`}
            onClick={() => setStep(i)}
            style={{ cursor: 'pointer', background: 'none', border: 'none', font: 'inherit', color: 'inherit' }}
          >
            <div className={s.wizStepNum}>{i < step ? <CheckIcon size={12} color="var(--primary-300)" /> : i + 1}</div>
            <span className={s.wizStepLabel}>{label}</span>
          </button>
          {i < WIZARD_LABELS.length - 1 && (
            <div className={`${s.wizConnector} ${i < step ? s.wizConnectorDone : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function GoalWizardDescribeStep({ active, isEdit, nlInput, setNlInput, aiGenerating, generateFromNL, useTemplate }) {
  return (
    <div className={active ? s.wizPageActive : s.wizPage}>
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
        <textarea aria-label="Goal instructions"
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
              <button key={t.key} type="button" className={s.templateCard} onClick={() => useTemplate(t.key)}>
                <div className={s.templateCardTitle}><Icon name={t.icon} size={14} /> {t.title}</div>
                <div className={s.templateCardDesc}>{t.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function GoalWizardConfigureStep({ active, isEdit, name, setName, nameError, setNameError, program, setProgram, mode, setMode, desc, setDesc }) {
  return (
    <div className={active ? s.wizPageActive : s.wizPage}>
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
          <Select
            options={PROGRAMS.map(p => ({ value: p, label: p }))}
            value={program}
            onChange={setProgram}
          />
        </div>
        <div className={s.formGroup} style={{ flex: 1 }}>
          <div className={s.formLabel}>Completion Mode</div>
          <Select options={MODES} value={mode} onChange={setMode} />
        </div>
      </div>
      <div className={s.formGroup}>
        <div className={s.formLabel}>Description</div>
        <textarea aria-label="Description" className={s.formTextarea} value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="What is this goal about?" />
      </div>
    </div>
  );
}

export function GoalWizardStepsStep({
  active,
  weighted,
  setWeighted,
  passingScore,
  setPassingScore,
  totalScore,
  steps,
  editingStepIdx,
  setEditingStepIdx,
  updateStep,
  removeStep,
  showAddStep,
  setShowAddStep,
  newStep,
  setNewStep,
  addStepItem,
  stepsError,
}) {
  return (
    <div className={active ? s.wizPageActive : s.wizPage}>
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
            <input aria-label="Pass threshold" className={s.thresholdInput} type="number" min={1} max={1000} value={passingScore}
              onChange={e => { e.stopPropagation(); setPassingScore(parseInt(e.target.value) || 0); }} />
            <span className={s.thresholdUnit}>pts</span>
            <span className={s.thresholdTotal}>Total: {totalScore}pt</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 16 }}>
        <div className={s.sectionTitle} style={{ marginBottom: 0 }}>
          <Icon name="solar:clipboard-list-linear" size={14} color="var(--neutral-300)" />
          Goal Steps
          <span style={{ fontSize: 12, color: 'var(--neutral-200)', fontWeight: 400, marginLeft: 8 }}>
            <span style={{ color: 'var(--status-success)' }}>●</span> Required <span style={{ color: 'var(--status-warning)' }}>●</span> Optional
          </span>
        </div>
        <Button variant="secondary" size="S" onClick={() => setShowAddStep(true)}>+ Add Step</Button>
      </div>

      {steps.map((st, i) => (
        editingStepIdx === i ? (
          <div key={st.id || i} style={{ background: 'var(--neutral-50)', border: '0.5px solid var(--neutral-150)', borderRadius: 8, padding: 12, marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--primary-300)', marginBottom: 8 }}>Edit Step {i + 1}</div>
            <div className={s.addStepRow}>
              <Input type="text" value={st.name} style={{ flex: 2 }}
                onChange={e => updateStep(i, { name: e.target.value })} placeholder="Step name" />
              <select aria-label="Step type" className={s.formSelect} value={st.type} style={{ flex: 1 }}
                onChange={e => updateStep(i, { type: e.target.value })}>
                <option value="mandatory">Required</option>
                <option value="conditional">Optional</option>
              </select>
              {weighted && (
                <input aria-label="Step score" className={s.thresholdInput} type="number" min={1} max={999} value={st.score} style={{ width: 50 }}
                  onChange={e => updateStep(i, { score: parseInt(e.target.value) || 0 })} />
              )}
            </div>
            <textarea aria-label="Step description" className={s.formTextarea} style={{ minHeight: 52, marginBottom: 8 }} value={st.desc || ''}
              onChange={e => updateStep(i, { desc: e.target.value })} placeholder="Step description" />
            <Input type="text" style={{ marginBottom: 8 }} value={st.condition || ''}
              onChange={e => updateStep(i, { condition: e.target.value })} placeholder="Dependency condition (optional)" />
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="primary" size="S" onClick={() => setEditingStepIdx(null)}>Save</Button>
              <Button variant="ghost" size="S" onClick={() => setEditingStepIdx(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
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
              <ActionButton icon="solar:pen-linear" size="L" tooltip="Edit step" onClick={() => setEditingStepIdx(i)} />
              <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
              <ActionButton icon="solar:trash-bin-minimalistic-linear" size="L" tooltip="Delete step" onClick={() => removeStep(i)} />
            </div>
          </div>
        )
      ))}

      {showAddStep && (
        <div style={{ background: 'var(--neutral-50)', border: '0.5px dashed var(--neutral-150)', borderRadius: 8, padding: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 8 }}>New Step</div>
          <div className={s.addStepRow}>
            <Input type="text" placeholder="Step name" style={{ flex: 2 }} value={newStep.name}
              onChange={e => setNewStep({ ...newStep, name: e.target.value })} />
            <select aria-label="New step type" className={s.formSelect} style={{ flex: 1 }} value={newStep.type}
              onChange={e => setNewStep({ ...newStep, type: e.target.value })}>
              <option value="mandatory">Required</option>
              <option value="conditional">Optional</option>
            </select>
            {weighted && (
              <input aria-label="New step score" className={s.thresholdInput} type="number" min={1} max={999} value={newStep.score} style={{ width: 50 }}
                onChange={e => setNewStep({ ...newStep, score: parseInt(e.target.value) || 0 })} />
            )}
          </div>
          <textarea aria-label="Step requirements" className={s.formTextarea} style={{ minHeight: 52, marginBottom: 8 }} placeholder="What does this step require?"
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
}

export function GoalWizardReviewStep({
  active,
  metrics,
  removeMetric,
  newMetric,
  setNewMetric,
  addMetricItem,
  name,
  program,
  mode,
  steps,
  weighted,
  passingScore,
  totalScore,
  desc,
}) {
  return (
    <div className={active ? s.wizPageActive : s.wizPage}>
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
        <Button variant="secondary" size="L" style={{ flexShrink: 0 }} onClick={addMetricItem}>+ Add</Button>
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
}
