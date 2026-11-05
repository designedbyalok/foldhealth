import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/Badge/Badge';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { recordDate } from './recordFormat';
import styles from './HealthRecords.module.css';

function Section({ title, items, empty, render }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h3 className={styles.title}>{title}</h3>
      {items.length === 0
        ? <p className={styles.empty}>{empty}</p>
        : <ul className={styles.list}>{items.map((item) => <li key={item.id} className={styles.row}>{render(item)}</li>)}</ul>}
    </section>
  );
}

const Line = ({ main, sub, badge }) => (
  <>
    <span className={styles.text}>
      <span className={styles.main}>{main}</span>
      {sub && <span className={styles.sub}>{sub}</span>}
    </span>
    {badge}
  </>
);

// Health Records tab on Home (frame 701:5011). Read-only.
export function HealthRecords({ memberId }) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_health_records', { p_member_id: memberId }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError('We could not load your health records.');
      setRecords(data || { problems: [], allergies: [], medications: [], immunizations: [] });
    });
    return () => { alive = false; };
  }, [memberId]);

  if (!records) return <CardSkeleton count={4} />;
  return (
    <div className={styles.wrap}>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Section
        title="Problems"
        items={records.problems}
        empty="No conditions on file."
        render={(p) => (
          <Line
            main={p.title}
            sub={p.since ? `Since ${recordDate(p.since)}` : p.type}
            badge={p.status && p.status !== 'Active' ? <Badge size="sm" label={p.status} /> : null}
          />
        )}
      />
      <Section
        title="Allergies"
        items={records.allergies}
        empty="No known allergies on file."
        render={(a) => (
          <Line
            main={a.title}
            sub={[a.criticality && a.criticality !== 'Unable to Assess' ? `${a.criticality} risk` : null,
              (a.reactions || []).length ? `Causes ${a.reactions.join(', ').toLowerCase()}` : null].filter(Boolean).join(' • ')}
          />
        )}
      />
      <Section
        title="Medications"
        items={records.medications}
        empty="No active medications on file."
        render={(m) => <Line main={m.name} sub={m.sig} />}
      />
      <Section
        title="Immunizations"
        items={records.immunizations}
        empty="No immunizations on file."
        render={(i) => (
          <Line
            main={i.title}
            sub={i.status === 'Completed' && i.date ? `Given ${recordDate(i.date)}` : [i.status, i.date && recordDate(i.date)].filter(Boolean).join(' • ')}
          />
        )}
      />
    </div>
  );
}
