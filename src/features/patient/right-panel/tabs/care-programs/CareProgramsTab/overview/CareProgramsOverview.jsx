import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { DashboardCard, DashboardCardSkeleton } from '@/components/DashboardCard/DashboardCard';
import { CarePlanProgressRing } from '@/components/CarePlanProgressRing/CarePlanProgressRing';
import { AssigneeChange } from '@/components/AssigneeChange/AssigneeChange';
import { ActionButton } from '@/components/ActionButton/ActionButton';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Icon } from '@/components/Icon/Icon';
import { DownChevronIcon } from '@/components/Icon/DownChevronIcon';
import { ProgramStatusRing } from '../../program-detail/shared/ProgramStatusRing/ProgramStatusRing.jsx';
import { findPatientRecord } from '../../care-plan/lib/carePlanPrintSettings';
import { parseLocalDate } from '@/lib/localDate';
import { activityIcon } from '../../../care-management/programActivity';
import { programOrder, programSummarySegments } from './careProgramsOverviewModel';
import { NextBestActions } from './NextBestActions';
import { useCareProgramsOverview } from './useCareProgramsOverview';
import styles from './CareProgramsOverview.module.css';

const initialsOf = n => (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const day = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const time = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
// Program cards shown before "Show N more".
const CARD_LIMIT = 4;
const fmtDate = d => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

function ProgramCard({ entry, progress, users, onOpen, onStatusMenu, onRowMenu, onAssign }) {
  const p = entry.program;
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const assigned = p.assignee && p.assignee !== 'Unassigned';
  return (
    <li className={styles.programCard}>
      <div className={styles.programTop}>
        <ProgramStatusRing progress={pct} size={18} />
        <button type="button" className={`${styles.programName} ${styles.stretch}`} onClick={() => onOpen(p)}>{p.name}</button>
        <Badge size="sm" label={p.code} />
        <span className={styles.programActions}>
          <span data-assign-row={p.id}>
            <AssigneeChange
              avatarOnly
              size="S"
              name={assigned ? p.assignee : undefined}
              initials={assigned ? initialsOf(p.assignee) : ''}
              unassigned={!assigned}
              showRole={false}
              users={users}
              pickerTitle="Assign"
              onSelect={user => onAssign(p, user)}
            />
          </span>
          <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More actions" aria-label={`${p.name} actions`} onClick={e => onRowMenu({ id: p.id, rect: e.currentTarget.getBoundingClientRect() })} />
        </span>
      </div>
      <span className={styles.programMeta}>
        <button type="button" className={styles.programStatus} style={{ color: p.statusColor }} onClick={e => onStatusMenu({ id: p.id, rect: e.currentTarget.getBoundingClientRect() })}>
          {p.status}
          <DownChevronIcon size={12} color={p.statusColor} />
        </button>
        <span>• {progress.done} of {progress.total} steps • {assigned ? p.assignee : 'Unassigned'}</span>
      </span>
      {progress.next && (
        <span className={styles.programNext}>
          Next: {progress.next.name}
          <span className={progress.next.detail.urgent ? styles.textDanger : undefined}> • {progress.next.detail.text}</span>
        </span>
      )}
    </li>
  );
}

function CarePlanSummary({ data, onOpenPlan, onOpenProgram }) {
  const { totals, progress, actions } = data;
  const tiles = [
    { key: 'goal', label: 'Goals', n: totals.goals, issue: totals.issues.goal && `${totals.issues.goal} off target` },
    { key: 'intervention', label: 'Interventions', n: totals.interventions, issue: totals.issues.intervention && `${totals.issues.intervention} overdue` },
    { key: 'barrier', label: 'Barriers', n: totals.barriers, issue: totals.issues.barrier && `${totals.issues.barrier} without intervention` },
  ];
  const segs = programSummarySegments(progress, actions, totals);
  const byCode = Object.fromEntries(progress.map(p => [p.program.code, p.program]));
  return (
    <DashboardCard icon="custom:care-plan" title="Care Plan Summary" actions={<Button size="sm" variant="ghost" onClick={onOpenPlan}>View</Button>}>
      <div className={styles.sumBody}>
        <button type="button" className={styles.sumProgress} onClick={onOpenPlan}>
          <CarePlanProgressRing progress={totals.avgProgress} title={`${totals.avgProgress}% average goal progress`} />
          <span className={styles.sumLabel}>Goal progress across the programs&rsquo; care plans</span>
        </button>
        <div className={styles.sumTiles}>
          {tiles.map(t => (
            <button key={t.key} type="button" className={styles.sumTile} onClick={onOpenPlan}>
              <span className={styles.sumValue}>{t.n}</span>
              <span className={styles.sumLabel}>{t.label}</span>
              <span className={t.issue ? (t.key === 'barrier' ? styles.textWarning : styles.textDanger) : styles.sumOk}>{t.issue || 'On track'}</span>
            </button>
          ))}
        </div>
        <div className={styles.sumText}>
          <span className={styles.sumTextHead}>Program Summary</span>
          <p className={styles.sumPara}>
            {segs.map((s, i) => (s.link ? (
              <button key={i} type="button" className={styles.inlineLink} onClick={() => (s.link === 'plan' ? onOpenPlan() : onOpenProgram(byCode[s.link]))}>{s.text}</button>
            ) : <span key={i}>{s.text}</span>))}
          </p>
          <span className={styles.sumFoot}>From the program steps and care plans, updated as they change.</span>
        </div>
      </div>
    </DashboardCard>
  );
}

function ActiveProblems({ problems, loaded }) {
  const active = problems.filter(p => !/resolved|inactive/i.test(p.status || ''));
  return (
    <DashboardCard icon="solar:health-linear" title="Active Problems" count={active.length || null}>
      {!loaded ? <p className={styles.empty}>Loading…</p> : active.length === 0 ? (
        <p className={styles.empty}>No active problems on file.</p>
      ) : (
        <ul className={styles.problemList}>
          {active.map(p => (
            <li key={p.id} className={styles.problem}>
              {p.code && <span className={styles.problemCode}>{p.code}</span>}
              <span>{p.title}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

function SinceLastVisit({ activity, lastVisit, onOpenLog }) {
  const since = lastVisit ? lastVisit.getTime() : null;
  const rows = (since ? activity.filter(a => new Date(a.occurredAt).getTime() > since) : activity).slice(0, 6);
  return (
    <DashboardCard
      icon="solar:history-linear"
      title={since ? 'Since Last Visit' : 'Recent Activity'}
      count={rows.length || null}
      actions={<Button size="sm" variant="ghost" onClick={onOpenLog}>Activity Log</Button>}
      footer={since ? `Last visit ${fmtDate(lastVisit)}` : 'No visit on record, so this is the latest activity.'}
    >
      {rows.length === 0 ? (
        <p className={styles.empty}>{since ? 'Nothing new since the last visit.' : 'No activity yet.'}</p>
      ) : (
        <ul className={styles.slvList}>
          {rows.map((r, i) => {
            const d = day(r.occurredAt);
            const showDay = i === 0 || d !== day(rows[i - 1].occurredAt);
            const ic = activityIcon(r.activityKind);
            return (
              <li key={r.id} className={styles.slvRow}>
                {showDay && <span className={styles.slvDay}>{d}</span>}
                <span className={styles.slvLine}>
                  <span className={styles.slvIcon} style={{ background: ic.bg, color: ic.color }}><Icon name={ic.icon} size={14} color="currentColor" /></span>
                  <span className={styles.slvText}>
                    <span className={styles.slvTitle}>{r.title}</span>
                    <span className={styles.slvMeta}>{[time(r.occurredAt), r.actorName].filter(Boolean).join(' • ')}</span>
                  </span>
                  {r.programCode && <Badge size="sm" tone="primary" label={r.programCode} />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

function WhyPrioritized({ points }) {
  return (
    <DashboardCard icon="solar:flag-linear" title="Why Prioritized" size="S">
      {points.length === 0 ? (
        <p className={styles.empty}>Nothing urgent across the active programs.</p>
      ) : (
        <ul className={styles.whyList}>
          {points.map(p => (
            <li key={p.text} className={styles.whyItem}>
              <Icon name={p.tone === 'danger' ? 'solar:danger-circle-linear' : 'solar:danger-triangle-linear'} size={14} color={p.tone === 'danger' ? 'var(--status-error)' : 'var(--status-warning)'} />
              <span>{p.text}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/**
 * The Care Programs tab's overview (care plan redesign prototype): program
 * cards, active problems and recent activity on the left; Why Prioritized
 * and Next Best Actions in the middle; the combined Care Plan Summary on the
 * right (or on the left when there's no room for three columns). Everything
 * comes from the patient's records; nothing is generated.
 */
export function CareProgramsOverview({
  patientId, programs, onOpenProgram, onOpenStep, onOpenPlan, onOpenLog, onReviewStep,
  onStatusMenu, onRowMenu, onAssign,
}) {
  const data = useCareProgramsOverview(patientId, programs);
  const [allCards, setAllCards] = useState(false);
  const users = useAppStore(s => s.platformUsers);
  const lastVisitRaw = useAppStore(s => {
    const r = findPatientRecord(s, patientId);
    return String(r?.lastVisit || r?.last_visit || '');
  });
  const lastVisit = parseLocalDate(lastVisitRaw);

  if (!data.ready) {
    return (
      <div className={styles.overviewWrap}>
        <div className={styles.overview}>
          <div className={styles.left}><DashboardCardSkeleton icon="solar:clipboard-heart-linear" title="Programs" rows={3} /></div>
          <div className={styles.main}><DashboardCardSkeleton icon="solar:checklist-minimalistic-linear" title="Next Best Actions" rows={4} /></div>
        </div>
      </div>
    );
  }

  const order = programOrder(data.progress, data.actions);
  const shownOrder = allCards ? order : order.slice(0, CARD_LIMIT);
  const onRun = row => (row.kind === 'step' ? onOpenStep(row.refs[0].program, row.refs[0].step.id) : onOpenPlan(row.ref.program));
  const summary = <CarePlanSummary data={data} onOpenPlan={() => onOpenPlan(null)} onOpenProgram={onOpenProgram} />;

  return (
    <div className={styles.overviewWrap}>
    <div className={styles.overview}>
      <div className={styles.left}>
        <DashboardCard icon="solar:clipboard-heart-linear" title="Programs" count={programs.length}>
          <ul className={styles.programList}>
            {shownOrder.map(({ index }) => (
              <ProgramCard
                key={data.entries[index].program.id}
                entry={data.entries[index]}
                progress={data.progress[index]}
                users={users}
                onOpen={onOpenProgram}
                onStatusMenu={onStatusMenu}
                onRowMenu={onRowMenu}
                onAssign={onAssign}
              />
            ))}
          </ul>
          {order.length > CARD_LIMIT && (
            <button type="button" className={styles.moreBtn} aria-expanded={allCards} onClick={() => setAllCards(v => !v)}>
              {allCards ? 'Show Less' : `Show ${order.length - CARD_LIMIT} More`}
              <DownChevronIcon size={12} color="currentColor" className={allCards ? styles.chevUp : undefined} />
            </button>
          )}
        </DashboardCard>
        <div className={styles.sumLeft}>{summary}</div>
        <ActiveProblems problems={data.problems} loaded={data.problemsLoaded} />
        <SinceLastVisit activity={data.activity} lastVisit={lastVisit} onOpenLog={onOpenLog} />
      </div>
      <div className={styles.main}>
        <WhyPrioritized points={data.why} />
        <NextBestActions actions={data.actions} programs={order.map(o => data.entries[o.index].program)} onRun={onRun} onReview={onReviewStep} />
      </div>
      <div className={styles.right}>{summary}</div>
    </div>
    </div>
  );
}
