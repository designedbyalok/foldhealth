import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Select } from '../../../../../../components/Select/Select';
import { Input } from '../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../../components/Button/Button';
import { Link } from '../../../../../../components/Link/Link';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { Icon } from '../../../../../../components/Icon/Icon';
import { Tooltip } from '../../../../../../components/Tooltip/Tooltip';
import { CloseIcon } from '../../../../../../components/Icon/CloseIcon';
import { AddIconMinimalist } from '../../../../../../components/Icon/AddIconMinimalist';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { RingEmptyState } from '../../../../../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../../../../../store/useAppStore';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { MedicationSelect } from './MedicationSelect';
import { StopMedicationDialog } from './StopMedicationDialog';
import { MEDICATION_STOP_REASONS } from './medicationStopReasons';
import { todayIso, toIsoDate, formatClinicalDate } from '../../../../../../lib/clinicalDates';
import { CollapsibleContent } from '../../../../../../components/Collapsible/Collapsible';
import styles from '../AddProblemsDrawer/AddProblemsDrawer.module.css';

// `Stopped` is what Medication Reconciliation writes to this same table, so
// the drawer speaks the same vocabulary rather than inventing "Historical".
const STATUS_OPTIONS = ['Active', 'Stopped'].map(v => ({ value: v, label: v }));
const STOP_REASON_OPTIONS = MEDICATION_STOP_REASONS.map(v => ({ value: v, label: v }));


function MedicationRow({ med, onStatusChange, onEdit, dimmed }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const meta = [med.start ? `Started: ${formatClinicalDate(med.start)}` : '', med.sig].filter(Boolean);
  // Why a medication was stopped rides inside the status trigger, so the
  // reason sits with the state it explains rather than in the meta line.
  const statusOptions = useMemo(() => (med.stopReason
    ? STATUS_OPTIONS.map(o => (o.value !== 'Stopped' ? o : {
      ...o,
      triggerLabel: (
        <span className={styles.statusWithInfo}>
          Stopped
          <Tooltip label={`Reason: ${med.stopReason}`}>
            <span className={styles.stopInfo} aria-label={`Reason for stopping: ${med.stopReason}`}>
              <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-300)" />
            </span>
          </Tooltip>
        </span>
      ),
    }))
    : STATUS_OPTIONS), [med.stopReason]);
  return (
    <div className={[styles.row, dimmed ? styles.dimmed : ''].filter(Boolean).join(' ')}>
      <div className={styles.rowTop}>
        <div className={styles.rowMain}>
          <span className={styles.rowTitle}>{med.name}</span>
          <span className={styles.rowMeta}>
            {meta.map((part, i) => (
              <span key={part}>
                {i > 0 && <span className={styles.dot} aria-hidden="true">•</span>}
                {part}
              </span>
            ))}
            {med.note && (
              <>
                {meta.length > 0 && <span className={styles.dot} aria-hidden="true">•</span>}
                <Link
                  variant="secondary"
                  className={styles.viewNote}
                  onClick={() => setNoteOpen(v => !v)}
                >
                  View Note
                  <DownChevronIcon size={12} color="currentColor" className={noteOpen ? styles.chevronOpen : undefined} />
                </Link>
              </>
            )}
          </span>
        </div>
        <Select
          portal
          options={statusOptions}
          value={med.status || 'Active'}
          onValueChange={v => onStatusChange(med, v)}
          className={styles.statusSelect}
        />
        <span className={styles.rowDivider} aria-hidden="true" />
        <ActionButton
          icon="solar:pen-linear"
          size="sm"
          tooltip="Edit"
          aria-label={`Edit ${med.name}`}
          onClick={() => onEdit(med)}
        />
      </div>
      {med.note && (
        <CollapsibleContent open={noteOpen}>
          <p className={styles.rowNote}><span className={styles.rowNoteLabel}>Note:</span> {med.note}</p>
        </CollapsibleContent>
      )}
    </div>
  );
}

/**
 * The picked medication, before it joins the list: when it starts, how it is
 * taken, and, once it is stopped, when and why.
 */
function MedicationDraft({ title, eyebrow, initial, onSave, onCancel }) {
  const [status, setStatus] = useState(initial?.status || 'Active');
  const [start, setStart] = useState(initial?.start || todayIso());
  const [stop, setStop] = useState(initial?.stop || '');
  const [stopReason, setStopReason] = useState(initial?.stopReason || '');
  const [sig, setSig] = useState(initial?.sig || '');
  // Optional; together they tell the Overview when a refill is due.
  const [lastFilledOn, setLastFilledOn] = useState(initial?.lastFilledOn || '');
  const [daysSupply, setDaysSupply] = useState(initial?.daysSupply ?? '');
  const [note, setNote] = useState(initial?.note || '');
  const [noteOpen, setNoteOpen] = useState(!!initial?.note);
  const [saving, setSaving] = useState(false);
  const stopped = status === 'Stopped';
  // A medication cannot stop before it started.
  const stopTooEarly = !!(stopped && stop && start && stop < start);
  // The design ships Save disabled until the mandatory fields are filled; a
  // stopped medication also needs its stop date and reason.
  const canSave = !!status && !!start && !!sig.trim()
    && (!stopped || (!!stop && !!stopReason))
    && !stopTooEarly;

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        name: title,
        status,
        start,
        sig: sig.trim(),
        note: note.trim(),
        // A medication that is running has no stop date or reason to record.
        stop: stopped ? stop : '',
        stopReason: stopped ? stopReason : '',
        lastFilledOn: stopped ? '' : lastFilledOn,
        daysSupply: !stopped && Number(daysSupply) > 0 ? Math.round(Number(daysSupply)) : null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.draft}>
      <div className={styles.draftHead}>
        {eyebrow && <span className={styles.draftEyebrow}>{eyebrow}</span>}
        <span className={styles.draftTitle}>{title}</span>
      </div>
      <div className={[styles.draftFields, styles.draftFieldsPair].join(' ')}>
        <Select portal label="Status" required options={STATUS_OPTIONS} value={status} onValueChange={setStatus} />
        <Input label="Start Date" required type="date" value={start} onChange={e => setStart(e.target.value)} />
        {stopped && (
          <>
            <Input
              label="Stop Date"
              required
              type="date"
              value={stop}
              min={start || undefined}
              onChange={e => setStop(e.target.value)}
              errorText={stopTooEarly ? 'Stop date cannot be before the start date' : undefined}
            />
            <Select
              portal
              label="Reason for Stopping"
              required
              options={STOP_REASON_OPTIONS}
              value={stopReason}
              onValueChange={setStopReason}
              placeholder="Select a reason"
            />
          </>
        )}
      </div>
      <Input label="Sig" required value={sig} onChange={e => setSig(e.target.value)} placeholder="Enter Sig" />
      {!stopped && (
        <div className={[styles.draftFields, styles.draftFieldsPair].join(' ')}>
          <Input label="Last Filled" type="date" value={lastFilledOn} min={start || undefined} onChange={e => setLastFilledOn(e.target.value)} />
          <Input label="Days Supply" type="number" min={1} value={daysSupply} onChange={e => setDaysSupply(e.target.value)} placeholder="e.g. 30" />
        </div>
      )}
      {!noteOpen && (
        <Link className={styles.draftAddNote} onClick={() => setNoteOpen(true)}>
          <AddIconMinimalist size={14} color="var(--primary-300)" />
          Add Note
        </Link>
      )}
      {noteOpen && (
        <div className={styles.draftNote}>
          <div className={styles.draftNoteHead}>
            <span className={styles.draftNoteLabel}>Note</span>
            <ActionButton size="sm" tooltip="Discard note" aria-label="Discard note" onClick={() => { setNote(''); setNoteOpen(false); }}>
              <CloseIcon size={14} color="var(--neutral-300)" />
            </ActionButton>
          </div>
          <Textarea rows={3} placeholder="Add note" value={note} onChange={e => setNote(e.target.value)} />
        </div>
      )}
      <div className={styles.draftActions}>
        <Button disabled={saving || !canSave} onClick={save}>Save</Button>
        <span className={styles.draftDivider} aria-hidden="true" />
        <Link variant="secondary" onClick={onCancel}>Cancel</Link>
      </div>
    </div>
  );
}

const Section = forwardRef(function Section({ title, count, open, onToggle, children, dimmed }, ref) {
  return (
    <div className={styles.section} ref={ref}>
      <button
        type="button"
        className={[styles.sectionHead, dimmed ? styles.dimmed : ''].filter(Boolean).join(' ')} onClick={onToggle} aria-expanded={open}>
        <span className={styles.sectionTitle}>{title}</span>
        {count > 0 && <Badge size="sm" label={String(count)} className={styles.countBadge} />}
        <DownChevronIcon size={14} className={open ? styles.chevron : styles.chevronClosed} />
      </button>
      <div className={[styles.sectionBody, open ? styles.sectionBodyOpen : ''].filter(Boolean).join(' ')}>
        <div className={styles.sectionBodyInner}>{children}</div>
      </div>
    </div>
  );
});

/**
 * Add Medications: the PAMI/Hx Medications section's `+` opens this.
 * Mirrors Add Problems: search at the top, the patient's list below, split by
 * status, with add and edit sharing one card.
 */
export function AddMedicationsDrawer({ patientId, focus, onClose }) {
  const storeMeds = useAppStore(s => (patientId ? s.patientMedications[patientId] : null));
  const meds = useMemo(() => storeMeds || [], [storeMeds]);
  const loadedFor = useAppStore(s => (patientId ? s.patientMedicationsLoadedFor[patientId] : false));
  const fetchPatientMedications = useAppStore(s => s.fetchPatientMedications);
  const addPatientMedication = useAppStore(s => s.addPatientMedication);
  const updatePatientMedication = useAppStore(s => s.updatePatientMedication);
  const showToast = useAppStore(s => s.showToast);
  const [activeOpen, setActiveOpen] = useState(true);
  const [stoppedOpen, setStoppedOpen] = useState(focus === 'stopped');
  const stoppedRef = useRef(null);

  useEffect(() => { if (patientId) fetchPatientMedications(patientId); }, [patientId, fetchPatientMedications]);

  const active = useMemo(() => meds.filter(m => (m.status || 'Active') !== 'Stopped'), [meds]);
  const stopped = useMemo(() => meds.filter(m => m.status === 'Stopped'), [meds]);
  const loading = !!patientId && !loadedFor;

  // Arriving from the section's "Stopped" link: open that section and
  // bring it into view once its rows have rendered.
  useEffect(() => {
    if (focus !== 'stopped' || loading) return undefined;
    const id = requestAnimationFrame(() => {
      stoppedRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [focus, loading]);

  const [draft, setDraft] = useState(null);
  const handlePick = (name) => {
    if (!name) return;
    if (meds.some(m => (m.name || '').trim().toLowerCase() === name.trim().toLowerCase())) {
      showToast?.('This medication is already on the list');
      return;
    }
    setDraft({ title: name });
  };

  const startEdit = (med) => setDraft({
    title: med.name,
    editing: med,
    initial: {
      status: med.status || 'Active',
      start: toIsoDate(med.start) || todayIso(),
      stop: toIsoDate(med.stop) || '',
      stopReason: med.stopReason || '',
      sig: med.sig || '',
      note: med.note || '',
      lastFilledOn: toIsoDate(med.lastFilledOn) || '',
      daysSupply: med.daysSupply ?? '',
    },
  });

  const saveDraft = async (values) => {
    const ok = draft?.editing
      ? await updatePatientMedication(patientId, draft.editing.id, values)
      : await addPatientMedication(patientId, values);
    if (ok) setDraft(null);
  };

  // Stopping needs a date and a reason, so the dropdown opens the dialog
  // rather than writing a stop with neither.
  const [stopping, setStopping] = useState(null);
  const handleStatusChange = async (med, status) => {
    if (status === (med.status || 'Active')) return;
    if (status === 'Stopped') { setStopping(med); return; }
    await updatePatientMedication(patientId, med.id, { status });
  };

  const confirmStop = async ({ stop, stopReason }) => {
    // What the row held before, so Undo can put it all back, the stop date
    // and reason as well as the status.
    const med = stopping;
    const before = { status: med.status || 'Active', stop: med.stop || '', stopReason: med.stopReason || '' };
    const ok = await updatePatientMedication(patientId, med.id, {
      status: 'Stopped', stop, stopReason,
    });
    setStopping(null);
    if (ok) {
      toast.success('Medication stopped successfully', {
        action: { label: 'Undo', onClick: () => updatePatientMedication(patientId, med.id, before) },
      });
    }
  };

  const renderRow = (m) => (draft?.editing?.id === m.id ? (
    <MedicationDraft
      key={m.id}
      eyebrow="Edit Medication"
      title={draft.title}
      initial={draft.initial}
      onSave={saveDraft}
      onCancel={() => setDraft(null)}
    />
  ) : (
    <MedicationRow key={m.id} med={m} onStatusChange={handleStatusChange} onEdit={startEdit} dimmed={!!draft?.editing} />
  ));

  return (
    <Drawer title="Add Medications" onClose={onClose}>
      <div className={styles.body}>
        <div className={[styles.addBlock, draft?.editing ? styles.dimmed : ''].filter(Boolean).join(' ')}>
          <span className={styles.addLabel}>Add New Medications</span>
          <MedicationSelect
            leadingIcon="solar:magnifer-linear"
            value={draft?.editing ? '' : (draft?.title || '')}
            onChange={handlePick}
          />
        </div>

        {draft && !draft.editing && (
          <MedicationDraft
            key={draft.title}
            title={draft.title}
            onSave={saveDraft}
            onCancel={() => setDraft(null)}
          />
        )}

        {loading ? (
          <CardSkeleton rows={3} />
        ) : (
          <div className={[styles.list, draft && !draft.editing ? styles.listDimmed : ''].filter(Boolean).join(' ')}>
            <Section
              dimmed={!!draft?.editing}
              title="Active Medications"
              count={active.length}
              open={activeOpen}
              onToggle={() => setActiveOpen(v => !v)}
            >
              {active.length === 0 ? (
                <div className={styles.emptyCard}>
                  <RingEmptyState icon="solar:pill-linear" label="No Active Medications" iconSize={31} />
                </div>
              ) : active.map(m => renderRow(m))}
            </Section>

            {stopped.length > 0 && (
              <Section
                dimmed={!!draft?.editing}
                ref={stoppedRef}
                title="Stopped Medications"
                count={stopped.length}
                open={stoppedOpen}
                onToggle={() => setStoppedOpen(v => !v)}
              >
                {stopped.map(m => renderRow(m))}
              </Section>
            )}
          </div>
        )}
      </div>
      {stopping && (
        <StopMedicationDialog
          medication={stopping}
          onConfirm={confirmStop}
          onCancel={() => setStopping(null)}
        />
      )}
    </Drawer>
  );
}
