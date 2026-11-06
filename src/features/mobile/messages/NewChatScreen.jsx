import { useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Select } from '../../../components/Select/Select';
import { toast } from '../../../components/Toast/sonnerToast';
import { findOrCreateConversation, updateConversation } from '../../messages/comms/commsRepo';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import { useMobileNav } from '../MobileNavContext';
import { Field, FormShell } from './MessageForm';

/**
 * New Chat (desktop CommsDrawers NewChatDrawer): an Internal Chat with one
 * Fold user, or a chat with a patient that internal users join as members.
 */
export function NewChatScreen({ initialType = 'patient' }) {
  const { replace } = useMobileNav();
  const { patients, staff, me } = useCommsPeople();
  const [type, setType] = useState(initialType);
  const [patientId, setPatientId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [subject, setSubject] = useState('');
  const [members, setMembers] = useState([]);
  const [staffId, setStaffId] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const patient = patients.find(p => String(p.id) === patientId);
  const staffOptions = staff.filter(s => s.id !== me?.id).map(s => ({ value: s.id, label: s.name }));

  const start = async () => {
    setTouched(true);
    if (type === 'internal') {
      const person = staff.find(s => s.id === staffId);
      if (!person) return;
      replace('internalThread', { userId: person.id, profile: { id: person.id, full_name: person.name, email: person.email } });
      return;
    }
    if (!patient || !groupName.trim()) return;
    setSaving(true);
    // Stays saving once opened: this screen is being replaced by the thread.
    let opened = null;
    try {
      const memberIds = new Set(members);
      const conv = await findOrCreateConversation('chat', patient, {
        group_name: groupName.trim(),
        subject: subject.trim() || null,
        members: staff.filter(s => memberIds.has(s.id)).map(s => ({ id: s.id, name: s.name })),
        created_by: me?.id || null,
        created_by_name: me?.name || null,
      });
      opened = conv;
      if (conv.group_name !== groupName.trim() || (subject.trim() && conv.subject !== subject.trim())) {
        opened = await updateConversation(conv.id, { group_name: groupName.trim(), subject: subject.trim() || conv.subject }) || conv;
      }
      replace('thread', { conversation: opened });
    } catch {
      opened = null;
      toast.error('Could not start the chat.');
    } finally {
      setSaving(!!opened);
    }
  };

  return (
    <FormShell
      title="New Chat"
      footer={<Button size="lg" fullWidth onClick={start} loading={saving}>Start Chat</Button>}
    >
      <Field label="Type">
        <SegmentedControl
          size="lg"
          fullWidth
          aria-label="Chat type"
          value={type}
          onValueChange={(v) => { setType(v); setTouched(false); }}
          items={[{ key: 'patient', label: 'With Patient' }, { key: 'internal', label: 'Internal' }]}
        />
      </Field>
      {type === 'internal' ? (
        <Select
          label="Internal User"
          required
          searchable
          options={staffOptions}
          value={staffId}
          onValueChange={setStaffId}
          placeholder="Select user"
          errorText={touched && !staffId ? 'Choose who to chat with.' : undefined}
        />
      ) : (
        <>
          <Select
            label="Patient"
            required
            searchable
            helperText="The patient reads and answers this chat on their patient page."
            options={patients.map(p => ({ value: String(p.id), label: p.name }))}
            value={patientId}
            onValueChange={(v) => {
              setPatientId(v);
              const p = patients.find(x => String(x.id) === v);
              if (p && !groupName) setGroupName(`Care for ${p.name}`);
            }}
            placeholder="Select Patient"
            errorText={touched && !patientId ? 'Choose a patient.' : undefined}
          />
          <Input
            label="Group Name"
            required
            size="lg"
            value={groupName}
            onValueChange={setGroupName}
            placeholder="Enter Group Name"
            maxLength={100}
            errorText={touched && patientId && !groupName.trim() ? 'Give the chat a name.' : undefined}
          />
          <Input label="Subject" size="lg" value={subject} onValueChange={setSubject} placeholder="Enter Subject of Conversation" maxLength={150} />
          <Select
            label="Internal Users"
            multiple
            checkboxes
            badges
            searchable
            searchPlaceholder="Search users"
            disabled={!patient}
            options={staffOptions}
            value={members}
            onValueChange={setMembers}
            placeholder="Select user"
          />
        </>
      )}
    </FormShell>
  );
}
