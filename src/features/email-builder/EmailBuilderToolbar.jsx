import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Toggle } from '../../components/Toggle/Toggle';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Select } from '../../components/Select/Select';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { SendTestPopover } from './SendTestPopover';
import { TokenPicker } from './TokenPicker';
import { ShortcutsHelpButton } from './EmailBuilderShortcuts';
import { formatTime } from './EmailBuilder.utils';
import styles from './EmailBuilder.module.css';

// Header / Footer are for emails; Report Header / Report Footer for printed reports.
const COMPONENT_TYPES = [
  { value: 'header', label: 'Header' },
  { value: 'footer', label: 'Footer' },
  { value: 'report_header', label: 'Report Header' },
  { value: 'report_footer', label: 'Report Footer' },
];

export function EmailBuilderToolbar({
  name, setName, viewMode, setViewMode,
  canUndo, canRedo, undoEmailEdit, redoEmailEdit,
  showTestEmail, setShowTestEmail,
  lastSavedAt, unsavedCount, saving, onSave,
  closeEmailBuilder, setPendingClose,
  component, setComponent,
}) {
  return (
    <div className={styles.topBar}>
      <div className={styles.topLeft}>
        <Input
          className={styles.titleInput}
          aria-label={component ? 'Component name' : 'Email name'}
          placeholder={component ? 'Component name' : undefined}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
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
        {viewMode === 'builder' && <TokenPicker />}
        {component ? (
          <>
            {/* A component's type and whether it's the default for that type. */}
            <Select
              aria-label="Component type"
              options={COMPONENT_TYPES}
              value={component.role}
              onChange={(role) => setComponent({ role })}
              style={{ width: 160 }}
            />
            <label className={styles.defaultToggle}>
              <Checkbox
                checked={component.isDefault}
                onCheckedChange={(v) => setComponent({ isDefault: v === true })}
              />
              Default
            </label>
          </>
        ) : (
        <>
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
        </>
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
