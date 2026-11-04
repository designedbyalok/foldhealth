import { Fragment } from 'react';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Select } from '../../../components/Select/Select';
import { Switch } from '../../../components/Switch/Switch';
import { BARRIERS, INTERVENTIONS } from '../adherencePicklists';
import { MEASURE_NAMES, medLabel } from '../pharmacyWorklist.utils';
import { usePharmacyProgramMember } from './usePharmacyProgramMember';
import { EMPTY, activeMeds, latestFor, useBarrierForm } from './useBarrierForm';
import styles from './PharmacyBarrierStep.module.css';

// Barrier & Intervention step of the Pharmacy program. Each gap's fields start
// filled from its latest log entry (this step or Outreach). A gap is logged
// as a whole, or with "Set per medication" one drug at a time; saving logs a
// new entry for just the gaps that changed. Gaps are recorded separately (a
// cost barrier on MAD's brand copay doesn't imply one on MAC). A host that
// passes `form` (from useBarrierForm) owns Save, and the step drops its own.
export function PharmacyBarrierStep({ member: memberProp, form: hostForm }) {
  const fromProfile = usePharmacyProgramMember();
  const member = memberProp || fromProfile;
  const ownForm = useBarrierForm(hostForm ? null : member);
  const { measures, stateOf, patchGap, patchMed, togglePerMed, changed, note, setNote, discard, save } = hostForm || ownForm;

  if (!member) {
    return (
      <div className={styles.empty}>
        <Icon name="solar:pills-linear" size={40} color="var(--neutral-200)" />
        <p>No MAC, MAD or MAH measures on file for this member.</p>
      </div>
    );
  }

  // Only the barriers this member has (logged on any gap, on the worklist, or
  // as a medication's non-adherence reason) lead the list; the rest of the
  // master list follows.
  const memberBarriers = new Set([
    ...(member.interventionLog || []).flatMap(e => Object.values(e.measures).flatMap(r => r.barriers)),
    ...(member.barrier ? [member.barrier] : []),
    ...measures.flatMap(x => x.medications.map(d => d.nonAdherenceReason).filter(Boolean)),
  ]);
  const barrierOptions = [...BARRIERS.filter(b => memberBarriers.has(b)), ...BARRIERS.filter(b => !memberBarriers.has(b))]
    .map(b => ({ value: b, label: b }));
  const interventionOptions = INTERVENTIONS.map(v => ({ value: v, label: v }));
  const pickers = (value, onChange, labelled) => (
    <>
      <Select
        label={labelled ? 'Barriers' : undefined}
        multiple badges searchable portal
        options={barrierOptions}
        value={value.barriers}
        placeholder="Add barriers"
        onValueChange={v => onChange({ barriers: v })}
      />
      <Select
        label={labelled ? 'Interventions' : undefined}
        multiple badges searchable portal
        options={interventionOptions}
        value={value.interventions}
        placeholder="Add interventions"
        onValueChange={v => onChange({ interventions: v })}
      />
    </>
  );

  return (
    <div className={styles.wrap}>
      {measures.map(x => {
        const s = stateOf(x);
        const latest = latestFor(member.interventionLog, x.code);
        const dirty = changed.includes(x);
        const meds = activeMeds(x);
        return (
          <section key={x.code} className={styles.gap}>
            <div className={styles.gapHead}>
              <span className={styles.gapTitleWrap}>
                <span className={styles.gapTitle}>{x.code} ({MEASURE_NAMES[x.code] || x.code})</span>
                <span className={dirty ? styles.asOfDirty : styles.asOf}>
                  {dirty ? 'Unsaved changes' : latest ? `Last logged ${latest.date}${latest.source ? ` · ${latest.source}` : ''}` : 'Nothing logged yet'}
                </span>
              </span>
              {meds.length > 1 && <Switch checked={s.perMed} onChange={on => togglePerMed(x, on)} label="Set per medication" />}
            </div>
            {s.perMed ? (
              <div className={styles.medGrid}>
                <span className={styles.colHead}>Medication</span>
                <span className={styles.colHead}>Barriers</span>
                <span className={styles.colHead}>Interventions</span>
                {meds.map(d => (
                  <Fragment key={d.id}>
                    <span className={styles.medName}>{medLabel(d)}</span>
                    {pickers(s.meds[d.id] || EMPTY, p => patchMed(x, d.id, p), false)}
                  </Fragment>
                ))}
              </div>
            ) : (
              <div className={styles.fields}>
                {pickers(s.gap, p => patchGap(x, p), true)}
                {meds.length > 0 && <span className={styles.appliesTo}>Applies to {meds.map(medLabel).join(', ')}</span>}
              </div>
            )}
          </section>
        );
      })}

      <section className={styles.gap}>
        <div className={styles.noteBody}>
          <span className={styles.noteLabel}>Note</span>
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="One note for the whole call" aria-label="Call note" />
          {!hostForm && (
            <div className={styles.foot}>
              {changed.length > 0 && <Button variant="ghost" onClick={discard}>Discard</Button>}
              <Button disabled={!changed.length} onClick={save}>
                {changed.length ? `Save (${changed.map(x => x.code).join(', ')})` : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
