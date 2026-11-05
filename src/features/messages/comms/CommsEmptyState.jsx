import { useRef, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import allArt from '../../../assets/comms/all.svg';
import chatArt from '../../../assets/comms/chat.svg';
import emailArt from '../../../assets/comms/email.svg';
import smsArt from '../../../assets/comms/sms.svg';
import callsArt from '../../../assets/comms/calls.svg';
import internalArt from '../../../assets/comms/internal.svg';
import efaxArt from '../../../assets/comms/efax.svg';
import styles from './CommsEmptyState.module.css';

// Per Comms view (Figma Oct-Nov 2025, "No conversations present" 1707:71560):
// the list's ring empty state, and the illustration + create button that
// fill the reading pane.
const VIEWS = {
  all:      { art: allArt, icon: 'solar:chat-round-linear', empty: 'No conversations present', cta: 'Start New Conversation', create: 'menu' },
  chat:     { art: chatArt, icon: 'solar:chat-round-linear', empty: 'No Chat Conversations Present', cta: 'Create New Chat', create: 'chat' },
  email:    { art: emailArt, icon: 'solar:letter-linear', empty: 'No Email Conversations Present', cta: 'Compose New Email', create: 'email' },
  sms:      { art: smsArt, icon: 'solar:chat-square-linear', empty: 'No SMS Conversations Present', cta: 'Send New SMS', create: 'sms' },
  calls:    { art: callsArt, icon: 'solar:phone-calling-linear', empty: 'No Call Records Present', cta: 'Initiate New Call', create: 'call' },
  internal: { art: internalArt, icon: 'solar:user-speak-linear', empty: 'No Internal Chat Present', cta: 'Create New Internal Chat', create: 'internal' },
  efax:     { art: efaxArt, icon: 'solar:printer-linear', empty: 'No e-Fax Conversations Present', cta: 'Create New eFax', create: null },
};
// Inbox filters borrow their channel's look.
const ALIASES = { missed: 'calls', starred: 'all', archived: 'all', assigned: 'all', mentions: 'all', others: 'all', unassigned: 'all' };
const view = (key) => VIEWS[ALIASES[key] || key] || VIEWS.all;

// "Start New Conversation" menu (Figma 2119:14522).
const START_ITEMS = [
  { key: 'chat', icon: 'solar:chat-round-linear', label: 'New Chat' },
  { key: 'email', icon: 'solar:letter-linear', label: 'New Email' },
  { key: 'sms', icon: 'solar:chat-square-linear', label: 'Send SMS' },
  { key: 'call', icon: 'solar:phone-calling-linear', label: 'Make a Voice Call' },
  { key: 'efax', icon: 'solar:printer-linear', label: 'Send eFax', disabled: true, hint: 'Coming soon' },
  { key: 'internal', icon: 'solar:user-speak-linear', label: 'New Internal Chat' },
];

/** The list column with nothing in it. `label` overrides the default line. */
export function CommsListEmpty({ viewKey, label }) {
  const v = view(viewKey);
  // Fills the list's scroll area so the ring sits in its vertical centre.
  return (
    <div className={styles.listEmpty}>
      <EmptyState icon={v.icon} iconSize={30} title={label || v.empty} />
    </div>
  );
}

/**
 * The reading pane when nothing is open: with no conversations at all, the
 * view's illustration and its create button; otherwise "No Conversation
 * Selected" (Figma 1682:2868). `onCreate(type)` opens the matching drawer.
 */
export function CommsPanelEmpty({ viewKey, hasConversations, onCreate }) {
  const v = view(viewKey);
  const btnRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.panel}>
      <img src={v.art} alt="" className={styles.art} />
      {hasConversations ? (
        <div className={styles.text}>
          <span className={styles.title}>No Conversation Selected</span>
          <span className={styles.sub}>Select a conversation to read</span>
        </div>
      ) : v.create === 'menu' ? (
        <>
          <Button
            ref={btnRef}
            leadingIcon="solar:add-circle-linear"
            trailingIcon="solar:alt-arrow-down-linear"
            onClick={() => setMenuOpen(o => !o)}
          >
            {v.cta}
          </Button>
          {menuOpen && (
            <MenuPopover
              anchorRef={btnRef}
              align="left"
              width={224}
              items={START_ITEMS}
              onSelect={(key) => { setMenuOpen(false); onCreate(key); }}
              onClose={() => setMenuOpen(false)}
              ariaLabel="Start new conversation"
            />
          )}
        </>
      ) : (
        <Button
          leadingIcon="solar:add-circle-linear"
          disabled={!v.create}
          onClick={() => onCreate(v.create)}
        >
          {v.cta}
        </Button>
      )}
    </div>
  );
}
