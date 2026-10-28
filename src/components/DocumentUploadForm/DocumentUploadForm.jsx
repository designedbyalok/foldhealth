import { DemoPhiStrip } from '../DemoPhiStrip/DemoPhiStrip';
import { UploadDropField } from '../UploadDropField/UploadDropField';
import { Select } from '../Select/Select';
import { Input } from '../Input/Input';
import styles from './DocumentUploadForm.module.css';

/**
 * DocumentUploadForm — the HCC upload widget (demo-PHI strip + UploadDropField)
 * with two metadata fields: Document Type and Caption. Pass the object
 * returned by `useDocumentUploadForm()` as `form`.
 *
 * @param {object}   props
 * @param {object}   props.form      – from useDocumentUploadForm()
 * @param {string[]} props.docTypes  – Document Type options
 */
export function DocumentUploadForm({ form, docTypes = [], initialFile = null }) {
  return (
    <div className={styles.form}>
      {/* Editing an existing document only changes its metadata. */}
      {!form.editingId && (
        <>
          <DemoPhiStrip />
          <UploadDropField key={form.uploadKey} onChange={form.setFile} initialFile={initialFile} />
        </>
      )}
      <Select
        label="Document Type"
        required
        options={docTypes.map(t => ({ value: t, label: t }))}
        value={form.docType}
        onChange={form.setDocType}
        placeholder="Select Type"
      />
      <Input
        label="Caption"
        required
        value={form.caption}
        onChange={e => form.setCaption(e.target.value)}
        placeholder="Add caption"
      />
    </div>
  );
}
