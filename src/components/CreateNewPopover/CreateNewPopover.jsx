import { useEffect, useRef } from 'react';
import { Icon } from '../Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import styles from './CreateNewPopover.module.css';

export function CreateNewPopover({ onClose }) {
  const showToast = useAppStore(s => s.showToast);
  const setActivePage = useAppStore(s => s.setActivePage);
  const setCurrentPage = useAppStore(s => s.setCurrentPage);
  const requestAddTask = useAppStore(s => s.requestAddTask);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    // Delay to prevent immediate close on the click that opened it
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [onClose]);

  const item = (icon, label, key) => (
    <button key={key} className={styles.item} onClick={() => { showToast(`${label} – coming soon`); onClose(); }}>
      <Icon name={icon} size={16} color="var(--neutral-300)" />
      {label}
    </button>
  );

  return (
    <div ref={ref} className={styles.popover} onClick={e => e.stopPropagation()}>
      <div className={styles.col}>
        <div className={styles.section}>Add New</div>
        {item('solar:user-plus-linear', 'Patient', 'p')}
        <button key="t" className={styles.item} onClick={() => { requestAddTask(); onClose(); }}>
          <Icon name="solar:checklist-minimalistic-linear" size={16} color="var(--neutral-300)" />
          Task
        </button>
        {item('solar:target-linear', 'Campaign', 'c')}
        {item('solar:users-group-two-rounded-linear', 'Patient Group', 'pg')}
      </div>
      <div className={styles.col}>
        <div className={styles.section}>Start New</div>
        {item('solar:videocamera-record-linear', 'Video Meeting', 'vm')}
        {item('solar:phone-calling-linear', 'Voice Call', 'vc')}
        <button key="ch" className={styles.item} onClick={() => { setActivePage('messages'); setCurrentPage(1); onClose(); }}>
          <Icon name="solar:chat-dots-linear" size={16} color="var(--neutral-300)" />
          Chat
        </button>
        {item('solar:chat-square-linear', 'SMS', 'sms')}
        {item('solar:letter-linear', 'Email', 'em')}
      </div>
      <div className={styles.col}>
        <div className={styles.section}>Build New</div>
        {item('solar:bolt-circle-linear', 'Automation', 'au')}
        {item('solar:routing-2-linear', 'Care Journey', 'cj')}
        <div className={styles.section}>Invite</div>
        {item('solar:user-plus-rounded-linear', 'Invite Practice User', 'inv')}
      </div>
    </div>
  );
}
