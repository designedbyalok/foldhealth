import { useId } from 'react';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Toggle } from '../../../components/Toggle/Toggle';
import { Select } from '../../../components/Select/Select';
import { POS_LABEL } from './mockOcr';
import { ACCEPT_EXT, isAcceptedFile } from './UploadDocumentDrawerSingle.utils';
import styles from './UploadDocumentDrawer.module.css';

export function SinglePhasePatientSection({
  patient,
  patientQuery,
  patientMatches,
  onQueryChange,
  onSelectPatient,
  onClearPatient,
}) {
  return (
    <div className={styles.singleSection}>
      <span className={styles.singleLabel}>Patient *</span>
      {patient ? (
        <div className={styles.singlePatientChip}>
          <Avatar variant="patient" initials={patient.in} />
          <div className={styles.singlePatientText}>
            <div className={styles.singlePatientName}>{patient.name}</div>
            <div className={styles.singlePatientMeta}>
              {patient.memberId || patient.member_id || '—'} · DOB {patient.dob || '—'}
            </div>
          </div>
          <button type="button" className={styles.singlePatientChange} onClick={onClearPatient}>
            Change
          </button>
        </div>
      ) : (
        <>
          <Input
            placeholder="Search Fold patients by name…"
            value={patientQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            autoFocus
          />
          <div className={styles.memberPickerList}>
            {patientMatches.map(m => (
              <button
                key={m.id}
                type="button"
                className={styles.memberPickerItem}
                onClick={() => onSelectPatient(m)}
              >
                <Avatar variant="patient" initials={m.in} />
                <span>{m.name}</span>
                <span className={styles.memberPickerMeta}>{m.memberId || m.member_id || ''}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SinglePhaseIcdSection({
  icdQuery,
  icdMatches,
  icds,
  onQueryChange,
  onAddIcd,
  onRemoveIcd,
}) {
  const uid = useId();
  return (
    <div className={styles.singleSection}>
      <label className={styles.singleLabel} htmlFor={`${uid}-icd-query`}>ICD codes *</label>
      <Input
        id={`${uid}-icd-query`}
        placeholder="Search by code or description (e.g. E11.9, COPD)…"
        value={icdQuery}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      {icdMatches.length > 0 && (
        <div className={styles.icdMatchList}>
          {icdMatches.map(m => (
            <button
              key={m.code}
              type="button"
              className={styles.icdMatchItem}
              onClick={() => onAddIcd(m)}
            >
              <code className={styles.icdMatchCode}>{m.code}</code>
              <span className={styles.icdMatchDesc}>{m.desc}</span>
              {m.hcc && <span className={styles.icdMatchHcc}>{m.hcc.replace(/ - .*$/, '')}</span>}
            </button>
          ))}
        </div>
      )}
      {icds.length > 0 && (
        <div className={styles.icdChosen}>
          {icds.map(i => (
            <span key={i.code} className={styles.icdChosenChip}>
              <code>{i.code}</code>
              <span className={styles.icdChosenDesc}>{i.desc}</span>
              <button
                type="button"
                className={styles.icdChosenRemove}
                aria-label={`Remove ${i.code}`}
                onClick={() => onRemoveIcd(i.code)}
              >
                <Icon name="solar:close-circle-linear" size={12} color="var(--neutral-300)" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SinglePhaseDosSection({
  patient,
  dosMode,
  dos,
  existingDosList,
  onDosModeChange,
  onDosChange,
}) {
  return (
    <div className={styles.singleSection}>
      <span className={styles.singleLabel}>Date of Service *</span>
      <Toggle
        size="S"
        items={[
          { key: 'existing', label: 'Use existing', disabled: !patient || existingDosList.length === 0 },
          { key: 'new', label: 'New DOS' },
        ]}
        active={dosMode}
        onChange={onDosModeChange}
      />
      {dosMode === 'existing' && patient ? (
        <Select
          options={[
            { value: '', label: 'Select a DOS…' },
            ...existingDosList.map(d => ({ value: d, label: d })),
          ]}
          value={dos}
          onChange={onDosChange}
          placeholder="Select a DOS…"
        />
      ) : (
        <Input placeholder="MM/DD/YYYY" value={dos} onChange={(e) => onDosChange(e.target.value)} />
      )}
    </div>
  );
}

export function SinglePhaseEncounterGrid({
  provider,
  pos,
  docType,
  condition,
  onProviderChange,
  onPosChange,
  onDocTypeChange,
  onConditionChange,
}) {
  const uid = useId();
  return (
    <div className={styles.singleGrid}>
      <div className={styles.singleField}>
        <label className={styles.singleLabel} htmlFor={`${uid}-provider`}>Rendering Provider *</label>
        <Input id={`${uid}-provider`} placeholder="Dr. Sarah Connor" value={provider} onChange={(e) => onProviderChange(e.target.value)} />
      </div>
      <div className={styles.singleField}>
        <label className={styles.singleLabel} htmlFor={`${uid}-pos`}>POS *</label>
        <Select
          id={`${uid}-pos`}
          options={Object.entries(POS_LABEL).map(([code, label]) => ({
            value: code,
            label: `${code} — ${label}`,
          }))}
          value={pos}
          onChange={onPosChange}
        />
      </div>
      <div className={styles.singleField}>
        <label className={styles.singleLabel} htmlFor={`${uid}-doc-type`}>Document Type</label>
        <Select
          id={`${uid}-doc-type`}
          options={['Progress Note', 'SOAP Note', 'Telehealth Note', 'Visit Summary', 'Lab Report', 'Imaging Report'].map(t => ({
            value: t,
            label: t,
          }))}
          value={docType}
          onChange={onDocTypeChange}
        />
      </div>
      <div className={styles.singleField}>
        <label className={styles.singleLabel} htmlFor={`${uid}-condition`}>Condition / Notes</label>
        <Input id={`${uid}-condition`} placeholder="Short clinical note (optional)" value={condition} onChange={(e) => onConditionChange(e.target.value)} />
      </div>
    </div>
  );
}

export function SinglePhaseFileSection({ file, fileInputRef, showToast, onFileChange, onRemoveFile }) {
  const uid = useId();
  return (
    <div className={styles.singleSection}>
      <label className={styles.singleLabel} htmlFor={`${uid}-file`}>Supporting document</label>
      {file ? (
        <div className={styles.singleFileChip}>
          <Icon name="solar:file-text-linear" size={16} color="var(--neutral-400)" />
          <span className={styles.singleFileName}>{file.name}</span>
          <button type="button" className={styles.singleFileRemove} onClick={onRemoveFile}>
            Remove
          </button>
        </div>
      ) : (
        <button type="button" className={styles.singleFileBtn} onClick={() => fileInputRef.current?.click()}>
          <Icon name="solar:upload-linear" size={14} color="var(--primary-300)" />
          Attach document
        </button>
      )}
      <input
        id={`${uid}-file`}
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_EXT}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (!isAcceptedFile(f)) {
            showToast('Please upload a PDF, DOC, JPG, PNG, or TIFF file');
            return;
          }
          onFileChange(f);
        }}
      />
    </div>
  );
}

export function SinglePhaseFooter({ canConfirm, onConfirm }) {
  return (
    <div className={styles.singleFooter}>
      <Button variant="primary" size="M" disabled={!canConfirm} onClick={onConfirm}>
        Add Encounter
      </Button>
    </div>
  );
}
