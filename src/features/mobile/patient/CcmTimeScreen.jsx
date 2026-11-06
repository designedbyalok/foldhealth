import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { CCM_ACTIVITY_TYPES, secondsToTime } from '../../patient/data/ccmBillingMock';
import { canBill } from '../../patient/data/consentRules';
import { usePatientConsent } from '../../patient/hooks/usePatientConsent';
import { useMobileNav } from '../MobileNavContext';
import { FormScreen, PickerField } from './FormScreen';
import { usePatient } from './usePatient';
import styles from './patientForm.module.css';
import own from './CcmTimeScreen.module.css';

const MODES = [
  { key: 'timer', label: 'Timer' },
  { key: 'manual', label: 'Enter Minutes' },
];
const TYPE_OPTIONS = CCM_ACTIVITY_TYPES.map(t => ({ value: t, label: t }));
const activityId = () => `act-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
const EMPTY = [];

/**
 * Log CCM billable time from the phone: a start / pause timer (time keeps
 * counting while the phone is locked, it is worked out from timestamps) or
 * minutes typed in. Saves through addCcmBillableActivity into this month's
 * billing period, the same row the desktop CCM timer writes; the store's
 * consent gate blocks it without CCM consent.
 */
export function CcmTimeScreen({ patientId }) {
  const { pop, push } = useMobileNav();
  const patient = usePatient(patientId);
  const periods = useAppStore(s => s.ccmBillingPeriodsByPatient?.[patientId]);
  const activities = useAppStore(s => s.ccmBillableActivitiesByPatient?.[patientId] || EMPTY);
  const fetchCcmBilling = useAppStore(s => s.fetchCcmBilling);
  const addCcmBillableActivity = useAppStore(s => s.addCcmBillableActivity);
  const me = useAppStore(s => s.currentUserProfile);
  const consentTableMissing = useAppStore(s => s.patientConsentTableMissing);
  const { consents, loaded: consentLoaded } = usePatientConsent(patientId);
  const period = periods?.[0];

  const [mode, setMode] = useState('timer');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [minutes, setMinutes] = useState('');
  const [activityType, setActivityType] = useState(CCM_ACTIVITY_TYPES[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const startedAt = useRef(null);
  const banked = useRef(0);

  useEffect(() => { if (patientId != null && periods == null) fetchCcmBilling?.(patientId); }, [patientId, periods, fetchCcmBilling]);

  useEffect(() => {
    if (!running) return undefined;
    const tick = () => setElapsed(banked.current + Math.floor((Date.now() - startedAt.current) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [running]);

  const start = () => { startedAt.current = Date.now(); setRunning(true); };
  const pause = () => {
    banked.current += Math.floor((Date.now() - startedAt.current) / 1000);
    setElapsed(banked.current);
    setRunning(false);
  };
  const reset = () => { banked.current = 0; setElapsed(0); setRunning(false); };

  const gate = consentLoaded && !consentTableMissing ? canBill(consents, 'CCM') : { allowed: true };
  const loggedSeconds = useMemo(
    () => activities.filter(a => period && a.periodId === period.id).reduce((n, a) => n + (a.durationSeconds || 0), 0),
    [activities, period],
  );
  const seconds = mode === 'timer' ? elapsed : Math.round(Number(minutes) * 60) || 0;
  const canLog = !!period && seconds > 0 && !saving && gate.allowed;

  const log = async () => {
    if (!canLog) return;
    if (running) pause();
    setSaving(true);
    let result;
    try {
      result = await addCcmBillableActivity({
        id: activityId(),
        periodId: period.id,
        patientId,
        activityType,
        description: description.trim(),
        durationSeconds: seconds,
        loggedBy: 'You',
        loggedByInitials: 'Y',
        occurredAt: new Date().toISOString(),
        isUnlogged: false,
      });
    } finally {
      setSaving(false);
    }
    if (result?.blocked) {
      toast.error(`${result.reason}. Capture consent to log this time.`);
      return;
    }
    toast.success(`${secondsToTime(seconds)} logged to CCM`);
    pop();
  };

  const required = period?.requiredMinutes || 20;
  const progress = Math.min(1, loggedSeconds / (required * 60));

  return (
    <FormScreen
      title="CCM Time"
      subtitle={patient?.name}
      footer={<Button size="lg" fullWidth disabled={!canLog} loading={saving} onClick={log}>Log Time</Button>}
    >
      {!gate.allowed && (
        <div className={`${styles.notice} ${styles.noticeError} ${own.gate}`}>
          <span>{gate.reason}. Time can&apos;t be logged.</span>
          <Button size="lg" variant="soft" tone="danger" onClick={() => push('patientConsent', { patientId, scopeType: 'program', scope: 'CCM' })}>Capture Consent</Button>
        </div>
      )}
      {gate.allowed && period?.billStatus === 'sent' && (
        <p className={`${styles.notice} ${styles.noticeError}`}>This month is already billed: accrued time is not billable.</p>
      )}
      {periods && !period && <p className={styles.notice}>No CCM billing period for this patient yet.</p>}

      {period && (
        <div className={own.month}>
          <span className={own.monthLabel}>Logged this month</span>
          <span className={own.monthValue}>{Math.floor(loggedSeconds / 60)} of {required} min</span>
          <span className={own.bar}><span className={own.barFill} style={{ width: `${progress * 100}%` }} /></span>
        </div>
      )}

      <SegmentedControl size="lg" fullWidth aria-label="How to log time" value={mode} onValueChange={setMode} items={MODES} />

      {mode === 'timer' ? (
        <div className={own.timer}>
          <span className={own.clock} role="timer" aria-live="off">{secondsToTime(elapsed)}</span>
          <div className={own.timerActions}>
            {running
              ? <Button size="lg" variant="outline" leadingIcon="solar:pause-linear" onClick={pause}>Pause</Button>
              : <Button size="lg" variant="outline" leadingIcon="solar:play-linear" onClick={start}>{elapsed ? 'Resume' : 'Start'}</Button>}
            {elapsed > 0 && <Button size="lg" variant="ghost" onClick={reset}>Reset</Button>}
          </div>
        </div>
      ) : (
        <Input
          label="Minutes"
          required
          size="lg"
          type="number"
          inputMode="numeric"
          min={1}
          enterKeyHint="done"
          placeholder="e.g. 15"
          value={minutes}
          onValueChange={setMinutes}
        />
      )}

      <PickerField label="Activity Type" required options={TYPE_OPTIONS} value={activityType} onChange={setActivityType} />
      <Textarea title="Description" rows={3} placeholder="What was done (optional)" value={description} onValueChange={setDescription} />
      {me?.name && <span className={styles.hint}>Logged by {me.name}</span>}
    </FormScreen>
  );
}
