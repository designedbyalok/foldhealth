import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../../../components/Icon/AddIconMinimalist';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { Button } from '../../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../../components/Input/Input';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { CreateGoalDrawer } from '../../../../../../../settings/care-plan-library/CreateGoalDrawer';
import { CARE_PLAN_MOCK } from '../../../../../../data/carePlanMock';
import { AddInterventionDrawer } from './AddInterventionDrawer';
import { CarePlanShareDrawer } from './CarePlanShareDrawer';
import styles from './CarePlanView.module.css';

// The statuses a goal or intervention can move through. Kept flat and shared so
// the pill menu and the intervention drawer offer the same vocabulary.
const GBI_STATUSES = ['Not Started', 'In Progress', 'On Hold', 'Met', 'Not Met'];

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
  const savePatientCarePlanAsTemplate = useAppStore(s => s.savePatientCarePlanAsTemplate);
  const showToast = useAppStore(s => s.showToast);
  const patientName = useAppStore(s => s.patients.find(p => p.id === patientId)?.name);
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
  } : CARE_PLAN_MOCK), [live]);

  const [conditionsOpen, setConditionsOpen] = useState(true);
  const [statusMenu, setStatusMenu] = useState(null); // { kind, item, rect }
  const [goalDrawerOpen, setGoalDrawerOpen] = useState(false);
  const [intvDrawer, setIntvDrawer] = useState(null);  // false | { intervention }
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { kind, id, name }

  const canEdit = !usingMock;
  // The drawer is driven entirely by the store flag — the toolbar button and
  // the step header (a separate component) both set it, and closing clears it.
  // A mock plan can still be previewed/downloaded; only Share (which persists
  // real ids) is gated to a saved plan.
  const shareOpen = !!carePlanShareRequest;

  const changeStatus = (status) => {
    const { kind, item } = statusMenu;
    setStatusMenu(null);
    if (kind === 'goal') savePatientCarePlanGoal(patientId, program, { ...item, status }, item.id);
    else savePatientCarePlanIntervention(patientId, program, { ...item, status }, item.id);
  };

  const renameGoal = (goal, title) => savePatientCarePlanGoal(patientId, program, { ...goal, title }, goal.id);
  const renameIntervention = (intv, title) => savePatientCarePlanIntervention(patientId, program, { ...intv, title }, intv.id);

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

  const confirmDelete = () => {
    const { kind, id, name } = deleteTarget;
    if (kind === 'goal') deletePatientCarePlanGoal(patientId, program.id, id);
    else deletePatientCarePlanIntervention(patientId, program.id, id);
    setDeleteTarget(null);
    showToast(`"${name}" removed`);
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
                {c.removable && <Icon name="solar:close-circle-linear" size={14} color="var(--neutral-300)" />}
              </span>
            ))}
          </div>
        )}
        <button type="button" className={styles.viewAll}>View All ({data.conditionTotal})</button>
      </div>

      <div className={styles.toolbarRow}>
        <button type="button" className={styles.newProblems}>
          <Icon name="solar:magic-stick-3-linear" size={16} color="var(--primary-300)" />
          New Problems identified in HRA
        </button>
        <div className={styles.toolbarActions}>
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

      {/* Goals */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>Goals</span>
          <div className={styles.sectionActions}>
            <button type="button" className={styles.trendsBtn}>
              <Icon name="solar:chart-2-linear" size={16} color="var(--neutral-300)" />
              Trends
            </button>
            <ActionButton size="S" tooltip="Add goal" onClick={() => setGoalDrawerOpen(true)}><AddIconMinimalist size={16} color="var(--neutral-300)" /></ActionButton>
          </div>
        </div>
        <div className={styles.table}>
          <div className={styles.goalHead}>
            <span className={styles.pCell}>P</span>
            <span className={styles.titleCell}>Goal Title</span>
            <span className={styles.valueCell}>Current Value</span>
            <span className={styles.trendCell}>Trend</span>
            <span className={styles.progressCell}>Progress</span>
            <span className={styles.statusCell}>Status</span>
            <span className={styles.rowMenuCell} />
          </div>
          {data.goals.length === 0 && <div className={styles.emptyRow}>No goals yet. Add one to get started.</div>}
          {data.goals.map(g => (
            <div key={g.id} className={styles.goalRow}>
              <span className={styles.pCell}><PriorityIcon priority={g.priority} size={16} /></span>
              <span className={styles.titleCell}>
                <span className={styles.rowIcon}><Icon name={g.icon} size={16} color="var(--neutral-400)" /></span>
                <EditableTitle title={g.title} subtitle={g.subtitle} editable={canEdit} onCommit={t => renameGoal(g, t)} />
                <LinkChip count={g.links} />
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
            <span className={styles.pCell}>P</span>
            <span className={styles.titleCell}>Name</span>
            <span className={styles.assigneeCell}>Assigned To</span>
            <span className={styles.adherenceCell}>Adherence</span>
            <span className={styles.statusCell}>Status</span>
            <span className={styles.rowMenuCell} />
          </div>
          {data.interventions.length === 0 && <div className={styles.emptyRow}>No interventions yet.</div>}
          {data.interventions.map(i => (
            <div key={i.id} className={styles.intvRow}>
              <span className={styles.pCell}><PriorityIcon priority={i.priority} size={16} /></span>
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
                <LinkChip count={i.links} />
              </span>
              <span className={styles.assigneeCell}>
                <Avatar variant="staff" size={24} initials={i.assignee.initials} />
                <span className={styles.assigneeName}>{i.assignee.name}</span>
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

      {/* Status change menu (goals + interventions) */}
      {statusMenu && (statusMenu.kind === 'goal' || statusMenu.kind === 'intv') && (
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

      {/* Row overflow menu (rename / remove) */}
      {statusMenu && (statusMenu.kind === 'goal-menu' || statusMenu.kind === 'intv-menu') && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          width={160}
          ariaLabel="Row actions"
          items={rowMenuItems()}
          onSelect={(k) => {
            const isGoal = statusMenu.kind === 'goal-menu';
            const item = statusMenu.item;
            setStatusMenu(null);
            if (k === 'delete') setDeleteTarget({ kind: isGoal ? 'goal' : 'intv', id: item.id, name: item.title });
            else if (k === 'rename' && !isGoal) setIntvDrawer({ intervention: item });
            // Goal rename happens inline via EditableTitle; nudge the user there.
            else if (k === 'rename' && isGoal) showToast('Click the goal title to rename it.');
          }}
          onClose={() => setStatusMenu(null)}
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
