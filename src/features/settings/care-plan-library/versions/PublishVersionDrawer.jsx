import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../components/Drawer/Drawer';
import { Button } from '../../../../components/Button/Button';
import { Input } from '../../../../components/Input/Input';
import { Textarea } from '../../../../components/Textarea/Textarea';
import { Badge } from '../../../../components/Badge/Badge';
import { Banner } from '../../../../components/Banner/Banner';
import { FilterChip } from '../../../../components/FilterChip/FilterChip';
import { RadioOptionGroup } from '../../../../components/RadioOptionGroup/RadioOptionGroup';
import { TableSkeleton } from '../../../../components/TableSkeleton/TableSkeleton';
import { useAppStore } from '../../../../store/useAppStore';
import {
  COHORT_DIMENSIONS, NO_VALUE, contentOf, effectiveVersion, migrationTargets,
  nextVersionNumber, todayIso, versionDiff,
} from '../lib/templateVersions';
import { ImpactAnalysis } from './ImpactAnalysis';
import styles from './Versions.module.css';

const KIND_LABEL = { goal: 'Goals', intervention: 'Interventions', barrier: 'Barriers' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const usDate = (iso) => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : '');

/** Added / removed items between the version in effect and this one. */
function ChangeSummary({ diff }) {
  if (!diff.total) return <p className={styles.muted}>No goals, interventions or barriers added or removed. Other edits (names, priorities, descriptions) still make a new version.</p>;
  return (
    <ul className={styles.changes}>
      {Object.entries(KIND_LABEL).flatMap(([kind, label]) => [
        ...diff[kind].added.map(x => <li key={`${kind}+${x.title}`}><Badge tone="success" size="sm" label="Added" /><span>{x.title}</span><span className={styles.muted}>{label.slice(0, -1)}</span></li>),
        ...diff[kind].removed.map(x => <li key={`${kind}-${x.title}`}><Badge size="sm" label="Removed" /><span>{x.title}</span><span className={styles.muted}>{label.slice(0, -1)}</span></li>),
      ])}
    </ul>
  );
}

/**
 * Publish an edited template as its next version: what changed, when it takes
 * effect, which plans use it (impact analysis), and how they move to it.
 */
export function PublishVersionDrawer({ template, content, onClose, onPublished }) {
  const versions = useAppStore(s => s.carePlanTemplateVersions[template.id]) || [];
  const fetchImpact = useAppStore(s => s.fetchCarePlanTemplateImpact);
  const publish = useAppStore(s => s.publishCarePlanTemplateVersion);
  const [rows, setRows] = useState(null);
  const [effectiveDate, setEffectiveDate] = useState(todayIso);
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('review');
  const [cohort, setCohort] = useState({});
  const [busy, setBusy] = useState(null); // { done, total }

  useEffect(() => {
    let live = true;
    fetchImpact(template.id).then(r => { if (live) setRows(r); });
    return () => { live = false; };
  }, [template.id, fetchImpact]);

  const number = nextVersionNumber(versions) || 2;
  const current = effectiveVersion(versions) || { versionNumber: template.currentVersionNumber || 1, content: contentOf(template) };
  const diff = useMemo(() => versionDiff(current.content, content), [current.content, content]);
  const targets = rows ? migrationTargets(rows, mode, cohort, number) : null;
  const marked = targets && mode !== 'review' ? new Set(targets.rows.map(r => r.instanceId)) : null;
  const future = effectiveDate > todayIso();
  const cohortEmpty = mode === 'cohort' && !COHORT_DIMENSIONS.some(d => (cohort[d.key] || []).length);

  const options = useMemo(() => Object.fromEntries(COHORT_DIMENSIONS.map(d => [d.key,
    [...new Set((rows || []).flatMap(r => { const v = d.read(r); return v.length ? v : [NO_VALUE]; }))].sort()])), [rows]);

  const n = targets?.rows.length ?? 0;
  const modeOptions = [
    { value: 'all', label: `Migrate all plans (${rows ? migrationTargets(rows, 'all', {}, number).rows.length : '…'})`, hint: future ? `Plans move on ${usDate(effectiveDate)}, or when next opened after that.` : 'Plans move now. Each one is left unsigned for its care manager to review and sign.' },
    { value: 'cohort', label: 'Migrate a cohort', hint: 'Pick plans by care program, IPA, care manager or population group. The rest stay on their version.' },
    { value: 'review', label: 'At each plan’s next review', hint: 'Plans move when their next care plan review is completed.' },
  ];

  const run = async () => {
    setBusy({ done: 0, total: mode === 'review' || future ? 0 : n });
    const res = await publish(template, content, {
      effectiveDate, note, mode, cohort, impactRows: rows || [],
      onProgress: (done, total) => setBusy({ done, total }),
    });
    setBusy(null);
    if (res) onPublished?.(res);
  };

  const primaryAction = (
    <Button onClick={run} disabled={!rows || !!busy || cohortEmpty || !effectiveDate}>
      {busy ? (busy.total ? `Migrating ${busy.done}/${busy.total}…` : 'Publishing…') : `Publish version ${number}`}
    </Button>
  );

  return (
    <Drawer title={`Publish ${template.name}: version ${number}`} onClose={busy ? () => {} : onClose} primaryAction={primaryAction}>
      <div className={styles.stack}>
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Changes from version {current.versionNumber}</h4>
          <ChangeSummary diff={diff} />
        </section>

        <section className={styles.section}>
          <div className={styles.row2}>
            <Input label="Effective date" required type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
          </div>
          {future && <Banner variant="outline" tone="info">{`Version ${current.versionNumber} stays in effect until ${usDate(effectiveDate)}. New plans apply it until then.`}</Banner>}
          <Textarea title="What changed" value={note} onValueChange={text => setNote(text)} placeholder="e.g. Adds a quarterly foot exam; drops the weekly weigh-in" rows={2} />
        </section>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Impact analysis</h4>
          {rows ? <ImpactAnalysis rows={rows} marked={marked} /> : <TableSkeleton rows={4} />}
        </section>

        {rows && rows.length > 0 && (
          <section className={styles.section}>
            <RadioOptionGroup label="Move existing plans" options={modeOptions} value={mode} onChange={setMode} variant="card" />
            {mode === 'cohort' && (
              <div className={styles.cohort}>
                <div className={styles.cohortChips}>
                  {COHORT_DIMENSIONS.map(d => (
                    <FilterChip
                      key={d.key}
                      label={d.label}
                      options={options[d.key] || []}
                      selected={cohort[d.key] || []}
                      onChange={v => setCohort(c => ({ ...c, [d.key]: v }))}
                      searchable
                    />
                  ))}
                </div>
                <p className={styles.muted}>
                  {cohortEmpty ? 'Pick at least one value.' : `${plural(n, 'plan')} in the cohort move to version ${number}; ${plural((rows || []).length - n, 'plan')} stay on their version.`}
                </p>
              </div>
            )}
            <p className={styles.muted}>Moving a plan adds the items this version adds and discontinues open items it removes (with a reason). Items in both versions keep the patient’s progress.</p>
          </section>
        )}
      </div>
    </Drawer>
  );
}
