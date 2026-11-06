import { useState } from 'react';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { Switch } from '../../../components/Switch/Switch';
import { Textarea } from '../../../components/Textarea/Textarea';
import { CLOSURE_REASONS, PROGRAM_STATUS_OPTIONS } from '../../patient/data/programStatus';
import { PAUSE_REASONS, isoDay, pauseFormProblem } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanPause';
import styles from './care.module.css';

/** Pick a program status (same list as the desktop status dropdown). */
export function ProgramStatusSheet({ current, onPick, onClose }) {
  return (
    <BottomSheet title="Program Status" onClose={onClose}>
      {PROGRAM_STATUS_OPTIONS.map(s => (
        <BottomSheetItem key={s} label={s} detail={s === current ? 'Current' : undefined} onClick={() => onPick(s)} />
      ))}
    </BottomSheet>
  );
}

/**
 * Close an enrollment with a reason (desktop CloseProgramDialog): "Goal met"
 * ends it as Completed, the rest as Discontinued, unless the status was
 * picked already.
 */
export function CloseProgramSheet({ program, status, busy, onSubmit, onClose }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const ending = status || 'Completed or Discontinued';
  return (
    <BottomSheet title={`Close ${program.code}`} onClose={onClose}>
      <p className={styles.sheetText}>Ends this enrollment today as {ending}. It moves to Past Programs and keeps its history.</p>
      <RadioOptionGroup label="Reason" variant="card" options={CLOSURE_REASONS} value={reason} onChange={setReason} />
      <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" aria-label="Note" />
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="solid" tone="danger" disabled={!reason || busy} onClick={() => onSubmit({ reason, note: note.trim(), status })}>
          Close Program
        </Button>
      </div>
    </BottomSheet>
  );
}

/**
 * Pause a program (desktop PauseCarePlanDialog, subject "program"): why,
 * from when, the planned resume date and whether it resumes on its own.
 */
export function PauseProgramSheet({ busy, onSubmit, onClose }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [pausedOn, setPausedOn] = useState(() => isoDay(new Date()));
  const [resumeOn, setResumeOn] = useState('');
  const [autoResume, setAutoResume] = useState(false);
  const problem = pauseFormProblem({ pausedOn, resumeOn, autoResume });
  const needsNote = reason === 'other' && !note.trim();
  return (
    <BottomSheet title="Pause Program" onClose={onClose}>
      <p className={styles.sheetMeta}>The program&rsquo;s care plan pauses with it: no cadence, no overdue flags and no automated outreach.</p>
      <RadioOptionGroup label="Reason" variant="card" options={PAUSE_REASONS} value={reason} onChange={setReason} />
      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={reason === 'other' ? 'Why is it paused?' : 'Anything the care team should know (optional)'} aria-label="Pause note" />
      <div className={styles.dates}>
        <Input type="date" size="lg" label="Pause start date" required value={pausedOn} onValueChange={setPausedOn} />
        <Input type="date" size="lg" label="Planned resume date" value={resumeOn} min={pausedOn || undefined} onValueChange={setResumeOn} />
        <Switch checked={autoResume} onChange={setAutoResume} label="Auto-resume on the planned resume date" />
        {problem && <p className={styles.problem}>{problem}</p>}
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="solid"
          disabled={!reason || needsNote || !!problem || busy}
          onClick={() => onSubmit({ reason, note: note.trim(), pausedOn, resumeOn: resumeOn || null, autoResume })}
        >
          Pause Program
        </Button>
      </div>
    </BottomSheet>
  );
}

/** Assign the program to a staff member (desktop AssigneeChange). */
export function AssigneeSheet({ users, current, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = (users || []).filter(u => !q || String(u.name || '').toLowerCase().includes(q)).slice(0, 50);
  return (
    <BottomSheet title="Assign To" onClose={onClose}>
      <Input leadingIcon="solar:magnifer-linear" size="lg" placeholder="Search staff" aria-label="Search staff" value={query} onValueChange={setQuery} />
      {shown.length === 0 && <p className={styles.sheetMeta}>No matching staff</p>}
      {shown.map(u => (
        <BottomSheetItem key={u.id || u.name} icon="solar:user-linear" label={u.name} detail={u.name === current ? 'Current' : undefined} onClick={() => onPick(u)} />
      ))}
    </BottomSheet>
  );
}
