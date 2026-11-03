import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Select } from '../../../../../../components/Select/Select';
import { Input } from '../../../../../../components/Input/Input';
import { Textarea } from '../../../../../../components/Textarea/Textarea';
import { Button } from '../../../../../../components/Button/Button';
import { Link } from '../../../../../../components/Link/Link';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { CloseIcon } from '../../../../../../components/Icon/CloseIcon';
import { AddIconMinimalist } from '../../../../../../components/Icon/AddIconMinimalist';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { ChronicConditionSelect } from '../../../../../settings/care-plan-library/shared/ChronicConditionSelect/ChronicConditionSelect';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { RingEmptyState } from '../../../../../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../../../../../store/useAppStore';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { todayIso, toIsoDate, formatClinicalDate } from '../../../../../../lib/clinicalDates';
import { Collapse } from '../../../../../../components/Collapse/Collapse';
import styles from './AddProblemsDrawer.module.css';

// Controlled is still a live problem, so only Resolved closes one out and the
// drawer's two sections split on that rather than on "not Active".
const CLOSED_STATUSES = new Set(['Resolved']);
const STATUS_OPTIONS = ['Active', 'Controlled', 'Resolved'].map(v => ({ value: v, label: v }));
const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe'].map(v => ({ value: v, label: v }));
const TYPE_OPTIONS = ['Chronic', 'Acute'].map(v => ({ value: v, label: v }));

// onset_label is a display string ("11/18/2024 (1 Year)"); the date input
// needs ISO, so the leading date is read back out and today stands in when it
// cannot be parsed.
function isoFromOnsetLabel(label) {
  const match = /^(\d{1,2}\/\d{1,2}\/\d{4})/.exec((label || '').trim());
  return (match && toIsoDate(match[1])) || todayIso();
}

/**
 * The picked condition, before it joins the list: onset, status, severity and
 * type, plus an optional note. Saving writes the problem; discarding drops it
 * and returns the picker.
 */
function ProblemDraft({ title, eyebrow, initial, onSave, onCancel }) {
  const [since, setSince] = useState(initial?.since || todayIso());
  const [status, setStatus] = useState(initial?.status || 'Active');
  const [severity, setSeverity] = useState(initial?.severity || 'Mild');
  const [type, setType] = useState(initial?.type || 'Chronic');
  const [note, setNote] = useState(initial?.note || '');
  const [noteOpen, setNoteOpen] = useState(!!initial?.note);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ title, since, status, severity, type, note: note.trim() });
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
      <div className={styles.draftFields}>
        <Input label="Since" type="date" value={since} onChange={e => setSince(e.target.value)} />
        <Select portal label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        <Select portal label="Severity" options={SEVERITY_OPTIONS} value={severity} onChange={setSeverity} />
        <Select portal label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
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
        <Button disabled={saving} onClick={save}>Save</Button>
        <span className={styles.draftDivider} aria-hidden="true" />
        <Link variant="secondary" onClick={onCancel}>Cancel</Link>
      </div>
    </div>
  );
}

function ProblemRow({ problem, onStatusChange, onEdit, dimmed }) {
  const meta = [problem.onsetLabel, problem.type, problem.severity].filter(Boolean);
  const [noteOpen, setNoteOpen] = useState(false);
  return (
    <div className={[styles.row, dimmed ? styles.dimmed : ''].filter(Boolean).join(' ')}>
      <div className={styles.rowTop}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>{problem.title}</span>
        <span className={styles.rowMeta}>
          {meta.map((part, i) => (
            <span key={part}>
              {i > 0 && <span className={styles.dot} aria-hidden="true">•</span>}
              {part}
            </span>
          ))}
          {problem.note && (
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
        value={problem.status || 'Active'}
        onChange={v => onStatusChange(problem, v)}
        className={styles.statusSelect}
      />
      <span className={styles.rowDivider} aria-hidden="true" />
      <ActionButton
        icon="solar:pen-linear"
        size="sm"
        tooltip="Edit"
        aria-label={`Edit ${problem.title}`}
        onClick={() => onEdit(problem)}
      />
      </div>
      {problem.note && (
        <Collapse open={noteOpen}>
          <p className={styles.rowNote}><span className={styles.rowNoteLabel}>Note:</span> {problem.note}</p>
        </Collapse>
      )}
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
 * Add Problems: the PAMI/Hx Problems section's `+` opens this.
 * Figma P360 8207:293083.
 *
 * Search adds a problem to the patient's list; the two sections below are the
 * list itself, split by status, so adding and reviewing happen in one place.
 */
export function AddProblemsDrawer({ patientId, focus, onClose }) {
  const storeProblems = useAppStore(s => (patientId ? s.patientProblems[patientId] : null));
  const problems = useMemo(() => storeProblems || [], [storeProblems]);
  const loadedFor = useAppStore(s => (patientId ? s.patientProblemsLoadedFor[patientId] : false));
  const addPatientProblem = useAppStore(s => s.addPatientProblem);
  const updatePatientProblem = useAppStore(s => s.updatePatientProblem);
  const showToast = useAppStore(s => s.showToast);
  const [resolvedOpen, setResolvedOpen] = useState(focus === 'resolved');
  const resolvedRef = useRef(null);
  const [activeOpen, setActiveOpen] = useState(true);

  const active = useMemo(() => problems.filter(p => !CLOSED_STATUSES.has(p.status || 'Active')), [problems]);
  const resolved = useMemo(() => problems.filter(p => CLOSED_STATUSES.has(p.status)), [problems]);
  const loading = !!patientId && !loadedFor;

  // Arriving from the section's "Resolved (2)" link: open that section and
  // bring it into view once its rows have rendered.
  useEffect(() => {
    if (focus !== 'resolved' || loading) return undefined;
    const id = requestAnimationFrame(() => {
      resolvedRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [focus, loading]);


  // Picking a condition opens the draft card; the list below waits until the
  // draft is saved or discarded.
  // A draft is either a freshly picked condition or an existing problem being
  // edited; `editing` tells the two apart when it saves.
  const [draft, setDraft] = useState(null);
  const handleCondition = (title) => {
    if (!title) return;
    const existing = new Set(problems.map(p => (p.title || '').trim().toLowerCase()));
    if (existing.has(title.trim().toLowerCase())) {
      showToast?.('This problem is already on the list');
      return;
    }
    setDraft({ title });
  };

  const startEdit = (problem) => setDraft({
    title: problem.title,
    editing: problem,
    initial: {
      since: isoFromOnsetLabel(problem.onsetLabel),
      status: problem.status || 'Active',
      severity: problem.severity || 'Mild',
      type: problem.type || 'Chronic',
      note: problem.note || '',
    },
  });

  const saveDraft = async (values) => {
    const payload = {
      title: values.title,
      type: values.type,
      severity: values.severity,
      status: values.status,
      note: values.note,
      onsetLabel: values.since ? formatClinicalDate(values.since) : undefined,
    };
    const ok = draft?.editing
      ? await updatePatientProblem(patientId, draft.editing.id, payload)
      : await addPatientProblem(patientId, payload);
    if (ok) setDraft(null);
  };

  // A row being edited is replaced in place by the draft card, the way the
  // medications drawer does it, so the edit stays next to its neighbours.
  const renderRow = (p) => (draft?.editing?.id === p.id ? (
    <ProblemDraft
      key={p.id}
      eyebrow="Edit Problem"
      title={draft.title}
      initial={draft.initial}
      onSave={saveDraft}
      onCancel={() => setDraft(null)}
    />
  ) : (
    <ProblemRow key={p.id} problem={p} onStatusChange={handleStatusChange} onEdit={startEdit} dimmed={!!draft?.editing} />
  ));

  const handleStatusChange = async (problem, status) => {
    const prev = problem.status || 'Active';
    if (status === prev) return;
    const ok = await updatePatientProblem(patientId, problem.id, { status });
    // Resolving moves the problem out of the active list, so the toast carries
    // an Undo; the other statuses stay visible in the row itself.
    if (ok && status === 'Resolved') {
      toast.success('Problem resolved successfully', {
        action: { label: 'Undo', onClick: () => updatePatientProblem(patientId, problem.id, { status: prev }) },
      });
    }
  };

  return (
    <Drawer title="Add Problems" onClose={onClose}>
      <div className={styles.body}>
        <div className={[styles.addBlock, draft?.editing ? styles.dimmed : ''].filter(Boolean).join(' ')}>
          <span className={styles.addLabel}>Add New Problems</span>
          <ChronicConditionSelect
            label=""
            multiple={false}
            leadingIcon="solar:magnifer-linear"
            value={draft?.editing ? '' : (draft?.title || '')}
            onChange={handleCondition}
          />
        </div>

        {draft && !draft.editing && (
          <ProblemDraft
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
              title="Active Problems"
              count={active.length}
              open={activeOpen}
              onToggle={() => setActiveOpen(v => !v)}
            >
              {active.length === 0 ? (
                <div className={styles.emptyCard}>
                  <RingEmptyState icon="solar:health-linear" label="No Active Problems" iconSize={31} />
                </div>
              ) : active.map(p => renderRow(p))}
            </Section>

            {resolved.length > 0 && (
              <Section
                dimmed={!!draft?.editing}
                ref={resolvedRef}
                title="Resolved Problems"
                count={resolved.length}
                open={resolvedOpen}
                onToggle={() => setResolvedOpen(v => !v)}
              >
                {resolved.map(p => renderRow(p))}
              </Section>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
