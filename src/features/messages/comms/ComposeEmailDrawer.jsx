import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Select } from '../../../components/Select/Select';
import { Input } from '../../../components/Input/Input';
import { Switch } from '../../../components/Switch/Switch';
import { Icon } from '../../../components/Icon/Icon';
import { Link } from '../../../components/Link/Link';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { isEmailAddress } from '../../../components/RecipientInput/isEmailAddress';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { toast } from '../../../components/Toast/sonnerToast';
import { applyMergeTags, buildRecipientContext } from '../../email-builder/mergeTags';
import { findOrCreateConversation, addMessage, updateMessage, deleteMessage, updateConversation } from './commsRepo';
import { sendEmail } from './commsSend';
import { useCommsPeople } from './useCommsPeople';
import { UnityAIBar } from '../../../components/UnityAIBar/UnityAIBar';
import { EmailEditor } from '../../../components/EmailEditor/EmailEditor';
import { SearchListPopover } from '../../../components/SearchListPopover/SearchListPopover';
import { supabase } from '../../../lib/supabase';
import { formShareLink } from '../../forms/formLink';
import { EDUCATION_LIBRARY } from './educationLibrary';
import { draftPatientEmail } from './draftPatientEmail';
import { SendToSection } from './SendToSection';
import { DEFAULT_PROTECTION, DEFAULT_ID_VERIFICATION, contactFor, recipientError, personMeta } from './sendTo';
import { PersonOption } from './PersonOption';
import { VerifyIdCard } from './VerifyIdCard';
import { useAppStore } from '../../../store/useAppStore';
import { RecipientInput } from '../../../components/RecipientInput/RecipientInput';
import { useEmailTemplates, withBody } from './useEmailTemplates';
import { DEFAULT_TEMPLATE_ID, DEFAULT_SUBJECT, defaultBodyText, textToHtml } from './defaultEmailTemplate';
import styles from './ComposeEmail.module.css';

const PHI_NOTICE = 'Do not send PHI via email or text without verifying and obtaining consent.';
const FROM_ADDRESS = 'noreply@foldhealth.org';

const htmlToText = (html) => {
  const d = new DOMParser().parseFromString(html || '', 'text/html');
  d.querySelectorAll('style,script').forEach(n => n.remove());
  return (d.body?.innerText || d.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};

/**
 * Compose Email (Figma 2900:34239, after Communications 1:24088). The
 * message is written in the editor on the left, in a template picked by
 * Template Category / Template List; the right side previews the email as
 * it will be sent. Sends for real through Resend. Closing with something
 * typed asks to save a draft or discard (1:28117).
 *
 * Recipients:
 *  - Opened for a patient (P360, worklists): Send To picks who it goes to
 *    (the patient or one of their contacts), with an optional protected
 *    link; Cc / Bcc take Fold users only; + Add new contact adds someone
 *    else by name, email and date of birth.
 *  - Opened from Comms: pick the patient, then Send To takes addresses
 *    (the patient's is filled in), and Cc / Bcc any address.
 *
 * `initial`: { patient, to, cc, bcc, subject, bodyText, draft, conversation }
 */
export function ComposeEmailDrawer({ initial = {}, onClose, onSent }) {
  const { patients, me, staff } = useCommsPeople();
  const sender = useMemo(() => ({ name: me?.name || 'Care team', email: me?.email || '' }), [me]);
  const firstName = (initial.patient?.name || '').split(/\s+/)[0];

  // Without a patient (opened from Comms), the patient is picked first.
  const [patientId, setPatientId] = useState(initial.patient?.id ? String(initial.patient.id) : '');
  const [sendTo, setSendTo] = useState({ type: 'Patient', protection: DEFAULT_PROTECTION });
  const [extraContacts, setExtraContacts] = useState([]);
  const [newContact, setNewContact] = useState(null);
  const [cc, setCc] = useState(initial.cc || []);
  const [bcc, setBcc] = useState(initial.bcc || []);
  const [showCc, setShowCc] = useState(!!initial.cc?.length);
  const [showBcc, setShowBcc] = useState(!!initial.bcc?.length);
  const [subject, setSubject] = useState(initial.subject ?? DEFAULT_SUBJECT);
  const [useTemplate, setUseTemplate] = useState(initial.useTemplate ?? true);
  const [templateId, setTemplateId] = useState(initial.draft?.meta?.templateId || DEFAULT_TEMPLATE_ID);
  // The message, as HTML from the editor.
  const [body, setBody] = useState(() => textToHtml(initial.draft?.body || initial.bodyText || defaultBodyText(firstName)));
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  // The editor's insert pickers: { kind: 'form' | 'article', rect }.
  const [insertMenu, setInsertMenu] = useState(null);
  const [forms, setForms] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase.from('forms').select('id, name').order('updated_at', { ascending: false, nullsFirst: false }).limit(100)
      .then(({ data }) => { if (alive) setForms(data || []); });
    return () => { alive = false; };
  }, []);
  const esc = (t) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const insertLink = (label, url) => editorRef.current?.insertHtml(`<a href="${esc(url)}">${esc(label)}</a>&nbsp;`);
  const insertImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => editorRef.current?.insertHtml(`<img src="${reader.result}" alt="${esc(file.name)}" style="max-width:100%" />`);
    reader.readAsDataURL(file);
  };
  const editorActions = [
    { key: 'attach', icon: 'solar:paperclip-linear', label: 'Attach file (coming soon)', disabled: true, onClick: () => {} },
    { key: 'form', icon: 'solar:document-text-linear', label: 'Insert form', onClick: (e) => setInsertMenu({ kind: 'form', rect: e.currentTarget.getBoundingClientRect() }) },
    { key: 'article', icon: 'solar:notes-linear', label: 'Insert article', onClick: (e) => setInsertMenu({ kind: 'article', rect: e.currentTarget.getBoundingClientRect() }) },
    { key: 'booking', icon: 'solar:calendar-mark-linear', label: 'Insert booking link (coming soon)', disabled: true, onClick: () => {} },
    { key: 'image', icon: 'solar:gallery-linear', label: 'Insert image', onClick: () => imageInputRef.current?.click() },
  ];

  // Comms (no patient given): who in Send To ('patient' or a contact id).
  const [picked, setPicked] = useState([]);
  const [verifyId, setVerifyId] = useState(DEFAULT_ID_VERIFICATION);
  const [archiveOnSend, setArchiveOnSend] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const touch = (fn) => (v) => { setDirty(true); fn(v); };

  const patient = initial.patient || patients.find(p => String(p.id) === patientId) || null;
  const contacts = useAppStore(st => (patient ? st.patientContacts[patient.id] : null));
  const fetchPatientContacts = useAppStore(st => st.fetchPatientContacts);
  useEffect(() => { if (patient?.id) fetchPatientContacts(patient.id); }, [patient?.id, fetchPatientContacts]);

  // Send To resolves to one contact; it must have an email address (and the
  // details the verification methods need). The first failed check blocks Send.
  const contact = patient ? contactFor(sendTo.type, patient, contacts || []) : null;
  const sendToError = patient ? recipientError({ type: sendTo.type, contact, need: 'email', protection: sendTo.protection }) : null;
  const forPatient = !!initial.patient;
  // Comms: Send To offers the patient and their recorded contacts; someone
  // without an email address is listed but can't be picked.
  const people = patient ? [
    { value: 'patient', label: patient.name, email: patient.email, type: 'Patient', meta: personMeta(patient), initials: patient.initials },
    ...(contacts || []).map(c => ({ value: c.id, label: c.name, email: c.email, type: c.type, meta: personMeta(c) })),
  ] : [];
  const globalTo = people.filter(o => picked.includes(o.value)).map(o => o.email).filter(Boolean);
  const to = forPatient
    ? [contact?.email, ...extraContacts.map(c => c.email)].filter(Boolean)
    : globalTo;
  const subjectError = touched && !subject.trim() ? 'Add a subject.' : null;
  const canSend = forPatient
    ? !!contact && !sendToError && !!subject.trim() && !busy
    : !!patient && to.length > 0 && to.every(isEmailAddress) && !!subject.trim() && !busy;

  // Patient picker rows: avatar, name, gender • date of birth (no tag).
  const patientOptions = useMemo(() => patients.map(p => ({
    value: String(p.id),
    triggerLabel: p.name,
    searchText: p.name,
    label: <PersonOption name={p.name} initials={p.initials} meta={personMeta(p)} />,
  })), [patients]);

  // Picking the patient in Comms starts Send To on them.
  const pickPatient = (id) => {
    setDirty(true);
    setPatientId(id);
    const p = patients.find(x => String(x.id) === id);
    setPicked(p?.email ? ['patient'] : []);
  };

  // Cc / Bcc list Fold users only.
  const staffOptions = useMemo(
    () => (staff || []).filter(u => u.email).map(u => ({ value: u.email, label: `${u.name} (${u.email})` })),
    [staff],
  );

  // Merge tags ({{first_name}} …) greet whoever it's sent to.
  const recipientCtx = useMemo(() => {
    const recipient = forPatient && sendTo.type !== 'Patient' && contact
      ? { name: contact.name, email: contact.email }
      : (patient || { name: to[0] || '' });
    return buildRecipientContext(recipient, { providerName: sender.name, clinicName: 'Fold Health' });
  }, [forPatient, sendTo.type, contact, patient, to, sender.name]);

  const templates = useEmailTemplates(recipientCtx, sender);
  const template = templates.find(t => t.id === templateId) || templates[0];
  const categories = [...new Set(templates.map(t => t.category))];
  const shell = useMemo(() => template.render(), [template]);

  const currentHtml = () => {
    const html = useTemplate
      ? withBody(shell, body)
      : `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6;color:#3A485F">${body}</body></html>`;
    return applyMergeTags(html, recipientCtx);
  };
  const previewHtml = currentHtml();

  const conversationFor = () => {
    if (initial.conversation) return initial.conversation;
    const who = patient || { id: null, name: to[0], email: to[0] };
    return findOrCreateConversation('email', who, { patient_email: to[0], subject: subject.trim() });
  };

  // UnityAI writes the subject and message; with a template on, the message
  // goes into the template's body.
  const generate = async () => {
    setGenerating(true);
    const draft = await draftPatientEmail({
      patientName: patient?.name,
      subject: subject.trim(),
      notes: htmlToText(body),
      senderName: sender.name,
    });
    setGenerating(false);
    if (!draft) { toast.error('UnityAI is unavailable right now. Try again in a moment.'); return; }
    setDirty(true);
    if (draft.subject) setSubject(draft.subject);
    setBody(textToHtml(draft.body));
    toast.success('Email drafted with UnityAI');
  };

  const send = async () => {
    setTouched(true);
    if (!canSend) return;
    if (!htmlToText(body)) { toast.error('Write a message first.'); return; }
    setBusy(true);
    try {
      const conversation = await conversationFor();
      const html = currentHtml();
      const result = await sendEmail({
        conversation,
        sender: { id: me?.id, name: sender.name },
        from: FROM_ADDRESS,
        to, cc, bcc,
        subject: subject.trim(),
        html,
        body: htmlToText(html),
        // Who it's addressed to and the protected-link settings, for the
        // link service (not built yet) and the Sent record.
        meta: forPatient
          ? { sendTo: sendTo.type, protection: sendTo.protection.on ? sendTo.protection : null, contacts: extraContacts }
          : { verifyId: verifyId.on ? verifyId : null },
      });
      if (initial.draft) await deleteMessage(initial.draft.id);
      if (archiveOnSend) await updateConversation(conversation.id, { archived: true });
      if (result?.status === 'failed') toast.error(`Email not sent: ${result.failure_reason}`);
      else toast.success('Email sent');
      onSent?.(conversation);
      setDismissed(true);
    } catch {
      toast.error('Could not send the email.');
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      const conversation = await conversationFor();
      const html = useTemplate ? currentHtml() : null;
      const fields = {
        subject: subject.trim(),
        to_addr: to.join(', '),
        cc: cc.join(', ') || null,
        bcc: bcc.join(', ') || null,
        html,
        body: htmlToText(body),
        meta: { templateId: template.id, useTemplate },
      };
      if (initial.draft) await updateMessage(initial.draft.id, fields);
      else {
        await addMessage({
          conversation_id: conversation.id, kind: 'email', direction: 'out', status: 'draft',
          sender_id: me?.id || null, sender_name: sender.name, from_addr: FROM_ADDRESS, ...fields,
        });
      }
      toast.success('Saved to Drafts');
      setConfirmDiscard(false);
      setDismissed(true);
    } catch {
      toast.error('Could not save the draft.');
      setBusy(false);
    }
  };

  const discard = async () => {
    if (initial.draft) await deleteMessage(initial.draft.id);
    setConfirmDiscard(false);
    setDismissed(true);
  };

  return (
    <>
      <Drawer
        title="Compose Email"
        width={1240}
        onClose={onClose}
        dismissed={dismissed}
        beforeClose={() => {
          if (!dirty || dismissed) return true;
          setConfirmDiscard(true);
          return false;
        }}
        primaryAction={(
          <Button variant="primary" size="L" leadingIcon="solar:plain-2-linear" onClick={send} disabled={!canSend}>
            {busy ? 'Sending…' : 'Send'}
          </Button>
        )}
        bodyClassName={styles.composeBody}
      >
        <div className={styles.composeLeft}>
          <Select
            label="From"
            required
            options={[{ value: 'default', label: `Default (${sender.email || FROM_ADDRESS})` }]}
            value="default"
            onChange={() => {}}
          />
          {!forPatient && (<>
            <Select
              label="Patient"
              required
              searchable
              options={patientOptions}
              value={patientId}
              onChange={pickPatient}
              placeholder="Search patient"
              searchPlaceholder="Search by name"
              emptyText="No matching patients."
            />
            <div className={styles.recipientField}>
              <div className={styles.recipientLabelRow}>
                <span className={styles.recipientLabel}>
                  Send To
                  <span className={styles.recipientRequired} aria-hidden="true" />
                </span>
                <span className={styles.ccLinks}>
                  {!showCc && <Link variant="secondary" onClick={() => setShowCc(true)}>Cc</Link>}
                  {!showCc && !showBcc && <span className={styles.ccDivider} />}
                  {!showBcc && <Link variant="secondary" onClick={() => setShowBcc(true)}>Bcc</Link>}
                </span>
              </div>
              {/* The patient and their contacts (Figma 2910:39991); no email, no pick. */}
              <Select
                multiple
                checkboxes
                badges
                searchable
                searchPlaceholder="Search by name"
                options={people.map(o => ({
                  value: o.value,
                  triggerLabel: o.label,
                  searchText: `${o.label} ${o.type} ${o.email || ''}`,
                  disabled: !o.email,
                  label: <PersonOption name={o.label} initials={o.initials} meta={o.email ? o.meta : 'No email address on record'} tag={o.type} />,
                }))}
                value={picked}
                onChange={(v) => { setDirty(true); setPicked(v); }}
                placeholder={patient ? 'Select recipients' : 'Pick a patient first'}
                disabled={!patient}
              />
            </div>
          </>)}
          {forPatient && (<SendToSection
            value={sendTo}
            onChange={(v) => { setDirty(true); setSendTo(v); }}
            contact={contact}
            need="email"
            error={patient ? sendToError : null}
            labelEnd={(
              <span className={styles.ccLinks}>
                {!showCc && <Link variant="secondary" onClick={() => setShowCc(true)}>Cc</Link>}
                {!showCc && !showBcc && <span className={styles.ccDivider} />}
                {!showBcc && <Link variant="secondary" onClick={() => setShowBcc(true)}>Bcc</Link>}
                <span className={styles.ccDivider} />
                <Link onClick={() => setNewContact({ name: '', email: '', dob: '' })}>
                  <span className={styles.previewLink}>
                    <Icon name="solar:add-circle-linear" size={14} />
                    Add new contact
                  </span>
                </Link>
              </span>
            )}
            extra={(extraContacts.length > 0 || newContact) && (
              <div className={styles.extraContacts}>
                {extraContacts.map(c => (
                  <span key={c.email} className={styles.extraChip}>
                    <Icon name="solar:user-linear" size={14} color="currentColor" />
                    {c.name} ({c.email})
                    <button type="button" className={styles.extraRemove} aria-label={`Remove ${c.name}`} onClick={() => setExtraContacts(list => list.filter(x => x.email !== c.email))}>
                      <Icon name="solar:close-circle-linear" size={14} color="currentColor" />
                    </button>
                  </span>
                ))}
                {/* Someone outside the patient's contacts; a protected link checks them against these details. */}
                {newContact && (
                  <div className={styles.newContact}>
                    <Input label="Name" required value={newContact.name} onChange={e => setNewContact(c => ({ ...c, name: e.target.value }))} />
                    <Input label="Email" required type="email" value={newContact.email} onChange={e => setNewContact(c => ({ ...c, email: e.target.value }))} />
                    <Input label="Date of Birth" type="date" value={newContact.dob} onChange={e => setNewContact(c => ({ ...c, dob: e.target.value }))} />
                    <span className={styles.newContactActions}>
                      <Button variant="secondary" size="S" onClick={() => setNewContact(null)}>Cancel</Button>
                      <Button
                        variant="primary"
                        size="S"
                        disabled={!newContact.name.trim() || !isEmailAddress(newContact.email)}
                        onClick={() => { setDirty(true); setExtraContacts(list => [...list, { ...newContact, name: newContact.name.trim() }]); setNewContact(null); }}
                      >
                        Add
                      </Button>
                    </span>
                  </div>
                )}
              </div>
            )}
          />)}
          {/* Cc / Bcc: Fold users only when sending for a patient (the ticket); any address from Comms. */}
          {showCc && (forPatient
            ? <Select label="Cc" multiple checkboxes badges searchable options={staffOptions} value={cc} onChange={touch(setCc)} placeholder="Search Fold users" />
            : <RecipientInput label="Cc" value={cc} onChange={touch(setCc)} />)}
          {showBcc && (forPatient
            ? <Select label="Bcc" multiple checkboxes badges searchable options={staffOptions} value={bcc} onChange={touch(setBcc)} placeholder="Search Fold users" />
            : <RecipientInput label="Bcc" value={bcc} onChange={touch(setBcc)} />)}
          <Input
            label="Subject"
            required
            value={subject}
            onChange={e => { setDirty(true); setSubject(e.target.value); }}
            maxLength={200}
            errorText={subjectError || undefined}
          />
          <Switch checked={useTemplate} onChange={touch(setUseTemplate)} label="Email Template" />
          {useTemplate && (
            <div className={styles.templateRow}>
              <Select
                label="Template Category"
                required
                options={categories.map(c => ({ value: c, label: c }))}
                value={template.category}
                onChange={(c) => {
                  const first = templates.find(t => t.category === c);
                  if (!first) return;
                  setDirty(true);
                  setTemplateId(first.id);
                  if (first.subject) setSubject(first.subject);
                }}
              />
              <Select
                label="Template List"
                options={templates.filter(t => t.category === template.category).map(t => ({ value: t.id, label: t.name }))}
                value={template.id}
                onChange={(id) => {
                  const t = templates.find(x => x.id === id);
                  setDirty(true);
                  setTemplateId(id);
                  if (t?.subject) setSubject(t.subject);
                }}
              />
            </div>
          )}
          {!forPatient && <VerifyIdCard value={verifyId} onChange={(v) => { setDirty(true); setVerifyId(v); }} />}
          <UnityAIBar onGenerate={generate} generating={generating} />
          {/* The email text area: PHI notice, formatting, message, insert bar. */}
          <EmailEditor
            ref={editorRef}
            value={body}
            onChange={(html) => { setDirty(true); setBody(html); }}
            notice={PHI_NOTICE}
            actions={editorActions}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => { insertImage(e.target.files?.[0]); e.target.value = ''; }}
          />
          {insertMenu && (
            <SearchListPopover
              anchorRect={insertMenu.rect}
              options={insertMenu.kind === 'form'
                ? forms.map(f => ({ value: String(f.id), label: f.name }))
                : EDUCATION_LIBRARY.map(a => ({ value: a.id, label: a.title }))}
              searchPlaceholder={insertMenu.kind === 'form' ? 'Search forms' : 'Search articles'}
              emptyText={insertMenu.kind === 'form' ? 'No forms found' : 'No articles found'}
              onSelect={(v) => {
                if (insertMenu.kind === 'form') {
                  const f = forms.find(x => String(x.id) === v);
                  if (f) insertLink(f.name, formShareLink(f.id));
                } else {
                  const a = EDUCATION_LIBRARY.find(x => x.id === v);
                  if (a) insertLink(a.title, a.url);
                }
                setInsertMenu(null);
              }}
              onClose={() => setInsertMenu(null)}
            />
          )}
          <label className={styles.archive}>
            <Checkbox checked={archiveOnSend} onCheckedChange={v => setArchiveOnSend(v === true)} />
            Archive on send
          </label>
        </div>

        {/* The email as it will be sent; edits happen in the editor on the left. */}
        <div className={styles.composeRight}>
          <div className={styles.previewBar}>
            <span className={styles.previewTitle}>{useTemplate ? 'Template Preview' : 'Preview'}</span>
          </div>
          <div className={styles.canvas}>
            <iframe title="Email preview" className={styles.frame} sandbox="" srcDoc={previewHtml} />
          </div>
        </div>
      </Drawer>

      {confirmDiscard && (
        <ConfirmDialog
          align="start"
          icon={false}
          title="Discard Email?"
          description="Discarding will permanently delete the email."
          cancelLabel="Save as Draft"
          confirmLabel="Discard"
          loading={busy}
          onCancel={saveDraft}
          onConfirm={discard}
          onClose={() => setConfirmDiscard(false)}
        />
      )}
    </>
  );
}
