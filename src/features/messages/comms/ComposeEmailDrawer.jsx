import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { InfoBar } from '../../../components/InfoBar/InfoBar';
import { Button } from '../../../components/Button/Button';
import { Select } from '../../../components/Select/Select';
import { Input } from '../../../components/Input/Input';
import { Switch } from '../../../components/Switch/Switch';
import { Icon } from '../../../components/Icon/Icon';
import { Link } from '../../../components/Link/Link';
import { isEmailAddress } from '../../../components/RecipientInput/isEmailAddress';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { toast } from '../../../components/Toast/sonnerToast';
import { applyMergeTags, buildRecipientContext } from '../../email-builder/mergeTags';
import { findOrCreateConversation, addMessage, updateMessage, deleteMessage } from './commsRepo';
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
import { SendToPicker } from './SendToPicker';
import {
  DEFAULT_PROTECTION, DEFAULT_ID_VERIFICATION, contactFor, recipientError, personMeta, verifyBlockers, protectHtml, hasLink, withDecisionMakers, pickOneDecisionMaker, verifyForSendTo, SEND_TO_INFO, SEND_TO_PLACEHOLDER, sendToChipLabel,
} from './sendTo';
import { PersonOption, PersonTip } from './PersonOption';
import { VerifyIdCard, VerifyIdReveal } from './VerifyIdCard';
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
  const [picked, setPicked] = useState(() => (initial.patient?.email ? ['patient'] : []));
  const [verifyId, setVerifyId] = useState(DEFAULT_ID_VERIFICATION);
  const [generating, setGenerating] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const touch = (fn) => (v) => { setDirty(true); fn(v); };

  const patient = patients.find(p => String(p.id) === patientId)
    || (initial.patient && String(initial.patient.id) === patientId ? initial.patient : null);
  const contacts = useAppStore(st => (patient ? st.patientContacts[patient.id] : null));
  const fetchPatientContacts = useAppStore(st => st.fetchPatientContacts);
  useEffect(() => { if (patient?.id) fetchPatientContacts(patient.id); }, [patient?.id, fetchPatientContacts]);

  // Send To resolves to one contact; it must have an email address (and the
  // details the verification methods need). The first failed check blocks Send.
  const contact = patient ? contactFor(sendTo.type, patient, contacts || []) : null;
  const sendToError = patient ? recipientError({ type: sendTo.type, contact, need: 'email', protection: sendTo.protection }) : null;
  // One layout everywhere: opened for a patient, the drawer is the Comms one
  // with that patient already picked (Patient, then Send To, then Verify ID).
  const forPatient = false;
  // Comms: Send To offers the patient and their recorded contacts; someone
  // without an email address is listed but can't be picked.
  const people = patient ? [
    { value: 'patient', label: patient.name, email: patient.email, phone: patient.phone, dob: patient.dob, type: 'Patient', meta: personMeta(patient), initials: patient.initials },
    ...(contacts ? withDecisionMakers(contacts) : []).map(c => ({ value: c.id, label: c.name, email: c.email, phone: c.phone, dob: c.dob, type: c.type, missing: c.missing, meta: personMeta(c) })),
  ] : [];
  // Send To can only be opened once a patient with other people on record
  // (care giver, decision maker…) is picked; otherwise the email goes to the patient.
  const hasRoles = !!patient && (contacts || []).length > 0;
  const sendToPicked = hasRoles ? picked : (patient?.email ? ['patient'] : []);
  // Protect links sits under Send To, so it's set before writing; it
  // shows once someone besides the patient is picked, and protects the email
  // when it has links (a template always carries its own).
  const withOthers = !forPatient && hasRoles && sendToPicked.some(v => v !== 'patient');
  const protectable = withOthers && (useTemplate || hasLink(body));
  const blockers = protectable ? verifyBlockers(verifyId, people.filter(o => sendToPicked.includes(o.value)).map(o => ({ ...o, name: o.label }))) : [];
  const verifyCard = <VerifyIdCard value={verifyId} onChange={(v) => { setDirty(true); setVerifyId(v); }} blockers={blockers} hint="Applies to any links in the email" />;
  const globalTo = people.filter(o => sendToPicked.includes(o.value)).map(o => o.email).filter(Boolean);
  const to = forPatient
    ? [contact?.email, ...extraContacts.map(c => c.email)].filter(Boolean)
    : globalTo;
  const subjectError = touched && !subject.trim() ? 'Add a subject.' : null;
  const canSend = forPatient
    ? !!contact && !sendToError && !!subject.trim() && !busy
    : !!patient && to.length > 0 && to.every(isEmailAddress) && !!subject.trim() && !blockers.length && !busy;
  // Why Send is greyed out, the first thing missing.
  const sendBlockedReason = busy ? null
    : !patient ? 'Pick a patient'
      : !to.length ? (hasRoles ? 'Pick who to send to' : "This patient doesn't have an email address on record")
        : !to.every(isEmailAddress) ? 'Fix the email address in Send To'
          : !subject.trim() ? 'Add a subject'
            : blockers.length ? "Someone in Send To can't verify their identity"
              : null;

  // Patient picker rows: avatar, name, gender • date of birth (no tag).
  const patientOptions = useMemo(() => {
    // The patient it was opened for stays listed even if the list lacks them.
    const list = initial.patient && !patients.some(p => String(p.id) === String(initial.patient.id))
      ? [initial.patient, ...patients] : patients;
    return list.map(p => ({
      value: String(p.id),
      triggerLabel: p.name,
      searchText: `${p.name} ${p.email || ''}`,
      // An email drawer: the second line is the patient's email address.
      label: <PersonOption name={p.name} initials={p.initials} meta={p.email || 'No email address on record'} />,
    }));
  }, [patients, initial.patient]);

  // Picking the patient in Comms starts Send To on them.
  const pickPatient = (id) => {
    setDirty(true);
    setPatientId(id);
    const p = patients.find(x => String(x.id) === id);
    setPicked(p?.email ? ['patient'] : []);
  };
  const updatePicked = (v) => {
    setDirty(true);
    const next = pickOneDecisionMaker(v, picked, id => people.find(o => o.value === id)?.type);
    // Anyone but the patient turns Verify identity on; patient only, off.
    const on = verifyForSendTo(next, picked);
    if (on !== null) setVerifyId(x => ({ ...x, on }));
    setPicked(next);
  };

  // Cc / Bcc list Fold users only.
  const staffOptions = useMemo(
    () => (staff || []).filter(u => u.email).map(u => ({ value: u.email, label: `${u.name} (${u.email})` })),
    [staff],
  );

  // Merge tags ({{first_name}} …) greet whoever it's sent to.
  // (Without a patient there's no one in Send To yet, so no name.)
  const recipientCtx = useMemo(
    () => buildRecipientContext(patient || { name: '' }, { providerName: sender.name, clinicName: 'Fold Health' }),
    [patient, sender.name],
  );

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
    toast.success('Email Drafted Successfully');
  };

  const send = async () => {
    setTouched(true);
    if (!canSend) return;
    if (!htmlToText(body)) { toast.error('Write a message first.'); return; }
    setBusy(true);
    try {
      const conversation = await conversationFor();
      // Verify ID: every link goes out as a secure link.
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
        // Who it's addressed to and the protected-link settings, for the
        // link service (not built yet) and the Sent record.
        meta: forPatient
          ? { sendTo: sendTo.type, protection: sendTo.protection.on ? sendTo.protection : null, contacts: extraContacts }
          : { verifyId: secured ? verifyId : null, ...(secured ? { secureLinks: secured.links } : {}) },
      });
      if (initial.draft) await deleteMessage(initial.draft.id);
      if (result?.status === 'failed') toast.error(`Email not sent: ${result.failure_reason}`);
      else toast.success('Email Sent Successfully');
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
      toast.success('Saved To Drafts Successfully');
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

  const ccLinks = (
    <span className={styles.ccLinks}>
      {!showCc && <Link variant="secondary" onClick={() => setShowCc(true)}>Cc</Link>}
      {!showCc && !showBcc && <span className={styles.ccDivider} />}
      {!showBcc && <Link variant="secondary" onClick={() => setShowBcc(true)}>Bcc</Link>}
    </span>
  );

  return (
    <>
      <Drawer
        title="Compose Email"
        // Without a template there's no preview: the drawer narrows to the
        // standard width as the preview fades out (Drawer animates width).
        width={useTemplate ? 1240 : 700}
        onClose={onClose}
        dismissed={dismissed}
        beforeClose={() => {
          if (!dirty || dismissed) return true;
          setConfirmDiscard(true);
          return false;
        }}
        primaryAction={(
          <Button leadingIcon="solar:plain-2-linear" onClick={send} disabled={!canSend} disabledReason={sendBlockedReason}>
            {busy ? 'Sending…' : 'Send'}
          </Button>
        )}
        bodyClassName={`${styles.composeBody} ${useTemplate ? '' : styles.composeBodySolo}`}
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
            {/* Cc / Bcc sit on the last recipient field's label row: Send To
                when it shows, otherwise Patient. */}
            <div className={styles.recipientField}>
              <div className={styles.recipientLabelRow}>
                <span className={styles.recipientLabel}>
                  Patient
                  <span className={styles.recipientRequired} aria-hidden="true" />
                </span>
                {!hasRoles && ccLinks}
              </div>
              <Select
                aria-label="Patient"
                disabled={!!initial.patient}
                searchable
                options={patientOptions}
                value={patientId}
                onChange={pickPatient}
                placeholder="Search patient"
                searchPlaceholder="Search by name"
                emptyText="No matching patients."
              />
            </div>
            {hasRoles && (
              <SendToPicker
                labelEnd={ccLinks}
                showInfo
                infoText={SEND_TO_INFO}
                // The patient and their contacts (Figma 2910:39991); no email, no pick.
                options={people.map(o => ({
                  value: o.value,
                  triggerLabel: sendToChipLabel(o.label, o.type),
                  searchText: `${o.label} ${o.type} ${o.email || ''}`,
                  disabled: !o.email,
                  label: <PersonOption name={o.label} initials={o.initials} meta={o.email || 'No email address on record'} tag={o.type} />,
                  badgeTooltip: <PersonTip name={o.label} initials={o.initials} email={o.email} tag={o.type} />,
                }))}
                value={picked}
                onChange={updatePicked}
                placeholder={SEND_TO_PLACEHOLDER}
              >
                <VerifyIdReveal show={withOthers}>{verifyCard}</VerifyIdReveal>
              </SendToPicker>
            )}
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
                      <Button variant="outline" size="sm" onClick={() => setNewContact(null)}>Cancel</Button>
                      <Button
                        size="sm"
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
          {!useTemplate && <UnityAIBar onGenerate={generate} generating={generating} />}
          {/* A template carries the email, so only the PHI notice shows; without
              one, the text area: PHI notice, formatting, message, insert bar. */}
          {useTemplate ? (
            <InfoBar tone="warning">{PHI_NOTICE}</InfoBar>
          ) : (
            <EmailEditor
              ref={editorRef}
              value={body}
              onChange={(html) => { setDirty(true); setBody(html); }}
              notice={PHI_NOTICE}
              actions={editorActions}
            />
          )}
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
        </div>

        {/* The email as it will be sent; edits happen in the editor on the left. */}
        <div className={`${styles.composeRight} ${useTemplate ? '' : styles.composeRightHidden}`} aria-hidden={!useTemplate}>
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
