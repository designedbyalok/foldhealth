import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Button } from '../../components/Button/Button';
import styles from './AgentCanvas.module.css';

const BUILDER_TABS = ['Workflow', 'Configure', 'Analytics'];

export function AgentCanvasToolbar({
  agentName,
  autoSaveStatus,
  activeTab,
  onTabChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saving,
  onSave,
  onClose,
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <Button variant="ghost" size="sm" iconOnly leadingIcon="solar:arrow-left-linear" onClick={onClose} title="Back to Agents" />
        <span className={styles.agentName}>{agentName}</span>
        {autoSaveStatus !== 'idle' && (
          <span className={styles.autoSaveStatus}>
            {autoSaveStatus === 'saving' ? 'Saving…' : 'Auto-saved'}
          </span>
        )}
      </div>

      <div className={styles.toolbarCenter}>
        <SegmentedControl items={BUILDER_TABS} value={activeTab} onValueChange={onTabChange} />
      </div>

      <div className={styles.toolbarRight}>
        <ActionButton
          icon="solar:undo-left-linear"
          tooltip="Undo (⌘Z)"
          disabled={!canUndo}
          onClick={onUndo}
        />
        <ActionButton
          icon="solar:undo-right-linear"
          tooltip="Redo (⌘⇧Z)"
          disabled={!canRedo}
          onClick={onRedo}
        />
        <span className={styles.toolbarDivider} />
        <Button variant="outline" onClick={onSave} loading={saving}>
          Save
        </Button>
        <span className={styles.toolbarDivider} />
        <Button variant="ghost" leadingIcon="solar:play-linear" disabled>
          Run Test
        </Button>
        <Button variant="ghost" disabled>
          Deploy Agent Now
        </Button>
        <CloseButton onClick={onClose} />
      </div>
    </div>
  );
}

export { BUILDER_TABS };
