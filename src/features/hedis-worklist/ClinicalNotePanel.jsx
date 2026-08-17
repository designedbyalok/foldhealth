import { Drawer } from '../../components/Drawer/Drawer';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { Icon } from '../../components/Icon/Icon';
import { DatePicker } from '../../components/DatePicker/DatePicker';
import { GENDER_LABEL, isMandatoryComplete } from './ClinicalNotePanel.utils';
import { useClinicalNotePanel } from './useClinicalNotePanel';
import { HeaderActions, GapAccordion } from './ClinicalNotePanelParts';
import styles from './ClinicalNotePanel.module.css';

export function ClinicalNotePanel({ member, gapCode, year, onClose, editingTaskId = null }) {
  const v = useClinicalNotePanel({ member, gapCode, onClose, editingTaskId });

  return (
    <Drawer
      title={v.drawerTitle}
      onClose={onClose}
      noCloseDivider
      bodyClassName={styles.body}
      headerRight={
        <HeaderActions
          onSubmitForReview={v.handleSubmitForReview}
          onSaveDraft={v.handleSaveDraft}
          onSaveAndSign={v.handleSaveAndSign}
          onSignAndPrint={v.handleSignAndPrint}
          primaryLabel={editingTaskId ? 'Update note' : 'Submit for Review'}
        />
      }
    >
      <PatientBanner
        initials={member.in}
        name={member.name}
        gender={GENDER_LABEL[member.gender] ?? member.gender}
        age={v.ageShort}
        dob={member.dob}
        memberId={member.memberId}
        onCall={() => v.showToast('Call — coming soon')}
      />

      <div className={styles.bodyInner}>
        <div className={styles.commonCard}>
          <button className={styles.commonHeader} onClick={() => v.setCommonExpanded(x => !x)}>
            <Icon name={v.commonExpanded ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} size={14} color="var(--status-info)" />
            <span className={styles.commonBadge}>COMMON</span>
            <span className={styles.commonHeaderText}>Date of Service &amp; Telehealth Statement</span>
            <span className={styles.commonHelper}>Applies to all gaps</span>
          </button>
          {v.commonExpanded && (
            <div className={styles.commonBody}>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>Date of Service <span className={styles.required}>•</span></div>
                <DatePicker value={v.dateOfService} onSelect={v.setDateOfService} hasError={v.submitted && !v.dateOfService} />
                {v.submitted && !v.dateOfService && <div className={styles.fieldError}>Date of Service is required</div>}
              </div>
              <div className={styles.subSectionLabel}>Telehealth Statement</div>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={v.audioOnly} onChange={e => v.setAudioOnly(e.target.checked)} />
                <span className={styles.checkLabel}>Audio-only visit – Verbal consent was obtained from the patient to conduct the visit via audio-only. The patient was informed of the nature of the visit, the limitations of audio-only communication, and agreed to proceed.</span>
              </label>
              <label className={styles.checkRow} style={{ marginBottom: 0 }}>
                <input type="checkbox" checked={v.audioVideo} onChange={e => v.setAudioVideo(e.target.checked)} />
                <span className={styles.checkLabel}>Audio-video visit – Verbal consent was obtained from the patient to conduct the visit via audio and video. The patient was informed of the nature of the visit, the limitations of audio-video communication, and agreed to proceed.</span>
              </label>
            </div>
          )}
        </div>

        {v.myGaps.length > 0 && (
          <div className={styles.gapGroup}>
            <div className={styles.gapGroupHeader}>
              <Icon name="solar:user-id-linear" size={14} color="var(--neutral-300)" />
              Your gaps · {v.myGaps.length}
            </div>
            {v.myGaps.map(g => (
              <GapAccordion key={g.code} gap={g} data={v.gapState[g.code]} ready={v.isReadyForReview(g.code)}
                mandatoryComplete={isMandatoryComplete(g.code, v.gapState[g.code])}
                submitted={v.submitted} year={year} assignee={v.assigneeFor(g)} isOwnedByOther={false}
                onUpdate={(patch) => v.updateGap(g.code, patch)}
                onAddDocument={() => v.showToast(`Add document for ${g.code} — coming soon`)} />
            ))}
          </div>
        )}

        {v.otherGaps.length > 0 && (
          <div className={styles.gapGroup}>
            <div className={styles.gapGroupHeader}>
              <Icon name="solar:users-group-rounded-linear" size={14} color="var(--neutral-300)" />
              Other staff's gaps · {v.otherGaps.length}
              <span className={styles.gapGroupHelper}>(visible &amp; editable — not locked)</span>
            </div>
            {v.otherGaps.map(g => (
              <GapAccordion key={g.code} gap={g} data={v.gapState[g.code]} ready={v.isReadyForReview(g.code)}
                mandatoryComplete={isMandatoryComplete(g.code, v.gapState[g.code])}
                submitted={v.submitted} year={year} assignee={v.assigneeFor(g)} isOwnedByOther
                onUpdate={(patch) => v.updateGap(g.code, patch)}
                onAddDocument={() => v.showToast(`Add document for ${g.code} — coming soon`)} />
            ))}
          </div>
        )}

        <div className={styles.uploadSection}>
          <p className={styles.uploadLabel}>Shared Attachments <span className={styles.uploadLabelHelper}>· applied to all gaps</span></p>
          <div className={styles.uploadZone} onClick={() => v.showToast('File upload — coming soon')}>
            <Icon name="solar:upload-linear" size={24} color="var(--neutral-200)" />
            <p className={styles.uploadZoneTitle} style={{ marginTop: 8 }}>Drop files to attach, or browse</p>
            <p className={styles.uploadZoneMeta}>Allowed types: image/*, application/pdf &nbsp; Max size: 100MB &nbsp; Max count: 5</p>
          </div>
        </div>

        <div className={styles.medsSection}>
          <div className={styles.medsSectionHeader}>
            <span className={styles.medsSectionTitle}>Medications <span className={styles.uploadLabelHelper}>· applied to all gaps</span></span>
            <button className={styles.importBtn} onClick={() => v.showToast('Import from Patient Record — coming soon')}>
              <Icon name="solar:download-minimalistic-linear" size={14} color="var(--neutral-300)" /> Import from Patient Record
            </button>
          </div>
          <div className={styles.medsEmpty}>
            <Icon name="solar:pill-linear" size={32} color="var(--neutral-150)" />
            <p className={styles.medsEmptyTitle}>No Medications</p>
          </div>
          <div className={styles.medSearchWrap}>
            <input aria-label="Search and add new medication" className={styles.medSearchInput} placeholder="Search and add new medication (min 3 characters)"
              onChange={() => v.showToast('Medication search — coming soon')} />
            <span className={styles.medSearchIcon}><Icon name="solar:magnifer-linear" size={15} color="var(--neutral-200)" /></span>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
