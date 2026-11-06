import { useEffect, useMemo, useState } from 'react';
import { Banner } from '../../../components/Banner/Banner';
import { Button } from '../../../components/Button/Button';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { findOrCreateConversation } from '../../messages/comms/commsRepo';
import { sendSms } from '../../messages/comms/commsSend';
import { formatPhone, toE164 } from '../../messages/comms/commsUtils';
import {
  DEFAULT_ID_VERIFICATION, hasLink, pickOneDecisionMaker, protectSms, SECURE_SMS_PREFIX, verifyBlockers,
  verifyForSendTo, withDecisionMakers,
} from '../../messages/comms/sendTo';
import { forPrefix, keepPrefix, memberLabel, membersForConversation, withForPrefix } from '../../messages/comms/smsMembers';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import { VerifyIdCard } from '../../messages/comms/VerifyIdCard';
import { useMobileNav } from '../MobileNavContext';
import { Field, FormShell, SendToList } from './MessageForm';
import styles from './messageForm.module.css';

const PHI_NOTICE = 'Do not send PHI via email or text without verifying and obtaining consent.';
const SMS_LIMIT = 500;
const firstName = (name) => String(name || '').trim().split(/\s+/)[0];

/**
 * New SMS (desktop CommsDrawers NewSmsDrawer): to a patient, or to any
 * phone number typed in. Same Send To, Protect links, shared-number Log For
 * and "For Liam: " rules as desktop.
 */
export function NewSmsScreen({ initialPatient }) {
  const { pop } = useMobileNav();
  const { patients, me, line } = useCommsPeople();
  const [to, setTo] = useState(initialPatient ? String(initialPatient.id) : '');
  const [query, setQuery] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const typedNumber = toE164(query);
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = patients
      .filter(p => p.phone && (!q || `${p.name} ${p.phone}`.toLowerCase().includes(q)))
      .slice(0, 50)
      .map(p => ({ value: String(p.id), label: `${p.name} • ${formatPhone(p.phone)}`, triggerLabel: p.name }));
    if (typedNumber.replace(/\D/g, '').length >= 10) list.unshift({ value: `num:${typedNumber}`, label: `Send to ${formatPhone(typedNumber)}` });
    if (to && !list.some(o => o.value === to)) {
      const p = patients.find(x => String(x.id) === to) || (initialPatient && String(initialPatient.id) === to ? initialPatient : null);
      if (p) list.unshift({ value: String(p.id), label: `${p.name} • ${formatPhone(p.phone)}`, triggerLabel: p.name });
      else if (to.startsWith('num:')) list.unshift({ value: to, label: formatPhone(to.slice(4)) });
    }
    return list;
  }, [patients, query, typedNumber, to, initialPatient]);

  const recipient = to.startsWith('num:')
    ? { id: null, name: formatPhone(to.slice(4)), phone: to.slice(4) }
    : (patients.find(p => String(p.id) === to) || (initialPatient && String(initialPatient.id) === to ? initialPatient : undefined));

  const patient = recipient?.id ? recipient : null;
  const contacts = useAppStore(st => (patient ? st.patientContacts[patient.id] : null));
  const fetchPatientContacts = useAppStore(st => st.fetchPatientContacts);
  useEffect(() => { if (patient?.id) fetchPatientContacts(patient.id); }, [patient?.id, fetchPatientContacts]);
  const people = patient ? [
    { value: 'patient', label: patient.name, phone: patient.phone, email: patient.email, dob: patient.dob, type: 'Patient' },
    ...(contacts ? withDecisionMakers(contacts) : []).map(c => ({ value: c.id, label: c.name, phone: c.phone, email: c.email, dob: c.dob, type: c.type, missing: c.missing })),
  ] : [];
  const memberPick = (id) => (id && !id.startsWith('num:') ? ['patient'] : []);
  const [picked, setPicked] = useState(() => memberPick(to));
  const [logForId, setLogForId] = useState(null);
  const [appliedTag, setAppliedTag] = useState(null);
  const [pickedFor, setPickedFor] = useState(to);
  const [verifyId, setVerifyId] = useState(DEFAULT_ID_VERIFICATION);
  if (pickedFor !== to) { setPickedFor(to); setPicked(memberPick(to)); setLogForId(null); setAppliedTag(null); setBody(b => withForPrefix(b, null)); }
  const hasRoles = !!patient && (contacts || []).length > 0;
  const targets = hasRoles
    ? people.filter(o => picked.includes(o.value) && o.phone)
    : recipient?.phone ? [{ label: recipient.name, phone: recipient.phone }] : [];
  const updatePicked = (raw) => {
    const next = pickOneDecisionMaker(raw, picked, id => people.find(o => o.value === id)?.type);
    const on = verifyForSendTo(next, picked);
    if (on !== null) setVerifyId(x => ({ ...x, on }));
    setPicked(next);
  };

  const withOthers = hasRoles && targets.some(t => t.value !== 'patient');
  const protect = withOthers && verifyId.on && hasLink(body);
  const blockers = protect ? verifyBlockers(verifyId, targets.map(t => (patient ? { ...t, name: t.label } : { phone: t.phone }))) : [];

  // A number several members share (FCS-5677): the SMS is logged for one, and starts "For Liam: ".
  const members = recipient?.phone ? membersForConversation({
    patient_id: recipient.id, patient_name: recipient.name, patient_phone: recipient.phone,
  }, patients) : [];
  const sharedNumber = members.length > 1;
  const logFor = sharedNumber ? (members.find(m => m.id === logForId) || members[0]) : null;
  const tagName = sharedNumber ? logFor.name : null;
  if (tagName !== appliedTag) {
    setAppliedTag(tagName);
    setBody(b => withForPrefix(b, tagName));
  }
  const editBody = (value) => setBody(prev => (tagName ? keepPrefix(value, forPrefix(tagName), prev) : value));
  const hasText = !!(tagName ? body.slice(forPrefix(tagName).length) : body).trim();
  const limit = protect ? SMS_LIMIT - SECURE_SMS_PREFIX : SMS_LIMIT;

  const blockedReason = !recipient ? 'Pick a member or type a number'
    : !targets.length ? (hasRoles ? 'Pick who to text' : "This member doesn't have a phone number on record")
      : !hasText ? 'Write a message'
        : blockers.length ? "Someone in Send To can't verify their identity"
          : null;

  const send = async () => {
    if (blockedReason || sending) return;
    setSending(true);
    const phone = toE164(recipient.phone);
    const secured = protect ? protectSms(body.trim()) : null;
    const text = secured ? secured.text : body.trim();
    const meta = secured ? { verifyId, secureLinks: secured.links } : undefined;
    try {
      const conv = await findOrCreateConversation('sms', { ...recipient, phone }, { patient_phone: phone });
      const sent = [];
      for (const t of targets) {
        sent.push(await sendSms({
          conversation: conv, sender: { id: me?.id, name: me?.name }, to: toE164(t.phone), body: text, meta,
          loggedFor: logFor ? { id: logFor.id, name: logFor.name } : undefined,
        }));
      }
      const failed = sent.filter(m => m?.status === 'failed');
      if (failed.length) toast.error(`SMS not sent: ${failed[0].failure_reason}`);
      else toast.success('SMS Sent Successfully');
      pop();
    } catch {
      toast.error('Could not send the SMS.');
      setSending(false);
    }
  };

  return (
    <FormShell
      title="New SMS"
      footer={<Button size="lg" fullWidth onClick={send} loading={sending} disabled={!!blockedReason}>Send</Button>}
    >
      <Banner>{PHI_NOTICE}</Banner>
      <Field label="Send Via" required><span className={styles.personMeta}>{line.label} (Default)</span></Field>
      <Select
        label="To"
        required
        disabled={!!initialPatient}
        searchable
        query={query}
        onQueryChange={setQuery}
        options={options}
        value={to}
        onValueChange={setTo}
        placeholder="Search Member or Type Number"
        searchPlaceholder="Search Member or Type Number"
        emptyText="No patients with a phone number match"
        helperText="Search a patient, or type a phone number."
      />
      {hasRoles && (
        <Field label="Send To" required>
          <SendToList
            people={people.map(o => ({ value: o.value, name: o.label, type: o.type, meta: o.phone ? formatPhone(o.phone) : 'No phone number on record', disabled: !o.phone }))}
            value={picked}
            onChange={updatePicked}
          />
        </Field>
      )}
      {withOthers && <VerifyIdCard value={verifyId} onChange={setVerifyId} blockers={blockers} hint="Applies to any links in the message" />}
      {sharedNumber && (
        <Select
          label="Log this SMS For"
          required
          helperText={`${firstName(recipient?.name)}'s number is shared by ${members.length} people. Choose who to log this SMS for.`}
          options={members.map(m => ({ value: m.id, label: memberLabel(m) }))}
          value={logFor.id}
          onValueChange={setLogForId}
        />
      )}
      <Field label="Message" required>
        <Textarea
          highlightLinks
          value={body}
          onChange={e => editBody(e.target.value.slice(0, limit))}
          placeholder="Type message here"
          rows={6}
          aria-label="Message"
        />
        <span className={`${styles.hint} ${styles.hintRow}`}>
          <span>{blockedReason && recipient ? blockedReason : ''}</span>
          <span>{body.length + (protect ? SECURE_SMS_PREFIX : 0)}/{SMS_LIMIT}</span>
        </span>
      </Field>
    </FormShell>
  );
}
