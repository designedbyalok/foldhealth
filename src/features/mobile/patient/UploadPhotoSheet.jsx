import { useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { ALL_CATEGORY, FILE_TYPES, withCustomCategories } from '../../patient/right-panel/tabs/documents/documentsData';
import { PickerField } from './FormScreen';
import styles from './patientForm.module.css';
import own from './UploadPhotoSheet.module.css';

const pad = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`; };
const extOf = name => (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1]?.toLowerCase() || null;
const stripExt = name => String(name || '').replace(/\.[a-z0-9]+$/i, '');
const TYPE_OPTIONS = FILE_TYPES.map(t => ({ value: t, label: t }));

/**
 * File a photo taken from the profile's Camera tile into the patient's
 * documents, the desktop Upload File drawer's fields (name, file type,
 * category, all required) and the same addProgramDocument payload as the
 * Documents tab.
 */
export function UploadPhotoSheet({ patient, file, onClose }) {
  const addProgramDocument = useAppStore(s => s.addProgramDocument);
  const currentActorName = useAppStore(s => s.currentActorName);
  const customCategories = useAppStore(s => s.documentCategories);
  const fetchDocumentCategories = useAppStore(s => s.fetchDocumentCategories);
  const [name, setName] = useState(() => stripExt(file.name) || 'Photo');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const preview = useMemo(() => (/^image\//.test(file.type) ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => { fetchDocumentCategories?.(); }, [fetchDocumentCategories]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const categories = useMemo(
    () => withCustomCategories(customCategories || []).filter(c => c.key !== ALL_CATEGORY).map(c => ({ value: c.key, label: c.label })),
    [customCategories],
  );
  const canSave = !!name.trim() && !!type && !!category;

  const upload = () => {
    if (!canSave) return;
    const ext = extOf(file.name);
    const caption = name.trim();
    addProgramDocument({
      id: `pdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      programCode: null,
      patientId: String(patient.id),
      name: ext && !extOf(caption) ? `${caption}.${ext}` : caption,
      type,
      category,
      sizeBytes: file.size,
      updatedBy: currentActorName?.() || 'You',
      updatedDate: today(),
      createdAt: new Date().toISOString(),
      ext,
    }, file);
    toast.success('Document uploaded');
    onClose();
  };

  return (
    <BottomSheet title="Upload Document" onClose={onClose}>
      <div className={styles.sheetForm}>
        {preview && <img src={preview} alt="Captured document" className={own.preview} />}
        <Input label="Name" required size="lg" enterKeyHint="done" value={name} onValueChange={setName} />
        <PickerField label="File Type" required options={TYPE_OPTIONS} value={type} placeholder="Select file type" onChange={setType} />
        <PickerField label="Category" required options={categories} value={category} placeholder="Select category" onChange={setCategory} />
        <Button size="lg" fullWidth disabled={!canSave} onClick={upload}>Upload</Button>
      </div>
    </BottomSheet>
  );
}
