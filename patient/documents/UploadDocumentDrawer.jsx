import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Drawer } from '@/components/Drawer/Drawer';
import { Button } from '@/components/Button/Button';
import { Input } from '@/components/Input/Input';
import { RadioOptionGroup } from '@/components/RadioOptionGroup/RadioOptionGroup';
import { UploadDropField } from '@/components/UploadDropField/UploadDropField';
import { CATEGORIES, uploadPath, uploadProblem } from './docFormat';
import styles from './Documents.module.css';

// The file goes to the patient's own folder in storage first; the server then
// checks it (type, size, folder) before it shows up for the patient and staff.
export function UploadDocumentDrawer({ memberId, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const pick = (f) => {
    setFile(f);
    setError(f ? uploadProblem(f) || '' : '');
    if (f && !name) setName(f.name);
  };

  const upload = async () => {
    const problem = uploadProblem(file);
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      const path = uploadPath(memberId, file.name, crypto.randomUUID());
      const { error: upErr } = await supabase.storage.from('program-documents')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { setError('The file was not uploaded. Try again.'); return; }
      const { error: e } = await supabase.rpc('patient_add_document', {
        p_member_id: memberId, p_storage_path: path, p_name: name.trim() || file.name, p_category: category,
      });
      if (e) { setError(e.message || 'The file was not saved. Try again.'); return; }
      toast.success('Document uploaded. Your care team can see it now.');
      onUploaded();
      setDismissed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title="Upload Document"
      onClose={onClose}
      dismissed={dismissed}
      width={560}
      primaryAction={(
        <Button variant="primary" size="L" disabled={!file || !!error || saving} onClick={upload}>
          {saving ? 'Uploading…' : 'Upload'}
        </Button>
      )}
    >
      <div className={styles.form}>
        <UploadDropField
          onChange={pick}
          accept=".pdf,.jpg,.jpeg,.png,.heic"
          helperText="Supported formats: PDF, JPG, PNG or HEIC"
          secondaryText="Max size: 10 MB"
        />
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Input label="Document name" aria-label="Document name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        <RadioOptionGroup
          label="Folder"
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
        />
      </div>
    </Drawer>
  );
}
