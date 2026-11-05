import { Button } from '../../../components/Button/Button';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Icon } from '../../../components/Icon/Icon';
import styles from './AutomationBuilder.module.css';

/**
 * The builder's right panel frame (inline beside the canvas, as in the
 * Figma): title, Save, close; a node heading; scrolling body; and an
 * optional sticky summary of what the step will do.
 */
export function EditPanel({ title, icon, iconColor, iconBg, heading, onSave, saveLabel = 'Save', saveDisabled, onClose, summary, headerExtra, children, width }) {
  return (
    <section className={styles.panel} style={width ? { width } : undefined} aria-label={title}>
      <header className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>{title}</h2>
        <span className={styles.panelHeaderActions}>
          {headerExtra}
          {onSave && <Button disabled={saveDisabled} onClick={onSave}>{saveLabel}</Button>}
          {onSave && <span className={styles.headerDivider} />}
          <CloseButton size={18} onClick={onClose} aria-label="Close panel" />
        </span>
      </header>
      {heading && (
        <div className={styles.panelHeading}>
          {icon && <span className={styles.panelHeadingIcon} style={{ color: iconColor, background: iconBg }}><Icon name={icon} size={16} /></span>}
          <span>{heading}</span>
        </div>
      )}
      <div className={styles.panelBody}>{children}</div>
      {summary && (
        <footer className={styles.panelSummary}>
          <Icon name="solar:code-square-linear" size={16} />
          <span>{summary}</span>
        </footer>
      )}
    </section>
  );
}

/** A labelled group of rows in a bordered box (FORM INFO, TEMPLATE INFO…). */
export function PanelSection({ title, action, children }) {
  return (
    <div className={styles.panelSection}>
      {(title || action) && (
        <div className={styles.panelSectionHead}>
          {title && <span className={styles.panelSectionTitle}>{title}</span>}
          {action}
        </div>
      )}
      <div className={styles.panelBox}>{children}</div>
    </div>
  );
}

/** One "label  control" row inside a PanelSection. */
export function PanelRow({ label, required, children, error }) {
  return (
    <div className={`${styles.panelRow} ${error ? styles.panelRowError : ''}`}>
      {label && (
        <span className={styles.panelRowLabel}>
          {label}
          {required && <span className={styles.requiredDot} aria-hidden="true" />}
        </span>
      )}
      <div className={styles.panelRowControl}>
        {children}
        {error && <span className={styles.fieldError}>{error}</span>}
      </div>
    </div>
  );
}
