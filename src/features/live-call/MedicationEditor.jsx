import { useState } from 'react';
import { Badge } from '../../components/Badge/Badge';
import { Button } from '../../components/Button/Button';
import { DatePicker } from '../../components/DatePicker/DatePicker';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { Textarea } from '../../components/Textarea/Textarea';
import { useLiveCall } from './useLiveCall';
import { STOP_REASONS, fillCm, medBadge, medDraftError, medMentions, medRecord, speakerOf, supplyOf } from './liveCallModel';
import { jumpToLine } from './jumpToLine';
import styles from './LiveCallOverlay.module.css';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Right rail: review or update one medication from the call brief (same fields as the PAMI medication editor). */
export function MedicationEditor({ script, med, cmName, showToast }) {
  const session = useLiveCall();
  const saved = session.medEdits[med.n];
  const [today] = useState(todayIso);
  const [draft, setDraft] = useState(() => medRecord(med, saved));
  const [noteOpen, setNoteOpen] = useState(!!draft.note);
  const set = patch => setDraft(d => ({ ...d, ...patch }));
  const stopped = draft.status === 'Stopped';
  const error = medDraftError(draft);
  const supply = supplyOf(draft, today);
  const badge = medBadge(med, saved, today);
  const mentions = medMentions(script, session.consent === 'yes' ? session.shown : 0, med);

  const save = () => {
    if (error) return;
    session.saveMed(med.n, { ...draft, days: draft.days === '' ? '' : Number(draft.days) });
    showToast(`${med.n} ${stopped ? `stopped · ${draft.reason}` : 'updated'} · saved with the call at wrap-up`);
  };

  return (
    <div className={styles.medEditor}>
      <div className={styles.itemsHead}>
        <div className={styles.itemsTitleRow}>
          <Button variant="ghost" size="sm" leadingIcon="solar:arrow-left-linear" onClick={session.closeMed}>Action Items</Button>
          <span className={styles.spacer} />
          <span className={styles.count}>Medication</span>
        </div>
      </div>

      <div className={styles.medBody}>
        <div className={styles.medHead}>
          <span className={styles.medHeadRow}>
            <span className={styles.medTitle}>{med.n}</span>
            <Badge size="sm" tone={badge.tone} label={badge.label} />
          </span>
          {draft.by && <span className={styles.medSig}>{draft.by}</span>}
          {supply && <span className={supply.left <= 7 ? styles.supplyLow : styles.medSig}>{supply.text}</span>}
        </div>

        <div className={styles.formGrid}>
          <Select
            label="Status"
            required
            options={[{ value: 'Active', label: 'Active' }, { value: 'Stopped', label: 'Stopped' }]}
            value={draft.status}
            onValueChange={v => set({ status: v, stop: v === 'Stopped' && !draft.stop ? today : draft.stop })}
          />
          <DatePicker label="Start Date" required value={draft.start} onSelect={v => set({ start: v })} />
          {stopped && (
            <>
              <DatePicker label="Stop Date" required value={draft.stop} onSelect={v => set({ stop: v })} />
              <Select
                label="Reason for Stopping"
                required
                placeholder="Select a reason"
                options={STOP_REASONS.map(r => ({ value: r, label: r }))}
                value={draft.reason}
                onValueChange={v => set({ reason: v })}
              />
            </>
          )}
        </div>

        <Input label="Sig" required placeholder="Enter sig" value={draft.sig} onChange={e => set({ sig: e.target.value })} />

        {!stopped && (
          <div className={styles.formGrid}>
            <DatePicker label="Last Filled" value={draft.last} onSelect={v => set({ last: v })} />
            <Input label="Days Supply" type="number" min="1" placeholder="e.g. 30" value={String(draft.days ?? '')} onChange={e => set({ days: e.target.value })} />
          </div>
        )}

        {noteOpen ? (
          <Textarea rows={3} aria-label="Note" placeholder="Add note" value={draft.note} onChange={e => set({ note: e.target.value })} />
        ) : (
          <span><Button variant="ghost" size="sm" leadingIcon="solar:add-circle-linear" onClick={() => setNoteOpen(true)}>Add Note</Button></span>
        )}

        {error && <span className={styles.formError}>{error}</span>}

        <div className={styles.itemActions}>
          <Button size="sm" disabled={!!error} onClick={save}>Save</Button>
          <Button size="sm" variant="ghost" onClick={session.closeMed}>Cancel</Button>
          <span className={styles.spacer} />
          {!stopped && (
            <Button size="sm" variant="outline" onClick={() => showToast(`Refill request for ${med.n} sent to ${draft.by && draft.by.startsWith('Dr.') ? draft.by : 'the prescriber'}`)}>
              Request Refill
            </Button>
          )}
        </div>

        {mentions.length > 0 && (
          <div className={styles.briefSection}>
            <span className={styles.sectionLabel}>Mentioned on This Call</span>
            {mentions.map(l => (
              <button key={l.i} type="button" className={styles.quote} onClick={() => jumpToLine(l.i)} title="Jump to this moment in the transcript">
                <span>“{fillCm(l.text, cmName)}” <span className={styles.quoteBy}>{speakerOf(script, l.who, cmName).name.split(' ')[0]} · {l.t}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
