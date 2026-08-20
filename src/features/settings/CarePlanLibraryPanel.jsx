import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { WorklistShell } from '../../components/WorklistShell/WorklistShell';
import { Drawer } from '../../components/Drawer/Drawer';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { RingEmptyState } from '../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../store/useAppStore';
import styles from './CarePlanLibraryPanel.module.css';

// Local-only seed data — see the panel's note to the user about persistence.
let nextId = 100;
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const INITIAL_TEMPLATES = [
  {
    id: '1',
    name: 'Type 2 Diabetes — Standard',
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    goals: [
      { id: 'g1', title: 'A1C below 7%', subtitle: 'Reassess quarterly via lab draw' },
      { id: 'g2', title: 'Weight loss of 5%', subtitle: 'Track via monthly weigh-in' },
    ],
    interventions: [
      { id: 'i1', title: 'Nutrition counseling', duration: '30 min' },
      { id: 'i2', title: 'Medication adherence check-in', duration: '15 min' },
    ],
    createdAt: daysAgo(120),
    updatedAt: daysAgo(2),
  },
  {
    id: '2',
    name: 'CHF Post-Discharge',
    conditions: ['Congestive Heart Failure'],
    goals: [
      { id: 'g3', title: 'No readmission within 30 days', subtitle: 'Weekly weight + symptom check' },
    ],
    interventions: [
      { id: 'i3', title: 'Home health nursing visit', duration: '45 min' },
      { id: 'i4', title: 'Medication reconciliation', duration: '20 min' },
    ],
    createdAt: daysAgo(200),
    updatedAt: daysAgo(9),
  },
];

const INITIAL_GOALS = [
  { id: 'goal-1', title: 'A1C below 7%', description: 'Reassess quarterly via lab draw.', updatedAt: daysAgo(3) },
  { id: 'goal-2', title: 'Blood pressure under 130/80', description: 'Home BP log reviewed weekly.', updatedAt: daysAgo(5) },
  { id: 'goal-3', title: 'No readmission within 30 days', description: 'Weekly weight + symptom check-in.', updatedAt: daysAgo(9) },
  { id: 'goal-4', title: 'Improve medication adherence', description: 'Target 90%+ per pharmacy refill data.', updatedAt: daysAgo(14) },
];

const INITIAL_BARRIERS = [
  { id: 'barrier-1', title: 'Transportation', description: 'No reliable way to get to appointments.', updatedAt: daysAgo(4) },
  { id: 'barrier-2', title: 'Health Literacy', description: 'Difficulty understanding care instructions.', updatedAt: daysAgo(6) },
  { id: 'barrier-3', title: 'Financial Constraints', description: 'Cost of medications or copays.', updatedAt: daysAgo(11) },
  { id: 'barrier-4', title: 'Language Barrier', description: 'Needs interpreter for care communication.', updatedAt: daysAgo(20) },
];

const CARE_PLAN_TABS = [
  { key: 'template', label: 'Plan Template' },
  { key: 'goals', label: 'Goals Library' },
  { key: 'barriers', label: 'Barriers Library' },
];

const TAB_META = {
  template: { entityLabel: 'Template', emptyIcon: 'solar:clipboard-list-linear' },
  goals: { entityLabel: 'Goal', emptyIcon: 'solar:flag-linear' },
  barriers: { entityLabel: 'Barrier', emptyIcon: 'solar:shield-warning-linear' },
};

function filterByTitleAndDescription(list, query) {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(x => x.title.toLowerCase().includes(q) || x.description.toLowerCase().includes(q));
}

function formatRelative(iso) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Matches Figma's "MM/DD/YYYY | hh:mm AM/PM" cell format for Created On /
// Last Update columns.
function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} | ${time}`;
}

// Figma 14106:280383 — checkbox, Template Name, Chronic Conditions,
// Created On, Last Update, Actions. Sortable columns get a `sortKey`/
// `sortType` so WorklistShell's HeaderCell renders the sort arrows.
const TEMPLATE_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 44 },
  { key: 'name', label: 'Template Name', sortKey: 'name', sortType: 'alpha', sticky: 'left', left: 0, width: 280 },
  { key: 'conditions', label: 'Chronic Conditions', sortKey: 'conditions', sortType: 'alpha', width: 280 },
  { key: 'createdOn', label: 'Created On', sortKey: 'createdAt', sortType: 'date', width: 200 },
  { key: 'updated', label: 'Last Update', sortKey: 'updatedAt', sortType: 'date', width: 200 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 156 },
];

const SIMPLE_COLUMNS = [
  { key: 'title', label: 'Title', sticky: 'left', left: 0, width: 260 },
  { key: 'description', label: 'Description', width: 360 },
  { key: 'updated', label: 'Last Updated', width: 130 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 100 },
];

function blankTemplateDraft() {
  return { kind: 'template', id: null, name: '', conditionsText: '', goals: [], interventions: [] };
}
function templateDraftFrom(t) {
  return {
    kind: 'template',
    id: t.id,
    name: t.name,
    conditionsText: t.conditions.join(', '),
    goals: t.goals.map(g => ({ ...g })),
    interventions: t.interventions.map(i => ({ ...i })),
  };
}
function blankSimpleDraft(kind) {
  return { kind, id: null, title: '', description: '' };
}
function simpleDraftFrom(kind, item) {
  return { kind, id: item.id, title: item.title, description: item.description };
}

// Kebab "More Action" menu on a template row — Figma only breaks Delete out
// into this overflow menu; Edit/Duplicate get their own always-visible
// ActionButtons.
function TemplateRowMenu({ onDelete }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.right - 160 });
    setOpen(v => !v);
  };

  return (
    <>
      <div ref={btnRef} style={{ display: 'inline-flex' }}>
        <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More Action" onClick={openMenu} />
      </div>
      {open && createPortal(
        <div className={styles.overflowScrim} onClick={() => setOpen(false)}>
          <div className={styles.overflowMenu} style={{ top: pos.top, left: pos.left }} onClick={e => e.stopPropagation()}>
            <button
              className={`${styles.overflowItem} ${styles.overflowItemDanger}`}
              onClick={() => { setOpen(false); onDelete(); }}
            >
              <Icon name="solar:trash-bin-trash-linear" size={15} color="var(--status-error)" />
              Delete
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function CarePlanLibraryPanel() {
  const showToast = useAppStore(s => s.showToast);

  const [activeTab, setActiveTab] = useState('template');
  const [searchValue, setSearchValue] = useState('');
  // Search is per-tab in intent (searching goals shouldn't leave stale text
  // filtering templates when you switch back) — clear it on tab switch
  // itself rather than via an effect.
  const handleTabChange = (key) => { setActiveTab(key); setSearchValue(''); };

  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  const [goals, setGoals] = useState(INITIAL_GOALS);
  const [barriers, setBarriers] = useState(INITIAL_BARRIERS);

  // A single draft/delete-target slot, discriminated by `kind` — only one
  // drawer or confirm dialog is ever open at a time regardless of tab.
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind, id, name }

  const [templateSort, setTemplateSort] = useState({ key: null, dir: 'asc' });
  const handleTemplateSort = (key) => {
    setTemplateSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const filteredTemplates = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    const base = !q ? templates : templates.filter(t =>
      t.name.toLowerCase().includes(q) || t.conditions.some(c => c.toLowerCase().includes(q))
    );
    if (!templateSort.key) return base;
    const dir = templateSort.dir === 'asc' ? 1 : -1;
    const valueOf = (t) => (
      templateSort.key === 'conditions' ? (t.conditions[0] || '') :
      templateSort.key === 'createdAt' ? t.createdAt :
      templateSort.key === 'updatedAt' ? t.updatedAt :
      t.name
    );
    return base.toSorted((a, b) => valueOf(a).localeCompare(valueOf(b)) * dir);
  }, [templates, searchValue, templateSort]);

  const filteredGoals = useMemo(() => filterByTitleAndDescription(goals, searchValue), [goals, searchValue]);
  const filteredBarriers = useMemo(() => filterByTitleAndDescription(barriers, searchValue), [barriers, searchValue]);

  const closeDrawer = () => setDraft(null);

  const openCreate = () => {
    if (activeTab === 'template') setDraft(blankTemplateDraft());
    else setDraft(blankSimpleDraft(activeTab === 'goals' ? 'goal' : 'barrier'));
  };

  const openEditTemplate = (t) => setDraft(templateDraftFrom(t));
  const openEditSimple = (kind, item) => setDraft(simpleDraftFrom(kind, item));

  const canSave = draft && (draft.kind === 'template' ? draft.name.trim().length > 0 : draft.title.trim().length > 0);

  const saveDraft = () => {
    if (!canSave) return;
    if (draft.kind === 'template') {
      const conditions = draft.conditionsText.split(',').map(c => c.trim()).filter(Boolean);
      if (draft.id) {
        setTemplates(prev => prev.map(t => (t.id === draft.id
          ? { ...t, name: draft.name.trim(), conditions, goals: draft.goals, interventions: draft.interventions, updatedAt: new Date().toISOString() }
          : t)));
        showToast(`"${draft.name.trim()}" updated`);
      } else {
        const id = String(nextId++);
        const now = new Date().toISOString();
        setTemplates(prev => [...prev, {
          id, name: draft.name.trim(), conditions, goals: draft.goals, interventions: draft.interventions,
          createdAt: now, updatedAt: now,
        }]);
        showToast(`"${draft.name.trim()}" created`);
      }
    } else {
      const setList = draft.kind === 'goal' ? setGoals : setBarriers;
      if (draft.id) {
        setList(prev => prev.map(x => (x.id === draft.id
          ? { ...x, title: draft.title.trim(), description: draft.description.trim(), updatedAt: new Date().toISOString() }
          : x)));
        showToast(`"${draft.title.trim()}" updated`);
      } else {
        const id = `${draft.kind}-${nextId++}`;
        setList(prev => [...prev, {
          id, title: draft.title.trim(), description: draft.description.trim(), updatedAt: new Date().toISOString(),
        }]);
        showToast(`"${draft.title.trim()}" created`);
      }
    }
    closeDrawer();
  };

  const confirmDelete = () => {
    const { kind, id, name } = deleteTarget;
    if (kind === 'template') setTemplates(prev => prev.filter(t => t.id !== id));
    else if (kind === 'goal') setGoals(prev => prev.filter(x => x.id !== id));
    else setBarriers(prev => prev.filter(x => x.id !== id));
    showToast(`"${name}" deleted`);
    setDeleteTarget(null);
  };

  const duplicateTemplate = (t) => {
    const now = new Date().toISOString();
    const id = String(nextId++);
    setTemplates(prev => [...prev, {
      ...t,
      id,
      name: `${t.name} (Copy)`,
      goals: t.goals.map(g => ({ ...g })),
      interventions: t.interventions.map(i => ({ ...i })),
      createdAt: now,
      updatedAt: now,
    }]);
    showToast(`"${t.name}" duplicated`);
  };

  const addGoalRow = () => setDraft(d => ({ ...d, goals: [...d.goals, { id: `g-${Date.now()}`, title: '', subtitle: '' }] }));
  const updateGoalRow = (id, patch) => setDraft(d => ({ ...d, goals: d.goals.map(g => (g.id === id ? { ...g, ...patch } : g)) }));
  const removeGoalRow = (id) => setDraft(d => ({ ...d, goals: d.goals.filter(g => g.id !== id) }));

  const addInterventionRow = () => setDraft(d => ({ ...d, interventions: [...d.interventions, { id: `i-${Date.now()}`, title: '', duration: '' }] }));
  const updateInterventionRow = (id, patch) => setDraft(d => ({ ...d, interventions: d.interventions.map(i => (i.id === id ? { ...i, ...patch } : i)) }));
  const removeInterventionRow = (id) => setDraft(d => ({ ...d, interventions: d.interventions.filter(i => i.id !== id) }));

  const renderTemplateRow = (t) => (
    <tr key={t.id} className={styles.row}>
      <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
        <Checkbox aria-label={`Select ${t.name}`} />
      </td>
      <td className={styles.tdName}>
        <button type="button" className={styles.nameLink} onClick={() => openEditTemplate(t)}>{t.name}</button>
      </td>
      <td className={styles.tdConditions}>
        <div className={styles.chipRow}>
          {t.conditions.map(c => <Badge key={c} tone="grey" size="S" label={c} />)}
        </div>
      </td>
      <td className={styles.tdUpdated}>{formatDateTime(t.createdAt)}</td>
      <td className={styles.tdUpdated}>{formatDateTime(t.updatedAt)}</td>
      <td className={styles.tdActions} onClick={e => e.stopPropagation()}>
        <div className={styles.actionCell}>
          <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit" onClick={() => openEditTemplate(t)} />
          <div className={styles.vDivider} />
          <ActionButton icon="solar:copy-linear" size="S" tooltip="Duplicate" onClick={() => duplicateTemplate(t)} />
          <div className={styles.vDivider} />
          <TemplateRowMenu onDelete={() => setDeleteTarget({ kind: 'template', id: t.id, name: t.name })} />
        </div>
      </td>
    </tr>
  );

  const renderSimpleRow = (kind) => (item) => (
    <tr key={item.id} className={styles.row}>
      <td className={styles.tdName}>
        <button type="button" className={styles.nameLink} onClick={() => openEditSimple(kind, item)}>{item.title}</button>
      </td>
      <td className={styles.tdDescription}>{item.description || '—'}</td>
      <td className={styles.tdUpdated}>{formatRelative(item.updatedAt)}</td>
      <td className={styles.tdActions} onClick={e => e.stopPropagation()}>
        <div className={styles.actionCell}>
          <ActionButton icon="solar:pen-linear" size="S" tooltip="Edit" onClick={() => openEditSimple(kind, item)} />
          <div className={styles.vDivider} />
          <ActionButton icon="solar:trash-bin-trash-linear" size="S" tooltip="Delete" onClick={() => setDeleteTarget({ kind, id: item.id, name: item.title })} />
        </div>
      </td>
    </tr>
  );

  const meta = TAB_META[activeTab];
  const primaryActionLabel = `New ${meta.entityLabel}`;

  return (
    <div className={styles.wrapper}>
      <SectionTitleBar
        tabs={CARE_PLAN_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        actions={['search']}
        searchPlaceholder={`Search ${meta.entityLabel.toLowerCase()}s…`}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        primaryActionLabel={primaryActionLabel}
        onPrimaryAction={openCreate}
      />

      <div className={styles.content}>
        {activeTab === 'template' && (
          <WorklistShell
            header={null}
            columns={TEMPLATE_COLUMNS}
            rows={filteredTemplates}
            renderRow={renderTemplateRow}
            sortKey={templateSort.key}
            sortDir={templateSort.dir}
            onSort={handleTemplateSort}
            emptyState={
              templates.length === 0 ? (
                <RingEmptyState icon="solar:clipboard-add-linear" label="No Care Plan Templates Added" />
              ) : (
                <div className={styles.emptyState}>
                  <Icon name={meta.emptyIcon} size={32} color="var(--neutral-150)" />
                  <p>No templates match "<strong>{searchValue.trim()}</strong>".</p>
                </div>
              )
            }
            minTableWidth={1100}
          />
        )}
        {activeTab === 'goals' && (
          <WorklistShell
            header={null}
            columns={SIMPLE_COLUMNS}
            rows={filteredGoals}
            renderRow={renderSimpleRow('goal')}
            emptyState={
              <div className={styles.emptyState}>
                <Icon name={meta.emptyIcon} size={32} color="var(--neutral-150)" />
                <p>
                  {searchValue.trim()
                    ? <>No goals match "<strong>{searchValue.trim()}</strong>".</>
                    : 'No goals yet. Click "New Goal" to add one.'}
                </p>
              </div>
            }
            minTableWidth={900}
          />
        )}
        {activeTab === 'barriers' && (
          <WorklistShell
            header={null}
            columns={SIMPLE_COLUMNS}
            rows={filteredBarriers}
            renderRow={renderSimpleRow('barrier')}
            emptyState={
              <div className={styles.emptyState}>
                <Icon name={meta.emptyIcon} size={32} color="var(--neutral-150)" />
                <p>
                  {searchValue.trim()
                    ? <>No barriers match "<strong>{searchValue.trim()}</strong>".</>
                    : 'No barriers yet. Click "New Barrier" to add one.'}
                </p>
              </div>
            }
            minTableWidth={900}
          />
        )}
      </div>

      {draft && draft.kind === 'template' && (
        <Drawer
          title={draft.id ? 'Edit Care Plan Template' : 'New Care Plan Template'}
          onClose={closeDrawer}
          secondaryAction={<Button variant="secondary" size="L" onClick={closeDrawer}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={saveDraft} disabled={!canSave}>Save</Button>}
        >
          <div className={styles.formField}>
            <span className={styles.formLabel}>Template Name <span className={styles.required}>•</span></span>
            <Input
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Type 2 Diabetes — Standard"
            />
          </div>

          <div className={styles.formField}>
            <span className={styles.formLabel}>Conditions</span>
            <Input
              value={draft.conditionsText}
              onChange={e => setDraft(d => ({ ...d, conditionsText: e.target.value }))}
              placeholder="Comma-separated, e.g. Type 2 Diabetes, Hypertension"
            />
          </div>

          <div className={styles.formSection}>
            <div className={styles.formSectionHeader}>
              <span className={styles.formLabel}>Goals</span>
              <button type="button" className={styles.addRowLink} onClick={addGoalRow}>
                <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
                Add Goal
              </button>
            </div>
            {draft.goals.map(g => (
              <div key={g.id} className={styles.listRow}>
                <Input
                  value={g.title}
                  onChange={e => updateGoalRow(g.id, { title: e.target.value })}
                  placeholder="Goal title"
                  wrapperClassName={styles.listRowTitle}
                />
                <Input
                  value={g.subtitle}
                  onChange={e => updateGoalRow(g.id, { subtitle: e.target.value })}
                  placeholder="Detail (optional)"
                  wrapperClassName={styles.listRowSubtitle}
                />
                <ActionButton icon="solar:trash-bin-trash-linear" size="S" tooltip="Remove goal" onClick={() => removeGoalRow(g.id)} />
              </div>
            ))}
            {draft.goals.length === 0 && <div className={styles.listEmpty}>No goals added yet.</div>}
          </div>

          <div className={styles.formSection}>
            <div className={styles.formSectionHeader}>
              <span className={styles.formLabel}>Interventions</span>
              <button type="button" className={styles.addRowLink} onClick={addInterventionRow}>
                <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
                Add Intervention
              </button>
            </div>
            {draft.interventions.map(i => (
              <div key={i.id} className={styles.listRow}>
                <Input
                  value={i.title}
                  onChange={e => updateInterventionRow(i.id, { title: e.target.value })}
                  placeholder="Intervention title"
                  wrapperClassName={styles.listRowTitle}
                />
                <Input
                  value={i.duration}
                  onChange={e => updateInterventionRow(i.id, { duration: e.target.value })}
                  placeholder="Duration (e.g. 30 min)"
                  wrapperClassName={styles.listRowDuration}
                />
                <ActionButton icon="solar:trash-bin-trash-linear" size="S" tooltip="Remove intervention" onClick={() => removeInterventionRow(i.id)} />
              </div>
            ))}
            {draft.interventions.length === 0 && <div className={styles.listEmpty}>No interventions added yet.</div>}
          </div>
        </Drawer>
      )}

      {draft && draft.kind !== 'template' && (
        <Drawer
          title={draft.id ? `Edit ${draft.kind === 'goal' ? 'Goal' : 'Barrier'}` : `New ${draft.kind === 'goal' ? 'Goal' : 'Barrier'}`}
          onClose={closeDrawer}
          secondaryAction={<Button variant="secondary" size="L" onClick={closeDrawer}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={saveDraft} disabled={!canSave}>Save</Button>}
        >
          <div className={styles.formField}>
            <span className={styles.formLabel}>Title <span className={styles.required}>•</span></span>
            <Input
              value={draft.title}
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
              placeholder={draft.kind === 'goal' ? 'e.g. A1C below 7%' : 'e.g. Transportation'}
            />
          </div>
          <div className={styles.formField}>
            <span className={styles.formLabel}>Description</span>
            <Textarea
              value={draft.description}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Short description"
            />
          </div>
        </Drawer>
      )}

      {deleteTarget && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Delete "${deleteTarget.name}"?`}
          description={`This will remove the ${deleteTarget.kind} from the library. This action cannot be undone.`}
          confirmLabel="Delete"
          variant="error"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
