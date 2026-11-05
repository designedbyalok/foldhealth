import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { Drawer } from '../../../components/Drawer/Drawer';
import { preventDefaultDrag, downloadUserImportTemplate } from './InviteUserDrawer.utils';
import styles from './AccountPanel.module.css';

export function InviteUserBulkUploadStep({ onClose, bulkFile, fileInputRef, onFileSelect, onClearFile, onNext }) {
  const handleDrop = (e) => { e.preventDefault(); onFileSelect(e.dataTransfer.files[0]); };

  return (
    <Drawer
      title={<div><div style={{ fontSize: 'var(--font-lg)', fontWeight: 600 }}>Bulk Import Users</div><div style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-300)', fontWeight: 400 }}>Import the users in bulk by uploading a spreadsheet.</div></div>}
      onClose={onClose}
      bodyClassName={styles.inviteDrawerBody}
      headerRight={<Button disabled={!bulkFile} onClick={onNext}>Next</Button>}
    >
      <div className={styles.inviteFormScroll}>
        <div className={styles.bulkStepper}>
          <span className={styles.bulkStepActive}><span className={styles.bulkStepNum}>1</span> Upload File</span>
          <span className={styles.bulkStepLine} />
          <span className={styles.bulkStepInactive}><span className={styles.bulkStepNum}>2</span> Profile Review</span>
        </div>

        <div className={styles.bulkIcon}>
          <Icon name="solar:users-group-rounded-linear" size={48} color="var(--neutral-200)" />
        </div>

        <div className={styles.bulkInfo}>
          <div className={styles.bulkInfoTitle}><Icon name="solar:info-circle-linear" size={16} color="var(--primary-300)" /> How to import team members</div>
          <ol className={styles.bulkInfoList}>
            <li>Download the CSV template below</li>
            <li>Fill in the team member details in the spreadsheet</li>
            <li>Save the file and upload it here</li>
            <li>Review the preview and confirm the import</li>
          </ol>
        </div>

        {!bulkFile ? (
          <div className={styles.bulkDropZone} onDrop={handleDrop} onDragOver={preventDefaultDrag} onClick={() => fileInputRef.current?.click()}>
            <Icon name="solar:upload-linear" size={24} color="var(--neutral-200)" />
            <p>Drag and drop file here or <span className={styles.bulkChooseFile}>Choose file</span></p>
            <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx" style={{ display: 'none' }} onChange={e => onFileSelect(e.target.files[0])} />
          </div>
        ) : (
          <div className={styles.bulkFileCard}>
            <Icon name="solar:document-text-linear" size={24} color="var(--neutral-300)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-400)' }}>{bulkFile.name}</div>
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-300)' }}>{(bulkFile.size / (1024 * 1024)).toFixed(1)} MB</div>
            </div>
            <button className={styles.bulkChooseFile} onClick={onClearFile}>Change file</button>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>
          <span>Supported formats: CSV, XLS, XLSX</span>
          <span>Max size: 5 MB</span>
        </div>

        {!bulkFile && (
          <div className={styles.bulkTemplate}>
            <Icon name="solar:file-text-linear" size={24} color="var(--neutral-300)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--neutral-400)' }}>User Details Import Template</div>
              <div style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-300)' }}>You can download the attached example and use it as a template to add users</div>
            </div>
            <button className={styles.bulkChooseFile} onClick={downloadUserImportTemplate}>Download sample</button>
          </div>
        )}

        <div className={styles.bulkNotice}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-200)" />
          <span>{bulkFile ? 'Once users are generated through the bulk import method, their login credentials will be sent out promptly.' : 'After users are successfully created through the bulk import process, they will receive their login credentials via email.'}</span>
        </div>
      </div>
    </Drawer>
  );
}
