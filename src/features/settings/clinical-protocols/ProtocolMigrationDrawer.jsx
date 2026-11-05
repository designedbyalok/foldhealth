import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Banner } from '../../../components/Banner/Banner';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { TableSkeleton } from '../../../components/TableSkeleton/TableSkeleton';
import { useAppStore } from '../../../store/useAppStore';
import { COHORT_DIMENSIONS, NO_VALUE } from '../care-plan-library/lib/templateVersions';
import { ImpactAnalysis } from '../care-plan-library/versions/ImpactAnalysis';
import { protocolMigrationPlan } from './lib/protocolMigration';
import styles from '../care-plan-library/versions/Versions.module.css';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fromVersion = r => (r.fromVersion ? `v${r.fromVersion}` : 'Prior version');

/**
 * After a new protocol version is approved: the active care plans still on an
 * earlier version (directly, or through a template based on it), by cohort,
 * and how they move: all now, chosen cohorts now, or at each plan's next
 * review. Closing without choosing leaves every plan where it is.
 */
export function ProtocolMigrationDrawer({ protocolId, onClose }) {
  const protocol = useAppStore(s => s.clinicalProtocols.find(p => p.id === protocolId));
  const fetchImpact = useAppStore(s => s.fetchProtocolMigrationImpact);
  const migrate = useAppStore(s => s.migrateCarePlansToProtocol);
  const showToast = useAppStore(s => s.showToast);
  const [impact, setImpact] = useState(null); // { rows, priorIds }
  const [mode, setMode] = useState('all');
  const [cohort, setCohort] = useState({});
  const [busy, setBusy] = useState(null); // { done, total }
  const [result, setResult] = useState(null);

  useEffect(() => {
    let live = true;
    fetchImpact(protocolId).then(r => { if (live) setImpact(r); });
    return () => { live = false; };
  }, [protocolId, fetchImpact]);

  const rows = impact?.rows;
  const options = useMemo(() => Object.fromEntries(COHORT_DIMENSIONS.map(d => [d.key,
    [...new Set((rows || []).flatMap(r => { const v = d.read(r); return v.length ? v : [NO_VALUE]; }))].sort()])), [rows]);
  const plan = rows ? protocolMigrationPlan(rows, mode, cohort) : null;
  const marked = plan && mode !== 'review' ? new Set(plan.now.map(r => r.instanceId)) : null;
  const cohortEmpty = mode === 'cohort' && !COHORT_DIMENSIONS.some(d => (cohort[d.key] || []).length);

  if (!protocol) return null;
  const to = protocol.version ? `v${protocol.version}` : 'this version';

  const run = async () => {
    setBusy({ done: 0, total: plan.now.length });
    const res = await migrate(protocolId, {
      mode, cohort, rows, priorIds: impact.priorIds,
      onProgress: (done, total) => setBusy({ done, total }),
    });
    setBusy(null);
    if (!res) return;
    setResult(res);
    const parts = [
      res.migrated && `${plural(res.migrated, 'plan')} moved to ${to}`,
      res.deferred && `${plural(res.deferred, 'plan')} move at their next review`,
      res.stayed && `${plural(res.stayed, 'plan')} stay on the prior version`,
    ].filter(Boolean);
    showToast?.(parts.join('; ') || 'No plans to move');
  };

  const modeOptions = [
    { value: 'all', label: `Migrate all now (${rows?.length ?? '…'})`, hint: `Every affected plan follows ${to} now. Each move is logged in that care plan's history.` },
    { value: 'cohort', label: 'Migrate by cohort', hint: 'Pick cohorts by care program, IPA, care manager or population group to move now. The rest stay on the prior version.' },
    { value: 'review', label: 'Next review only', hint: 'Each plan moves when its next care plan review is completed.' },
  ];

  const done = !!result || (rows && rows.length === 0);
  const actionLabel = mode === 'review'
    ? `Move ${plural(plan?.deferred.length ?? 0, 'plan')} at next review`
    : `Migrate ${plural(plan?.now.length ?? 0, 'plan')}`;
  const primaryAction = done
    ? <Button onClick={onClose}>Done</Button>
    : (
      <Button onClick={run} disabled={!rows || !!busy || cohortEmpty || (mode !== 'review' && !plan?.now.length)}>
        {busy ? (busy.total ? `Migrating ${busy.done}/${busy.total}…` : 'Saving…') : actionLabel}
      </Button>
    );
  const secondaryAction = !done && <Button variant="outline" disabled={!!busy} onClick={onClose}>Decide Later</Button>;

  return (
    <Drawer
      title={`Move Care Plans to ${protocol.title} ${to}`}
      onClose={busy ? () => {} : onClose}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction || undefined}
    >
      <div className={styles.stack}>
        {result && (
          <Banner
            variant="outline"
            tone={result.failed ? 'warning' : 'success'}
          >
            {[
              result.migrated ? `${plural(result.migrated, 'plan')} moved to ${to}` : '',
              result.deferred ? `${plural(result.deferred, 'plan')} move at their next review` : '',
              result.stayed ? `${plural(result.stayed, 'plan')} stay on the prior version` : '',
              result.failed ? `${plural(result.failed, 'plan')} could not be updated` : '',
            ].filter(Boolean).join('. ').concat('.')}
          </Banner>
        )}

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Impact analysis</h4>
          {rows
            ? (
              <ImpactAnalysis
                rows={rows}
                marked={result ? null : marked}
                versionOf={fromVersion}
                lead="Earlier versions are followed by"
                emptyText={`No active care plan follows an earlier version of ${protocol.title}, directly or through a template based on it.`}
                showTemplate
              />
            )
            : <TableSkeleton rows={4} />}
        </section>

        {rows && rows.length > 0 && !result && (
          <section className={styles.section}>
            <RadioOptionGroup label="Migration" options={modeOptions} value={mode} onChange={setMode} variant="card" />
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
                  {cohortEmpty
                    ? 'Pick at least one cohort.'
                    : `${plural(plan.now.length, 'plan')} in the cohort move to ${to}; ${plural(plan.stay.length, 'plan')} stay on the prior version.`}
                </p>
              </div>
            )}
            <p className={styles.muted}>Moving a plan records the protocol version it follows. To change its goals and interventions, publish a new version of its template.</p>
          </section>
        )}
      </div>
    </Drawer>
  );
}
