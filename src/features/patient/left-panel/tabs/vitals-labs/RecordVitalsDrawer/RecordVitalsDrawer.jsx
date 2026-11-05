import { useMemo, useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../components/Button/Button';
import { Input } from '../../../../../../components/Input/Input';
import { DatePicker } from '../../../../../../components/DatePicker/DatePicker';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../../../store/useAppStore';
import { todayIso, isFutureDate } from '../../../../../../lib/clinicalDates';
import { VITALS, formatVitalWithUnit } from '../vitalsConfig';
import styles from './RecordVitalsDrawer.module.css';

const mdy = (iso) => { const [y, m, d] = iso.split('-'); return `${m}-${d}-${y}`; };

// Arrow keys / stepper nudge by 1 (0.1 for decimals already typed).
const step = (v, dir) => {
  const n = Number(v);
  if (v === '' || Number.isNaN(n)) return dir > 0 ? '1' : '0';
  const inc = String(v).includes('.') ? 0.1 : 1;
  return String(Math.max(0, Math.round((n + dir * inc) * 10) / 10));
};

const num = (v) => (v === '' || v == null ? null : Number(v));

/**
 * BMI from height and weight (703 × lbs ÷ in²), one decimal. Uses what was
 * entered here, falling back to the last recorded reading for the other one,
 * and only once height or weight was entered now, so an old BMI isn't saved
 * again. '' when it can't be worked out.
 */
function calcBmi(values, history) {
  const [ft, inch] = values.ht || ['', ''];
  const [lbs] = values.wt || [''];
  if (num(ft) == null && num(inch) == null && num(lbs) == null) return '';
  const lastHt = history.ht?.[0];
  const inches = num(ft) != null || num(inch) != null
    ? (num(ft) || 0) * 12 + (num(inch) || 0)
    : lastHt ? Number(lastHt.value) * 12 + Number(lastHt.value2 || 0) : null;
  const weight = num(lbs) ?? (history.wt?.[0] ? Number(history.wt[0].value) : null);
  if (!inches || !weight) return '';
  return String(Math.round((703 * weight / (inches * inches)) * 10) / 10);
}

/**
 * Record New Vitals (Figma 67:131374): one card per vital with its last
 * reading on top. Only vitals with a value are saved; a two-part vital
 * (Blood Pressure, Height) needs its first number. BMI isn't typed: it
 * follows height and weight (calcBmi).
 *
 * history – { [vital_key]: readings newest first } from vitalsHistory()
 */
export function RecordVitalsDrawer({ patientId, history = {}, onClose }) {
  const recordPatientVitals = useAppStore(s => s.recordPatientVitals);
  const [on, setOn] = useState(todayIso());
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  const set = (key, i, v) => setValues(s => {
    const pair = [...(s[key] || ['', ''])];
    pair[i] = v;
    return { ...s, [key]: pair };
  });

  const bmi = calcBmi(values, history);
  const entered = useMemo(() => ({ ...values, bmi: [bmi, ''] }), [values, bmi]);

  const readings = useMemo(() => VITALS
    .filter(v => (entered[v.key]?.[0] ?? '') !== '')
    .map(v => ({
      vital_key: v.key,
      value: entered[v.key][0],
      value2: v.parts === 2 ? (entered[v.key][1] || (v.key === 'ht' ? '0' : null)) : null,
      recorded_on: on,
    })), [entered, on]);

  // A BP needs both numbers; Height can leave inches empty (counts as 0).
  const incompleteBp = readings.some(r => r.vital_key === 'bp' && !r.value2);
  const canRecord = readings.length > 0 && !!on && !isFutureDate(on) && !incompleteBp && !saving;

  const record = async () => {
    setSaving(true);
    const { error } = await recordPatientVitals(patientId, readings);
    setSaving(false);
    if (error) { toast.error('Vitals could not be recorded'); return; }
    toast.success(readings.length === 1 ? 'Vital recorded' : `${readings.length} vitals recorded`);
    setClosing(true);
  };

  return (
    <Drawer
      title="Record New Vitals"
      onClose={onClose}
      dismissed={closing}
      primaryAction={<Button disabled={!canRecord} onClick={record}>Record</Button>}
    >
      <div className={styles.body}>
        <div className={styles.onRow}>
          <span className={styles.onLabel}>On</span>
          <div className={styles.date}>
            <DatePicker value={on} onSelect={setOn} max={todayIso()} aria-label="Recorded on" />
          </div>
        </div>

        {VITALS.map(v => {
          const last = history[v.key]?.[0];
          const pair = entered[v.key] || ['', ''];
          const auto = v.key === 'bmi';
          return (
            <div key={v.key} className={styles.card}>
              {last && (
                <div className={styles.cardHead}>
                  Last Recorded: {formatVitalWithUnit(v.key, last.value, last.value2)} • {mdy(last.recorded_on)}
                </div>
              )}
              <div className={styles.cardRow}>
                <span className={styles.name}>{v.name}</span>
                {Array.from({ length: v.parts }).map((_, i) => (
                  <span key={i} className={styles.part}>
                    {i === 1 && v.sep && <span className={styles.unit}>{v.sep}</span>}
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      placeholder={auto ? 'Auto' : 'value'}
                      aria-label={v.parts === 2 ? `${v.name} ${v.units[i] || (i ? 'second' : 'first')}` : v.name}
                      value={pair[i]}
                      readOnly={auto}
                      onChange={(e) => set(v.key, i, e.target.value)}
                      onStepUp={auto ? undefined : () => set(v.key, i, step(pair[i], 1))}
                      onStepDown={auto ? undefined : () => set(v.key, i, step(pair[i], -1))}
                      wrapperClassName={styles.num}
                    />
                    {v.units[i] && <span className={styles.unit}>{v.units[i]}</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
