import { useState } from 'react';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../components/Button/Button';
import { BadgeSelect } from '../../../../../components/BadgeSelect/BadgeSelect';
import { PanelSection, PanelSectionDivider } from '../../../../../components/PanelSection/PanelSection';
import { UnityFooter } from '../UnityFooter/UnityFooter';
import styles from './PatientSynopsisWidget.module.css';

/* ── Numbered reference badge ── */
function R({ n }) {
  return <span className={styles.refBadge}>{n}</span>;
}

/* ── Full synopsis content ── */
function SynopsisContent() {
  return (
    <>
      <p className={styles.synopsisText}>
        The patient has a chronic history of kidney stones, with the documented{' '}
        <span className={styles.gradientText}>Extracorporeal Shock Wave Lithotripsy (ESWL)</span>
        <R n={1} /><R n={2} />. It was performed on 01/28/22 for symptomatic nephrolithiasis
        seen on imaging and labs <R n={3} />. Subsequent encounters and reports describe recurrent
        and enlarging renal calculi, intermittent, and microscopic hematuria though vitals signs
        remain stable. Patient is Covid Immunized. there exists an allergy to egg. Medical
        statements reflect repeated stone‑related care and there is known family history of stones.
        Patient has history of Alcohol Abuse. Patient is on{' '}
        <span className={styles.gradientText}>Tamsulosin (Flomax)</span> for treatment. Referred
        to Dr. John for treatment. <R n={4} />
      </p>

      <p className={styles.synopsisText}>
        In addition to the known urologic history, the patient has more recently been diagnosed
        with <span className={styles.gradientText}>hypertension</span> <R n={5} /> which is being
        managed medically. Elevated blood pressure has been intermittently noted during outpatient
        visits, prompting initiation of antihypertensive therapy. The patient is currently
        prescribed <span className={styles.gradientText}>Lisinopril</span> <R n={5} /> with
        documented improvement in blood pressure control on follow‑up assessments. This condition
        adds to the patient's overall cardiovascular risk profile and requires ongoing monitoring
        alongside renal health.
      </p>

      <p className={styles.synopsisText}>
        The patient has also undergone further urologic intervention following progression of stone
        disease. A ureteroscopy with laser lithotripsy and temporary ureteral stent placement was
        performed on 06/14/23 <R n={6} /> due to obstructing renal calculi and worsening flank
        pain. Post‑operative notes indicate the procedure was tolerated well without complications
        and the stent was subsequently removed as scheduled. This surgical history reflects
        escalation of care beyond ESWL due to disease persistence.
      </p>

      <p className={styles.synopsisText}>
        Additional medical history includes a diagnosis of{' '}
        <span className={styles.gradientText}>hyperlipidemia</span> <R n={4} /> for which the
        patient has been started on <span className={styles.gradientText}>Atorvastatin</span>{' '}
        <R n={4} />. This condition may contribute to systemic inflammation and overall health risk
        and is being addressed through both pharmacologic therapy and lifestyle counseling. Together
        with the patient's chronic nephrolithiasis, hypertension <R n={5} />, and prior substance
        use history, these new conditions underscore the need for coordinated, long‑term medical
        management across multiple specialties.
      </p>
    </>
  );
}

// The template the synopsis was generated from, and its version.
const TEMPLATES = ['Health Overview', 'Diabetes Standard Template'];
const VERSIONS = ['v4'];

export function PatientSynopsisWidget() {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [version, setVersion] = useState(VERSIONS[0]);

  return (
    <PanelSection
      title="Patient Synopsis"
      actions={(
        <>
          <BadgeSelect value={template} options={TEMPLATES} onChange={setTemplate} />
          <BadgeSelect value={version} options={VERSIONS} onChange={setVersion} />
          <PanelSectionDivider />
          <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" />
        </>
      )}
    >
      <div className={styles.container}>
        <div className={[styles.text, expanded ? styles.expanded : ''].join(' ')}>
          <SynopsisContent />
        </div>
        <Button
          variant="ghost"
          size="sm"
          trailingIcon={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
          className={styles.seeMore}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? 'See Less' : 'See More'}
        </Button>
      </div>
      <UnityFooter
        visibility="internal"
        generatedOn="11/09/2025, 2:30 PM"
        generatedBy="Dr. Michael Chen"
        actions={(
          <>
            <ActionButton
              icon="solar:like-linear"
              size="sm"
              tooltip="Helpful"
              iconColor={feedback === 'up' ? 'var(--primary-300)' : undefined}
              onClick={() => setFeedback(v => (v === 'up' ? null : 'up'))}
            />
            <ActionButton
              icon="solar:dislike-linear"
              size="sm"
              tooltip="Not helpful"
              iconColor={feedback === 'down' ? 'var(--primary-300)' : undefined}
              onClick={() => setFeedback(v => (v === 'down' ? null : 'down'))}
            />
            <ActionButton icon="solar:refresh-linear" size="sm" tooltip="Regenerate" />
          </>
        )}
      />
    </PanelSection>
  );
}
