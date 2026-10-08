import { ActivityLog } from '@/components/ActivityLog/ActivityLog';
import { Button } from '@/components/Button/Button';
import { Input } from '@/components/Input/Input';
import { Select } from '@/components/Select/Select';
import { TemplateScopeChoice } from '../../../../../../settings/care-plan-library/shared';
import { PATIENT_SCOPE_CHOICES } from '../lib/templateScope';
import { Textarea } from '@/components/Textarea/Textarea';
import { Drawer } from '@/components/Drawer/Drawer';
import { SelectAssigneeModal } from '@/components/SelectAssigneeModal/SelectAssigneeModal';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { goalCascade } from '../lib/carePlanGoalCascade';
import { RemoveGoalDialog } from '../drawers/RemoveGoalDialog';
import { ChronicConditionSelect } from '../../../../../../settings/care-plan-library/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ShadcnDialog/ShadcnDialog';
import { AddGoalsDrawer } from '../../../../../../settings/care-plan-library/goals/AddGoalsDrawer/AddGoalsDrawer';
import { AddBarriersDrawer } from '../../../../../../settings/care-plan-library/barriers/AddBarriersDrawer/AddBarriersDrawer';
import { BarrierDrawer } from '../../../../../../settings/care-plan-library/barriers/BarrierDrawer/BarrierDrawer';
import { BarrierDetailDrawer } from '../drawers/BarrierDetailDrawer/BarrierDetailDrawer';
import { AddInterventionDrawer } from '../drawers/AddInterventionDrawer/AddInterventionDrawer';
import { INTERVENTION_EDITORS } from '../../../../../../settings/care-plan-library/interventions';
import { AddTaskDrawer } from '../../../../../../tasks/AddTaskDrawer';
import { CarePlanShareDrawer } from '../drawers/CarePlanShareDrawer/CarePlanShareDrawer';
import { CarePlanHistoryDrawer } from '../drawers/CarePlanHistoryDrawer/CarePlanHistoryDrawer';
import { CarePlanVersionsDrawer } from '../drawers/CarePlanVersionsDrawer/CarePlanVersionsDrawer';
import { CarePlanTrendsDrawer } from '../drawers/CarePlanTrendsDrawer/CarePlanTrendsDrawer';
import { GoalPreviewDrawer } from '../drawers/GoalPreviewDrawer/GoalPreviewDrawer';
import { InterventionPreviewDrawer } from '../drawers/InterventionPreviewDrawer/InterventionPreviewDrawer';
import { ApplyTemplatesDrawer } from '../drawers/ApplyTemplatesDrawer/ApplyTemplatesDrawer';
import { TemplateCreateLayer } from './TemplateCreateLayer';
import { interventionActivityEntries } from './carePlanLinkedItems';
import styles from './CarePlanView.module.css';

/** Drawers, dialogs, and bulk modals for the care plan step (presentation only). */
export function CarePlanViewDrawers(d) {
  const {
    addGoalsDrawerOpen, setAddGoalsDrawerOpen, handleAddGoalsFromPicker, data, patientProblems,
    previewGoal, setPreviewGoal, patientId, program, previewBarrier, setPreviewBarrier,
    previewIntervention, setPreviewIntervention, intvDrawer, setIntvDrawer, handleAddIntervention,
    notesFocus, setNotesFocus,
    intvSpecialDrawer, setIntvSpecialDrawer, auditAll, saveInterventionFromConfig,
    taskDrawerOpen, setTaskDrawerOpen, taskGoalId, setTaskGoalId, patientName,
    addBarriersDrawerOpen, setAddBarriersDrawerOpen, barrierAddGoalIdRef, handleAddBarriersFromPicker,
    barrierDrawer, setBarrierDrawer, handleAddBarrier, shareOpen, clearCarePlanShareRequest, canEdit,
    historyOpen, setHistoryOpen, versionsOpen, setVersionsOpen, signOpen, setSignOpen, doSign, signNote, setSignNote,
    noteOpen, closeNoteDrawer, doAddNote, noteText, setNoteText, noteDirty, latestPlanNote, noteTimelineEntries,
    noteDiscardOpen, setNoteDiscardOpen, noteDeleteOpen, setNoteDeleteOpen, doClearCareNote,
    problemOpen, setProblemOpen, doAddProblem, problemText, setProblemText,
    trendsOpen, setTrendsOpen, measurements,
    templatesDrawerOpen, setTemplatesDrawerOpen, appliedTemplateIds,
    templateCreateOpen, setTemplateCreateOpen, createdTemplateIds, setCreatedTemplateIds, appliedTemplatePriorities, handleApplyTemplates,
    templateOpen, setTemplateOpen, templateName, setTemplateName, templateConditions, setTemplateConditions, saveTemplate,
    templateSourceId, pickTemplateSource, appliedTemplates, templateScope, setTemplateScope,
    deleteTarget, setDeleteTarget, live, removeGoal, confirmDelete,
    bulkAssignOpen, setBulkAssignOpen, bulkAssign, bulkDeleteOpen, setBulkDeleteOpen, bulkDelete, selectedCount,
  } = d;
  // A drawer opens at its Note section only when the row's Notes action
  // opened that exact item; closing it drops the request.
  const notesFor = (kind, item) => (
    notesFocus && notesFocus.kind === kind && String(notesFocus.id) === String(item?.id) ? 'notes' : null
  );
  const closeWith = (setter) => () => { setter(null); setNotesFocus(null); };

  return (
    <>
      {addGoalsDrawerOpen && (
        <AddGoalsDrawer
          onClose={() => setAddGoalsDrawerOpen(false)}
          onAdd={handleAddGoalsFromPicker}
          existingGoalTitles={data.goals.map(g => g.title)}
          patientProblems={patientProblems}
        />
      )}

      {previewGoal && (
        <GoalPreviewDrawer
          goal={previewGoal}
          patientId={patientId}
          program={program}
          focusSection={notesFor('goal', previewGoal)}
          onClose={closeWith(setPreviewGoal)}
          onOpenIntervention={setPreviewIntervention}
          onOpenBarrier={setPreviewBarrier}
        />
      )}

      {previewBarrier && (
        <BarrierDetailDrawer
          barrier={previewBarrier}
          patientId={patientId}
          program={program}
          focusSection={notesFor('barrier', previewBarrier)}
          onClose={closeWith(setPreviewBarrier)}
          onOpenGoal={(g) => { setPreviewBarrier(null); setPreviewGoal(g); }}
        />
      )}

      {previewIntervention && (
        <InterventionPreviewDrawer
          intervention={previewIntervention}
          patientId={patientId}
          program={program}
          focusSection={notesFor('intervention', previewIntervention)}
          onClose={closeWith(setPreviewIntervention)}
          onEdit={(intv) => {
            // Open the full intervention edit drawer for this kind so the
            // user can edit fields beyond just the title (Send Form,
            // Patient Education, Patient Task, Measure Vital, Internal
            // Task). Close preview first, then open the special editor.
            // `previewOnClose` tells the editor to reopen the preview
            // when the user closes or updates it, so they land back on
            // the intervention detail instead of the plan screen.
            setPreviewIntervention(null);
            setIntvSpecialDrawer({ kind: intv.kind, intervention: intv, previewOnClose: intv });
          }}
          onOpenGoal={(g) => { setPreviewIntervention(null); setPreviewGoal(g); }}
        />
      )}

      {intvDrawer && (
        <AddInterventionDrawer
          intervention={intvDrawer.intervention}
          onClose={() => setIntvDrawer(false)}
          onSave={handleAddIntervention}
        />
      )}

      {intvSpecialDrawer && (() => {
        const Editor = INTERVENTION_EDITORS[intvSpecialDrawer.kind];
        if (!Editor) return null;
        const intv = intvSpecialDrawer.intervention;
        const activityEntries = interventionActivityEntries(auditAll, intv);
        const currentLinked = Array.isArray(intv?.goalIds) && intv.goalIds.length > 0
          ? intv.goalIds
          : (intv?.goalId ? [intv.goalId]
            : (intvSpecialDrawer.presetGoalId ? [intvSpecialDrawer.presetGoalId] : []));
        // Merge the intervention row's top-level columns into the config
        // blob before handing it to the editor. Legacy rows either only
        // stored `title` / `priority` / `assignee` at the top level, or
        // stored empty strings inside config; without this, opening the
        // edit drawer showed empty fields. Uses `||` (not `??`) so an
        // empty-string in the config falls through to the top-level
        // column.
        const editorIntervention = intv ? {
          ...(intv.config || {}),
          id: intv.id,
          title: (intv.config && intv.config.title) || intv.title || '',
          priority: (intv.config && intv.config.priority) || intv.priority || 'Medium',
          assignedTo: (intv.config && intv.config.assignedTo)
            || (intv.assignee && intv.assignee.name && intv.assignee.name !== 'Unassigned' ? intv.assignee.name : '')
            || '',
        } : null;
        return (
          <Editor
            kind={intvSpecialDrawer.kind}
            intervention={editorIntervention}
            showLibrary
            linkToGoalsAllowed
            availableGoals={data.goals}
            linkedGoalIds={currentLinked}
            activityEntries={activityEntries}
            memberName={patientName}
            onOpenGoal={(g) => { setIntvSpecialDrawer(null); setPreviewGoal(g); }}
            onClose={() => {
              // Reopen the preview drawer the editor was launched from so
              // the user lands back on the intervention detail instead of
              // the plan screen. `previewOnClose` is only set when the
              // editor was opened via the preview's edit affordance.
              const restore = intvSpecialDrawer.previewOnClose;
              setIntvSpecialDrawer(null);
              if (restore) setPreviewIntervention(restore);
            }}
            onSave={async (config) => {
              await saveInterventionFromConfig(
                intvSpecialDrawer.kind,
                config,
                intv?.id || null,
                intvSpecialDrawer.presetGoalId || null,
              );
              const restore = intvSpecialDrawer.previewOnClose;
              setIntvSpecialDrawer(null);
              if (restore) setPreviewIntervention(restore);
            }}
          />
        );
      })()}

      {taskDrawerOpen && (
        <AddTaskDrawer
          taskKind={taskDrawerOpen}
          initialMember={patientName}
          initialAssignedTo={taskDrawerOpen === 'internal-task' ? '' : patientName}
          showScheduleFields
          libraryKind={taskDrawerOpen}
          availableGoals={data.goals}
          initialLinkedGoalIds={taskGoalId ? [taskGoalId] : []}
          onOpenGoal={(g) => { setTaskDrawerOpen(null); setPreviewGoal(g); }}
          onClose={() => { setTaskDrawerOpen(null); setTaskGoalId(null); }}
          onTaskCreated={async (t) => {
            await saveInterventionFromConfig(taskDrawerOpen, { title: t?.name || '', taskId: t?.id }, null, taskGoalId);
            setTaskDrawerOpen(null);
            setTaskGoalId(null);
          }}
        />
      )}

      {addBarriersDrawerOpen && (
        <AddBarriersDrawer
          onClose={() => { setAddBarriersDrawerOpen(false); barrierAddGoalIdRef.current = null; }}
          onAdd={handleAddBarriersFromPicker}
          existingBarriers={data.barriers || []}
        />
      )}

      {barrierDrawer?.barrier && (
        <BarrierDrawer
          barrier={barrierDrawer.barrier}
          onClose={() => setBarrierDrawer(null)}
          onSave={({ title, description }) => handleAddBarrier({
            title,
            description,
            status: barrierDrawer.barrier?.status || 'Not Started',
            priority: barrierDrawer.barrier?.priority || 'medium',
          })}
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
          title={latestPlanNote ? 'Update Note' : 'Add Note'}
          onClose={() => closeNoteDrawer()}
          primaryAction={
            <Button
              variant="primary"
              size="L"
              onClick={doAddNote}
              disabled={!noteText.trim() || !noteDirty}
            >
              {latestPlanNote ? 'Update Note' : 'Add Note'}
            </Button>
          }
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Records a maintenance note on the signed plan without editing it — it appears in the plan's History.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Note <span className={styles.required}>*</span></span>
              <Textarea autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="e.g. Reviewed with patient; no changes needed." rows={3} />
            </div>
            {noteTimelineEntries.length > 0 && (
              <div className={styles.noteTimeline}>
                <span className={styles.noteTimelineLabel}>Change log</span>
                <ActivityLog entries={noteTimelineEntries} hideCommentTitle />
              </div>
            )}
          </div>
        </Drawer>
      )}
      {noteDiscardOpen && (
        <ConfirmDialog
          variant="destructive"
          title="Discard unsaved changes?"
          description="You'll lose the edits you just made to this note."
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setNoteDiscardOpen(false)}
          onConfirm={() => { setNoteDiscardOpen(false); closeNoteDrawer({ force: true }); }}
        />
      )}
      {noteDeleteOpen && (
        <ConfirmDialog
          variant="destructive"
          title="Delete this care note?"
          description="The note is removed from the plan surface, but every past note stays in the plan's history."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onCancel={() => setNoteDeleteOpen(false)}
          onConfirm={doClearCareNote}
        />
      )}

      {problemOpen && (
        <Drawer
          title="Add Problem"
          onClose={() => setProblemOpen(false)}
          secondaryAction={<Button variant="secondary" size="L" onClick={() => setProblemOpen(false)}>Cancel</Button>}
          primaryAction={<Button variant="primary" size="L" onClick={doAddProblem} disabled={!problemText.trim()}>Add</Button>}
        >
          <div className={styles.drawerBody}>
            <p className={styles.drawerHint}>Adds a problem/condition to this care plan. It shows in the problems bar and groups the goals, interventions, and barriers that address it.</p>
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Problem <span className={styles.required}>*</span></span>
              <Input
                autoFocus
                value={problemText}
                onChange={e => setProblemText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && problemText.trim()) { e.preventDefault(); doAddProblem(); } }}
                placeholder="e.g. Chronic Kidney Disease"
                aria-label="Problem"
              />
            </div>
          </div>
        </Drawer>
      )}

      {trendsOpen && (
        <CarePlanTrendsDrawer
          goals={data.goals}
          measurements={measurements}
          onClose={() => setTrendsOpen(false)}
        />
      )}

      {templatesDrawerOpen && (
        <ApplyTemplatesDrawer
          patientId={patientId}
          appliedTemplateIds={appliedTemplateIds}
          appliedTemplatePriorities={appliedTemplatePriorities}
          patientProblems={patientProblems}
          onClose={() => { setTemplatesDrawerOpen(false); setCreatedTemplateIds([]); }}
          onApply={(ids, priorities) => { setCreatedTemplateIds([]); handleApplyTemplates(ids, priorities); }}
          onCreateNew={() => { setTemplatesDrawerOpen(false); setTemplateCreateOpen(true); }}
          preselectedIds={createdTemplateIds}
        />
      )}

      {templateCreateOpen && (
        <TemplateCreateLayer
          onClose={() => { setTemplateCreateOpen(false); setTemplatesDrawerOpen(true); }}
          onCreated={(template) => {
            // A draft isn't ready to apply, so only a published template
            // comes back pre-checked.
            if (template.status !== 'draft') setCreatedTemplateIds(ids => [...ids, template.id]);
            setTemplateCreateOpen(false);
            setTemplatesDrawerOpen(true);
          }}
        />
      )}

      <Dialog open={templateOpen} onOpenChange={open => !open && setTemplateOpen(false)}>
        <DialogContent className={styles.templateDialog}>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Saves the goals, interventions and barriers as a template you can apply again.
          </DialogDescription>
          <div className={styles.templateForm}>
            {appliedTemplates.length > 0 && (
              <Select
                label="Save from"
                options={[
                  { value: 'all', label: 'Entire plan' },
                  ...appliedTemplates.map(t => ({ value: t.id, label: t.name })),
                ]}
                value={templateSourceId}
                onChange={pickTemplateSource}
                searchable={appliedTemplates.length > 6}
                searchPlaceholder="Search templates"
              />
            )}
            <div className={styles.drawerField}>
              <span className={styles.drawerLabel}>Template Name <span className={styles.required}>*</span></span>
              <Input autoFocus value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Type 2 Diabetes — Standard" aria-label="Template name" />
            </div>
            <ChronicConditionSelect value={templateConditions} onChange={setTemplateConditions} label="Conditions" />
            <TemplateScopeChoice value={templateScope} onChange={setTemplateScope} choices={PATIENT_SCOPE_CHOICES} />
          </div>
          <div className={styles.templateDialogFooter}>
            <Button variant="primary" size="L" onClick={saveTemplate} disabled={!templateName.trim()}>Save</Button>
            <Button variant="secondary" size="L" onClick={() => setTemplateOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {deleteTarget?.kind === 'goal' && (
        <RemoveGoalDialog
          goalTitle={deleteTarget.name}
          cascade={goalCascade(live, deleteTarget.id)}
          onRemoveAll={() => removeGoal(true)}
          onRemoveGoalOnly={() => removeGoal(false)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteTarget && deleteTarget.kind !== 'goal' && (
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

      <SelectAssigneeModal
        open={bulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
        onConfirm={bulkAssign}
        title="Assign interventions"
        confirmLabel="Assign"
      />

      {bulkDeleteOpen && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title={`Remove ${selectedCount} item${selectedCount === 1 ? '' : 's'}?`}
          description="This removes the selected goals, interventions, and barriers from the patient's care plan. This action cannot be undone."
          confirmLabel="Remove"
          variant="error"
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={bulkDelete}
        />
      )}
    </>
  );
}
