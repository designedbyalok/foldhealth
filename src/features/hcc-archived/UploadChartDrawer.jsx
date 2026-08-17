import { useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Drawer } from '../../components/Drawer/Drawer';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { Select } from '../../components/Select/Select';
import styles from './UploadChartDrawer.module.css';

const DOC_TYPES = [
  'Visit Note',
  'Lab Report',
  'Radiology Report',
  'Discharge Summary',
  'Referral Letter',
  'Consultation Report',
  'Other',
];

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
  const close = useAppStore(s => s.closeHccUploadDrawer);
  const showToast = useAppStore(s => s.showToast);
  // Log the upload to the Diagnosis Gaps Activity Log when the drawer was
  // launched from inside the DiagPanel. addActivityEntry resolves member +
  // current DOS from store state automatically; ICD-scope is picked up from
  // diagActivityIcd so the entry shows in both the ICD and DOS-level logs.
  const addActivityEntry = useAppStore(s => s.addActivityEntry);
  const activityIcd = useAppStore(s => s.diagActivityIcd);

  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [docType, setDocType] = useState('');
  const [drag, setDrag] = useState(false);

  if (!member) return null;

  const ok = !!(file && caption.trim() && docType);

  const handleUpload = () => {
    addActivityEntry({
      t: 'upload', by: 'You', role: 'Coder',
      icds: activityIcd ? [activityIcd] : undefined,
      headline: activityIcd
        ? `Document Uploaded for ${activityIcd}`
        : 'Document Uploaded',
      file: file.name,
      fileType: docType,
    });
    showToast(`Uploaded ${file.name} (${docType}) — wiring Supabase storage in a follow-up.`);
    setFile(null);
    setCaption('');
    setDocType('');
    close();
  };

  const handleClose = () => {
    setFile(null);
    setCaption('');
    setDocType('');
    close();
  };

  return (
    <Drawer
      title={<span className={styles.title}>Upload Document</span>}
      onClose={handleClose}
      className={styles.drawer}
      bodyClassName={styles.body}
      headerRight={
        <Button variant="primary" size="M" disabled={!ok} onClick={handleUpload}>
          Upload
        </Button>
      }
    >
      {/* Patient strip */}
      <div className={styles.patient}>
        <div className={styles.avatar}>{member.in || member.name?.split(' ').map(p => p[0]).slice(0, 2).join('')}</div>
        <div className={styles.patientText}>
          <div className={styles.patientName}>{member.name}</div>
          <div className={styles.patientMeta}>
            Patient · {member.g === 'M' ? 'Male' : member.g === 'F' ? 'Female' : member.g} ·{' '}
            {member.age || '—'}
            {member.memberId ? ` · ${member.memberId}` : ''}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className={styles.form}>
        {/* Drop zone */}
        <label
          className={[styles.dropZone, drag ? styles.dropZoneActive : ''].join(' ')}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
          }}
        >
          <Icon name="solar:upload-minimalistic-linear" size={26} color="var(--neutral-200)" />
          {file ? (
            <span className={styles.dropZoneFile}>{file.name}</span>
          ) : (
            <span className={styles.dropZoneCopy}>
              <span className={styles.dropZoneMuted}>Drag and drop file here or</span>
              <span className={styles.dropZoneLink}>Choose file</span>
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className={styles.fileInput}
            onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
          />
        </label>

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
            onChange={(e) => setCaption(e.target.value)}
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
      </div>
    </Drawer>
  );
}
