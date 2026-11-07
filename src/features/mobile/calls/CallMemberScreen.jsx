import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { isDialable } from '../../messages/comms/commsUtils';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { initialsOf, patientLine } from '../mobileFormat';
import { callFromPhone } from './callLog';
import common from '../mobile.module.css';
import styles from './CallMemberScreen.module.css';

const PAGE = 50;
const digits = (v) => String(v || '').replace(/\D/g, '');

/** Search a member and call them, or dial a number (Figma 1105:74577). */
export function CallMemberScreen() {
  const { push, pop } = useMobileNav();
  const patients = useAppStore(s => s.allPatients);
  const loading = useAppStore(s => s.allPatientsLoading);
  const didFetch = useAppStore(s => s.allPatientsDidFetch);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const me = useAppStore(s => s.currentUserProfile);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => { fetchAllPatients(); }, [fetchAllPatients]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digits(q);
    return (patients || []).filter(p => !q
      || String(p.name || '').toLowerCase().includes(q)
      || String(p.memberId || '').toLowerCase().includes(q)
      || (qDigits.length >= 3 && digits(p.phone).includes(qDigits)));
  }, [patients, query]);

  const call = async (p) => {
    if (!isDialable(p.phone || '')) {
      toast.error(`${p.name} has no phone number to call.`);
      return;
    }
    await callFromPhone({ number: p.phone, patient: p, sender: me });
    pop();
  };
  // A typed number carries over to the keypad.
  const typedNumber = /^[\d\s()+-]+$/.test(query.trim()) ? digits(query) : '';

  return (
    <div className={common.screen}>
      <div className={styles.head}>
        <div className={styles.search}>
          <Input
            leadingIcon="solar:magnifer-linear"
            size="lg"
            type="search"
            placeholder="Search member to call"
            enterKeyHint="search"
            autoFocus
            aria-label="Search member to call"
            value={query}
            onValueChange={(v) => { setQuery(v); setLimit(PAGE); }}
          />
        </div>
        <button type="button" className={styles.close} onClick={pop}>Close</button>
      </div>
      <div className={common.body}>
        {(loading || !didFetch) && !patients?.length ? <MobileListSkeleton /> : shown.length === 0 ? (
          <MobileEmpty
            icon="solar:users-group-rounded-linear"
            title={query ? 'No members match' : 'No members yet'}
            description={typedNumber ? 'Use Dial a Number to call it.' : undefined}
          />
        ) : (
          <div className={styles.list}>
            <p className={styles.caps}>Members</p>
            {shown.slice(0, limit).map(p => (
              <button key={p.id} type="button" className={common.card} onClick={() => call(p)} aria-label={`Call ${p.name}`}>
                <Avatar variant="patient" size="XL" initials={p.initials || initialsOf(p.name)} />
                <span className={common.cardText}>
                  <span className={common.primaryText}>{p.name}</span>
                  <span className={common.secondaryText}>{patientLine(p)}</span>
                </span>
              </button>
            ))}
            {shown.length > limit && (
              <button type="button" className={common.more} onClick={() => setLimit(l => l + PAGE)}>
                Show more ({shown.length - limit})
              </button>
            )}
          </div>
        )}
      </div>
      <div className={styles.footer}>
        <Button size="lg" onClick={() => push('dialer', typedNumber ? { number: typedNumber } : {})}>Dial a Number</Button>
      </div>
    </div>
  );
}
