import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { UploadDropField } from '../../components/UploadDropField/UploadDropField';
import { DemoPhiStrip } from '../../components/DemoPhiStrip/DemoPhiStrip';
import { Select } from '../../components/Select/Select';
import { DOC_TYPES, makeUploadedChartDoc } from './data/chartDocs';
import styles from './UploadChartDrawer.module.css';

/**
 * UploadChartDrawer — right-side drawer used by the HCC worklist to upload a
 * chart document for a single member. Mounted in `AppLayout` and driven by
 * `hccUploadMember` store state.
 *
 * Phase 3c covers the visual shell + form validation. The actual file upload
 * (Supabase storage push, audit-log entry) is a follow-up.
 */
export function UploadChartDrawer() {
  const member = useAppStore(s => s.hccUploadMember);
  const editDoc = useAppStore(s => s.hccUploadEditDoc);
  const close = useAppStore(s => s.closeHccUploadDrawer);
  const showToast = useAppStore(s => s.showToast);
  // Log the upload to the Diagnosis Gaps Activity Log when the drawer was
  // launched from inside the DiagPanel. addActivityEntry resolves member +
  // current DOS from store state automatically; ICD-scope is picked up from
  // diagActivityIcd so the entry shows in both the ICD and DOS-level logs.
  const addActivityEntry = useAppStore(s => s.addActivityEntry);
  const activityIcd = useAppStore(s => s.diagActivityIcd);
  // Sync the uploaded document into the member's chart documents (the worklist
  // "Documents" column + the ChartPopover / Document Available drawer).
  const addChartDoc = useAppStore(s => s.addChartDoc);
  const updateChartDocMeta = useAppStore(s => s.updateChartDocMeta);
  const setChartDocStatus = useAppStore(s => s.setChartDocStatus);
  const hccUserRole = useAppStore(s => s.hccUserRole);
  const isEdit = !!editDoc;
  // Only reviewer roles can set an initial Pass/Fail on upload; Support
  // uploads still land in "New" like today.
  const canSetStatus = !isEdit && ['Coder', 'QA', 'Compliance'].includes(hccUserRole);

  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [captionTouched, setCaptionTouched] = useState(false);
  const [docType, setDocType] = useState('');
  const [initialStatus, setInitialStatus] = useState(null);
  const [uploadKey, setUploadKey] = useState(0); // remount UploadDropField to reset it

  // Prefill when opening in edit mode: caption + docType come from the row,
  // file stays empty (uploading a new file is optional during edit).
  useEffect(() => {
    if (isEdit) {
      setCaption(editDoc?.caption || editDoc?.n || '');
      setCaptionTouched(true);
      setDocType(editDoc?.t || '');
    } else {
      setCaption('');
      setCaptionTouched(false);
      setDocType('');
    }
    setFile(null);
    setInitialStatus(null);
    setUploadKey(k => k + 1);
  }, [editDoc, isEdit]);

  // Pre-populate the Caption field with the file name (extension stripped)
  // when a file is picked and the user hasn't already typed their own caption.
  // A subsequent file swap re-syncs unless the caption was manually edited.
  useEffect(() => {
    if (!file || captionTouched) return;
    const stripped = file.name.replace(/\.[a-z0-9]+$/i, '');
    setCaption(stripped);
  }, [file, captionTouched]);

  if (!member) return null;

  // In edit mode a file isn't required — the user is only changing metadata.
  const ok = isEdit
    ? !!(caption.trim() && docType)
    : !!(file && caption.trim() && docType);

  const handleUpload = () => {
    if (isEdit) {
      updateChartDocMeta(member.id, editDoc.id, {
        n: caption,
        caption,
        t: docType,
      });
      showToast(`Updated ${caption}`);
      handleClose();
      return;
    }
    const doc = makeUploadedChartDoc(member, { file, caption, docType });
    addChartDoc(member.id, doc, file);
    if (initialStatus) {
      setChartDocStatus(member.id, doc.id, initialStatus);
    }
    addActivityEntry({
      t: 'upload', by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
      icds: activityIcd ? [activityIcd] : undefined,
      headline: activityIcd
        ? `Document Uploaded for ${activityIcd}`
        : 'Document Uploaded',
      file: doc.n,
      fileType: docType,
      docId: doc.id,
    });
    showToast(`Uploaded ${doc.n} to ${member.name}'s documents.`);
    setFile(null);
    setCaption('');
    setCaptionTouched(false);
    setDocType('');
    setInitialStatus(null);
    setUploadKey(k => k + 1);
    close();
  };

  const handleClose = () => {
    setFile(null);
    setCaption('');
    setCaptionTouched(false);
    setDocType('');
    setInitialStatus(null);
    setUploadKey(k => k + 1);
    close();
  };

  return (
    <Drawer
      title={<span className={styles.title}>{isEdit ? 'Edit Document' : 'Upload Document'}</span>}
      onClose={handleClose}
      className={styles.drawer}
      bodyClassName={styles.body}
      headerRight={
        <Button variant="primary" size="M" disabled={!ok} onClick={handleUpload}>
          {isEdit ? 'Save' : 'Upload'}
        </Button>
      }
    >
      {/* Shared patient banner — matches Diagnosis Gaps Details. */}
      <PatientBanner
        initials={member.in || member.name?.split(' ').map(p => p[0]).slice(0, 2).join('')}
        name={member.name}
        gender={member.g === 'M' ? 'Male' : member.g === 'F' ? 'Female' : member.g}
        age={member.age || ''}
        dob={member.dob}
        memberId={member.memberId || `#${member.id}`}
        raf={member.raf}
        rafChange={member.ri}
        rafUp={member.ru !== false}
      />

      {/* Form */}
      <div className={styles.form}>
        {/* Drop zone → uploading → uploaded states (shared with the Document
            Available details drawer). */}
        <DemoPhiStrip />
        <UploadDropField key={uploadKey} onChange={setFile} />

        {/* Caption */}
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Caption
            <span className={styles.required} aria-hidden="true" />
          </span>
          <input
            type="text"
            value={caption}
            placeholder="Add caption"
            onChange={(e) => { setCaption(e.target.value); setCaptionTouched(true); }}
            className={styles.input}
          />
        </div>

        {/* Document Type */}
        <div className={styles.field}>
          <span className={styles.fieldLabel}>
            Document Type
            <span className={styles.required} aria-hidden="true" />
          </span>
          <Select
            className={styles.select}
            options={DOC_TYPES.map((t) => ({ value: t, label: t }))}
            value={docType}
            onChange={setDocType}
            placeholder="Select Type"
          />
        </div>

        {/* Review Status — reviewer roles can Pass/Fail on upload so a
            single-step flow lands the doc in a decided state. */}
        {canSetStatus && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Review Status <span className={styles.optional}>(optional)</span>
            </span>
            <div className={styles.statusRow}>
              <button
                type="button"
                className={[styles.statusPill, initialStatus === 'Passed' ? styles.statusPass : ''].filter(Boolean).join(' ')}
                onClick={() => setInitialStatus(v => v === 'Passed' ? null : 'Passed')}
              >
                Pass
              </button>
              <button
                type="button"
                className={[styles.statusPill, initialStatus === 'Failed' ? styles.statusFail : ''].filter(Boolean).join(' ')}
                onClick={() => setInitialStatus(v => v === 'Failed' ? null : 'Failed')}
              >
                Fail
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
