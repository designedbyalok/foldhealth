import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/Icon/Icon';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { addDays, dayKey, dayLabel, sentLabel, SLOTS } from './taskFormat';
import { FormFillDrawer } from './FormFillDrawer';
import styles from './CareTasks.module.css';

function Group({ title, action, children }) {
  return (
    <section className={styles.section} aria-label={title}>
      <header className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        {action}
      </header>
      <ul className={styles.list}>{children}</ul>
    </section>
  );
}

// Care Tasks tab on Home (frames 701:4555, 701:4815): one day of medicines,
// plus today's education and forms. Ticks are allowed for today only.
export function CareTasks({ memberId }) {
  const today = new Date();
  const [day, setDay] = useState(today);
  const [data, setData] = useState({ key: null, tasks: null, error: '' });
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(null);
  const key = dayKey(day);
  const isToday = key === dayKey(today);

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_care_tasks', { p_member_id: memberId, p_date: key }).then(({ data: tasks, error }) => {
      if (alive) setData({ key, tasks: tasks || { meds: [], education: [], forms: [] }, error: error ? 'We could not load your care tasks.' : '' });
    });
    return () => { alive = false; };
  }, [memberId, key, version]);

  const setTaken = useCallback(async (doses, taken) => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('patient_set_doses_taken', {
        p_member_id: memberId, p_date: key, p_doses: doses.map((m) => ({ medication_id: m.id, slot: m.slot })), p_taken: taken,
      });
      if (error) toast.error(error.message || 'That was not saved. Try again.');
      setVersion((v) => v + 1);
    } finally {
      setSaving(false);
    }
  }, [memberId, key]);

  const tasks = data.key === key ? data.tasks : null;
  const meds = tasks?.meds || [];
  const groups = SLOTS.map((s) => ({ ...s, meds: meds.filter((m) => m.slot === s.id) })).filter((g) => g.meds.length);
  const nothing = tasks && !meds.length && !tasks.education.length && !tasks.forms.length;

  return (
    <div className={styles.wrap}>
      <div className={styles.dayBar}>
        <button type="button" className={styles.dayArrow} aria-label="Previous day" onClick={() => setDay((d) => addDays(d, -1))}>
          <Icon name="solar:alt-arrow-left-linear" size={14} color="currentColor" />
        </button>
        <span className={styles.dayName}>{isToday ? 'Today' : dayLabel(day)}</span>
        <button type="button" className={styles.dayArrow} aria-label="Next day" onClick={() => setDay((d) => addDays(d, 1))}>
          <Icon name="solar:alt-arrow-right-linear" size={14} color="currentColor" />
        </button>
        {!isToday && (
          <button type="button" className={styles.link} onClick={() => setDay(new Date())}>Back to Today</button>
        )}
      </div>

      {data.error && data.key === key && <p className={styles.error} role="alert">{data.error}</p>}
      {!tasks && <CardSkeleton count={3} />}
      {nothing && (
        <div className={styles.section}>
          <EmptyState
            icon="solar:checklist-minimalistic-linear"
            title={isToday ? 'Nothing to do today' : 'No medicines for this day'}
            description="Medicines, education and forms from your care team will show here."
          />
        </div>
      )}

      {groups.map((g) => {
        const open = g.meds.filter((m) => !m.taken);
        return (
          <Group
            key={g.id}
            title={g.label}
            action={isToday && open.length > 0 && (
              <button type="button" className={styles.link} disabled={saving} onClick={() => setTaken(open, true)}>All Done</button>
            )}
          >
            {g.meds.map((m) => (
              <li key={`${m.id}-${m.slot}`} className={styles.row}>
                <span className={styles.rowIcon}><Icon name="solar:pill-linear" size={18} color="currentColor" /></span>
                <span className={styles.text}>
                  <span className={styles.main}>{m.name}</span>
                  {m.sig && <span className={styles.sub}>{m.sig}</span>}
                  {m.taken && m.taken_by && <span className={styles.sub}>Marked taken by {m.taken_by}</span>}
                </span>
                <button
                  type="button"
                  className={`${styles.tick} ${m.taken ? styles.ticked : ''}`}
                  aria-pressed={m.taken}
                  aria-label={`${m.name}, ${m.taken ? 'taken' : 'not taken yet'}`}
                  disabled={!isToday || saving}
                  onClick={() => setTaken([m], !m.taken)}
                >
                  {m.taken && <Icon name="solar:check-circle-linear" size={22} color="currentColor" />}
                </button>
              </li>
            ))}
          </Group>
        );
      })}

      {tasks?.education.length > 0 && (
        <Group title="Education">
          {tasks.education.map((e) => (
            <li key={e.id} className={styles.row}>
              <span className={styles.rowIcon}><Icon name="solar:book-2-linear" size={18} color="currentColor" /></span>
              <span className={styles.text}>
                <span className={styles.main}>{e.title}</span>
                {e.url && <a className={styles.url} href={e.url} target="_blank" rel="noreferrer noopener">{e.url.replace(/^https?:\/\//, '')}</a>}
                <span className={styles.sub}>{e.assigned}</span>
              </span>
            </li>
          ))}
        </Group>
      )}

      {tasks?.forms.length > 0 && (
        <Group title="Forms">
          {tasks.forms.map((f) => (
            <li key={f.send_id} className={styles.row}>
              <span className={styles.rowIcon}><Icon name="solar:clipboard-text-linear" size={18} color="currentColor" /></span>
              <span className={styles.text}>
                <span className={styles.main}>{f.name}</span>
                <span className={styles.sub}>{[sentLabel(f.sent_at), f.sent_by ? `by ${f.sent_by}` : null].filter(Boolean).join(' ')}</span>
              </span>
              <button type="button" className={styles.link} onClick={() => setFilling(f)}>Fill the Form</button>
            </li>
          ))}
        </Group>
      )}

      {filling && (
        <FormFillDrawer
          memberId={memberId}
          send={filling}
          onClose={() => setFilling(null)}
          onSubmitted={() => setVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}
