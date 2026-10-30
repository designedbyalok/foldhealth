import { useState, useRef, useEffect } from 'react';
import { Icon } from '../Icon/Icon';
import { CloseIcon } from '../Icon/CloseIcon';
import { BotIcon } from '../Icon/BotIcon';
import { Button } from '../Button/Button';
import { ActionButton } from '../ActionButton/ActionButton';
import { Checkbox } from '../ShadcnCheckbox/ShadcnCheckbox';
import { useAppStore } from '../../store/useAppStore';
import styles from './BulkBar.module.css';

/**
 * BulkBar — floating action bar that appears when one or more rows are
 * selected. By default it binds to the global selection store, but callers
 * can pass their own `selectedIds` + `onClear` if they manage a separate
 * selection set (e.g. the HCC worklist uses `selectedHccIds`).
 *
 * `actions` (optional) lets a caller replace the default Change Assignee /
 * Run Automation / "More" cluster entirely. Each entry:
 *   { label, icon?, iconElement?, variant?: 'primary'|'secondary'|'destructive', size?: 'S'|'M'|'L' (default S), onClick(ids, event) }
 * (`iconElement`: a custom icon node, in place of a Solar `icon` name.)
 * `noun` (optional) names what's selected: "26 Appointments Selected".
 * Reach for `actions` when the calling surface has a distinct verb-set
 * (e.g. SFTP review only needs "Add to Worklist" + "Delete"). When
 * omitted, BulkBar renders the default worklist actions, preserving
 * backward compatibility for every existing caller.
 */
export function BulkBar({ selectedIds: selectedIdsProp, onClear, onChangeAssignee, actions, iconActions, moreActions, className, noun } = {}) {
  const storeSelectedIds = useAppStore(s => s.selectedIds);
  const storeClearSelected = useAppStore(s => s.clearSelected);
  const setShowInvokeModal = useAppStore(s => s.setShowInvokeModal);
  const showToast = useAppStore(s => s.showToast);

  const selectedIds = selectedIdsProp ?? storeSelectedIds;
  const clearSelected = onClear ?? storeClearSelected;
  const [showMore, setShowMore] = useState(false);
  const [visible, setVisible] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setShowMore(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Show bar when selections appear, hide when the caller clears the
  // set (e.g. after a bulk Apply). Without the hide branch the bar
  // lingered at "0 Selected" until the close button was clicked.
  useEffect(() => {
    if (selectedIds.length > 0) setVisible(true);
    else setVisible(false);
  }, [selectedIds.length]);

  const handleDismiss = () => {
    clearSelected();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={[styles.bulkBar, className || ''].filter(Boolean).join(' ')}>
      <div className={styles.count}>
        <Checkbox
          checked={selectedIds.length > 0}
          onCheckedChange={() => clearSelected()}
          style={{ width: 20, height: 20 }}
          aria-label="Clear selection"
        />
        <span className={styles.countText}>{selectedIds.length}{noun ? ` ${noun}` : ''} Selected</span>
      </div>
      <div className={styles.divider} />
      {/* Icon-only affordances between the count and the labeled actions —
          used when the surface has a couple of contextual quick actions
          (e.g. DiagPanel bulk bar has Upload / Comment before Accept /
          Dismiss). Rendered with ActionButton so tooltips + sizing stay
          consistent with the rest of the bar. */}
      {iconActions && iconActions.length > 0 && (
        <>
          {iconActions.map((a, i) => (
            <ActionButton
              key={a.label || i}
              icon={a.icon}
              tooltip={a.label}
              onClick={() => a.onClick?.(selectedIds)}
              disabled={a.disabled}
            />
          ))}
          <div className={styles.divider} />
        </>
      )}
      {actions && actions.length > 0 ? (
        <>
          {actions.map((a, i) => (
            <Button
              key={a.label || i}
              variant={a.variant || 'outline'}
              tone={a.tone}
              size={a.size || 'sm'}
              leadingIcon={a.icon}
              leadingIconElement={a.iconElement}
              disabled={a.disabled}
              onClick={(e) => a.onClick?.(selectedIds, e)}
            >
              {a.label}
            </Button>
          ))}
          {/* Optional overflow menu for less-common actions (e.g. Missed
              Opportunity, Defer). Only renders when the caller passed a
              non-empty moreActions[]. Reuses the same dropdown chrome the
              default cluster below uses. */}
          {moreActions && moreActions.length > 0 && (
            <div className={styles.moreWrap} ref={moreRef}>
              <ActionButton
                icon="solar:menu-dots-linear"
                tooltip="More actions"
                onClick={(e) => { e.stopPropagation(); setShowMore(v => !v); }}
              />
              {showMore && (
                <div className={styles.moreDropdown}>
                  <div className={styles.moreTitle}>More Actions</div>
                  {moreActions.map((item, i) => (
                    <button
                      key={item.label || i}
                      className={[styles.moreItem, item.variant === 'destructive' ? styles.danger : ''].filter(Boolean).join(' ')}
                      onClick={() => { setShowMore(false); item.onClick?.(selectedIds); }}
                    >
                      {/* A destructive item's icon is red like its label. */}
                      {item.iconElement || (item.icon && <Icon name={item.icon} size={16} color={item.variant === 'destructive' ? 'currentColor' : 'var(--neutral-400)'} />)}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            leadingIcon="solar:user-check-rounded-linear"
            onClick={() => onChangeAssignee ? onChangeAssignee(selectedIds) : showToast('Change Assignee – coming soon')}
          >
            Change Assignee
          </Button>
          <Button variant="outline" size="sm" leadingIcon="solar:bolt-linear" onClick={() => showToast('Run Automation – coming soon')}>
            Run Automation
          </Button>
          <div className={styles.moreWrap} ref={moreRef}>
            <ActionButton
              icon="solar:menu-dots-linear"
              tooltip="More actions"
              onClick={(e) => { e.stopPropagation(); setShowMore(v => !v); }}
            />
            {showMore && (
              <div className={styles.moreDropdown}>
                <div className={styles.moreTitle}>More Actions</div>
                {[
                  { icon: 'solar:letter-opened-linear', label: 'Run Campaign' },
                  { icon: 'solar:letter-linear', label: 'Send Email' },
                  { icon: 'solar:chat-line-linear', label: 'Send SMS' },
                  { icon: 'solar:calendar-minimalistic-linear', label: 'Schedule Appointment' },
                  { icon: 'solar:hand-pills-linear', label: 'Medical Reconciliation' },
                  { icon: 'solar:clipboard-add-linear', label: 'Send Assessment' },
                  { icon: 'solar:book-linear', label: 'Send Education' },
                  { icon: 'solar:checklist-minimalistic-linear', label: 'Create Task' },
                  { icon: 'solar:tag-horizontal-linear', label: 'Set Tag' },
                ].map(item => (
                  <button key={item.label} className={styles.moreItem} onClick={() => showToast(`${item.label} – coming soon`)}>
                    <Icon name={item.icon} size={16} color="var(--neutral-400)" />
                    {item.label}
                  </button>
                ))}
                <button className={styles.moreItem} onClick={() => { setShowMore(false); setShowInvokeModal(true); }}>
                  <BotIcon size={16} color="var(--neutral-400)" />
                  <span style={{ flex: 1 }}>Invoke Agent</span>
                  <Icon name="solar:alt-arrow-right-linear" size={16} color="var(--neutral-300)" />
                </button>
                <div className={styles.moreDivider} />
                <button className={`${styles.moreItem} ${styles.danger}`} onClick={() => showToast('Removed from list')}>
                  <Icon name="solar:trash-bin-2-linear" size={16} />
                  Remove from List
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <div className={styles.divider} />
      <button className={styles.closeBtn} title="Close" onClick={handleDismiss}>
        <CloseIcon size={20} color="var(--neutral-300)" />
      </button>
    </div>
  );
}
