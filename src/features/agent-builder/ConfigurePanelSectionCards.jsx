import { useId } from 'react';
import { Icon } from '../../components/Icon/Icon';
import {
  SectionCard,
  CustomSelect,
  ConfigureSlider,
  ConfigureCheckbox,
  RadioCard,
  GoalSelector,
} from './ConfigurePanelParts';
import {
  TONE_OPTIONS,
  VOICE_OPTIONS,
  ROLE_OPTIONS,
  LANGUAGE_OPTIONS,
  ADAPTATION_OPTIONS,
  POLICY_TEMPLATES,
  POPULATION_OPTIONS,
  MODALITY_OPTIONS,
} from './ConfigurePanelParts.constants';
import { getBadgeText } from './ConfigurePanelParts.utils';
import styles from './ConfigurePanel.module.css';

export function ConfigureAgentUseCaseSection({ form, expanded, toggleExpanded, updateField, toggleGoal, setGoalDetailId }) {
  const uid = useId();
  return (
    <SectionCard
      id="agent-use-case"
      icon="solar:user-rounded-linear"
      title="Agent Use Case"
      isComplete={true}
      expanded={expanded['agent-use-case']}
      onToggle={() => toggleExpanded('agent-use-case')}
    >
      <div className={styles.subsection}>
        <div className={styles.subsectionTitle}>Basic Information</div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${uid}-agent-name`}>Agent Name <span className={styles.fieldRequired} /></label>
            <input
              id={`${uid}-agent-name`}
              className={styles.fieldInput}
              value={form.agentName}
              onChange={e => updateField('agentName', e.target.value)}
              placeholder="Enter agent name"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${uid}-agent-role`}>Agent Role <span className={styles.fieldRequired} /></label>
            <CustomSelect
              id={`${uid}-agent-role`}
              value={form.agentRole}
              options={ROLE_OPTIONS}
              onChange={v => updateField('agentRole', v)}
              placeholder="Select role"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${uid}-use-case-name`}>Use Case Name <span className={styles.fieldRequired} /></label>
          <div className={styles.fieldInputWrap}>
            <input
              id={`${uid}-use-case-name`}
              className={styles.fieldInput}
              value={form.useCaseName}
              onChange={e => updateField('useCaseName', e.target.value.slice(0, 100))}
              maxLength={100}
              style={{ paddingRight: 48 }}
              placeholder="e.g. Post-Discharge Follow-Up Calls"
            />
            <span className={styles.charCounter}>{form.useCaseName.length}/100</span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${uid}-description`}>Description</label>
          <textarea
            id={`${uid}-description`}
            className={styles.textarea}
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
            rows={3}
            placeholder="Describe the agent's purpose and expected behavior…"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${uid}-agent-goals`}>Agent Goals <span className={styles.fieldRequired} /></label>
          <GoalSelector
            id={`${uid}-agent-goals`}
            selectedIds={form.goalIds}
            onToggle={toggleGoal}
            onPreview={(id) => setGoalDetailId(id)}
          />
        </div>
      </div>

      <div className={styles.subsection}>
        <div className={styles.subsectionHeader}>
          <span className={styles.subsectionTitle}>Instruction for the Agent</span>
          <button className={styles.expandBtn} type="button" title="Expand">
            <Icon name="solar:maximize-linear" size={16} color="#6F7A90" />
          </button>
        </div>
        <textarea aria-label="System prompt"
          className={`${styles.textarea} ${styles.textareaLarge}`}
          value={form.systemPrompt}
          onChange={e => updateField('systemPrompt', e.target.value)}
          placeholder="Enter detailed instructions for how the agent should behave, what it can and cannot do, and its communication style…"
        />
      </div>
    </SectionCard>
  );
}

export function ConfigurePersonalizationSection({ form, expanded, toggleExpanded, updateField, toggleArrayItem }) {
  const uid = useId();
  return (
    <SectionCard
      id="personalization"
      icon="solar:magic-stick-3-linear"
      title="Personalization"
      isComplete={true}
      expanded={expanded['personalization']}
      onToggle={() => toggleExpanded('personalization')}
    >
      <div className={styles.subsection}>
        <div className={styles.subsectionTitle}>Tone of Voice</div>
        <div className={styles.radioCardGrid}>
          {TONE_OPTIONS.map(t => (
            <RadioCard
              key={t.id}
              selected={form.toneOfVoice === t.id}
              onClick={() => updateField('toneOfVoice', t.id)}
              title={t.title}
              desc={t.desc}
            />
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.subsectionTitle} htmlFor={`${uid}-voice`}>Voice</label>
        <CustomSelect
          id={`${uid}-voice`}
          value={form.voice}
          options={VOICE_OPTIONS}
          onChange={v => updateField('voice', v)}
          placeholder="Select voice"
        />
      </div>

      <ConfigureSlider
        value={form.empathyLevel}
        onChange={v => updateField('empathyLevel', v)}
        label="Empathy Level"
        badgeText={getBadgeText(form.empathyLevel)}
      />

      <ConfigureSlider
        value={form.speakingPace}
        onChange={v => updateField('speakingPace', v)}
        label="Speaking Pace"
        badgeText={getBadgeText(form.speakingPace)}
      />

      <div className={styles.subsection}>
        <div className={styles.subsectionTitle}>Language Support</div>
        <div className={styles.checkboxGrid}>
          {LANGUAGE_OPTIONS.map(l => (
            <ConfigureCheckbox
              key={l.id}
              checked={form.languages.includes(l.id)}
              onChange={() => toggleArrayItem('languages', l.id)}
              label={l.label}
            />
          ))}
        </div>
      </div>

      <div className={styles.subsection}>
        <div className={styles.subsectionTitle}>Special Adaptations</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ADAPTATION_OPTIONS.map(a => (
            <ConfigureCheckbox
              key={a.id}
              checked={form.adaptations.includes(a.id)}
              onChange={() => toggleArrayItem('adaptations', a.id)}
              label={a.label}
            />
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

export function ConfigurePoliciesSection({ form, expanded, toggleExpanded, toggleArrayItem }) {
  return (
    <SectionCard
      id="policies"
      icon="solar:shield-check-linear"
      title="Policies"
      isComplete={true}
      expanded={expanded['policies']}
      onToggle={() => toggleExpanded('policies')}
    >
      <div className={styles.subsection}>
        <div className={styles.linkRow}>
          <span className={styles.linkRowText}>Required Compliance Policies</span>
          <Icon name="solar:alt-arrow-right-linear" size={16} color="#16181D" />
        </div>
      </div>

      <div className={styles.subsection}>
        <div>
          <div className={styles.subsectionTitle}>Optional Policy Templates</div>
          <div className={styles.subsectionDesc}>Apply additional policies to enhance agent behavior</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {POLICY_TEMPLATES.map(p => (
            <div key={p.id} className={styles.policyCard} onClick={() => toggleArrayItem('selectedPolicies', p.id)}>
              <span className={`${styles.checkboxBox} ${form.selectedPolicies.includes(p.id) ? styles.checkboxBoxChecked : ''}`}>
                {form.selectedPolicies.includes(p.id) && <Icon name="solar:check-read-linear" size={12} color="#fff" />}
              </span>
              <div className={styles.policyContent}>
                <span className={styles.policyName}>{p.name}</span>
                <span className={styles.policyDesc}>{p.desc}</span>
              </div>
              <button className={styles.expandBtn} type="button" onClick={e => e.stopPropagation()} aria-label="Edit">
                <Icon name="solar:pen-new-square-linear" size={16} color="#6F7A90" />
              </button>
              {p.recommended && <span className={styles.recommendedBadge}>Recommended</span>}
            </div>
          ))}
        </div>

        <div className={styles.policyActions}>
          <button className={styles.linkBtn} type="button">
            <Icon name="solar:add-circle-linear" size={14} color="#8C5AE2" />
            Create Custom Policy
          </button>
          <button className={styles.linkBtn} type="button">
            <Icon name="solar:import-linear" size={14} color="#8C5AE2" />
            Import Policy from Document
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

export function ConfigureTargetPopulationSection({ form, expanded, toggleExpanded, updateField }) {
  return (
    <SectionCard
      id="target-population"
      icon="solar:users-group-rounded-linear"
      title="Target Population"
      isComplete={true}
      expanded={expanded['target-population']}
      onToggle={() => toggleExpanded('target-population')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className={styles.subsectionTitle}>Target Population</span>
        <span className={styles.subsectionDesc}>Define the audience group for which the agent will be directed</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {POPULATION_OPTIONS.map(p => (
          <RadioCard
            key={p.id}
            selected={form.populationType === p.id}
            onClick={() => updateField('populationType', p.id)}
            title={p.title}
            desc={p.desc}
            className={styles.radioCardFlex}
          />
        ))}
      </div>

      {form.populationType === 'worklist' && (
        <CustomSelect
          value={form.selectedWorklist}
          options={[
            { id: 'toc', label: 'TOC Post-Discharge' },
            { id: 'awv', label: 'Annual Wellness Visit' },
            { id: 'chronic', label: 'Chronic Care Management' },
          ]}
          onChange={v => updateField('selectedWorklist', v)}
          placeholder="Select Worklist"
        />
      )}
    </SectionCard>
  );
}

export function ConfigureKnowledgeBaseSection({ expanded, toggleExpanded }) {
  return (
    <SectionCard
      id="knowledge-base"
      icon="solar:book-2-linear"
      title="Knowledge Base"
      isComplete={false}
      expanded={expanded['knowledge-base']}
      onToggle={() => toggleExpanded('knowledge-base')}
    >
      <div className={styles.subsection}>
        <div className={styles.subsectionDesc}>
          Upload documents, FAQs, and reference materials for the agent to use during conversations.
        </div>
        <button className={styles.linkBtn} type="button">
          <Icon name="solar:add-circle-linear" size={14} color="#8C5AE2" />
          Add Knowledge Source
        </button>
      </div>
    </SectionCard>
  );
}

export function ConfigureCommunicationSection({ form, expanded, toggleExpanded, updateField }) {
  const uid = useId();
  return (
    <SectionCard
      id="communication"
      icon="solar:phone-calling-rounded-linear"
      title="Communication Preferences"
      isComplete={true}
      expanded={expanded['communication']}
      onToggle={() => toggleExpanded('communication')}
    >
      <div className={styles.subsection}>
        <div className={styles.subsectionTitle}>Modality</div>
        <div className={styles.radioCardGrid}>
          {MODALITY_OPTIONS.map(m => (
            <RadioCard
              key={m.id}
              selected={form.modality === m.id}
              onClick={() => updateField('modality', m.id)}
              title={m.title}
              className={styles.radioCardFlex}
            />
          ))}
        </div>
      </div>

      <div className={styles.subsection}>
        <div className={styles.subsectionTitle}>Communication Details</div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${uid}-phone`}>Phone Number</label>
          <input
            id={`${uid}-phone`}
            className={styles.fieldInput}
            value={form.phone}
            onChange={e => updateField('phone', e.target.value)}
            placeholder="(555) 123-4567"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${uid}-email`}>Email ID</label>
          <input
            id={`${uid}-email`}
            className={styles.fieldInput}
            value={form.email}
            onChange={e => updateField('email', e.target.value)}
            placeholder="agent@fold.health"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${uid}-office-hours`}>Office Hours</label>
          <input
            id={`${uid}-office-hours`}
            className={styles.fieldInput}
            value={form.officeHours}
            onChange={e => updateField('officeHours', e.target.value)}
            placeholder="Monday-Friday, 8 AM - 5 PM"
          />
        </div>
      </div>
    </SectionCard>
  );
}
