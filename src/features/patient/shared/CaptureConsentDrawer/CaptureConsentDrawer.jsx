import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Select } from '../../../../components/Select/Select';
import { Input } from '../../../../components/Input/Input';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { DatePicker } from '../../../../components/DatePicker/DatePicker';
import { RadioOptionGroup } from '../../../../components/RadioOptionGroup/RadioOptionGroup';
import { Dropzone } from '../../../../components/Dropzone/Dropzone';
import { FileRow } from '../../../../components/DocumentUploader/DocumentUploader';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { SignaturePad } from '../../../../components/SignaturePad/SignaturePad';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { todayIso } from '../../../../lib/clinicalDates';
import { CONSENT_CHANNELS, CONSENT_METHODS, CONSENT_PROGRAMS, consentState, methodsFor, validateCapture } from '../../data/consentRules';
import { consentScript } from '../../data/consentScripts';
import { usePatientConsent } from '../../hooks/usePatientConsent';
import { consentStateLabel, formatConsentMeta } from '../../data/consentDisplay';
import styles from './CaptureConsentDrawer.module.css';

const SCOPE_OPTIONS = [
  ...CONSENT_PROGRAMS.map(p => ({ value: `program:${p.scope}`, label: `${p.scope} · ${p.label}` })),
  ...CONSENT_CHANNELS.map(c => ({ value: `channel:${c.scope}`, label: c.label })),
];

const METHOD_HINT = {
  verbal: 'Read the script to the patient and record who witnessed it.',
  written: 'Upload the signed form (PDF or image).',
  e_sign: 'The patient signs on this screen.',
};

const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg';
const UPLOAD_MIME = ['application/pdf', 'image/png', 'image/jpeg'];

/**
 * Guided consent capture: what the consent is for, the patient's decision,
 * how it was given, the script to read, then the evidence (witness for
 * verbal, a drawn signature for e-sign, an uploaded form for written).
 * Saves an immutable record through capturePatientConsent, then hands it
 * to `onCaptured` (e.g. enrollment continuing once consent is given).
 */
export function CaptureConsentDrawer({ patientId, scopeType: initialType, scope: initialScope, status: initialStatus, programId, onCaptured, onClose }) {
  const capturePatientConsent = useAppStore(s => s.capturePatientConsent);
  const { consents } = usePatientConsent(patientId);
  const [scopeKey, setScopeKey] = useState(initialType && initialScope ? `${initialType}:${initialScope}` : SCOPE_OPTIONS[0].value);
  const [status, setStatus] = useState(initialStatus || 'given');
  const [method, setMethod] = useState('verbal');
  const [witness, setWitness] = useState('');
  const [file, setFile] = useState(null);
  const [expiresOn, setExpiresOn] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  const [scopeType, scope] = scopeKey.split(':');
  const current = consentState(consents, scopeType, scope);
  const methods = methodsFor(scopeType, scope);
  const activeMethod = methods.includes(method) ? method : methods[0];

  const statusOptions = [
    { value: 'given', label: 'Consent given' },
    { value: 'declined', label: 'Declined' },
    {
      value: 'withdrawn',
      label: 'Withdrawn',
      disabled: current.state !== 'given',
      disabledReason: 'Only a consent that was given can be withdrawn',
    },
  ];

  const draft = {
    scopeType,
    scope,
    status,
    method: status === 'given' ? activeMethod : null,
    witness: status === 'given' && activeMethod === 'verbal' ? witness : null,
    artifactPath: status === 'given' && activeMethod !== 'verbal' && file ? 'pending' : null,
  };
  const problem = validateCapture(draft);

  const pickScope = (v) => { setScopeKey(v); setFile(null); setStatus('given'); };
  const pickMethod = (v) => { setMethod(v); setFile(null); };

  const save = async () => {
    setSaving(true);
    const result = await capturePatientConsent(patientId, {
      scopeType,
      scope,
      status,
      method: draft.method,
      witness: draft.witness,
      file: draft.artifactPath ? file : null,
      artifactKind: activeMethod === 'e_sign' ? 'signature' : 'upload',
      expiresOn: status === 'given' && expiresOn ? expiresOn : null,
      note: note.trim() || null,
      programId: scopeType === 'program' ? programId || null : null,
    });
    setSaving(false);
    if (!result.ok) { toast.error(result.error || 'Consent could not be saved'); return; }
    toast.success(status === 'given' ? 'Consent captured' : status === 'declined' ? 'Decline recorded' : 'Withdrawal recorded');
    onCaptured?.(result.record);
    setClosing(true);
  };

  return (
    <Drawer
      title="Capture Consent"
      onClose={onClose}
      dismissed={closing}
      closeOnOverlayClick={false}
      primaryAction={<Button variant="primary" size="L" disabled={!!problem || saving} onClick={save}>{saving ? 'Saving…' : 'Save Consent'}</Button>}
    >
      <div className={styles.body}>
        <section className={styles.step}>
          <span className={styles.stepTitle}>1. Consent for</span>
          <Select options={SCOPE_OPTIONS} value={scopeKey} onChange={pickScope} aria-label="Consent for" />
          <span className={styles.muted}>
            Currently: {consentStateLabel(current.state)}{current.record ? ` · ${formatConsentMeta(current.record)}` : ''}
          </span>
        </section>

        <section className={styles.step}>
          <span className={styles.stepTitle}>2. Patient's decision</span>
          <RadioOptionGroup name="consent-status" options={statusOptions} value={status} onChange={setStatus} />
        </section>

        {status === 'given' && (
          <section className={styles.step}>
            <span className={styles.stepTitle}>3. How was it given?</span>
            <RadioOptionGroup
              name="consent-method"
              variant="card"
              options={CONSENT_METHODS.filter(m => methods.includes(m.value)).map(m => ({ ...m, hint: METHOD_HINT[m.value] }))}
              value={activeMethod}
              onChange={pickMethod}
            />
            {scope === 'tcpa' && <span className={styles.muted}>TCPA consent needs a written or e-signed record.</span>}
          </section>
        )}

        <section className={styles.step}>
          <span className={styles.stepTitle}>{status === 'given' ? '4. Read to the patient' : '3. What was offered'}</span>
          <blockquote className={styles.script}>{consentScript(scopeType, scope)}</blockquote>
        </section>

        {status === 'given' && (
          <section className={styles.step}>
            <span className={styles.stepTitle}>5. {activeMethod === 'verbal' ? 'Witness' : activeMethod === 'e_sign' ? 'Patient signature' : 'Signed form'}</span>
            {activeMethod === 'verbal' && (
              <Input placeholder="Who witnessed the consent" aria-label="Witnessed by" value={witness} onChange={e => setWitness(e.target.value)} />
            )}
            {activeMethod === 'e_sign' && (
              <SignaturePad key={scopeKey} onChange={setFile} ariaLabel="Patient signature" />
            )}
            {activeMethod === 'written' && (file ? (
              <FileRow
                file={file}
                phase="ready"
                actions={<ActionButton icon="solar:close-circle-linear" size="S" tooltip="Remove file" onClick={() => setFile(null)} />}
              />
            ) : (
              <Dropzone
                accept={UPLOAD_ACCEPT}
                acceptMime={UPLOAD_MIME}
                helperText="PDF, PNG or JPG"
                onPick={setFile}
                onReject={() => toast.error('Upload a PDF, PNG or JPG')}
              />
            ))}
            <div className={styles.row}>
              <div className={styles.date}>
                <DatePicker label="Expires on" value={expiresOn} onSelect={setExpiresOn} min={todayIso()} helperText="Leave empty if it doesn't expire" />
              </div>
            </div>
          </section>
        )}

        <section className={styles.step}>
          <span className={styles.stepTitle}>Note</span>
          <Textarea rows={3} placeholder="Add a note (optional)" value={note} onChange={e => setNote(e.target.value)} />
        </section>

        {problem && status === 'given' && <span className={styles.muted}>{problem}.</span>}
      </div>
    </Drawer>
  );
}
