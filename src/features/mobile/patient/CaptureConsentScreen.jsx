import { useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Icon } from '../../../components/Icon/Icon';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { SignaturePad } from '../../../components/SignaturePad/SignaturePad';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import {
  CONSENT_CHANNELS, CONSENT_METHODS, CONSENT_OTHER, CONSENT_PROGRAMS, consentState, methodsFor, validateCapture,
} from '../../patient/data/consentRules';
import { consentAgreement, consentScript } from '../../patient/data/consentScripts';
import { consentStateLabel, formatConsentMeta } from '../../patient/data/consentDisplay';
import { usePatientConsent } from '../../patient/hooks/usePatientConsent';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen, PickerField } from './FormScreen';
import { usePatient } from './usePatient';
import styles from './patientForm.module.css';
import own from './CaptureConsentScreen.module.css';

const SCOPE_OPTIONS = [
  ...CONSENT_PROGRAMS.map(p => ({ value: `program:${p.scope}`, label: `${p.scope} · ${p.label}` })),
  ...CONSENT_CHANNELS.map(c => ({ value: `channel:${c.scope}`, label: c.label })),
  ...CONSENT_OTHER.map(c => ({ value: `other:${c.scope}`, label: c.label })),
];
const CHANNEL_TITLE = { call: 'Call', sms: 'SMS', email: 'Email' };

// The desktop drawer's wording (CaptureConsentDrawer scopeCopy).
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
 * Capture Consent on the phone, the desktop CaptureConsentDrawer as a
 * screen: the agreement the patient reads, give / refuse, how it was
 * received, then the evidence (a drawn signature for e-sign, a photo or file
 * of the signed form for written; verbal needs nothing). Saves one immutable
 * record through capturePatientConsent.
 */
export function CaptureConsentScreen({ patientId, scopeType: presetType, scope: presetScope }) {
  const { pop } = useMobileNav();
  const patient = usePatient(patientId);
  const capturePatientConsent = useAppStore(s => s.capturePatientConsent);
  const { consents } = usePatientConsent(patientId);
  const preset = !!(presetType && presetScope);
  const [scopeKey, setScopeKey] = useState(preset ? `${presetType}:${presetScope}` : SCOPE_OPTIONS[0].value);
  const [status, setStatus] = useState('given');
  const [method, setMethod] = useState('verbal');
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

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

  const pickScope = (v) => { setScopeKey(v); setFile(null); setStatus('given'); };
  const pickMethod = (v) => { setMethod(v); setFile(null); };
  const pickStatus = (value, checked) => setStatus(checked ? value : null);

  const save = async () => {
    if (problem) return;
    setSaving(true);
    const result = await capturePatientConsent(patientId, {
      scopeType,
      scope,
      status,
      method: draft.method,
      file: draft.artifactPath ? file : null,
      artifactKind: activeMethod === 'e_sign' ? 'signature' : 'upload',
      note: note.trim() || null,
      programId: null,
    });
    setSaving(false);
    if (!result.ok) { toast.error(result.error || 'Consent could not be saved'); return; }
    toast.success(given ? 'Consent captured' : status === 'declined' ? 'Decline recorded' : 'Withdrawal recorded');
    pop();
  };

  return (
    <FormScreen
      title={copy.title}
      subtitle={patient?.name}
      footer={<Button size="lg" fullWidth disabled={!!problem || saving} loading={saving} onClick={save}>Save Consent</Button>}
    >
      {!preset && <PickerField label="Consent For" options={SCOPE_OPTIONS} value={scopeKey} onChange={pickScope} />}

      <FieldGroup label={agreement?.bare ? null : copy.question}>
        {current.record && <span className={styles.hint}>Currently: {consentStateLabel(current.state)} · {formatConsentMeta(current.record)}</span>}
        <div className={own.agreement}>
          <span className={own.agreementTitle}>{agreement?.title || copy.heading}</span>
          {agreement ? agreement.blocks.map((b, i) => (
            <div key={i} className={own.block}>
              {b.label && <p className={own.text}>{b.label}</p>}
              {b.text && <p className={own.text}>{b.text}</p>}
              {b.items && <ul className={own.list}>{b.items.map(item => <li key={item}>{item}</li>)}</ul>}
            </div>
          )) : <p className={own.text}>{consentScript(scopeType, scope)}</p>}
        </div>
        {agreement?.statement ? (
          <>
            <p className={own.statement}>{agreement.statement}</p>
            <RadioOptionGroup
              name="consent-answer"
              variant="card"
              orientation="horizontal"
              options={[{ value: 'given', label: 'Accept' }, { value: refusal, label: 'Decline' }]}
              value={status}
              onChange={setStatus}
            />
          </>
        ) : (
          <div className={own.choices}>
            <label className={own.choice}>
              <Checkbox checked={given} onCheckedChange={v => pickStatus('given', v === true)} />
              <span>{copy.give}</span>
            </label>
            <label className={own.choice}>
              <Checkbox checked={status === refusal} onCheckedChange={v => pickStatus(refusal, v === true)} />
              <span>{copy.refuse}</span>
            </label>
          </div>
        )}
      </FieldGroup>

      {given && (
        <FieldGroup label={methods.length > 1 ? 'Consent is received' : activeMethod === 'e_sign' ? 'Signature' : 'Signed form'} required>
          {methods.length > 1 && (
            <RadioOptionGroup
              name="consent-method"
              variant="card"
              options={CONSENT_METHODS.filter(m => methods.includes(m.value))}
              value={activeMethod}
              onChange={pickMethod}
            />
          )}
          {activeMethod === 'e_sign' && <SignaturePad key={scopeKey} onChange={setFile} ariaLabel="Patient signature" />}
          {activeMethod === 'written' && (file ? (
            <div className={own.file}>
              <Icon name="solar:document-text-linear" size={24} color="currentColor" />
              <span className={own.fileName}>{file.name}</span>
              <button type="button" className={own.fileRemove} aria-label="Remove file" onClick={() => setFile(null)}>
                <Icon name="solar:close-circle-linear" size={24} color="currentColor" />
              </button>
            </div>
          ) : (
            <label className={own.pick}>
              <Icon name="solar:camera-linear" size={24} color="currentColor" />
              <span>Photograph or attach the signed form</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,image/*"
                className={own.hiddenInput}
                aria-label="Signed consent form"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && !/pdf|png|jpe?g/i.test(f.type || f.name)) { toast.error('Upload a PDF, PNG or JPG'); return; }
                  if (f) setFile(f);
                }}
              />
            </label>
          ))}
        </FieldGroup>
      )}

      {!agreement?.bare && <Textarea title="Notes" rows={3} placeholder="Add a note (optional)" value={note} onValueChange={setNote} />}
      {problem && given && <span className={styles.hint}>{problem}.</span>}
    </FormScreen>
  );
}
