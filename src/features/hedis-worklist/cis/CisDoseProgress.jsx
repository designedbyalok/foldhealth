import { Icon } from '../../../components/Icon/Icon';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { CIS_DOSE_STATUS } from './cisRules';
import { CisStatusBadge } from './CisStatus';
import { EVALUATION_BADGE, fmtDate, isLocked } from './cisStatusConfig';
import styles from './CisImmunizationsTab.module.css';

/**
 * CIS-CMB10 dose progress card: "Doses Complete x/y", series start and
 * end (2nd birthday), the evaluation badge, and one block per required
 * dose. Shared by the Vaccine Calendar tab and dialog.
 *
 * @param {object}   props
 * @param {object}   props.result     – evaluateCis() output
 * @param {Date}     [props.startedOn] – earliest recorded dose
 * @param {function} props.onSelect   – (antigen, row) when a block is picked
 */
export function CisDoseProgress({ result, startedOn, onSelect }) {
  const d = result.doses;
  return (
    <div className={styles.doseProgress}>
      {/* Header per the HRCM "Tier History" card: title left,
          label:value facts right, split by hairline dividers. */}
      <div className={styles.doseProgressHead}>
        <span className={styles.doseProgressTitle}>Doses Complete {d.completed}/{d.total}</span>
        <span className={styles.doseFact}>Started: <b>{startedOn ? fmtDate(startedOn) : '-'}</b></span>
        <span className={styles.factDivider} aria-hidden="true" />
        <span className={styles.doseFact}>
          Ends: <b>{fmtDate(result.secondBirthday)}</b>
          {result.daysLeft >= 0 ? ` · ${result.daysLeft} days left` : ' · passed'}
        </span>
        <span className={styles.factDivider} aria-hidden="true" />
        <CisStatusBadge map={EVALUATION_BADGE} status={result.evaluation} />
      </div>
      <DoseBlocks result={result} onSelect={onSelect} />
    </div>
  );
}

// The whole Combination 10 series as one block per required dose, laid out
// as a timeline (given date, else the date the dose's window opens). Doses
// not open yet carry a lock. Hover a block for its dose.
const BLOCK_CLASS = {
  [CIS_DOSE_STATUS.completed]: 'blockDone',
  [CIS_DOSE_STATUS.completedLate]: 'blockDone',
  [CIS_DOSE_STATUS.notCounted]: 'blockLate',
  [CIS_DOSE_STATUS.cannotMeet]: 'blockLate',
  [CIS_DOSE_STATUS.overdue]: 'blockLate',
  [CIS_DOSE_STATUS.dueNow]: 'blockDue',
  [CIS_DOSE_STATUS.pending]: 'blockDue',
};
const BLOCK_LEGEND = [
  { label: 'Given', cls: 'blockDone' },
  { label: 'Due now', cls: 'blockDue' },
  { label: 'Overdue / does not count', cls: 'blockLate' },
  { label: 'Upcoming', cls: '' },
];

// Hover card for one block: dose, status, and when it was given or opens.
function BlockDetail({ a, r }) {
  let when;
  if (r.record) when = `Given ${fmtDate(r.record.date)}`;
  // Behind schedule but still inside the minimum gap after the previous
  // dose: say both, so red does not read as "give it today".
  else if (r.status === CIS_DOSE_STATUS.overdue && isLocked(r)) when = `Was due ${fmtDate(r.due)} • can be given from ${fmtDate(r.earliest)}`;
  else if (r.status === CIS_DOSE_STATUS.overdue) when = `Was due ${fmtDate(r.due)}`;
  else if (isLocked(r)) when = `Opens on ${fmtDate(r.earliest)} • due by ${fmtDate(r.due)}`;
  else when = `Open now • due by ${fmtDate(r.due)}`;
  return (
    <div className={styles.blockCard}>
      <span className={styles.blockCardTitle}>
        <span className={`${styles.swatch} ${styles[BLOCK_CLASS[r.status]] || ''}`} />
        {a.label} · Dose {r.number}
      </span>
      <span className={styles.blockCardStatus}>{r.status}{r.reason ? ` • ${r.reason}` : ''}</span>
      <span className={styles.blockCardWhen}>{when}</span>
    </div>
  );
}

// Timeline position: when it was given, else when its window opens.
const blockDate = (r) => r.record?.date ?? r.nextDue ?? r.start;

const blockKey = (a, r) => `${a.key}-${r.number}`;

function DoseBlocks({ result, onSelect }) {
  const blocks = result.antigens
    .flatMap(a => a.rows.filter(r => !r.extra).slice(0, a.required).map(r => ({ a, r })))
    .sort((x, y) => blockDate(x.r) - blockDate(y.r));
  return (
    <div className={styles.blocksWrap}>
      <div className={styles.blocks} role="group" aria-label={`${result.doses.completed} of ${result.doses.total} doses complete`}>
        {blocks.map(({ a, r }, i) => (
          <Tooltip
            key={blockKey(a, r)}
            variant="light"
            placement="top"
            // Anchor the card inward at the ends so it never clips the drawer.
            align={i < blocks.length / 3 ? 'left' : i >= (blocks.length * 2) / 3 ? 'right' : 'center'}
            maxWidth={280}
            label={<BlockDetail a={a} r={r} />}
            className={styles.blockTip}
          >
            <span
              role="button"
              tabIndex={0}
              aria-label={`${a.label} dose ${r.number}: ${[r.status, isLocked(r) && `opens ${fmtDate(r.earliest)}`].filter(Boolean).join(', ')}. Go to dose`}
              onClick={() => onSelect(a, r)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(a, r); } }}
              className={`${styles.block} ${styles[BLOCK_CLASS[r.status]] || ''}`}
            >
              {isLocked(r) && <Icon name="solar:lock-keyhole-minimalistic-linear" size={10} color="var(--placeholder-text)" />}
            </span>
          </Tooltip>
        ))}
      </div>
      <div className={styles.legend} aria-hidden="true">
        {BLOCK_LEGEND.map(l => (
          <span key={l.label} className={styles.legendItem}>
            <span className={`${styles.swatch} ${l.cls ? styles[l.cls] : ''}`} />
            {l.label}
          </span>
        ))}
        <span className={styles.legendItem}>
          <Icon name="solar:lock-keyhole-minimalistic-linear" size={10} color="var(--placeholder-text)" />
          Not open yet
        </span>
      </div>
    </div>
  );
}
