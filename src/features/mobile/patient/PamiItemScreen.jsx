import { useEffect, useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { Spinner } from '../../../components/Spinner/Spinner';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { todayIso } from '../../../lib/clinicalDates';
import { ALLERGY_REACTIONS, REACTION_SYSTEM } from '../../../reference-data/allergyReactions';
import { MEDICATION_STOP_REASONS } from '../../patient/left-panel/tabs/pami-hx/AddMedicationsDrawer/medicationStopReasons';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen, PickerField } from './FormScreen';
import { PAMI_KINDS } from './pamiKinds';
import styles from './patientForm.module.css';
import own from './PamiItemScreen.module.css';

const opts = (list) => list.map(v => ({ value: v, label: v }));
const OPTIONS = {
  medStatus: opts(['Active', 'Stopped']),
  stopReason: opts(MEDICATION_STOP_REASONS),
  problemStatus: opts(['Active', 'Controlled', 'Resolved']),
  severity: opts(['Mild', 'Moderate', 'Severe']),
  problemType: opts(['Chronic', 'Acute']),
  reactionType: opts(['Adverse Reaction', 'Allergy', 'Intolerance']),
  criticality: opts(['High', 'Low', 'Unable to Assess']),
  immunizationStatus: opts(['Active', 'Completed']),
};
const EMPTY = [];

/**
 * Add or edit one PAMI entry (medication, problem, allergy, immunization).
 * New entries start with the same lookup the desktop drawer searches;
 * picking one opens the form with the drawer's fields and required rules.
 * Editing opens the form straight away, with Remove where the desktop
 * offers it (problems, allergies, immunizations). `preset` overrides form
 * values, e.g. { status: 'Stopped' } to stop a medication.
 */
export function PamiItemScreen({ patientId, kind, itemId, preset }) {
  const cfg = PAMI_KINDS[kind];
  const { pop } = useMobileNav();
  const rows = useAppStore(s => s[cfg.listKey]?.[patientId] || EMPTY);
  const fetchList = useAppStore(s => s[cfg.fetch]);
  const add = useAppStore(s => s[cfg.add]);
  const update = useAppStore(s => s[cfg.update]);
  const remove = useAppStore(s => (cfg.remove ? s[cfg.remove] : null));
  const editing = itemId != null ? rows.find(r => String(r.id) === String(itemId)) : null;
  const [picked, setPicked] = useState(null); // { title, concept }

  useEffect(() => { if (patientId != null) fetchList?.(patientId); }, [patientId, fetchList]);

  if (itemId != null && !editing) {
    return <FormScreen title={cfg.noun}><p className={styles.notice}>This entry is no longer on the list.</p></FormScreen>;
  }
  if (!editing && !picked) {
    return (
      <PamiSearch
        cfg={cfg}
        taken={rows.map(cfg.titleOf)}
        onPick={(hit) => setPicked({ title: hit.title, concept: hit.concept || null })}
      />
    );
  }

  const title = editing ? cfg.titleOf(editing) : picked.title;
  const concept = editing ? cfg.conceptOf?.(editing) : picked.concept;
  return (
    <PamiForm
      key={title}
      kind={kind}
      cfg={cfg}
      title={title}
      initial={{ ...cfg.initial(editing), ...(preset || {}) }}
      editing={!!editing}
      onSave={async (values) => {
        const payload = cfg.payload(title, values, concept, REACTION_SYSTEM);
        const ok = editing ? await update(patientId, editing.id, payload) : await add(patientId, payload);
        if (!ok) return;
        if (editing) toast.success(`${cfg.noun} updated`);
        else if (kind === 'medication') toast.success('Medication added successfully');
        pop();
      }}
      onRemove={editing && remove ? async () => {
        const ok = await remove(patientId, editing.id);
        if (ok) { toast.success(`${cfg.noun} removed`); pop(); }
      } : null}
    />
  );
}

/** Lookup step: type two letters, pick a coded concept. */
function PamiSearch({ cfg, taken, onPick }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);
  const term = query.trim();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (term.length < 2) { setHits([]); setLoading(false); return; }
      setLoading(true);
      try {
        setHits(await cfg.search(term, { signal: controller.signal }));
      } catch (err) {
        if (err.name !== 'AbortError') setHits([]);
      } finally {
        // Aborted means a newer search is queued: keep the spinner on (it was on) until it runs.
        setLoading(controller.signal.aborted);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, cfg]);

  const onList = new Set(taken.map(t => String(t || '').trim().toLowerCase()));
  const pick = (hit) => {
    if (onList.has(hit.title.trim().toLowerCase())) {
      toast.error(`This ${cfg.noun.toLowerCase()} is already on the list`);
      return;
    }
    onPick(hit);
  };

  return (
    <FormScreen title={`Add ${cfg.noun}`}>
      <Input
        size="lg"
        type="search"
        autoFocus
        leadingIcon="solar:magnifer-linear"
        placeholder={cfg.searchPlaceholder}
        aria-label={cfg.searchPlaceholder}
        enterKeyHint="search"
        value={query}
        onValueChange={setQuery}
      />
      {loading && <span className={own.loading}><Spinner size={20} /> Searching</span>}
      {!loading && term.length < 2 && <span className={styles.hint}>Type at least 2 characters to search.</span>}
      {!loading && term.length >= 2 && hits.length === 0 && <span className={styles.hint}>No matches for &ldquo;{term}&rdquo;.</span>}
      {hits.length > 0 && (
        <div className={own.hits} role="listbox" aria-label="Results">
          {hits.map(h => (
            <button key={h.key} type="button" role="option" aria-selected="false" className={own.hit} onClick={() => pick(h)}>
              <span className={own.hitText}>
                <span className={own.hitTitle}>{h.title}</span>
                {h.detail && <span className={own.hitDetail}>{h.detail}</span>}
              </span>
              <Icon name="solar:add-circle-linear" size={24} color="var(--primary-300)" />
            </button>
          ))}
        </div>
      )}
    </FormScreen>
  );
}

/** The drawer's draft card as a form. */
function PamiForm({ kind, cfg, title, initial, editing, onSave, onRemove }) {
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const set = (key) => (value) => setV(s => ({ ...s, [key]: value }));
  const today = todayIso();

  let canSave = true;
  let error = null;
  if (kind === 'medication') {
    const stopped = v.status === 'Stopped';
    const stopTooEarly = stopped && v.stop && v.start && v.stop < v.start;
    if (stopTooEarly) error = 'Stop date cannot be before the start date';
    canSave = !!v.status && !!v.start && !!v.sig.trim() && (!stopped || (!!v.stop && !!v.stopReason)) && !stopTooEarly;
  } else if (kind === 'allergy') {
    canSave = !!v.since && !!v.reactionType && !!v.criticality;
  } else if (kind === 'immunization') {
    const future = !!v.administered && v.administered > today;
    if (future) error = 'A vaccine cannot have been given in the future';
    canSave = !!v.administered && !!v.status && !future;
  }

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try { await onSave(v); } finally { setSaving(false); }
  };

  const toggleReaction = (r) => setV(s => {
    const has = s.reactions.some(x => x.code === r.code);
    return { ...s, reactions: has ? s.reactions.filter(x => x.code !== r.code) : [...s.reactions, { code: r.code, display: r.display, severity: 'Moderate' }] };
  });

  return (
    <FormScreen
      title={editing ? `Edit ${cfg.noun}` : `Add ${cfg.noun}`}
      subtitle={title}
      footer={(
        <>
          {onRemove && <Button size="lg" variant="soft" tone="danger" fullWidth onClick={() => setConfirmRemove(true)}>Remove</Button>}
          <Button size="lg" fullWidth disabled={!canSave || saving} loading={saving} onClick={save}>Save</Button>
        </>
      )}
    >
      {kind === 'medication' && (
        <>
          <PickerField label="Status" required options={OPTIONS.medStatus} value={v.status} onChange={set('status')} />
          <Input label="Start Date" required type="date" size="lg" value={v.start} onValueChange={set('start')} />
          {v.status === 'Stopped' && (
            <>
              <Input label="Stop Date" required type="date" size="lg" min={v.start || undefined} value={v.stop} onValueChange={set('stop')} errorText={error || undefined} />
              <PickerField label="Reason for Stopping" required options={OPTIONS.stopReason} value={v.stopReason} placeholder="Select a reason" onChange={set('stopReason')} />
            </>
          )}
          <Input label="Sig" required size="lg" placeholder="Enter Sig" enterKeyHint="next" value={v.sig} onValueChange={set('sig')} />
          {v.status !== 'Stopped' && (
            <div className={styles.pair}>
              <Input label="Last Filled" type="date" size="lg" min={v.start || undefined} value={v.lastFilledOn} onValueChange={set('lastFilledOn')} />
              <Input label="Days Supply" type="number" inputMode="numeric" size="lg" min={1} placeholder="e.g. 30" value={String(v.daysSupply ?? '')} onValueChange={set('daysSupply')} />
            </div>
          )}
        </>
      )}

      {kind === 'problem' && (
        <>
          <Input label="Since" type="date" size="lg" value={v.since} onValueChange={set('since')} />
          <PickerField label="Status" options={OPTIONS.problemStatus} value={v.status} onChange={set('status')} />
          <PickerField label="Severity" options={OPTIONS.severity} value={v.severity} onChange={set('severity')} />
          <PickerField label="Type" options={OPTIONS.problemType} value={v.type} onChange={set('type')} />
        </>
      )}

      {kind === 'allergy' && (
        <>
          <Input label="Since Date" required type="date" size="lg" value={v.since} onValueChange={set('since')} />
          <PickerField label="Reaction Type" required options={OPTIONS.reactionType} value={v.reactionType} onChange={set('reactionType')} />
          <PickerField label="Criticality" required options={OPTIONS.criticality} value={v.criticality} onChange={set('criticality')} />
          <FieldGroup label="Reactions">
            {v.reactions.map((r, i) => (
              <div key={r.code} className={own.reaction}>
                <span className={own.reactionName}>{r.display}</span>
                <PickerField
                  options={OPTIONS.severity.slice().reverse()}
                  value={r.severity}
                  onChange={(sev) => setV(s => ({ ...s, reactions: s.reactions.map((x, idx) => (idx === i ? { ...x, severity: sev } : x)) }))}
                />
                <button type="button" className={own.reactionRemove} aria-label={`Remove ${r.display}`} onClick={() => toggleReaction(r)}>
                  <Icon name="solar:close-circle-linear" size={24} color="currentColor" />
                </button>
              </div>
            ))}
            {v.reactions.length < ALLERGY_REACTIONS.length && (
              <Button size="lg" variant="outline" leadingIcon="custom:add" onClick={() => setReactionsOpen(true)}>Add Reaction</Button>
            )}
          </FieldGroup>
        </>
      )}

      {kind === 'immunization' && (
        <>
          <Input label="Date Administered" required type="date" size="lg" max={today} value={v.administered} onValueChange={set('administered')} errorText={error || undefined} />
          <PickerField label="Status" required options={OPTIONS.immunizationStatus} value={v.status} onChange={set('status')} />
          <div className={styles.pair}>
            <Input label="Dose" size="lg" inputMode="decimal" placeholder="e.g. 0.5" value={v.doseQuantity} onValueChange={set('doseQuantity')} />
            <Input label="Units" size="lg" placeholder="e.g. mL" value={v.doseUnits} onValueChange={set('doseUnits')} />
          </div>
        </>
      )}

      <Textarea title="Note" rows={3} placeholder="Add note (optional)" value={v.note} onValueChange={set('note')} />

      {reactionsOpen && (
        <BottomSheet title="Add Reaction" onClose={() => setReactionsOpen(false)}>
          <div className={own.hits}>
            {ALLERGY_REACTIONS.filter(r => !v.reactions.some(x => x.code === r.code)).map(r => (
              <button key={r.code} type="button" className={own.hit} onClick={() => { toggleReaction(r); setReactionsOpen(false); }}>
                <span className={own.hitTitle}>{r.display}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
      {confirmRemove && (
        <BottomSheet title={`Remove ${cfg.noun}?`} onClose={() => setConfirmRemove(false)}>
          <div className={styles.sheetForm}>
            <p className={styles.sheetText}>&ldquo;{title}&rdquo; will be removed from the patient&apos;s list.</p>
            <Button size="lg" fullWidth variant="soft" tone="danger" onClick={async () => { setConfirmRemove(false); await onRemove(); }}>Remove</Button>
          </div>
        </BottomSheet>
      )}
    </FormScreen>
  );
}
