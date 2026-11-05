import { useState } from 'react';

/**
 * State for <DocumentUploadForm>. Lives in the host so the host can put the
 * Upload action in its own header (drawer / pane) and gate it on `canSave`.
 *
 * Caption auto-fills from the picked file's name (extension stripped) until
 * the user types their own, matching the HCC Upload Document drawer.
 *
 * `initial` ({ id, caption, docType }) starts it editing that document, the
 * same state startEdit() sets, for a host that opens straight into editing.
 */
export function useDocumentUploadForm(initial = null) {
  const [file, setFileState] = useState(null);
  const [caption, setCaptionState] = useState(initial?.caption || '');
  const [captionTouched, setCaptionTouched] = useState(!!initial);
  const [docType, setDocType] = useState(initial?.docType || '');
  // Bumped on reset to remount UploadDropField, which owns its own state.
  const [uploadKey, setUploadKey] = useState(0);
  // Set while editing an existing document's metadata; no file is needed then.
  const [editingId, setEditingId] = useState(initial?.id || null);

  const setFile = (next) => {
    setFileState(next);
    if (next && !captionTouched) setCaptionState(next.name.replace(/\.[a-z0-9]+$/i, ''));
  };
  const setCaption = (next) => {
    setCaptionState(next);
    setCaptionTouched(true);
  };
  const reset = () => {
    setFileState(null);
    setCaptionState('');
    setCaptionTouched(false);
    setDocType('');
    setEditingId(null);
    setUploadKey(k => k + 1);
  };
  const startEdit = (doc) => {
    reset();
    setEditingId(doc.id);
    setCaptionState(doc.caption || '');
    setCaptionTouched(true);
    setDocType(doc.docType || '');
  };

  return {
    file, setFile,
    caption, setCaption,
    docType, setDocType,
    uploadKey,
    editingId,
    reset,
    startEdit,
    canSave: !!((editingId || file) && caption.trim() && docType),
  };
}
