import { useId } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Button } from '../../../components/Button/Button';
import { Select } from '../../../components/Select/Select';
import { DatePicker } from '../../../components/DatePicker/DatePicker';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { DemoPhiStrip } from '../../../components/DemoPhiStrip/DemoPhiStrip';
import { todayIso } from './IcdCard.utils';
import styles from './NewDiagGapPanel.module.css';

export function IcdCardBody({
  card, memberDocs, effectiveDosOptions, providerOptions, providerAll,
  posOptions, vtOptions, docTypeOptions, dosIsExisting, showEvidenceList,
  showDropzone, saveDisabled, dragOver, customDateRef,
  onUpdate, onRemove, onSave, handleDosSelect, handleCustomDate, handleVtChange,
  toggleLinkedDoc, setDragOver, onDrop,
}) {
  const uid = useId();
  if (card.collapsed) return null;

  return (
    <>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.fieldTitle} htmlFor={`${uid}-dos`}>
                DOS <span className={styles.required}>•</span>
              </label>
              <Select
                multiple
                id={`${uid}-dos`}
                options={effectiveDosOptions}
                value={card.dosList.map(d => d.value)}
                onChange={handleDosSelect}
                placeholder="Select Date of Service"
              />
              <DatePicker
                ref={customDateRef}
                hidden
                max={todayIso()}
                onSelect={handleCustomDate}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldTitle} htmlFor={`${uid}-provider`}>
                Rendering Provider <span className={styles.required}>•</span>
              </label>
              <Select
                options={providerOptions.length ? providerOptions : providerAll}
                id={`${uid}-provider`}
                value={card.provider}
                onChange={(v) => onUpdate({ provider: v })}
                placeholder="Select Rendering Provider"
                searchable
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldTitle} htmlFor={`${uid}-pos`}>
                POS <span className={styles.required}>•</span>
              </label>
              <Select
                options={posOptions}
                id={`${uid}-pos`}
                value={card.pos}
                onChange={(v) => onUpdate({ pos: v })}
                placeholder="Select Place of Service"
              />
            </div>
            <div className={styles.field}>
              {dosIsExisting ? (
                <>
                  <label className={styles.fieldTitle} htmlFor={`${uid}-doc-type`}>
                    Document Type <span className={styles.required}>•</span>
                  </label>
                  <Select
                    id={`${uid}-doc-type`}
                    options={docTypeOptions}
                    value={card.docType}
                    onChange={(v) => onUpdate({ docType: v })}
                    placeholder="Select Document Type"
                  />
                </>
              ) : (
                <>
                  <label className={styles.fieldTitle} htmlFor={`${uid}-visit-type`}>
                    Visit Type <span className={styles.required}>•</span>
                  </label>
                  <Select
                    id={`${uid}-visit-type`}
                    options={vtOptions}
                    value={card.visitType}
                    onChange={handleVtChange}
                    placeholder="Select Visit Type"
                  />
                </>
              )}
            </div>
          </div>

          {showEvidenceList && (
            <div className={styles.evidenceWrap}>
              <span className={styles.fieldTitle}>
                Evidence Documentation <span className={styles.required}>•</span>
              </span>
              <div className={styles.evidenceCard}>
                <div className={styles.evidenceHeader}>Select From already Linked</div>
                {memberDocs.length === 0 ? (
                  <div className={styles.evidenceEmpty}>No documents linked to this DOS yet.</div>
                ) : memberDocs.map((d) => (
                  <div key={d.id} className={styles.evidenceRow}>
                    <Checkbox
                      checked={card.linkedDocIds.has(d.id)}
                      onCheckedChange={() => toggleLinkedDoc(d.id)}
                    />
                    <span className={styles.evidenceName}>
                      {d.caption || d.n}
                      {d.t && <span className={styles.evidenceType}> ({d.t})</span>}
                    </span>
                    <ActionButton
                      size="S"
                      icon="solar:eye-linear"
                      tooltip="Preview"
                      onClick={() => {}}
                    />
                  </div>
                ))}
                {!card.showUpload && (
                  <button
                    type="button"
                    className={styles.uploadNewLink}
                    onClick={() => onUpdate({ showUpload: true })}
                  >
                    <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
                    <span>Upload New Evidence</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {showDropzone && (
            <div className={styles.uploadWrap}>
              <DemoPhiStrip />
              <label
                className={[styles.dropzone, dragOver ? styles.dropzoneActive : ''].filter(Boolean).join(' ')}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <Icon name="solar:upload-linear" size={24} color="var(--neutral-300)" />
                <div className={styles.dropzoneText}>
                  {card.file ? (
                    <span className={styles.fileName}>{card.file.name}</span>
                  ) : (
                    <>
                      <span>Drag and drop file here or </span>
                      <span className={styles.chooseFile}>Choose file</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className={styles.fileInput}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => onUpdate({ file: e.target.files?.[0] || null })}
                />
              </label>
              <div className={styles.dropzoneMeta}>
                <span>Supported formats: PDF, DOC, JPG, or PNG</span>
                <span>Max size: 100 MB</span>
              </div>
            </div>
          )}

          {/* Footer actions — only rendered in the inline RHS flow (when the
              parent passes `onSave`). The batch/panel flow relies on its own
              header-level Save instead. */}
          {onSave && (
            <div className={styles.cardFooter}>
              <Button
                variant="primary"
                size="S"
                disabled={saveDisabled}
                onClick={onSave}
              >
                Save
              </Button>
              <Button
                variant="secondary"
                size="S"
                onClick={onRemove}
              >
                Cancel
              </Button>
            </div>
          )}
        </>
  );
}
