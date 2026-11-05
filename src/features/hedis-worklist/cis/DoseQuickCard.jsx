import { Icon } from '../../../components/Icon/Icon';
import { Banner } from '../../../components/Banner/Banner';
import { Input } from '../../../components/Input/Input';
import { CisStatusBadge } from './CisStatus';
import { DoseNoteInput } from './DoseNoteInput';
import { apptDate } from './cisAppointments';
import { DOSE_BADGE, fmtDate, isLocked } from './cisStatusConfig';
import { toIso } from './useCisTracker';
import styles from './DoseQuickCard.module.css';

const windowText = (r) => (r.recommendedEnd ? `${fmtDate(r.start)} – ${fmtDate(r.recommendedEnd)}` : fmtDate(r.start));

function Row({ label, children }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{children}</span>
    </div>
  );
}

/**
 * One dose of the Vaccine Calendar timeline as a quick-view card, laid out
 * like the patient hover card: a banner, then label/value rows. The date
 * administered and the note are editable here, saved like the table view.
 *
 * @param {object}   props
 * @param {object}   props.antigen   – evaluateCis() antigen
 * @param {object}   props.row       – one of its dose rows
 * @param {Date}     props.dob
 * @param {string}   [props.note]    – saved note for this dose
 * @param {object}   [props.booked]  – appointmentForDose() match
 * @param {function} [props.onDateChange] – (antigen, row, iso) => void
 * @param {function} [props.onNoteSave]   – (antigen, row, text) => void
 */
export function DoseQuickCard({ antigen, row, dob, note = '', booked, onDateChange, onNoteSave }) {
  const badge = DOSE_BADGE[row.status] || {};
  return (
    <div className={styles.card}>
      <div className={styles.banner}>
        <span className={`${styles.tile} ${styles[`tile_${badge.tone}`] || ''}`} aria-hidden="true">
          <Icon name="solar:syringe-linear" size={20} color="currentColor" />
        </span>
        <span className={styles.bannerText}>
          <span className={styles.title}>{antigen.label} • Dose {row.number}</span>
          <span className={styles.subtitle}>{antigen.name}</span>
        </span>
        <CisStatusBadge map={DOSE_BADGE} status={row.status} />
      </div>

      <Row label="Recommended:">
        <span>{row.recommended} <span className={styles.muted}>({windowText(row)})</span></span>
      </Row>
      <Row label="Earliest allowed:"><span>{fmtDate(row.earliest)}</span></Row>
      {!row.record && <Row label="Due by:"><span>{fmtDate(row.due)}</span></Row>}
      <Row label="Date administered:">
        {onDateChange
          ? (
            // A real date field (typed or picked) so it reads as editable;
            // locked until the dose's earliest allowed date.
            <span className={styles.dateInput}>
              <Input
                type="date"
                value={row.record ? toIso(row.record.date) : ''}
                min={toIso(dob)}
                max={toIso(new Date())}
                disabled={isLocked(row)}
                placeholder={isLocked(row) ? `Opens ${fmtDate(row.earliest)}` : 'MM/DD/YYYY'}
                onChange={(e) => onDateChange(antigen, row, e.target.value)}
                aria-label={`${antigen.label} dose ${row.number} date administered`}
              />
            </span>
          )
          : <span>{row.record ? fmtDate(row.record.date) : '-'}</span>}
      </Row>
      {booked && (
        <Row label="Reminder:">
          <span className={booked.passed ? styles.late : undefined}>
            {fmtDate(apptDate(booked.appt))}{booked.appt.time ? ` at ${booked.appt.time}` : ''}
            {booked.appt.provider ? ` with ${booked.appt.provider}` : ''}
          </span>
        </Row>
      )}
      <div className={styles.noteRow}>
        <span className={styles.rowLabel}>Note:</span>
        {onNoteSave
          ? <DoseNoteInput key={note} saved={note} label={`${antigen.label} dose ${row.number} note`} onSave={(text) => onNoteSave(antigen, row, text)} />
          : <span className={note ? undefined : styles.faint}>{note || 'None'}</span>}
      </div>
      {(row.reason || booked?.passed) && (
        <div className={styles.footer}>
          <Banner tone={row.reason && badge.tone === 'error' ? 'danger' : 'warning'} size="sm" icon="solar:info-circle-linear">
            {row.reason || 'The reminder visit has passed. Confirm the dose was given.'}
          </Banner>
        </div>
      )}
    </div>
  );
}
