import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { ActivityLog } from '../../../components/ActivityLog/ActivityLog';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { DashboardCardShell } from '../../../components/DashboardCard/DashboardCard';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import {
  MEASURE_NAMES, MEASURE_ORDER, isActiveGap, addDaysMdy, measureStatus, medLabel, pharmaciesUsed, prescribersOf, todayMdy,
} from '../pharmacyWorklist.utils';
import { Select } from '../../../components/Select/Select';
import { Switch } from '../../../components/Switch/Switch';
import { Toggle } from '../../../components/Toggle/Toggle';
import { verificationTimeline } from './verificationHistory';
import { usePharmacyProgramMember } from './usePharmacyProgramMember';
import { MeasureCode } from '../PharmacyCells';
import styles from './PharmacyVerificationStep.module.css';

// A processed claim isn't proof of pickup: the fill sits on the shelf ~10–14
// days and is reversed if nobody collects it, and plan/claims data lags.
// So the coordinator calls the pharmacy and asks, per drug: last fill date,
// refilled?, picked up?, refills remaining? The answers drive the next action.
const REVERSAL_CHECK_DAYS = 14;
// A fill on the shelf or not refilled is followed up within 2–3 days (the
// pickup reminder cadence).
const SHELF_FOLLOW_UP_DAYS = 3;
const REFILL_RECHECK_DAYS = 30;

const EMPTY_ANSWER = { lastFillConfirmed: true, actualLastFill: '', refilled: null, pickedUp: null, refillsRemaining: '', refillRequestSent: false };

function isAnswered(a) {
  if (!a.refilled || a.refillsRemaining === '') return false;
  if (a.refilled === 'Yes' && !a.pickedUp) return false;
  return true;
}

function stepsFor(med, a) {
  const steps = [
    a.lastFillConfirmed ? `Last fill ${med.lastFill} confirmed` : `Last fill corrected to ${a.actualLastFill || '-'}`,
    a.refilled === 'Yes' ? 'Refilled' : 'Not refilled',
  ];
  if (a.refilled === 'Yes') steps.push(a.pickedUp === 'Yes' ? 'Picked up' : 'Not picked up (on shelf)');
  steps.push(`${a.refillsRemaining} refill${Number(a.refillsRemaining) === 1 ? '' : 's'} remaining`);
  if (a.refillRequestSent) steps.push('Refill request sent to prescriber');
  return steps;
}

function YesNo({ value, onChange, labels = ['Yes', 'No'], name, disabled }) {
  return (
    <div className={styles.radios} role="radiogroup" aria-label={name}>
      {['Yes', 'No'].map((v, i) => (
        <RadioButton key={v} checked={value === v} onChange={() => onChange(v)} label={labels[i]} disabled={disabled} />
      ))}
    </div>
  );
}

// Questions down the left; a question with `when` shows only once it applies
// to at least one gap. `required` ones (red dot) must be answered to save.
const QUESTIONS = [
  { key: 'lastFillConfirmed', label: 'Last fill confirmed?', required: true },
  { key: 'refilled', label: 'Has it been refilled?', required: true },
  { key: 'refillsRemaining', label: 'Refills remaining', required: true },
  { key: 'refillRequestSent', label: 'Refill request sent to prescriber', when: (a) => a.refillsRemaining !== '' && Number(a.refillsRemaining) === 0 },
  { key: 'pickedUp', label: 'Has it been picked up?', required: true, when: (a) => a.refilled === 'Yes' },
];

function AnswerCell({ q, gap, answer, onChange, disabled }) {
  const set = (patch) => onChange({ ...answer, ...patch });
  if (q.when && !q.when(answer)) return <span className={styles.na}>-</span>;
  switch (q.key) {
    case 'lastFillConfirmed':
      return (
        <div className={styles.cellStack}>
          {/* Each gap's own last fill (the question no longer names one). */}
          <span className={styles.cellHint}>{gap.med.lastFill || 'No fill on file'}</span>
          <YesNo name={`${gap.code} last fill confirmed`} value={answer.lastFillConfirmed ? 'Yes' : 'No'} onChange={v => set({ lastFillConfirmed: v === 'Yes' })} disabled={disabled} />
          {!answer.lastFillConfirmed && (
            <Input className={styles.dateInput} placeholder="MM/DD/YYYY" value={answer.actualLastFill} onChange={e => set({ actualLastFill: e.target.value })} aria-label={`${gap.code} actual last fill date`} disabled={disabled} />
          )}
        </div>
      );
    case 'refilled':
      return <YesNo name={`${gap.code} refilled`} value={answer.refilled} onChange={v => set({ refilled: v, pickedUp: v === 'No' ? null : answer.pickedUp })} disabled={disabled} />;
    case 'pickedUp':
      return <YesNo name={`${gap.code} picked up`} value={answer.pickedUp} labels={['Yes', 'No, on shelf']} onChange={v => set({ pickedUp: v })} disabled={disabled} />;
    case 'refillsRemaining':
      return (
        <Input
          type="number"
          min={0}
          className={styles.numInput}
          value={answer.refillsRemaining}
          onChange={e => set({ refillsRemaining: e.target.value === '' ? '' : String(Math.max(0, Number(e.target.value))) })}
          aria-label={`${gap.code} refills remaining`}
          disabled={disabled}
        />
      );
    case 'refillRequestSent':
      return <Checkbox checked={answer.refillRequestSent} onCheckedChange={v => set({ refillRequestSent: !!v })} aria-label={`${gap.code} refill request sent`} disabled={disabled} />;
    default:
      return null;
  }
}

// Pharmacy Verification step of the Pharmacy program, as an assessment
// table: questions down the left, one answer column per pharmacy gap. "Same
// answer for all" copies an answer across every column; each column stays
// editable. Each question is labelled with its category (fill history,
// refill, pickup) in the first column.
// `onLocked`: called once the call is saved (the gap drawer closes its pane).
// `onLockAction`: the gap drawer shows Save in its pane header, so the form
// hands it `{ canLock, lock }` instead of rendering its own button.
// `record`: a saved call (callHistory entry) to show read-only, with the
// answers it was saved with.
export function PharmacyVerificationStep({ program, member: memberProp, onLocked, onLockAction, record }) {
  const fromProfile = usePharmacyProgramMember();
  const member = memberProp || fromProfile;
  const lockVerification = useAppStore(s => s.lockPharmacyVerification);
  const createTask = useAppStore(s => s.createTask);
  const addProgramTask = useAppStore(s => s.addProgramTask);
  const currentUser = useAppStore(s => s.currentUserProfile);
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const patientId = memberProp ? (memberProp.patientId || memberProp.id) : selectedPatientId;
  const showToast = useAppStore(s => s.showToast);

  // One column per gap; its active medications share the answers.
  const gaps = useMemo(() => {
    if (record) {
      return (record.measures || []).map(code => ({ code, meds: [], med: { lastFill: record.lastFills?.[code] } }));
    }
    if (!member) return [];
    const all = (member.measures || [])
      .toSorted((a, b) => MEASURE_ORDER.indexOf(a.code) - MEASURE_ORDER.indexOf(b.code))
      .map(x => ({ code: x.code, pickup: x.pickupConfirmed, status: measureStatus(x, member), meds: x.medications.filter(d => d.status !== 'Discontinued') }))
      .filter(g => g.meds.length)
      .map(g => ({ ...g, med: g.meds[0] }));
    const open = all.filter(g => isActiveGap(g.status));
    return open.length ? open : all;
  }, [member, record]);

  const readOnly = !!record;
  const [answers, setAnswers] = useState(() => record?.answers || {});
  const [sameForAll, setSameForAll] = useState(false);
  const [note, setNote] = useState(() => record?.note || '');
  // Who the call is with: the same questions work for the pharmacy, the
  // prescribing physician or the member. Pharmacy and physician pick a name
  // from the gap report and the claims.
  const pharmacies = useMemo(() => pharmaciesUsed(member), [member]);
  const physicians = useMemo(() => prescribersOf(member), [member]);
  const [party, setParty] = useState(() => record?.party || 'Pharmacy');
  const [contactName, setContactName] = useState(() => record?.contact || null);
  const contactsFor = (p) => (p === 'Pharmacy' ? pharmacies : p === 'Physician' ? physicians : []);
  const contact = party === 'Member'
    ? (member?.name || 'Member')
    : (contactsFor(party).find(c => c.name === contactName) || contactsFor(party)[0])?.name || party;
  // A new call starts from the refill count the last call recorded, when every
  // drug in the gap agrees on it; the coordinator confirms or corrects it.
  const blankFor = useMemo(() => Object.fromEntries(gaps.map(g => {
    const known = [...new Set(g.meds.map(d => d.refillsRemaining))];
    const refillsRemaining = !readOnly && known.length === 1 && known[0] != null ? String(known[0]) : '';
    return [g.code, { ...EMPTY_ANSWER, refillsRemaining }];
  })), [gaps, readOnly]);
  const answerFor = (code) => answers[code] || blankFor[code] || EMPTY_ANSWER;
  const allAnswered = gaps.length > 0 && gaps.every(g => isAnswered(answerFor(g.code)));
  const lockRef = useRef(null);
  useEffect(() => {
    onLockAction?.({ canLock: allAnswered, lock: () => lockRef.current?.() });
  }, [allAnswered, onLockAction]);

  const setAnswer = (code, a) => setAnswers(prev => (sameForAll
    ? Object.fromEntries(gaps.map(g => [g.code, a]))
    : { ...prev, [code]: a }));
  const toggleSame = (on) => {
    setSameForAll(on);
    if (on && gaps.length) setAnswers(Object.fromEntries(gaps.map(g => [g.code, answerFor(gaps[0].code)])));
  };

  const rows = QUESTIONS.filter(q => !q.when || gaps.some(g => q.when(answerFor(g.code))));
  const history = verificationTimeline(member);

  const handleLock = async () => {
    const today = todayMdy();
    const items = gaps.flatMap(g => g.meds.map(med => {
      const a = answerFor(g.code);
      return { medId: med.id, measure: g.code, drug: medLabel(med), steps: stepsFor(med, a), answer: a };
    }));
    const pickedAll = items.every(it => it.answer.pickedUp === 'Yes');
    const onShelf = items.some(it => it.answer.refilled === 'Yes' && it.answer.pickedUp === 'No');
    const outcome = pickedAll ? 'Med pickup confirmed' : onShelf ? 'Filled, not picked up' : 'Not refilled';
    const pickedUpCodes = gaps.filter(g => answerFor(g.code).pickedUp === 'Yes').map(g => g.code);
    const pendingCodes = gaps.filter(g => answerFor(g.code).refilled === 'Yes' && answerFor(g.code).pickedUp === 'No').map(g => g.code);
    const refillsByMed = {};
    for (const it of items) refillsByMed[it.medId] = Number(it.answer.refillsRemaining);
    const by = currentUser?.name || 'You';
    lockVerification(member.id, {
      id: `ver-${Date.now()}`,
      kind: 'pharmacy-verification',
      locked: true,
      date: today,
      mode: 'Phone',
      direction: 'Outbound',
      party,
      contact,
      outcome,
      result: pickedAll ? 'success' : 'failed',
      by,
      note,
      measures: gaps.map(g => g.code),
      // The form as answered, so View details can show it read-only.
      answers: Object.fromEntries(gaps.map(g => [g.code, answerFor(g.code)])),
      lastFills: Object.fromEntries(gaps.map(g => [g.code, g.med.lastFill || null])),
      items: items.map(({ medId, measure, drug, steps, answer }) => ({
        medId, measure, drug, steps,
        refilled: answer.refilled === 'Yes',
        pickedUp: answer.pickedUp === 'Yes',
      })),
    }, { pickedUpCodes, pendingCodes, refillsByMed, status: 'In Progress' });

    // Follow-ups: re-check the gap report for a reversal of what was picked
    // up (until Astrana's reversal fields drive Fold's own reversal watch);
    // chase a fill on the shelf or not refilled; confirm any refill request
    // reached the pharmacy a month out.
    const followUps = pickedUpCodes.length
      ? [{ name: `Check gap report for claim reversal: ${pickedUpCodes.join(', ')} (${member.name})`, due: addDaysMdy(today, REVERSAL_CHECK_DAYS) }]
      : [];
    for (const g of gaps) {
      const a = answerFor(g.code);
      if (a.pickedUp !== 'Yes') {
        followUps.push({
          name: a.refilled === 'Yes' ? `Pickup reminder: ${g.code} on the shelf (${member.name})` : `Follow up: ${g.code} not refilled (${member.name})`,
          due: addDaysMdy(today, SHELF_FOLLOW_UP_DAYS),
        });
      }
      if (a.refillRequestSent) {
        followUps.push({ name: `Confirm refill request received: ${g.code} (${member.name})`, due: addDaysMdy(today, REFILL_RECHECK_DAYS) });
      }
    }
    let createdCount = 0;
    for (const f of followUps) {
      const created = await createTask({
        name: f.name, status: 'pending', priority: 'medium', due_date: f.due,
        assigned_to: by, assigned_to_id: currentUser?.id || null, member: member.name,
        labels: [], meta: '', description: '', pool: null, mentions: [], attachments: 0, comments: 0,
        is_subtask: false, parent_task: null, parent_task_id: null,
        program_code: program.code, patient_id: patientId != null ? String(patientId) : null,
      });
      if (created) { addProgramTask(program.code, created); createdCount += 1; }
    }
    setAnswers({});
    setNote('');
    onLocked?.();
    showToast?.(createdCount === followUps.length
      ? `Verification call saved · ${createdCount} follow-up task${createdCount === 1 ? '' : 's'} created`
      : `Verification call saved · could not create ${followUps.length - createdCount} follow-up task${followUps.length - createdCount === 1 ? '' : 's'}`);
  };

  // The header button calls the latest handler, with this render's answers.
  useEffect(() => { lockRef.current = handleLock; });

  if (!member && !record) {
    return (
      <div className={styles.empty}>
        <Icon name="solar:pills-linear" size={40} color="var(--neutral-200)" />
        <p>No MAC, MAD or MAH medications on file for this member.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Who was called, then the sync switch, above the form. */}
      <div className={styles.syncRow}>
        {readOnly ? (
          <span className={styles.partyText}>Called: {record.party || 'Pharmacy'} · {record.contact}</span>
        ) : (
          <span className={styles.partyPick}>
            <Toggle size="S" items={['Pharmacy', 'Physician', 'Member']} active={party} onChange={(p) => { setParty(p); setContactName(null); }} />
            {contactsFor(party).length > 1 && (
              <Select
                portal
                options={contactsFor(party).map(c => ({ value: c.name, label: c.name }))}
                value={contact}
                onChange={setContactName}
                aria-label={`Which ${party.toLowerCase()}`}
              />
            )}
            {contactsFor(party).length <= 1 && <span className={styles.partyText}>{contact}</span>}
          </span>
        )}
        {gaps.length > 1 && !readOnly && (
          <Switch checked={sameForAll} onChange={toggleSame} label="Same answer for all gaps" />
        )}
      </div>
      <DashboardCardShell flush>
        <div className={styles.assessment}>
          <div className={styles.tableScroll}>
            <table className={styles.qTable}>
              <thead>
                <tr>
                  <th className={styles.qCol}>Question</th>
                  {gaps.map(g => (
                    <th key={g.code}>
                      <MeasureCode code={g.code} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(q => (
                  <tr key={q.key}>
                    <td className={styles.qCol}>
                      <span className={styles.qLabel}>
                        {q.label}
                        {q.required && !readOnly && <span className={styles.requiredDot} aria-hidden="true" />}
                      </span>
                    </td>
                    {gaps.map(g => (
                      <td key={g.code}>
                        <AnswerCell q={q} gap={g} answer={answerFor(g.code)} onChange={a => setAnswer(g.code, a)} disabled={readOnly} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.callBody}>
          <div className={styles.q}>
            <span className={styles.qLabel}>Call Note</span>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder={readOnly ? 'No note' : 'One note for the whole call'} aria-label="Call note" disabled={readOnly} />
          </div>
          {readOnly ? (
            <div className={styles.callFoot}>
              <span className={styles.muted}>
                Saved {record.date}{record.by ? ` by ${record.by}` : ''} • {record.outcome}
              </span>
            </div>
          ) : (
            <div className={styles.callFoot}>
              <span className={styles.muted}>Saving logs this call as one action across all gaps (counts as 1 outreach).</span>
              {!onLockAction && (
                <Button disabled={!allAnswered} onClick={handleLock}>
                  Save
                </Button>
              )}
            </div>
          )}
        </div>
      </DashboardCardShell>

      {!readOnly && (
        // No card around it: a titled timeline, like the drawer's Activity tab.
        <section className={styles.history}>
          <h3 className={styles.historyTitle}>Verification History</h3>
          <ActivityLog entries={history} relaxed flushTop emptyLabel="No verification calls logged yet." />
        </section>
      )}
    </div>
  );
}
