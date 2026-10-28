import { useState } from 'react';
import { Button } from '../../../../../components/Button/Button';
import { DocumentUploadForm } from '../../../../../components/DocumentUploadForm/DocumentUploadForm';
import { useDocumentUploadForm } from '../../../../../components/DocumentUploadForm/useDocumentUploadForm';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Select } from '../../../../../components/Select/Select';
import { ALL_CATEGORY, FILE_TYPES } from './documentsData';
import styles from './DocumentsTab.module.css';


const stripExt = name => String(name || '').replace(/\.[a-z0-9]+$/i, '');

/**
 * Upload File: pick a file, its category (folder) and file type. With `doc`
 * it updates that document instead: name, type and category, and a new file
 * only if one is picked.
 */
export function UploadDocumentDrawer({ categories, doc, initialCategory, initialFile = null, onUpload, onClose }) {
  const categoryOptions = categories.filter(c => c.key !== ALL_CATEGORY).map(c => ({ value: c.key, label: c.label, icon: c.icon }));
  // Pre-fill the caption from the dropped file's name (minus extension) the
  // same way useDocumentUploadForm does on first pick, so the drag path and
  // the browse path land in the same state.
  const seed = doc
    ? { id: doc.id, caption: stripExt(doc.name), docType: doc.type }
    : (initialFile ? { caption: stripExt(initialFile.name) } : null);
  const form = useDocumentUploadForm(seed);
  const [category, setCategory] = useState(initialCategory || '');
  const canSave = form.canSave && !!category;

  const submit = () => {
    if (!canSave) return;
    onUpload({ file: form.file, name: form.caption.trim(), type: form.docType, category });
  };

  return (
    <Drawer
      title={doc ? 'Update File' : 'Upload File'}
      onClose={onClose}
      primaryAction={<Button variant="primary" size="L" disabled={!canSave} onClick={submit}>{doc ? 'Update' : 'Upload'}</Button>}
    >
      <div className={styles.uploadForm}>
        <DocumentUploadForm form={form} docTypes={FILE_TYPES} initialFile={initialFile} />
        <Select
          label="Category"
          required
          options={categoryOptions}
          value={category}
          onChange={setCategory}
          placeholder="Select Category"
        />
      </div>
    </Drawer>
  );
}
