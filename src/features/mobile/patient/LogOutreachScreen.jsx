import { useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { isFutureDate } from '../../../lib/clinicalDates';
import { canContact } from '../../patient/data/consentRules';
import { OUTREACH_CHANNEL } from '../../patient/data/patientPreferences';
import { usePatientConsent } from '../../patient/hooks/usePatientConsent';
import {
  OUTCOME_CHOICES_BY_STATUS, PROGRAMS, TYPE_LOG_LABEL, TYPE_OPTIONS,
} from '../../patient/left-panel/tabs/outreach/OutreachTab/OutreachTab.utils';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen, PickerField } from './FormScreen';
import { usePatient } from './usePatient';
import styles from './patientForm.module.css';

// Same maps as useOutreachTab: outreach type → activity icon, outcome → tone.
const OUTREACH_ACTIVITY_KIND = {
  Call: 'call', SMS: 'sms', Email: 'email', Letter: 'letter',
  Chat: 'chat', Virtual: 'virtual', 'In Person': 'inperson', General: 'outreach',
};
const OUTREACH_STATUS_TYPE = { Successful: 'success', Unsuccessful: 'error', Note: 'warning' };
const OUTCOMES = ['Successful', 'Unsuccessful', 'Note'].map(k => ({ key: k, label: k }));
const TYPES = TYPE_OPTIONS.map(t => ({ value: t.label, label: t.label }));
const EMPTY = [];
const pad = (n) => String(n).padStart(2, '0');
const nowParts = () => {
  const d = new Date();
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

/**
 * Log an outreach attempt and its outcome against the patient's care
 * programs, as the desktop Outreach tab does in Care Program mode
 * (useOutreachTab.handleSave): one Program Activity Log entry per program
 * through logProgramActivity, titled "Outreach - <type>", with the detailed
 * outcome (or the outcome) as its status. Outcome and note are required.
 * `type` presets the outreach type (Call after a call).
 */
export function LogOutreachScreen({ patientId, type: initialType = 'Call' }) {
  const { pop } = useMobileNav();
  const patient = usePatient(patientId);
  const logProgramActivity = useAppStore(s => s.logProgramActivity);
  const consentTableMissing = useAppStore(s => s.patientConsentTableMissing);
  const { consents, preferences, programs } = usePatientConsent(patientId);
  const [initial] = useState(nowParts);
  const [type, setType] = useState(initialType);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [outcome, setOutcome] = useState(null);
  const [detail, setDetail] = useState('');
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState(null);

  // The patient's open programs lead; the standard list fills in otherwise.
  const enrolled = useMemo(
    () => [...new Set((programs || EMPTY).filter(p => !/completed|disenrolled|closed/i.test(p.status || '')).map(p => p.code).filter(Boolean))],
    [programs],
  );
  const options = enrolled.length ? enrolled : PROGRAMS;
  const selected = picked ?? (enrolled.length === 1 ? enrolled : []);
  const toggle = (code) => setPicked(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);

  const channel = OUTREACH_CHANNEL[type];
  const warning = channel && !consentTableMissing
    ? canContact(consents, preferences, channel, { value: channel === 'call' ? patient?.phone : channel === 'email' ? patient?.email : undefined }).reason
    : null;

  const occurredAt = date && time ? new Date(`${date}T${time}`) : null;
  const future = !!date && isFutureDate(date);
  const canSave = selected.length > 0 && !!outcome && !!note.trim() && !!occurredAt && !future;

  const changeOutcome = (next) => { if (next !== outcome) { setOutcome(next); setDetail(''); } };

  const save = () => {
    if (!canSave) return;
    const label = TYPE_LOG_LABEL[type] || type;
    selected.forEach(code => logProgramActivity({
      patientId,
      programCode: code,
      title: `Outreach - ${label}`,
      activityKind: OUTREACH_ACTIVITY_KIND[type] || 'outreach',
      statusLabel: detail || outcome,
      statusType: OUTREACH_STATUS_TYPE[outcome] || 'neutral',
      occurredAt: occurredAt.toISOString(),
    }));
    toast.success('Outreach logged successfully');
    pop();
  };

  return (
    <FormScreen
      title="Log Outreach"
      subtitle={patient?.name}
      footer={<Button size="lg" fullWidth disabled={!canSave} onClick={save}>Log Outreach</Button>}
    >
      <FieldGroup label="Program" required hint={enrolled.length ? null : 'No open programs on file: pick the program this outreach was for.'}>
        <div className={styles.chips}>
          {options.map(code => (
            <button
              key={code}
              type="button"
              aria-pressed={selected.includes(code)}
              className={`${styles.chip} ${selected.includes(code) ? styles.chipOn : ''}`}
              onClick={() => toggle(code)}
            >
              {selected.includes(code) && <Icon name="solar:check-circle-linear" size={20} color="currentColor" />}
              {code}
            </button>
          ))}
        </div>
      </FieldGroup>

      <PickerField label="Outreach Type" required options={TYPES} value={type} onChange={setType} />
      {warning && (
        <p className={`${styles.notice} ${styles.noticeError}`}>
          <Icon name="solar:danger-triangle-linear" size={20} color="currentColor" />
          <span>{warning}</span>
        </p>
      )}

      <Input label="Date" type="date" size="lg" value={date} onValueChange={setDate} />
      <Input label="Time" type="time" size="lg" value={time} onValueChange={setTime} />
      {future && <span className={`${styles.hint} ${styles.error}`}>Outreach can&apos;t be logged in the future.</span>}

      <FieldGroup label="Outcome" required>
        <SegmentedControl size="lg" fullWidth aria-label="Outcome" value={outcome} onValueChange={changeOutcome} items={OUTCOMES} />
      </FieldGroup>
      {outcome && (
        <PickerField
          label="Detailed Outcome"
          options={(OUTCOME_CHOICES_BY_STATUS[outcome] || []).map(o => ({ value: o, label: o }))}
          value={detail}
          placeholder="Select outcome"
          onChange={setDetail}
        />
      )}
      <Textarea title="Note" mandatory rows={4} placeholder="What happened on this outreach" value={note} onValueChange={setNote} />
    </FormScreen>
  );
}
