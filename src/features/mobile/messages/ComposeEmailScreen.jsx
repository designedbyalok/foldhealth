import { useEffect, useMemo, useState } from 'react';
import { Banner } from '../../../components/Banner/Banner';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { isEmailAddress } from '../../../components/RecipientInput/isEmailAddress';
import { RecipientInput } from '../../../components/RecipientInput/RecipientInput';
import { Select } from '../../../components/Select/Select';
import { Switch } from '../../../components/Switch/Switch';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { applyMergeTags, buildRecipientContext } from '../../email-builder/mergeTags';
import { addMessage, findOrCreateConversation } from '../../messages/comms/commsRepo';
import { sendEmail } from '../../messages/comms/commsSend';
import { DEFAULT_SUBJECT, DEFAULT_TEMPLATE_ID, defaultBodyText, textToHtml } from '../../messages/comms/defaultEmailTemplate';
import {
  DEFAULT_ID_VERIFICATION, hasLink, pickOneDecisionMaker, protectHtml, verifyBlockers, verifyForSendTo, withDecisionMakers,
} from '../../messages/comms/sendTo';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import { useEmailTemplates, withBody } from '../../messages/comms/useEmailTemplates';
import { VerifyIdCard } from '../../messages/comms/VerifyIdCard';
import { useMobileNav } from '../MobileNavContext';
import { EmailPreview } from './EmailPreview';
import { Field, FormShell, SendToList } from './MessageForm';
import styles from './messageForm.module.css';

const PHI_NOTICE = 'Do not send PHI via email or text without verifying and obtaining consent.';
const FROM_ADDRESS = 'noreply@foldhealth.org';
const htmlToText = (html) => {
  const d = new DOMParser().parseFromString(html || '', 'text/html');
  d.querySelectorAll('style,script').forEach(n => n.remove());
  return (d.body?.innerText || d.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};

/**
 * Send Email on the phone (Figma 1041:38603; desktop ComposeEmailDrawer):
 * pick the patient (fixed when opened for one), who in Send To, Cc / Bcc,
 * subject, an email template, and the message. Sends through sendEmail into
 * the patient's email thread, or saves a draft.
 *
 * Props: { patient?: { id, name, email, phone }, conversation?, subject?, bodyText? }
 */
export function ComposeEmailScreen({ patient: given, conversation: givenConv, subject: givenSubject, bodyText }) {
  const { pop } = useMobileNav();
  const { patients, me } = useCommsPeople();
  const sender = useMemo(() => ({ name: me?.name || 'Care team', email: me?.email || '' }), [me]);
  const [patientId, setPatientId] = useState(given?.id != null ? String(given.id) : '');
  const patient = patients.find(p => String(p.id) === patientId) || (given && String(given.id) === patientId ? given : null);
  const [picked, setPicked] = useState(() => (given?.email ? ['patient'] : []));
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(givenSubject ?? DEFAULT_SUBJECT);
  const [useTemplate, setUseTemplate] = useState(true);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [text, setText] = useState(() => bodyText || defaultBodyText((given?.name || '').split(/\s+/)[0]));
  const [verifyId, setVerifyId] = useState(DEFAULT_ID_VERIFICATION);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const contacts = useAppStore(st => (patient ? st.patientContacts[patient.id] : null));
  const fetchPatientContacts = useAppStore(st => st.fetchPatientContacts);
  useEffect(() => { if (patient?.id) fetchPatientContacts(patient.id); }, [patient?.id, fetchPatientContacts]);
  const people = patient ? [
    { value: 'patient', name: patient.name, email: patient.email, phone: patient.phone, dob: patient.dob, type: 'Patient' },
    ...(contacts ? withDecisionMakers(contacts) : []).map(c => ({ value: c.id, name: c.name, email: c.email, phone: c.phone, dob: c.dob, type: c.type, missing: c.missing })),
  ] : [];
  const hasRoles = !!patient && (contacts || []).length > 0;
  const sendToPicked = hasRoles ? picked : (patient?.email ? ['patient'] : []);
  const withOthers = hasRoles && sendToPicked.some(v => v !== 'patient');
  const body = textToHtml(text);
  const protectable = withOthers && (useTemplate || hasLink(text));
  const blockers = protectable ? verifyBlockers(verifyId, people.filter(o => sendToPicked.includes(o.value))) : [];
  const to = people.filter(o => sendToPicked.includes(o.value)).map(o => o.email).filter(Boolean);

  const recipientCtx = useMemo(
    () => buildRecipientContext(patient || { name: '' }, { providerName: sender.name, clinicName: 'Fold Health' }),
    [patient, sender.name],
  );
  const templates = useEmailTemplates(recipientCtx, sender);
  const template = templates.find(t => t.id === templateId) || templates[0];
  const shell = useMemo(() => template.render(), [template]);
  const currentHtml = () => applyMergeTags(useTemplate
    ? withBody(shell, body)
    : `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#3A485F">${body}</body></html>`, recipientCtx);

  const blockedReason = busy ? null
    : !patient ? 'Pick a patient'
      : !to.length ? (hasRoles ? 'Pick who to send to' : "This patient doesn't have an email address on record")
        : !to.every(isEmailAddress) ? 'Fix the email address in Send To'
          : !subject.trim() ? 'Add a subject'
            : !text.trim() ? 'Write a message first'
              : blockers.length ? "Someone in Send To can't verify their identity"
                : null;

  const pickPatient = (id) => {
    setPatientId(id);
    const p = patients.find(x => String(x.id) === id);
    setPicked(p?.email ? ['patient'] : []);
    if (!bodyText) setText(defaultBodyText((p?.name || '').split(/\s+/)[0]));
  };
  const updatePicked = (v) => {
    const next = pickOneDecisionMaker(v, picked, id => people.find(o => o.value === id)?.type);
    const on = verifyForSendTo(next, picked);
    if (on !== null) setVerifyId(x => ({ ...x, on }));
    setPicked(next);
  };
  const pickTemplate = (id) => {
    const t = templates.find(x => x.id === id);
    setTemplateId(id);
    if (t?.subject) setSubject(t.subject);
  };

  const conversationFor = () => givenConv
    || findOrCreateConversation('email', patient, { patient_email: to[0], subject: subject.trim() });

  const send = async () => {
    setTouched(true);
    if (blockedReason) return;
    setBusy(true);
    try {
      const conversation = await conversationFor();
      const secured = protectable && verifyId.on ? protectHtml(currentHtml()) : null;
      const html = secured ? secured.html : currentHtml();
      const result = await sendEmail({
        conversation,
        sender: { id: me?.id, name: sender.name },
        from: FROM_ADDRESS,
        to, cc, bcc,
        subject: subject.trim(),
        html,
        body: htmlToText(html),
        meta: { verifyId: secured ? verifyId : null, ...(secured ? { secureLinks: secured.links } : {}) },
      });
      if (result?.status === 'failed') toast.error(`Email not sent: ${result.failure_reason}`);
      else toast.success('Email Sent Successfully');
      pop();
    } catch {
      toast.error('Could not send the email.');
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!patient) { toast.error('Pick a patient first.'); return; }
    setBusy(true);
    try {
      const conversation = await conversationFor();
      await addMessage({
        conversation_id: conversation.id, kind: 'email', direction: 'out', status: 'draft',
        sender_id: me?.id || null, sender_name: sender.name, from_addr: FROM_ADDRESS,
        subject: subject.trim(), to_addr: to.join(', '), cc: cc.join(', ') || null, bcc: bcc.join(', ') || null,
        html: useTemplate ? currentHtml() : null, body: htmlToText(body), meta: { templateId: template.id, useTemplate },
      });
      toast.success('Saved To Drafts Successfully');
      pop();
    } catch {
      toast.error('Could not save the draft.');
      setBusy(false);
    }
  };

  const patientOptions = (given && !patients.some(p => String(p.id) === String(given.id)) ? [given, ...patients] : patients)
    .map(p => ({ value: String(p.id), label: p.email ? `${p.name} • ${p.email}` : p.name, triggerLabel: p.name }));

  return (
    <FormShell
      title="Send Email"
      footer={(
        <>
          <Button size="lg" variant="outline" onClick={saveDraft} disabled={busy}>Save Draft</Button>
          <Button size="lg" leadingIcon="solar:plain-2-linear" onClick={send} loading={busy} disabled={!!blockedReason}>Send</Button>
        </>
      )}
    >
      <Banner>{PHI_NOTICE}</Banner>
      <Select
        label="Patient"
        required
        disabled={!!given}
        searchable
        options={patientOptions}
        value={patientId}
        onValueChange={pickPatient}
        placeholder="Search patient"
        searchPlaceholder="Search by name"
        emptyText="No matching patients."
      />
      {hasRoles ? (
        <Field label="Send To" required>
          <SendToList
            people={people.map(o => ({ value: o.value, name: o.name, type: o.type, meta: o.email || 'No email address on record', disabled: !o.email }))}
            value={picked}
            onChange={updatePicked}
          />
        </Field>
      ) : patient && (
        <Field label="To" required error={!patient.email ? "This patient doesn't have an email address on record" : undefined}>
          <span className={styles.personName}>{patient.email || ''}</span>
        </Field>
      )}
      {withOthers && <VerifyIdCard value={verifyId} onChange={setVerifyId} blockers={blockers} hint="Applies to any links in the email" />}
      {showCc ? (
        <>
          <RecipientInput label="Cc" value={cc} onChange={setCc} />
          <RecipientInput label="Bcc" value={bcc} onChange={setBcc} />
        </>
      ) : (
        <Button size="lg" variant="ghost" onClick={() => setShowCc(true)}>Add Cc / Bcc</Button>
      )}
      <Input label="Subject" required size="lg" value={subject} onValueChange={setSubject} maxLength={200} errorText={touched && !subject.trim() ? 'Add a subject.' : undefined} />
      <Switch checked={useTemplate} onChange={setUseTemplate} label="Email Template" />
      {useTemplate && (
        <Select
          label="Template"
          searchable
          options={templates.map(t => ({ value: t.id, label: `${t.name} (${t.category})`, triggerLabel: t.name }))}
          value={template.id}
          onValueChange={pickTemplate}
        />
      )}
      <Textarea rows={8} title="Message" value={text} onValueChange={setText} placeholder="Type message here" aria-label="Message" />
      {useTemplate && (
        <Field label="Preview">
          <EmailPreview html={currentHtml()} />
        </Field>
      )}
    </FormShell>
  );
}
