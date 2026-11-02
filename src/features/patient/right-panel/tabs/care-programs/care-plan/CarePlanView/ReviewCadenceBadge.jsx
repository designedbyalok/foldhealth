import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { resolvePatientStoreId } from '../../../../../../../lib/resolvePatientStoreId';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Popover } from '@/components/Popover/Popover';
import { Input } from '@/components/Input/Input';
import { NumberUnitInput } from '@/components/NumberUnitInput/NumberUnitInput';
import {
  CADENCE_UNITS, formatInterval, nextReviewDue, resolveCadence, reviewStatus, withCadenceDefaults,
} from '../lib/cadence';
import { fmtCarePlanDate } from '../tables/carePlanTableModel';
import styles from './ReviewCadenceBadge.module.css';

const EMPTY = [];
const fmt = d => (d ? fmtCarePlanDate(d) : '');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * The cadence in force for one patient's plan on one program, the next
 * review date and whether it's due or overdue (care-plan/lib/cadence.js).
 */
function useReviewCadence({ patientId, program, plan }) {
  const storeId = useAppStore(s => String(resolvePatientStoreId(s, patientId)));
  const types = useAppStore(s => s.careProgramTypes);
  const enrollment = useAppStore(s => (s.careProgramsByPatient[storeId] || s.careProgramsByPatient[patientId] || EMPTY)
    .find(p => p.id === program?.id)) || program;
  const discharges = useAppStore(s => s.patientDischarges[patientId]) || EMPTY;
  const history = useAppStore(s => s.carePlanReviews[`${patientId}::${program?.id}`]?.history) || EMPTY;
  const fetchTypes = useAppStore(s => s.fetchCareProgramTypes);
  const fetchDischarges = useAppStore(s => s.fetchPatientDischarges);
  const fetchReviews = useAppStore(s => s.fetchCarePlanReviews);

  useEffect(() => { if (!types.length) fetchTypes?.(); }, [types.length, fetchTypes]);
  useEffect(() => {
    if (!patientId || !program?.id) return;
    fetchDischarges(patientId);
    fetchReviews(patientId, program.id);
  }, [patientId, program?.id, fetchDischarges, fetchReviews]);

  return useMemo(() => {
    if (!enrollment?.code) return null;
    const type = types.find(t => t.code === enrollment.code);
    const config = withCadenceDefaults(enrollment.code, type?.cadence);
    const override = enrollment.cadenceOverride || null;
    const today = new Date();
    const cadence = resolveCadence({ config, acuity: enrollment.acuity, override, discharges, today });
    const base = resolveCadence({ config, acuity: enrollment.acuity, discharges: [], today });
    const lastReview = history[0]?.finishedAt || null;
    const lastTouch = lastReview || plan?.signedAt || null;
    const due = nextReviewDue({ cadence, lastTouch });
    return {
      config, cadence, base, override, due, lastReview,
      status: reviewStatus({ due, overdueAfterDays: config.overdueAfterDays, today }),
      enrollment,
    };
  }, [enrollment, types, discharges, history, plan?.signedAt]);
}

function OverrideForm({ initial, current, baseLabel, onCancel, onSave, onReset }) {
  const [every, setEvery] = useState((initial || current).every);
  const [unit, setUnit] = useState((initial || current).unit);
  const [reason, setReason] = useState(initial?.reason ?? '');
  const valid = Number(every) >= 1;
  return (
    <>
      <NumberUnitInput
        label="Review every"
        value={every}
        onChange={setEvery}
        unit={unit}
        units={CADENCE_UNITS}
        onUnitChange={setUnit}
        errorText={valid ? undefined : 'At least 1'}
      />
      <Input label="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Recent fall, family request" />
      <span className={styles.hint}>Program default for this patient: {baseLabel}.</span>
      <div className={styles.actions}>
        {initial && <Button variant="ghost" size="sm" onClick={onReset}>Use Program Default</Button>}
        <span className={styles.spacer} />
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!valid} onClick={() => onSave({ every: Number(every), unit, reason: reason.trim() || null })}>Save</Button>
      </div>
    </>
  );
}

function Detail({ label, children }) {
  return (
    <div className={styles.detail}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{children}</span>
    </div>
  );
}

/**
 * A small badge in the care plan's summary strip: the review cadence and the
 * next review date, amber once due and red once overdue. Clicking it opens
 * why the cadence applies and the program's rules, and lets a care manager
 * override it for this patient.
 */
export function ReviewCadenceBadge({ patientId, program, plan, canEdit }) {
  const info = useReviewCadence({ patientId, program, plan });
  const setCadenceOverride = useAppStore(s => s.setCadenceOverride);
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  if (!info) return null;
  const { cadence, base, override, due, status, lastReview, config } = info;

  const why = cadence.source === 'post_discharge'
    ? `Post-discharge until ${fmt(cadence.until)}`
    : cadence.source === 'override'
      ? (override?.reason ? `Override: ${override.reason}` : 'Patient override')
      : cadence.sourceLabel;
  const rules = [
    `Program default: ${formatInterval(config)}`,
    ...Object.entries(config.byAcuity || {}).map(([lvl, r]) => `${lvl} acuity: ${formatInterval(r)}`),
    config.postDischarge?.enabled ? `After a discharge: ${formatInterval(config.postDischarge)} for ${config.postDischarge.days} days` : null,
    `Overdue ${plural(Number(config.overdueAfterDays) || 0, 'day')} after the due date`,
  ].filter(Boolean);

  const tone = status.state === 'overdue' ? 'error' : status.state === 'due' ? 'warning' : 'grey';
  const stateLabel = status.state === 'overdue'
    ? `Overdue ${plural(status.daysOverdue, 'day')}`
    : status.state === 'due' ? (status.daysOverdue ? `Due ${plural(status.daysOverdue, 'day')} ago` : 'Due today') : null;
  const label = due
    ? `${cadence.label} \u00b7 ${stateLabel || `Review ${fmt(due)}`}`
    : cadence.label;

  const close = () => { setOpen(false); setEditing(false); };
  const save = async (next) => {
    close();
    await setCadenceOverride(patientId, info.enrollment, next, {
      fromLabel: cadence.label,
      toLabel: next ? formatInterval(next) : base.label,
    });
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={styles.trigger}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={`Review cadence: ${label}`}
      >
        <Badge size="S" tone={tone} icon="solar:calendar-linear" label={label} />
      </button>
      {open && (
        <Popover anchor={btnRef} onOpenChange={o => !o && close()} placement="bottom-start" width={320}>
          <div className={styles.popover}>
            <span className={styles.title}>{editing ? 'Review cadence for this patient' : 'Review cadence'}</span>
            {editing ? (
              <OverrideForm
                initial={override}
                current={cadence}
                baseLabel={base.label}
                onCancel={() => setEditing(false)}
                onSave={save}
                onReset={() => save(null)}
              />
            ) : (
              <>
                <div className={styles.details}>
                  <Detail label="Cadence"><strong>{cadence.label}</strong> ({why})</Detail>
                  <Detail label="Next review">
                    {due ? <strong>{fmt(due)}</strong> : 'Scheduled once the plan is signed'}
                    {stateLabel && <Badge size="S" tone={tone} label={stateLabel} />}
                  </Detail>
                  <Detail label="Last reviewed">{lastReview ? fmt(new Date(lastReview)) : 'Not reviewed with the patient yet'}</Detail>
                </div>
                <ul className={styles.rules}>
                  {rules.map(r => <li key={r}>{r}</li>)}
                </ul>
                {canEdit && (
                  <div className={styles.actions}>
                    <span className={styles.spacer} />
                    <Button variant="outline" size="sm" leadingIcon="solar:pen-linear" onClick={() => setEditing(true)}>
                      {override ? 'Change Override' : 'Override for This Patient'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}
