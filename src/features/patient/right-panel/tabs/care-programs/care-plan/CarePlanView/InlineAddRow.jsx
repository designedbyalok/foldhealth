import { useState } from 'react';
import { Input } from '@/components/Input/Input';
import { Select } from '@/components/Select/Select';
import { Button } from '@/components/Button/Button';
import { INLINE_INTERVENTION_TYPES } from '../lib/carePlanInlineAdd';
import styles from './InlineAddRow.module.css';

const PLACEHOLDER = {
  goal: 'Goal name, e.g. Walk 20 minutes a day',
  intervention: 'Intervention name, e.g. Call PCP about refills',
  barrier: 'Barrier name, e.g. No ride to appointments',
};
const NO_GOAL = '';

/**
 * A new goal, intervention or barrier as a row at the top of its table (care
 * plan redesign prototype): its name, the intervention's type, and the goal
 * an intervention or barrier belongs to. Enter adds, Escape cancels.
 * `programs` (All Programs) adds a Program pick that narrows the goals;
 * `onMore` opens the full drawer (Browse Library, More Types).
 */
export function InlineAddRow({ kind, goals = [], programs = null, onSave, onCancel, onMore, moreLabel }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState(INLINE_INTERVENTION_TYPES[0].value);
  const [programId, setProgramId] = useState(programs?.[0]?.id || '');
  const [goalId, setGoalId] = useState(NO_GOAL);
  const [saving, setSaving] = useState(false);
  const shownGoals = programs ? goals.filter(g => g.program?.id === programId) : goals;
  const canSave = !!title.trim() && !saving && (!programs || !!programId);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const ok = await onSave({ title: title.trim(), type, goalId, programId });
      if (ok) onCancel();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.row} role="group" aria-label={`Add ${kind}`}>
      <Input
        className={styles.name}
        autoFocus
        value={title}
        placeholder={PLACEHOLDER[kind]}
        aria-label={`New ${kind} name`}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
      />
      {programs && (
        <Select
          className={styles.pick}
          aria-label="Program"
          options={programs.map(p => ({ value: p.id, label: p.code }))}
          value={programId}
          onValueChange={(v) => { setProgramId(v); setGoalId(NO_GOAL); }}
        />
      )}
      {kind === 'intervention' && (
        <Select
          className={styles.pick}
          aria-label="Intervention type"
          options={INLINE_INTERVENTION_TYPES}
          value={type}
          onValueChange={setType}
        />
      )}
      {kind !== 'goal' && (
        <Select
          className={styles.goal}
          aria-label="Linked goal"
          searchable
          options={[{ value: NO_GOAL, label: 'No goal' }, ...shownGoals.map(g => ({ value: g.id, label: g.title }))]}
          value={goalId}
          onValueChange={setGoalId}
        />
      )}
      <span className={styles.actions}>
        {onMore && <Button variant="ghost" size="sm" onClick={e => onMore(e.currentTarget.getBoundingClientRect())}>{moreLabel}</Button>}
        <Button variant="ghost" tone="neutral" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!canSave} onClick={save}>Add</Button>
      </span>
    </div>
  );
}
