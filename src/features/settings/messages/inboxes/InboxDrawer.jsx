import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Input } from '../../../../components/Input/Input';
import { Select } from '../../../../components/Select/Select';
import { INBOX_TYPES } from './inboxesMock';
import styles from '../efax/EfaxSettings.module.css';

const TYPE_OPTIONS = Object.entries(INBOX_TYPES).map(([value, label]) => ({ value, label }));
const digits = (v) => String(v || '').replace(/\D/g, '');
const validAddress = (channel, v) => (channel === 'email'
  ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())
  : digits(v).length >= 10);

/**
 * New / Edit Inbox drawer (Settings > Messages > Inboxes): its name, type
 * (SMS or Outlook), the number or email address, and the collaborators, who
 * are the inbox's assignees.
 *
 * @param {object}   props
 * @param {object}   [props.inbox]     – the inbox being edited
 * @param {Array}    props.users       – platformUsers [{ id, name }]
 * @param {string[]} [props.collaboratorIds] – its collaborators' ids (resolved by the panel)
 * @param {Array}    props.existing    – all inboxes (duplicate check)
 * @param {function} props.onSave      – ({ name, channel, address, collaboratorIds }) => void
 * @param {function} props.onClose
 */
export function InboxDrawer({ inbox, users = [], collaboratorIds: initialIds = [], existing = [], onSave, onClose }) {
  const [name, setName] = useState(inbox?.name || '');
  const [channel, setChannel] = useState(inbox?.channel || 'sms');
  const [address, setAddress] = useState(inbox?.address || '');
  const [collaboratorIds, setCollaboratorIds] = useState(initialIds);
  const [touched, setTouched] = useState(false);

  const same = (a, b) => (channel === 'email' ? a.trim().toLowerCase() === b.trim().toLowerCase() : digits(a) === digits(b));
  const duplicate = validAddress(channel, address) && existing.some(i => i.id !== inbox?.id && i.channel === channel && same(i.address, address));
  const addressError = duplicate
    ? `This ${channel === 'email' ? 'email address' : 'number'} already has an inbox`
    : touched && address && !validAddress(channel, address) ? (channel === 'email' ? 'Enter an email address' : 'Enter a 10-digit phone number') : undefined;
  const canSave = !!name.trim() && validAddress(channel, address) && !duplicate;

  return (
    <Drawer
      title={inbox ? 'Edit Inbox' : 'New Inbox'}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <div className={styles.headerRight}>
          <Button disabled={!canSave} onClick={() => onSave({ name: name.trim(), channel, address: address.trim(), collaboratorIds })}>
            {inbox ? 'Save' : 'Add'}
          </Button>
          <span className={styles.headerDivider} />
        </div>
      )}
    >
      <div className={styles.form}>
        <Input label="Inbox Name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Line" autoFocus />
        <Select label="Inbox Type" required options={TYPE_OPTIONS} value={channel} onValueChange={v => { setChannel(v); setTouched(false); }} />
        <Input
          label={channel === 'email' ? 'Email Address' : 'Phone Number'}
          required
          type={channel === 'email' ? 'email' : 'tel'}
          leadingIcon={channel === 'email' ? 'solar:letter-linear' : 'solar:phone-linear'}
          value={address}
          onChange={e => setAddress(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={channel === 'email' ? 'name@practice.com' : '+1 (000) 000-0000'}
          errorText={addressError}
        />
        <Select
          label="Collaborators"
          multiple
          searchable
          checkboxes
          badges
          searchPlaceholder="Search users"
          options={users.map(u => ({ value: u.id, label: u.name }))}
          value={collaboratorIds}
          onValueChange={setCollaboratorIds}
          placeholder="Select users"
          helperText="Collaborators are this inbox's assignees: its conversations are their work."
        />
      </div>
    </Drawer>
  );
}
