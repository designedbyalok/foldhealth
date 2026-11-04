import { forwardRef, useEffect, useRef, useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Select } from '../../../../../../components/Select/Select';
import { Input } from '../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../../components/Button/Button';
import { Link } from '../../../../../../components/Link/Link';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { CloseIcon } from '../../../../../../components/Icon/CloseIcon';
import { AddIconMinimalist } from '../../../../../../components/Icon/AddIconMinimalist';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { RingEmptyState } from '../../../../../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../../../../../store/useAppStore';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { ImmunizationSelect } from './ImmunizationSelect';
import { todayIso, toIsoDate, formatClinicalDate } from '../../../../../../lib/clinicalDates';
import { Collapse } from '../../../../../../components/Collapse/Collapse';
import styles from '../AddProblemsDrawer/AddProblemsDrawer.module.css';

// An immunization is either part of the current schedule or a finished
// course; Figma 2628:364616 splits the list on exactly that.
const STATUS_OPTIONS = ['Active', 'Completed'].map(v => ({ value: v, label: v }));



function ImmunizationRow({ immunization, onStatusChange, onEdit, dimmed }) {
  const [noteOpen, setNoteOpen] = useState(false);
  // Quantity and units are one measurement: "10 ml", not "10 Dose • ml".
  const dose = [immunization.doseQuantity, immunization.doseUnits].filter(Boolean).join(' ');
  const meta = [
    immunization.dateAdministered
      ? `Date Administered: ${formatClinicalDate(immunization.dateAdministered)}` : '',
    dose,
  ].filter(Boolean);

  return (
    <div className={[styles.row, dimmed ? styles.dimmed : ''].filter(Boolean).join(' ')}>
      <div className={styles.rowTop}>
        <div className={styles.rowMain}>
          <span className={styles.rowTitle}>{immunization.title}</span>
          <span className={styles.rowMeta}>
            {meta.map((part, i) => (
              <span key={part}>
                {i > 0 && <span className={styles.dot} aria-hidden="true">•</span>}
                {part}
              </span>
            ))}
            {immunization.note && (
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
          options={STATUS_OPTIONS}
          value={immunization.status || 'Active'}
          onValueChange={v => onStatusChange(immunization, v)}
          className={styles.statusSelect}
        />
        <span className={styles.rowDivider} aria-hidden="true" />
        <ActionButton
          icon="solar:pen-linear"
          size="sm"
          tooltip="Edit"
          aria-label={`Edit ${immunization.title}`}
          onClick={() => onEdit(immunization)}
        />
      </div>
      {immunization.note && (
        <Collapse open={noteOpen}>
          <p className={styles.rowNote}>
            <span className={styles.rowNoteLabel}>Note:</span> {immunization.note}
          </p>
        </Collapse>
      )}
    </div>
  );
}

/**
 * The picked vaccine before it joins the list: when it was given, whether the
 * course is still running, and the dose. Figma P360 2628:364616.
 */
function ImmunizationDraft({ title, eyebrow, initial, onSave, onCancel }) {
  const [administered, setAdministered] = useState(initial?.administered || todayIso());
  const [status, setStatus] = useState(initial?.status || 'Active');
  const [doseQuantity, setDoseQuantity] = useState(initial?.doseQuantity || '');
  const [doseUnits, setDoseUnits] = useState(initial?.doseUnits || '');
  const [note, setNote] = useState(initial?.note || '');
  const [noteOpen, setNoteOpen] = useState(!!initial?.note);
  const [saving, setSaving] = useState(false);

  // A vaccine cannot have been given in the future.
  const administeredInFuture = !!(administered && administered > todayIso());
  const canSave = !!administered && !!status && !administeredInFuture;

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        title,
        dateAdministered: administered,
        status,
        doseQuantity: doseQuantity.trim(),
        doseUnits: doseUnits.trim(),
        note: note.trim(),
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
        <Input
          label="Date Administered"
          required
          type="date"
          value={administered}
          max={todayIso()}
          onChange={e => setAdministered(e.target.value)}
          errorText={administeredInFuture ? 'Date administered cannot be in the future' : undefined}
        />
        <Select portal label="Status" required options={STATUS_OPTIONS} value={status} onValueChange={setStatus} />
        <Input
          label="Dose Quantity"
          value={doseQuantity}
          onChange={e => setDoseQuantity(e.target.value)}
          placeholder="1"
        />
        <Input
          label="Dose Units"
          value={doseUnits}
          onChange={e => setDoseUnits(e.target.value)}
          placeholder="ml"
        />
      </div>
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
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <span className={styles.draftDivider} aria-hidden="true" />
        <Button disabled={!canSave || saving} onClick={save}>Save</Button>
      </div>
    </div>
  );
}

const Section = forwardRef(function Section({ title, count, open, onToggle, children, dimmed }, ref) {
  return (
    <div className={styles.section} ref={ref}>
      <button
        type="button"
        className={[styles.sectionHead, dimmed ? styles.dimmed : ''].filter(Boolean).join(' ')}
        onClick={onToggle}
        aria-expanded={open}
      >
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
 * Add Immunizations: the PAMI/Hx immunization list, editable in place.
 * Vaccines are picked from CVX, so each row carries its code.
 *
 * @param {string} props.patientId
 * @param {'completed'} [props.focus] – opens and scrolls to the closed section
 * @param {function} props.onClose
 */
export function AddImmunizationsDrawer({ patientId, focus, onClose }) {
  const immunizations = useAppStore(s => (patientId ? s.patientImmunizations[patientId] : null));
  const loadedFor = useAppStore(s => (patientId ? s.patientImmunizationsLoadedFor[patientId] : false));
  const fetchPatientImmunizations = useAppStore(s => s.fetchPatientImmunizations);
  const addPatientImmunization = useAppStore(s => s.addPatientImmunization);
  const updatePatientImmunization = useAppStore(s => s.updatePatientImmunization);
  const showToast = useAppStore(s => s.showToast);

  const [activeOpen, setActiveOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(focus === 'completed');
  const completedRef = useRef(null);
  // A draft is either a freshly picked vaccine or an existing row being
  // edited; `editing` tells the two apart when it saves.
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (patientId) fetchPatientImmunizations(patientId);
  }, [patientId, fetchPatientImmunizations]);

  const loading = !loadedFor;
  const list = immunizations || [];
  const active = list.filter(i => (i.status || 'Active') !== 'Completed');
  const completed = list.filter(i => i.status === 'Completed');

  useEffect(() => {
    if (focus !== 'completed' || loading) return undefined;
    const id = requestAnimationFrame(() => {
      completedRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [focus, loading]);

  // A vaccine already on the list shouldn't be silently added twice; match by
  // CVX code, falling back to the name for rows recorded without one.
  const startDraft = (concept) => {
    const onList = list.some(i => (i.code && i.code === concept.code)
      || (i.title || '').trim().toLowerCase() === (concept.display || '').trim().toLowerCase());
    if (onList) { showToast?.('This immunization is already on the list'); return; }
    setDraft({
      title: concept.display,
      conceptKey: concept.code,
      concept: { code: concept.code, codeSystem: concept.system },
    });
  };

  const startEdit = (immunization) => setDraft({
    title: immunization.title,
    editing: immunization,
    concept: { code: immunization.code || '', codeSystem: immunization.codeSystem || '' },
    initial: {
      administered: toIsoDate(immunization.dateAdministered) || todayIso(),
      status: immunization.status || 'Active',
      doseQuantity: immunization.doseQuantity || '',
      doseUnits: immunization.doseUnits || '',
      note: immunization.note || '',
    },
  });

  const saveDraft = async (values) => {
    const payload = { ...values, ...(draft?.concept || {}) };
    const ok = draft?.editing
      ? await updatePatientImmunization(patientId, draft.editing.id, payload)
      : await addPatientImmunization(patientId, payload);
    if (ok) setDraft(null);
  };

  const handleStatusChange = async (immunization, status) => {
    const prev = immunization.status || 'Active';
    if (status === prev) return;
    const ok = await updatePatientImmunization(patientId, immunization.id, { status });
    if (ok && status === 'Completed') {
      toast.success('Immunization marked as completed', {
        action: { label: 'Undo', onClick: () => updatePatientImmunization(patientId, immunization.id, { status: prev }) },
      });
    }
  };

  const renderRow = (i) => (draft?.editing?.id === i.id ? (
    <ImmunizationDraft
      key={i.id}
      eyebrow="Edit Immunization"
      title={draft.title}
      initial={draft.initial}
      onSave={saveDraft}
      onCancel={() => setDraft(null)}
    />
  ) : (
    <ImmunizationRow
      key={i.id}
      immunization={i}
      onStatusChange={handleStatusChange}
      onEdit={startEdit}
      dimmed={!!draft?.editing}
    />
  ));

  return (
    <Drawer title="Add Immunizations" onClose={onClose}>
      <div className={styles.body}>
        <div className={[styles.addBlock, draft?.editing ? styles.dimmed : ''].filter(Boolean).join(' ')}>
          <span className={styles.addLabel}>Add New Immunizations</span>
          <ImmunizationSelect
            leadingIcon="solar:magnifer-linear"
            value={draft?.editing ? '' : (draft?.conceptKey || '')}
            onChange={startDraft}
          />
        </div>

        {draft && !draft.editing && (
          <ImmunizationDraft
            key={draft.conceptKey}
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
              title="Active Immunizations"
              count={active.length}
              open={activeOpen}
              onToggle={() => setActiveOpen(v => !v)}
            >
              {active.length === 0 ? (
                <div className={styles.emptyCard}>
                  <RingEmptyState icon="solar:syringe-linear" label="No Active Immunizations" iconSize={31} />
                </div>
              ) : active.map(i => renderRow(i))}
            </Section>

            {completed.length > 0 && (
              <Section
                dimmed={!!draft?.editing}
                ref={completedRef}
                title="Completed Immunizations"
                count={completed.length}
                open={completedOpen}
                onToggle={() => setCompletedOpen(v => !v)}
              >
                {completed.map(i => renderRow(i))}
              </Section>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
