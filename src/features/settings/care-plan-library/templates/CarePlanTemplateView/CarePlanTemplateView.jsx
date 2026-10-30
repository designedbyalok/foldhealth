import { useMemo, useState } from 'react';
import { InfoBar } from '../../../../../components/InfoBar/InfoBar';
import { Input } from '../../../../../components/Input/Input';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../components/Button/Button';
import { CloseButton } from '../../../../../components/CloseButton/CloseButton';
import { MenuPopover } from '../../../../../components/MenuPopover/MenuPopover';
import {
  CarePlanSections, CategoryCriteriaCard, ChronicConditionSelect, CommonSectionNote, COMMON, EpisodeSettings,
  TemplateCategoryBar, TemplateRenewalChoice, TemplateScopeChoice, TemplateTypeChoice, templateTypeOf, useTemplateCategories,
} from '../../shared';
import { categoriesProblem } from '../../lib/templateCategories';
import { CARE_PLAN_NAME_MAX } from '../../lib/carePlanLimits';
import { CreateGoalDrawer } from '../../goals/CreateGoalDrawer/CreateGoalDrawer';
import { AddGoalsDrawer } from '../../goals/AddGoalsDrawer/AddGoalsDrawer';
import { AddInterventionsDrawer } from '../../interventions/AddInterventionsDrawer';
import { AddBarriersDrawer } from '../../barriers/AddBarriersDrawer/AddBarriersDrawer';
import { INTERVENTION_EDITORS } from '../../interventions';
import {
  goalPayloadFromTemplateEntry,
  interventionPayloadFromTemplateEntry,
} from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanTemplateApply';
import { CARE_PLAN_INTERVENTION_ICONS } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanInterventionMenu';
import {
  LIBRARY_SCOPE_CHOICES, PATIENT_SCOPE_CHOICES, templateScopeOf,
} from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/templateScope';
import { renewalOf } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/templateRenewal';
import { DEFAULT_EPISODE_DAYS, episodeOf } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/episodeTemplates';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTemplateSdoh } from '../../lib/useTemplateSdoh';
import { isSdohBarrier } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/sdohTaxonomy';
import styles from './CarePlanTemplateView.module.css';


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

  const authUserId = useAppStore(s => s.authUserId);
  const [scope, setScope] = useState(() => templateScopeOf(template));
  // Only the owner can make a template private (RLS checks owner_user_id), so
  // an org template someone else created, or a legacy one with no owner,
  // can't be pulled out of everyone's library.
  const scopeChoices = (templateScopeOf(template) === 'patient' ? PATIENT_SCOPE_CHOICES : LIBRARY_SCOPE_CHOICES)
    .filter(k => k !== 'user' || (authUserId && template.ownerUserId === authUserId));

  const [renewal, setRenewal] = useState(() => renewalOf(template));

  const [name, setName] = useState(template.name || '');
  const [description, setDescription] = useState(template.description || '');
  const [conditions, setConditions] = useState(template.conditions || []);
  // Episodic when marked so; otherwise a template with conditions on it was
  // authored as a chronic-conditions one.
  const [templateType, setTemplateType] = useState(() => templateTypeOf(template));
  const [episode, setEpisode] = useState(() => episodeOf(template) || { days: DEFAULT_EPISODE_DAYS, pausesOngoing: true });
  const savedEpisode = episodeOf(template);
  const nextEpisode = templateType === 'episodic' ? episode : null;
  const episodeChanged = JSON.stringify(nextEpisode) !== JSON.stringify(savedEpisode);
  // The three lists are edited here and written on Save, so a picked goal
  // shows in the table before the template is persisted.
  const [goals, setGoals] = useState(template.goals || []);
  const [interventions, setInterventions] = useState(template.interventions || []);
  const [barriers, setBarriers] = useState(template.barriers || []);
  const [picker, setPicker] = useState(null); // 'goals' | 'interventions' | 'barriers'
  // { list, item, rect } — which row's menu is open.
  const [rowMenu, setRowMenu] = useState(null);
  // Common + categories: the three lists above hold whichever is on screen.
  const cats = useTemplateCategories(template.categories, { goals, interventions, barriers }, { setGoals, setInterventions, setBarriers });
  const showToast = useAppStore(s => s.showToast);
  const save = () => {
    const snap = cats.snapshot();
    const problem = categoriesProblem(snap.categories);
    if (problem) { showToast?.(problem); return; }
    onSave?.({
      name: name.trim(),
      description,
      conditions,
      goals: snap.goals,
      interventions: snap.interventions,
      barriers: snap.barriers,
      categories: snap.categories,
      renewal,
      episode: nextEpisode,
      episodeChanged,
      ...(scope !== templateScopeOf(template) && { scope, patientId: template.patientId }),
    });
  };

  const removeFromList = (list, id) => {
    const setters = { goals: setGoals, interventions: setInterventions, barriers: setBarriers };
    const current = { goals, interventions, barriers }[list];
    setters[list](current.filter(e => e.id !== id));
  };

  const norm = (v) => (v || '').trim().toLowerCase();
  // What a template goal brought with it: the library goal's own links, which
  // carry both interventions and barriers.
  const linksOfEntry = (entry) => (libraryGoals.find(g => g.id === entry.id)?.interventions) || [];

  // A goal arrives with what hangs off it: the library goal's links, split
  // back into interventions and barriers by kind.
  const addGoals = (picked) => {
    const seenGoals = new Set(goals.map(g => norm(g.title)));
    const fresh = (picked || []).filter((g) => {
      const key = norm(g.title);
      if (!key || seenGoals.has(key)) return false;
      seenGoals.add(key);
      return true;
    });
    if (!fresh.length) { setPicker(null); return; }

    const links = fresh.flatMap(g => linksOfEntry(g));
    const append = (list, incoming) => {
      const seen = new Set(list.map(e => norm(e.title)));
      const add = [];
      for (const l of incoming) {
        const key = norm(l.title);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        add.push({ id: l.id, title: l.title });
      }
      return add.length ? [...list, ...add] : list;
    };

    setGoals([...goals, ...fresh.map(g => ({ id: g.id, title: g.title }))]);
    setInterventions(prev => append(prev, links.filter(l => l.kind !== 'barrier')));
    setBarriers(prev => append(prev, links.filter(l => l.kind === 'barrier')));
    setPicker(null);
  };

  // Dropping a goal drops what hung off it, unless another goal still on the
  // template links the same item.
  const removeGoal = (goalId) => {
    const remaining = goals.filter(g => g.id !== goalId);
    const removedLinks = linksOfEntry({ id: goalId });
    if (!removedLinks.length) { setGoals(remaining); return; }
    const stillOwned = new Set(remaining.flatMap(e => linksOfEntry(e)
      .flatMap(l => [String(l.id), norm(l.title)])));
    const drop = (list) => list.filter((item) => {
      const wasLinked = removedLinks.some(l => String(l.id) === String(item.id)
        || norm(l.title) === norm(item.title));
      if (!wasLinked) return true;
      return stillOwned.has(String(item.id)) || stillOwned.has(norm(item.title));
    });
    setGoals(remaining);
    setInterventions(prev => drop(prev));
    setBarriers(prev => drop(prev));
  };

  // Picked rows join the list unless something with the same title is on it.
  const appendUnique = (setList, list, picked) => {
    const seen = new Set(list.map(e => (e.title || '').trim().toLowerCase()));
    const fresh = (picked || []).filter(p => {
      const key = (p.title || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) setList([...list, ...fresh.map(p => ({ id: p.id, title: p.title }))]);
    setPicker(null);
  };

  const goalRows = useMemo(() => goals.map((entry, i) => {
    const payload = goalPayloadFromTemplateEntry(entry, libraryGoals);
    return {
      ...payload,
      id: entry.id || `goal-${i}`,
      icon: GOAL_CATEGORY_ICONS[payload.category] || payload.icon,
      currentValue: 'No Data',
      trend: '—',
      progress: '0%',
    };
  }), [goals, libraryGoals]);

  const interventionRows = useMemo(() => interventions.map((entry, i) => ({
    ...interventionPayloadFromTemplateEntry(entry),
    id: entry.id || `intv-${i}`,
    // Same per-kind icon the patient plan uses, instead of one clipboard for all.
    icon: CARE_PLAN_INTERVENTION_ICONS[entry.kind] || 'solar:clipboard-list-linear',
  })), [interventions]);

  // SDOH needs go to their own section (lib/useTemplateSdoh).
  const { plainBarriers, sdoh } = useTemplateSdoh({ barriers, setBarriers, interventions, setInterventions });
  const barrierRows = useMemo(() => plainBarriers.map((entry, i) => ({
    id: entry.id || `barrier-${i}`,
    title: entry.title,
    subtitle: entry.description || '',
    priority: entry.priority || 'medium',
    status: 'Not Started',
  })), [plainBarriers]);

  // Reverse of a goal's links: which goals point at a given intervention or
  // barrier. Mirrors CarePlanView's linkedForChild, which shows owning goals.
  const goalsByLinkId = useMemo(() => {
    const map = new Map();
    for (const entry of goals) {
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
  }, [goals, libraryGoals]);

  return (
    <div className={styles.view}>
      <div className={styles.formPane}>
        <div className={styles.formHeader}>
          <span className={styles.formTitle}>Edit Care Plan</span>
        </div>
        <div className={styles.formBody}>
          {template.sourceProtocol && (
            <InfoBar variant="inline" icon="solar:document-medicine-linear">
              Based on clinical protocol: {[
                template.sourceProtocol.title,
                template.sourceProtocol.version && `v${template.sourceProtocol.version}`,
                template.sourceProtocol.organization,
              ].filter(Boolean).join(' · ')}
            </InfoBar>
          )}
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
            <TemplateTypeChoice value={templateType} onChange={setTemplateType} />
          </div>

          {templateType === 'episodic' && (
            <div className={styles.field}>
              <EpisodeSettings value={episode} onChange={setEpisode} />
            </div>
          )}

          {scopeChoices.length > 1 && (
            <div className={styles.field}>
              <TemplateScopeChoice value={scope} onChange={setScope} choices={scopeChoices} />
            </div>
          )}

          <div className={styles.field}>
            <TemplateRenewalChoice value={renewal} onChange={setRenewal} />
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
          <Button disabled={!name.trim()} onClick={save}>
            Save
          </Button>
          <span className={styles.toolbarDivider} />
          <CloseButton onClick={onClose} label="Close care plan template" />
        </div>

        <div className={styles.planBody}>
          <div className={styles.categories}>
            <TemplateCategoryBar categories={cats.categories} active={cats.active} onSelect={cats.select} onAdd={cats.add} />
            {cats.active === COMMON && cats.categories.length > 0 && <CommonSectionNote />}
            {cats.activeCategory && (
              <CategoryCriteriaCard
                category={cats.activeCategory}
                index={cats.categories.indexOf(cats.activeCategory)}
                total={cats.categories.length}
                onChange={patch => cats.update(cats.active, patch)}
                onRemove={() => cats.remove(cats.active)}
                onMove={by => cats.move(cats.active, by)}
              />
            )}
          </div>
          <CarePlanSections
            goalRows={goalRows}
            interventionRows={interventionRows}
            barrierRows={barrierRows}
            sdoh={sdoh}
            onRowMenuGoal={(m) => setRowMenu({ list: 'goals', item: m.item, rect: m.rect })}
            onRowMenuIntervention={(m) => setRowMenu({ list: 'interventions', item: m.item, rect: m.rect })}
            onRowMenuBarrier={(m) => setRowMenu({ list: 'barriers', item: m.item, rect: m.rect })}
            onChangeBarrierPriority={(row, priority) => setBarriers(prev => prev.map(b => (b.id === row.id ? { ...b, priority } : b)))}
            onAddGoal={() => setPicker('goals')}
            onAddIntervention={() => setPicker('interventions')}
            onAddBarrier={() => setPicker('barriers')}
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
              const entry = interventions.find(i => i.id === row.id);
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
            if (list === 'goals') setEditingGoal(item);
            else if (list === 'interventions') {
              const entry = interventions.find(i => i.id === item.id);
              setEditingIntervention(entry || item);
            }
          }}
        />
      )}

      {picker === 'goals' && (
        <AddGoalsDrawer
          primaryLabel="Add to Template"
          onClose={() => setPicker(null)}
          onAdd={(picked) => addGoals(picked)}
        />
      )}

      {picker === 'interventions' && (
        <AddInterventionsDrawer
          primaryLabel="Add to Template"
          onClose={() => setPicker(null)}
          onAdd={(picked) => appendUnique(setInterventions, interventions, picked)}
        />
      )}

      {picker === 'barriers' && (
        <AddBarriersDrawer
          primaryLabel="Add to Template"
          existingBarriers={plainBarriers}
          onClose={() => setPicker(null)}
          // Already-added rows open ticked here, so the picked set is the
          // full list the template should keep.
          onAdd={(picked) => {
            // The picker manages plain barriers; SDOH needs stay as they are.
            setBarriers(prev => [...prev.filter(isSdohBarrier), ...(picked || []).map(p => ({ id: p.id, title: p.title }))]);
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
    </div>
  );
}
