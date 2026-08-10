import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Toggle } from '../../components/Toggle/Toggle';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { SendTestPopover } from './SendTestPopover';
import { ShortcutsHelpButton } from './EmailBuilderShortcuts';
import { formatTime } from './EmailBuilder.utils';
import styles from './EmailBuilder.module.css';

export function EmailBuilderToolbar({
  name, setName, viewMode, setViewMode,
  canUndo, canRedo, undoEmailEdit, redoEmailEdit,
  showTestEmail, setShowTestEmail,
  lastSavedAt, unsavedCount, saving, onSave,
  closeEmailBuilder, setPendingClose,
}) {
  return (
    <div className={styles.topBar}>
      <div className={styles.topLeft}>
        <input
          className={styles.titleInput}
          aria-label="Email name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
          spellCheck={false}
        />
      </div>
      <div className={styles.topCenter}>
        <Toggle
          items={[
            { key: 'builder', label: 'Builder', icon: 'solar:pen-new-square-linear' },
            { key: 'desktop', label: 'Desktop', icon: 'solar:monitor-linear' },
            { key: 'mobile', label: 'Mobile', icon: 'solar:smartphone-linear' },
          ]}
          active={viewMode}
          onChange={setViewMode}
          size="S"
        />
      </div>
      <div className={styles.topRight} style={{ position: 'relative' }}>
        <ActionButton
          icon="solar:undo-left-linear"
          size="L"
          tooltip="Undo (⌘Z)"
          state={canUndo ? 'active' : 'disabled'}
          onClick={undoEmailEdit}
        />
        <ActionButton
          icon="solar:undo-right-linear"
          size="L"
          tooltip="Redo (⇧⌘Z)"
          state={canRedo ? 'active' : 'disabled'}
          onClick={redoEmailEdit}
        />
        <ShortcutsHelpButton />
        <Button
          variant="secondary"
          size="L"
          leadingIcon="solar:letter-linear"
          onClick={() => setShowTestEmail(v => !v)}
        >
          Test Mail
        </Button>
        {showTestEmail && (
          <SendTestPopover
            campaignId={useAppStore.getState().editingCampaignId}
            onClose={() => setShowTestEmail(false)}
          />
        )}
        {lastSavedAt && unsavedCount === 0 && (
          <span className={styles.saveStatus}>
            <Icon name="solar:check-circle-linear" size={14} color="var(--status-success)" />
            Saved at {formatTime(lastSavedAt)}
          </span>
        )}
        {unsavedCount > 0 && (
          <span className={styles.saveStatus} style={{ color: 'var(--status-warning)' }}>
            <Icon name="solar:pen-2-linear" size={14} color="var(--status-warning)" />
            {unsavedCount} unsaved change{unsavedCount !== 1 ? 's' : ''}
          </span>
        )}
        <Button
          variant="primary"
          size="L"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <CloseButton
          size={18}
          onClick={() => unsavedCount > 0 ? setPendingClose({ reason: 'close' }) : closeEmailBuilder()}
        />
      </div>
    </div>
  );
}
