import { useMemo, useState } from 'react';
import { Input } from '../../../../../components/Input/Input';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../components/Button/Button';
import { RadioButton } from '../../../../../components/RadioButton/RadioButton';
import { CloseButton } from '../../../../../components/CloseButton/CloseButton';
import { RingEmptyState } from '../../../../../components/RingEmptyState/RingEmptyState';
import { AIIcon } from '../../../../../components/Icon/AIIcon';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import { AddGoalsDrawer } from '../../goals/AddGoalsDrawer/AddGoalsDrawer';
import { CarePlanSections, ChronicConditionSelect } from '../../shared';
import { CARE_PLAN_NAME_MAX } from '../../lib/carePlanLimits';
import { goalPayloadFromTemplateEntry } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanTemplateApply';
import styles from './CarePlanCreateView.module.css';


const TEMPLATE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'chronic', label: 'For Chronic Conditions' },
];

/**
 * New Care Plan — full-pane template creation (Figma Care-Plan-Creation
 * 14108:294857). Left column holds the plan's identity (name, description,
 * template type); the right column is where goals accrue, empty until the
 * first one is added.
 */
export function CarePlanCreateView({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState('general');
  const [conditions, setConditions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [addGoalsOpen, setAddGoalsOpen] = useState(false);

  const goalRows = useMemo(() => goals.map(g => ({
    ...goalPayloadFromTemplateEntry({ id: g.id }, goals),
    id: g.id,
    title: g.title,
    subtitle: g.description || g.detail || '',
    priority: g.priority || 'medium',
    icon: 'solar:flag-linear',
    status: 'Not Started',
    currentValue: 'No Data',
    trend: '—',
    progress: '0%',
  })), [goals]);

  // A goal's links carry both kinds; the tables want them apart.
  const linked = useMemo(() => {
    const seen = new Set();
    const interventions = [];
    const barriers = [];
    for (const g of goals) {
      for (const link of g.interventions || []) {
        if (seen.has(link.id)) continue;
        seen.add(link.id);
        if (link.kind === 'barrier') {
          barriers.push({ id: link.id, title: link.title, status: 'Not Started' });
        } else {
          interventions.push({
            id: link.id,
            kind: link.kind,
            title: link.title,
            icon: 'solar:clipboard-list-linear',
            priority: 'medium',
            status: 'Not Started',
            assignee: { name: 'Unassigned', initials: '' },
          });
        }
      }
    }
    return { interventions, barriers };
  }, [goals]);

  // Picked goals merge in by id, so re-opening the picker can't duplicate rows.
  const addGoals = (picked) => {
    setGoals(prev => {
      const seen = new Set(prev.map(g => g.id));
      return [...prev, ...picked.filter(g => !seen.has(g.id))];
    });
    setAddGoalsOpen(false);
  };

  const canSave = name.trim().length > 0;

  return (
    <div className={styles.view}>
      <div className={styles.formPane}>
        <div className={styles.formHeader}>
          <span className={styles.formTitle}>New Care Plan</span>
        </div>

        <div className={styles.formBody}>
          <div className={styles.field}>
            <div className={styles.fieldLabelRow}>
              <span className={styles.fieldLabel}>
                Care Plan Name <span className={styles.mandatoryDot} aria-hidden="true" />
              </span>
              <button type="button" className={styles.aiLink}>
                <AIIcon size={14} />
                <span className={styles.aiLinkText}>Write with AI</span>
              </button>
            </div>
            <Input
              value={name}
              onChange={e => setName(e.target.value.slice(0, CARE_PLAN_NAME_MAX))}
              placeholder="Enter Care Plan Name"
              characterLimit={CARE_PLAN_NAME_MAX}
              aria-label="Care Plan Name"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Description</span>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Briefly describe the Plan objective"
              rows={3}
              aria-label="Description"
            />
          </div>

          <span className={styles.sectionTitle}>Template Type</span>
          <div className={styles.radioGroup} role="radiogroup" aria-label="Template Type">
            {TEMPLATE_TYPES.map(t => (
              <RadioButton
                key={t.value}
                name="templateType"
                value={t.value}
                label={t.label}
                checked={templateType === t.value}
                onChange={() => setTemplateType(t.value)}
              />
            ))}
          </div>

          {/* A chronic-conditions template needs to say which conditions —
              same picker the goal drawer and the template editor use. */}
          {templateType === 'chronic' && (
            <ChronicConditionSelect value={conditions} onChange={setConditions} />
          )}
        </div>
      </div>

      <div className={styles.goalsPane}>
        <div className={styles.toolbar}>
          <Button variant="tertiary" size="L">Save as Draft</Button>
          <Button
            variant="secondary"
            size="L"
            disabled={!canSave}
            onClick={() => onSave?.({ name: name.trim(), description: description.trim(), templateType, goals })}
          >
            Save as Template
          </Button>
          <span className={styles.toolbarDivider} />
          <CloseButton onClick={onClose} />
        </div>

        <div className={styles.goalsBody}>
          {goals.length === 0 ? (
            <div className={styles.goalsEmpty}>
              <RingEmptyState icon="solar:heart-pulse-linear" label="No Goals Added" iconSize={31} />
              <div className={styles.goalsEmptyActions}>
                <Button
                  variant="tertiary"
                  size="L"
                  leadingIconElement={<AddIconMinimalist size={16} />}
                  onClick={() => setAddGoalsOpen(true)}
                >
                  Add New
                </Button>
                <Button variant="secondary" size="L">Use Template</Button>
              </div>
            </div>
          ) : (
            <CarePlanSections
              goalRows={goalRows}
              interventionRows={linked.interventions}
              barrierRows={linked.barriers}
              footer={(
                <div className={styles.goalListActions}>
                  <Button
                    variant="tertiary"
                    size="L"
                    leadingIconElement={<AddIconMinimalist size={16} />}
                    onClick={() => setAddGoalsOpen(true)}
                  >
                    Add New
                  </Button>
                </div>
              )}
            />
          )}
        </div>
      </div>

      {addGoalsOpen && (
        <AddGoalsDrawer onClose={() => setAddGoalsOpen(false)} onAdd={addGoals} />
      )}
    </div>
  );
}
