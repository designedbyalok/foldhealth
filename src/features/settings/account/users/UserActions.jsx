import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../../components/Icon/Icon';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { OOO_ICON } from '../../../ooo/oooUtils';
import styles from '../AccountPanel.module.css';

/**
 * Row-level actions for the Users table: Reset Password (Unlock Account
 * when the account is locked), Disable/Enable,
 * More menu (Edit / View OOO Records / Delete). Pending sign-ups get
 * Approve / Reject in place of Reset Password and Disable/Enable.
 * Non-admins see a plain "-", every action on this component is admin-only.
 */
export function UserActions({ user, isAdmin, locked = false, onResetPassword, onUnlock, onToggleStatus, onApprove, onReject, onEdit, onViewOoo, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  if (!isAdmin) {
    return <span style={{ color: 'var(--neutral-200)', fontSize: 'var(--font-md)' }}>-</span>;
  }

  return (
    <div className={styles.actions}>
      {user.status === 'Pending' ? (
        <>
          <ActionButton icon="solar:check-circle-linear" tooltip="Approve Sign-up" onClick={onApprove} />
          <span className={styles.actionDivider} />
          <ActionButton icon="solar:close-circle-linear" tooltip="Reject Sign-up" onClick={onReject} />
        </>
      ) : (
        <>
          {locked ? (
            <ActionButton icon="solar:lock-keyhole-unlocked-linear" tooltip="Unlock Account" onClick={onUnlock} />
          ) : (
            <ActionButton icon="solar:password-linear" tooltip="Reset Password" onClick={onResetPassword} />
          )}
          <span className={styles.actionDivider} />
          <ActionButton
            icon={user.status === 'Active' ? 'solar:user-cross-linear' : 'solar:user-check-linear'}
            tooltip={user.status === 'Active' ? 'Disable User' : 'Enable User'}
            onClick={onToggleStatus}
          />
        </>
      )}
      <span className={styles.actionDivider} />
      <div style={{ position: 'relative' }} ref={menuRef}>
        <ActionButton icon="solar:menu-dots-linear" tooltip="More Options" onClick={() => setMenuOpen(v => !v)} />
        {menuOpen && createPortal(
          <div className={styles.moreDropdown} style={{
            position: 'fixed',
            top: menuRef.current.getBoundingClientRect().bottom + 4,
            right: window.innerWidth - menuRef.current.getBoundingClientRect().right,
            zIndex: 9999,
          }}>
            <button className={styles.moreItem} onClick={() => { onEdit(); setMenuOpen(false); }}>
              <Icon name="solar:pen-linear" size={16} color="var(--neutral-300)" /> Edit User
            </button>
            {onViewOoo && (
              <button className={styles.moreItem} onClick={() => { onViewOoo(); setMenuOpen(false); }}>
                <Icon name={OOO_ICON} size={16} color="var(--neutral-300)" /> View OOO Records
              </button>
            )}
            <div className={styles.moreDivider} />
            <button className={`${styles.moreItem} ${styles.moreItemDanger}`} onClick={() => { onDelete(); setMenuOpen(false); }}>
              <Icon name="solar:trash-bin-minimalistic-linear" size={16} color="var(--status-error)" /> Delete User
            </button>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
