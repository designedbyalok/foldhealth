import { Icon } from '../../components/Icon/Icon';
import styles from './NodeSettings.module.css';

export function NodeSettingsHeader({
  onSave,
  config,
  isEditing,
  label,
  onLabelChange,
  onNameKeyDown,
  onEditBlur,
  onToggleEditing,
  nameInputRef,
}) {
  return (
    <>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Node Settings</span>
        <div className={styles.headerActions}>
          <button className={styles.saveTextBtn} onClick={onSave}>Save</button>
        </div>
      </div>

      <div className={styles.nodeIdentity}>
        <div className={styles.nodeIcon} style={{ background: config.color }}>
          {config.CustomIcon ? <config.CustomIcon size={16} color="#fff" /> : <Icon name={config.icon} size={16} color="#fff" />}
        </div>
        {isEditing ? (
          <input aria-label="Node name"
            ref={nameInputRef}
            className={styles.nodeNameInputEditing}
            value={label}
            onChange={onLabelChange}
            onKeyDown={onNameKeyDown}
            onBlur={onEditBlur}
            placeholder="Node name"
          />
        ) : (
          <span className={styles.nodeNameDisplay}>{label}</span>
        )}
        <button className={styles.editBtn} onClick={onToggleEditing} title={isEditing ? 'Done editing' : 'Rename node'}>
          <Icon name={isEditing ? 'solar:check-read-linear' : 'solar:pen-new-square-linear'} size={14} color="var(--primary-300)" />
        </button>
      </div>

      <div className={styles.divider} />
    </>
  );
}
