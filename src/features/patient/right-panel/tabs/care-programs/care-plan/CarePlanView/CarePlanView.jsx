import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../../components/Icon/AddIconMinimalist';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../../../../components/Avatar/Avatar';
import { AssigneeChange } from '../../../../../../../components/AssigneeChange/AssigneeChange';
import { Button } from '../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../../components/Textarea/Textarea';
import { Drawer } from '../../../../../../../components/Drawer/Drawer';
import { MenuPopover } from '../../../../../../../components/MenuPopover/MenuPopover';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { ConfirmDialog } from '../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { Select } from '../../../../../../../components/Select/Select';
import { FilterChip } from '../../../../../../../components/FilterChip/FilterChip';
import { Checkbox } from '../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { CreateGoalDrawer } from '../../../../../../settings/care-plan-library/goals/CreateGoalDrawer/CreateGoalDrawer';
import { CARE_PLAN_MOCK } from '../../../../../data/carePlanMock';
import { AddInterventionDrawer } from '../drawers/AddInterventionDrawer/AddInterventionDrawer';
import { CarePlanShareDrawer } from '../drawers/CarePlanShareDrawer/CarePlanShareDrawer';
import { CarePlanHistoryDrawer } from '../drawers/CarePlanHistoryDrawer/CarePlanHistoryDrawer';
import { CarePlanVersionsDrawer } from '../drawers/CarePlanVersionsDrawer/CarePlanVersionsDrawer';
import styles from './CarePlanView.module.css';

// The statuses a goal or intervention can move through. Kept flat and shared so
// the pill menu and the intervention drawer offer the same vocabulary.
const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];
const PRIORITIES = ['high', 'medium', 'low'];
// Capitalized labels for the priority filter chip (values compare case-insensitively).
const PRIORITY_LABELS = ['High', 'Medium', 'Low'];

function LinkChip({ count }) {
  return (
    <span className={`${styles.linkChip} ${count ? '' : styles.linkChipEmpty}`}>
      <Icon name="solar:link-linear" size={14} color="var(--neutral-300)" />
      {count > 0 && <span className={styles.linkCount}>{count}</span>}
    </span>
  );
}

function StatusPill({ value, onOpen, disabled }) {
  return (
    <button type="button" className={styles.statusPill} disabled={disabled}
      onClick={(e) => onOpen?.(e.currentTarget.getBoundingClientRect())}>
      {value}
      {!disabled && <Icon name="solar:alt-arrow-down-linear" size={14} color="var(--neutral-300)" />}
    </button>
  );
}

function ProgressRing() {
  return <span className={styles.progressRing}>-</span>;
}

// Title that swaps to an input on click (roadmap #31). Read-only rows (the mock
// fallback) render a plain span.
function EditableTitle({ title, subtitle, editable, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  const commit = () => {
    setEditing(false);
    const next = value.trim();
    if (next && next !== title) onCommit(next);
    else setValue(title);
  };

  if (editing) {
    return (
      <span className={styles.titleText}>
        <Input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(title); setEditing(false); } }}
          aria-label="Edit title"
          className={styles.titleEditInput}
        />
      </span>
    );
  }

  return (
    <span className={styles.titleText}>
      <button
        type="button"
        className={`${styles.title} ${editable ? styles.titleEditable : ''}`}
        onClick={editable ? () => { setValue(title); setEditing(true); } : undefined}
        disabled={!editable}
        title={editable ? 'Click to rename' : undefined}
      >
        {title}
      </button>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </span>
  );
}

export function CarePlanView({ patientId, program }) {
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);
  const savePatientCarePlanGoal = useAppStore(s => s.savePatientCarePlanGoal);
  const deletePatientCarePlanGoal = useAppStore(s => s.deletePatientCarePlanGoal);
  const savePatientCarePlanIntervention = useAppStore(s => s.savePatientCarePlanIntervention);
  const deletePatientCarePlanIntervention = useAppStore(s => s.deletePatientCarePlanIntervention);
  const savePatientCarePlanBarrier = useAppStore(s => s.savePatientCarePlanBarrier);
  const deletePatientCarePlanBarrier = useAppStore(s => s.deletePatientCarePlanBarrier);
  const savePatientCarePlanAsTemplate = useAppStore(s => s.savePatientCarePlanAsTemplate);
  const signCarePlan = useAppStore(s => s.signCarePlan);
  const addCarePlanNote = useAppStore(s => s.addCarePlanNote);
  const showToast = useAppStore(s => s.showToast);
  const patientName = useAppStore(s => s.patients.find(p => p.id === patientId)?.name);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  const carePlanShareRequest = useAppStore(s => s.carePlanShareRequest);
  const requestCarePlanShare = useAppStore(s => s.requestCarePlanShare);
  const clearCarePlanShareRequest = useAppStore(s => s.clearCarePlanShareRequest);

  const key = patientId && program ? `${patientId}::${program.id}` : null;
  const live = useAppStore(s => (key ? s.patientCarePlans[key] : null));

  useEffect(() => {
    if (patientId && program?.id) fetchPatientCarePlan(patientId, program.id);
  }, [patientId, program?.id, fetchPatientCarePlan]);

  // A share request that was never opened/closed (e.g. the program was closed
  // with the flag still set) must not linger and auto-open the drawer next time.
  useEffect(() => () => clearCarePlanShareRequest(), [clearCarePlanShareRequest]);

  // A saved plan is data-backed and editable; with none we show the mock as a
  // read-only preview. The first Add creates the real plan and edits take over.
  const usingMock = !live;
  const data = useMemo(() => (live ? {
    conditions: live.plan.conditions,
    conditionTotal: live.plan.conditionTotal,
    goals: live.goals,
    interventions: live.interventions,
    barriers: live.barriers || [],
  } : { ...CARE_PLAN_MOCK, barriers: CARE_PLAN_MOCK.barriers || [] }), [live]);

  const [conditionsOpen, setConditionsOpen] = useState(true);
  const [conditionsViewOpen, setConditionsViewOpen] = useState(false);
  const [statusMenu, setStatusMenu] = useState(null); // { kind, item, rect }
  const [priorityMenu, setPriorityMenu] = useState(null); // { kind, item, rect }
  const [goalDrawerOpen, setGoalDrawerOpen] = useState(false);
  const [intvDrawer, setIntvDrawer] = useState(null);  // false | { intervention }
  const [barrierDrawer, setBarrierDrawer] = useState(null); // null | { barrier }
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind, id, name }
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [signNote, setSignNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  // Role/status/priority filter (#39). Goals & barriers have no assignee, so the
  // assignee filter narrows only interventions; status/priority apply to all.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ status: [], priority: [], assignee: [] });

  const canEdit = !usingMock;

  const setFilter = (key, vals) => setFilters(f => ({ ...f, [key]: vals }));
  const clearFilters = () => setFilters({ status: [], priority: [], assignee: [] });
  const filtersActive = filters.status.length || filters.priority.length || filters.assignee.length;

  const assigneeOptions = useMemo(
    () => [...new Set((data.interventions || []).map(i => i.assignee?.name).filter(Boolean))],
    [data.interventions],
  );
  const matchesSP = (item) =>
    (!filters.status.length || filters.status.includes(item.status)) &&
    (!filters.priority.length || filters.priority.map(p => p.toLowerCase()).includes((item.priority || '').toLowerCase()));
  const filteredGoals = useMemo(() => data.goals.filter(matchesSP), [data.goals, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredBarriers = useMemo(() => (data.barriers || []).filter(matchesSP), [data.barriers, filters]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredInterventions = useMemo(
    () => data.interventions.filter(i => matchesSP(i) && (!filters.assignee.length || filters.assignee.includes(i.assignee?.name))),
    [data.interventions, filters], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const signedBy = live?.plan?.signedBy;
  const signedAt = live?.plan?.signedAt;

  // Bulk selection (#7). Selection is per section, over the visible (filtered)
  // rows; a bulk status change loops the normal save path so each write audits.
  const [selected, setSelected] = useState({ goal: new Set(), intv: new Set(), barrier: new Set() });
  const [bulkMenu, setBulkMenu] = useState(null); // { rect }
  const selectedCount = selected.goal.size + selected.intv.size + selected.barrier.size;
  const toggleSelect = (kind, id) => setSelected(prev => {
    const next = new Set(prev[kind]);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { ...prev, [kind]: next };
  });
  const toggleSelectAll = (kind, rows) => setSelected(prev => {
    const ids = rows.map(r => r.id);
    const allOn = ids.length > 0 && ids.every(id => prev[kind].has(id));
    return { ...prev, [kind]: allOn ? new Set() : new Set(ids) };
  });
  const allSelected = (kind, rows) => rows.length > 0 && rows.every(r => selected[kind].has(r.id));
  const clearSelection = () => setSelected({ goal: new Set(), intv: new Set(), barrier: new Set() });

  const bulkSetStatus = async (status) => {
    setBulkMenu(null);
    const g = filteredGoals.filter(x => selected.goal.has(x.id));
    const iv = filteredInterventions.filter(x => selected.intv.has(x.id));
    const br = filteredBarriers.filter(x => selected.barrier.has(x.id));
    for (const x of g) await savePatientCarePlanGoal(patientId, program, { ...x, status }, x.id);
    for (const x of iv) await savePatientCarePlanIntervention(patientId, program, { ...x, status }, x.id);
    for (const x of br) await savePatientCarePlanBarrier(patientId, program, { ...x, status }, x.id);
    const n = g.length + iv.length + br.length;
    clearSelection();
    if (n) showToast(`Updated ${n} item${n === 1 ? '' : 's'} to "${status}"`);
  };

  const doSign = async () => {
    setSignOpen(false);
    const v = await signCarePlan(patientId, program, signNote.trim());
    setSignNote('');
    if (v) showToast('Care plan signed');
  };
  const doAddNote = async () => {
    setNoteOpen(false);
    await addCarePlanNote(patientId, program, noteText);
    setNoteText('');
  };
  // The drawer is driven entirely by the store flag — the toolbar button and
  // the step header (a separate component) both set it, and closing clears it.
  // A mock plan can still be previewed/downloaded; only Share (which persists
  // real ids) is gated to a saved plan.
  const shareOpen = !!carePlanShareRequest;

  const changeStatus = (status) => {
    const { kind, item } = statusMenu;
    setStatusMenu(null);
    if (kind === 'goal') savePatientCarePlanGoal(patientId, program, { ...item, status }, item.id);
    else if (kind === 'barrier') savePatientCarePlanBarrier(patientId, program, { ...item, status }, item.id);
    else savePatientCarePlanIntervention(patientId, program, { ...item, status }, item.id);
  };

  const changePriority = (priority) => {
    const { kind, item } = priorityMenu;
    setPriorityMenu(null);
    if (kind === 'goal') savePatientCarePlanGoal(patientId, program, { ...item, priority }, item.id);
    else if (kind === 'barrier') savePatientCarePlanBarrier(patientId, program, { ...item, priority }, item.id);
    else savePatientCarePlanIntervention(patientId, program, { ...item, priority }, item.id);
  };

  const renameGoal = (goal, title) => savePatientCarePlanGoal(patientId, program, { ...goal, title }, goal.id);
  const renameIntervention = (intv, title) => savePatientCarePlanIntervention(patientId, program, { ...intv, title }, intv.id);
  const renameBarrier = (barrier, title) => savePatientCarePlanBarrier(patientId, program, { ...barrier, title }, barrier.id);

  const handleAddGoal = async (values) => {
    setGoalDrawerOpen(false);
    const goal = await savePatientCarePlanGoal(patientId, program, {
      ...values,
      icon: 'solar:flag-linear',
      status: 'Not Started',
    });
    if (!goal) return;
    // Persist any interventions the goal drawer collected, linked to the goal.
    for (const it of (values.interventions || [])) {
      await savePatientCarePlanIntervention(patientId, program, {
        kind: it.kind, title: it.title, config: it.config, goalId: goal.id, status: 'Not Started',
      });
    }
    showToast(`"${goal.title}" added`);
  };

  const handleAddIntervention = async (values) => {
    const editingId = intvDrawer?.intervention?.id || null;
    setIntvDrawer(false);
    const saved = await savePatientCarePlanIntervention(patientId, program, values, editingId);
    if (saved) showToast(`"${saved.title}" ${editingId ? 'updated' : 'added'}`);
  };

  const handleAddBarrier = async (values) => {
    const editingId = barrierDrawer?.barrier?.id || null;
    setBarrierDrawer(null);
    const saved = await savePatientCarePlanBarrier(patientId, program, values, editingId);
    if (saved) showToast(`"${saved.title}" ${editingId ? 'updated' : 'added'}`);
  };

  const confirmDelete = () => {
    const { kind, id, name } = deleteTarget;
    if (kind === 'goal') deletePatientCarePlanGoal(patientId, program.id, id);
    else if (kind === 'barrier') deletePatientCarePlanBarrier(patientId, program.id, id);
    else deletePatientCarePlanIntervention(patientId, program.id, id);
    setDeleteTarget(null);
    showToast(`"${name}" removed`);
  };

  // Condition chip interactions — View All, remove, New Problems. All persist via
  // the plan header row (conditions array) so they survive reload.
  const handleRemoveCondition = async (label) => {
    if (!canEdit || !live?.plan) return;
    const next = (live.plan.conditions || []).filter(c => c.label !== label);
    const { error } = await import('../../../../../../../lib/supabase').then(m => m.supabase.from('patient_care_plans').update({ conditions: next.map(c => c.label), condition_total: live.plan.conditionTotal, updated_at: new Date().toISOString() }).eq('id', live.plan.id).select().single());
    if (!error) {
      const { fetchPatientCarePlan } = useAppStore.getState();
      fetchPatientCarePlan(patientId, program.id);
      showToast(`Removed "${label}"`);
    } else {
      showToast('Could not remove condition');
    }
  };

  const handleViewAllConditions = () => setConditionsViewOpen(true);
  const handleNewProblems = () => showToast('New Problems — coming soon');
  const handleTrends = () => showToast('Trends — coming soon');
  const handleLinkChip = (count, title) => showToast(count ? `"${title}" has ${count} links — manage in detail view` : 'No links yet');
  const handleAssigneeChange = (intervention, user) => {
    if (!canEdit) return;
    savePatientCarePlanIntervention(patientId, program, { ...intervention, assignee: { name: user.name, initials: user.initials } }, intervention.id);
    showToast(`Assigned to ${user.name}`);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return;
    const saved = await savePatientCarePlanAsTemplate(patientId, program, templateName);
    setTemplateOpen(false);
    setTemplateName('');
    if (saved) showToast(`Saved as template "${saved.name}"`);
  };

  const rowMenuItems = () => [
    { key: 'rename', icon: 'solar:pen-linear', label: 'Rename', disabled: !canEdit },
    { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Remove', danger: true, disabled: !canEdit },
  ];

  return (
    <div className={styles.container}>
      {/* Condition chips */}
      <div className={styles.conditionRow}>
        <button type="button" className={styles.collapseBtn} onClick={() => setConditionsOpen(o => !o)} aria-label="Toggle conditions">
          <Icon name={conditionsOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={16} color="var(--secondary-300)" />
        </button>
        {conditionsOpen && (
          <div className={styles.chips}>
            {data.conditions.map(c => (
              <span key={c.label} className={`${styles.chip} ${c.primary ? styles.chipPrimary : ''}`}>
                {c.label}
                {c.removable ? (
                  <button type="button" className={styles.chipRemove} onClick={() => handleRemoveCondition(c.label)} aria-label={`Remove ${c.label}`} disabled={!canEdit}>
                    <Icon name="solar:close-circle-linear" size={14} color="var(--neutral-300)" />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        )}
        <button type="button" className={styles.viewAll} onClick={handleViewAllConditions}>View All ({data.conditionTotal})</button>
      </div>

      <div className={styles.toolbarRow}>
        <button type="button" className={styles.newProblems} onClick={handleNewProblems}>
          <Icon name="solar:magic-stick-3-linear" size={16} color="var(--primary-300)" />
          New Problems identified in HRA
        </button>
        <div className={styles.toolbarActions}>
          <ActionButton
            icon="solar:filter-linear"
            size="S"
            tooltip="Filter"
            active={filtersOpen || !!filtersActive}
            iconColor={filtersActive ? 'var(--primary-300)' : undefined}
            onClick={() => setFiltersOpen(o => !o)}
          />
          <Button
            variant="secondary"
            size="M"
            leadingIcon="solar:layers-minimalistic-linear"
            onClick={() => setVersionsOpen(true)}
          >
            Versions
          </Button>
          {!usingMock && (signedBy ? (
            <Button variant="secondary" size="M" leadingIcon="solar:notes-linear" onClick={() => { setNoteText(''); setNoteOpen(true); }}>
              Add Note
            </Button>
          ) : (
            <Button variant="secondary" size="M" leadingIcon="solar:pen-2-linear" onClick={() => { setSignNote(''); setSignOpen(true); }}>
              Sign
            </Button>
          ))}
          <Button
            variant="secondary"
            size="M"
            leadingIconElement={<Icon name="custom:history" size={16} color="var(--neutral-400)" />}
            onClick={() => setHistoryOpen(true)}
          >
            History
          </Button>
          <Button
            variant="secondary"
            size="M"
            leadingIcon="solar:eye-linear"
            onClick={() => requestCarePlanShare('preview')}
          >
            Preview &amp; Share
          </Button>
          <Button
            variant="secondary"
            size="M"
            leadingIcon="solar:bookmark-linear"
            disabled={usingMock}
            onClick={() => { setTemplateName(''); setTemplateOpen(true); }}
          >
            Save as Template
          </Button>
        </div>
      </div>

      {signedBy && (
        <div className={styles.signedBanner}>
          <Icon name="solar:check-circle-bold" size={16} color="var(--status-success)" />
          Signed by {signedBy}{signedAt ? ` on ${new Date(signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
        </div>
      )}

      {filtersOpen && (
        <div className={styles.filterBar}>
          <FilterChip label="Status" options={GBI_STATUSES} selected={filters.status} onChange={v => setFilter('status', v)} />
          <FilterChip label="Priority" options={PRIORITY_LABELS} selected={filters.priority} onChange={v => setFilter('priority', v)} />
          <FilterChip label="Assignee" searchable options={assigneeOptions} selected={filters.assignee} onChange={v => setFilter('assignee', v)} />
          {filtersActive ? (
            <button type="button" className={styles.clearAll} onClick={clearFilters}>
              <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
              Clear All
            </button>
          ) : null}
        </div>
      )}

      {selectedCount > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedCount} selected</span>
          <div className={styles.bulkActions}>
            <Button variant="secondary" size="S" leadingIcon="solar:checklist-minimalistic-linear"
              onClick={(e) => setBulkMenu({ rect: e.currentTarget.getBoundingClientRect() })}>
              Set status
            </Button>
            <button type="button" className={styles.bulkClear} onClick={clearSelection}>Clear</button>
          </div>
        </div>
      )}

      {/* Goals */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Goals</span>
          <div className={styles.sectionActions}>
            <button type="button" className={styles.trendsBtn} onClick={handleTrends}>
              <Icon name="solar:chart-2-linear" size={16} color="var(--neutral-300)" />
              Trends
            </button>
            <ActionButton size="S" tooltip="Add goal" onClick={() => setGoalDrawerOpen(true)}><AddIconMinimalist size={16} color="var(--neutral-300)" /></ActionButton>
          </div>
        </div>
        <div className={styles.table}>
          <div className={styles.goalHead}>
            <span className={styles.selectCell}><Checkbox checked={allSelected('goal', filteredGoals)} onCheckedChange={() => toggleSelectAll('goal', filteredGoals)} aria-label="Select all goals" disabled={!canEdit} /></span>
            <span className={styles.pCell}>P</span>
            <span className={styles.titleCell}>Goal Title</span>
            <span className={styles.valueCell}>Current Value</span>
            <span className={styles.trendCell}>Trend</span>
            <span className={styles.progressCell}>Progress</span>
            <span className={styles.statusCell}>Status</span>
            <span className={styles.rowMenuCell} />
          </div>
          {filteredGoals.length === 0 && <div className={styles.emptyRow}>{data.goals.length ? 'No goals match the filters.' : 'No goals yet. Add one to get started.'}</div>}
          {filteredGoals.map(g => (
            <div key={g.id} className={styles.goalRow}>
              <span className={styles.selectCell} onClick={e => e.stopPropagation()}><Checkbox checked={selected.goal.has(g.id)} onCheckedChange={() => toggleSelect('goal', g.id)} aria-label={`Select ${g.title}`} disabled={!canEdit} /></span>
              <span className={styles.pCell}>
                <button type="button" className={styles.priorityBtn} onClick={(e) => canEdit && setPriorityMenu({ kind: 'goal', item: g, rect: e.currentTarget.getBoundingClientRect() })} disabled={!canEdit} aria-label="Change priority">
                  <PriorityIcon priority={g.priority} size={16} />
                </button>
              </span>
              <span className={styles.titleCell}>
                <span className={styles.rowIcon}><Icon name={g.icon} size={16} color="var(--neutral-400)" /></span>
                <EditableTitle title={g.title} subtitle={g.subtitle} editable={canEdit} onCommit={t => renameGoal(g, t)} />
                <span onClick={() => handleLinkChip(g.links, g.title)} style={{ cursor: 'pointer' }}><LinkChip count={g.links} /></span>
              </span>
              <span className={`${styles.valueCell} ${g.currentValue === 'No Data' ? styles.muted : ''}`}>{g.currentValue || ''}</span>
              <span className={styles.trendCell}>{g.trend}</span>
              <span className={styles.progressCell}><ProgressRing /></span>
              <span className={styles.statusCell}>
                <StatusPill value={g.status} disabled={!canEdit} onOpen={rect => setStatusMenu({ kind: 'goal', item: g, rect })} />
              </span>
              <span className={styles.rowMenuCell}>
                <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" disabled={!canEdit}
                  onClick={(e) => setStatusMenu({ kind: 'goal-menu', item: g, rect: e.currentTarget.getBoundingClientRect() })} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Interventions */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Interventions</span>
          <div className={styles.sectionActions}>
            <ActionButton size="S" tooltip="Add intervention" onClick={() => setIntvDrawer({ intervention: null })}><AddIconMinimalist size={16} color="var(--neutral-300)" /></ActionButton>
          </div>
        </div>
        <div className={styles.table}>
          <div className={styles.intvHead}>
            <span className={styles.selectCell}><Checkbox checked={allSelected('intv', filteredInterventions)} onCheckedChange={() => toggleSelectAll('intv', filteredInterventions)} aria-label="Select all interventions" disabled={!canEdit} /></span>
            <span className={styles.pCell}>P</span>
            <span className={styles.titleCell}>Name</span>
            <span className={styles.assigneeCell}>Assigned To</span>
            <span className={styles.adherenceCell}>Adherence</span>
            <span className={styles.statusCell}>Status</span>
            <span className={styles.rowMenuCell} />
          </div>
          {filteredInterventions.length === 0 && <div className={styles.emptyRow}>{data.interventions.length ? 'No interventions match the filters.' : 'No interventions yet.'}</div>}
          {filteredInterventions.map(i => (
            <div key={i.id} className={styles.intvRow}>
              <span className={styles.selectCell} onClick={e => e.stopPropagation()}><Checkbox checked={selected.intv.has(i.id)} onCheckedChange={() => toggleSelect('intv', i.id)} aria-label={`Select ${i.title}`} disabled={!canEdit} /></span>
              <span className={styles.pCell}>
                <button type="button" className={styles.priorityBtn} onClick={(e) => canEdit && setPriorityMenu({ kind: 'intv', item: i, rect: e.currentTarget.getBoundingClientRect() })} disabled={!canEdit} aria-label="Change priority">
                  <PriorityIcon priority={i.priority} size={16} />
                </button>
              </span>
              <span className={styles.titleCell}>
                <span className={styles.rowIcon}><Icon name={i.icon} size={16} color="var(--neutral-400)" /></span>
                <EditableTitle title={i.title} editable={canEdit} onCommit={t => renameIntervention(i, t)} />
                {i.duration && (
                  <span className={styles.durationChip}>
                    <Icon name="solar:clock-circle-linear" size={12} color="var(--neutral-300)" />
                    {i.duration}
                    <Icon name="solar:refresh-linear" size={12} color="var(--neutral-300)" />
                  </span>
                )}
                <span onClick={() => handleLinkChip(i.links, i.title)} style={{ cursor: 'pointer' }}><LinkChip count={i.links} /></span>
              </span>
              <span className={styles.assigneeCell} onClick={e => e.stopPropagation()}>
                <AssigneeChange
                  size="S"
                  name={i.assignee.name}
                  initials={i.assignee.initials}
                  showRole={false}
                  unassigned={i.assignee.name === 'Unassigned'}
                  unassignedLabel="Unassigned"
                  users={platformUsers}
                  pickerTitle="Change assignee"
                  onSelect={(u) => handleAssigneeChange(i, u)}
                  disabled={!canEdit}
                />
              </span>
              <span className={styles.adherenceCell}><ProgressRing /></span>
              <span className={styles.statusCell}>
                <StatusPill value={i.status} disabled={!canEdit} onOpen={rect => setStatusMenu({ kind: 'intv', item: i, rect })} />
              </span>
              <span className={styles.rowMenuCell}>
                <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" disabled={!canEdit}
                  onClick={(e) => setStatusMenu({ kind: 'intv-menu', item: i, rect: e.currentTarget.getBoundingClientRect() })} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Barriers */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Barriers</span>
          <div className={styles.sectionActions}>
            <ActionButton size="S" tooltip="Add barrier" onClick={() => setBarrierDrawer({ barrier: null })} disabled={!canEdit}><AddIconMinimalist size={16} color="var(--neutral-300)" /></ActionButton>
          </div>
        </div>
        <div className={styles.table}>
          <div className={styles.goalHead}>
            <span className={styles.selectCell}><Checkbox checked={allSelected('barrier', filteredBarriers)} onCheckedChange={() => toggleSelectAll('barrier', filteredBarriers)} aria-label="Select all barriers" disabled={!canEdit} /></span>
            <span className={styles.pCell}>P</span>
            <span className={styles.titleCell}>Barrier Title</span>
            <span className={styles.valueCell}>Description</span>
            <span className={styles.statusCell}>Status</span>
            <span className={styles.rowMenuCell} />
          </div>
          {filteredBarriers.length === 0 && <div className={styles.emptyRow}>{(data.barriers || []).length ? 'No barriers match the filters.' : 'No barriers yet. Add one to capture what blocks this patient.'}</div>}
          {filteredBarriers.map(b => (
            <div key={b.id} className={styles.goalRow}>
              <span className={styles.selectCell} onClick={e => e.stopPropagation()}><Checkbox checked={selected.barrier.has(b.id)} onCheckedChange={() => toggleSelect('barrier', b.id)} aria-label={`Select ${b.title}`} disabled={!canEdit} /></span>
              <span className={styles.pCell}>
                <button type="button" className={styles.priorityBtn} onClick={(e) => canEdit && setPriorityMenu({ kind: 'barrier', item: b, rect: e.currentTarget.getBoundingClientRect() })} disabled={!canEdit} aria-label="Change priority">
                  <PriorityIcon priority={b.priority} size={16} />
                </button>
              </span>
              <span className={styles.titleCell}>
                <span className={styles.rowIcon}><Icon name="solar:shield-warning-linear" size={16} color="var(--neutral-400)" /></span>
                <EditableTitle title={b.title} editable={canEdit} onCommit={t => renameBarrier(b, t)} />
                <span onClick={() => handleLinkChip(0, b.title)} style={{ cursor: 'pointer' }}><LinkChip count={0} /></span>
              </span>
              <span className={styles.valueCell} style={{ color: 'var(--neutral-500)' }}>{b.description || <span className={styles.muted}>—</span>}</span>
              <span className={styles.statusCell}>
                <StatusPill value={b.status} disabled={!canEdit} onOpen={rect => setStatusMenu({ kind: 'barrier', item: b, rect })} />
              </span>
              <span className={styles.rowMenuCell}>
                <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" disabled={!canEdit}
                  onClick={(e) => setStatusMenu({ kind: 'barrier-menu', item: b, rect: e.currentTarget.getBoundingClientRect() })} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Status change menu (goals + interventions + barriers) */}
      {statusMenu && (statusMenu.kind === 'goal' || statusMenu.kind === 'intv' || statusMenu.kind === 'barrier') && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align="left"
          width={160}
          ariaLabel="Change status"
          items={GBI_STATUSES.map(s => ({ key: s, label: s }))}
          onSelect={changeStatus}
          onClose={() => setStatusMenu(null)}
        />
      )}

      {bulkMenu && (
        <MenuPopover
          anchorRect={bulkMenu.rect}
          align="left"
          width={180}
          ariaLabel="Set status for selected"
          items={GBI_STATUSES.map(s => ({ key: s, label: s }))}
          onSelect={bulkSetStatus}
          onClose={() => setBulkMenu(null)}
        />
      )}

      {/* Row overflow menu (rename / remove) */}
      {statusMenu && (statusMenu.kind === 'goal-menu' || statusMenu.kind === 'intv-menu' || statusMenu.kind === 'barrier-menu') && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          width={160}
          ariaLabel="Row actions"
          items={rowMenuItems()}
          onSelect={(k) => {
            const kind = statusMenu.kind;
            const isGoal = kind === 'goal-menu';
            const isBarrier = kind === 'barrier-menu';
            const item = statusMenu.item;
            setStatusMenu(null);
            if (k === 'delete') setDeleteTarget({ kind: isGoal ? 'goal' : isBarrier ? 'barrier' : 'intv', id: item.id, name: item.title });
            else if (k === 'rename' && isBarrier) setBarrierDrawer({ barrier: item });
            else if (k === 'rename' && !isGoal) setIntvDrawer({ intervention: item });
            // Goal rename happens inline via EditableTitle; nudge the user there.
            else if (k === 'rename' && isGoal) showToast('Click the goal title to rename it.');
          }}
          onClose={() => setStatusMenu(null)}
        />
      )}

      {/* Priority change menu (goals / barriers / interventions) */}
      {priorityMenu && (
        <MenuPopover
          anchorRect={priorityMenu.rect}
          align="left"
          width={160}
          ariaLabel="Change priority"
          items={PRIORITIES.map(p => ({ key: p, label: p.charAt(0).toUpperCase() + p.slice(1), iconElement: <PriorityIcon priority={p} size={16} /> }))}
          onSelect={changePriority}
          onClose={() => setPriorityMenu(null)}
        />
      )}

      {goalDrawerOpen && (
        <CreateGoalDrawer onClose={() => setGoalDrawerOpen(false)} onSave={handleAddGoal} />
      )}

      {intvDrawer && (
        <AddInterventionDrawer
          intervention={intvDrawer.intervention}
          onClose={() => setIntvDrawer(false)}
          onSave={handleAddIntervention}
        />
      )}

      {barrierDrawer && (
        <Drawer
          title={barrierDrawer.barrier ? 'Edit Barrier' : 'Add Barrier'}
          onClose={() => setBarrierDrawer(null)}
          noCloseDivider
          headerRight={<span className={styles.headerDivider} />}
          primaryAction={<Button variant="primary" size="L" onClick={() => {
            const titleEl = document.getElementById('barrier-title-input');
            const descEl = document.getElementById('barrier-desc-input');
            const title = titleEl ? titleEl.value.trim() : '';
            const description = descEl ? descEl.value.trim() : '';
            if (!title) { showToast('Barrier title is required'); return; }
            handleAddBarrier({ title, description, status: barrierDrawer.barrier?.status || 'Not Started', priority: barrierDrawer.barrier?.priority || 'medium' });
          }}>Save</Button>}
          secondaryAction={<Button variant="secondary" size="L" onClick={() => setBarrierDrawer(null)}>Cancel</Button>}
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Capture what blocks this patient — it will be tracked per plan and appear in the audit history.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Title <span className={styles.required}>*</span></span>
              <Input id="barrier-title-input" defaultValue={barrierDrawer.barrier?.title || ''} placeholder="e.g. Transportation — no ride to clinic" aria-label="Barrier title" />
            </div>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Description</span>
              <Textarea id="barrier-desc-input" defaultValue={barrierDrawer.barrier?.description || ''} placeholder="Add details about this barrier" rows={3} />
            </div>
          </div>
        </Drawer>
      )}

      {conditionsViewOpen && (
        <Drawer title="All Conditions" onClose={() => setConditionsViewOpen(false)} noCloseDivider headerRight={<span className={styles.headerDivider} />}>
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>{data.conditionTotal} conditions on this plan — {data.conditions.length} shown in the header. Remove any chip above or manage them here.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {data.conditions.map(c => (
                <span key={c.label} className={`${styles.chip} ${c.primary ? styles.chipPrimary : ''}`}>
                  {c.label}
                  <button type="button" className={styles.chipRemove} onClick={() => handleRemoveCondition(c.label)} aria-label={`Remove ${c.label}`} disabled={!canEdit}>
                    <Icon name="solar:close-circle-linear" size={14} color="var(--neutral-300)" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </Drawer>
      )}

      {shareOpen && (
        <CarePlanShareDrawer
          patientId={patientId}
          program={program}
          data={data}
          patientName={patientName}
          canShare={canEdit}
          onClose={clearCarePlanShareRequest}
        />
      )}

      {historyOpen && (
        <CarePlanHistoryDrawer patientId={patientId} program={program} onClose={() => setHistoryOpen(false)} />
      )}

      {versionsOpen && (
        <CarePlanVersionsDrawer patientId={patientId} program={program} onClose={() => setVersionsOpen(false)} />
      )}

      {signOpen && (
        <Drawer
          title="Sign Care Plan"
          onClose={() => setSignOpen(false)}
          secondaryAction={<Button variant="secondary" size="L" onClick={() => setSignOpen(false)}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={doSign}>Sign</Button>}
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Signing saves a version snapshot of the plan and records who signed it. You can still add notes and change statuses afterwards.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Note <span className={styles.optional}>(optional)</span></span>
              <Textarea value={signNote} onChange={e => setSignNote(e.target.value)} placeholder="Add a sign-off note" rows={3} />
            </div>
          </div>
        </Drawer>
      )}

      {noteOpen && (
        <Drawer
          title="Add Note"
          onClose={() => setNoteOpen(false)}
          secondaryAction={<Button variant="secondary" size="L" onClick={() => setNoteOpen(false)}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={doAddNote} disabled={!noteText.trim()}>Add Note</Button>}
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Records a maintenance note on the signed plan without editing it — it appears in the plan's History.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Note <span className={styles.required}>*</span></span>
              <Textarea autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="e.g. Reviewed with patient; no changes needed." rows={3} />
            </div>
          </div>
        </Drawer>
      )}

      {templateOpen && (
        <Drawer
          title="Save as Template"
          onClose={() => setTemplateOpen(false)}
          secondaryAction={<Button variant="secondary" size="L" onClick={() => setTemplateOpen(false)}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={saveTemplate} disabled={!templateName.trim()}>Save</Button>}
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Saves this plan's goals and interventions to the Care Plan Library so it can be reused for similar patients.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Template Name <span className={styles.required}>*</span></span>
              <Input autoFocus value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Type 2 Diabetes — Standard" aria-label="Template name" />
            </div>
          </div>
        </Drawer>
      )}

      {deleteTarget && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Remove "${deleteTarget.name}"?`}
          description="This removes it from the patient's care plan. This action cannot be undone."
          confirmLabel="Remove"
          variant="error"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
