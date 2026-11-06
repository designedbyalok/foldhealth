import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { isFutureDate, todayIso } from '../../../lib/clinicalDates';
import { VITALS, formatVitalWithUnit } from '../../patient/left-panel/tabs/vitals-labs/vitalsConfig';
import { useMobileNav } from '../MobileNavContext';
import { FormScreen } from './FormScreen';
import styles from './patientForm.module.css';
import own from './RecordVitalsScreen.module.css';

const EMPTY = [];
const num = (v) => (v === '' || v == null ? null : Number(v));

// BMI as the desktop drawer works it out (RecordVitalsDrawer calcBmi):
// 703 × lbs ÷ in², from what was entered now with the last reading filling
// the other half, and only once height or weight was entered.
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
const mdy = (iso) => { const [y, m, d] = String(iso || '').split('-'); return `${m}-${d}-${y}`; };

/**
 * Record New Vitals on the phone, the same rules as the desktop drawer
 * (RecordVitalsDrawer): only vitals with a value are saved, BP needs both
 * numbers, Height's inches default to 0, BMI follows height and weight, and
 * the date can't be in the future. `focus` scrolls one vital into view.
 */
export function RecordVitalsScreen({ patientId, focus }) {
  const { pop } = useMobileNav();
  const recordPatientVitals = useAppStore(s => s.recordPatientVitals);
  const fetchPatientVitals = useAppStore(s => s.fetchPatientVitals);
  const rows = useAppStore(s => s.patientVitals?.[patientId] || EMPTY);
  const [on, setOn] = useState(todayIso);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (patientId != null) fetchPatientVitals?.(patientId); }, [patientId, fetchPatientVitals]);
  useEffect(() => {
    if (!focus) return;
    document.getElementById(`vital-${focus}`)?.scrollIntoView({ block: 'center' });
  }, [focus]);

  const history = useMemo(() => {
    const by = {};
    rows.forEach(r => { (by[r.vital_key] ||= []).push(r); });
    return by;
  }, [rows]);

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

  const incompleteBp = readings.some(r => r.vital_key === 'bp' && !r.value2);
  const futureDate = !!on && isFutureDate(on);
  const canRecord = readings.length > 0 && !!on && !futureDate && !incompleteBp && !saving;

  const record = async () => {
    if (!canRecord) return;
    setSaving(true);
    let error;
    try {
      ({ error } = await recordPatientVitals(patientId, readings));
    } finally {
      setSaving(false);
    }
    if (error) { toast.error('Vitals could not be recorded'); return; }
    toast.success(readings.length === 1 ? 'Vital recorded' : `${readings.length} vitals recorded`);
    pop();
  };

  return (
    <FormScreen
      title="Record Vitals"
      footer={<Button size="lg" fullWidth disabled={!canRecord} loading={saving} onClick={record}>Record</Button>}
    >
      <Input
        label="Recorded On"
        type="date"
        size="lg"
        max={todayIso()}
        value={on}
        onValueChange={setOn}
        errorText={futureDate ? 'The date cannot be in the future' : undefined}
      />
      {incompleteBp && <p className={`${styles.notice} ${styles.noticeError}`}>Enter both numbers for Blood Pressure.</p>}
      <div className={own.list}>
        {VITALS.map(v => {
          const last = history[v.key]?.[0];
          const pair = entered[v.key] || ['', ''];
          const auto = v.key === 'bmi';
          return (
            <div key={v.key} id={`vital-${v.key}`} className={own.card}>
              <div className={own.head}>
                <span className={own.name}>{v.name}</span>
                {last && <span className={own.last}>Last: {formatVitalWithUnit(v.key, last.value, last.value2)} • {mdy(last.recorded_on)}</span>}
              </div>
              <div className={own.inputs}>
                {Array.from({ length: v.parts }).map((_, i) => (
                  <span key={i} className={own.part}>
                    {i === 1 && v.sep && <span className={own.unit}>{v.sep}</span>}
                    <Input
                      size="lg"
                      type="number"
                      inputMode="decimal"
                      enterKeyHint="next"
                      min={0}
                      step="any"
                      placeholder={auto ? 'Auto' : 'Value'}
                      aria-label={v.parts === 2 ? `${v.name} ${v.units[i] || (i ? 'second' : 'first')}` : v.name}
                      value={pair[i]}
                      readOnly={auto}
                      onValueChange={(val) => set(v.key, i, val)}
                      wrapperClassName={own.num}
                    />
                    {v.units[i] && <span className={own.unit}>{v.units[i]}</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </FormScreen>
  );
}
