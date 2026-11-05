import { useRef } from 'react';
import { Icon } from '../Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import styles from './PhoneLink.module.css';

/**
 * PhoneLink: click-to-call for a phone number that isn't a patient's
 * (prescriber, pharmacy, facility). Opens the call popover listing the
 * organization's call lines, so the user only picks which line to call
 * from. `onDial` runs when they press Call Now, so the caller can log it.
 *
 * Props:
 *  - number  string: display format, e.g. "(626) 555-0190"
 *  - label   string: who is being called, for the accessible name
 *  - onDial  () => void: optional
 */
export function PhoneLink({ number, label, onDial }) {
  const openNumberCallPopover = useAppStore(s => s.openNumberCallPopover);
  const btnRef = useRef(null);
  if (!number) return <span className={styles.empty}>-</span>;
  return (
    <button
      ref={btnRef}
      type="button"
      className={styles.link}
      onClick={(e) => {
        e.stopPropagation();
        openNumberCallPopover({ number, label, onDial }, btnRef);
      }}
      aria-label={label ? `Call ${label} at ${number}` : `Call ${number}`}
    >
      <Icon name="solar:phone-linear" size={14} color="currentColor" />
      {number}
    </button>
  );
}
