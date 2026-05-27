import { useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from '../../components/Drawer/Drawer';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Switch } from '../../components/Switch/Switch';
import { DatePicker } from '../../components/DatePicker/DatePicker';
import { useAppStore } from '../../store/useAppStore';
import { generateClinicalNotePdf } from './lib/generateClinicalNotePdf';
import styles from './ClinicalNotePanel.module.css';

// Mock "current user" — gaps owned by anyone else surface in a separate
// visual section (AC-5: cross-assignee editability).
const CURRENT_USER = 'Isabeth Partida Fra';

const GENDER_LABEL = { M: 'Male', F: 'Female', O: 'Other' };

const MEASURE_NAMES = {
  CBP:      'Controlling Blood Pressure',
  COL:      'Colorectal Cancer Screening',
  'COA-FS': 'Care for Older Adults: Functional Status',
  'COA-M':  'Care for Older Adults: Medication Review',
  BCS:      'Breast Cancer Screening',
  DM:       'Diabetes HbA1c Control',
  ABA:      'Adult BMI Assessment',
  FUH:      'Follow-Up After Hospitalization',
  AMR:      'Asthma Medication Ratio',
  KED:      'Kidney Health Evaluation',
};

const COL_METHODS = [
  'Colonoscopy',
  'Flexible sigmoidoscopy or CT colonography',
  'Stool DNA test (e.g., Cologuard®)',
  'Fecal Occult Blood Test (FOBT)',
  'Fecal Immunochemical Test (FIT)',
];

// Required fields per measure. Drives Ready-for-Review auto-activation.
const MANDATORY_FIELDS = {
  CBP: ['location', 'bpMedication'],
  COL: ['screeningMethod', 'colResultDate'],
  KED: ['egfr', 'uacr', 'egfrResultDate', 'uacrResultDate'],
};

function defaultGapData(code) {
  switch (code) {
    case 'CBP':
      return {
        selfReported: false, digitalBaseline: false, location: '',
        bpMedication: '', bpManagement: false, medEducation: false,
        referredPcp: false, noFurtherQuestions: false,
      };
    case 'COL':
      return { screeningMethod: '', colResultDate: '' };
    case 'KED':
      return { egfr: '', uacr: '', egfrResultDate: '', uacrResultDate: '' };
    default:
      return {};
  }
}

function isMandatoryComplete(code, data) {
  const req = MANDATORY_FIELDS[code];
  if (!req) return false;
  return req.every(f => !!data[f]);
}

export function ClinicalNotePanel({ member, gapCode, year, onClose, editingTaskId = null }) {
  const showToast = useAppStore(s => s.showToast);
  const bulkUpdateGapStatuses = useAppStore(s => s.bulkUpdateGapStatuses);
  const logCareGapActivity = useAppStore(s => s.logCareGapActivity);
  const createCareGapSignOffTask = useAppStore(s => s.createCareGapSignOffTask);
  const updateSignOffTaskPdf = useAppStore(s => s.updateSignOffTaskPdf);

  // Open gaps for the patient = anything not Closed/Excluded/Completed.
  // AC-1: opening + Clinical Note from one gap shows ALL open gaps.
  const activeGaps = useMemo(
    () => member.gaps.filter(g => !['Closed', 'Excluded', 'Closed-Data', 'Completed'].includes(g.status)),
    [member.gaps]
  );

  // Cross-assignee split (AC-5).
  const assigneeFor = useCallback(
    (g) => g.assignee ?? member.assignee ?? CURRENT_USER,
    [member.assignee]
  );
  const myGaps = useMemo(
    () => activeGaps.filter(g => assigneeFor(g) === CURRENT_USER),
    [activeGaps, assigneeFor]
  );
  const otherGaps = useMemo(
    () => activeGaps.filter(g => assigneeFor(g) !== CURRENT_USER),
    [activeGaps, assigneeFor]
  );
  const orderedGaps = useMemo(() => [...myGaps, ...otherGaps], [myGaps, otherGaps]);

  // COMMON section state.
  const [commonExpanded, setCommonExpanded] = useState(true);
  // Default Date of Service to today so reviewers/staff don't dead-end on
  // the silent `if (!dateOfService) return` guard the first time they click
  // Submit for Review. The native date picker is YYYY-MM-DD format.
  const [dateOfService, setDateOfService] = useState(() => new Date().toISOString().slice(0, 10));
  const [audioOnly, setAudioOnly] = useState(false);
  const [audioVideo, setAudioVideo] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Per-gap form state — seeded from `gap.draft` so other-staff drafts
  // are visible to the current user (AC-6 draft visibility).
  const [gapState, setGapState] = useState(() => {
    const init = {};
    activeGaps.forEach(g => {
      init[g.code] = {
        expanded: g.code === gapCode,
        manuallyOff: false,
        ...defaultGapData(g.code),
        ...(g.draft ?? {}),
      };
    });
    return init;
  });

  const updateGap = useCallback((code, patch) => {
    setGapState(prev => ({ ...prev, [code]: { ...prev[code], ...patch } }));
  }, []);

  // Ready-for-Review derivation: mandatory complete AND not manually off.
  const isReadyForReview = (code) => {
    const data = gapState[code] ?? {};
    return isMandatoryComplete(code, data) && !data.manuallyOff;
  };

  // Helper: read codes of currently-ready gaps. Used by Path A + B.
  const collectReadyCodes = () =>
    orderedGaps.filter(g => isReadyForReview(g.code)).map(g => g.code);

  // Build the consolidated PDF for the gaps currently being submitted/signed.
  const buildPdf = (readyCodes, signedBy) => generateClinicalNotePdf({
    member,
    gapCodes: readyCodes,
    dateOfService,
    audioOnly,
    audioVideo,
    gapData: gapState,
    signedBy,
  });

  // Save actions — every action writes to the central HEDIS store so the
  // worklist row + Care Gap Details drawer + Activity Log tab all stay
  // in sync without any reload.
  const handleSaveDraft = () => {
    setSubmitted(true);
    logCareGapActivity(member.id, {
      title: 'Draft saved',
      detail: orderedGaps.map(g => g.code).join(', '),
      actor: CURRENT_USER,
      icon: 'solar:diskette-linear',
      gapCodes: orderedGaps.map(g => g.code),
    });
    showToast('Draft saved');
  };

  const handleSubmitForReview = () => {
    setSubmitted(true);
    const readyCodes = collectReadyCodes();
    if (!dateOfService) {
      showToast('Date of Service is required');
      return;
    }
    if (readyCodes.length === 0) {
      // AC-9 empty-task prevention: no task created when nothing is ready.
      showToast('No gaps marked Ready for Review');
      return;
    }
    // AC-14 Build the consolidated PDF (one document, all gaps).
    const pdf = buildPdf(readyCodes, CURRENT_USER);

    if (editingTaskId) {
      // Reviewer is editing an existing sign-off task — patch the same task
      // instead of creating a duplicate. Gap statuses already moved to
      // Submitted on the original submission so no need to flip them again.
      updateSignOffTaskPdf(editingTaskId, pdf, CURRENT_USER);
      showToast('Sign-off note updated');
      onClose();
      return;
    }

    // AC-2 Submit for Review → all Ready gaps transition to Submitted.
    bulkUpdateGapStatuses(
      member.id,
      Object.fromEntries(readyCodes.map(c => [c, 'Submitted'])),
    );
    logCareGapActivity(member.id, {
      title: 'Submitted for review',
      detail: `Ready gaps: ${readyCodes.join(', ')}`,
      actor: CURRENT_USER,
      icon: 'solar:upload-square-linear',
      gapCodes: readyCodes,
      attachment: pdf,
    });
    // AC-6 / AC-7 Nightly cron creates the consolidated task (modeled as
    // immediate task creation for the prototype). The PDF rides on the task.
    createCareGapSignOffTask({
      hedisMemberId: member.id,
      gapCodes: readyCodes,
      state: member.state,
      pdf,
    });
    showToast(`Submitted for review — ${readyCodes.length} gap${readyCodes.length === 1 ? '' : 's'} → Submitted`);
    onClose();
  };

  const handleSaveAndSign = () => {
    setSubmitted(true);
    const readyCodes = collectReadyCodes();
    if (!dateOfService) {
      showToast('Date of Service is required');
      return;
    }
    if (readyCodes.length === 0) {
      showToast('No gaps marked Ready for Review');
      return;
    }
    // AC-3 / AC-10 Direct sign path (provider only) → bypass Submitted +
    // task creation, gaps go straight to Completed.
    const pdf = buildPdf(readyCodes, 'Provider');
    bulkUpdateGapStatuses(
      member.id,
      Object.fromEntries(readyCodes.map(c => [c, 'Completed'])),
    );
    logCareGapActivity(member.id, {
      title: 'Signed by provider',
      detail: `Direct sign path · ${readyCodes.join(', ')}`,
      actor: 'Provider',
      icon: 'solar:pen-new-square-linear',
      gapCodes: readyCodes,
      attachment: pdf,
    });
    showToast('Saved and signed — provider sign path');
    onClose();
  };

  const handleSignAndPrint = () => {
    setSubmitted(true);
    const readyCodes = collectReadyCodes();
    if (!dateOfService) {
      showToast('Date of Service is required');
      return;
    }
    if (readyCodes.length === 0) {
      showToast('No gaps marked Ready for Review');
      return;
    }
    const pdf = buildPdf(readyCodes, 'Provider');
    bulkUpdateGapStatuses(
      member.id,
      Object.fromEntries(readyCodes.map(c => [c, 'Completed'])),
    );
    logCareGapActivity(member.id, {
      title: 'Signed and printed',
      detail: `Direct sign path · ${readyCodes.join(', ')}`,
      actor: 'Provider',
      icon: 'solar:printer-linear',
      gapCodes: readyCodes,
      attachment: pdf,
    });
    // Open the print dialog for the freshly-generated PDF.
    if (pdf?.dataUrl) {
      const w = window.open(pdf.dataUrl, '_blank');
      try { w?.focus(); } catch (_) { /* popup blocker, harmless */ }
    }
    showToast('Signed and printing…');
    onClose();
  };

  // Header: two-line title + Submit-for-Review primary + overflow kebab + close.
  const drawerTitle = (
    <div className={styles.titleStack}>
      <span className={styles.titleMain}>
        {editingTaskId ? 'Edit Clinical Note' : 'Consolidated Clinical Note'}
      </span>
      <span className={styles.titleSub}>
        {editingTaskId
          ? `Reviewer edit — ${orderedGaps.length} measure${orderedGaps.length === 1 ? '' : 's'}`
          : `In Progress — ${orderedGaps.length} measure${orderedGaps.length === 1 ? '' : 's'}`}
      </span>
    </div>
  );

  const ageShort = member.age ? member.age.split('y')[0] + 'Y' : '';

  return (
    <Drawer
      title={drawerTitle}
      onClose={onClose}
      bodyClassName={styles.body}
      headerRight={
        <HeaderActions
          onSubmitForReview={handleSubmitForReview}
          onSaveDraft={handleSaveDraft}
          onSaveAndSign={handleSaveAndSign}
          onSignAndPrint={handleSignAndPrint}
          primaryLabel={editingTaskId ? 'Update note' : 'Submit for Review'}
        />
      }
    >
      {/* Patient banner — edge-to-edge between the header and the
          scrollable content. Same component as Care Gap Details + HCC. */}
      <PatientBanner
        initials={member.in}
        name={member.name}
        gender={GENDER_LABEL[member.gender] ?? member.gender}
        age={ageShort + (member.dob ? ` (${member.dob})` : '')}
        memberId={member.memberId}
        onCall={() => showToast('Call — coming soon')}
      />

      <div className={styles.bodyInner}>
        {/* COMMON section (AC-2) */}
        <div className={styles.commonCard}>
          <button className={styles.commonHeader} onClick={() => setCommonExpanded(v => !v)}>
            <Icon
              name={commonExpanded ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
              size={14}
              color="var(--status-info)"
            />
            <span className={styles.commonBadge}>COMMON</span>
            <span className={styles.commonHeaderText}>Date of Service &amp; Telehealth Statement</span>
            <span className={styles.commonHelper}>Applies to all gaps</span>
          </button>
          {commonExpanded && (
            <div className={styles.commonBody}>
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>
                  Date of Service <span className={styles.required}>•</span>
                </div>
                <DatePicker
                  value={dateOfService}
                  onSelect={setDateOfService}
                  hasError={submitted && !dateOfService}
                />
                {submitted && !dateOfService && (
                  <div className={styles.fieldError}>Date of Service is required</div>
                )}
              </div>

              <div className={styles.subSectionLabel}>Telehealth Statement</div>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={audioOnly} onChange={e => setAudioOnly(e.target.checked)} />
                <span className={styles.checkLabel}>
                  Audio-only visit – Verbal consent was obtained from the patient to conduct the visit via audio-only.
                  The patient was informed of the nature of the visit, the limitations of audio-only communication, and agreed to proceed.
                </span>
              </label>
              <label className={styles.checkRow} style={{ marginBottom: 0 }}>
                <input type="checkbox" checked={audioVideo} onChange={e => setAudioVideo(e.target.checked)} />
                <span className={styles.checkLabel}>
                  Audio-video visit – Verbal consent was obtained from the patient to conduct the visit via audio and video.
                  The patient was informed of the nature of the visit, the limitations of audio-video communication, and agreed to proceed.
                </span>
              </label>
            </div>
          )}
        </div>

        {myGaps.length > 0 && (
          <div className={styles.gapGroup}>
            <div className={styles.gapGroupHeader}>
              <Icon name="solar:user-id-linear" size={14} color="var(--neutral-300)" />
              Your gaps · {myGaps.length}
            </div>
            {myGaps.map(g => (
              <GapAccordion
                key={g.code}
                gap={g}
                data={gapState[g.code]}
                ready={isReadyForReview(g.code)}
                mandatoryComplete={isMandatoryComplete(g.code, gapState[g.code])}
                submitted={submitted}
                year={year}
                assignee={assigneeFor(g)}
                isOwnedByOther={false}
                onUpdate={(patch) => updateGap(g.code, patch)}
                onAddDocument={() => showToast(`Add document for ${g.code} — coming soon`)}
              />
            ))}
          </div>
        )}

        {otherGaps.length > 0 && (
          <div className={styles.gapGroup}>
            <div className={styles.gapGroupHeader}>
              <Icon name="solar:users-group-rounded-linear" size={14} color="var(--neutral-300)" />
              Other staff's gaps · {otherGaps.length}
              <span className={styles.gapGroupHelper}>(visible &amp; editable — not locked)</span>
            </div>
            {otherGaps.map(g => (
              <GapAccordion
                key={g.code}
                gap={g}
                data={gapState[g.code]}
                ready={isReadyForReview(g.code)}
                mandatoryComplete={isMandatoryComplete(g.code, gapState[g.code])}
                submitted={submitted}
                year={year}
                assignee={assigneeFor(g)}
                isOwnedByOther
                onUpdate={(patch) => updateGap(g.code, patch)}
                onAddDocument={() => showToast(`Add document for ${g.code} — coming soon`)}
              />
            ))}
          </div>
        )}

        {/* Shared attachments (AC-10) */}
        <div className={styles.uploadSection}>
          <p className={styles.uploadLabel}>
            Shared Attachments <span className={styles.uploadLabelHelper}>· applied to all gaps</span>
          </p>
          <div className={styles.uploadZone} onClick={() => showToast('File upload — coming soon')}>
            <Icon name="solar:upload-linear" size={24} color="var(--neutral-200)" />
            <p className={styles.uploadZoneTitle} style={{ marginTop: 8 }}>Drop files to attach, or browse</p>
            <p className={styles.uploadZoneMeta}>Allowed types: image/*, application/pdf &nbsp; Max size: 100MB &nbsp; Max count: 5</p>
          </div>
        </div>

        {/* Shared medications (AC-10) */}
        <div className={styles.medsSection}>
          <div className={styles.medsSectionHeader}>
            <span className={styles.medsSectionTitle}>
              Medications <span className={styles.uploadLabelHelper}>· applied to all gaps</span>
            </span>
            <button className={styles.importBtn} onClick={() => showToast('Import from Patient Record — coming soon')}>
              <Icon name="solar:download-minimalistic-linear" size={14} color="var(--neutral-300)" />
              Import from Patient Record
            </button>
          </div>
          <div className={styles.medsEmpty}>
            <Icon name="solar:pill-linear" size={32} color="var(--neutral-150)" />
            <p className={styles.medsEmptyTitle}>No Medications</p>
          </div>
          <div className={styles.medSearchWrap}>
            <input
              className={styles.medSearchInput}
              placeholder="Search and add new medication (min 3 characters)"
              onChange={() => showToast('Medication search — coming soon')}
            />
            <span className={styles.medSearchIcon}>
              <Icon name="solar:magnifer-linear" size={15} color="var(--neutral-200)" />
            </span>
          </div>
        </div>

      </div>
    </Drawer>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HeaderActions — Submit for Review primary + kebab overflow popover.
// ────────────────────────────────────────────────────────────────────────────
function HeaderActions({ onSubmitForReview, onSaveDraft, onSaveAndSign, onSignAndPrint, primaryLabel = 'Submit for Review' }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const openMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.right - 200 });
    setOpen(v => !v);
  };

  const wrap = (fn) => () => { setOpen(false); fn(); };

  return (
    <>
      <Button size="S" variant="primary" onClick={onSubmitForReview}>
        {primaryLabel}
      </Button>
      <div ref={btnRef} style={{ display: 'inline-flex' }}>
        <ActionButton
          icon="solar:menu-dots-bold"
          size="L"
          tooltip="More actions"
          onClick={openMenu}
        />
      </div>
      {open && createPortal(
        <div className={styles.overflowScrim} onClick={() => setOpen(false)}>
          <div
            className={styles.overflowMenu}
            style={{ top: pos.top, left: pos.left }}
            onClick={e => e.stopPropagation()}
          >
            <button className={styles.overflowItem} onClick={wrap(onSaveDraft)}>
              <Icon name="solar:diskette-linear" size={15} color="var(--neutral-300)" />
              Save as Draft
            </button>
            <button className={styles.overflowItem} onClick={wrap(onSaveAndSign)}>
              <Icon name="solar:pen-new-square-linear" size={15} color="var(--neutral-300)" />
              Save and Sign
            </button>
            <button className={styles.overflowItem} onClick={wrap(onSignAndPrint)}>
              <Icon name="solar:printer-linear" size={15} color="var(--neutral-300)" />
              Sign and Print
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// GapAccordion — one collapsible section per gap with Ready-for-Review toggle.
// ────────────────────────────────────────────────────────────────────────────
function GapAccordion({ gap, data, ready, mandatoryComplete, submitted, year, assignee, isOwnedByOther, onUpdate, onAddDocument }) {
  const measureName = MEASURE_NAMES[gap.code] ?? gap.code;

  const toggleExpanded = () => onUpdate({ expanded: !data.expanded });
  const handleReadyChange = (next) => {
    if (next && !mandatoryComplete) return;
    onUpdate({ manuallyOff: !next });
  };

  return (
    <div className={`${styles.gapAccordion} ${isOwnedByOther ? styles.gapAccordionOther : ''}`}>
      <div
        role="button"
        tabIndex={0}
        className={styles.gapAccordionHeader}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(); }
        }}
      >
        <Icon
          name={data.expanded ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'}
          size={14}
          color="var(--neutral-300)"
        />
        <span className={styles.gapAccordionCode}>{gap.code}</span>
        <span className={styles.gapAccordionName}>{measureName}</span>

        <span className={`${styles.gapStatusPill} ${styles[`gapStatus_${gap.status.replace('-', '_')}`] ?? ''}`}>
          {gap.status}
        </span>

        <div className={styles.gapAccordionSpacer} />

        {assignee && (
          <span className={styles.gapAccordionAssignee}>
            <Icon name="solar:user-circle-linear" size={13} color="var(--primary-300)" />
            {assignee}
            {gap.lastEditedBy && (
              <span className={styles.gapAccordionEdited}>
                · edited {gap.lastEditedAt}
              </span>
            )}
          </span>
        )}

        <span
          className={styles.readyToggle}
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            checked={ready}
            disabled={!mandatoryComplete}
            onChange={handleReadyChange}
            ariaLabel={`Ready for review — ${gap.code}`}
          />
          <span className={ready ? styles.readyToggleLabelOn : styles.readyToggleLabel}>
            Ready for Review
          </span>
        </span>
      </div>

      {data.expanded && (
        <div className={styles.gapAccordionBody}>
          {isOwnedByOther && gap.lastEditedBy && (
            <div className={styles.priorDraftBanner}>
              <Icon name="solar:info-circle-linear" size={14} color="var(--status-info)" />
              <span>
                Draft started by <strong>{gap.lastEditedBy}</strong> · {gap.lastEditedAt}.
                Your edits will save separately and merge into the consolidated note.
              </span>
            </div>
          )}

          {gap.code === 'CBP' && <CbpFields data={data} submitted={submitted} year={year} onUpdate={onUpdate} />}
          {gap.code === 'COL' && <ColFields data={data} submitted={submitted} onUpdate={onUpdate} />}
          {gap.code === 'KED' && <KedFields data={data} submitted={submitted} onUpdate={onUpdate} />}
          {!['CBP', 'COL', 'KED'].includes(gap.code) && (
            <div className={styles.gapPlaceholder}>
              Evidence form for {gap.code} — template not yet configured.
            </div>
          )}

          {/* Per-gap document attachment (AC-10: config-based per-template) */}
          <button className={styles.gapDocBtn} onClick={onAddDocument} type="button">
            <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
            Add document for {gap.code}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Per-measure field blocks ────────────────────────────────────────────────

function CbpFields({ data, submitted, year, onUpdate }) {
  return (
    <>
      <div className={styles.bpInlineDate}>
        Reading recorded · <span>05-22-{year}</span>
        <Icon name="solar:calendar-linear" size={13} color="var(--neutral-300)" />
      </div>

      <label className={styles.checkRow}>
        <input type="checkbox" checked={data.selfReported} onChange={e => onUpdate({ selfReported: e.target.checked })} />
        <span className={styles.checkLabel}>Self-reported vitals due to telehealth encounter</span>
      </label>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={data.digitalBaseline} onChange={e => onUpdate({ digitalBaseline: e.target.checked })} />
        <span className={styles.checkLabel}>BP reading obtained from a digital blood pressure baseline</span>
      </label>

      <div style={{ marginTop: 8 }}>
        <div className={styles.radioGroupLabel}>
          Location <span className={styles.required}>•</span>
        </div>
        {['Outpatient visit', 'Telehealth visit', 'Clinic', 'Home'].map(opt => (
          <label key={opt} className={styles.radioRow}>
            <input
              type="radio"
              name={`cbp-location-${year}`}
              value={opt}
              checked={data.location === opt}
              onChange={() => onUpdate({ location: opt })}
            />
            <span className={styles.radioLabel}>{opt}</span>
          </label>
        ))}
        {submitted && !data.location && (
          <div className={styles.fieldError}>Location is required</div>
        )}
      </div>

      <div className={styles.sectionDivider} />

      <div>
        <div className={styles.radioGroupLabel}>
          Is the patient currently taking high blood pressure medication? <span className={styles.required}>•</span>
        </div>
        {['Yes', 'No'].map(opt => (
          <label key={opt} className={styles.radioRow}>
            <input
              type="radio"
              name={`cbp-med-${year}`}
              value={opt}
              checked={data.bpMedication === opt}
              onChange={() => onUpdate({ bpMedication: opt })}
            />
            <span className={styles.radioLabel}>{opt}</span>
          </label>
        ))}
        {submitted && !data.bpMedication && (
          <div className={styles.fieldError}>BP medication response is required</div>
        )}
      </div>

      <div className={styles.sectionDivider} />

      <label className={styles.checkRow}>
        <input type="checkbox" checked={data.bpManagement} onChange={e => onUpdate({ bpManagement: e.target.checked })} />
        <span className={styles.checkLabel}>Blood Pressure Management</span>
      </label>
      {data.bpManagement && (
        <>
          <p className={styles.checkIndented}>Reinforced low NA diet</p>
          <p className={styles.checkIndented}>Reinforced to record BP daily, notify PCP if SBP&gt;140 or DBP&gt;90</p>
        </>
      )}

      <label className={styles.checkRow}>
        <input type="checkbox" checked={data.medEducation} onChange={e => onUpdate({ medEducation: e.target.checked })} />
        <span className={styles.checkLabel}>Medication management education</span>
      </label>
      {data.medEducation && (
        <p className={styles.checkIndented}>Reinforced to take medications as prescribed by physician</p>
      )}

      <label className={styles.checkRow}>
        <input type="checkbox" checked={data.referredPcp} onChange={e => onUpdate({ referredPcp: e.target.checked })} />
        <span className={styles.checkLabel}>Referred to PCP for f/u within 14 days if needed</span>
      </label>

      <label className={styles.checkRow} style={{ marginBottom: 0 }}>
        <input type="checkbox" checked={data.noFurtherQuestions} onChange={e => onUpdate({ noFurtherQuestions: e.target.checked })} />
        <span className={styles.checkLabel}>Patient does not have any further questions. Patient understands to follow up with PCP as needed</span>
      </label>
    </>
  );
}

function ColFields({ data, submitted, onUpdate }) {
  return (
    <>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldLabel}>
          Choose a Colorectal Screening Method <span className={styles.required}>•</span>
        </div>
        {COL_METHODS.map(opt => (
          <label key={opt} className={styles.radioRow}>
            <input
              type="radio"
              name="screeningMethod"
              value={opt}
              checked={data.screeningMethod === opt}
              onChange={() => onUpdate({ screeningMethod: opt })}
            />
            <span className={styles.radioLabel}>{opt}</span>
          </label>
        ))}
        {submitted && !data.screeningMethod && (
          <div className={styles.fieldError}>Screening method is required</div>
        )}
      </div>
      <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
        <div className={styles.fieldLabel}>
          Result Date <span className={styles.required}>•</span>
        </div>
        <DatePicker
          value={data.colResultDate}
          onSelect={(v) => onUpdate({ colResultDate: v })}
          hasError={submitted && !data.colResultDate}
        />
        {submitted && !data.colResultDate && (
          <div className={styles.fieldError}>Result Date is required</div>
        )}
      </div>
    </>
  );
}

function KedFields({ data, submitted, onUpdate }) {
  return (
    <div className={styles.kedGrid}>
      <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
        <div className={styles.fieldLabel}>
          Estimated Glomerular Filtration Rate (eGFR) <span className={styles.required}>•</span>
        </div>
        <div className={`${styles.inputWithSuffix} ${submitted && !data.egfr ? styles.inputWithSuffixError : ''}`}>
          <input type="number" value={data.egfr} onChange={e => onUpdate({ egfr: e.target.value })} />
          <span className={styles.inputSuffix}>mL/min/1.73 m2</span>
        </div>
        {submitted && !data.egfr && <div className={styles.fieldError}>eGFR is required</div>}
      </div>
      <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
        <div className={styles.fieldLabel}>
          Urine Albumin-Creatinine Ratio (uACR) <span className={styles.required}>•</span>
        </div>
        <div className={`${styles.inputWithSuffix} ${submitted && !data.uacr ? styles.inputWithSuffixError : ''}`}>
          <input type="number" value={data.uacr} onChange={e => onUpdate({ uacr: e.target.value })} />
          <span className={styles.inputSuffix}>mg/g</span>
        </div>
        {submitted && !data.uacr && <div className={styles.fieldError}>uACR is required</div>}
      </div>
      <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
        <div className={styles.fieldLabel}>
          Result Date <span className={styles.required}>•</span>
        </div>
        <DatePicker
          value={data.egfrResultDate}
          onSelect={(v) => onUpdate({ egfrResultDate: v })}
          hasError={submitted && !data.egfrResultDate}
        />
        {submitted && !data.egfrResultDate && <div className={styles.fieldError}>Result Date is required</div>}
      </div>
      <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
        <div className={styles.fieldLabel}>
          Result Date <span className={styles.required}>•</span>
        </div>
        <DatePicker
          value={data.uacrResultDate}
          onSelect={(v) => onUpdate({ uacrResultDate: v })}
          hasError={submitted && !data.uacrResultDate}
        />
        {submitted && !data.uacrResultDate && <div className={styles.fieldError}>Result Date is required</div>}
      </div>
    </div>
  );
}
