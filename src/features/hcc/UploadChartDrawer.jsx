import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Drawer } from '../../components/Drawer/Drawer';
import { Button } from '../../components/Button/Button';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { UploadDropField } from '../../components/UploadDropField/UploadDropField';
import { FilePreview } from '../../components/FilePreview/FilePreview';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { DemoPhiStrip } from '../../components/DemoPhiStrip/DemoPhiStrip';
import { Select } from '../../components/Select/Select';
import { FailReasonInline } from './ChartDetailDrawerParts';
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
  const [failInline, setFailInline] = useState(false);
  const [failDetails, setFailDetails] = useState(null); // { reasons, note } | null
  const [previewOpen, setPreviewOpen] = useState(false);
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
    setFailInline(false);
    setFailDetails(null);
    setPreviewOpen(false);
    setUploadKey(k => k + 1);
  }, [editDoc, isEdit]);

  // Collapse the preview pane when the file is cleared so the drawer
  // doesn't linger in its widened state with nothing to show.
  useEffect(() => {
    if (!file) setPreviewOpen(false);
  }, [file]);

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
  // Review Status is now mandatory (reviewer roles only): Pass, or Failed
  // with at least one reason. If "Other" is checked, a comment is required
  // too so the downstream reviewer has something to act on.
  const failReasonsValid = failDetails?.reasons?.length > 0
    && (!failDetails.reasons.includes('Other') || (failDetails.note || '').trim().length > 0);
  const statusValid = !canSetStatus
    || initialStatus === 'Passed'
    || (initialStatus === 'Failed' && failReasonsValid);
  const ok = isEdit
    ? !!(caption.trim() && docType)
    : !!(file && caption.trim() && docType && statusValid);

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
      setChartDocStatus(member.id, doc.id, initialStatus, {
        failReasons: initialStatus === 'Failed' ? (failDetails?.reasons || []) : undefined,
        failNote: initialStatus === 'Failed' ? (failDetails?.note || '') : undefined,
      });
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
    if (initialStatus === 'Failed' && failDetails) {
      const reasonText = (failDetails.reasons || []).join(', ');
      addActivityEntry({
        t: 'doc-status', by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
        headline: `Marked "${doc.n}" as Failed`,
        details: [{ note: failDetails.note ? `${reasonText} — ${failDetails.note}` : reasonText }],
        docId: doc.id,
      });
    } else if (initialStatus === 'Passed') {
      addActivityEntry({
        t: 'doc-status', by: 'You', role: useAppStore.getState().hccUserRole || 'Coder',
        headline: `Marked "${doc.n}" as Passed`,
        docId: doc.id,
      });
    }
    showToast(`Uploaded ${doc.n} to ${member.name}'s documents.`);
    setFile(null);
    setCaption('');
    setCaptionTouched(false);
    setDocType('');
    setInitialStatus(null);
    setFailInline(false);
    setFailDetails(null);
    setPreviewOpen(false);
    setUploadKey(k => k + 1);
    close();
  };

  const handleClose = () => {
    setFile(null);
    setCaption('');
    setCaptionTouched(false);
    setDocType('');
    setInitialStatus(null);
    setFailInline(false);
    setFailDetails(null);
    setPreviewOpen(false);
    setUploadKey(k => k + 1);
    close();
  };

  const handlePassClick = () => {
    // Passing clears any Fail reasons that were partially picked; picker
    // also collapses since it's Failed-only.
    setFailInline(false);
    setFailDetails(null);
    setInitialStatus('Passed');
  };
  const handleFailClick = () => {
    if (initialStatus === 'Failed') {
      // Second Fail click collapses the picker without clearing details —
      // the reviewer may want to keep their in-progress selection while
      // adjusting other fields.
      setFailInline(v => !v);
      return;
    }
    // Flip status to Failed immediately (red pill) and open the picker so
    // the reviewer can enter reasons. Save happens on the top-right Upload
    // button — no Confirm inside the picker.
    setInitialStatus('Failed');
    setFailDetails({ reasons: [], note: '' });
    setFailInline(true);
  };

  return (
    <Drawer
      title={<span className={styles.title}>{isEdit ? 'Edit Document' : 'Upload Document'}</span>}
      onClose={handleClose}
      className={`${styles.drawer} ${previewOpen ? styles.drawerWide : ''}`}
      bodyClassName={styles.body}
      headerRight={
        <Button variant="primary" size="M" disabled={!ok} onClick={handleUpload}>
          {isEdit ? 'Save' : 'Upload'}
        </Button>
      }
    >
      <div className={`${styles.layout} ${previewOpen ? styles.layoutSplit : ''}`}>
        {/* Left — inline file preview. Opens when the user clicks the eye
            icon on the uploaded-file card; drawer widens to make room. */}
        {previewOpen && file && (
          <div className={styles.leftPane}>
            <div className={styles.paneHeader}>
              <span className={styles.paneTitle}>{file.name}</span>
              <CloseButton size={16} onClick={() => setPreviewOpen(false)} label="Close preview" />
            </div>
            <div className={styles.previewWrap}>
              <FilePreview file={file} name={file.name} />
            </div>
          </div>
        )}

        <div className={styles.rightPane}>
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
            {/* Drop zone → uploading → uploaded states (shared with the
                Document Available details drawer). */}
            <DemoPhiStrip />
            <UploadDropField
              key={uploadKey}
              onChange={setFile}
              onPreview={(f) => { if (f) setPreviewOpen(true); }}
            />

            {/* Caption */}
            <div className={styles.field}>
              <span className={styles.fieldLabel}>
                Caption
                <span className={styles.required} aria-hidden="true" />
              </span>
              <input aria-label="Caption"
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

            {/* Review Status — reviewer roles must pick Pass or Fail before
                the doc can be uploaded (required field). Fail flips the pill
                red and expands the shared reason picker in-place; there is
                no Confirm/Cancel — the picker binds directly to state and
                the outer Upload button saves everything on click. */}
            {canSetStatus && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  Review Status
                  <span className={styles.required} aria-hidden="true" />
                </span>
                <div className={styles.statusRow}>
                  <button
                    type="button"
                    className={[styles.statusPill, initialStatus === 'Passed' ? styles.statusPass : ''].filter(Boolean).join(' ')}
                    onClick={handlePassClick}
                  >
                    Pass
                  </button>
                  <button
                    type="button"
                    className={[styles.statusPill, initialStatus === 'Failed' ? styles.statusFail : ''].filter(Boolean).join(' ')}
                    onClick={handleFailClick}
                  >
                    Fail
                  </button>
                </div>
                {failInline && (
                  <div className={styles.failInlineWrap}>
                    <FailReasonInline
                      value={failDetails || { reasons: [], note: '' }}
                      onChange={setFailDetails}
                      hideActions
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
