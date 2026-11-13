import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { DashboardCard, DashboardCardSkeleton } from '@/components/DashboardCard/DashboardCard';
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
import { programOrder } from './careProgramsOverviewModel';
import { NextBestActions } from './NextBestActions';
import { ProgramSuggestedActions } from './ProgramSuggestedActions';
import { CarePlanItemDrawer } from './CarePlanItemDrawer';
import { ProgramStepDrawer } from './ProgramStepDrawer';
import { useCareProgramsOverview } from './useCareProgramsOverview';
import { useCareProgramsInsights } from './useCareProgramsInsights';
import { AiSummarySkeleton } from '../../care-plan/summary/CarePlanAiSummary/CarePlanAiSummary';
import styles from './CareProgramsOverview.module.css';

const initialsOf = n => (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const day = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const time = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const fmtDate = d => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
// Program rows and problems shown before "Show N More".
const CARD_LIMIT = 4;
const PROBLEM_LIMIT = 4;
const KIND_LIST = { goal: 'goals', intervention: 'interventions', barrier: 'barriers' };

function MoreButton({ open, hidden, onToggle }) {
  return (
    <button type="button" className={styles.moreBtn} aria-expanded={open} onClick={onToggle}>
      {open ? 'Show Less' : `Show ${hidden} More`}
      <DownChevronIcon size={12} color="currentColor" className={open ? styles.chevUp : undefined} />
    </button>
  );
}

/* ── Programs: a card per program; the card opens it ── */
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

/* ── Active Problems: name over type, onset and code ── */
// "11/18/23 (1 Year)" → "11/18/23": the date part of the stored onset label.
const onsetDate = label => (label || '').split(' (')[0].trim();
const onsetMs = label => { const t = new Date(onsetDate(label)).getTime(); return Number.isFinite(t) ? t : 0; };

function ActiveProblems({ problems, loaded }) {
  const [all, setAll] = useState(false);
  // Chronic before acute (what the programs manage), then the most recent onset.
  const active = problems
    .filter(p => !/resolved|inactive/i.test(p.status || ''))
    .sort((a, b) => (/chronic/i.test(b.type) - /chronic/i.test(a.type)) || onsetMs(b.onsetLabel) - onsetMs(a.onsetLabel) || (a.title || '').localeCompare(b.title || ''));
  const shown = all ? active : active.slice(0, PROBLEM_LIMIT);
  return (
    <DashboardCard icon="solar:health-linear" title="Active Problems" count={active.length || null}>
      {!loaded ? <p className={styles.empty}>Loading…</p> : active.length === 0 ? (
        <p className={styles.empty}>No active problems on file.</p>
      ) : (
        <>
          <ul className={styles.problemList}>
            {shown.map(p => (
              <li key={p.id} className={styles.problem}>
                <span className={styles.problemTitle}>{p.title}</span>
                <span className={styles.problemMeta}>
                  {[p.type, onsetDate(p.onsetLabel) && `Since ${onsetDate(p.onsetLabel)}`, p.code].filter(Boolean).join(' • ')}
                </span>
              </li>
            ))}
          </ul>
          {active.length > PROBLEM_LIMIT && <MoreButton open={all} hidden={active.length - PROBLEM_LIMIT} onToggle={() => setAll(v => !v)} />}
        </>
      )}
    </DashboardCard>
  );
}

/* ── Since Last Visit: a timeline, day on the left ── */
function SinceLastVisit({ activity, lastVisit, onOpenLog }) {
  const since = lastVisit ? lastVisit.getTime() : null;
  const rows = (since ? activity.filter(a => new Date(a.occurredAt).getTime() > since) : activity).slice(0, 5);
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
        <ol className={styles.timeline}>
          {rows.map((r, i) => {
            const d = day(r.occurredAt);
            const showDay = i === 0 || d !== day(rows[i - 1].occurredAt);
            const ic = activityIcon(r.activityKind);
            return (
              <li key={r.id} className={styles.tlRow}>
                <span className={styles.tlDay}>{showDay ? d : ''}</span>
                <span className={styles.tlRail}>
                  <span className={styles.tlIcon} style={{ background: ic.bg, color: ic.color }}><Icon name={ic.icon} size={14} color="currentColor" /></span>
                </span>
                <span className={styles.tlText}>
                  <span className={styles.tlMeta}>{[time(r.occurredAt), r.actorName].filter(Boolean).join(' • ')}</span>
                  <span className={styles.tlTitle}>{r.title}</span>
                </span>
                {r.programCode && <span className={styles.tlTags}><Badge size="sm" tone="primary" label={r.programCode} /></span>}
              </li>
            );
          })}
        </ol>
      )}
    </DashboardCard>
  );
}

/* ── Insight cards (Why Prioritized, Program Summary) ──
   Assembled from the records until someone asks Unity to write them
   (Summarize): then they take the AI tone and Unity's text, saved per
   patient, with the footer saying who wrote it and when. */
function CopyButton({ text }) {
  const showToast = useAppStore(st => st.showToast);
  return (
    <ActionButton
      icon="solar:copy-linear"
      size="sm"
      tooltip="Copy"
      aria-label="Copy text"
      onClick={() => navigator.clipboard?.writeText(text).then(() => showToast?.('Copied'), () => {})}
    />
  );
}

const stamp = iso => (iso
  ? new Date(iso).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '');

// The manual trigger in the card header: one run writes both cards.
// `state: 'off'` (a program's own Overview step) leaves Unity out.
function SummarizeAction({ unity }) {
  if (unity.state === 'ready' || unity.state === 'off') return null;
  return (
    <Button size="sm" variant="ghost" leadingIcon="custom:ai" disabled={unity.state === 'loading'} onClick={unity.generate}>
      {unity.state === 'loading' ? 'Writing…' : unity.error ? 'Try Again' : 'Summarize'}
    </Button>
  );
}

// Footer of a card Unity wrote: when, whether the records moved on since
// (with Update), and copy / write again / back to the records' version.
function UnityFooter({ unity, copy }) {
  return (
    <span className={styles.insightFoot}>
      <span className={styles.unityMeta}>
        {`Written by Unity${unity.generatedAt ? ` • ${stamp(unity.generatedAt)}` : ''}`}
        {unity.stale && <span className={styles.textWarning}> • Records changed since</span>}
      </span>
      <span className={styles.unityTools}>
        {unity.stale && <button type="button" className={styles.linkBtn} onClick={unity.generate}>Update</button>}
        <CopyButton text={copy} />
        {!unity.stale && <ActionButton icon="solar:refresh-linear" size="sm" tooltip="Write it again" onClick={unity.generate} />}
        <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Dismiss, show the records' version" onClick={unity.dismiss} />
      </span>
    </span>
  );
}

// A takeaway Unity tied to an action, reading or concern opens it.
function Takeaway({ t, onOpenRef }) {
  const dot = <span className={t.tone === 'danger' ? styles.dotDanger : styles.dotWarning} aria-hidden="true" />;
  return (
    <li className={styles.takeaway} title={t.text}>
      {dot}
      {t.ref && onOpenRef ? (
        <button type="button" className={`${styles.takeawayLink} ${styles.takeawayText}`} onClick={() => onOpenRef(t.ref)}>{t.text}</button>
      ) : <span className={styles.takeawayText}>{t.text}</span>}
    </li>
  );
}

export function WhyPrioritized({ why, unity, onOpenRef }) {
  // The points first; the paragraph behind Show More.
  const [open, setOpen] = useState(false);
  const ai = unity.state === 'ready' ? unity.insights.why : null;
  const takeaways = ai ? ai.takeaways : why.takeaways;
  const hasParagraph = ai ? !!ai.paragraph : why.segments.length > 0;
  const empty = !takeaways.length && !hasParagraph;
  const plain = ai
    ? [ai.takeaways.map(t => t.text).join('; '), ai.paragraph].filter(Boolean).join('\n')
    : [why.takeaways.map(t => t.text).join('; '), why.segments.map(seg => seg.text).join('')].filter(Boolean).join('\n');
  return (
    <DashboardCard
      className={ai ? undefined : styles.insight}
      tone={ai ? 'ai' : undefined}
      icon={ai ? 'custom:ai' : 'solar:flag-linear'}
      title="Why Prioritized"
      actions={(
        <span className={styles.cardActions}>
          <SummarizeAction unity={unity} />
          {!ai && !empty && <CopyButton text={plain} />}
          {!empty && hasParagraph && (
            <button type="button" className={styles.linkBtn} aria-expanded={open} onClick={() => setOpen(v => !v)}>
              {open ? 'Show Less' : 'Show More'}
              <DownChevronIcon size={12} color="currentColor" className={open ? styles.chevUp : undefined} />
            </button>
          )}
        </span>
      )}
      footer={ai ? <UnityFooter unity={unity} copy={plain} /> : null}
    >
      <div className={styles.whyBody}>
        {unity.state === 'loading' ? <AiSummarySkeleton /> : empty ? <p className={styles.whyPara}>Nothing urgent across the active programs.</p> : (
          <>
            {takeaways.length > 0 && (
              <ul className={styles.takeaways}>
                {takeaways.map(t => <Takeaway key={t.text} t={t} onOpenRef={ai ? onOpenRef : null} />)}
              </ul>
            )}
            {open && hasParagraph && (
              <p className={styles.whyPara}>
                {ai ? ai.paragraph : why.segments.map((seg, k) => (seg.bold ? <strong key={k}>{seg.text}</strong> : <span key={k}>{seg.text}</span>))}
              </p>
            )}
          </>
        )}
      </div>
    </DashboardCard>
  );
}

/* ── Care Plan Summary and Program Summary (right column) ── */
export function CarePlanSummary({ data, onOpenPlan, progressLabel = <>Goal progress, across the programs&rsquo; care plans</> }) {
  const { totals } = data;
  const rows = [
    { key: 'goal', label: 'Goals', n: totals.goals, issue: totals.issues.goal && `${totals.issues.goal} off target` },
    { key: 'intervention', label: 'Interventions', n: totals.interventions, issue: totals.issues.intervention && `${totals.issues.intervention} overdue` },
    { key: 'barrier', label: 'Barriers', n: totals.barriers, issue: totals.issues.barrier && `${totals.issues.barrier} unaddressed` },
  ];
  return (
    <section className={styles.sumSection} aria-label="Care plan summary">
      <div className={styles.sumHead}>
        <h3 className={styles.sumTitle}>Care Plan Summary</h3>
        <button type="button" className={styles.linkBtn} onClick={onOpenPlan}>View</button>
      </div>
      <div className={styles.sumCard}>
        <button type="button" className={styles.sumProgress} onClick={onOpenPlan}>
          <span className={styles.sumPct}>{totals.avgProgress}%</span>
          <span className={styles.sumBar} aria-hidden="true"><span style={{ width: `${Math.min(100, totals.avgProgress)}%` }} /></span>
          <span className={styles.sumLabel}>{progressLabel}</span>
        </button>
        <ul className={styles.sumRows}>
          {rows.map(r => (
            <li key={r.key}>
              <button type="button" className={styles.sumRow} onClick={onOpenPlan}>
                <span className={styles.sumN}>{r.n}</span>
                <span className={styles.sumRowLabel}>{r.label}</span>
                <span className={r.issue ? (r.key === 'barrier' ? styles.textWarning : styles.textDanger) : styles.sumOk}>{r.issue || 'On track'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const SUMMARY_LIMIT = 3;
const shortDay = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * Program Summary: the clinical picture across the programs. Conditions and
 * how the monitored goals stand, each goal's latest reading against its
 * target, then overdue interventions and barriers nothing is addressing.
 * Rows open the goal, intervention or barrier in its drawer.
 */
function ProgramSummary({ clinical, unity, onOpenItem }) {
  const [all, setAll] = useState(false);
  const { readings, concerns } = clinical;
  // Unity writes the lead and the points; the readings and concerns below
  // stay the records' own rows, so they keep opening their items.
  const ai = unity.state === 'ready' ? unity.insights.summary : null;
  const lead = ai ? ai.lead : clinical.lead;
  const hidden = Math.max(0, readings.length - SUMMARY_LIMIT) + Math.max(0, concerns.length - SUMMARY_LIMIT);
  const shownReadings = all ? readings : readings.slice(0, SUMMARY_LIMIT);
  const shownConcerns = all ? concerns : concerns.slice(0, SUMMARY_LIMIT);
  const copy = [
    lead,
    ...(ai ? ai.points.map(p => `${p.title}: ${p.body}`) : []),
    ...readings.map(r => `${r.title}: ${r.value}${r.target ? ` (target ${r.target})` : ''}`),
    ...concerns.map(c => `${c.label}: ${c.title}${c.text ? ` (${c.text})` : ''}`),
  ].join('\n');
  const codes = ps => ps.map(p => <Badge key={p.id} size="sm" label={p.code} />);
  return (
    <DashboardCard
      className={ai ? undefined : styles.insight}
      tone={ai ? 'ai' : undefined}
      icon={ai ? 'custom:ai' : 'solar:document-text-linear'}
      title="Program Summary"
      actions={(
        <span className={styles.cardActions}>
          <SummarizeAction unity={unity} />
          {!ai && <CopyButton text={copy} />}
          {hidden > 0 && (
            <button type="button" className={styles.linkBtn} aria-expanded={all} onClick={() => setAll(v => !v)}>
              {all ? 'Show Less' : `Show ${hidden} More`}
              <DownChevronIcon size={12} color="currentColor" className={all ? styles.chevUp : undefined} />
            </button>
          )}
        </span>
      )}
      footer={ai ? <UnityFooter unity={unity} copy={copy} /> : null}
    >
      <div className={styles.clinBody}>
        {unity.state === 'loading' ? <AiSummarySkeleton /> : <p className={styles.clinLead}>{lead}</p>}
        {ai && ai.points.length > 0 && unity.state !== 'loading' && (
          <ul className={styles.unityPoints}>
            {ai.points.map(p => <li key={p.title}><strong>{p.title}:</strong> {p.body}</li>)}
          </ul>
        )}
        {shownReadings.length > 0 && (
          <div className={styles.clinGroup}>
            <h4 className={styles.clinLabel}>Latest Readings</h4>
            <ul className={styles.clinList}>
              {shownReadings.map(r => (
                <li key={r.key}>
                  <button type="button" className={styles.clinRow} onClick={() => onOpenItem({ kind: 'goal', ...r.ref })} title={r.goal}>
                    <span className={styles.clinTop}>
                      <span className={styles.clinName}>{r.title}</span>
                      <span className={r.met === false ? styles.clinValueOff : r.met === true ? styles.clinValueOk : styles.clinValue}>{r.value}</span>
                    </span>
                    <span className={styles.clinMeta}>
                      {[r.target && `Target ${r.target}`, r.met === false ? 'Off target' : r.met === true ? 'In range' : '', shortDay(r.takenAt), r.prior && `Prior ${r.prior}`].filter(Boolean).join(' • ')}
                    </span>
                    <span className={styles.clinCodes}>{codes(r.programs)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {shownConcerns.length > 0 && (
          <div className={styles.clinGroup}>
            <h4 className={styles.clinLabel}>Open Concerns</h4>
            <ul className={styles.clinList}>
              {shownConcerns.map(c => (
                <li key={c.key}>
                  <button type="button" className={styles.clinRow} onClick={() => onOpenItem({ kind: c.kind, ...c.ref })}>
                    <span className={styles.clinTop}>
                      <span className={c.kind === 'intervention' ? styles.dotDanger : styles.dotWarning} aria-hidden="true" />
                      <span className={styles.clinName}>{c.title}</span>
                    </span>
                    <span className={styles.clinMeta}>{[c.label, c.text].filter(Boolean).join(' • ')}</span>
                    <span className={styles.clinCodes}>{codes(c.programs)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}

/**
 * The Care Programs tab's overview (care plan redesign prototype): programs
 * active problems and recent activity on the left; Why Prioritized and Next
 * Best Actions in the middle; Suggested Actions, the Care Plan Summary and
 * Program Summary on the right (or on the left when there's no room for three
 * columns).
 * Everything comes from the patient's records; Why Prioritized and Program
 * Summary can also be written by Unity on request (useCareProgramsInsights).
 */
export function CareProgramsOverview({
  patientId, programs, onOpenProgram, onOpenStep, onOpenPlan, onOpenLog,
  onStatusMenu, onRowMenu, onAssign, onEnroll, eligible = null,
}) {
  const data = useCareProgramsOverview(patientId, programs);
  const unity = useCareProgramsInsights(patientId, data);
  const [allCards, setAllCards] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [openStep, setOpenStep] = useState(null);
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
  const onRun = (row) => {
    if (row.kind === 'step') setOpenStep({ program: row.refs[0].program, stepId: row.refs[0].step.id });
    else if (row.kind === 'plan') onOpenPlan(row.ref.program);
    else setOpenItem({ kind: row.kind, ...row.ref });
  };
  // A Unity takeaway names the action, reading or concern it is about by key.
  const openRef = (key) => {
    const action = data.actions.find(a => a.key === key);
    if (action) { onRun(action); return; }
    const reading = data.clinical.readings.find(r => r.key === key);
    if (reading) { setOpenItem({ kind: 'goal', ...reading.ref }); return; }
    const concern = data.clinical.concerns.find(c => c.key === key);
    if (concern) setOpenItem({ kind: concern.kind, ...concern.ref });
  };
  const summaries = (
    <>
      <ProgramSuggestedActions patientId={patientId} programs={programs} onEnroll={onEnroll} onOpenStep={onOpenStep} />
      <CarePlanSummary data={data} onOpenPlan={() => onOpenPlan(null)} />
      <ProgramSummary clinical={data.clinical} unity={unity} onOpenItem={setOpenItem} />
    </>
  );

  // The drawer reads the item from the live plan so its edits show at once.
  const livePlan = openItem && data.entries.find(e => e.program.id === openItem.program?.id)?.carePlan;
  const liveItem = openItem && { ...openItem, item: livePlan?.[KIND_LIST[openItem.kind]]?.find(x => x.id === openItem.item.id) || openItem.item };

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
            {order.length > CARD_LIMIT && <MoreButton open={allCards} hidden={order.length - CARD_LIMIT} onToggle={() => setAllCards(v => !v)} />}
          </DashboardCard>
          {eligible}
          <div className={styles.sumLeft}>{summaries}</div>
          <ActiveProblems problems={data.problems} loaded={data.problemsLoaded} />
          <SinceLastVisit activity={data.activity} lastVisit={lastVisit} onOpenLog={onOpenLog} />
        </div>
        <div className={styles.main}>
          <WhyPrioritized why={data.why} unity={unity} onOpenRef={openRef} />
          <NextBestActions actions={data.actions} programs={order.map(o => data.entries[o.index].program)} onRun={onRun} />
        </div>
        <div className={styles.right}>{summaries}</div>
      </div>
      <ProgramStepDrawer open={openStep} onOpenProgram={onOpenStep} onClose={() => setOpenStep(null)} />
      <CarePlanItemDrawer open={liveItem} patientId={patientId} onOpen={setOpenItem} onClose={() => setOpenItem(null)} />
    </div>
  );
}
