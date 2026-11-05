import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { Select } from '../../../components/Select/Select';
import { Switch } from '../../../components/Switch/Switch';
import { Textarea } from '../../../components/Textarea/Textarea';
import {
  MEASURE_NAMES, MEASURE_ORDER, isActiveGap, addDaysMdy, measureStatus, pharmaciesUsed, prescribersOf, todayMdy,
} from '../pharmacyWorklist.utils';
import { recordWithGapAdditions, latestFor } from './useBarrierForm';
import { STAKEHOLDERS } from '../interventionSchema';
import { mapOutcomesToIntervention } from '../outcomeMapping';
import { usePharmacyProgramMember } from './usePharmacyProgramMember';
import { assessmentCallDetails } from './assessmentOutreach';
import { Link } from '../../../components/Link/Link';
import styles from './PharmacyVerificationStep.module.css';

// The Medication Adherence Intervention Schema as an assessment form, laid out
// like the Consolidated Clinical Note: one card for the call (who was
// contacted, Action, Type, Contact outcome), then that stakeholder's
// questions as a table with one column per gap, then the call note. Save logs the assessment to
// the activity log, and picks that are barriers, interventions or results go
// to each gap's Barrier & Intervention log.
const ACTIONS = ['Telephonic', 'Email', 'Fax', 'Mail', 'Text', 'Other'];
const CALL_TYPES = ['Outbound', 'Inbound', 'Other'];
const REACHED = 'Reached';
// A confirmed pickup gets a gap report re-check for a claim reversal two weeks
// out; a fill waiting at the pharmacy, a pickup reminder in 3 days.
const REVERSAL_CHECK_DAYS = 14;
const SHELF_FOLLOW_UP_DAYS = 3;
const PICKED_UP = 'Rx Pick Up Confirmed';
const PICKUP_PENDING = 'Rx Pick Up Pending';

const stakeholderOf = (key) => STAKEHOLDERS.find(s => s.key === key) || STAKEHOLDERS[0];
// A gap's ticked questions as saved outcome labels ("Side effects: Concern").
const outcomeLabels = (picked) => Object.entries(picked || {})
  .filter(([, v]) => v)
  .map(([label, v]) => (v === true ? label : `${label}: ${v}`));

function RadioRow({ items, value, onChange, disabled }) {
  return (
    <div className={styles.radioRow}>
      {items.map(it => (
        <RadioButton key={it} checked={value === it} onChange={() => onChange(it)} label={it} disabled={disabled} />
      ))}
    </div>
  );
}

// One question for one gap: a checkbox, or a small picker for a question
// with options (Side effects: Concern / Experienced).
function AnswerCell({ item, gap, value, onChange, disabled }) {
  if (item.options) {
    return (
      <Select
        size="sm"
        portal
        options={[{ value: '', label: '-' }, ...item.options.map(o => ({ value: o, label: o }))]}
        value={value || ''}
        onValueChange={v => onChange(v || null)}
        aria-label={`${gap.code} ${item.label}`}
        disabled={disabled}
      />
    );
  }
  return <Checkbox checked={!!value} onCheckedChange={v => onChange(v ? true : null)} aria-label={`${gap.code} ${item.label}`} disabled={disabled} />;
}

// `onLocked`: called once the assessment is saved (the gap drawer closes its pane).
// `onLockAction`: the gap drawer shows Save in its pane header, so the form
// hands it `{ canLock, lock }` instead of rendering its own button.
// `record`: a saved assessment (callHistory entry) to show read-only.
// `outreachCall`: the call outreach this assessment belongs to
// ({ callType, direction, calledTo }), for Fill from outreach.
// `onAddToOutreach(entry)`: puts a saved assessment's summary in the outreach
// note; offered as a checkbox next to Save.
export function PharmacyVerificationStep({ program, member: memberProp, onLocked, onLockAction, record, outreachCall, onAddToOutreach }) {
  const fromProfile = usePharmacyProgramMember();
  const member = memberProp || fromProfile;
  const lockVerification = useAppStore(s => s.lockPharmacyVerification);
  const logInterventions = useAppStore(s => s.logPharmacyInterventions);
  const createTask = useAppStore(s => s.createTask);
  const addProgramTask = useAppStore(s => s.addProgramTask);
  const currentUser = useAppStore(s => s.currentUserProfile);
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const patientId = memberProp ? (memberProp.patientId || memberProp.id) : selectedPatientId;
  const showToast = useAppStore(s => s.showToast);

  // One card per open pharmacy gap (every gap when none is open).
  const gaps = useMemo(() => {
    if (record) return (record.measures || []).map(code => ({ code }));
    if (!member) return [];
    const all = (member.measures || [])
      .toSorted((a, b) => MEASURE_ORDER.indexOf(a.code) - MEASURE_ORDER.indexOf(b.code))
      .filter(x => x.medications.some(d => d.status !== 'Discontinued'))
      .map(x => ({ code: x.code, status: measureStatus(x, member) }));
    const open = all.filter(g => isActiveGap(g.status));
    return open.length ? open : all;
  }, [member, record]);

  const readOnly = !!record;
  const [stakeholder, setStakeholder] = useState(() => record?.party || 'Pharmacy');
  const [contactName, setContactName] = useState(() => record?.contact || null);
  const [action, setAction] = useState(() => record?.action || 'Telephonic');
  const [callType, setCallType] = useState(() => record?.direction || 'Outbound');
  const [contactOutcome, setContactOutcome] = useState(() => record?.contactOutcome || REACHED);
  // Picks per gap: { MAD: { 'Cost/financial barrier': true, 'Side effects': 'Concern' } }.
  const [picks, setPicks] = useState(() => record?.picks || {});
  const [note, setNote] = useState(() => record?.note || '');
  // On: an answer for one gap is copied to every gap.
  const [sameForAll, setSameForAll] = useState(false);
  const [addToOutreach, setAddToOutreach] = useState(true);

  const schema = stakeholderOf(stakeholder);
  const pharmacies = useMemo(() => pharmaciesUsed(member), [member]);
  const physicians = useMemo(() => prescribersOf(member), [member]);
  const contacts = stakeholder === 'Pharmacy' ? pharmacies : stakeholder === 'Provider Office' ? physicians : [];
  const contact = readOnly
    ? record.contact
    : contactName || (stakeholder === 'Member' ? member?.name : contacts[0]?.name) || stakeholder;
  // Not reached (UTC, wrong number...): nothing more to ask.
  const reached = contactOutcome === REACHED;
  const canSave = gaps.length > 0;

  const saveRef = useRef(null);
  useEffect(() => {
    onLockAction?.({ canLock: canSave, lock: () => saveRef.current?.() });
  }, [canSave, onLockAction]);

  const pickStakeholder = (key) => {
    setStakeholder(key);
    setContactName(null);
    setContactOutcome(REACHED);
    setPicks({});
  };
  // Telephonic: take who was called and the direction from the call outreach.
  const fromOutreach = assessmentCallDetails(outreachCall);
  const fillFromOutreach = () => {
    if (fromOutreach.stakeholder && fromOutreach.stakeholder !== stakeholder) pickStakeholder(fromOutreach.stakeholder);
    if (fromOutreach.contact) setContactName(fromOutreach.contact);
    setCallType(fromOutreach.direction);
  };
  const setPick = (code, label, value) => setPicks(prev => {
    const one = (c) => ({ ...(prev[c] || {}), [label]: value });
    return sameForAll ? Object.fromEntries(gaps.map(g => [g.code, one(g.code)])) : { ...prev, [code]: one(code) };
  });
  // Turning sync on copies the first gap's answers to the others.
  const toggleSame = (on) => {
    setSameForAll(on);
    if (on && gaps.length) setPicks(prev => Object.fromEntries(gaps.map(g => [g.code, { ...(prev[gaps[0].code] || {}) }])));
  };

  const handleSave = async () => {
    const today = todayMdy();
    const by = currentUser?.name || 'You';
    const outcomes = reached ? Object.fromEntries(gaps.map(g => [g.code, outcomeLabels(picks[g.code])]).filter(([, l]) => l.length)) : {};
    const mapped = Object.fromEntries(Object.entries(outcomes).map(([code, labels]) => [code, mapOutcomesToIntervention(labels)]));
    const codesWith = (result) => Object.keys(mapped).filter(code => mapped[code]?.result === result);
    const pickedUpCodes = codesWith(PICKED_UP);
    const pendingCodes = codesWith(PICKUP_PENDING);
    const outcome = !reached ? contactOutcome
      : pickedUpCodes.length === gaps.length ? 'Med pickup confirmed'
      : Object.keys(outcomes).length ? 'Interventions logged' : 'Reached';
    const entry = {
      id: `ver-${Date.now()}`,
      kind: 'pharmacy-verification',
      locked: true,
      date: today,
      mode: action === 'Telephonic' ? 'Phone' : action,
      action,
      direction: callType,
      contactOutcome,
      party: stakeholder,
      contact,
      outcome,
      result: reached && pickedUpCodes.length === gaps.length ? 'success' : 'failed',
      by,
      note,
      measures: gaps.map(g => g.code),
      // The form as filled, so View details can show it read-only.
      picks,
      outcomes,
      items: Object.entries(outcomes).map(([measure, steps]) => ({ measure, drug: MEASURE_NAMES[measure] || measure, steps })),
    };
    lockVerification(member.id, entry, { pickedUpCodes, pendingCodes, refillsByMed: {}, status: 'In Progress' });

    // Barriers, interventions and results go to each gap's Barrier &
    // Intervention log, added to what the gap already has.
    const byMeasure = {};
    for (const [code, add] of Object.entries(mapped)) {
      const x = member.measures.find(m => m.code === code);
      if (add && x) byMeasure[code] = recordWithGapAdditions(x, latestFor(member.interventionLog, code)?.rec, add);
    }
    if (Object.keys(byMeasure).length) {
      logInterventions(member.id, { date: today, by, note, source: 'Assessment', outreachType: action, measures: byMeasure });
    }

    const followUps = [
      ...(pickedUpCodes.length ? [{ name: `Check gap report for claim reversal: ${pickedUpCodes.join(', ')} (${member.name})`, due: addDaysMdy(today, REVERSAL_CHECK_DAYS) }] : []),
      ...pendingCodes.map(code => ({ name: `Pickup reminder: ${code} ready at the pharmacy (${member.name})`, due: addDaysMdy(today, SHELF_FOLLOW_UP_DAYS) })),
    ];
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
    setPicks({});
    setNote('');
    setContactOutcome(REACHED);
    onLocked?.();
    if (addToOutreach) onAddToOutreach?.(entry);
    const failed = followUps.length - createdCount;
    showToast?.(failed
      ? `Assessment saved · could not create ${failed} follow-up task${failed === 1 ? '' : 's'}`
      : `Assessment saved${createdCount ? ` · ${createdCount} follow-up task${createdCount === 1 ? '' : 's'} created` : ''}`);
  };

  // The header button calls the latest handler, with this render's picks.
  useEffect(() => { saveRef.current = handleSave; });

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
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Contact Details</span>
          <Badge tone="info" size="sm" label="Common for all gaps" />
        </div>
        {readOnly ? (
          // A saved assessment: just what was picked, label above value.
          <dl className={styles.summary}>
            {[
              ['Stakeholder', stakeholder],
              ['Contact', contact],
              ['Action', action],
              ['Type', callType],
              ['Contact outcome', contactOutcome === REACHED ? `Reached the ${stakeholder.toLowerCase()}` : contactOutcome],
              ['Saved', `${record.date}${record.by ? ` by ${record.by}` : ''}`],
            ].map(([label, value]) => (
              <div key={label} className={styles.summaryItem}>
                <dt>{label}</dt>
                <dd>{value || '-'}</dd>
              </div>
            ))}
          </dl>
        ) : (
        <div className={styles.cardBody}>
          {/* Who was contacted: the stakeholder, and beside it which one. */}
          <div className={styles.pairRow}>
            <Select
              label="Stakeholder"
              portal
              options={STAKEHOLDERS.map(s => ({ value: s.key, label: s.key }))}
              value={stakeholder}
              onValueChange={pickStakeholder}
              disabled={readOnly}
            />
            {contacts.length > 1 && !readOnly ? (
              <Select
                label={stakeholder === 'Pharmacy' ? 'Pharmacy' : 'Provider'}
                portal
                options={contacts.map(c => ({ value: c.name, label: c.name }))}
                value={contact}
                onValueChange={setContactName}
              />
            ) : (
              <Input label="Contact" value={contact} readOnly aria-label="Contact" />
            )}
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Action</span>
            <RadioRow items={ACTIONS} value={action} onChange={setAction} disabled={readOnly} />
            {action === 'Telephonic' && !readOnly && (
              <Link
                size="sm"
                className={styles.fillLink}
                disabled={!fromOutreach}
                title={fromOutreach ? 'Stakeholder, contact and direction from the call outreach' : 'No call outreach to fill from yet'}
                onClick={fillFromOutreach}
              >
                Fill call details from outreach
              </Link>
            )}
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Type</span>
            <RadioRow items={CALL_TYPES} value={callType} onChange={setCallType} disabled={readOnly} />
          </div>
          {schema.contactOutcomes.length > 0 && (
            <Select
              label="Contact outcome"
              portal
              options={[{ value: REACHED, label: `Reached the ${stakeholder.toLowerCase()}` }, ...schema.contactOutcomes.map(o => ({ value: o, label: o }))]}
              value={contactOutcome}
              onValueChange={setContactOutcome}
              disabled={readOnly}
            />
          )}
        </div>
        )}
      </div>

      {reached && schema.measureOutcomes.length > 0 && (
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <span className={styles.cardTitle}>{stakeholder} Questions</span>
            {gaps.length > 1 && !readOnly && (
              <Switch checked={sameForAll} onChange={toggleSame} label="Same answer for all gaps" />
            )}
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.qTable}>
              <thead>
                <tr>
                  <th className={styles.qCol}>Question</th>
                  {gaps.map(g => <th key={g.code} title={MEASURE_NAMES[g.code]}>{g.code}</th>)}
                </tr>
              </thead>
              <tbody>
                {schema.measureOutcomes.map(item => (
                  <tr key={item.label}>
                    <td className={styles.qCol}>{item.label}</td>
                    {gaps.map(g => (
                      <td key={g.code}>
                        <AnswerCell item={item} gap={g} value={picks[g.code]?.[item.label]} onChange={v => setPick(g.code, item.label, v)} disabled={readOnly} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* The call note sits on the pane, outside the cards. */}
      {(!readOnly || note) && (
      <div className={styles.noteSection}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Call Note</span>
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder={readOnly ? 'No note' : 'One note for the whole call'} aria-label="Call note" disabled={readOnly} />
        </div>
        {!readOnly && (
          <div className={styles.callFoot}>
            {onAddToOutreach ? (
              <label className={styles.checkRow}>
                <Checkbox checked={addToOutreach} onCheckedChange={v => setAddToOutreach(!!v)} />
                <span>Add the summary to the outreach note on save</span>
              </label>
            ) : (
              <span className={styles.muted}>Saving logs this assessment in the activity log as one action across all gaps.</span>
            )}
            {!onLockAction && <Button disabled={!canSave} onClick={handleSave}>Save</Button>}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
