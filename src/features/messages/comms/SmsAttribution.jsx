import { useRef, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { Coachmark } from '../../../components/Coachmark/Coachmark';
import { UserAccountsIcon } from '../../../components/Icon/UserAccountsIcon';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/Dialog/Dialog';
import { Avatar } from '../../../components/Avatar/Avatar';
import { memberMeta, sharedBy } from './smsMembers';
import styles from './SmsAttribution.module.css';

/**
 * One member in the Log For menu (3540:64946) and the Select Member popup
 * (3540:64628): light avatar, name ("(Default)" for the number's owner)
 * over gender • date of birth.
 */
export function MemberOption({ member: m, profileArrow = false }) {
  return (
    <span className={styles.member}>
      <Avatar variant="patient" initials={m.initials} className={styles.memberAvatar} />
      <span className={styles.memberText}>
        <span className={styles.memberName}>{m.isOwner ? `${m.name} (Default)` : m.name}</span>
        <span className={styles.memberMeta}>{memberMeta(m)}</span>
      </span>
      {/* Trailing arrow: the row opens their profile. */}
      {profileArrow && <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-300)" className={styles.memberArrow} />}
    </span>
  );
}

/**
 * "Log For: Member ⌄" beside the composer's Internal toggle (3540:64859):
 * picks who the next SMS is logged for.
 */
export function LogForChip({ ref, members, value, onChange }) {
  const own = useRef(null);
  const anchorRef = ref || own;
  const [open, setOpen] = useState(false);
  const current = members.find(m => m.id === value) || members[0];
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={styles.chip}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name="solar:user-linear" size={10} color="var(--neutral-300)" />
        <span className={styles.chipText}>Log For: {current?.name}</span>
        <span className={styles.chipDivider} aria-hidden="true" />
        <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" />
      </button>
      {open && (
        <MenuPopover
          anchorRef={anchorRef}
          align="left"
          width={236}
          ariaLabel="Log SMS for"
          items={members.map(m => ({
            key: m.id,
            tall: true,
            selected: m.id === current?.id,
            label: <MemberOption member={m} />,
          }))}
          onSelect={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Shown each time a shared-number SMS chat opens (3540:64643), for any
 * patient, until closed for that chat.
 */
export function LogForCoachmark({ anchorRef }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  const dismiss = () => setClosed(true);
  return (
    <Coachmark anchorRef={anchorRef} illustration={<UserAccountsIcon />} width={369} onClose={dismiss}>
      When a number is shared by multiple members, select who the SMS is logged for before sending. Sent SMS is logged to that member&apos;s Activity.
    </Coachmark>
  );
}

/**
 * "Select Member to log SMS for:" (3540:64613 / 64628): one member for the
 * selected messages. Save stays off until someone is picked.
 */
export function SelectMemberModal({ open, members, saving = false, onClose, onSave }) {
  const [picked, setPicked] = useState(null);
  const close = () => { setPicked(null); onClose(); };
  const member = members.find(m => m.id === picked);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className={styles.modal} hideClose>
        <DialogTitle className={styles.modalTitle}>Select Member to log SMS for:</DialogTitle>
        <div className={styles.modalBody}>
          <DialogDescription className={styles.modalHelper}>
            {sharedBy(members)} Selected SMS will be logged for the member you select below :
          </DialogDescription>
          <div className={styles.memberList} role="radiogroup" aria-label="Members">
            {members.map(m => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={m.id === picked}
                className={[styles.memberRow, m.id === picked ? styles.memberRowPicked : ''].filter(Boolean).join(' ')}
                onClick={() => setPicked(m.id)}
              >
                <MemberOption member={m} />
              </button>
            ))}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <Button variant="outline" fullWidth onClick={close}>Cancel</Button>
          <Button
            fullWidth
            disabled={!member || saving}
            onClick={async () => { if (member && await onSave(member) !== false) setPicked(null); }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const APPLY_TO = [
  { value: 'one', label: 'This message only' },
  { value: 'today', label: 'This message and all upcoming messages to be received today (till 11:59 PM)' },
  { value: 'below', label: 'This message and all incoming messages after it (till an incoming message is manually assigned)' },
];

/**
 * "Select Member to log SMS for:" with Apply to (4620:54956), for a received
 * SMS on a shared number: who it's from, and how far the choice reaches.
 * Only "rest of today" starts the session that auto-assigns new replies.
 *
 * @param {(member, applyTo: 'one'|'below'|'today') => Promise<boolean|void>} props.onSave
 */
export function AssignSmsModal({ open, members, saving = false, onClose, onSave }) {
  const [picked, setPicked] = useState(null);
  const [applyTo, setApplyTo] = useState('one');
  const reset = () => { setPicked(null); setApplyTo('one'); };
  const close = () => { reset(); onClose(); };
  const member = members.find(m => m.id === picked);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className={`${styles.modal} ${styles.assignModal}`} hideClose>
        <DialogTitle className={styles.modalTitle}>Select Member to log SMS for:</DialogTitle>
        <div className={styles.modalBody}>
          <DialogDescription className={styles.modalHelper}>
            {sharedBy(members)} Selected SMS will be logged for the member you select below :
          </DialogDescription>
          <div className={styles.memberList} role="radiogroup" aria-label="Members">
            {members.map(m => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={m.id === picked}
                className={[styles.memberRow, m.id === picked ? styles.memberRowPicked : ''].filter(Boolean).join(' ')}
                onClick={() => setPicked(m.id)}
              >
                <MemberOption member={m} />
              </button>
            ))}
          </div>
        </div>
        <div className={styles.applySection}>
          <div className={styles.applyTo}>
            <span className={styles.applyToLabel} id="assign-apply-to">Apply to:</span>
            <div className={styles.applyToList} role="radiogroup" aria-labelledby="assign-apply-to">
              {APPLY_TO.map(o => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={applyTo === o.value}
                  className={[styles.applyRow, applyTo === o.value ? styles.applyRowPicked : ''].filter(Boolean).join(' ')}
                  onClick={() => setApplyTo(o.value)}
                >
                  <span className={styles.applyRadio} aria-hidden="true" />
                  <span className={styles.applyLabel}>{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <Button variant="outline" fullWidth onClick={close}>Cancel</Button>
          <Button
            fullWidth
            disabled={!member || saving}
            onClick={async () => { if (member && await onSave(member, applyTo) !== false) reset(); }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
