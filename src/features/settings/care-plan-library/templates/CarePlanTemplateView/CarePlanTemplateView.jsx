import { useMemo, useState } from 'react';
import { Input } from '../../../../../components/Input/Input';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { RadioButton } from '../../../../../components/RadioButton/RadioButton';
import { Button } from '../../../../../components/Button/Button';
import { CloseButton } from '../../../../../components/CloseButton/CloseButton';
import { CarePlanSections, ChronicConditionSelect } from '../../shared';
import { CARE_PLAN_NAME_MAX } from '../../lib/carePlanLimits';
import { CreateGoalDrawer } from '../../goals/CreateGoalDrawer/CreateGoalDrawer';
import { INTERVENTION_EDITORS } from '../../interventions';
import {
  goalPayloadFromTemplateEntry,
  interventionPayloadFromTemplateEntry,
} from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanTemplateApply';
import { CARE_PLAN_INTERVENTION_ICONS } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanInterventionMenu';
import { useAppStore } from '../../../../../store/useAppStore';
import styles from './CarePlanTemplateView.module.css';


const TEMPLATE_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'chronic', label: 'For Chronic Conditions' },
];

// A goal's row icon follows its measure category, the way an intervention's
// follows its kind — the flag is the fallback for an uncategorised goal.
const GOAL_CATEGORY_ICONS = {
  Vital: 'solar:heart-pulse-linear',
  Activity: 'solar:dumbbell-small-linear',
  'Lab result': 'solar:test-tube-linear',
  Assessment: 'solar:clipboard-check-linear',
};

/**
 * A Care Plan Library template, full-pane like New Care Plan: identity on the
 * left, the plan itself on the right rendered with the same GBI tables the
 * patient care plan uses — a template is the plan a patient will get, so it
 * should read identically before it is applied.
 *
 */
export function CarePlanTemplateView({ template, onClose, onSave }) {
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const saveCarePlanGoal = useAppStore(s => s.saveCarePlanGoal);
  const interventionLibrary = useAppStore(s => s.carePlanInterventionTemplates);
  // Clicking a goal row edits the library goal the template entry points at.
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingIntervention, setEditingIntervention] = useState(null);

  const [name, setName] = useState(template.name || '');
  const [description, setDescription] = useState(template.description || '');
  const [conditions, setConditions] = useState(template.conditions || []);
  // A template with conditions on it was authored as a chronic-conditions one.
  const [templateType, setTemplateType] = useState(
    (template.conditions || []).length ? 'chronic' : 'general',
  );

  const goalRows = useMemo(() => (template.goals || []).map((entry, i) => {
    const payload = goalPayloadFromTemplateEntry(entry, libraryGoals);
    return {
      ...payload,
      id: entry.id || `goal-${i}`,
      icon: GOAL_CATEGORY_ICONS[payload.category] || payload.icon,
      currentValue: 'No Data',
      trend: '—',
      progress: '0%',
    };
  }), [template.goals, libraryGoals]);

  const interventionRows = useMemo(() => (template.interventions || []).map((entry, i) => ({
    ...interventionPayloadFromTemplateEntry(entry),
    id: entry.id || `intv-${i}`,
    // Same per-kind icon the patient plan uses, instead of one clipboard for all.
    icon: CARE_PLAN_INTERVENTION_ICONS[entry.kind] || 'solar:clipboard-list-linear',
  })), [template.interventions]);

  const barrierRows = useMemo(() => (template.barriers || []).map((entry, i) => ({
    id: entry.id || `barrier-${i}`,
    title: entry.title,
    subtitle: entry.description || '',
    status: 'Not Started',
  })), [template.barriers]);

  // Reverse of a goal's links: which goals point at a given intervention or
  // barrier. Mirrors CarePlanView's linkedForChild, which shows owning goals.
  const goalsByLinkId = useMemo(() => {
    const map = new Map();
    for (const entry of template.goals || []) {
      const goal = libraryGoals.find(g => g.id === entry.id);
      for (const link of goal?.interventions || []) {
        const list = map.get(link.id) || [];
        const owner = {
          id: entry.id,
          title: entry.title || goal?.title || '',
          icon: GOAL_CATEGORY_ICONS[goal?.category] || 'solar:flag-linear',
        };
        map.set(link.id, list);
        list.push(owner);
        // Also key by title: a template saved before barriers were sourced
        // from the goals' links carries barrier ids from the barrier library,
        // which never match a link id.
        const titleKey = (link.title || '').trim().toLowerCase();
        if (titleKey) {
          const byTitle = map.get(titleKey) || [];
          if (!byTitle.some(o => o.id === owner.id)) byTitle.push(owner);
          map.set(titleKey, byTitle);
        }
      }
    }
    return map;
  }, [template.goals, libraryGoals]);

  return (
    <div className={styles.view}>
      <div className={styles.formPane}>
        <div className={styles.formHeader}>
          <span className={styles.formTitle}>Edit Care Plan</span>
        </div>
        <div className={styles.formBody}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Care Plan Name</span>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter Care Plan Name"
              maxLength={CARE_PLAN_NAME_MAX}
              characterLimit={CARE_PLAN_NAME_MAX}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Description</span>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Briefly describe the Plan objective"
              rows={4}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Template Type</span>
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
          </div>

          {templateType === 'chronic' && (
            <div className={styles.field}>
              <ChronicConditionSelect
                label="Chronic condition"
                value={conditions}
                onChange={setConditions}
              />
            </div>
          )}
        </div>
      </div>

      <div className={styles.planPane}>
        <div className={styles.toolbar}>
          <Button
            variant="primary"
            size="L"
            disabled={!name.trim()}
            onClick={() => onSave?.({
              name: name.trim(),
              description,
              conditions,
              goals: template.goals || [],
              interventions: template.interventions || [],
              barriers: template.barriers || [],
            })}
          >
            Save
          </Button>
          <span className={styles.toolbarDivider} />
          <CloseButton onClick={onClose} label="Close care plan template" />
        </div>

        <div className={styles.planBody}>
          <CarePlanSections
            goalRows={goalRows}
            interventionRows={interventionRows}
            barrierRows={barrierRows}
            linkedForChild={(row) => {
              const goals = goalsByLinkId.get(row.id)
                || goalsByLinkId.get((row.title || '').trim().toLowerCase());
              return goals?.length ? { goals } : null;
            }}
            linkedForGoal={(row) => {
              const goal = libraryGoals.find(g => g.id === row.id);
              const links = goal?.interventions || [];
              if (!links.length) return null;
              return {
                interventions: links
                  .filter(l => l.kind !== 'barrier')
                  .map(l => ({
                    id: l.id,
                    title: l.title,
                    icon: CARE_PLAN_INTERVENTION_ICONS[l.kind] || 'solar:clipboard-list-linear',
                  })),
                barriers: links
                  .filter(l => l.kind === 'barrier')
                  .map(l => ({ id: l.id, title: l.title })),
              };
            }}
            onOpenIntervention={(row) => {
              const entry = (template.interventions || []).find(i => i.id === row.id);
              if (entry && INTERVENTION_EDITORS[entry.kind]) setEditingIntervention(entry);
            }}
            onOpenGoal={(row) => {
              const goal = libraryGoals.find(g => g.id === row.id);
              if (goal) setEditingGoal(goal);
            }}
          />
        </div>
      </div>

      {editingIntervention && (() => {
        const Editor = INTERVENTION_EDITORS[editingIntervention.kind];
        // A template entry is a reference — { id, kind, title } — so the
        // prefill is its title plus whatever the library row carries. Only a
        // config saved from this drawer has the scheduling fields.
        const libRow = (interventionLibrary || []).find(i => i.id === editingIntervention.id);
        return (
          <Editor
            kind={editingIntervention.kind}
            intervention={{
              title: editingIntervention.title || libRow?.title || '',
              note: libRow?.description || '',
              ...(editingIntervention.config || {}),
            }}
            onClose={() => setEditingIntervention(null)}
            onSave={() => setEditingIntervention(null)}
          />
        );
      })()}

      {editingGoal && (
        <CreateGoalDrawer
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSave={async (values) => {
            await saveCarePlanGoal(values, editingGoal.id);
            setEditingGoal(null);
          }}
        />
      )}
    </div>
  );
}
