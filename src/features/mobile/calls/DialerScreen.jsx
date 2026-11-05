import { useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import { formatPhone, isDialable, toE164 } from '../../messages/comms/commsUtils';
import { useMobileNav } from '../MobileNavContext';
import { callFromPhone } from './callLog';
import common from '../mobile.module.css';
import styles from './DialerScreen.module.css';

const KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];

/** Dial a number; the call goes out on the provider's phone and is logged. */
export function DialerScreen() {
  const { pop } = useMobileNav();
  const { patients, me, line } = useCommsPeople();
  const [number, setNumber] = useState('');
  const match = number.length >= 10 ? patients.find(p => p.phone && toE164(p.phone) === toE164(number)) : null;

  const call = async () => {
    await callFromPhone({ number, patients, sender: me });
    pop();
  };

  return (
    <div className={common.screen}>
      <div className={styles.dialer}>
        <div className={styles.top}>
          <button type="button" className={common.iconBtn} aria-label="Back" onClick={pop}>
            <Icon name="solar:arrow-left-linear" size={24} />
          </button>
        </div>
        {line.number && <p className={styles.line}>Calling from {formatPhone(line.number)}</p>}
        <p className={styles.number} aria-live="polite">{formatPhone(number) || number}</p>
        <p className={styles.match}>{match?.name || ''}</p>
        <div className={styles.pad}>
          {KEYS.map(([digit, letters]) => (
            <button
              key={digit}
              type="button"
              className={styles.key}
              aria-label={digit}
              onClick={() => setNumber(n => (n + digit).slice(0, 20))}
              onContextMenu={digit === '0' ? (e) => { e.preventDefault(); setNumber(n => `${n}+`); } : undefined}
            >
              <span className={styles.digit}>{digit}</span>
              <span className={styles.letters}>{letters}</span>
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <span />
          <button type="button" className={styles.call} aria-label="Call" disabled={!isDialable(number)} onClick={call}>
            <Icon name="solar:phone-linear" size={32} color="currentColor" />
          </button>
          {number ? (
            <button type="button" className={styles.clear} aria-label="Delete digit" onClick={() => setNumber(n => n.slice(0, -1))}>
              <Icon name="solar:backspace-linear" size={28} />
            </button>
          ) : <span />}
        </div>
      </div>
    </div>
  );
}
