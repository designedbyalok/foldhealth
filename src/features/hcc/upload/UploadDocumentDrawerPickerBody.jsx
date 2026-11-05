import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Dropzone } from '../../../components/Dropzone/Dropzone';
import { Tabs } from '../../../components/Tabs/Tabs';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { DemoPhiStrip } from '../../../components/DemoPhiStrip/DemoPhiStrip';
import { StagedFileRow, ExtractedRecords } from './UploadDocumentDrawer.helpers';
import styles from './UploadDocumentDrawer.module.css';

export function UploadDocumentDrawerPickerBody(p) {
  const {
    showToast,
    ACCEPT_EXT,
    ACCEPT_MIME,
    tabItems,
    activeTab,
    setActiveTab,
    filterOpen,
    setFilterOpen,
    filterActive,
    cronDismissed,
    setCronDismissed,
    cronMsg,
    recordFilters,
    setRecordFilters,
    uploaderOptions,
    dateOptions,
    clearAllFilters,
    staged,
    handlePick,
    removeStaged,
    records,
    activeBucket,
    setActiveBucket,
    applyRecordFilters,
    reviewRecord,
    removeRecord,
  } = p;

  return (
    <div className={styles.pickerPhase2}>
      <div className={styles.tabRow}>
        <Tabs items={tabItems} value={activeTab} onValueChange={setActiveTab} />
        {activeTab !== 'upload' && (
          <button
            type="button"
            className={[styles.filterBtn, filterOpen || filterActive ? styles.filterBtnActive : ''].filter(Boolean).join(' ')}
            aria-label="Filter records"
            aria-pressed={filterOpen}
            onClick={() => setFilterOpen(v => !v)}
          >
            <Icon
              name="solar:filter-linear"
              size={16}
              color={filterOpen || filterActive ? 'var(--primary-300)' : 'var(--neutral-400)'}
            />
            {filterActive && !filterOpen && <span className={styles.filterBtnDot} aria-hidden="true" />}
          </button>
        )}
      </div>

      {!cronDismissed && (
        <div className={styles.cronStrip} role="status">
          <Icon name="solar:refresh-linear" size={14} color="var(--status-success)" />
          <span className={styles.cronStripText}>{cronMsg}</span>
          <button type="button" className={styles.cronStripAction} onClick={() => setActiveTab('review')}>
            Review
          </button>
          <span className={styles.cronStripDivider} />
          <CloseButton size={14} onClick={() => setCronDismissed(true)} className={styles.cronStripDismiss} label="Dismiss" />
        </div>
      )}

      {filterOpen && activeTab !== 'upload' && (
        <div className={styles.filterChipRow}>
          <FilterChip
            label="Uploaded By"
            options={uploaderOptions}
            selected={recordFilters.by}
            onChange={(vals) => setRecordFilters(f => ({ ...f, by: vals }))}
          />
          <FilterChip
            label="Uploaded Date"
            options={dateOptions}
            selected={recordFilters.date}
            onChange={(vals) => setRecordFilters(f => ({ ...f, date: vals }))}
          />
          {filterActive && (
            <Button variant="ghost" size="sm" leadingIcon="solar:close-circle-linear" className={styles.filterChipClear} onClick={clearAllFilters}>
              Clear All
            </Button>
          )}
        </div>
      )}

      <div className={styles.tabContent}>
        {activeTab === 'upload' ? (
          <>
            <div className={styles.uploadCard}>
              <DemoPhiStrip variant="card-top" />
              <Dropzone
                accept={ACCEPT_EXT}
                acceptMime={ACCEPT_MIME}
                multiple
                icon="solar:upload-minimalistic-linear"
                helperText="Supported formats: PDF, DOC, JPG, or PNG"
                secondaryText="Max size: 100 MB"
                onPick={handlePick}
                onReject={() => showToast?.('Please upload a PDF, DOC, JPG, PNG, or TIFF file')}
                className={styles.dropzoneEmbedded}
              />
            </div>

            {staged.length > 0 && (
              <div className={styles.stagedList}>
                {staged.map(s => (
                  <StagedFileRow
                    key={s.id}
                    file={s}
                    onRemove={() => removeStaged(s.id)}
                    onPreview={() => showToast?.(`Preview ${s.name}, coming soon`)}
                  />
                ))}
              </div>
            )}

            <div className={styles.demoStrip}>
              <Icon name="solar:test-tube-linear" size={12} color="var(--neutral-300)" />
              <span className={styles.demoStripLabel}>Try demo files:</span>
              <button
                type="button"
                className={styles.demoChip}
                onClick={() => {
                  const file = new File([new Blob(['%PDF-1.4 demo'])], 'demo-same-patient-multi-dos.pdf', { type: 'application/pdf' });
                  handlePick(file);
                }}
              >
                1 Doc · Multi DOS
              </button>
              {[5, 10, 20].map(n => (
                <button
                  key={n}
                  type="button"
                  className={styles.demoChip}
                  onClick={() => {
                    const files = Array.from({ length: n }, (_, i) =>
                      new File([new Blob(['%PDF-1.4 demo'])], `demo-patient-${i}.pdf`, { type: 'application/pdf' }));
                    handlePick(files, { bypassLimit: true });
                  }}
                >
                  {n} Documents
                </button>
              ))}
            </div>
          </>
        ) : activeTab === 'review' ? (
          <ExtractedRecords
            records={applyRecordFilters(records.filter(r => r.bucket === 'review' || r.bucket === 'unreadable'))}
            activeBucket={activeBucket}
            setActiveBucket={setActiveBucket}
            onReview={reviewRecord}
            onDelete={removeRecord}
            tabScope="review"
          />
        ) : activeTab === 'added' ? (
          <ExtractedRecords
            records={applyRecordFilters(records.filter(r => r.bucket === 'added'))}
            activeBucket="added"
            setActiveBucket={setActiveBucket}
            onReview={reviewRecord}
            onDelete={removeRecord}
            tabScope="added"
          />
        ) : (
          <div className={styles.tabEmpty}>
            <div className={styles.tabEmptyIcon}>
              <Icon name="solar:file-remove-linear" size={28} color="var(--neutral-300)" />
            </div>
            <div className={styles.tabEmptyTitle}>No Deleted Records</div>
            <div className={styles.tabEmptyBody}>Records deleted during review will appear here.</div>
          </div>
        )}
      </div>
    </div>
  );
}
