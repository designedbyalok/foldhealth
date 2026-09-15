import { useMemo, useState } from 'react';
import { Input } from '../../../../../components/Input/Input';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../components/Button/Button';
import { RadioButton } from '../../../../../components/RadioButton/RadioButton';
import { CloseButton } from '../../../../../components/CloseButton/CloseButton';
import { RingEmptyState } from '../../../../../components/RingEmptyState/RingEmptyState';
import { AddIconMinimalist } from '../../../../../components/Icon/AddIconMinimalist';
import { AddGoalsDrawer } from '../../goals/AddGoalsDrawer/AddGoalsDrawer';
import { AddInterventionsDrawer } from '../../interventions/AddInterventionsDrawer';
import { AddBarriersDrawer } from '../../barriers/AddBarriersDrawer/AddBarriersDrawer';
import { CreateGoalDrawer } from '../../goals/CreateGoalDrawer/CreateGoalDrawer';
import { INTERVENTION_EDITORS } from '../../interventions';
import { ApplyTemplatesDrawer } from '../../../../patient/right-panel/tabs/care-programs/care-plan/drawers/ApplyTemplatesDrawer/ApplyTemplatesDrawer';
import { useAppStore } from '../../../../../store/useAppStore';
import { MenuPopover } from '../../../../../components/MenuPopover/MenuPopover';
import { CarePlanSections, ChronicConditionSelect } from '../../shared';
import { CARE_PLAN_NAME_MAX } from '../../lib/carePlanLimits';
import {
  goalPayloadFromTemplateEntry,
  interventionPayloadFromTemplateEntry,
} from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanTemplateApply';
import { CARE_PLAN_INTERVENTION_ICONS } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanInterventionMenu';
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
  // The same three lists the template editor keeps, so New Care Plan and Edit
  // Care Plan behave identically.
  const [goals, setGoals] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [barriers, setBarriers] = useState([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [picker, setPicker] = useState(null); // 'goals' | 'interventions' | 'barriers'
  // { list, item, rect } — which row's menu is open.
  const [rowMenu, setRowMenu] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingIntervention, setEditingIntervention] = useState(null);
  const libraryTemplates = useAppStore(s => s.carePlanTemplates);
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const interventionLibrary = useAppStore(s => s.carePlanInterventionTemplates);
  const saveCarePlanGoal = useAppStore(s => s.saveCarePlanGoal);

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

  const interventionRows = useMemo(() => interventions.map((entry, i) => ({
    ...interventionPayloadFromTemplateEntry(entry),
    id: entry.id || `intv-${i}`,
    icon: CARE_PLAN_INTERVENTION_ICONS[entry.kind] || 'solar:clipboard-list-linear',
  })), [interventions]);

  const barrierRows = useMemo(() => barriers.map((entry, i) => ({
    id: entry.id || `barrier-${i}`,
    title: entry.title,
    status: 'Not Started',
  })), [barriers]);

  const norm = (v) => (v || '').trim().toLowerCase();
  const linksOf = (goal) => goal?.interventions || [];

  const appendByTitle = (list, incoming) => {
    const seen = new Set(list.map(e => norm(e.title)));
    const add = [];
    for (const item of incoming) {
      const key = norm(item.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      add.push({ id: item.id, title: item.title, kind: item.kind });
    }
    return add.length ? [...list, ...add] : list;
  };

  // A goal arrives with what hangs off it, the way it does in the template
  // editor: the library goal's links, split back out by kind.
  const addGoals = (picked) => {
    const seen = new Set(goals.map(g => g.id));
    const fresh = (picked || []).filter(g => !seen.has(g.id));
    setPicker(null);
    if (!fresh.length) return;
    const links = fresh.flatMap(linksOf);
    setGoals(prev => [...prev, ...fresh]);
    setInterventions(prev => appendByTitle(prev, links.filter(l => l.kind !== 'barrier')));
    setBarriers(prev => appendByTitle(prev, links.filter(l => l.kind === 'barrier')));
  };

  // Dropping a goal drops what hung off it, unless another goal still here
  // links the same item.
  const removeGoal = (goalId) => {
    const remaining = goals.filter(g => g.id !== goalId);
    const removedLinks = linksOf(goals.find(g => g.id === goalId));
    setGoals(remaining);
    if (!removedLinks.length) return;
    const stillOwned = new Set(remaining.flatMap(g => linksOf(g)
      .flatMap(l => [String(l.id), norm(l.title)])));
    const drop = (list) => list.filter((item) => {
      const wasLinked = removedLinks.some(l => String(l.id) === String(item.id)
        || norm(l.title) === norm(item.title));
      if (!wasLinked) return true;
      return stillOwned.has(String(item.id)) || stillOwned.has(norm(item.title));
    });
    setInterventions(prev => drop(prev));
    setBarriers(prev => drop(prev));
  };

  const removeFromList = (list, id) => {
    const setters = { interventions: setInterventions, barriers: setBarriers };
    setters[list]?.(prev => prev.filter(e => e.id !== id));
  };

  // A template contributes its goals; each one brings its own links.
  const addFromTemplates = (ids) => {
    const picked = (ids || [])
      .map(id => libraryTemplates.find(t => t.id === id))
      .filter(Boolean)
      .flatMap(t => (t.goals || [])
        .map(entry => libraryGoals.find(g => g.id === entry.id))
        .filter(Boolean));
    addGoals(picked);
    setTemplatesOpen(false);
  };

  const canSave = name.trim().length > 0;

  const payload = () => ({
    name: name.trim(),
    description: description.trim(),
    templateType,
    conditions,
    goals,
    interventions,
    barriers,
  });

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

          {/* Same shape as the Edit Care Plan pane: a labelled field, not a
              section heading. */}
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

          {/* A chronic-conditions template needs to say which conditions —
              same picker the goal drawer and the template editor use. */}
          {templateType === 'chronic' && (
            <div className={styles.field}>
              <ChronicConditionSelect value={conditions} onChange={setConditions} />
            </div>
          )}
        </div>
      </div>

      <div className={styles.goalsPane}>
        <div className={styles.toolbar}>
          <Button
            variant="tertiary"
            size="L"
            disabled={!canSave}
            onClick={() => onSave?.({ ...payload(), status: 'draft' })}
          >
            Save as Draft
          </Button>
          <Button
            variant="secondary"
            size="L"
            disabled={!canSave}
            onClick={() => onSave?.({ ...payload(), status: 'published' })}
          >
            Save as Template
          </Button>
          <span className={styles.toolbarDivider} />
          <CloseButton onClick={onClose} />
        </div>

        <div className={styles.goalsBody}>
          {goals.length === 0 ? (
            <div className={styles.goalsEmpty}>
              <RingEmptyState icon="solar:flag-linear" label="No Goals Added" iconSize={31} />
              <div className={styles.goalsEmptyActions}>
                <Button
                  variant="tertiary"
                  size="L"
                  leadingIconElement={<AddIconMinimalist size={16} />}
                  onClick={() => setPicker('goals')}
                >
                  Add New
                </Button>
                <Button variant="secondary" size="L" onClick={() => setTemplatesOpen(true)}>
                  Use Template
                </Button>
              </div>
            </div>
          ) : (
            <CarePlanSections
              goalRows={goalRows}
              interventionRows={interventionRows}
              barrierRows={barrierRows}
              onOpenGoal={(row) => setEditingGoal(libraryGoals.find(g => g.id === row.id) || row)}
              onOpenIntervention={(row) => setEditingIntervention(
                interventions.find(i => i.id === row.id) || row,
              )}
              onAddGoal={() => setPicker('goals')}
              onAddIntervention={() => setPicker('interventions')}
              onAddBarrier={() => setPicker('barriers')}
              onRowMenuGoal={(m) => setRowMenu({ list: 'goals', item: m.item, rect: m.rect })}
              onRowMenuIntervention={(m) => setRowMenu({ list: 'interventions', item: m.item, rect: m.rect })}
              onRowMenuBarrier={(m) => setRowMenu({ list: 'barriers', item: m.item, rect: m.rect })}
            />
          )}
        </div>
      </div>

      {rowMenu && (
        <MenuPopover
          anchorRect={rowMenu.rect}
          ariaLabel="Row actions"
          width={160}
          items={[
            { key: 'edit', icon: 'solar:pen-linear', label: 'Edit' },
            { key: 'remove', icon: 'solar:trash-bin-trash-linear', label: 'Remove', danger: true },
          ]}
          onClose={() => setRowMenu(null)}
          onSelect={(key) => {
            const { list, item } = rowMenu;
            setRowMenu(null);
            if (key === 'remove') {
              if (list === 'goals') removeGoal(item.id);
              else removeFromList(list, item.id);
              return;
            }
            // Edit opens the same editor a row click does; barriers have none.
            if (list === 'goals') setEditingGoal(libraryGoals.find(g => g.id === item.id) || item);
            else if (list === 'interventions') {
              setEditingIntervention(interventions.find(i => i.id === item.id) || item);
            }
          }}
        />
      )}

      {picker === 'goals' && (
        <AddGoalsDrawer
          primaryLabel="Add to Care Plan"
          onClose={() => setPicker(null)}
          onAdd={addGoals}
        />
      )}

      {picker === 'interventions' && (
        <AddInterventionsDrawer
          primaryLabel="Add to Care Plan"
          onClose={() => setPicker(null)}
          onAdd={(picked) => { setInterventions(prev => appendByTitle(prev, picked || [])); setPicker(null); }}
        />
      )}

      {picker === 'barriers' && (
        <AddBarriersDrawer
          primaryLabel="Add to Care Plan"
          existingBarriers={barriers}
          onClose={() => setPicker(null)}
          onAdd={(picked) => {
            setBarriers((picked || []).map(b => ({ id: b.id, title: b.title })));
            setPicker(null);
          }}
        />
      )}

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

      {editingIntervention && (() => {
        const Editor = INTERVENTION_EDITORS[editingIntervention.kind];
        if (!Editor) return null;
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

      {templatesOpen && (
        <ApplyTemplatesDrawer
          showPriority={false}
          showCreateNew={false}
          onClose={() => setTemplatesOpen(false)}
          onApply={addFromTemplates}
        />
      )}
    </div>
  );
}
