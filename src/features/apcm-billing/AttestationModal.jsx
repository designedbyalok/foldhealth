import { useRef, useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { AttestationResultView } from './AttestationResultView';
import { AttestationSignatoryForm } from './AttestationSignatoryForm';
import { AttestationConsentOptions } from './AttestationConsentOptions';
import { ATTESTATION_TEXT, loadSavedSignatures, now, toBannerProps } from './attestationModalUtils';
import styles from './AttestationModal.module.css';

export function AttestationModal({ patients = [], onClose, onSubmit }) {
  const selectedCount = patients.length;
  const [patientListOpen, setPatientListOpen] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [credentials, setCredentials] = useState('');
  const [npi, setNpi] = useState('');
  const [signatureDate] = useState(now);
  const [signature, setSignature] = useState('');
  const [signatureMode, setSignatureMode] = useState('type'); // 'type' | 'draw'
  const [drawnSignature, setDrawnSignature] = useState(null); // truthy when current pad has strokes
  const [savedSignatures, setSavedSignatures] = useState(loadSavedSignatures);
  const [selectedSavedId, setSelectedSavedId] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const signaturePadRef = useRef(null);
  const [consent, setConsent] = useState(null); // 'accept' | 'decline'
  const [errors, setErrors] = useState({});
  const [resultType, setResultType] = useState(null); // 'accept' | 'decline'

  const validate = () => {
    const e = {};
    if (!providerName.trim()) e.providerName = 'Required';
    if (!credentials.trim()) e.credentials = 'Required';
    if (!/^\d{10}$/.test(npi.trim())) e.npi = 'Must be 10 digits';
    if (signatureMode === 'type') {
      if (!signature.trim()) e.signature = 'Required';
    } else {
      // Draw mode: either drew strokes OR selected a previously saved signature.
      if (!drawnSignature && !selectedSavedId) e.signature = 'Please draw your signature or pick a saved one';
    }
    if (!consent) e.consent = 'Please select an option';
    return e;
  };

  const handleClearSignature = () => {
    signaturePadRef.current?.clear();
    setDrawnSignature(null);
    setErrors(p => ({ ...p, signature: null }));
  };

  const handleDownloadSignature = () => {
    const svg = signaturePadRef.current?.svg;
    if (!svg) return;
    // Wrap the live <svg> as a self-contained file. cloneNode + explicit
    // xmlns so the downloaded file renders standalone in any viewer.
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signature-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // @uiw/react-signature's onPointer fires on each pointer move while
  // drawing. The first invocation tells us a stroke was started, flip
  // drawnSignature truthy so validation + download enable.
  const handlePointer = (points) => {
    if (points && points.length > 0) {
      setDrawnSignature('drawn');
      setErrors(p => ({ ...p, signature: null }));
    }
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setResultType(consent);
  };

  const handleDone = () => {
    onSubmit(consent);
  };

  const handleConsentChange = (value) => {
    setConsent(value);
    setErrors(p => ({ ...p, consent: null }));
  };

  // ── Result view (shown inside Drawer after submit) ──
  if (resultType) {
    return (
      <AttestationResultView
        isAccept={resultType === 'accept'}
        selectedCount={selectedCount}
        onDone={handleDone}
      />
    );
  }

  return (
    <Drawer
      title="APCM Billing Attestation"
      onClose={onClose}
      headerRight={
        <Button leadingIcon="solar:pen-linear" onClick={handleSubmit}>
          Submit Attestation
        </Button>
      }
    >
      <div className={styles.body}>

        {/* Patient summary,
            • 1 patient  → show that patient's banner directly
            • N patients → show a count row that expands to reveal banners */}
        {selectedCount === 1 ? (
          <PatientBanner {...toBannerProps(patients[0])} />
        ) : (
          <div className={styles.patientSummaryGroup}>
            <button
              type="button"
              className={styles.patientSummaryHeader}
              onClick={() => setPatientListOpen(o => !o)}
              aria-expanded={patientListOpen}
            >
              <Icon name="solar:users-group-rounded-linear" size={16} color="var(--primary-400)" />
              <span className={styles.patientSummaryLabel}>
                Attesting for {selectedCount} patients
              </span>
              <Icon
                name="solar:alt-arrow-down-linear"
                size={14}
                color="var(--primary-400)"
                className={`${styles.patientSummaryChevron} ${patientListOpen ? styles.patientSummaryChevronOpen : ''}`}
              />
            </button>
            {patientListOpen && (
              <div className={styles.patientSummaryList}>
                {patients.map(p => <PatientBanner key={p.id} {...toBannerProps(p)} />)}
              </div>
            )}
          </div>
        )}

        {/* Attestation text */}
        <div className={styles.attestationBox}>
          <div className={styles.attestationTitle}>Attestation Statement</div>
          <p className={styles.attestationText}>{ATTESTATION_TEXT}</p>
        </div>

        <AttestationSignatoryForm
          providerName={providerName}
          onProviderNameChange={e => { setProviderName(e.target.value); setErrors(p => ({ ...p, providerName: null })); }}
          credentials={credentials}
          onCredentialsChange={e => { setCredentials(e.target.value); setErrors(p => ({ ...p, credentials: null })); }}
          npi={npi}
          onNpiChange={e => { setNpi(e.target.value.replace(/\D/g, '')); setErrors(p => ({ ...p, npi: null })); }}
          signatureDate={signatureDate}
          signatureMode={signatureMode}
          onSignatureModeChange={(mode) => { setSignatureMode(mode); setErrors(p => ({ ...p, signature: null })); }}
          signature={signature}
          onSignatureChange={e => { setSignature(e.target.value); setErrors(p => ({ ...p, signature: null })); }}
          signaturePadRef={signaturePadRef}
          onPointer={handlePointer}
          onClearSignature={handleClearSignature}
          onDownloadSignature={handleDownloadSignature}
          drawnSignature={drawnSignature}
          errors={errors}
        />

        <AttestationConsentOptions
          consent={consent}
          onConsentChange={handleConsentChange}
          errors={errors}
        />

      </div>
    </Drawer>
  );
}
