import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '../../../../../components/Input/Input';
import { Select } from '../../../../../components/Select/Select';
import { Textarea } from '../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../components/Button/Button';
import { RadioOptionGroup } from '../../../../../components/RadioOptionGroup/RadioOptionGroup';
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
import {
  CarePlanSections, CategoryCriteriaCard, ChronicConditionSelect, CommonSectionNote, COMMON, EpisodeSettings,
  TemplateCategoryBar, TemplateRenewalChoice, TemplateScopeChoice, TemplateTypeChoice, useTemplateCategories,
} from '../../shared';
import { categoriesProblem } from '../../lib/templateCategories';
import { LIBRARY_SCOPE_CHOICES } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/templateScope';
import { defaultRenewalFor } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/templateRenewal';
import { DEFAULT_EPISODE_DAYS } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/episodeTemplates';
import { CARE_PLAN_NAME_MAX } from '../../lib/carePlanLimits';
import {
  goalPayloadFromTemplateEntry,
  interventionPayloadFromTemplateEntry,
} from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanTemplateApply';
import { CARE_PLAN_INTERVENTION_ICONS } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanInterventionMenu';
import { useTemplateSdoh } from '../../lib/useTemplateSdoh';
import { isSdohBarrier } from '../../../../patient/right-panel/tabs/care-programs/care-plan/lib/sdohTaxonomy';
import { UnityPromptField } from '../../../../../components/UnityPromptField/UnityPromptField';
import { UnityIcon } from '../../../../../components/UnityIcon/UnityIcon';
import { TableSkeleton } from '../../../../../components/TableSkeleton/TableSkeleton';
import { protocolGuidanceText } from '../../../clinical-protocols/lib/protocolSchema';
import { ProtocolUploadDrawer } from '../../../clinical-protocols/ProtocolUploadDrawer';
import { ProtocolReviewDrawer } from '../../../clinical-protocols/ProtocolReviewDrawer';
import { buildTemplateCatalog, TEMPLATE_DESCRIPTION_MAX } from '../../lib/aiTemplateDraft';
import {
  requestTemplateDraft,
  templateDraftToEditor,
  draftProvenance,
  materializeNewGoals,
  withoutDraftMarks,
} from '../../lib/templateDraftToEditor';
import styles from './CarePlanCreateView.module.css';

const DRAFT_EXAMPLE = 'A care plan for newly diagnosed Type 2 diabetes with focus on medication adherence and dietary counseling.';


const BUILD_MODES = [
  { value: 'manual', label: 'Build it yourself', hint: 'Name it and add goals, interventions and barriers from the library.' },
  { value: 'ai', label: 'Draft with UnityAI', hint: 'Describe it, optionally from a clinical protocol. UnityAI drafts the name, description, goals, interventions and barriers for you to review.' },
];
// The protocol picker's first option opens the upload drawer instead of picking.
const UPLOAD_PROTOCOL = '__upload';

/**
 * New Care Plan — full-pane template creation (Figma Care-Plan-Creation
 * 14108:294857). Left column holds the plan's identity (name, description,
 * template type); the right column is where goals accrue, empty until the
 * first one is added.
 */
export function CarePlanCreateView({ onClose, onSave }) {
  // Who it's for. A library template is for the organization or just its
  // creator; patient templates are only saved from a patient's care plan.
  const [scope, setScope] = useState('org');
  // Built by hand, or drafted by UnityAI (which also writes the name and
  // description, so those wait for the draft).
  const [buildMode, setBuildMode] = useState('manual');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState('general');
  // An episodic template's length and whether it pauses the patient's other plans.
  const [episode, setEpisode] = useState({ days: DEFAULT_EPISODE_DAYS, pausesOngoing: true });
  // Follows the template type (conditions extend, events reinstate) until
  // someone picks one.
  const [renewalPick, setRenewalPick] = useState(null);
  const renewal = renewalPick || defaultRenewalFor(templateType === 'chronic' ? ['chronic'] : []);
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
  // Common + categories: the three lists above hold whichever is on screen.
  const cats = useTemplateCategories([], { goals, interventions, barriers }, { setGoals, setInterventions, setBarriers });
  const showToast = useAppStore(s => s.showToast);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingIntervention, setEditingIntervention] = useState(null);
  const libraryTemplates = useAppStore(s => s.carePlanTemplates);
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const interventionLibrary = useAppStore(s => s.carePlanInterventionTemplates);
  const saveCarePlanGoal = useAppStore(s => s.saveCarePlanGoal);
  const barrierLibrary = useAppStore(s => s.carePlanBarriers);

  // An Active clinical protocol (Care Plan Library > Clinical Protocols) the draft
  // follows; the saved template records it as its source.
  const clinicalProtocols = useAppStore(s => s.clinicalProtocols);
  const fetchClinicalProtocols = useAppStore(s => s.fetchClinicalProtocols);
  useEffect(() => { fetchClinicalProtocols?.(); }, [fetchClinicalProtocols]);
  const activeProtocols = useMemo(() => clinicalProtocols.filter(p => p.status === 'active'), [clinicalProtocols]);
  const [protocolId, setProtocolId] = useState('');
  const sourceProtocol = activeProtocols.find(p => p.id === protocolId) || null;
  // A protocol can also be uploaded from here: upload, review, and once it's
  // approved it becomes the pick.
  const [protocolUploadOpen, setProtocolUploadOpen] = useState(false);
  const [reviewProtocolId, setReviewProtocolId] = useState(null);
  const pickProtocol = (id) => {
    if (id === UPLOAD_PROTOCOL) { setProtocolUploadOpen(true); return; }
    setProtocolId(id);
    // Read from the store: a protocol approved a moment ago isn't in this render's list yet.
    const picked = useAppStore.getState().clinicalProtocols.find(p => p.id === id);
    if (picked && !draftText.trim()) {
      const conditionsText = picked.conditions.length ? ` for ${picked.conditions.join(', ')}` : '';
      setDraftText(`A care plan following ${picked.title}${conditionsText}.`);
    }
  };

  // UnityAI drafting: a plain-English description becomes goals,
  // interventions and barriers (library items where possible) that land in
  // the editor for review. `draftIdsRef` holds what the last draft added, so a
  // fresh draft replaces it without touching anything added by hand.
  const [draftText, setDraftText] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftReview, setDraftReview] = useState(null);
  // Only read inside handlers, so refs rather than state.
  const draftIdsRef = useRef(new Set());
  const draftConditionsRef = useRef(new Set());
  // The name and description the last draft wrote; a redraft replaces them
  // unless they've been edited since.
  const draftTextRef = useRef({ name: '', description: '' });
  // The protocol the current draft followed: what the template is saved as based on.
  const draftedProtocolRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const goalRows = useMemo(() => goals.map(g => ({
    ...goalPayloadFromTemplateEntry({ id: g.id }, goals),
    id: g.id,
    title: g.title,
    // A goal UnityAI suggested that isn't in the library yet says so.
    subtitle: g.aiNew
      ? ['New to library', g.description].filter(Boolean).join(' · ')
      : g.description || g.detail || '',
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

  // SDOH needs go to their own section (lib/useTemplateSdoh).
  const { plainBarriers, sdoh } = useTemplateSdoh({ barriers, setBarriers, interventions, setInterventions });
  const barrierRows = useMemo(() => plainBarriers.map((entry, i) => ({
    id: entry.id || `barrier-${i}`,
    title: entry.title,
    priority: entry.priority || 'medium',
    status: 'Not Started',
  })), [plainBarriers]);

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

  const dropDraft = (list) => list.filter(x => !draftIdsRef.current.has(x.id));
  const mergeDraft = (list, incoming) => {
    const kept = dropDraft(list);
    const titles = new Set(kept.map(x => norm(x.title)));
    return [...kept, ...incoming.filter(x => !titles.has(norm(x.title)))];
  };

  const draftWithAi = async (text) => {
    // A draft is the template's Common section.
    cats.select(COMMON);
    setDrafting(true);
    setDraftError('');
    try {
      const catalog = buildTemplateCatalog({ goals: libraryGoals, interventions: interventionLibrary, barriers: barrierLibrary });
      const protocol = sourceProtocol && {
        title: sourceProtocol.title,
        version: sourceProtocol.version,
        organization: sourceProtocol.organization,
        guidance: protocolGuidanceText(sourceProtocol.protocol),
      };
      const draft = await requestTemplateDraft(text, catalog, protocol);
      const lists = templateDraftToEditor(draft, { libraryGoals, interventionLibrary, barrierLibrary });
      setGoals(prev => mergeDraft(prev, lists.goals));
      setInterventions(prev => mergeDraft(prev, lists.interventions));
      setBarriers(prev => mergeDraft(prev, lists.barriers));
      draftIdsRef.current = new Set([...lists.goals, ...lists.interventions, ...lists.barriers].map(x => x.id));
      const replaceable = (current, last) => !current.trim() || current === last;
      if (draft.name && replaceable(name, draftTextRef.current.name)) setName(draft.name);
      if (draft.summary && replaceable(description, draftTextRef.current.description)) setDescription(draft.summary);
      draftTextRef.current = { name: draft.name || '', description: draft.summary || '' };
      draftedProtocolRef.current = protocol ? sourceProtocol : null;
      // Conditions the last draft added are replaced too; ones picked by hand stay.
      const kept = conditions.filter(c => !draftConditionsRef.current.has(c));
      const keptSet = new Set(kept);
      const added = draft.conditions.filter(c => !keptSet.has(c));
      setConditions([...kept, ...added]);
      draftConditionsRef.current = new Set(added);
      if (draft.templateType === 'chronic') setTemplateType('chronic');
      setDraftReview(draftProvenance(lists));
    } catch (err) {
      setDraftError(err.message);
    } finally {
      setDrafting(false);
    }
  };

  const discardDraft = () => {
    cats.select(COMMON);
    setGoals(prev => dropDraft(prev));
    setInterventions(prev => dropDraft(prev));
    setBarriers(prev => dropDraft(prev));
    draftIdsRef.current = new Set();
    const dropped = draftConditionsRef.current;
    setConditions(prev => prev.filter(c => !dropped.has(c)));
    draftConditionsRef.current = new Set();
    if (name === draftTextRef.current.name) setName('');
    if (description === draftTextRef.current.description) setDescription('');
    draftTextRef.current = { name: '', description: '' };
    draftedProtocolRef.current = null;
    setDraftReview(null);
  };

  const aiMode = buildMode === 'ai';
  // UnityAI writes the name and description, so they open for edits once it has drafted.
  const awaitingDraft = aiMode && (!draftReview || drafting);
  const canSave = name.trim().length > 0 && !saving && !drafting;

  const payload = (savedGoals, snap) => {
    const drafted = draftedProtocolRef.current;
    return {
      name: name.trim(),
      description: description.trim(),
      templateType,
      conditions,
      goals: savedGoals,
      interventions: withoutDraftMarks(snap.interventions),
      barriers: withoutDraftMarks(snap.barriers),
      categories: snap.categories,
      scope,
      renewal,
      episode: templateType === 'episodic' ? episode : null,
      sourceProtocol: drafted
        ? { id: drafted.id, title: drafted.title, version: drafted.version, organization: drafted.organization }
        : null,
    };
  };

  // Goals UnityAI suggested that the library doesn't have are created there
  // first, so the template references real goals (and a retry won't create
  // them twice).
  const save = async (status) => {
    const snap = cats.snapshot();
    const problem = categoriesProblem(snap.categories);
    if (problem) { showToast?.(problem); return; }
    setSaving(true);
    try {
      const savedGoals = await materializeNewGoals(snap.goals, saveCarePlanGoal);
      if (!savedGoals) return;
      if (cats.active === COMMON) setGoals(savedGoals);
      await onSave?.({ ...payload(savedGoals, snap), status });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.view}>
      <div className={styles.formPane}>
        <div className={styles.formHeader}>
          <span className={styles.formTitle}>New Care Plan</span>
        </div>

        <div className={styles.formBody}>
          <RadioOptionGroup
            label="How do you want to build it?"
            name="buildMode"
            variant="card"
            options={BUILD_MODES}
            value={buildMode}
            onChange={setBuildMode}
          />

          {aiMode && (
            <>
              <Select
                label="Clinical protocol"
                portal
                searchable
                placeholder="None: draft from the description only"
                // Upload leads the list (and sits in the label row) so it stays in
                // reach however many protocols there are.
                labelAction={(
                  <Button variant="ghost" size="sm" leadingIcon="solar:upload-minimalistic-linear" onClick={() => setProtocolUploadOpen(true)}>
                    Upload
                  </Button>
                )}
                options={[
                  { value: UPLOAD_PROTOCOL, label: 'Upload a new protocol', icon: 'solar:upload-minimalistic-linear' },
                  { value: '', label: 'None: draft from the description only' },
                  ...activeProtocols.map(p => ({
                    value: p.id,
                    label: [p.title, p.version && `v${p.version}`, p.organization].filter(Boolean).join(' · '),
                  })),
                ]}
                value={protocolId}
                onChange={pickProtocol}
                helperText={sourceProtocol
                  ? 'UnityAI follows its thresholds, cadence and titration, and the template is saved as based on it.'
                  : 'Optional. Pick an approved protocol, or upload one to review and approve.'}
              />
              <UnityPromptField
                label="Describe this template in plain English"
                value={draftText}
                onChange={setDraftText}
                onSubmit={draftWithAi}
                placeholder="Who it's for and what it should focus on"
                example={DRAFT_EXAMPLE}
                actionLabel={draftReview ? 'Redraft' : 'Draft Template'}
                generatingLabel="Drafting…"
                generating={drafting}
                error={draftError}
                hint="UnityAI drafts the name, description, goals, interventions and barriers, using your library first. Review and edit before saving."
                maxLength={TEMPLATE_DESCRIPTION_MAX}
              />
            </>
          )}

          <div className={styles.field}>
            <div className={styles.fieldLabelRow}>
              <span className={styles.fieldLabel}>
                Care Plan Name <span className={styles.mandatoryDot} aria-hidden="true" />
              </span>
            </div>
            <Input
              value={name}
              onChange={e => setName(e.target.value.slice(0, CARE_PLAN_NAME_MAX))}
              disabled={awaitingDraft}
              placeholder={awaitingDraft ? 'UnityAI names it when it drafts' : 'Enter Care Plan Name'}
              characterLimit={CARE_PLAN_NAME_MAX}
              aria-label="Care Plan Name"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Description</span>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={awaitingDraft}
              placeholder={awaitingDraft ? 'UnityAI writes it when it drafts' : 'Briefly describe the Plan objective'}
              rows={3}
              aria-label="Description"
            />
          </div>

          {/* Same shape as the Edit Care Plan pane: a labelled field, not a
              section heading. */}
          <div className={styles.field}>
            <TemplateTypeChoice value={templateType} onChange={setTemplateType} />
          </div>

          {templateType === 'episodic' && (
            <div className={styles.field}>
              <EpisodeSettings value={episode} onChange={setEpisode} />
            </div>
          )}

          <div className={styles.field}>
            <TemplateScopeChoice value={scope} onChange={setScope} choices={LIBRARY_SCOPE_CHOICES} />
          </div>

          <div className={styles.field}>
            <TemplateRenewalChoice value={renewal} onChange={setRenewalPick} />
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
            variant="soft"
            disabled={!canSave}
            onClick={() => save('draft')}
          >
            Save as Draft
          </Button>
          <Button
            variant="outline"
            disabled={!canSave}
            onClick={() => save('published')}
          >
            Save as Template
          </Button>
          <span className={styles.toolbarDivider} />
          <CloseButton onClick={onClose} />
        </div>

        <div className={styles.goalsBody}>
          {!drafting && (
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
          )}
          {drafting ? (
            <div className={styles.draftingCard} role="status" aria-live="polite">
              <span className={styles.draftingTitle}>
                <UnityIcon size={16} color="var(--primary-300)" />
                Drafting goals, interventions and barriers…
              </span>
              <TableSkeleton rows={6} />
            </div>
          ) : goals.length === 0 ? (
            <div className={styles.goalsEmpty}>
              <RingEmptyState icon="solar:flag-linear" label="No Goals Added" iconSize={31} />
              <div className={styles.goalsEmptyActions}>
                <Button
                  variant="soft"
                  leadingIconElement={<AddIconMinimalist size={16} />}
                  onClick={() => setPicker('goals')}
                >
                  Add New
                </Button>
                <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
                  Use Template
                </Button>
              </div>
            </div>
          ) : (
            <>
            {draftReview && (
              <div className={styles.draftBanner} role="status">
                <UnityIcon size={16} color="var(--primary-300)" />
                <div className={styles.draftBannerText}>
                  <span className={styles.draftBannerTitle}>
                    Drafted {draftReview.goals} {draftReview.goals === 1 ? 'goal' : 'goals'},{' '}
                    {draftReview.interventions} {draftReview.interventions === 1 ? 'intervention' : 'interventions'} and{' '}
                    {draftReview.barriers} {draftReview.barriers === 1 ? 'barrier' : 'barriers'}
                  </span>
                  <span className={styles.draftBannerMeta}>
                    {draftReview.fromLibrary} from your library
                    {draftReview.fresh > 0 && `, ${draftReview.fresh} new (new goals are added to the library when you save)`}.
                    {' '}Review, edit or remove anything, then Save as Template to publish.
                  </span>
                </div>
                <Button variant="soft" size="sm" onClick={discardDraft}>Discard Draft</Button>
              </div>
            )}
            <CarePlanSections
              goalRows={goalRows}
              interventionRows={interventionRows}
              barrierRows={barrierRows}
              sdoh={sdoh}
              onOpenGoal={(row) => setEditingGoal(goals.find(g => g.id === row.id && g.aiNew)
                || libraryGoals.find(g => g.id === row.id) || row)}
              onOpenIntervention={(row) => setEditingIntervention(
                interventions.find(i => i.id === row.id) || row,
              )}
              onAddGoal={() => setPicker('goals')}
              onAddIntervention={() => setPicker('interventions')}
              onAddBarrier={() => setPicker('barriers')}
              onRowMenuGoal={(m) => setRowMenu({ list: 'goals', item: m.item, rect: m.rect })}
              onRowMenuIntervention={(m) => setRowMenu({ list: 'interventions', item: m.item, rect: m.rect })}
              onRowMenuBarrier={(m) => setRowMenu({ list: 'barriers', item: m.item, rect: m.rect })}
              onChangeBarrierPriority={(row, priority) => setBarriers(prev => prev.map(b => (b.id === row.id ? { ...b, priority } : b)))}
            />
            </>
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
            if (list === 'goals') {
              setEditingGoal(goals.find(g => g.id === item.id && g.aiNew)
                || libraryGoals.find(g => g.id === item.id) || item);
            }
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
          existingBarriers={plainBarriers}
          onClose={() => setPicker(null)}
          onAdd={(picked) => {
            // The picker manages plain barriers; SDOH needs stay as they are.
            setBarriers(prev => [...prev.filter(isSdohBarrier), ...(picked || []).map(b => ({ id: b.id, title: b.title }))]);
            setPicker(null);
          }}
        />
      )}

      {editingGoal && (
        <CreateGoalDrawer
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSave={async (values) => {
            // A suggested goal isn't in the library until the template saves,
            // so its edits stay here until then.
            if (editingGoal.aiNew) {
              setGoals(prev => prev.map(g => (g.id === editingGoal.id ? { ...g, ...values, id: g.id, aiNew: true } : g)));
            } else {
              await saveCarePlanGoal(values, editingGoal.id);
            }
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

      {protocolUploadOpen && (
        <ProtocolUploadDrawer
          onClose={() => setProtocolUploadOpen(false)}
          onReview={(id) => { setProtocolUploadOpen(false); setReviewProtocolId(id); }}
        />
      )}
      {reviewProtocolId && (
        <ProtocolReviewDrawer
          key={reviewProtocolId}
          protocolId={reviewProtocolId}
          onApproved={pickProtocol}
          onClose={() => setReviewProtocolId(null)}
        />
      )}
    </div>
  );
}
