import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { PriorityIcon } from '../../../components/PriorityIcon/PriorityIcon';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { DownChevronIcon } from '../../../components/Icon/DownChevronIcon';
import { Select } from '../../../components/Select/Select';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { TabStrip } from '../../../components/TabStrip/TabStrip';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { toast } from '../../../components/Toast/sonnerToast';
import { supabase } from '../../../lib/supabase';
import { renderPreviewHtml } from '../../email-builder/renderEmail';
import { buildRecipientContext } from '../../email-builder/mergeTags';
import { formShareLink } from '../../forms/formLink';
import { findOrCreateConversation, listEducationContent } from './commsRepo';
import { sendEmail, sendSms } from './commsSend';
import { useCommsPeople } from './useCommsPeople';
import { EmailCanvas } from './EmailCanvas';
import { toE164 } from './commsUtils';
import {
  firstNameOf, educationBlock, formsBlock, composeWithTemplate, educationSms, assessmentSms,
} from './patientSendTemplates';
import { useAppStore } from '../../../store/useAppStore';
import {
  personMeta, withDecisionMakers, pickOneDecisionMaker, verifyForSendTo, DEFAULT_ID_VERIFICATION, verifyBlockers, protectSms, protectHtml, SECURE_SMS_PREFIX, SEND_TO_INFO, SEND_TO_PLACEHOLDER, sendToChipLabel,
} from './sendTo';
import { VerifyIdCard, VerifyIdField, VerifyIdStack, VerifyIdReveal } from './VerifyIdCard';
import { PersonOption, PersonTip } from './PersonOption';
import styles from './PatientSendDrawers.module.css';

const FROM_ADDRESS = 'noreply@foldhealth.org';
const SMS_LIMIT = 480;
const DEFAULT_TEMPLATE = 'default';

const PRIORITIES = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const SEND_VIA = [
  { value: 'email', label: 'Email only' },
  { value: 'sms', label: 'SMS only' },
  { value: 'both', label: 'Email and SMS' },
  { value: 'emailOrSms', label: 'Email, or SMS if there is no email' },
];

/**
 * The Member (patient) the send is about: starts on the one the drawer was
 * opened for, and can be changed like in New SMS / Compose Email.
 */
function useMember(initialPatient) {
  const { patients } = useCommsPeople();
  const [memberId, setMemberId] = useState(initialPatient?.id != null ? String(initialPatient.id) : '');
  const options = useMemo(() => {
    const list = initialPatient && !patients.some(p => String(p.id) === String(initialPatient.id))
      ? [initialPatient, ...patients] : patients;
    return list.map(p => ({
      value: String(p.id),
      triggerLabel: p.name,
      searchText: p.name,
      label: <PersonOption name={p.name} initials={p.initials} meta={personMeta(p)} />,
    }));
  }, [patients, initialPatient]);
  const member = patients.find(p => String(p.id) === memberId)
    || (initialPatient && String(initialPatient.id) === memberId ? initialPatient : null);
  // Opened for a patient (P360, a worklist row), the member is fixed.
  return { memberId, setMemberId, options, member, locked: initialPatient?.id != null };
}

function MemberField({ memberId, setMemberId, options, locked }) {
  return (
    <Select
      disabled={locked}
      searchable
      options={options}
      value={memberId}
      onChange={setMemberId}
      placeholder="Search Member"
      searchPlaceholder="Search by name"
      emptyText="No matching patients."
    />
  );
}

/** The patient record behind a worklist row: the all_patients row when found. */
function useRecipient(patient) {
  const { patients, me } = useCommsPeople();
  const match = patients.find(p => (patient?.id != null && String(p.id) === String(patient.id)))
    || patients.find(p => p.name && p.name === patient?.name);
  // Stable while the inputs are, so the email preview doesn't reload.
  const recipient = useMemo(() => {
    const merged = { ...patient, ...(match || {}) };
    return { ...merged, id: merged.id ?? null, name: merged.name || '', email: merged.email || '', phone: merged.phone || '' };
  }, [patient, match]);
  return { me, recipient };
}

/** Content → Emails templates with a design, rendered for this patient. */
function useEmailTemplates(recipient, sender) {
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

/** Pick the channels a send goes out on, given what the patient has. */
function channelsFor(via, recipient) {
  const hasEmail = !!recipient.email;
  const hasPhone = !!recipient.phone;
  if (via === 'email') return { email: hasEmail, sms: false };
  if (via === 'sms') return { email: false, sms: hasPhone };
  if (via === 'both') return { email: hasEmail, sms: hasPhone };
  return { email: hasEmail, sms: !hasEmail && hasPhone };
}

/**
 * Send to each picked person (Send To) on the channels `via` allows for them.
 * Everything stays in the patient's own email / SMS thread.
 */
async function deliver({ recipient, targets, via, me, subject, html, smsBody, meta, verifyId }) {
  const sender = { id: me?.id, name: me?.name || 'Care team' };
  // Verify ID: links go out as secure links; the settings ride in meta.
  if (verifyId?.on) {
    const email = protectHtml(html);
    const sms = protectSms(smsBody);
    html = email.html;
    smsBody = sms.text;
    meta = { ...meta, verifyId, secureLinks: [...email.links, ...sms.links] };
  }
  const results = [];
  const emails = targets.filter(t => channelsFor(via, t).email).map(t => t.email);
  const phones = targets.filter(t => channelsFor(via, t).sms).map(t => toE164(t.phone));
  if (emails.length) {
    const conv = await findOrCreateConversation('email', recipient, { patient_email: recipient.email || emails[0], subject });
    results.push(['Email', await sendEmail({
      conversation: conv, sender, from: FROM_ADDRESS, to: emails, subject, html,
      body: new DOMParser().parseFromString(html, 'text/html').body?.innerText || '', meta,
    })]);
  }
  if (phones.length) {
    const own = recipient.phone ? toE164(recipient.phone) : phones[0];
    const conv = await findOrCreateConversation('sms', { ...recipient, phone: own }, { patient_phone: own });
    // The drawer is locked to this patient, so every copy (caregivers' too)
    // is logged for them (FCS-5677: tag to the selected user).
    const loggedFor = recipient.id != null ? { id: String(recipient.id), name: recipient.name } : undefined;
    for (const phone of phones) results.push(['SMS', await sendSms({ conversation: conv, sender, to: phone, body: smsBody, meta, loggedFor })]);
  }
  const failed = results.filter(([, m]) => m?.status === 'failed');
  const channels = [...new Set(results.map(([c]) => c))];
  if (!results.length) toast.error('Nothing sent: no one picked has an email or phone for the chosen channel.');
  else if (failed.length) toast.error(`${failed.map(([c]) => c).join(' and ')} not sent: ${failed[0][1].failure_reason}`);
  else toast.success(`${channels.join(' and ')} Sent Successfully`);
  return results.length > 0;
}

/**
 * Send To (as in Compose Email): the patient and their recorded contacts.
 * Someone with neither an email nor a phone is listed but can't be picked.
 */
function useSendTo(recipient, onVerifyChange) {
  const contacts = useAppStore(st => (recipient?.id != null ? st.patientContacts[recipient.id] : null));
  const fetchPatientContacts = useAppStore(st => st.fetchPatientContacts);
  useEffect(() => { if (recipient?.id != null) fetchPatientContacts(recipient.id); }, [recipient?.id, fetchPatientContacts]);
  const people = useMemo(() => [
    { value: 'patient', name: recipient.name, email: recipient.email, phone: recipient.phone, dob: recipient.dob, type: 'Patient', meta: personMeta(recipient), initials: recipient.initials },
    ...(contacts ? withDecisionMakers(contacts) : []).map(c => ({ value: String(c.id), name: c.name, email: c.email, phone: c.phone, dob: c.dob, type: c.type, missing: c.missing, meta: personMeta(c) })),
  ], [recipient, contacts]);
  const [picked, setPicked] = useState(['patient']);
  // A different member starts Send To on them.
  const [pickedFor, setPickedFor] = useState(recipient?.id);
  if (pickedFor !== recipient?.id) { setPickedFor(recipient?.id); setPicked(['patient']); }
  // The patient starts picked only if they can be reached (an email or a
  // phone on record); otherwise Send To starts empty.
  const reachable = !!(recipient.email || recipient.phone);
  const shown = reachable ? picked : picked.filter(v => v !== 'patient');
  // Send To only shows when the member has other people on record (care
  // giver, decision maker…); otherwise it goes to the member.
  const hasRoles = (contacts || []).length > 0;
  const targets = hasRoles ? people.filter(p => shown.includes(p.value)) : (reachable ? [people[0]] : []);
  const pick = (v) => {
    const next = pickOneDecisionMaker(v, shown, x => people.find(p => p.value === x)?.type);
    // Anyone but the patient turns Verify identity on; patient only, off.
    const on = verifyForSendTo(next, shown);
    if (on !== null) onVerifyChange?.(on);
    setPicked(next);
  };
  return { people, picked: shown, setPicked: pick, targets, hasRoles };
}

function SendToField({ people, picked, setPicked, error }) {
  const reach = (p) => [p.email, p.phone].filter(Boolean).join(' • ');
  return (
    <Select
      multiple
      checkboxes
      badges
      searchable
      searchPlaceholder="Search by name"
      options={people.map(p => ({
        value: p.value,
        triggerLabel: sendToChipLabel(p.name, p.type),
        searchText: `${p.name} ${p.type} ${p.email || ''} ${p.phone || ''}`,
        disabled: !p.email && !p.phone,
        label: <PersonOption name={p.name} initials={p.initials} meta={p.missing ? 'None on record' : reach(p) || 'No email or phone on record'} tag={p.type} />,
        badgeTooltip: <PersonTip name={p.name} initials={p.initials} email={reach(p)} tag={p.type} />,
      }))}
      value={picked}
      onChange={setPicked}
      placeholder={SEND_TO_PLACEHOLDER}
      errorText={error}
    />
  );
}

/** Priority as an inline icon + text picker (as in Add Intervention). */
function PriorityPicker({ value, onChange }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={styles.priorityTrigger}
        aria-label={`Priority: ${value}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <PriorityIcon priority={value.toLowerCase()} size={16} />
        <span>{value}</span>
        <DownChevronIcon size={12} color="var(--neutral-300)" />
      </button>
      {open && (
        <MenuPopover
          anchorRef={ref}
          align="left"
          width={140}
          ariaLabel="Priority"
          items={PRIORITIES.map(p => ({ key: p.value, label: p.label, iconElement: <PriorityIcon priority={p.value.toLowerCase()} size={16} /> }))}
          onSelect={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Row({ label, required, info, children, className }) {
  return (
    <div className={[styles.row, className].filter(Boolean).join(' ')}>
      <span className={styles.rowLabel}>
        {label}
        {info && (
          <Tooltip label={info} maxWidth={280}>
            <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-300)" className={styles.labelInfo} aria-label={info} />
          </Tooltip>
        )}
        {required && <span className={styles.req} aria-hidden="true" />}
      </span>
      <div className={styles.rowField}>{children}</div>
    </div>
  );
}

// ── Send Content (Send Education) ────────────────────────────────────────
export function SendContentDrawer({ patient, onClose }) {
  const memberPick = useMember(patient);
  const { recipient, me } = useRecipient(memberPick.member || patient);
  const templates = useEmailTemplates(recipient, me);
  const [content, setContent] = useState([]);
  const [contentId, setContentId] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [taskTitle, setTaskTitle] = useState('');
  const [via, setVia] = useState('emailOrSms');
  const [tab, setTab] = useState('email');
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE);
  const [subject, setSubject] = useState('Fold Health | Educational Content for you');
  const [editing, setEditing] = useState(false);
  const [smsBody, setSmsBody] = useState('');
  const [smsEdited, setSmsEdited] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verifyId, setVerifyId] = useState(DEFAULT_ID_VERIFICATION);
  const canvasRef = useRef(null);
  const sendTo = useSendTo(recipient, (on) => setVerifyId(x => ({ ...x, on })));
  // Verify identity only applies when Send To shows (the member has other
  // people on record); sending to the member alone isn't protected.
  const activeVerify = sendTo.hasRoles ? verifyId : { ...verifyId, on: false };
  const blockers = verifyBlockers(activeVerify, sendTo.targets);
  // Verify ID's opening line takes part of the SMS limit.
  const smsLimit = activeVerify.on ? SMS_LIMIT - SECURE_SMS_PREFIX : SMS_LIMIT;

  useEffect(() => { listEducationContent().then(setContent); }, []);

  const item = content.find(c => c.id === contentId);
  const first = firstNameOf(recipient.name);
  const showEmail = via !== 'sms';
  const showSms = via !== 'email';
  const activeTab = (tab === 'email' && !showEmail) ? 'sms' : (tab === 'sms' && !showSms) ? 'email' : tab;
  const tabs = [showEmail && { key: 'email', label: 'Email' }, showSms && { key: 'sms', label: 'SMS' }].filter(Boolean);

  const template = templates.find(t => t.value === templateId) || templates[0];
  const html = composeWithTemplate({
    templateHtml: template?.html,
    introText: `Hi ${first},\n\nYour care team thought this would be helpful.`,
    blockHtml: item ? educationBlock(item) : '',
    sender: { name: me?.name },
  });
  const smsText = smsEdited ? smsBody : (item ? educationSms(first, item) : '');

  const send = async () => {
    setTouched(true);
    if (!sendTo.targets.length || !item || !priority || blockers.length || (showEmail && !subject.trim()) || (showSms && !smsText.trim())) return;
    setBusy(true);
    try {
      const ok = await deliver({
        recipient, me, via, targets: sendTo.targets,
        subject: subject.trim(),
        html: canvasRef.current?.getHtml() || html,
        smsBody: smsText.trim(),
        meta: { kind: 'education', contentId: item.id, priority, taskTitle: taskTitle.trim() || null },
        verifyId: activeVerify,
      });
      if (ok) onClose();
    } catch {
      toast.error('Could not send the content.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      title="Send Content"
      onClose={onClose}
      secondaryAction={<Button variant="outline" onClick={onClose}>Cancel</Button>}
      primaryAction={<Button onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send'}</Button>}
    >
      <div className={styles.card}>
        <Row label="Member" required>
          <MemberField {...memberPick} />
        </Row>
        {sendTo.hasRoles && (
          <Row label="Send To" required info={SEND_TO_INFO}>
            <SendToField {...sendTo} error={touched && !sendTo.targets.length ? 'Choose who to send to.' : undefined} />
          </Row>
        )}
        <Row label="Member Education" required>
          <Select
            searchable
            searchPlaceholder="Search content"
            options={content.map(c => ({ value: c.id, label: c.title }))}
            value={contentId}
            onChange={(v) => { setContentId(v); setSmsEdited(false); }}
            placeholder="Search Content"
            errorText={touched && !item ? 'Choose the content to send.' : undefined}
          />
        </Row>
        {sendTo.hasRoles && (
          <Row className={styles.verifyRow} label="Protect links">
            <VerifyIdField
              value={verifyId}
              onChange={setVerifyId}
              blockers={blockers}
              className={styles.contents}
              detailsClassName={styles.verifyDetails}
              editClassName={styles.verifyEdit}
              settingsClassName={styles.verifySettings}
            />
          </Row>
        )}
        <Row label="Priority" required>
          <PriorityPicker value={priority} onChange={setPriority} />
        </Row>
        <Row label="Member Task Title">
          <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Enter Task Title" maxLength={150} />
        </Row>
        <Row label="Send Via">
          <Select options={SEND_VIA} value={via} onChange={setVia} />
        </Row>

        <div className={styles.channel}>
          <TabStrip items={tabs} activeKey={activeTab} onChange={setTab} fullWidth={false} />
          {activeTab === 'email' ? (
            <div className={styles.channelBody}>
              <Row label="Template" required>
                <Select searchable options={templates} value={templateId} onChange={setTemplateId} placeholder="Search Template" />
              </Row>
              <Row label="Subject" required>
                <Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} errorText={touched && !subject.trim() ? 'Add a subject.' : undefined} />
              </Row>
              <div className={styles.previewHead}>
                <ActionButton icon={editing ? 'solar:check-circle-linear' : 'solar:pen-linear'} tooltip={editing ? 'Done editing' : 'Edit email'} onClick={() => setEditing(v => !v)} />
              </div>
              <div className={styles.preview}>
                <EmailCanvas ref={canvasRef} html={html} editing={editing} />
              </div>
            </div>
          ) : (
            <div className={styles.channelBody}>
              <Row label="Body" required>
                <Textarea
                  highlightLinks
                  value={smsText}
                  onChange={e => { setSmsEdited(true); setSmsBody(e.target.value.slice(0, smsLimit)); }}
                  placeholder="Enter SMS Body"
                  rows={5}
                />
                <div className={styles.smsFoot}>
                  <span>SMS body length is limited to {SMS_LIMIT} characters</span>
                  <span>{smsText.length + (activeVerify.on ? SECURE_SMS_PREFIX : 0)}/{SMS_LIMIT}</span>
                </div>
              </Row>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

// ── Send Assessment ──────────────────────────────────────────────────────
export function SendAssessmentDrawer({ patient, initialFormIds, onClose }) {
  const memberPick = useMember(patient);
  const { recipient, me } = useRecipient(memberPick.member || patient);
  const templates = useEmailTemplates(recipient, me);
  const [forms, setForms] = useState([]);
  const [formIds, setFormIds] = useState(() => (initialFormIds || []).map(String));
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [verifyId, setVerifyId] = useState(DEFAULT_ID_VERIFICATION);

  useEffect(() => {
    let alive = true;
    supabase.from('forms').select('id, name, status').order('updated_at', { ascending: false, nullsFirst: false }).limit(100)
      .then(({ data }) => { if (alive) setForms(data || []); });
    return () => { alive = false; };
  }, []);

  const picked = forms.filter(f => formIds.includes(String(f.id))).map(f => ({ id: f.id, name: f.name, url: formShareLink(f.id) }));
  const first = firstNameOf(recipient.name);
  const template = templates.find(t => t.value === templateId) || templates[0];
  const html = composeWithTemplate({
    templateHtml: template?.html,
    introText: `Hi, ${first}\n\nPlease fill below forms to help us provide better care to you!`,
    blockHtml: picked.length ? formsBlock(picked) : '',
    sender: { name: me?.name },
  });
  const sendTo = useSendTo(recipient, (on) => setVerifyId(x => ({ ...x, on })));
  // What each picked person gets: email, else SMS, else nothing.
  const reachText = sendTo.targets.map((t) => {
    const ch = channelsFor('emailOrSms', t);
    return ch.email ? `${t.name} by email` : ch.sms ? `${t.name} by SMS` : null;
  }).filter(Boolean);

  // Verify identity only applies when Send To shows (the member has other
  // people on record); sending to the member alone isn't protected.
  const activeVerify = sendTo.hasRoles ? verifyId : { ...verifyId, on: false };
  const blockers = verifyBlockers(activeVerify, sendTo.targets);

  const send = async () => {
    if (!picked.length || !sendTo.targets.length || blockers.length) return;
    setBusy(true);
    try {
      const ok = await deliver({
        recipient, me, via: 'emailOrSms', targets: sendTo.targets,
        subject: 'Forms from your care team',
        html,
        smsBody: assessmentSms(first, picked),
        meta: { kind: 'assessment', formIds: picked.map(f => f.id) },
        verifyId: activeVerify,
      });
      if (ok) {
        useAppStore.getState().recordAssessmentSends({
          patientId: recipient.id,
          formIds: picked.map(f => f.id),
          sentByName: me?.name,
          channels: [...new Set(sendTo.targets.flatMap((t) => {
            const ch = channelsFor('emailOrSms', t);
            return ch.email ? ['email'] : ch.sms ? ['sms'] : [];
          }))],
        });
        onClose();
      }
    } catch {
      toast.error('Could not send the forms.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      title="Send Assessment"
      onClose={onClose}
      primaryAction={(
        <Button
          onClick={send}
          disabled={busy || !picked.length || !reachText.length || blockers.length > 0}
          disabledReason={
            busy ? null
              : !picked.length ? 'Pick a form'
                : !reachText.length ? (sendTo.hasRoles ? 'Pick someone with an email or phone on record' : "This member doesn't have an email or phone on record")
                  : blockers.length ? "Someone in Send To can't verify their identity"
                    : null
          }
        >
          {busy ? 'Sending…' : 'Send Forms'}
        </Button>
      )}
    >
      <div className={styles.form}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Member<span className={styles.req} aria-hidden="true" /></span>
          <MemberField {...memberPick} />
        </div>
        {sendTo.hasRoles && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Send To
              <Tooltip label={SEND_TO_INFO} maxWidth={280}>
                <Icon name="solar:info-circle-linear" size={12} color="var(--neutral-300)" className={styles.labelInfo} aria-label={SEND_TO_INFO} />
              </Tooltip>
              <span className={styles.req} aria-hidden="true" />
            </span>
            <SendToField {...sendTo} />
          </div>
        )}
        <Select label="Template" searchable options={templates} value={templateId} onChange={setTemplateId} />
        <VerifyIdStack>
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
          onChange={setFormIds}
          placeholder="Search Form"
        />
        {/* Forms are required, so there are always links; it shows with Send To. */}
        <VerifyIdReveal show={sendTo.hasRoles}>
          <VerifyIdCard value={verifyId} onChange={setVerifyId} blockers={blockers} />
        </VerifyIdReveal>
        </VerifyIdStack>
        <div className={styles.preview}>
          <EmailCanvas html={html} editing={false} />
        </div>
      </div>
    </Drawer>
  );
}
