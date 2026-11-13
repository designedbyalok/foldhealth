import { useEffect, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/Button/Button';
import { Icon } from '@/components/Icon/Icon';
import { DashboardCard, DashboardCardSkeleton } from '@/components/DashboardCard/DashboardCard';
import { isProgramClosed } from '../../data/programStatus';
import { useCareProgramsOverview } from '../../right-panel/tabs/care-programs/CareProgramsTab/overview/useCareProgramsOverview';
import { useCareProgramsInsights } from '../../right-panel/tabs/care-programs/CareProgramsTab/overview/useCareProgramsInsights';
import { WhyPrioritized } from '../../right-panel/tabs/care-programs/CareProgramsTab/overview/CareProgramsOverview';
import { NextBestActions } from '../../right-panel/tabs/care-programs/CareProgramsTab/overview/NextBestActions';
import { SynopsisCard } from '../../right-panel/tabs/overview/cards/SynopsisCard';
import { vitalCatalog } from '../../right-panel/tabs/overview/cards/vitalsData';
import { vitalsHistory } from '../../left-panel/tabs/vitals-labs/vitalsConfig';
import { adherenceBand, lastTouchText, minutesState } from '../../../my-patients/myPatientsModel';
import styles from './QuickViewOverview.module.css';

const EMPTY = [];
const TONE = { danger: 'var(--status-error)', error: 'var(--status-error)', warning: 'var(--status-warning)', success: 'var(--status-success)' };
const TREND_LIMIT = 4;

/**
 * The Quick View's Overview tab (prototype Quick View > Summary): why the
 * patient is prioritized, the plan at a glance, what to do next, the vitals
 * off goal and Unity's synopsis, from the same records as the full profile.
 *
 * `onShowTab(tab)` switches the drawer's tab (Trends > View All opens
 * Vitals/Labs); `onClose` closes the drawer before leaving for the profile.
 */
export function QuickViewOverview({ patient, onShowTab, onClose }) {
  const patientId = patient.id;
  const memberId = String(patient.memberId ?? patient.id);
  const navigateToPatient = useAppStore(s => s.navigateToPatient);

  const programs = useAppStore(s => s.careProgramsByPatient[patientId]) || EMPTY;
  const programsLoaded = useAppStore(s => !!s.careProgramsLoadedFor[patientId]);
  const fetchCareProgramsForPatient = useAppStore(s => s.fetchCareProgramsForPatient);
  const overview = useAppStore(s => s.patientOverview[memberId]);
  const fetchPatientOverview = useAppStore(s => s.fetchPatientOverview);
  const vitalRows = useAppStore(s => s.patientVitals[patientId]);
  const fetchPatientVitals = useAppStore(s => s.fetchPatientVitals);
  const myRow = useAppStore(s => s.myPatients.find(r => r.id === patientId || String(r.memberId) === memberId));
  const myPatientsDidFetch = useAppStore(s => s.myPatientsDidFetch);
  const fetchMyPatients = useAppStore(s => s.fetchMyPatients);

  useEffect(() => {
    fetchCareProgramsForPatient(patientId);
    fetchPatientOverview(memberId);
    fetchPatientVitals(patientId);
  }, [patientId, memberId, fetchCareProgramsForPatient, fetchPatientOverview, fetchPatientVitals]);
  useEffect(() => { if (!myPatientsDidFetch) fetchMyPatients(); }, [myPatientsDidFetch, fetchMyPatients]);

  const active = useMemo(() => programs.filter(p => !isProgramClosed(p.status)), [programs]);
  const data = useCareProgramsOverview(patientId, active);
  const unity = useCareProgramsInsights(patientId, data);

  // Into the profile: a program (its Care Plan step for plan items), or Care Programs.
  const leave = (opts) => { onClose(); navigateToPatient(patientId, opts); };
  const runAction = (row) => {
    const program = row.kind === 'step' ? row.refs[0].program : row.ref.program;
    leave({ programCode: program.code, openOnly: true, carePlan: row.kind !== 'step' });
  };
  const openRef = (key) => {
    const action = data.actions?.find(a => a.key === key);
    if (action) runAction(action);
    else leave({ profileTab: 'Care Programs' });
  };

  const trends = useMemo(() => {
    const ORDER = { error: 0, warning: 1 };
    // The patient's own readings only: the catalog fills unrecorded vitals,
    // biomarkers and labs with sample rows.
    const own = new Set([...(vitalRows || []).map(r => r.vital_key), ...(overview?.vitals || []).map(v => v.key)]);
    return vitalCatalog(overview, memberId, vitalsHistory(vitalRows))
      .filter(t => (t.tone === 'error' || t.tone === 'warning') && own.has(t.key))
      .sort((a, b) => ORDER[a.tone] - ORDER[b.tone])
      .slice(0, TREND_LIMIT);
  }, [overview, memberId, vitalRows]);

  if (!programsLoaded || (active.length && !data.ready)) {
    return (
      <div className={styles.wrap}>
        <DashboardCardSkeleton icon="solar:flag-linear" title="Why Prioritized" rows={2} />
        <DashboardCardSkeleton icon="solar:checklist-minimalistic-linear" title="Next Best Actions" rows={3} />
      </div>
    );
  }

  const glance = glanceCells(myRow, active.length ? data.totals : null);

  return (
    <div className={styles.wrap}>
      {active.length > 0 && (
        <WhyPrioritized
          why={data.why}
          unity={unity}
          onOpenRef={openRef}
          cta={(
            <span>
              <Button size="sm" trailingIcon="solar:arrow-right-linear" onClick={() => leave({ profileTab: 'Care Programs' })}>
                Review Care Programs
              </Button>
            </span>
          )}
        />
      )}

      <dl className={styles.glance} aria-label="At a glance">
        {glance.map(c => (
          <div key={c.k} className={styles.cell}>
            <dt className={styles.k}>{c.k}</dt>
            <dd className={styles.v} style={c.color ? { color: c.color } : undefined}>{c.v}</dd>
            {c.sub && <dd className={styles.k}>{c.sub}</dd>}
          </div>
        ))}
      </dl>

      {active.length > 0
        ? <NextBestActions actions={data.actions} programs={active} onRun={runAction} />
        : (
          <DashboardCard icon="solar:checklist-minimalistic-linear" title="Next Best Actions">
            <p className={styles.empty}>Not enrolled in a care program.</p>
          </DashboardCard>
        )}

      {trends.length > 0 && (
        <DashboardCard
          icon="solar:heart-pulse-linear"
          title="Trends"
          count={trends.length}
          actions={<Button variant="ghost" size="sm" onClick={() => onShowTab('Vitals/Labs')}>View All</Button>}
        >
          <ul className={styles.trends}>
            {trends.map(t => (
              <li key={t.key} className={styles.trend}>
                <span className={styles.k}>{t.label}</span>
                <span className={styles.trendValue}>
                  <span className={styles.v}>{t.value}</span>
                  {t.unit && t.unit !== t.label && <span className={styles.k}>{t.unit}</span>}
                  {t.change && (
                    <span className={styles.change} style={{ color: TONE[t.tone] }}>
                      {t.change}
                      <Icon name={t.direction === 'down' ? 'solar:arrow-right-down-linear' : 'solar:arrow-right-up-linear'} size={12} color="currentColor" />
                    </span>
                  )}
                </span>
                {t.goalTo && <span className={styles.k}>Goal {t.goalTo}</span>}
              </li>
            ))}
          </ul>
        </DashboardCard>
      )}

      {overview?.synopsis && <SynopsisCard overview={overview} />}
    </div>
  );
}

/** Plan adherence, care plan state, program time and last touch: "-" where nothing is on file. */
function glanceCells(row, totals) {
  const band = row?.adherence != null ? adherenceBand(row.adherence) : null;
  const delta = row?.adherence != null && row?.adherencePrev != null ? row.adherence - row.adherencePrev : null;
  const issues = totals ? [
    totals.issues.goal && `${totals.issues.goal} ${totals.issues.goal === 1 ? 'goal' : 'goals'} off target`,
    totals.issues.intervention && `${totals.issues.intervention} overdue`,
    totals.issues.barrier && `${totals.issues.barrier} unaddressed`,
  ].filter(Boolean) : [];
  const minutes = row ? minutesState(row) : null;
  const touch = row ? lastTouchText(row) : '-';
  return [
    {
      k: 'Plan Adherence',
      v: band ? `${row.adherence}%` : '-',
      sub: band ? `${band.label}${delta != null ? ` · ${delta >= 0 ? '+' : ''}${delta} vs last month` : ''}` : '',
      color: band ? TONE[band.tone] : undefined,
    },
    {
      k: 'Care Plan',
      v: !totals || !(totals.goals + totals.interventions + totals.barriers) ? 'No plan yet' : issues[0] || 'On track',
      sub: issues.slice(1).join(' · ') || (totals?.goals ? `${totals.goals} goals · ${totals.avgProgress}% progress` : ''),
      color: issues.length ? TONE.error : totals?.goals ? TONE.success : undefined,
    },
    {
      k: minutes ? `${minutes.program} Time` : 'Program Time',
      v: minutes ? minutes.text : '-',
      sub: minutes ? (minutes.met ? 'Monthly minutes met' : 'Logged this month') : '',
    },
    {
      k: 'Last Touch',
      v: touch,
      sub: row?.lastTouchBy || '',
    },
  ];
}
