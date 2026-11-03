import { useMemo, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Alert } from '../../../components/Alert/Alert';
import { Input } from '../../../components/Input/Input';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { NumberStepper } from '../../../components/NumberStepper/NumberStepper';
import { UnityIcon } from '../../../components/UnityIcon/UnityIcon';
import { FilePreview } from '../../../components/FilePreview/FilePreview';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { LinkageTree } from '../../../components/LinkageTree/LinkageTree';
import { useAppStore } from '../../../store/useAppStore';
import { describeCriteria } from '../care-plan-library/lib/templateCategories';
import { templateDraftToEditor } from '../care-plan-library/lib/templateDraftToEditor';
import { CarePlanSections } from '../care-plan-library/shared';
import { AddGoalsDrawer } from '../care-plan-library/goals/AddGoalsDrawer/AddGoalsDrawer';
import { AddInterventionsDrawer } from '../care-plan-library/interventions/AddInterventionsDrawer';
import { AddBarriersDrawer } from '../care-plan-library/barriers/AddBarriersDrawer/AddBarriersDrawer';
import { CARE_PLAN_INTERVENTION_ICONS } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanInterventionMenu';
import { goalPayloadFromTemplateEntry, interventionPayloadFromTemplateEntry } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanTemplateApply';
import { COMMON, goalTarget, newPlanCategory, patchPlanSection, planCounts, planSection } from './lib/protocolPlan';
import styles from './ClinicalProtocols.module.css';

const MAX_GOALS = 5;
const norm = (v) => String(v || '').trim().toLowerCase();

// A section's lists as the template will hold them: its edited lists, else
// its drafted goals with what each library goal brings (templateDraftToEditor).
const editorLists = (section, libs) => section.lists || templateDraftToEditor({ goals: section.goals || [], conditions: [] }, libs);

/**
 * G / I / B counts, e.g. on a protocol row or a scope row: what the template
 * will hold once the library has loaded, the drafted goals' own until then.
 */
export function PlanCounts({ plan }) {
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const interventionLibrary = useAppStore(s => s.carePlanInterventionTemplates);
  const barrierLibrary = useAppStore(s => s.carePlanBarriers);
  const loaded = useAppStore(s => s.carePlanLibraryDidFetch);
  const c = useMemo(() => {
    if (!loaded || !plan) return planCounts(plan);
    const libs = { libraryGoals: libraryGoals || [], interventionLibrary: interventionLibrary || [], barrierLibrary: barrierLibrary || [] };
    return planCounts({
      lists: editorLists(plan, libs),
      categories: (plan.categories || []).map(cat => ({ lists: editorLists(cat, libs) })),
    });
  }, [plan, loaded, libraryGoals, interventionLibrary, barrierLibrary]);
  return (
    <span className={styles.countChips} title={`${c.goals} goals, ${c.interventions} interventions, ${c.barriers} barriers`}>
      <Badge size="sm" label={`G${c.goals}`} />
      <Badge size="sm" label={`I${c.interventions}`} />
      <Badge size="sm" label={`B${c.barriers}`} />
    </span>
  );
}

function ScopeRow({ title, range, section, selected, onSelect }) {
  return (
    <button type="button" className={`${styles.scopeRow} ${selected ? styles.scopeRowActive : ''}`} onClick={onSelect} aria-pressed={selected}>
      <span className={styles.scopeRowText}>
        <span className={styles.scopeRowTitle}>{title}</span>
        {range && <span className={styles.scopeRowRange}>{range}</span>}
      </span>
      <PlanCounts plan={{ ...section, categories: [] }} />
      <Icon name="solar:alt-arrow-right-linear" size={16} color="var(--neutral-300)" />
    </button>
  );
}

/**
 * The right pane's Scope tab: the protocol in plain language, then Common and
 * each category as a row with its G / I / B; a row opens its output in the
 * left pane. Refresh redrafts after edits; Add Category opens a new one there.
 */
export function ScopeOverview({ plan, protocol, editable, building, selected, onSelect, onChange, onRefresh, onBuild }) {
  const scope = protocol.scope || {};
  const overview = plan?.overview || protocol.summary;
  const addCategory = () => {
    const c = newPlanCategory();
    onChange({ ...plan, categories: [...plan.categories, c], edited: true });
    onSelect(c.id);
  };

  return (
    <div className={styles.paneStack}>
      {overview && <p className={styles.overview}>{overview}</p>}
      {(scope.conditions || []).length > 0 && (
        <span className={styles.chips}>
          {scope.conditions.map(c => <Badge key={c.name} size="sm" label={c.code ? `${c.name} · ${c.code}` : c.name} />)}
        </span>
      )}
      {(scope.population || (scope.exclusions || []).length > 0) && (
        <dl className={styles.facts}>
          {scope.population && <div><dt>Who it covers</dt><dd>{scope.population}</dd></div>}
          {(scope.exclusions || []).length > 0 && (
            <div>
              <dt>Who it leaves out</dt>
              <dd>{scope.exclusions.length === 1 ? scope.exclusions[0] : <ul className={styles.factList}>{scope.exclusions.map(x => <li key={x}>{x}</li>)}</ul>}</dd>
            </div>
          )}
        </dl>
      )}

      {!plan ? (
        <div className={styles.scopeEmpty}>
          <p className={styles.hint}>No scope yet. UnityAI reads the protocol and lays out its categories with the goals, interventions and barriers for each.</p>
          {editable && (
            <Button variant="outline" size="sm" leadingIconElement={<UnityIcon size={14} color="currentColor" />} disabled={building} onClick={onBuild}>
              {building ? 'Building…' : 'Build Scope'}
            </Button>
          )}
        </div>
      ) : (
        <section className={styles.categoryList}>
          <div className={styles.categoryListHead}>
            <span className={styles.categoryListTitle}>Categories</span>
            <PlanCounts plan={plan} />
            {editable && (
              <Button
                variant={plan.edited ? 'solid' : 'outline'}
                size="sm"
                leadingIcon="solar:refresh-linear"
                disabled={building || (plan.categories || []).some(c => !c.name.trim())}
                onClick={onRefresh}
              >
                {building ? 'Refreshing…' : 'Refresh'}
              </Button>
            )}
          </div>
          {plan.edited && <p className={styles.editedNote}>Edited. Refresh to redraft the goals, interventions and barriers before approving.</p>}
          <ScopeRow title="Every patient" range="Whatever their category" section={plan} selected={selected === COMMON} onSelect={() => onSelect(COMMON)} />
          {plan.categories.map(c => (
            <ScopeRow key={c.id} title={c.name || 'Untitled category'} range={c.range} section={c} selected={selected === c.id} onSelect={() => onSelect(c.id)} />
          ))}
          {editable && (
            <button type="button" className={styles.addRow} onClick={addCategory}>
              <Icon name="solar:add-circle-linear" size={16} color="currentColor" />
              Add Category
            </button>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * The left pane on the original file, as the HCC drawer previews a chart:
 * the uploaded document at `page` (from an item's source), with a way out to
 * a new tab. `url` is a short-lived signed link; null while it loads.
 */
export function DocumentPanel({ name, url, page, onOpenNewTab, onClose }) {
  return (
    <div className={styles.leftPane}>
      <div className={styles.leftHead}>
        <span className={styles.leftHeadText}>
          <span className={styles.leftTitle}>{name || 'Original file'}</span>
          {page ? <span className={styles.scopeRowRange}>Page {page}</span> : null}
        </span>
        <ActionButton icon="solar:square-top-down-linear" size="sm" tooltip="Open in new tab" onClick={onOpenNewTab} />
        <span className={styles.headerDivider} />
        <CloseButton onClick={onClose} label="Close document" />
      </div>
      <div className={styles.docBody}>
        {url
          ? <FilePreview key={page || 0} src={page ? `${url}#page=${page}` : url} name={name} className={styles.docPreview} />
          : <p className={styles.hint}>Loading the document…</p>}
      </div>
    </div>
  );
}

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
const linksOf = goal => goal?.interventions || [];

/**
 * The left pane: one section of the scope (Common or a category) and its
 * goals, interventions and barriers exactly as the care plan template will
 * hold them, in the care plan's own tables. An admin adds from the library
 * or removes rows here (the section then keeps its edited lists), and edits
 * its name, range and how many goals Refresh drafts.
 */
export function CategoryPanel({ plan, sectionKey, editable, onChange, onClose }) {
  const libraryGoals = useAppStore(s => s.carePlanGoals);
  const interventionLibrary = useAppStore(s => s.carePlanInterventionTemplates);
  const barrierLibrary = useAppStore(s => s.carePlanBarriers);
  const [picker, setPicker] = useState(null); // 'goals' | 'interventions' | 'barriers'
  const [rowMenu, setRowMenu] = useState(null); // { list, item, rect }
  // 'tables' (add and remove here) or 'nested' (goals with what hangs off each).
  const [view, setView] = useState('tables');
  const section = planSection(plan, sectionKey);
  const lists = useMemo(() => {
    if (!section) return { goals: [], interventions: [], barriers: [] };
    return section.lists || templateDraftToEditor(
      { goals: section.goals, conditions: [] },
      { libraryGoals: libraryGoals || [], interventionLibrary: interventionLibrary || [], barrierLibrary: barrierLibrary || [] },
    );
  }, [section, libraryGoals, interventionLibrary, barrierLibrary]);
  const goalRows = useMemo(() => lists.goals.map(g => ({
    ...goalPayloadFromTemplateEntry({ id: g.id }, lists.goals),
    id: g.id,
    title: g.title,
    subtitle: g.aiNew ? ['New to library', g.description].filter(Boolean).join(' · ') : g.description || '',
    priority: g.priority || 'medium',
    icon: 'solar:flag-linear',
    status: 'Not Started',
  })), [lists.goals]);
  const interventionRows = useMemo(() => lists.interventions.map((entry, i) => ({
    ...interventionPayloadFromTemplateEntry(entry),
    id: entry.id || `intv-${i}`,
    icon: CARE_PLAN_INTERVENTION_ICONS[entry.kind] || 'solar:clipboard-list-linear',
  })), [lists.interventions]);
  const barrierRows = useMemo(() => lists.barriers.map((entry, i) => ({
    id: entry.id || `barrier-${i}`,
    title: entry.title,
    priority: entry.priority || 'medium',
    status: 'Not Started',
  })), [lists.barriers]);
  // The nested view, as the care plan's Linkage view shows it: each goal with
  // the interventions and barriers it brings beneath it (its library links, or
  // a new goal's own), then whatever no goal here links, Unlinked.
  const nestedGroups = useMemo(() => {
    const child = (kind, entry, i) => ({
      key: `${kind}:${entry.id || i}`,
      title: entry.title,
      icon: kind === 'barrier' ? 'solar:signpost-2-linear' : CARE_PLAN_INTERVENTION_ICONS[entry.kind] || 'solar:checklist-minimalistic-linear',
      meta: kind === 'barrier' ? 'Barrier' : 'Intervention',
    });
    const children = [
      ...lists.interventions.map((e, i) => child('intervention', e, i)),
      ...lists.barriers.map((e, i) => child('barrier', e, i)),
    ];
    const linked = new Set();
    const groups = lists.goals.map((g) => {
      const titles = new Set(linksOf(g).map(l => norm(l.title)));
      const items = children.filter(c => titles.has(norm(c.title)));
      items.forEach(c => linked.add(c.key));
      return {
        key: String(g.id),
        title: g.title,
        icon: 'solar:flag-linear',
        meta: [g.aiNew ? 'New to library' : 'Goal', g.frequency].filter(Boolean).join(' • '),
        emptyText: 'No interventions or barriers linked to this goal',
        items,
      };
    });
    return [...groups, {
      key: 'unlinked',
      title: 'Unlinked',
      unlinked: true,
      emptyText: 'Every intervention and barrier is linked to a goal.',
      items: children.filter(c => !linked.has(c.key)),
    }];
  }, [lists]);

  if (!section) return null;
  const { category } = section;
  const patchCategory = patch => onChange({ ...patchPlanSection(plan, sectionKey, patch), edited: true });
  const removeCategory = () => {
    onChange({ ...plan, categories: plan.categories.filter(c => c.id !== category.id), edited: true });
    onClose();
  };
  // Hand edits to the lists stand as they are: they need no Refresh (which would replace them).
  const setLists = next => onChange(patchPlanSection(plan, sectionKey, { lists: { ...lists, ...next } }));
  // A goal arrives with what hangs off it, as in the template editor.
  const addGoals = (picked) => {
    setPicker(null);
    const seen = new Set(lists.goals.map(g => String(g.id)));
    const fresh = (picked || []).filter(g => !seen.has(String(g.id)));
    if (!fresh.length) return;
    const links = fresh.flatMap(linksOf);
    setLists({
      goals: [...lists.goals, ...fresh],
      interventions: appendByTitle(lists.interventions, links.filter(l => l.kind !== 'barrier')),
      barriers: appendByTitle(lists.barriers, links.filter(l => l.kind === 'barrier')),
    });
  };
  const remove = (list, item) => setLists({
    [list]: lists[list].filter(x => String(x.id) !== String(item.id) && norm(x.title) !== norm(item.title)),
  });
  const menuFor = list => (editable ? (m => setRowMenu({ list, item: m.item, rect: m.rect })) : undefined);

  return (
    <div className={styles.leftPane}>
      <div className={styles.leftHead}>
        <span className={styles.leftHeadText}>
          <span className={styles.leftTitle}>{section.name}</span>
          {section.range && <span className={styles.scopeRowRange}>{section.range}</span>}
        </span>
        <PlanCounts plan={{ lists, categories: [] }} />
        <ActionButton
          icon={view === 'nested' ? 'solar:list-linear' : 'solar:link-linear'}
          size="sm"
          tooltip={view === 'nested' ? 'Table View' : 'Nested View'}
          onClick={() => setView(v => (v === 'nested' ? 'tables' : 'nested'))}
        />
        {editable && category && <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Remove category" onClick={removeCategory} />}
        <span className={styles.headerDivider} />
        <CloseButton onClick={onClose} label="Close category" />
      </div>
      <div className={styles.leftBody}>
        {editable && (
          <div className={styles.scopeFields}>
            {category && (
              <>
                <Input label="Category" required value={category.name} onChange={e => patchCategory({ name: e.target.value })} placeholder="Stage 2 hypertension" maxLength={80} />
                <Input label="Range" value={category.range || ''} onChange={e => patchCategory({ range: e.target.value })} placeholder="Systolic BP 140–179 mmHg" maxLength={200} />
              </>
            )}
            <span className={styles.scopeGoals}>
              <span className={styles.label}>Goals to draft</span>
              {category
                ? <NumberStepper value={goalTarget(category)} min={1} max={MAX_GOALS} ariaLabel={`Goals for ${category.name || 'category'}`} onChange={v => patchCategory({ goalCount: v })} />
                : <NumberStepper value={goalTarget({ goals: plan.goals, goalCount: plan.commonGoalCount })} min={0} max={8} ariaLabel="Common goals" onChange={v => onChange({ ...plan, commonGoalCount: v, edited: true })} />}
            </span>
          </div>
        )}
        {plan.edited && <Alert tone="info" message="Refresh the scope to redraft from your edits. Refresh replaces goals, interventions and barriers added or removed by hand." />}
        {section.explanation && <p className={styles.explanation}>{section.explanation}</p>}
        {category && (
          <span className={styles.matchLine}>
            <Icon name="solar:user-check-linear" size={14} color="currentColor" />
            {category.criteria?.length ? `Patients join by ${describeCriteria(category)}` : 'The care team assigns patients to this category'}
          </span>
        )}
        {view === 'nested' ? <LinkageTree groups={nestedGroups} readOnly /> : <CarePlanSections
          goalRows={goalRows}
          interventionRows={interventionRows}
          barrierRows={barrierRows}
          onAddGoal={editable ? () => setPicker('goals') : undefined}
          onAddIntervention={editable ? () => setPicker('interventions') : undefined}
          onAddBarrier={editable ? () => setPicker('barriers') : undefined}
          onRowMenuGoal={menuFor('goals')}
          onRowMenuIntervention={menuFor('interventions')}
          onRowMenuBarrier={menuFor('barriers')}
        />}
      </div>

      {rowMenu && (
        <MenuPopover
          anchorRect={rowMenu.rect}
          ariaLabel="Row actions"
          width={160}
          items={[{ key: 'remove', icon: 'solar:trash-bin-trash-linear', label: 'Remove', danger: true }]}
          onClose={() => setRowMenu(null)}
          onSelect={() => { remove(rowMenu.list, rowMenu.item); setRowMenu(null); }}
        />
      )}
      {picker === 'goals' && <AddGoalsDrawer primaryLabel={`Add to ${section.name}`} onClose={() => setPicker(null)} onAdd={addGoals} />}
      {picker === 'interventions' && (
        <AddInterventionsDrawer
          primaryLabel={`Add to ${section.name}`}
          onClose={() => setPicker(null)}
          onAdd={(picked) => { setLists({ interventions: appendByTitle(lists.interventions, picked || []) }); setPicker(null); }}
        />
      )}
      {picker === 'barriers' && (
        <AddBarriersDrawer
          primaryLabel={`Add to ${section.name}`}
          existingBarriers={lists.barriers}
          onClose={() => setPicker(null)}
          onAdd={(picked) => { setLists({ barriers: (picked || []).map(b => ({ id: b.id, title: b.title })) }); setPicker(null); }}
        />
      )}
    </div>
  );
}
