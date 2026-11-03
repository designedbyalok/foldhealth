import { useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Select } from '../../../../components/Select/Select';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { RadioOptionGroup } from '../../../../components/RadioOptionGroup/RadioOptionGroup';
import { RadioButton } from '../../../../components/RadioButton/RadioButton';
import { Checkbox } from '../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Dropzone } from '../../../../components/Dropzone/Dropzone';
import { FileRow } from '../../../../components/DocumentUploader/DocumentUploader';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { SignaturePad } from '../../../../components/SignaturePad/SignaturePad';
import { PatientBanner } from '../../../../components/PatientBanner/PatientBanner';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { resolvePatientForCall } from '../../../../lib/patientCall';
import { resolvePatientDisplay } from '../../../../lib/patientDisplay';
import { CONSENT_CHANNELS, CONSENT_METHODS, CONSENT_OTHER, CONSENT_PROGRAMS, consentState, methodsFor, validateCapture } from '../../data/consentRules';
import { consentAgreement, consentScript } from '../../data/consentScripts';
import { usePatientConsent } from '../../hooks/usePatientConsent';
import { consentHistory, consentStateLabel, formatConsentMeta } from '../../data/consentDisplay';
import styles from './CaptureConsentDrawer.module.css';

const SCOPE_OPTIONS = [
  ...CONSENT_PROGRAMS.map(p => ({ value: `program:${p.scope}`, label: `${p.scope} · ${p.label}` })),
  ...CONSENT_CHANNELS.map(c => ({ value: `channel:${c.scope}`, label: c.label })),
  ...CONSENT_OTHER.map(c => ({ value: `other:${c.scope}`, label: c.label })),
];

const CHANNEL_TITLE = { call: 'Call', sms: 'SMS', email: 'Email' };

const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg';
const UPLOAD_MIME = ['application/pdf', 'image/png', 'image/jpeg'];

/** Wording for one scope: drawer title, the question, the agreement heading and both choices. */
function scopeCopy(scopeType, scope, currentlyGiven) {
  if (scopeType === 'program') {
    const name = CONSENT_PROGRAMS.find(p => p.scope === scope)?.label || scope;
    return {
      title: `${scope} Program Consent`,
      question: `My consent to enroll for ${scope} care program:`,
      heading: `Agreement to Receive ${name} (${scope}) Services`,
      give: `I give my consent to enroll for ${scope} care program`,
      refuse: currentlyGiven ? `I withdraw my consent for ${scope} care program` : `I choose not to enroll for ${scope} care program`,
    };
  }
  if (scopeType === 'other') {
    return {
      title: 'Data Sharing Consent',
      question: 'My consent to share my health information:',
      heading: 'Agreement to Share Health Information',
      give: 'I give my consent to share my health information',
      refuse: currentlyGiven ? 'I withdraw my consent to share my health information' : 'I choose not to share my health information',
    };
  }
  const label = (CONSENT_CHANNELS.find(c => c.scope === scope)?.label || scope).toLowerCase();
  return {
    title: `${CHANNEL_TITLE[scope] || scope} Consent`,
    question: `My consent to receive ${label}:`,
    heading: `Agreement to Receive ${label.charAt(0).toUpperCase() + label.slice(1)}`,
    give: `I give my consent to receive ${label}`,
    refuse: currentlyGiven ? `I withdraw my consent to receive ${label}` : `I choose not to receive ${label}`,
  };
}

/**
 * Consent capture (Figma 1:35100): the agreement the patient reads with
 * "give" / "choose not to" choices, how the consent was received, then the
 * evidence the record needs (a drawn signature for e-sign, an uploaded form
 * for written; verbal needs nothing more). Saves an immutable record through
 * capturePatientConsent, then hands it to `onCaptured` (e.g. enrollment
 * continuing once consent is given).
 */
export function CaptureConsentDrawer({ patientId, scopeType: initialType, scope: initialScope, status: initialStatus, programId, onCaptured, onClose }) {
  const capturePatientConsent = useAppStore(s => s.capturePatientConsent);
  const patient = useAppStore(s => resolvePatientForCall(s, patientId));
  const { consents } = usePatientConsent(patientId);
  const presetScope = !!(initialType && initialScope);
  const [scopeKey, setScopeKey] = useState(presetScope ? `${initialType}:${initialScope}` : SCOPE_OPTIONS[0].value);
  // 'given' or the refusal (declined / withdrawn); null when neither box is ticked.
  const [status, setStatus] = useState(initialStatus || 'given');
  const [method, setMethod] = useState('verbal');
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [scopeType, scope] = scopeKey.split(':');
  const current = consentState(consents, scopeType, scope);
  const currentlyGiven = current.state === 'given';
  const refusal = currentlyGiven ? 'withdrawn' : 'declined';
  const copy = scopeCopy(scopeType, scope, currentlyGiven);
  const agreement = consentAgreement(scopeType, scope);
  const methods = methodsFor(scopeType, scope);
  const activeMethod = methods.includes(method) ? method : methods[0];
  const given = status === 'given';

  const draft = {
    scopeType,
    scope,
    status,
    method: given ? activeMethod : null,
    artifactPath: given && activeMethod !== 'verbal' && file ? 'pending' : null,
  };
  const problem = validateCapture(draft);
  const history = consentHistory((consents || []).filter(c => c.scopeType === scopeType && c.scope === scope));

  const pickScope = (v) => { setScopeKey(v); setFile(null); setStatus('given'); };
  const pickMethod = (v) => { setMethod(v); setFile(null); };
  const pickStatus = (value, checked) => setStatus(checked ? value : null);

  const save = async () => {
    setSaving(true);
    const result = await capturePatientConsent(patientId, {
      scopeType,
      scope,
      status,
      method: draft.method,
      file: draft.artifactPath ? file : null,
      artifactKind: activeMethod === 'e_sign' ? 'signature' : 'upload',
      note: note.trim() || null,
      programId: scopeType === 'program' ? programId || null : null,
    });
    setSaving(false);
    if (!result.ok) { toast.error(result.error || 'Consent could not be saved'); return; }
    toast.success(given ? 'Consent captured' : status === 'declined' ? 'Decline recorded' : 'Withdrawal recorded');
    onCaptured?.(result.record);
    setClosing(true);
  };

  const display = patient ? resolvePatientDisplay(patient) : null;

  return (
    <Drawer
      title={showHistory ? `${copy.title} History` : copy.title}
      onClose={onClose}
      dismissed={closing}
      closeOnOverlayClick={false}
      headerRight={(
        <>
          <ActionButton
            icon={showHistory ? 'solar:arrow-left-linear' : 'solar:history-linear'}
            tooltip={showHistory ? 'Back' : 'Consent history'}
            onClick={() => setShowHistory(v => !v)}
          />
          {!showHistory && <span className={styles.headerDivider} />}
        </>
      )}
      primaryAction={showHistory ? null : (
        <Button disabled={!!problem} onClick={save} loading={saving}>Save Consent</Button>
      )}
      banner={patient ? (
        <PatientBanner
          initials={patient.initials}
          name={display.displayName || patient.name}
          gender={display.gender}
          age={display.age}
          dob={display.dob}
          memberId={patient.memberId}
        />
      ) : null}
    >
      {showHistory ? (
        <div className={styles.history}>
          {history.length ? history.map(h => (
            <div key={h.id} className={styles.historyRow}>
              <span className={styles.historyStatus}>{h.status}</span>
              <span className={styles.muted}>{h.meta}</span>
            </div>
          )) : <span className={styles.muted}>No consent has been recorded for this yet.</span>}
        </div>
      ) : (
        <div className={styles.body}>
          {!presetScope && (
            <section className={styles.step}>
              <span className={styles.stepTitle}>Consent for</span>
              <Select options={SCOPE_OPTIONS} value={scopeKey} onChange={pickScope} aria-label="Consent for" />
            </section>
          )}

          <section className={styles.step}>
            {!agreement?.bare && <span className={styles.stepTitle}>{copy.question}</span>}
            {current.record && (
              <span className={styles.muted}>Currently: {consentStateLabel(current.state)} · {formatConsentMeta(current.record)}</span>
            )}
            <div className={styles.agreementBox}>
              <div className={styles.agreement}>
                <span className={styles.agreementTitle}>{agreement?.title || copy.heading}</span>
                {agreement ? (
                  <div className={styles.agreementBlocks}>
                    {agreement.blocks.map((b, i) => (
                      <div key={i} className={styles.agreementBlock}>
                        {b.label && <p className={styles.agreementText}>{b.label}</p>}
                        {b.text && <p className={styles.agreementText}>{b.text}</p>}
                        {b.items && (
                          <ul className={styles.agreementList}>
                            {b.items.map(item => <li key={item}>{item}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.agreementText}>{consentScript(scopeType, scope)}</p>
                )}
              </div>
              {agreement?.statement ? (
                <div className={styles.statement}>
                  <p className={styles.statementText}>{agreement.statement}</p>
                  <div className={styles.statementChoices} role="radiogroup" aria-label={agreement.statement}>
                    <RadioButton name="consent-answer" value="given" label="Accept" checked={given} onChange={() => setStatus('given')} />
                    <RadioButton name="consent-answer" value={refusal} label="Decline" checked={status === refusal} onChange={() => setStatus(refusal)} />
                  </div>
                </div>
              ) : (
                <>
                  <label className={styles.choice}>
                    <Checkbox checked={given} onCheckedChange={v => pickStatus('given', v === true)} />
                    <span>{copy.give}</span>
                  </label>
                  <label className={`${styles.choice} ${styles.choiceRefuse}`}>
                    <Checkbox checked={status === refusal} onCheckedChange={v => pickStatus(refusal, v === true)} />
                    <span>{copy.refuse}</span>
                  </label>
                </>
              )}
            </div>
          </section>

          {given && (
            <section className={styles.step}>
              <span className={styles.stepTitle}>
                {methods.length > 1 ? 'Consent is received' : activeMethod === 'e_sign' ? 'Signature' : 'Signed form'}
                <span className={styles.required} aria-hidden="true" />
              </span>
              {methods.length > 1 && (
                <RadioOptionGroup
                  name="consent-method"
                  options={CONSENT_METHODS.filter(m => methods.includes(m.value))}
                  value={activeMethod}
                  onChange={pickMethod}
                />
              )}

              {activeMethod === 'e_sign' && (
                <SignaturePad key={scopeKey} onChange={setFile} ariaLabel="Patient signature" />
              )}
              {activeMethod === 'written' && (file ? (
                <FileRow
                  file={file}
                  phase="ready"
                  actions={<ActionButton icon="solar:close-circle-linear" size="sm" tooltip="Remove file" onClick={() => setFile(null)} />}
                />
              ) : (
                <Dropzone
                  accept={UPLOAD_ACCEPT}
                  acceptMime={UPLOAD_MIME}
                  helperText="Signed form: PDF, PNG or JPG"
                  onPick={setFile}
                  onReject={() => toast.error('Upload a PDF, PNG or JPG')}
                />
              ))}
            </section>
          )}

          {!agreement?.bare && (
            <section className={styles.stepTight}>
              <span className={styles.stepTitle}>Notes</span>
              <Textarea rows={3} placeholder="Add a note (optional)" value={note} onChange={e => setNote(e.target.value)} />
            </section>
          )}

          {problem && given && <span className={styles.muted}>{problem}.</span>}
        </div>
      )}
    </Drawer>
  );
}
