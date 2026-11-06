import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Input } from '../../../components/Input/Input';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { formatGoalDuration, formatGoalTarget } from '../../settings/care-plan-library/lib';
import { GBI_STATUSES } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/gbiStatus';
import { addBarriersFromPicker, addGoalsFromPicker } from '../../patient/right-panel/tabs/care-programs/care-plan/CarePlanView/carePlanPickerHandlers';
import { useMobileNav } from '../MobileNavContext';
import { MobileListSkeleton } from '../MobileParts';
import { FieldGroup, FormScreen, PickerField } from '../patient/FormScreen';
import { carePlanProgram } from './careUtils';
import styles from './care.module.css';

const EMPTY = [];
const TITLE = { goal: 'Add Goals', intv: 'Add Intervention', barrier: 'Add Barriers' };
const norm = (v) => (v || '').trim().toLowerCase();
const initials = (name) => name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const STATUS_OPTIONS = GBI_STATUSES.map(v => ({ value: v, label: v }));

// A library goal's second line, as the desktop Add Goals drawer shows it.
const goalDetail = (g) => [[g.measure, formatGoalTarget(g)].filter(Boolean).join(' '), formatGoalDuration(g)].filter(Boolean).join(' • ');

/**
 * Add goals, an intervention or barriers to a care plan (desktop Add Goals /
 * Add Intervention / Add Barriers drawers). Goals and barriers are picked
 * from the care plan library (a barrier can also be typed in) and saved the
 * same way as desktop (addGoalsFromPicker / addBarriersFromPicker, which call
 * savePatientCarePlanGoal / Barrier and bring each goal's linked items);
 * an intervention needs a name, as on desktop.
 */
export function AddCarePlanItemScreen({ patientId, programId, kind }) {
  const { pop } = useMobileNav();
  const programs = useAppStore(s => (patientId ? s.careProgramsByPatient[patientId] : null)) || EMPTY;
  const program = useMemo(() => carePlanProgram(patientId, programId, programs), [patientId, programId, programs]);
  const plan = useAppStore(s => s.patientCarePlans[`${patientId}::${programId}`]);
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);
  const libraryGoals = useAppStore(s => s.carePlanGoals) || EMPTY;
  const libraryBarriers = useAppStore(s => s.carePlanBarriers) || EMPTY;
  const libraryDidFetch = useAppStore(s => s.carePlanLibraryDidFetch);
  const libraryLoading = useAppStore(s => !!s.carePlanLibraryLoading);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const savePatientCarePlanGoal = useAppStore(s => s.savePatientCarePlanGoal);
  const deletePatientCarePlanGoal = useAppStore(s => s.deletePatientCarePlanGoal);
  const savePatientCarePlanIntervention = useAppStore(s => s.savePatientCarePlanIntervention);
  const savePatientCarePlanBarrier = useAppStore(s => s.savePatientCarePlanBarrier);
  const refreshCarePlanDuplicates = useAppStore(s => s.refreshCarePlanDuplicates);
  const showToast = useAppStore(s => s.showToast);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!libraryDidFetch) fetchCarePlanLibrary?.(); }, [libraryDidFetch, fetchCarePlanLibrary]);
  useEffect(() => { if (patientId && programId) fetchPatientCarePlan?.(patientId, programId); }, [patientId, programId, fetchPatientCarePlan]);

  const data = useMemo(() => ({
    goals: plan?.goals || EMPTY, interventions: plan?.interventions || EMPTY, barriers: plan?.barriers || EMPTY,
  }), [plan]);
  const ctx = {
    data, patientId, program, savePatientCarePlanGoal, deletePatientCarePlanGoal,
    savePatientCarePlanBarrier, savePatientCarePlanIntervention, refreshCarePlanDuplicates, showToast,
  };

  const run = async (fn) => {
    if (!program) return;
    setBusy(true);
    try {
      await fn();
      pop();
    } catch {
      toast.error('Could not update the care plan.');
    } finally {
      setBusy(false);
    }
  };

  if (kind === 'intv') {
    return (
      <InterventionForm
        busy={busy}
        onSave={(values) => run(async () => {
          const saved = await savePatientCarePlanIntervention(patientId, program, values, null);
          if (!saved) throw new Error('not saved');
          showToast(`"${saved.title}" added`);
          refreshCarePlanDuplicates(patientId, program);
        })}
      />
    );
  }

  const isGoal = kind === 'goal';
  const added = new Set((isGoal ? data.goals : data.barriers).map(x => norm(x.title)));
  const library = (isGoal ? libraryGoals : libraryBarriers)
    .filter(x => !added.has(norm(x.title)))
    .map(x => ({ ...x, detail: isGoal ? goalDetail(x) : (x.description || '') }));

  return (
    <LibraryPicker
      title={TITLE[kind]}
      noun={isGoal ? 'Goal' : 'Barrier'}
      items={library}
      loading={libraryLoading}
      allowCustom={!isGoal}
      known={new Set([...added, ...(isGoal ? libraryGoals : libraryBarriers).map(x => norm(x.title))])}
      busy={busy}
      onAdd={(picked) => run(() => (isGoal
        ? addGoalsFromPicker({ ...ctx, picked, removed: [] })
        : addBarriersFromPicker({ ...ctx, picked, opts: { target: 'thisPlan' } })))}
    />
  );
}

/** Search the library, tick items, Add. Barriers can also be typed in. */
function LibraryPicker({ title, noun, items, loading, allowCustom, known, busy, onAdd }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const q = query.trim();
  const shown = items.filter(x => !q || `${x.title} ${x.detail || ''}`.toLowerCase().includes(q.toLowerCase()));
  const canCreate = allowCustom && !!q && !known.has(norm(q));
  const toggle = (id) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const chosen = items.filter(x => picked.has(x.id));
  const count = chosen.length;

  return (
    <FormScreen
      title={title}
      footer={(
        <Button size="lg" fullWidth disabled={!count || busy} onClick={() => onAdd(chosen)}>
          {count ? `Add ${count} ${noun}${count === 1 ? '' : 's'}` : `Add ${noun}s`}
        </Button>
      )}
    >
      <Input
        size="lg"
        leadingIcon="solar:magnifer-linear"
        placeholder={allowCustom ? `Search or enter a ${noun.toLowerCase()}` : `Search ${noun.toLowerCase()}s`}
        aria-label={`Search ${noun.toLowerCase()}s`}
        enterKeyHint="search"
        value={query}
        onValueChange={setQuery}
      />
      {canCreate && (
        <Button
          size="lg"
          variant="outline"
          leadingIcon="solar:add-circle-linear"
          disabled={busy}
          onClick={() => onAdd([...chosen, { id: `custom-${norm(q).replace(/\s+/g, '-')}`, title: q, description: '' }])}
        >
          Add &ldquo;{q}&rdquo;
        </Button>
      )}
      {loading ? <MobileListSkeleton count={4} height={56} /> : shown.length === 0 ? (
        <p className={styles.sheetMeta}>{items.length ? `No matching ${noun.toLowerCase()}s` : `No library ${noun.toLowerCase()}s left to add`}</p>
      ) : (
        <div className={styles.checklist}>
          {shown.map(x => (
            <label key={x.id} className={styles.checkRow}>
              <Checkbox checked={picked.has(x.id)} onCheckedChange={() => toggle(x.id)} aria-label={x.title} />
              <span className={styles.checkText}>
                <span className={styles.checkLabel}>{x.title}</span>
                {x.detail && <span className={styles.meta}>{x.detail}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
    </FormScreen>
  );
}

/** Desktop AddInterventionDrawer: name (required), who owns it, how long, status. */
function InterventionForm({ busy, onSave }) {
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [duration, setDuration] = useState('');
  const [status, setStatus] = useState('Not Started');
  const canSave = title.trim().length > 0 && !busy;
  const save = () => {
    if (!canSave) return;
    const who = assignee.trim();
    onSave({
      title: title.trim(),
      duration: duration.trim() || null,
      status,
      assignee: { name: who || 'Unassigned', initials: who ? initials(who) : '' },
    });
  };
  return (
    <FormScreen title="Add Intervention" footer={<Button size="lg" fullWidth disabled={!canSave} onClick={save}>Save</Button>}>
      <FieldGroup label="Name" required>
        <Input size="lg" value={title} onValueChange={setTitle} placeholder="e.g. Measure blood pressure everyday" aria-label="Intervention name" enterKeyHint="next" />
      </FieldGroup>
      <FieldGroup label="Assigned To">
        <Input size="lg" value={assignee} onValueChange={setAssignee} placeholder="Enter a name" aria-label="Assigned to" enterKeyHint="next" />
      </FieldGroup>
      <FieldGroup label="Duration">
        <Input size="lg" value={duration} onValueChange={setDuration} placeholder="e.g. 9D" aria-label="Duration" enterKeyHint="done" />
      </FieldGroup>
      <PickerField label="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
    </FormScreen>
  );
}
