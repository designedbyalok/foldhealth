import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Select } from '../../../../components/Select/Select';
import { InfoBar } from '../../../../components/InfoBar/InfoBar';
import { Link } from '../../../../components/Link/Link';
import { EmailComposer } from '../../../../components/EmailComposer/EmailComposer';
import { RecipientInput } from '../../../../components/RecipientInput/RecipientInput';
import { isEmailAddress } from '../../../../components/RecipientInput/isEmailAddress';
import { useAppStore } from '../../../../store/useAppStore';
import { apiFetch } from '../../../../lib/apiFetch';
import { toast } from '../../../../components/Toast/sonnerToast';
import styles from './SendReportEmailDrawer.module.css';

const PHI_NOTICE = 'Do not send PHI via email or text without verifying and obtaining consent.';

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Print → Send Report → Send via Email: Compose Email (Figma Communications
 * 1:29176) with the report's PDF attached from the start. Sends through
 * /api/send-report-email (Resend).
 *
 * @param {object}   props
 * @param {() => Blob} props.buildPdf – The report as it's set up in the Print drawer
 * @param {string}   props.filename    – The PDF's name, without ".pdf"
 * @param {string}   props.title       – The report title, for the default subject and message
 * @param {string}   [props.employerName]
 * @param {string}   [props.range]     – e.g. "Jul 2026 - Sep 2026"
 * @param {function} props.onClose
 */
export function SendReportEmailDrawer({ buildPdf, filename, title, employerName, range, onClose }) {
  const me = useAppStore(s => s.currentUserProfile);
  const showToast = useAppStore(s => s.showToast);

  const about = [employerName, range].filter(Boolean).join(', ');
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState([title, about].filter(Boolean).join(' | '));
  const [body, setBody] = useState(`Hi,\n\nPlease find attached the ${title}${about ? ` for ${about}` : ''}.\n\nThank you,`);
  // The report is attached from the start; removing it can be undone.
  const [pdf, setPdf] = useState(() => buildPdf());
  const [sending, setSending] = useState(false);

  const file = pdf && { name: `${filename}.pdf`, blob: pdf };
  const signature = me?.name ? { name: me.name, lines: [me.email].filter(Boolean) } : null;
  const recipients = [...to, ...cc, ...bcc];
  const invalid = recipients.filter(a => !isEmailAddress(a));
  const canSend = !sending && to.length > 0 && !invalid.length && subject.trim() && !!file;

  const openPdf = (download) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    if (download) a.download = file.name; else a.target = '_blank';
    a.rel = 'noopener';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const attachments = file ? [{
    key: 'report',
    name: file.name,
    size: file.blob.size,
    onPreview: () => openPdf(false),
    onDownload: () => openPdf(true),
    onRemove: () => setPdf(null),
  }] : [];

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const text = [body.trim(), signature ? `--\n${[signature.name, ...signature.lines].join('\n')}` : ''].filter(Boolean).join('\n\n');
      const res = await apiFetch('/api/send-report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to, cc, bcc,
          subject: subject.trim(),
          text,
          fromName: me?.name,
          replyTo: me?.email,
          attachment: { filename: file.name, contentBase64: await toBase64(file.blob) },
        }),
      });
      if (!res.ok) {
        const out = await res.json().catch(() => ({}));
        throw new Error(out?.error?.message || `Sending failed (${res.status}).`);
      }
      await res.json().catch(() => ({}));
      toast.success(`Report sent to ${to.length === 1 ? to[0] : `${to.length} recipients`}`);
      onClose();
    } catch (err) {
      showToast(err.message || 'Sending failed.');
    } finally {
      setSending(false);
    }
  };

  const headerRight = (
    <>
      <Button variant="primary" size="L" leadingIcon="solar:plain-2-linear" disabled={!canSend} onClick={send}>
        {sending ? 'Sending…' : 'Send'}
      </Button>
      <span className={styles.headerDivider} aria-hidden="true" />
    </>
  );

  return (
    <Drawer title="Compose Email" width={640} onClose={onClose} headerRight={headerRight} noCloseDivider>
      <div className={styles.body}>
        <InfoBar tone="info">{PHI_NOTICE}</InfoBar>
        <Select
          label="From"
          required
          portal
          options={[{ value: 'default', label: `Default (${me?.email || 'you'})` }]}
          value="default"
          onChange={() => {}}
        />
        <RecipientInput
          label="To"
          required
          value={to}
          onChange={setTo}
          labelEnd={(
            <span className={styles.ccLinks}>
              {!showCc && <Link role="button" tabIndex={0} onClick={() => setShowCc(true)}>Cc</Link>}
              {!showCc && !showBcc && <span className={styles.ccDivider} aria-hidden="true" />}
              {!showBcc && <Link role="button" tabIndex={0} onClick={() => setShowBcc(true)}>Bcc</Link>}
            </span>
          )}
        />
        {showCc && <RecipientInput label="Cc" value={cc} onChange={setCc} placeholder="Add Cc recipients" />}
        {showBcc && <RecipientInput label="Bcc" value={bcc} onChange={setBcc} placeholder="Add Bcc recipients" />}
        {invalid.length > 0 && (
          <span className={styles.error}>Check {invalid.length === 1 ? 'this address' : 'these addresses'}: {invalid.join(', ')}</span>
        )}
        <EmailComposer
          subject={subject}
          onSubjectChange={setSubject}
          body={body}
          onBodyChange={setBody}
          signature={signature}
          notice=""
          attachments={attachments}
          attachmentVariant="card"
          toolbarActions={file ? [] : [
            { key: 'attach', icon: 'solar:paperclip-linear', tooltip: 'Attach the report again', onClick: () => setPdf(buildPdf()) },
          ]}
          footerNote={file ? undefined : 'Attach the report to send it.'}
          footerNoteError={!file}
        />
      </div>
    </Drawer>
  );
}
