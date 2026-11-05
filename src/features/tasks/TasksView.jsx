import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { TopBar } from '../../components/TopBar/TopBar';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { FilterBar } from '../worklists/FilterBar';
import { useAppStore } from '../../store/useAppStore';
import { AddTaskDrawer } from './AddTaskDrawer';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { ClinicalNotePreviewDrawer } from './ClinicalNotePreviewDrawer';
import { ClinicalNotePanel } from '../hedis-worklist/ClinicalNotePanel';
import { KanbanIcon } from './TasksViewIcons';
import { useTasksView } from './useTasksView';
import { TasksViewContent } from './TasksViewContent';
import styles from './TasksView.module.css';

// Local to this file: TasksViewIcons.jsx is a components-only file, and
// keeping VIEW_TOGGLE_ITEMS there mixes a JSX-carrying constant with the
// component exports and trips react-refresh HMR.
const VIEW_TOGGLE_ITEMS = [
  { key: 'list', icon: 'solar:list-linear' },
  { key: 'board', icon: <KanbanIcon size={16} /> },
];

export { AddTaskDrawer } from './AddTaskDrawer';
export { TaskDetailDrawer } from './TaskDetailDrawer';
export { TaskListSection } from './TasksViewListSection';

export function TasksView() {
  const view = useTasksView();
  // Standalone linked-note preview + Edit surface, driven by the store
  // slice `previewNoteFromHover` (set by the paperclip hover card's
  // "View note" action). This lives at the TasksView root so it opens
  // WITHOUT dragging the Task Details drawer in behind it.
  const previewNoteFromHover = useAppStore(s => s.previewNoteFromHover);
  const closeNotePreview = useAppStore(s => s.closeNotePreview);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const editHoverNote = useAppStore(s => s.editHoverNote);
  const clearEditHoverNote = useAppStore(s => s.clearEditHoverNote);
  const editHoverMember = editHoverNote?.hedisMemberId
    ? hedisMembers.find(m => m.id === editHoverNote.hedisMemberId)
    : null;

  return (
    <div className={styles.wrapper}>
      <TopBar />

      <SectionTitleBar
        tabs={view.TABS.map(t => ({ ...t, count: view.tabCounts[t.key] }))}
        activeTab={view.tasksTab}
        onTabChange={view.setTasksTab}
        rightExtras={
          <>
            <SegmentedControl
              items={VIEW_TOGGLE_ITEMS}
              value={view.tasksViewMode}
              onValueChange={view.setTasksViewMode}
              size="sm"
            />
            <span style={{ width: 1, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} aria-hidden="true" />
          </>
        }
        actions={['filter']}
        filterActive={view.showTasksFilterBar}
        onFilter={view.toggleTasksFilterBar}
        primaryActionLabel="Add Task"
        onPrimaryAction={() => { view.setAddDrawerStatus('pending'); view.setShowAddDrawer(true); }}
      />

      {view.showTasksFilterBar && (
        <FilterBar
          leading={null}
          filterDefs={view.filterDefs}
          filters={view.tasksFilters}
          onFilterChange={view.setTasksFilter}
          onClearAll={view.clearTasksFilters}
          getOptions={(def) => def.options || []}
          showMoreFilters={false}
          showSaveFilter={false}
        />
      )}

      <TasksViewContent
        tasksLoading={view.tasksLoading}
        tasks={view.tasks}
        filteredTasks={view.filteredTasks}
        tasksViewMode={view.tasksViewMode}
        kanbanGroups={view.kanbanGroups}
        grouped={view.grouped}
        hideAssignedTo={view.hideAssignedTo}
        handleToggle={view.handleToggle}
        handleTaskMove={view.handleTaskMove}
        onTaskClick={view.setSelectedTask}
        onAddTask={(s) => { view.setAddDrawerStatus(s); view.setShowAddDrawer(true); }}
      />

      {view.selectedTask && (
        <TaskDetailDrawer
          task={view.tasks.find(t => t.id === view.selectedTask.id) || view.selectedTask}
          onClose={() => view.setSelectedTask(null)}
          onSelectTask={t => view.setSelectedTask(t)}
        />
      )}
      {view.showAddDrawer && (
        <AddTaskDrawer
          onClose={() => { view.setShowAddDrawer(false); view.setAddDrawerInitialMember(null); }}
          defaultStatus={view.addDrawerStatus}
          initialMember={view.addDrawerInitialMember}
          onTaskCreated={(task) => {
            view.setShowAddDrawer(false);
            view.setAddDrawerInitialMember(null);
            view.setSelectedTask(task);
          }}
        />
      )}
      {previewNoteFromHover && (
        <ClinicalNotePreviewDrawer
          note={previewNoteFromHover}
          onClose={closeNotePreview}
          onEdit={(note) => useAppStore.getState().setEditHoverNote(note)}
        />
      )}
      {editHoverNote && editHoverMember && (
        <ClinicalNotePanel
          member={editHoverMember}
          gapCode={editHoverNote.gapCodes?.[0]}
          year={2026}
          editingTaskId={editHoverNote.reviewTaskId}
          onClose={clearEditHoverNote}
        />
      )}
    </div>
  );
}
