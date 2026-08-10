import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Switch } from '../../components/Switch/Switch';
import { DatePicker } from '../../components/DatePicker/DatePicker';
import { MEASURE_NAMES, COL_METHODS } from './ClinicalNotePanel.utils';
import styles from './ClinicalNotePanel.module.css';

export function HeaderActions({ onSubmitForReview, onSaveDraft, onSaveAndSign, onSignAndPrint, primaryLabel = 'Submit for Review' }) {
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
      <Button size="S" variant="primary" onClick={onSubmitForReview}>{primaryLabel}</Button>
      <div ref={btnRef} style={{ display: 'inline-flex' }}>
        <ActionButton icon="solar:menu-dots-bold" size="L" tooltip="More actions" onClick={openMenu} />
      </div>
      <span className={styles.headerDivider} />
      {open && createPortal(
        <div className={styles.overflowScrim} onClick={() => setOpen(false)}>
          <div className={styles.overflowMenu} style={{ top: pos.top, left: pos.left }} onClick={e => e.stopPropagation()}>
            <button className={styles.overflowItem} onClick={wrap(onSaveDraft)}>
              <Icon name="solar:diskette-linear" size={15} color="var(--neutral-300)" /> Save as Draft
            </button>
            <button className={styles.overflowItem} onClick={wrap(onSaveAndSign)}>
              <Icon name="solar:pen-new-square-linear" size={15} color="var(--neutral-300)" /> Save and Sign
            </button>
            <button className={styles.overflowItem} onClick={wrap(onSignAndPrint)}>
              <Icon name="solar:printer-linear" size={15} color="var(--neutral-300)" /> Sign and Print
            </button>
          </div>
        </div>, document.body,
      )}
    </>
  );
}

function CbpFields({ data, submitted, year, onUpdate }) {
  return (
    <>
      <div className={styles.bpInlineDate}>Reading recorded · <span>05-22-{year}</span>
        <Icon name="solar:calendar-linear" size={13} color="var(--neutral-300)" /></div>
      <label className={styles.checkRow}><input type="checkbox" checked={data.selfReported} onChange={e => onUpdate({ selfReported: e.target.checked })} />
        <span className={styles.checkLabel}>Self-reported vitals due to telehealth encounter</span></label>
      <label className={styles.checkRow}><input type="checkbox" checked={data.digitalBaseline} onChange={e => onUpdate({ digitalBaseline: e.target.checked })} />
        <span className={styles.checkLabel}>BP reading obtained from a digital blood pressure baseline</span></label>
      <div style={{ marginTop: 8 }}>
        <div className={styles.radioGroupLabel}>Location <span className={styles.required}>•</span></div>
        {['Outpatient visit', 'Telehealth visit', 'Clinic', 'Home'].map(opt => (
          <label key={opt} className={styles.radioRow}>
            <input type="radio" name={`cbp-location-${year}`} value={opt} checked={data.location === opt} onChange={() => onUpdate({ location: opt })} />
            <span className={styles.radioLabel}>{opt}</span>
          </label>
        ))}
        {submitted && !data.location && <div className={styles.fieldError}>Location is required</div>}
      </div>
      <div className={styles.sectionDivider} />
      <div>
        <div className={styles.radioGroupLabel}>Is the patient currently taking high blood pressure medication? <span className={styles.required}>•</span></div>
        {['Yes', 'No'].map(opt => (
          <label key={opt} className={styles.radioRow}>
            <input type="radio" name={`cbp-med-${year}`} value={opt} checked={data.bpMedication === opt} onChange={() => onUpdate({ bpMedication: opt })} />
            <span className={styles.radioLabel}>{opt}</span>
          </label>
        ))}
        {submitted && !data.bpMedication && <div className={styles.fieldError}>BP medication response is required</div>}
      </div>
      <div className={styles.sectionDivider} />
      <label className={styles.checkRow}><input type="checkbox" checked={data.bpManagement} onChange={e => onUpdate({ bpManagement: e.target.checked })} />
        <span className={styles.checkLabel}>Blood Pressure Management</span></label>
      {data.bpManagement && (<><p className={styles.checkIndented}>Reinforced low NA diet</p>
        <p className={styles.checkIndented}>Reinforced to record BP daily, notify PCP if SBP&gt;140 or DBP&gt;90</p></>)}
      <label className={styles.checkRow}><input type="checkbox" checked={data.medEducation} onChange={e => onUpdate({ medEducation: e.target.checked })} />
        <span className={styles.checkLabel}>Medication management education</span></label>
      {data.medEducation && <p className={styles.checkIndented}>Reinforced to take medications as prescribed by physician</p>}
      <label className={styles.checkRow}><input type="checkbox" checked={data.referredPcp} onChange={e => onUpdate({ referredPcp: e.target.checked })} />
        <span className={styles.checkLabel}>Referred to PCP for f/u within 14 days if needed</span></label>
      <label className={styles.checkRow} style={{ marginBottom: 0 }}><input type="checkbox" checked={data.noFurtherQuestions} onChange={e => onUpdate({ noFurtherQuestions: e.target.checked })} />
        <span className={styles.checkLabel}>Patient does not have any further questions. Patient understands to follow up with PCP as needed</span></label>
    </>
  );
}

function ColFields({ data, submitted, onUpdate }) {
  return (
    <>
      <div className={styles.fieldGroup}>
        <div className={styles.fieldLabel}>Choose a Colorectal Screening Method <span className={styles.required}>•</span></div>
        {COL_METHODS.map(opt => (
          <label key={opt} className={styles.radioRow}>
            <input type="radio" name="screeningMethod" value={opt} checked={data.screeningMethod === opt} onChange={() => onUpdate({ screeningMethod: opt })} />
            <span className={styles.radioLabel}>{opt}</span>
          </label>
        ))}
        {submitted && !data.screeningMethod && <div className={styles.fieldError}>Screening method is required</div>}
      </div>
      <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
        <div className={styles.fieldLabel}>Result Date <span className={styles.required}>•</span></div>
        <DatePicker value={data.colResultDate} onSelect={(v) => onUpdate({ colResultDate: v })} hasError={submitted && !data.colResultDate} />
        {submitted && !data.colResultDate && <div className={styles.fieldError}>Result Date is required</div>}
      </div>
    </>
  );
}

function KedFields({ data, submitted, onUpdate }) {
  return (
    <div className={styles.kedGrid}>
      {[
        ['egfr', 'Estimated Glomerular Filtration Rate (eGFR)', 'mL/min/1.73 m2', 'egfrResultDate'],
        ['uacr', 'Urine Albumin-Creatinine Ratio (uACR)', 'mg/g', 'uacrResultDate'],
      ].map(([field, label, suffix, dateField]) => (
        <div key={field}>
          <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
            <div className={styles.fieldLabel}>{label} <span className={styles.required}>•</span></div>
            <div className={`${styles.inputWithSuffix} ${submitted && !data[field] ? styles.inputWithSuffixError : ''}`}>
              <input aria-label={label} type="number" value={data[field]} onChange={e => onUpdate({ [field]: e.target.value })} />
              <span className={styles.inputSuffix}>{suffix}</span>
            </div>
            {submitted && !data[field] && <div className={styles.fieldError}>{field === 'egfr' ? 'eGFR' : 'uACR'} is required</div>}
          </div>
          <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
            <div className={styles.fieldLabel}>Result Date <span className={styles.required}>•</span></div>
            <DatePicker value={data[dateField]} onSelect={(v) => onUpdate({ [dateField]: v })} hasError={submitted && !data[dateField]} />
            {submitted && !data[dateField] && <div className={styles.fieldError}>Result Date is required</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GapAccordion({ gap, data, ready, mandatoryComplete, submitted, year, assignee, isOwnedByOther, onUpdate, onAddDocument }) {
  const measureName = MEASURE_NAMES[gap.code] ?? gap.code;
  const toggleExpanded = () => onUpdate({ expanded: !data.expanded });
  const handleReadyChange = (next) => { if (next && !mandatoryComplete) return; onUpdate({ manuallyOff: !next }); };
  return (
    <div className={`${styles.gapAccordion} ${isOwnedByOther ? styles.gapAccordionOther : ''}`}>
      <div role="button" tabIndex={0} className={styles.gapAccordionHeader} onClick={toggleExpanded}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(); } }}>
        <Icon name={data.expanded ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} size={14} color="var(--neutral-300)" />
        <span className={styles.gapAccordionCode}>{gap.code}</span>
        <span className={styles.gapAccordionName}>{measureName}</span>
        <span className={`${styles.gapStatusPill} ${styles[`gapStatus_${gap.status.replace('-', '_')}`] ?? ''}`}>{gap.status}</span>
        <div className={styles.gapAccordionSpacer} />
        {assignee && (
          <span className={styles.gapAccordionAssignee}>
            <Icon name="solar:user-circle-linear" size={13} color="var(--primary-300)" />{assignee}
            {gap.lastEditedBy && <span className={styles.gapAccordionEdited}> · edited {gap.lastEditedAt}</span>}
          </span>
        )}
        <span className={styles.readyToggle} onClick={(e) => e.stopPropagation()}>
          <Switch checked={ready} disabled={!mandatoryComplete} onChange={handleReadyChange} ariaLabel={`Ready for review — ${gap.code}`} />
          <span className={ready ? styles.readyToggleLabelOn : styles.readyToggleLabel}>Ready for Review</span>
        </span>
      </div>
      {data.expanded && (
        <div className={styles.gapAccordionBody}>
          {isOwnedByOther && gap.lastEditedBy && (
            <div className={styles.priorDraftBanner}>
              <Icon name="solar:info-circle-linear" size={14} color="var(--status-info)" />
              <span>Draft started by <strong>{gap.lastEditedBy}</strong> · {gap.lastEditedAt}. Your edits will save separately and merge into the consolidated note.</span>
            </div>
          )}
          {gap.code === 'CBP' && <CbpFields data={data} submitted={submitted} year={year} onUpdate={onUpdate} />}
          {gap.code === 'COL' && <ColFields data={data} submitted={submitted} onUpdate={onUpdate} />}
          {gap.code === 'KED' && <KedFields data={data} submitted={submitted} onUpdate={onUpdate} />}
          {!['CBP', 'COL', 'KED'].includes(gap.code) && (
            <div className={styles.gapPlaceholder}>Evidence form for {gap.code} — template not yet configured.</div>
          )}
          <button className={styles.gapDocBtn} onClick={onAddDocument} type="button">
            <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" /> Add document for {gap.code}
          </button>
        </div>
      )}
    </div>
  );
}
