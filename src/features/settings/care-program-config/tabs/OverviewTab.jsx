import { Input } from '../../../../components/Input/Input';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { Select } from '../../../../components/Select/Select';
import { Badge } from '../../../../components/Badge/Badge';
import { Link } from '../../../../components/Link/Link';
import { PROGRAM_STATUSES, stepCounts } from '../careProgramConfigModel';
import styles from '../CareProgramConfig.module.css';

function Stat({ label, value, onOpen }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {onOpen && <Link onClick={onOpen}>Configure</Link>}
    </div>
  );
}

/** Overview: the program's name, status and description, and a summary of its setup. */
export function OverviewTab({ draft, patch, onTab }) {
  const counts = stepCounts(draft.steps);
  const navWorklists = draft.worklists.filter(w => w.showInNavigation).length;
  return (
    <>
      <div className={styles.stats}>
        <Stat label="Steps switched on" value={`${counts.on} of ${counts.total}`} onOpen={() => onTab('steps')} />
        <Stat label="Mandatory steps" value={counts.mandatory} onOpen={() => onTab('steps')} />
        <Stat label="Worklists" value={`${draft.worklists.length}${navWorklists ? ` (${navWorklists} in navigation)` : ''}`} onOpen={() => onTab('worklists')} />
        <Stat label="Care team roles" value={draft.careTeam.length} onOpen={() => onTab('care-team')} />
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitleBlock}>
            <h3 className={styles.cardTitle}>Program Details</h3>
            <p className={styles.cardHint}>Only active programs can be enrolled. Draft and inactive programs keep their patients but take no new ones.</p>
          </div>
        </div>
        <div className={styles.fieldGrid}>
          <Input label="Program Name" required value={draft.name} maxLength={80} onChange={e => patch({ name: e.target.value })} />
          <Input label="Program Code" value={draft.code} disabled helperText="The code can't be changed once created." />
          <Select
            label="Status"
            portal
            options={PROGRAM_STATUSES.map(s => ({ value: s.value, label: s.label }))}
            value={draft.status}
            onValueChange={status => patch({ status })}
          />
          <div className={styles.fieldFull}>
            <Textarea title="Description" value={draft.description} onValueChange={description => patch({ description })} rows={3} maxLength={300} placeholder="What this program is for" />
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitleBlock}>
            <h3 className={styles.cardTitle}>Patient Workflow</h3>
            <p className={styles.cardHint}>The steps an enrolled patient&apos;s program shows, in order. Mandatory steps are marked.</p>
          </div>
          <Link onClick={() => onTab('steps')}>Edit steps</Link>
        </div>
        {counts.on === 0 ? <p className={styles.cardHint}>No steps are switched on yet.</p> : (
          <div className={styles.chips}>
            {draft.steps.filter(s => s.enabled !== false).flatMap(s => (s.type === 'section'
              ? (s.children || []).filter(c => c.enabled !== false).map(c => ({ ...c, label: `${s.name}: ${c.name}` }))
              : [{ ...s, label: s.name }])).map(s => (
                <Badge key={s.id} size="md" tone={s.mandatory ? 'primary' : 'neutral'} label={s.mandatory ? `${s.label} *` : s.label} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
