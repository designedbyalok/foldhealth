import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Select } from '../../../components/Select/Select';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { TabStrip } from '../../../components/TabStrip/TabStrip';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { InfoBar } from '../../../components/InfoBar/InfoBar';
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

async function deliver({ recipient, me, channels, subject, html, smsBody, meta }) {
  const sender = { id: me?.id, name: me?.name || 'Care team' };
  const results = [];
  if (channels.email) {
    const conv = await findOrCreateConversation('email', recipient, { patient_email: recipient.email, subject });
    results.push(['Email', await sendEmail({
      conversation: conv, sender, from: FROM_ADDRESS, to: [recipient.email], subject, html,
      body: new DOMParser().parseFromString(html, 'text/html').body?.innerText || '', meta,
    })]);
  }
  if (channels.sms) {
    const phone = toE164(recipient.phone);
    const conv = await findOrCreateConversation('sms', { ...recipient, phone }, { patient_phone: phone });
    results.push(['SMS', await sendSms({ conversation: conv, sender, to: phone, body: smsBody, meta })]);
  }
  const failed = results.filter(([, m]) => m?.status === 'failed');
  if (!results.length) toast.error('Nothing sent: this patient has no email or phone for the chosen channel.');
  else if (failed.length) toast.error(`${failed.map(([c]) => c).join(' and ')} not sent: ${failed[0][1].failure_reason}`);
  else toast.success(`Sent by ${results.map(([c]) => c).join(' and ')}`);
  return results.length > 0;
}

function Row({ label, required, children }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>
        {label}
        {required && <span className={styles.req} aria-hidden="true" />}
      </span>
      <div className={styles.rowField}>{children}</div>
    </div>
  );
}

// ── Send Content (Send Education) ────────────────────────────────────────
export function SendContentDrawer({ patient, onClose }) {
  const { recipient, me } = useRecipient(patient);
  const templates = useEmailTemplates(recipient, me);
  const [content, setContent] = useState([]);
  const [contentId, setContentId] = useState('');
  const [priority, setPriority] = useState('');
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
  const canvasRef = useRef(null);

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
    if (!item || !priority || (showEmail && !subject.trim()) || (showSms && !smsText.trim())) return;
    setBusy(true);
    try {
      const ok = await deliver({
        recipient, me,
        channels: channelsFor(via, recipient),
        subject: subject.trim(),
        html: canvasRef.current?.getHtml() || html,
        smsBody: smsText.trim(),
        meta: { kind: 'education', contentId: item.id, priority, taskTitle: taskTitle.trim() || null },
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
      secondaryAction={<Button variant="secondary" size="L" onClick={onClose}>Cancel</Button>}
      primaryAction={<Button variant="primary" size="L" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send'}</Button>}
    >
      <p className={styles.to}>To <strong>{recipient.name || 'this patient'}</strong>{recipient.email ? ` • ${recipient.email}` : ''}{recipient.phone ? ` • ${recipient.phone}` : ''}</p>
      <div className={styles.card}>
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
        <Row label="Priority" required>
          <Select options={PRIORITIES} value={priority} onChange={setPriority} placeholder="Select Priority" errorText={touched && !priority ? 'Choose a priority.' : undefined} />
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
                <ActionButton icon={editing ? 'solar:check-circle-linear' : 'solar:pen-linear'} size="L" tooltip={editing ? 'Done editing' : 'Edit email'} onClick={() => setEditing(v => !v)} />
              </div>
              <div className={styles.preview}>
                <EmailCanvas ref={canvasRef} html={html} editing={editing} />
              </div>
            </div>
          ) : (
            <div className={styles.channelBody}>
              <Row label="Body" required>
                <Textarea
                  value={smsText}
                  onChange={e => { setSmsEdited(true); setSmsBody(e.target.value.slice(0, SMS_LIMIT)); }}
                  placeholder="Enter SMS Body"
                  rows={5}
                />
                <div className={styles.smsFoot}>
                  <span>SMS body length is limited to {SMS_LIMIT} characters</span>
                  <span>{smsText.length}/{SMS_LIMIT}</span>
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
export function SendAssessmentDrawer({ patient, onClose }) {
  const { recipient, me } = useRecipient(patient);
  const templates = useEmailTemplates(recipient, me);
  const [forms, setForms] = useState([]);
  const [formIds, setFormIds] = useState([]);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE);
  const [busy, setBusy] = useState(false);

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
  const channels = channelsFor('emailOrSms', recipient);

  const send = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      const ok = await deliver({
        recipient, me, channels,
        subject: 'Forms from your care team',
        html,
        smsBody: assessmentSms(first, picked),
        meta: { kind: 'assessment', formIds: picked.map(f => f.id) },
      });
      if (ok) onClose();
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
      primaryAction={<Button variant="primary" size="L" onClick={send} disabled={busy || !picked.length}>{busy ? 'Sending…' : 'Send Forms'}</Button>}
    >
      <div className={styles.form}>
        <Select label="Template" searchable options={templates} value={templateId} onChange={setTemplateId} />
        <Select
          label="Form List"
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
        <InfoBar>
          {channels.email ? `Goes to ${recipient.email} by email.`
            : channels.sms ? `No email on file, so this goes by SMS to ${recipient.phone}.`
              : 'This patient has no email or phone on file.'}
        </InfoBar>
        <div className={styles.preview}>
          <EmailCanvas html={html} editing={false} />
        </div>
      </div>
    </Drawer>
  );
}
