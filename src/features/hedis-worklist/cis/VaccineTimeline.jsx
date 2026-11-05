import { Fragment } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { HoverCard } from '../../../components/HoverCard/HoverCard';
import { CIS_ANTIGENS, CIS_DOSE_STATUS, scheduleEndMonth } from './cisRules';
import { DOSE_BADGE, fmtDate } from './cisStatusConfig';
import { appointmentForDose, apptDate } from './cisAppointments';
import { DoseQuickCard } from './DoseQuickCard';
import styles from './VaccineTimeline.module.css';

// One column per age a routine range starts or ends at, birth to 23 months.
const MONTHS = [...new Set(CIS_ANTIGENS.flatMap(a => a.schedule.flatMap(s => [s.from, scheduleEndMonth(s)])))]
  .sort((a, b) => a - b);
const monthLabel = (m) => (m === 0 ? 'Birth' : `${m} mo`);
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());

const TONE = {
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  error: styles.toneError,
  grey: styles.toneGrey,
  white: styles.toneWhite,
};
const LEGEND = [
  CIS_DOSE_STATUS.completed,
  CIS_DOSE_STATUS.dueNow,
  CIS_DOSE_STATUS.overdue,
  CIS_DOSE_STATUS.upcoming,
  CIS_DOSE_STATUS.onTrack,
];

// Doses that overlap in age (e.g. the two flu doses) go on separate lanes.
function lanesFor(rows) {
  const lanes = [];
  rows.forEach(r => {
    const lane = lanes.find(l => l[l.length - 1].ageEndMonths < r.ageMonths);
    if (lane) lane.push(r);
    else lanes.push([r]);
  });
  return lanes;
}

const windowText = (r) => (r.recommendedEnd ? `${fmtDate(r.start)} – ${fmtDate(r.recommendedEnd)}` : fmtDate(r.start));

/**
 * Vaccine Calendar timeline: the child's first two years as a grid, one
 * row per vaccine and one column per routine age (with the date the child
 * reaches it). Each dose sits across its recommended age range, coloured
 * by status, with the date given or the dates it is due.
 *
 * @param {object}   props
 * @param {object}   props.result         – evaluateCis() output
 * @param {string[]} props.antigenOrder   – vaccine keys, top to bottom
 * @param {string[]} [props.statusFilter] – statuses to keep at full strength
 * @param {object}   [props.notes]        – cis_dose_notes, keyed 'dtap:1'
 * @param {function} [props.onDateChange] – (antigen, row, iso) => void
 * @param {function} [props.onNoteSave]   – (antigen, row, text) => void
 *
 * Hovering a dose previews its card; a click pins it so the date and note
 * can be edited from the calendar.
 */
export function VaccineTimeline({ result, antigenOrder, statusFilter = [], appointments = [], notes, onDateChange, onNoteSave }) {
  const dob = result.dob;
  const today = new Date();
  const colDates = MONTHS.map(m => addMonths(dob, m));
  const todayCol = colDates.findLastIndex(d => d <= today);
  // Each vaccine with its dose lanes and first grid row (row 1 is the header).
  const blocks = antigenOrder
    .map(k => result.antigens.find(a => a.key === k))
    .filter(Boolean)
    .map(a => ({ a, lanes: lanesFor(a.rows.filter(r => !r.extra)) }))
    .reduce((acc, b) => {
      const prev = acc[acc.length - 1];
      return [...acc, { ...b, top: prev ? prev.top + prev.lanes.length : 2 }];
    }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.scroll}>
        <div className={styles.grid} style={{ '--cols': MONTHS.length }} role="table" aria-label="Vaccine timeline, birth to 2 years">
          <div className={`${styles.head} ${styles.vaccineHead}`} role="columnheader">Vaccine</div>
          {MONTHS.map((m, i) => (
            <div key={m} className={`${styles.head} ${i === todayCol ? styles.todayHead : ''}`} role="columnheader">
              <span className={styles.age}>{monthLabel(m)}</span>
              <span className={styles.ageDate}>{fmtDate(colDates[i])}</span>
              {i === todayCol && <span className={styles.todayTag}>Today</span>}
            </div>
          ))}

          {blocks.map(({ a, lanes, top }) => (
              <Fragment key={a.key}>
                <div className={styles.vaccine} style={{ gridRow: `${top} / span ${lanes.length}` }} role="rowheader">
                  <span className={styles.vaccineName}>{a.label}</span>
                  <span className={styles.vaccineMeta}>{Math.min(a.valid.length, a.required)} of {a.requiredLabel} doses</span>
                </div>
                {lanes.map((lane, li) => (
                  <Fragment key={li}>
                    {MONTHS.map((m, ci) => (
                      <div
                        key={m}
                        aria-hidden="true"
                        className={`${styles.cell} ${ci === todayCol ? styles.todayCell : ''} ${li === lanes.length - 1 ? styles.groupEnd : ''}`}
                        style={{ gridRow: top + li, gridColumn: ci + 2 }}
                      />
                    ))}
                    {lane.map(r => {
                      const from = MONTHS.indexOf(r.ageMonths);
                      const to = MONTHS.indexOf(r.ageEndMonths);
                      const badge = DOSE_BADGE[r.status] || {};
                      const dimmed = statusFilter.length > 0 && !statusFilter.includes(r.status);
                      // A vaccine reminder booked for this dose: a bell in the corner.
                      const booked = appointmentForDose(appointments, a.key, r);
                      return (
                        <div key={r.number} className={styles.doseSlot} style={{ gridRow: top + li, gridColumn: `${from + 2} / ${to + 3}` }}>
                        <HoverCard
                          width={340}
                          flush
                          pinOnClick
                          openDelay={300}
                          className={styles.doseTip}
                          ariaLabel={`${a.label} dose ${r.number}`}
                          trigger={(
                          <div
                            className={`${styles.dose} ${TONE[badge.tone] || ''} ${dimmed ? styles.dimmed : ''}`}
                            role="cell"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                            aria-label={`${a.label} dose ${r.number}, ${r.status}, ${r.record ? `given ${fmtDate(r.record.date)}` : `due ${windowText(r)}`}${booked ? `, reminder for ${fmtDate(apptDate(booked.appt))}` : ''}`}
                          >
                            {booked && (
                              <span className={`${styles.bell} ${booked.passed ? styles.bellLate : ''}`} aria-hidden="true">
                                <Icon name="solar:bell-bold" size={12} color="currentColor" />
                              </span>
                            )}
                            <span className={styles.doseTitle}>
                              {badge.icon && <Icon name={badge.icon} size={12} />}
                              Dose {r.number}
                            </span>
                            <span className={styles.doseDate}>{r.record ? fmtDate(r.record.date) : windowText(r)}</span>
                          </div>
                          )}
                        >
                          <DoseQuickCard
                            antigen={a}
                            row={r}
                            dob={dob}
                            note={notes?.[`${a.key}:${r.number}`]?.note || ''}
                            booked={booked}
                            onDateChange={onDateChange}
                            onNoteSave={onNoteSave}
                          />
                        </HoverCard>
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </Fragment>
          ))}
        </div>
      </div>
      <div className={styles.legend} aria-hidden="true">
        {LEGEND.map(s => (
          <span key={s} className={styles.legendItem}>
            <span className={`${styles.swatch} ${TONE[DOSE_BADGE[s].tone]}`} />
            {s === CIS_DOSE_STATUS.completed ? 'Given' : s}
          </span>
        ))}
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchToday}`} />
          Today
        </span>
        <span className={styles.legendItem}>
          <Icon name="solar:bell-bold" size={12} color="var(--neutral-300)" />
          Reminder set
        </span>
      </div>
    </div>
  );
}
