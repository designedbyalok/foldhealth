import { useMemo, useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { isFutureDate } from '../../../lib/clinicalDates';
import { OUTCOME_COLOR, TYPE_LOG_LABEL, TYPE_OPTIONS } from '../../patient/left-panel/tabs/outreach/OutreachTab/OutreachTab.utils';
import { schemaOutcomeItems } from '../../pharmacy-worklist/interventionSchema';
import { fillEventFor, setsRecentFill } from '../../pharmacy-worklist/fillEvents';
import { mapOutcomesToIntervention } from '../../pharmacy-worklist/outcomeMapping';
import { MEASURE_NAMES, MEASURE_ORDER } from '../../pharmacy-worklist/pharmacyWorklist.utils';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen, PickerField } from '../patient/FormScreen';
import form from '../patient/patientForm.module.css';
import styles from './worklistDetail.module.css';

// useOutreachTab's maps: outreach type → activity icon, outcome → tone.
const OUTREACH_ACTIVITY_KIND = {
  Call: 'call', SMS: 'sms', Email: 'email', Letter: 'letter',
  Chat: 'chat', Virtual: 'virtual', 'In Person': 'inperson', General: 'outreach',
};
const OUTREACH_STATUS_TYPE = { Successful: 'success', Unsuccessful: 'error', Note: 'warning' };
const OUTCOMES = ['Successful', 'Unsuccessful', 'Note'].map(k => ({ key: k, label: k }));
const TYPES = TYPE_OPTIONS.map(t => ({ value: t.label, label: t.label }));
const pad = (n) => String(n).padStart(2, '0');
const nowParts = () => {
  const d = new Date();
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

/**
 * The desktop PHARM Outreach form on the phone (useOutreachTab scoped to
 * PHARM + usePharmacyOutreachTab.handleSaved): one feed entry per measure
 * picked, then one call-history row through logPharmacyOutreach (pickups
 * move fill dates), Barrier & Intervention entries through
 * logPharmacyInterventions, and a PHARM Program Activity Log line per
 * measure. Outcome and note are required, as on desktop.
 */
export function PharmacyOutreachScreen({ id }) {
  const { pop } = useMobileNav();
  const member = useAppStore(s => (s.pharmacyWorklistMembers || []).find(m => m.id === id));
  const me = useAppStore(s => s.currentUserProfile);
  const logPharmacyOutreach = useAppStore(s => s.logPharmacyOutreach);
  const logPharmacyInterventions = useAppStore(s => s.logPharmacyInterventions);
  const logProgramActivity = useAppStore(s => s.logProgramActivity);

  // The member's open measures, pre-selected (usePharmacyOutreachTab).
  const measures = useMemo(() => {
    const open = new Set((member?.measures || []).map(x => x.code));
    return open.size ? MEASURE_ORDER.filter(c => open.has(c)) : MEASURE_ORDER;
  }, [member]);
  const [initial] = useState(nowParts);
  const [picked, setPicked] = useState(null);
  const [type, setType] = useState('General');
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [outcome, setOutcome] = useState(null);
  const [outcomes, setOutcomes] = useState([]);
  const [note, setNote] = useState('');
  const [outcomeOpen, setOutcomeOpen] = useState(false);

  const selected = picked ?? measures;
  const toggle = (code) => setPicked(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  const items = outcome ? schemaOutcomeItems(outcome) : [];
  const future = !!date && isFutureDate(date);
  const canSave = !!member && selected.length > 0 && !!outcome && !!note.trim() && !!date && !future;

  const changeOutcome = (next) => { if (next !== outcome) { setOutcome(next); setOutcomes([]); } };
  const toggleOutcome = (key) => setOutcomes(o => (o.includes(key) ? o.filter(k => k !== key) : [...o, key]));

  const save = () => {
    if (!canSave) return;
    const [yyyy, mm, dd] = date.split('-');
    const author = me?.name || 'You';
    const label = TYPE_LOG_LABEL[type] || type;
    const now = Date.now();
    // useOutreachTab.handleSave (one shared note panel).
    const entries = selected.map((code, i) => ({
      id: now + i,
      type,
      date: `${mm}/${dd}`,
      time,
      author,
      title: label,
      programs: [code],
      outcome: outcomes[0] || outcome,
      outcomes,
      outcomeColor: OUTCOME_COLOR[outcome] || 'var(--neutral-300)',
      note: note.trim(),
    }));
    for (const e of entries) {
      logProgramActivity({
        patientId: member.patientId || member.id,
        programCode: 'PHARM',
        title: `Outreach - ${e.title} (${e.programs[0]})`,
        activityKind: OUTREACH_ACTIVITY_KIND[e.type] || 'outreach',
        statusLabel: e.outcome || '',
        statusType: OUTREACH_STATUS_TYPE[outcome] || 'neutral',
      });
    }

    // usePharmacyOutreachTab.handleSaved (new outreach).
    const first = entries[0];
    const outcomesOf = (e) => (e.outcomes?.length ? e.outcomes : [e.outcome]);
    const distinct = new Set(entries.map(e => outcomesOf(e).join(', ')));
    const summary = distinct.size === 1 ? [...distinct] : entries.map(e => `${e.programs[0]}: ${outcomesOf(e).join(', ')}`);
    const codesWith = (event) => entries.filter(e => outcomesOf(e).some(o => fillEventFor(o) === event)).map(e => e.programs[0]);
    const firstOutcome = outcomesOf(first)[0] || '';
    const year = yyyy || new Date().getFullYear();
    logPharmacyOutreach(member.id, {
      id: `out-${first.id}`,
      logIds: entries.map(e => e.id),
      date: `${first.date}/${year}`,
      time: first.time,
      type: first.type,
      title: first.title,
      contact: firstOutcome.includes(' · ') ? firstOutcome.split(' · ')[0] : first.title,
      outcome: summary.join('; '),
      result: first.outcomeColor.includes('error') ? 'failed' : first.outcomeColor.includes('warning') ? 'note' : 'success',
      by: first.author,
      note: [...new Set(entries.map(e => e.note).filter(Boolean))].join(' / '),
      measures: entries.map(e => e.programs[0]),
    }, {
      pickupCodes: codesWith('pickup'),
      pendingCodes: codesWith('pending-pickup'),
      recentFillCodes: entries.filter(e => outcomesOf(e).some(setsRecentFill)).map(e => e.programs[0]),
      recentFillOutcome: outcomesOf(entries.find(e => outcomesOf(e).some(setsRecentFill)) || first).find(setsRecentFill),
    });
    const byMeasure = {};
    for (const e of entries) {
      const rec = mapOutcomesToIntervention(outcomesOf(e));
      if (rec) byMeasure[e.programs[0]] = rec;
    }
    if (Object.keys(byMeasure).length) {
      logPharmacyInterventions(member.id, {
        date: `${first.date}/${year}`,
        by: first.author,
        note: [...new Set(entries.map(e => e.note).filter(Boolean))].join(' / '),
        source: 'Outreach',
        outreachType: first.type,
        measures: byMeasure,
      });
    }
    toast.success('Outreach logged successfully');
    pop();
  };

  const outcomeSummary = outcomes.length
    ? outcomes.map(k => k.split(' · ').slice(1).join(' · ') || k).join(', ')
    : '';

  return (
    <FormScreen
      title="Log Outreach"
      subtitle={member?.name}
      footer={<Button size="lg" fullWidth disabled={!canSave} onClick={save}>Log Outreach</Button>}
    >
      <FieldGroup label="Gaps" required>
        <div className={form.chips}>
          {measures.map(code => (
            <button
              key={code}
              type="button"
              aria-pressed={selected.includes(code)}
              aria-label={`${code} ${MEASURE_NAMES[code] || ''}`}
              className={`${form.chip} ${selected.includes(code) ? form.chipOn : ''}`}
              onClick={() => toggle(code)}
            >
              {selected.includes(code) && <Icon name="solar:check-circle-linear" size={20} color="currentColor" />}
              {code}
            </button>
          ))}
        </div>
      </FieldGroup>

      <PickerField label="Outreach Type" required options={TYPES} value={type} onChange={setType} />

      <div className={styles.pair}>
        <Input label="Date" type="date" size="lg" value={date} onValueChange={setDate} />
        <Input label="Time" type="time" size="lg" value={time} onValueChange={setTime} />
      </div>
      {future && <span className={`${form.hint} ${form.error}`}>Outreach can&apos;t be logged in the future.</span>}

      <FieldGroup label="Outcome" required>
        <SegmentedControl size="lg" fullWidth aria-label="Outcome" value={outcome} onValueChange={changeOutcome} items={OUTCOMES} />
      </FieldGroup>
      {outcome && (
        <div className={form.field}>
          <span className={form.fieldLabel}>Detailed Outcome</span>
          <button type="button" className={form.picker} aria-haspopup="dialog" aria-label={`Detailed outcome: ${outcomeSummary || 'Select outcome'}`} onClick={() => setOutcomeOpen(true)}>
            <span className={outcomeSummary ? form.pickerValue : form.pickerPlaceholder}>{outcomeSummary || 'Select outcome'}</span>
            <Icon name="solar:alt-arrow-down-linear" size={20} color="currentColor" />
          </button>
        </div>
      )}
      <Textarea title="Note" mandatory rows={4} placeholder="What happened on this outreach" value={note} onValueChange={setNote} />

      {outcomeOpen && (
        <BottomSheet title="Select Outcome" onClose={() => setOutcomeOpen(false)}>
          <div className={form.choices} role="group" aria-label="Detailed outcome">
            {items.map(it => (it.section ? (
              <p key={`s-${it.section}`} className={styles.sectionLabel}>{it.section}</p>
            ) : (
              <button
                key={it.key}
                type="button"
                role="checkbox"
                aria-checked={outcomes.includes(it.key)}
                className={form.choice}
                onClick={() => toggleOutcome(it.key)}
              >
                <span className={form.choiceText}><span className={form.choiceLabel}>{it.label}</span></span>
                {outcomes.includes(it.key) && <Icon name="solar:check-circle-linear" size={24} color="var(--primary-300)" />}
              </button>
            )))}
          </div>
          <Button size="lg" fullWidth onClick={() => setOutcomeOpen(false)}>Done</Button>
        </BottomSheet>
      )}
    </FormScreen>
  );
}
