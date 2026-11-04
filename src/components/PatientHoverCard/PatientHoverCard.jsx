import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { Icon } from '../Icon/Icon';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './PatientHoverCard.module.css';

const CARD_W = 350;
const GAP = 8;

// Good / Average / Poor band for a 0–100 value.
const band = (v) => (v >= 80 ? { label: 'Good', tone: 'success' } : v >= 60 ? { label: 'Average', tone: 'warning' } : { label: 'Poor', tone: 'danger' });
const engagedText = (d) => (d == null ? '-' : d === 0 ? 'Engaged today' : `Last engaged ${d} day${d === 1 ? '' : 's'} ago`);

/**
 * PatientHoverCard (Figma Q3 Sprint 3, 853:3077): patient banner that, once
 * `stage` is 'expanded', slides out a snapshot (EHR id, Fold Score / RAF /
 * Goal Progress, and the Fold Score Breakdown). Portaled beside the trigger;
 * pair with usePatientHoverCard for the hover timing.
 *
 * @param {object}  props
 * @param {DOMRect} props.anchorRect
 * @param {'banner'|'expanded'} props.stage
 * @param {object}  props.patient   – { name, initials, gender, age, dob }
 * @param {object}  [props.snapshot] – see src/lib/patientSnapshot.js; null while loading
 * @param {object}  [props.cardProps] – mouse handlers from the hook
 */
export function PatientHoverCard({ anchorRect, stage, patient, snapshot, cardProps }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  // The Fold Score / RAF Score tiles act as tabs over the breakdown below.
  const [view, setView] = useState('fold');

  // Right of the trigger; flip left / nudge up when it would leave the viewport.
  useLayoutEffect(() => {
    if (!anchorRect) return;
    const h = ref.current?.offsetHeight || 80;
    let left = anchorRect.right + GAP;
    if (left + CARD_W > window.innerWidth - GAP) left = Math.max(GAP, anchorRect.left - CARD_W - GAP);
    let top = anchorRect.top - 8;
    if (top + h > window.innerHeight - GAP) top = Math.max(GAP, window.innerHeight - h - GAP);
    setPos({ left, top });
  }, [anchorRect, stage, snapshot, view]);

  if (!anchorRect) return null;
  const expanded = stage === 'expanded';
  const s = snapshot;

  return createPortal(
    <div
      ref={ref}
      className={styles.card}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      role="dialog"
      aria-label={`${patient.name} snapshot`}
      {...cardProps}
      // The card is portaled out of the member cell, but React still bubbles
      // its clicks there, which would open the patient quick view.
      onClick={e => e.stopPropagation()}
    >
      <div className={styles.banner}>
        <Avatar variant="patient" size={48} initials={patient.initials} />
        <div className={styles.bannerText}>
          <span className={styles.name}>{patient.name}</span>
          <span className={styles.demo}>
            Patient
            {patient.gender && <> • <span className={styles.gender}>{patient.gender}</span></>}
            {patient.age && <> • {patient.age}</>}
            {patient.dob && <> ({patient.dob})</>}
          </span>
        </div>
      </div>

      <div className={[styles.details, expanded ? styles.detailsOpen : ''].join(' ')} aria-hidden={!expanded}>
        <div className={styles.detailsInner}>
        {!s ? (
          <div className={styles.loading}>
            {[70, 90, 60, 80, 50].map((w, i) => <Skeleton key={i} style={{ width: `${w}%`, height: 12 }} />)}
          </div>
        ) : (
          <>
            <div className={styles.ehr}>
              <Icon name="solar:hospital-linear" size={16} color="var(--neutral-300)" />
              {s.ehrName} ID: #{s.ehrId}
            </div>
            <div className={styles.metrics} role="tablist" aria-label="Score breakdown">
              <button type="button" role="tab" aria-selected={view === 'fold'} className={[styles.metric, styles.metricTab, view === 'fold' ? styles.metricActive : ''].join(' ')} onClick={() => setView('fold')}>
                <span className={styles.metricLabel}>Fold Score</span>
                <span className={styles.metricValue}>{s.foldScore}</span>
              </button>
              <button type="button" role="tab" aria-selected={view === 'raf'} className={[styles.metric, styles.metricTab, view === 'raf' ? styles.metricActive : ''].join(' ')} onClick={() => setView('raf')}>
                <span className={styles.metricLabel}>RAF Score</span>
                <span className={styles.metricRow}>
                  <span className={[styles.metricValue, s.rafScore >= 1.5 ? styles.metricHigh : ''].join(' ')}>{s.rafScore?.toFixed(2)}</span>
                  <RafDelta delta={s.rafDelta} />
                </span>
              </button>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Goal Progress</span>
                <span className={styles.progressRow}>
                  <span className={styles.progressTrack}>
                    <span className={[styles.progressFill, styles[`fill_${band(s.goalProgress).tone}`]].join(' ')} style={{ width: `${s.goalProgress}%` }} />
                  </span>
                  <span className={styles.metricValue}>{s.goalProgress}%</span>
                </span>
              </div>
            </div>
            {view === 'raf' ? <RafBreakdown snapshot={s} /> : (
            <>
            <div className={styles.sectionHead}>Fold Score Breakdown</div>
            <Row label="Recent HIE Events:">
              {s.hieEvents.length
                ? s.hieEvents.map(e => <span key={`${e.label}-${e.date}`} title={`${e.label} (${e.date})`}>{e.label} <span className={styles.muted}>({e.date})</span></span>)
                : <span className={styles.faint}>None</span>}
            </Row>
            <Row label="AWV Visit:">
              {s.awvStatus === 'Not Scheduled'
                ? <span className={styles.faint}>Not Scheduled</span>
                : <span>{s.awvStatus}{s.awvDate && <span className={styles.muted}> ({s.awvDate})</span>}</span>}
            </Row>
            <Row label="Chronic Conditions:">
              {s.chronicConditions.length
                ? s.chronicConditions.map(c => <span key={c.name} title={`${c.name} (${c.duration})`}>{c.name} <span className={styles.muted}>({c.duration})</span></span>)
                : <span className={styles.faint}>None</span>}
            </Row>
            <Row label="Care Program Eligibility">
              {s.programEligibility.length ? <span>{s.programEligibility.join(', ')}</span> : <span className={styles.faint}>None</span>}
            </Row>
            <Row label="Engagement:"><span>{engagedText(s.lastEngagedDays)}</span></Row>
            <Row label="Medication:"><span>{s.activeMedications} Active</span></Row>
            <Row label="Task Adherence:">
              <span className={styles.inline}>
                {s.taskAdherence}%
                <Badge tone={band(s.taskAdherence).tone} size="sm" label={band(s.taskAdherence).label} />
              </span>
            </Row>
            <Row label="Alerts (Last 7 Days):">
              <span className={styles.inline}>
                {s.alertsHigh + s.alertsMedium === 0 && <span className={styles.faint}>None</span>}
                {s.alertsHigh > 0 && <Badge tone="danger" size="sm" icon="solar:flag-linear" label={String(s.alertsHigh)} />}
                {s.alertsMedium > 0 && <Badge tone="warning" size="sm" icon="solar:flag-linear" label={String(s.alertsMedium)} />}
              </span>
            </Row>
            </>
            )}
          </>
        )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RafDelta({ delta }) {
  if (delta == null || delta === 0) return null;
  return (
    <span className={styles.delta}>
      {delta > 0 ? '+' : ''}{delta.toFixed(2)}
      <Icon name={delta > 0 ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'} size={10} color="currentColor" />
    </span>
  );
}

// RAF Score tab (Figma Q3 Sprint 3, 833:2678): what adds up to the score.
// Each HCC opens to the ICD-10 code and where it was documented.
function RafBreakdown({ snapshot: s }) {
  const [openHcc, setOpenHcc] = useState(null);
  const { hccs = [], demographics = [], interactions = [] } = s.rafBreakdown || {};
  const pct = Math.round((s.rafScore - 1) * 100);
  return (
    <>
      <div className={styles.sectionHead}>RAF Score Breakdown</div>
      {hccs.length > 0 && (
        <div className={styles.rafGroup}>
          <span className={styles.rafGroupTitle}>Conditions &amp; HCCs</span>
          {hccs.map(h => {
            const open = openHcc === h.label;
            return (
              <div key={h.label}>
                <button type="button" className={styles.rafLine} aria-expanded={open} onClick={() => setOpenHcc(open ? null : h.label)}>
                  <span className={styles.rafHcc}>
                    {h.label}
                    <Icon name={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={12} color="var(--neutral-300)" />
                  </span>
                  <span className={styles.rafWeight}>{h.weight}</span>
                </button>
                {open && (
                  <div className={styles.hccDetail}>
                    <span><span className={styles.hccKey}>ICD-10:</span> {h.icd} - {h.icdText}</span>
                    <span><span className={styles.hccKey}>Last Recorded on:</span> {h.recordedOn}</span>
                    <span><span className={styles.hccKey}>Recorded by:</span> {h.recordedBy}</span>
                    <span><span className={styles.hccKey}>Notes:</span> {h.note}</span>
                    <span><span className={styles.hccKey}>Source:</span> {h.source}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <RafGroup title="Demographics" items={demographics} />
      <RafGroup title="Interaction Effect" items={interactions} />
      <div className={[styles.rafGroup, styles.rafTotal].join(' ')}>
        <span className={styles.rafLine}>
          <span>Total RAF Score</span>
          <span>{s.rafScore?.toFixed(2)}</span>
        </span>
      </div>
      <div className={[styles.rafNote, pct > 0 ? styles.rafNoteHigh : ''].join(' ')}>
        {pct === 0
          ? 'Patient is expected to incur costs in line with the average (1.0).'
          : `Patient is expected to incur costs ${Math.abs(pct)}% ${pct > 0 ? 'higher' : 'lower'} than average (1.0).`}
      </div>
    </>
  );
}

function RafGroup({ title, items }) {
  if (!items.length) return null;
  return (
    <div className={styles.rafGroup}>
      <span className={styles.rafGroupTitle}>{title}</span>
      {items.map(i => (
        <span key={i.label} className={styles.rafLine}>
          <span className={styles.rafHcc}>{i.label}</span>
          <span className={styles.rafWeight}>{i.weight}</span>
        </span>
      ))}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{children}</span>
    </div>
  );
}
