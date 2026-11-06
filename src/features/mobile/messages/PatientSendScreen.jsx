import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { supabase } from '../../../lib/supabase';
import { useAppStore } from '../../../store/useAppStore';
import { renderPreviewHtml } from '../../email-builder/renderEmail';
import { buildRecipientContext } from '../../email-builder/mergeTags';
import { formShareLink } from '../../forms/formLink';
import { listEducationContent } from '../../messages/comms/commsRepo';
import { formatPhone } from '../../messages/comms/commsUtils';
import {
  assessmentSms, composeWithTemplate, educationBlock, educationSms, firstNameOf, formsBlock,
} from '../../messages/comms/patientSendTemplates';
import {
  DEFAULT_ID_VERIFICATION, pickOneDecisionMaker, SECURE_SMS_PREFIX, verifyBlockers, verifyForSendTo, withDecisionMakers,
} from '../../messages/comms/sendTo';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import { VerifyIdCard } from '../../messages/comms/VerifyIdCard';
import { useMobileNav } from '../MobileNavContext';
import { EmailPreview } from './EmailPreview';
import { Field, FormShell, SendToList } from './MessageForm';
import { channelsFor, deliver, SEND_VIA } from './patientSend';
import styles from './messageForm.module.css';

const SMS_LIMIT = 480;
const DEFAULT_TEMPLATE = 'default';
const PRIORITIES = [{ key: 'High', label: 'High' }, { key: 'Medium', label: 'Medium' }, { key: 'Low', label: 'Low' }];

/** Content → Emails templates with a design, rendered for this patient (desktop PatientSendDrawers). */
function useSendTemplates(recipient, sender) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase.from('campaigns').select('id, name, email_template')
      .eq('channel', 'email').not('email_template', 'is', null).order('name').limit(100)
      .then(({ data }) => { if (alive) setRows(data || []); });
    return () => { alive = false; };
  }, []);
  return useMemo(() => {
    const ctx = buildRecipientContext(recipient, { providerName: sender?.name, clinicName: 'Fold Health' });
    return [
      { value: DEFAULT_TEMPLATE, label: 'Fold Care (default)', html: null },
      ...rows.map(r => ({ value: String(r.id), label: r.name, html: renderPreviewHtml(r.email_template, { recipient: ctx, wrapperPadding: '0' }) })),
    ];
  }, [rows, recipient, sender]);
}

/**
 * Send Education ('education') or Send Assessment ('assessment') to a
 * patient over email and / or SMS (desktop SendContentDrawer /
 * SendAssessmentDrawer). Opened for one patient: { kind, patient, initialFormIds? }.
 */
export function PatientSendScreen({ kind = 'education', patient: given, initialFormIds }) {
  const { pop } = useMobileNav();
  const education = kind === 'education';
  const { patients, me } = useCommsPeople();
  const match = patients.find(p => given?.id != null && String(p.id) === String(given.id)) || patients.find(p => p.name && p.name === given?.name);
  const recipient = useMemo(() => {
    const merged = { ...given, ...(match || {}) };
    return { ...merged, id: merged.id ?? null, name: merged.name || '', email: merged.email || '', phone: merged.phone || '' };
  }, [given, match]);
  const templates = useSendTemplates(recipient, me);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE);
  const [verifyId, setVerifyId] = useState(DEFAULT_ID_VERIFICATION);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  // Education
  const [content, setContent] = useState([]);
  const [contentId, setContentId] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [taskTitle, setTaskTitle] = useState('');
  const [via, setVia] = useState('emailOrSms');
  const [subject, setSubject] = useState('Fold Health | Educational Content for you');
  const [smsBody, setSmsBody] = useState('');
  const [smsEdited, setSmsEdited] = useState(false);
  // Assessment
  const [forms, setForms] = useState([]);
  const [formIds, setFormIds] = useState(() => (initialFormIds || []).map(String));

  useEffect(() => {
    let alive = true;
    if (education) listEducationContent().then((list) => { if (alive) setContent(list); });
    else {
      supabase.from('forms').select('id, name, status').order('updated_at', { ascending: false, nullsFirst: false }).limit(100)
        .then(({ data }) => { if (alive) setForms(data || []); });
    }
    return () => { alive = false; };
  }, [education]);

  // Send To: the patient and their recorded contacts.
  const contacts = useAppStore(st => (recipient.id != null ? st.patientContacts[recipient.id] : null));
  const fetchPatientContacts = useAppStore(st => st.fetchPatientContacts);
  useEffect(() => { if (recipient.id != null) fetchPatientContacts(recipient.id); }, [recipient.id, fetchPatientContacts]);
  const people = [
    { value: 'patient', name: recipient.name, email: recipient.email, phone: recipient.phone, dob: recipient.dob, type: 'Patient' },
    ...(contacts ? withDecisionMakers(contacts) : []).map(c => ({ value: String(c.id), name: c.name, email: c.email, phone: c.phone, dob: c.dob, type: c.type, missing: c.missing })),
  ];
  const [picked, setPicked] = useState(['patient']);
  const reachable = !!(recipient.email || recipient.phone);
  const shown = reachable ? picked : picked.filter(v => v !== 'patient');
  const hasRoles = (contacts || []).length > 0;
  const shownSet = new Set(shown);
  const targets = hasRoles ? people.filter(p => shownSet.has(p.value)) : (reachable ? [people[0]] : []);
  const pick = (v) => {
    const next = pickOneDecisionMaker(v, shown, x => people.find(p => p.value === x)?.type);
    const on = verifyForSendTo(next, shown);
    if (on !== null) setVerifyId(x => ({ ...x, on }));
    setPicked(next);
  };
  const withOthers = hasRoles && shown.some(v => v !== 'patient');
  const activeVerify = withOthers ? verifyId : { ...verifyId, on: false };
  const blockers = verifyBlockers(activeVerify, targets);

  const first = firstNameOf(recipient.name);
  const template = templates.find(t => t.value === templateId) || templates[0];
  const item = content.find(c => c.id === contentId);
  const formIdSet = new Set(formIds);
  const pickedForms = forms.filter(f => formIdSet.has(String(f.id))).map(f => ({ id: f.id, name: f.name, url: formShareLink(f.id) }));
  const html = composeWithTemplate({
    templateHtml: template?.html,
    introText: education ? `Hi ${first},\n\nYour care team thought this would be helpful.` : `Hi, ${first}\n\nPlease fill below forms to help us provide better care to you!`,
    blockHtml: education ? (item ? educationBlock(item) : '') : (pickedForms.length ? formsBlock(pickedForms) : ''),
    sender: { name: me?.name },
  });
  const smsText = education ? (smsEdited ? smsBody : (item ? educationSms(first, item) : '')) : assessmentSms(first, pickedForms);
  const showEmail = !education || via !== 'sms';
  const showSms = education && via !== 'email';
  const smsLimit = activeVerify.on ? SMS_LIMIT - SECURE_SMS_PREFIX : SMS_LIMIT;

  const reach = (p) => [p.email, p.phone && formatPhone(p.phone)].filter(Boolean).join(' • ');
  const blockedReason = busy ? null
    : education ? (!targets.length ? 'Choose who to send to.' : !item ? 'Choose the content to send.'
      : showEmail && !subject.trim() ? 'Add a subject.' : showSms && !smsText.trim() ? 'Add the SMS body.'
        : blockers.length ? "Someone in Send To can't verify their identity" : null)
      : (!pickedForms.length ? 'Pick a form' : !targets.some(t => t.email || t.phone) ? (hasRoles ? 'Pick someone with an email or phone on record' : "This member doesn't have an email or phone on record")
        : blockers.length ? "Someone in Send To can't verify their identity" : null);

  const send = async () => {
    setTouched(true);
    if (blockedReason) return;
    setBusy(true);
    // Stays busy once sent: the screen is closing and must not send twice.
    let ok = false;
    try {
      ok = education
        ? await deliver({
          recipient, me, via, targets, subject: subject.trim(), html, smsBody: smsText.trim(),
          meta: { kind: 'education', contentId: item.id, priority, taskTitle: taskTitle.trim() || null },
          verifyId: activeVerify,
        })
        : await deliver({
          recipient, me, via: 'emailOrSms', targets, subject: 'Forms from your care team', html, smsBody: smsText,
          meta: { kind: 'assessment', formIds: pickedForms.map(f => f.id) },
          verifyId: activeVerify,
        });
      if (ok && !education) {
        useAppStore.getState().recordAssessmentSends({
          patientId: recipient.id,
          formIds: pickedForms.map(f => f.id),
          sentByName: me?.name,
          channels: [...new Set(targets.flatMap((t) => {
            const ch = channelsFor('emailOrSms', t);
            return ch.email ? ['email'] : ch.sms ? ['sms'] : [];
          }))],
        });
      }
      if (ok) pop();
    } catch {
      ok = false;
      toast.error(education ? 'Could not send the content.' : 'Could not send the forms.');
    } finally {
      setBusy(!!ok);
    }
  };

  return (
    <FormShell
      title={education ? 'Send Content' : 'Send Assessment'}
      footer={<Button size="lg" fullWidth onClick={send} loading={busy} disabled={!!blockedReason && (touched || !education)}>{education ? 'Send' : 'Send Forms'}</Button>}
    >
      <Field label="Member" required><span className={styles.personName}>{recipient.name}</span></Field>
      {hasRoles && (
        <Field label="Send To" required error={touched && !targets.length ? 'Choose who to send to.' : undefined}>
          <SendToList
            people={people.map(p => ({ value: p.value, name: p.name, type: p.type, meta: reach(p) || 'No email or phone on record', disabled: !p.email && !p.phone }))}
            value={shown}
            onChange={pick}
          />
        </Field>
      )}
      {withOthers && <VerifyIdCard value={verifyId} onChange={setVerifyId} blockers={blockers} />}
      {education ? (
        <>
          <Select
            label="Member Education"
            required
            searchable
            searchPlaceholder="Search content"
            options={content.map(c => ({ value: c.id, label: c.title }))}
            value={contentId}
            onValueChange={(v) => { setContentId(v); setSmsEdited(false); }}
            placeholder="Search Content"
            errorText={touched && !item ? 'Choose the content to send.' : undefined}
          />
          <Field label="Priority" required>
            <SegmentedControl size="lg" fullWidth aria-label="Priority" value={priority} onValueChange={setPriority} items={PRIORITIES} />
          </Field>
          <Input label="Member Task Title" size="lg" value={taskTitle} onValueChange={setTaskTitle} placeholder="Enter Task Title" maxLength={150} />
          <Select label="Send Via" options={SEND_VIA} value={via} onValueChange={setVia} />
        </>
      ) : (
        <Select
          label="Form List"
          required
          multiple
          checkboxes
          badges
          searchable
          searchPlaceholder="Search form"
          options={forms.map(f => ({ value: String(f.id), label: f.name }))}
          value={formIds}
          onValueChange={setFormIds}
          placeholder="Search Form"
        />
      )}
      {showEmail && (
        <>
          <Select label="Template" required searchable options={templates} value={templateId} onValueChange={setTemplateId} />
          {education && <Input label="Subject" required size="lg" value={subject} onValueChange={setSubject} maxLength={200} errorText={touched && !subject.trim() ? 'Add a subject.' : undefined} />}
          <Field label="Email Preview">
            <EmailPreview html={html} />
          </Field>
        </>
      )}
      {showSms && (
        <Field label="SMS Body" required hint={`SMS body length is limited to ${SMS_LIMIT} characters • ${smsText.length + (activeVerify.on ? SECURE_SMS_PREFIX : 0)}/${SMS_LIMIT}`}>
          <Textarea
            highlightLinks
            value={smsText}
            onChange={e => { setSmsEdited(true); setSmsBody(e.target.value.slice(0, smsLimit)); }}
            placeholder="Enter SMS Body"
            rows={5}
            aria-label="SMS body"
          />
        </Field>
      )}
      {blockedReason && touched && <span className={`${styles.hint} ${styles.error}`}>{blockedReason}</span>}
    </FormShell>
  );
}
