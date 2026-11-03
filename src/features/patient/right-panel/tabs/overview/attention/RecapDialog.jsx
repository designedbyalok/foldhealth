import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../components/Button/Button';
import { Icon } from '../../../../../../components/Icon/Icon';
import { AiInsightIcon } from '../../../../../../components/Icon/AiInsightIcon';
import { SlideshowDialog } from '../../../../../../components/SlideshowDialog/SlideshowDialog';
import { Toggle } from '../../../../../../components/Toggle/Toggle';
import { useAppStore } from '../../../../../../store/useAppStore';
import { kindMeta } from '../../timeline/streamKinds';
import { VitalTile } from '../cards/VitalsCard';
import { overviewVitals } from '../cards/vitalsData';
import { SignalActions } from './CardInsights';
import { RECAP_PERIODS, buildRecap, fmtDate, recapWindow } from './recapStory';
import {
  attentionChanges, clinicalChanges, medicationChanges, programChanges, touchpointChanges, vitalChanges,
} from './recapChanges';
import { INSIGHT_WIDGETS, signalsByWidget, widgetInsightSummary } from './widgetInsights';
import { recapAiPayload, sampleSummaries, writeRecapSummaries } from './recapAi';
import styles from './RecapDialog.module.css';

// Each slide carries a lot to read, so it stays up longer than the default.
const AUTOPLAY_MS = 10000;
const SEVERITY_COLOR = { high: 'var(--status-error)', medium: 'var(--status-warning)', low: 'var(--status-info)' };
const OUTCOME_TONE = { success: 'success', warning: 'warning', error: 'danger' };
const DELTA_TONE = { worse: 'danger', better: 'success', neutral: 'neutral' };
const NOTE_CLASS = { worse: styles.noteWorse, better: styles.noteBetter };

const pad = n => String(n).padStart(2, '0');
const duration = s => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const joinList = parts => (parts.length <= 1 ? parts.join('')
  : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);
const shortDate = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
};

function KindTile({ kind }) {
  const m = kindMeta(kind);
  return (
    <span className={styles.kindTile} style={{ background: m.tint, color: m.color }}>
      <Icon name={m.icon} size={14} />
    </span>
  );
}

/** A captioned white card: the building block of every slide body. */
function Card({ title, children }) {
  return (
    <section className={styles.block}>
      {title && <h4 className={styles.blockTitle}>{title}</h4>}
      <div className={styles.card}>{children}</div>
    </section>
  );
}

/** The slide's key numbers in one strip, each with how it moved. */
function Kpis({ items }) {
  return (
    <div className={styles.kpis}>
      {items.map(k => (
        <div key={k.label} className={styles.kpi}>
          <span className={styles.kpiLabel}>{k.label}</span>
          <span className={styles.kpiValueRow}>
            <span className={`${styles.kpiValue} ${k.tone === 'worse' ? styles.kpiWorse : ''}`}>{k.value}</span>
            {k.delta && <Badge tone={DELTA_TONE[k.tone || 'neutral']} size="sm" label={k.delta} />}
          </span>
          {k.sub && <span className={styles.kpiSub}>{k.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/** Before → after rows for what moved. */
function ChangeRows({ rows }) {
  return (
    <ul className={styles.rows}>
      {rows.map(r => (
        <li key={r.key} className={styles.change}>
          <span className={styles.changeLabel}>{r.label}</span>
          <span className={styles.changeValues}>
            {r.from != null && r.from !== r.to && (
              <>
                <span className={styles.changeFrom}>{r.from}</span>
                <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-200)" />
              </>
            )}
            <span className={styles.changeTo}>{r.to}</span>
            {r.delta && <Badge tone={DELTA_TONE[r.tone]} size="sm" label={r.delta} />}
          </span>
          <span className={`${styles.changeNote} ${NOTE_CLASS[r.tone] || ''}`}>{r.note}</span>
        </li>
      ))}
    </ul>
  );
}

/** What happened, one row each: when, what, who, and how it went. */
function EventRows({ events, newSince }) {
  return (
    <ol className={styles.rows}>
      {events.map((e) => {
        const d = new Date(e.at);
        const hasTime = d.getHours() || d.getMinutes();
        const meta = [
          e.detail,
          e.actor && `${e.actor}${e.actorRole ? ` (${e.actorRole})` : ''}`,
          e.program,
          e.durationSeconds && duration(e.durationSeconds),
          e.vendor && `via ${e.vendor}`,
        ].filter(Boolean);
        return (
          <li key={e.id} className={styles.event}>
            <span className={styles.eventWhen}>
              <span className={styles.eventDate}>{shortDate(e.at)}</span>
              <span className={styles.eventTime}>
                {hasTime ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : d.getFullYear()}
              </span>
            </span>
            <KindTile kind={e.kind} />
            <span className={styles.eventText}>
              <span className={styles.eventTitleRow}>
                <span className={styles.eventTitle}>{e.title}</span>
                {newSince != null && e.at >= newSince && <Badge tone="info" size="sm" label="New" />}
              </span>
              {meta.length > 0 && <span className={styles.eventMeta}>{meta.join(' • ')}</span>}
            </span>
            {e.outcome && <Badge tone={OUTCOME_TONE[e.tone] || 'neutral'} size="sm" label={e.outcome} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Open items with their next step; reviewed ones dimmed with who reviewed them. */
function SignalRows({ signals, reviews, onRun, onReview }) {
  return (
    <ul className={styles.rows}>
      {signals.map((s) => {
        const review = reviews[s.id];
        return (
          <li key={s.id} className={`${styles.signal} ${review ? styles.signalReviewed : ''}`}>
            <span
              className={styles.signalDot}
              style={{ background: review ? 'var(--neutral-150)' : SEVERITY_COLOR[s.severity] }}
              aria-hidden="true"
            />
            <span className={styles.eventText}>
              <span className={styles.eventTitleRow}>
                <span className={styles.eventTitle}>{s.title}</span>
                {s.isNew && !review && <Badge tone="info" size="sm" label="New" />}
              </span>
              <span className={styles.eventMeta}>
                {review
                  ? `Reviewed by ${review.reviewedByName || 'a teammate'} ${fmtDate(new Date(review.reviewedAt).getTime())}`
                  : s.detail}
              </span>
            </span>
            <span className={styles.signalActions}>
              {review
                ? <ActionButton icon="solar:restart-linear" size="sm" tooltip="Mark not reviewed" onClick={() => onReview(s, false)} />
                : <SignalActions signal={s} onRun={onRun} onReview={onReview} />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Moment({ label, event: e, empty }) {
  return (
    <div className={styles.moment}>
      <span className={styles.kpiLabel}>{label}</span>
      {e ? (
        <span className={styles.momentBody}>
          <KindTile kind={e.kind} />
          <span className={styles.eventText}>
            <span className={styles.eventTitle}>{e.title}</span>
            <span className={styles.eventMeta}>{[fmtDate(e.at), e.actor].filter(Boolean).join(' • ')}</span>
          </span>
        </span>
      ) : <span className={styles.momentEmpty}>{empty}</span>}
    </div>
  );
}

const generatedLabel = iso => `Generated ${fmtDate(iso)}, ${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

/**
 * The section's plain-language summary, under the headline: Unity's saved
 * one, headed "Unity summary" with when it was written and a Refresh, or
 * (when Unity can't answer) one written from the recorded facts, shown as
 * the paragraph alone.
 */
function AiSummary({ state, sectionKey, sample, onRefresh }) {
  const loading = !!state?.loading;
  const text = state?.saved?.summaries?.[sectionKey];
  const fromUnity = !loading && !!text;
  return (
    <div className={styles.ai} aria-busy={loading || undefined}>
      {(loading || fromUnity) && (
        <span className={styles.aiHead}>
          <AiInsightIcon size={16} />
          Unity summary
          {fromUnity && (
            <span className={styles.aiMeta}>
              {generatedLabel(state.saved.generatedAt)}
              <ActionButton icon="solar:refresh-linear" size="sm" tooltip="Refresh summary" onClick={onRefresh} />
            </span>
          )}
        </span>
      )}
      {loading ? (
        <span className={styles.aiSkeleton} aria-label="Writing the summary">
          <span />
          <span />
        </span>
      ) : (
        <p className={styles.aiText}>{fromUnity ? text : sample}</p>
      )}
    </div>
  );
}

const rowByKey = (section, key) => section.rows.find(r => r.key === key);

// Per user, per patient: what the Recap held when this user last opened it,
// kept with their other panel preferences (user_panel_layouts).
const SEEN_KEY = 'recapSeen';
// A short fingerprint of the open items and recorded events, so anything new
// since the last look makes the Recap read as unseen again.
function recapSignature(openSignals, events) {
  const text = `${openSignals.map(s => s.id).sort().join(',')}|${events.length}`;
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Recap: the pill at the top of the Overview and the walkthrough it opens.
 * One slide per area (touchpoints, clinical events, vitals, medications,
 * programs, open items). Each leads with one headline of what changed,
 * a strip of key numbers against the period before, then the rows behind
 * them. Same signals as the cards' Unity strips.
 */
export function RecapButton({ patient, overview, attention, run, review, onOpenTimeline }) {
  const [open, setOpen] = useState(false);
  // The recap's "now": the moment it was opened.
  const [openedAt, setOpenedAt] = useState(null);
  // Where the Recap button sits, so the dialog grows out of it and returns to it.
  const [origin, setOrigin] = useState(null);
  const [period, setPeriod] = useState('30');
  const { events, signals, open: openSignals, reviews, since, memberId } = attention;
  const vitals = useMemo(() => overviewVitals(overview, memberId), [overview, memberId]);
  const seenMap = useAppStore(s => s.panelLayouts[SEEN_KEY]);
  const savePanelLayout = useAppStore(s => s.savePanelLayout);
  const signature = useMemo(() => recapSignature(openSignals, events), [openSignals, events]);
  const seen = !!memberId && seenMap?.[memberId] === signature;
  const openRecap = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    setOpenedAt(Date.now());
    setOpen(true);
    if (memberId && !seen) savePanelLayout(SEEN_KEY, { ...(seenMap || {}), [memberId]: signature });
  };

  // The facts behind every slide, computed once per opening and period.
  const model = useMemo(() => {
    if (openedAt == null) return null;
    const now = openedAt;
    const { from, label } = recapWindow(period, { events, now });
    const recap = buildRecap({ events, from, now, openCount: openSignals.length });
    const win = { from, now, periodLabel: period === 'touch' ? 'period' : `${period} days` };
    const ch = {
      touchpoints: touchpointChanges(events, win),
      clinical: clinicalChanges(events, win),
      vitals: vitalChanges(vitals),
      medications: medicationChanges(events, win),
      programs: programChanges(events, win),
      attention: attentionChanges(signals, reviews, win),
    };
    return { label, recap, ch };
  }, [openedAt, period, events, signals, openSignals.length, reviews, vitals]);

  const aiPayload = useMemo(() => {
    if (!model) return null;
    const { recap, ch } = model;
    const periodText = period === 'touch' ? model.label.replace(/^since/, 'Since') : `the last ${period} days`;
    const sections = [
      { key: 'glance', title: 'At a glance', headline: `${recap.summary.join(' ')}`, changes: Object.entries(ch).map(([k, c]) => ({ label: k, to: c.headline })) },
      { key: 'touchpoints', title: 'Touchpoints', headline: ch.touchpoints.headline, changes: ch.touchpoints.rows, events: recap.touchpoints },
      { key: 'clinical', title: 'Clinical events', headline: ch.clinical.headline, changes: ch.clinical.rows, events: recap.clinical.length ? recap.clinical : recap.earlierClinical, items: signals.filter(s => s.kind === 'adt') },
      ...(vitals.length ? [{ key: 'vitals', title: 'Vitals and labs', headline: ch.vitals.headline, changes: ch.vitals.rows, items: signals.filter(s => s.kind === 'vital' || s.kind === 'lab') }] : []),
      { key: 'medications', title: 'Medications', headline: ch.medications.headline, changes: ch.medications.rows, events: recap.medications },
      { key: 'programs', title: 'Care programs', headline: ch.programs.headline, changes: ch.programs.rows, events: recap.programs },
      ...(signals.length ? [{ key: 'attention', title: 'Needs attention', headline: ch.attention.headline, items: openSignals }] : []),
    ];
    return recapAiPayload({ patientName: patient?.name, period: periodText, sections });
  }, [model, period, signals, openSignals, vitals, patient?.name]);
  // Unity's summaries, saved per user, patient and period: reopening shows
  // the saved ones; Unity writes new ones the first time or on Refresh.
  const summaryKey = memberId ? `${memberId}|${period}` : null;
  const aiState = useAppStore(s => (summaryKey ? s.recapSummaries[summaryKey] : undefined));
  // Not looked up yet reads as loading, so the fallback text never flashes first.
  const aiView = useMemo(() => (summaryKey ? (aiState || { loading: true }) : {}), [summaryKey, aiState]);
  const loadRecapSummaries = useAppStore(s => s.loadRecapSummaries);
  const refreshRecapSummaries = useAppStore(s => s.refreshRecapSummaries);
  useEffect(() => {
    if (!open || !memberId || !aiPayload) return;
    loadRecapSummaries(memberId, period, () => writeRecapSummaries(aiPayload));
  }, [open, memberId, period, aiPayload, loadRecapSummaries]);
  const refreshSummaries = useCallback(() => {
    if (!memberId || !aiPayload || aiState?.loading) return;
    refreshRecapSummaries(memberId, period, () => writeRecapSummaries(aiPayload));
  }, [memberId, period, aiPayload, aiState?.loading, refreshRecapSummaries]);

  const steps = useMemo(() => {
    if (!model) return [];
    const { label, recap, ch } = model;
    const samples = sampleSummaries({ recap, changes: ch, signals, openSignals });
    const summary = key => <AiSummary state={aiView} sectionKey={key} sample={samples[key]} onRefresh={refreshSummaries} />;
    const periodName = period === 'touch' ? 'Since last visit' : `Last ${period} days`;
    const eyebrow = title => `${title} • ${periodName}`;
    const runAndClose = (s) => { setOpen(false); run(s); };
    const signalRows = list => <SignalRows signals={list} reviews={reviews} onRun={runAndClose} onReview={review} />;
    const primaryFor = (list) => {
      const lead = list.find(s => s.action && !reviews[s.id]);
      return lead ? <Button size="sm" onClick={() => runAndClose(lead)}>{lead.action.label}</Button> : null;
    };
    const kpiFromRow = (lbl, row, sub) => ({ label: lbl, value: row?.to ?? '0', delta: row?.delta, tone: row?.tone, sub });
    const byWidget = signalsByWidget(openSignals);
    const out = [];

    // ── At a glance ──
    const parts = [
      recap.counts.touchpoints && plural(recap.counts.touchpoints, 'touchpoint'),
      recap.counts.clinical && plural(recap.counts.clinical, 'clinical record'),
      recap.counts.medications && plural(recap.counts.medications, 'medication change'),
      recap.counts.programs && plural(recap.counts.programs, 'program update'),
    ].filter(Boolean);
    const sections = [
      { key: 'touchpoints', icon: 'solar:chat-round-line-linear', label: 'Touchpoints', text: ch.touchpoints.headline },
      { key: 'clinical', icon: 'solar:stethoscope-linear', label: 'Clinical', text: ch.clinical.headline },
      ...(vitals.length ? [{ key: 'vitals', icon: 'solar:heart-pulse-linear', label: 'Vitals & Labs', text: ch.vitals.headline }] : []),
      { key: 'medications', icon: 'solar:pill-linear', label: 'Medications', text: ch.medications.headline },
      { key: 'programs', icon: 'solar:checklist-minimalistic-linear', label: 'Care Programs', text: ch.programs.headline },
      ...(signals.length ? [{ key: 'attention', icon: 'solar:bell-bing-linear', label: 'Needs Attention', text: ch.attention.headline }] : []),
    ];
    out.push({
      key: 'glance',
      icon: 'solar:document-text-linear',
      title: 'At a Glance',
      summary: parts.length ? joinList(parts) : 'Nothing recorded',
      eyebrow: eyebrow('At a Glance'),
      heading: parts.length ? `${joinList(parts)} ${label}.` : `Nothing was recorded ${label}.`,
      description: summary('glance'),
      preview: (
        <>
          <Kpis
            items={[
              kpiFromRow('Touchpoints', rowByKey(ch.touchpoints, 'total'), 'vs previous period'),
              { label: 'Clinical records', value: recap.counts.clinical },
              kpiFromRow('Active meds', rowByKey(ch.medications, 'active'), 'since period start'),
              kpiFromRow('Program activity', rowByKey(ch.programs, 'activity'), 'vs previous period'),
              { label: 'Open items', value: openSignals.length, tone: openSignals.length ? 'worse' : 'neutral' },
            ]}
          />
          <div className={styles.moments}>
            <Moment label="Last visit" event={recap.lastTouch} empty="No completed visit on record" />
            <Moment label="Coming up" event={recap.upcoming[0]} empty="Nothing scheduled" />
          </div>
        </>
      ),
      body: ({ goTo }) => (
        <>
          <Card title="What changed">
            <ul className={styles.rows}>
              {sections.map(s => (
                <li key={s.key}>
                  <button type="button" className={styles.sectionRow} onClick={() => goTo(s.key)}>
                    <Icon name={s.icon} size={16} color="var(--neutral-300)" />
                    <span className={styles.sectionLabel}>{s.label}</span>
                    <span className={styles.sectionText}>{s.text}</span>
                    <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-200)" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {recap.inWindow.length > 0 && (
            <Card title="Latest activity">
              <EventRows events={recap.inWindow.slice(0, 5)} newSince={since} />
            </Card>
          )}
        </>
      ),
    });

    // ── Touchpoints ──
    if (recap.touchpoints.length) {
      const total = rowByKey(ch.touchpoints, 'total');
      out.push({
        key: 'touchpoints',
        icon: 'solar:chat-round-line-linear',
        title: 'Touchpoints',
        count: recap.touchpoints.length,
        summary: `Last ${fmtDate(recap.touchpoints[0].at)}`,
        eyebrow: eyebrow('Touchpoints'),
        heading: ch.touchpoints.headline,
        description: summary('touchpoints'),
        preview: (
          <Kpis
            items={[
              kpiFromRow('Touchpoints', total, `was ${total.from}`),
              kpiFromRow('Completed', rowByKey(ch.touchpoints, 'completed')),
              { label: 'Channels', value: recap.channels.length, sub: recap.channels.map(c => kindMeta(c.kind).label).join(', ') },
              { label: 'Last visit', value: shortDate(recap.touchpoints[0].at), sub: recap.touchpoints[0].actor },
            ]}
          />
        ),
        body: (
          <>
            <Card title="What changed"><ChangeRows rows={ch.touchpoints.rows} /></Card>
            <Card title={`All touchpoints (${recap.touchpoints.length})`}>
              <EventRows events={recap.touchpoints} newSince={since} />
            </Card>
          </>
        ),
      });
    }

    // ── Clinical ──
    const hospital = signals.filter(s => s.kind === 'adt');
    const labRows = ch.clinical.rows.filter(r => r.key.startsWith('lab:'));
    const outOfRange = labRows.filter(r => r.tone === 'worse').length;
    out.push({
      key: 'clinical',
      icon: 'solar:stethoscope-linear',
      title: 'Clinical Events',
      count: recap.clinical.length || null,
      summary: recap.clinical.length ? ch.clinical.headline : 'Nothing new',
      eyebrow: eyebrow('Clinical Events'),
      heading: ch.clinical.headline,
      description: summary('clinical'),
      preview: (
        <Kpis
          items={[
            { label: 'New records', value: recap.clinical.length },
            { label: 'Lab results', value: labRows.length },
            { label: 'Out of range', value: outOfRange, tone: outOfRange ? 'worse' : 'neutral' },
            kpiFromRow('ED visits', rowByKey(ch.clinical, 'ed'), 'vs previous period'),
          ]}
        />
      ),
      body: (
        <>
          {hospital.length > 0 && <Card title="Hospital use">{signalRows(hospital)}</Card>}
          {ch.clinical.rows.length > 0 && <Card title="What changed"><ChangeRows rows={ch.clinical.rows} /></Card>}
          {recap.clinical.length > 0 && <Card title="Recorded"><EventRows events={recap.clinical} newSince={since} /></Card>}
          {!recap.clinical.length && recap.earlierClinical.length > 0 && (
            <Card title="Most recent, before this period"><EventRows events={recap.earlierClinical} /></Card>
          )}
        </>
      ),
      primary: primaryFor(byWidget.highlights || []),
    });

    // ── Vitals ──
    if (vitals.length) {
      const vitalSignals = signals.filter(s => s.kind === 'vital' || s.kind === 'lab');
      const openVital = vitalSignals.filter(s => !reviews[s.id]);
      const worse = ch.vitals.rows.filter(r => r.tone === 'worse').length;
      const better = ch.vitals.rows.filter(r => r.tone === 'better').length;
      const aboveGoal = vitals.filter(v => v.tone === 'error').length;
      out.push({
        key: 'vitals',
        icon: 'solar:heart-pulse-linear',
        title: 'Vitals & Labs',
        count: openVital.length || null,
        summary: openVital.length ? widgetInsightSummary('vitals', openVital) : 'All within goal',
        eyebrow: 'Vitals & Labs • Since the previous reading',
        heading: ch.vitals.headline,
        description: summary('vitals'),
        preview: (
          <>
            <Kpis
              items={[
                { label: 'Above goal', value: aboveGoal, tone: aboveGoal ? 'worse' : 'neutral', sub: `of ${vitals.length} tracked` },
                { label: 'Further from goal', value: worse, tone: worse ? 'worse' : 'neutral' },
                { label: 'Closer to goal', value: better },
              ]}
            />
            <div className={styles.vitals}>{vitals.map(v => <VitalTile key={v.key} vital={v} />)}</div>
          </>
        ),
        body: (
          <>
            <Card title="What changed"><ChangeRows rows={ch.vitals.rows} /></Card>
            {vitalSignals.length > 0 && <Card title="Open items">{signalRows(vitalSignals)}</Card>}
          </>
        ),
        primary: primaryFor(vitalSignals),
      });
    }

    // ── Medications ──
    const active = rowByKey(ch.medications, 'active');
    const medRows = ch.medications.rows.filter(r => r.key !== 'active');
    const startedCount = medRows.filter(r => r.label === 'Started').length;
    const stoppedCount = medRows.length - startedCount;
    out.push({
      key: 'medications',
      icon: 'solar:pill-linear',
      title: 'Medications',
      count: recap.medications.length || null,
      summary: recap.medications.length ? `${startedCount} started, ${stoppedCount} stopped` : 'No changes',
      eyebrow: eyebrow('Medications'),
      heading: ch.medications.headline,
      description: summary('medications'),
      preview: (
        <Kpis
          items={[
            kpiFromRow('Active', active, active.from !== active.to ? `was ${active.from}` : 'no change'),
            { label: 'Started', value: startedCount },
            { label: 'Stopped', value: stoppedCount },
          ]}
        />
      ),
      body: (
        <>
          {medRows.length > 0 && <Card title="What changed"><ChangeRows rows={medRows} /></Card>}
          {recap.medications.length > 0 && <Card title="Timeline"><EventRows events={recap.medications} newSince={since} /></Card>}
        </>
      ),
      primary: primaryFor(byWidget.medications || []),
    });

    // ── Programs ──
    const statusRows = ch.programs.rows.filter(r => r.key !== 'activity');
    out.push({
      key: 'programs',
      icon: 'solar:checklist-minimalistic-linear',
      title: 'Care Programs',
      count: recap.programs.length || null,
      summary: recap.programs.length ? recap.programs[0].title : 'No updates',
      eyebrow: eyebrow('Care Programs'),
      heading: ch.programs.headline,
      description: summary('programs'),
      preview: (
        <Kpis
          items={[
            { label: 'Programs', value: statusRows.length },
            { label: 'Status changes', value: statusRows.filter(r => r.note === 'Status changed').length },
            kpiFromRow('Activity', rowByKey(ch.programs, 'activity'), 'vs previous period'),
          ]}
        />
      ),
      body: (
        <>
          {statusRows.length > 0 && <Card title="Status"><ChangeRows rows={statusRows} /></Card>}
          {recap.programs.length > 0 && (
            <Card title={`Updates (${recap.programs.length})`}><EventRows events={recap.programs} newSince={since} /></Card>
          )}
        </>
      ),
    });

    // ── Needs attention ──
    if (signals.length) {
      const all = signalsByWidget(signals);
      out.push({
        key: 'attention',
        icon: 'solar:bell-bing-linear',
        iconColor: openSignals.length ? 'var(--status-warning)' : undefined,
        title: 'Needs Attention',
        count: openSignals.length || null,
        summary: `${signals.length - openSignals.length} reviewed`,
        eyebrow: 'Needs Attention • Most urgent first',
        heading: ch.attention.headline,
        description: summary('attention'),
        preview: (
          <Kpis
            items={[
              { label: 'Open', value: openSignals.length, tone: openSignals.length ? 'worse' : 'neutral' },
              { label: 'New since last visit', value: rowByKey(ch.attention, 'new').to },
              { label: 'Reviewed this period', value: rowByKey(ch.attention, 'reviewed').to },
            ]}
          />
        ),
        body: INSIGHT_WIDGETS.filter(w => all[w.key]?.length).map(w => (
          <Card key={w.key} title={w.title}>{signalRows(all[w.key])}</Card>
        )),
        primary: primaryFor(openSignals),
      });
    }
    return out;
  }, [model, aiView, refreshSummaries, period, signals, openSignals, reviews, since, vitals, run, review]);

  const subtitle = [
    attention.sinceIsLastTouch ? `Last visit ${fmtDate(since)}` : 'No completed visit on record',
    plural(openSignals.length, 'open item'),
  ].join(' • ');

  return (
    <>
      {/* Unity gradient fill until this user has opened the Recap; a gradient
          outline after, until something new comes in. */}
      <Button
        variant="outline"
        size="sm"
        className={`${styles.pill} ${seen ? styles.pillSeen : styles.pillUnseen}`}
        leadingIconElement={<AiInsightIcon size={16} tint={seen ? undefined : 'var(--neutral-0)'} />}
        aria-label={`Recap${openSignals.length ? `, ${openSignals.length} open items` : ''}${seen ? '' : ', new'}`}
        onClick={openRecap}
      >
        <span className={styles.pillLabel}>Recap</span>
        {openSignals.length > 0 && <span className={styles.pillCount}>{openSignals.length}</span>}
      </Button>
      <SlideshowDialog
        open={open}
        onOpenChange={setOpen}
        origin={origin}
        autoplayMs={AUTOPLAY_MS}
        leading={(
          <span className={styles.brand}>
            <AiInsightIcon size={20} />
            Unity Recap
          </span>
        )}
        title={patient?.name || 'Patient recap'}
        subtitle={subtitle}
        headerExtra={(
          <Toggle
            size="S"
            items={RECAP_PERIODS.map(p => ({ key: p.key, label: p.label }))}
            active={period}
            onChange={setPeriod}
          />
        )}
        steps={steps}
        footerStart={(
          <Button variant="ghost" size="sm" leadingIcon="solar:history-linear" onClick={() => { setOpen(false); onOpenTimeline(); }}>
            Open Timeline
          </Button>
        )}
      />
    </>
  );
}
