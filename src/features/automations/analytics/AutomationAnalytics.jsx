import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { ChartContainer } from '../../../components/ChartContainer/ChartContainer';
import { DashboardCardSkeleton } from '../../../components/DashboardCard/DashboardCard';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Link } from '../../../components/Link/Link';
import { RingEmptyState } from '../../../components/RingEmptyState/RingEmptyState';
import { Toggle } from '../../../components/Toggle/Toggle';
import { nodeDef, statusDef } from '../lib/catalog';
import {
  DURATIONS, channelFunnel, dailySeries, formatRange, inRange, nodeStats, overview, rangeFor,
} from '../lib/analytics';
import { AutomationCanvas } from '../canvas/AutomationCanvas';
import { AutomationStatsRow } from '../shared/AutomationStatsRow';
import {
  MEMBER_STATUSES, STEP_STATUSES, bucketSeries, channelTiles, fmtDate, formatSaved, num, rememberDrawer, peekReturnDrawer,
} from './analyticsUi';
import { ExecutionBarChart, KpiTile, StatusDonut } from './AnalyticsCharts';
import { OverviewDrawer } from './OverviewDrawer';
import { ChannelDrawer } from './ChannelDrawer';
import styles from './Analytics.module.css';

const VIEW_ITEMS = [{ key: 'global', label: 'Global' }, { key: 'node', label: 'Node Level' }];
const STATUS_LABELS = MEMBER_STATUSES.map(s => s.label);
const EMPTY_LIST = [];

/** Action steps of a graph, by label: [{ label, types: Set }]. */
function actionTypesOf(graph) {
  const byLabel = new Map();
  for (const n of graph?.nodes || []) {
    const def = nodeDef(n.type);
    if (def?.kind !== 'action' || n.type === 'microAutomation') continue;
    const label = def.nodeLabel || def.label;
    if (!byLabel.has(label)) byLabel.set(label, new Set());
    byLabel.get(label).add(n.type);
  }
  return [...byLabel].map(([label, types]) => ({ label, types }));
}

/**
 * Automation analytics (Settings > Automations > an automation > Analytics).
 * Global: overview, email and SMS cards. Node Level: the flow with each
 * step's member counts. Every figure comes from the run records through
 * lib/analytics.js, filtered by Duration, Action types and Status.
 */
export function AutomationAnalytics({ id }) {
  const automation = useAppStore(s => s.automations.find(a => a.id === id));
  const automationsStatus = useAppStore(s => s.automationsStatus);
  const activity = useAppStore(s => s.automationActivity[id]);
  const view = useAppStore(s => s.automationsView);
  const fetchAutomationActivity = useAppStore(s => s.fetchAutomationActivity);
  const setAutomationsView = useAppStore(s => s.setAutomationsView);
  const openAutomationAnalytics = useAppStore(s => s.openAutomationAnalytics);
  const openAutomationBuilder = useAppStore(s => s.openAutomationBuilder);
  const openAutomationsList = useAppStore(s => s.openAutomationsList);
  const openAutomationTrace = useAppStore(s => s.openAutomationTrace);

  const [duration, setDuration] = useState('lastWeek');
  const [actionLabels, setActionLabels] = useState(EMPTY_LIST);
  const [statusLabels, setStatusLabels] = useState(EMPTY_LIST);
  // The open drawer: the store's `drawer` (failure toast, deep link) wins,
  // else the one opened here or remembered from a member trace.
  const [localDrawer, setLocalDrawer] = useState(() => peekReturnDrawer(id));
  const drawer = view.drawer || localDrawer;

  // Wait for the list: before it lands the slice doesn't yet know whether to
  // read Supabase or the local seed, and would cache an empty activity.
  useEffect(() => {
    if (automationsStatus === 'ready') fetchAutomationActivity(id);
  }, [id, automationsStatus, fetchAutomationActivity]);
  // The remembered drawer was read into state above; forget it.
  useEffect(() => { rememberDrawer(id, null); }, [id]);

  const runs = activity?.runs || EMPTY_LIST;
  const allMembers = activity?.members || EMPTY_LIST;
  const allMessages = activity?.messages || EMPTY_LIST;
  const graph = automation?.graph;
  const tab = view.analyticsTab === 'node' ? 'node' : 'global';

  // Clock for the duration range; refreshed when the duration changes. The
  // range runs to the end of today so runs started here (Retry) still count.
  const [now, setNow] = useState(() => new Date());
  const range = useMemo(() => {
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    return { ...rangeFor(duration, now), to };
  }, [duration, now]);
  const actionTypes = useMemo(() => actionTypesOf(graph), [graph]);

  const runGraphs = useMemo(() => new Map(runs.filter(r => r.graph).map(r => [r.id, r.graph])), [runs]);
  const graphOf = useCallback((m) => runGraphs.get(m.runId) || graph, [runGraphs, graph]);

  const statusKeys = useMemo(() => new Set(MEMBER_STATUSES.filter(s => statusLabels.includes(s.label)).map(s => s.key)), [statusLabels]);
  const members = useMemo(() => allMembers.filter(m => inRange(m.startedAt, range) && (!statusKeys.size || statusKeys.has(m.status))), [allMembers, range, statusKeys]);
  const membersById = useMemo(() => new Map(allMembers.map(m => [m.id, m])), [allMembers]);
  const messages = useMemo(() => {
    const types = new Set(actionTypes.filter(a => actionLabels.includes(a.label)).flatMap(a => [...a.types]));
    return allMessages.filter(msg => {
      if (!inRange(msg.sentAt, range)) return false;
      if (statusKeys.size && !statusKeys.has(membersById.get(msg.runMemberId)?.status)) return false;
      if (types.size) {
        const run = runGraphs.get(msg.runId) || graph;
        const type = run?.nodes?.find(n => n.id === msg.nodeId)?.type;
        if (!types.has(type)) return false;
      }
      return true;
    });
  }, [allMessages, range, statusKeys, membersById, actionTypes, actionLabels, runGraphs, graph]);

  const ov = useMemo(() => overview(members), [members]);
  const email = useMemo(() => channelFunnel(messages, 'email'), [messages]);
  const sms = useMemo(() => channelFunnel(messages, 'sms'), [messages]);
  const emailSeries = useMemo(() => bucketSeries(dailySeries(messages, 'email', range)), [messages, range]);
  const smsSeries = useMemo(() => bucketSeries(dailySeries(messages, 'sms', range)), [messages, range]);
  const stats = useMemo(() => (tab === 'node' && graph ? nodeStats(members, graph) : null), [tab, members, graph]);

  const openDrawer = (d) => {
    setLocalDrawer(d);
    if (view.drawer) setAutomationsView({ drawer: null });
  };
  const closeDrawer = () => openDrawer(null);
  const openTrace = (runMemberId) => {
    rememberDrawer(id, drawer);
    openAutomationTrace(id, runMemberId);
  };

  const filtered = duration !== 'lastWeek' || actionLabels.length > 0 || statusLabels.length > 0;
  const clearAll = () => { setDuration('lastWeek'); setActionLabels(EMPTY_LIST); setStatusLabels(EMPTY_LIST); setNow(new Date()); };

  if (!automation) {
    if (automationsStatus !== 'ready') return <div className={styles.page}><Skeletons /></div>;
    return (
      <div className={`${styles.page} ${styles.centered}`}>
        <RingEmptyState icon="solar:bolt-linear" label="This automation was not found. It may have been deleted.">
          <Button variant="outline" leadingIcon="solar:arrow-left-linear" onClick={() => openAutomationsList()}>Back to automations</Button>
        </RingEmptyState>
      </div>
    );
  }

  const loading = !activity || activity.status === 'loading';
  const status = statusDef(automation.status);
  const [drawerKind, drawerArg] = (drawer || '').split(':');
  const nothing = !members.length && !messages.length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <ActionButton icon="solar:arrow-left-linear" tooltip="Back to automations" aria-label="Back to automations" onClick={() => openAutomationsList()} />
          <h1 className={styles.title}>{automation.name}</h1>
          <Badge tone={status.tone} size="sm" label={status.label} />
          <div className={styles.headerActions}>
            <Toggle items={VIEW_ITEMS} value={tab} onValueChange={k => openAutomationAnalytics(id, k)} />
            <span className={styles.headerDivider} aria-hidden />
            <Button variant="outline" leadingIcon="solar:pen-linear" onClick={() => openAutomationBuilder(id)}>Edit automation</Button>
          </div>
        </div>
        <p className={styles.meta}>
          {[
            automation.createdBy && `Created by ${automation.createdBy}`,
            automation.updatedAt && `Last edited ${fmtDate(automation.updatedAt)}${automation.updatedBy ? ` by ${automation.updatedBy}` : ''}`,
          ].filter(Boolean).join(' • ')}
        </p>
        {automation.description && <p className={styles.description}>{automation.description}</p>}
      </header>

      <AutomationStatsRow automation={automation} runs={runs} members={allMembers} />

      <div className={styles.filters}>
        <FilterChip
          label="Duration"
          options={DURATIONS.map(d => d.label)}
          selected={[DURATIONS.find(d => d.value === duration)?.label]}
          onChange={([label]) => { if (label) { setDuration(DURATIONS.find(d => d.label === label).value); setNow(new Date()); } }}
          singleSelect
          noClear
        />
        {tab === 'global' && actionTypes.length > 0 && (
          <FilterChip label="Action types" options={actionTypes.map(a => a.label)} selected={actionLabels} onChange={setActionLabels} />
        )}
        <FilterChip label="Status" options={STATUS_LABELS} selected={statusLabels} onChange={setStatusLabels} />
        <span className={styles.rangeText}>{formatRange(range)}</span>
        {filtered && <Link className={styles.clearAll} onClick={clearAll} role="button" tabIndex={0}>Clear all</Link>}
      </div>

      {loading ? <Skeletons /> : tab === 'node' ? (
        <div className={styles.nodeWrap}>
          <div className={styles.nodeLegend}>
            {STEP_STATUSES.map(s => (
              <span key={s.key} className={styles.legendItem}>
                <span className={styles.dot} style={{ background: s.color }} aria-hidden />
                {s.label}
              </span>
            ))}
          </div>
          <div className={styles.canvasBox}>
            <AutomationCanvas graph={graph} mode="stats" stats={stats} />
          </div>
        </div>
      ) : nothing ? (
        <div className={styles.emptyBox}>
          <RingEmptyState icon="solar:chart-2-linear" label={`No executions between ${formatRange(range)}. Try a longer duration.`} />
        </div>
      ) : (
        <div className={styles.cards}>
          <ChartContainer
            title="Automation Overview"
            info="Members the automation ran for in this range and how their runs ended."
            subtitle={formatRange(range)}
            empty={!members.length}
            emptyLabel="No members in this range"
            onExpand={() => openDrawer('overview:completed')}
          >
            <div className={styles.tiles} style={{ '--tile-count': 3 }}>
              <KpiTile label="Total executions" icon="solar:bolt-linear" value={num(ov.total)} />
              <KpiTile label="Success ratio" icon="solar:check-square-linear" value={ov.successRatio == null ? '-' : `${ov.successRatio}%`} info={ov.successRatio == null ? null : 'Completed members out of members who finished (completed or failed).'} />
              <KpiTile label="Time saved" icon="solar:clock-circle-linear" value={formatSaved(ov.minutesSaved)} />
            </div>
            <StatusDonut
              data={MEMBER_STATUSES.map(s => ({ key: s.key, label: s.label, color: s.color, value: s.key === 'completed' ? ov.completed : s.key === 'failed' ? ov.failed : ov.inProgress }))}
              onSelect={k => openDrawer(`overview:${k}`)}
            />
          </ChartContainer>

          <ChartContainer
            title="Email Execution"
            info="Emails sent by this automation’s steps. Opens and clicks count each member once."
            subtitle={formatRange(range)}
            empty={!email.sent}
            emptyLabel="No emails sent in this range"
            onExpand={() => openDrawer('email:sent')}
          >
            <div className={styles.tiles} style={{ '--tile-count': 5 }}>
              {channelTiles('email', email).map(({ key, ...t }) => <KpiTile key={key} {...t} onClick={() => openDrawer(`email:${key}`)} />)}
            </div>
            <ExecutionBarChart data={emailSeries} keys={['sent', 'delivered', 'opened', 'clicked', 'failed']} />
          </ChartContainer>

          <ChartContainer
            title="SMS Execution"
            info="Text messages sent by this automation’s steps."
            subtitle={formatRange(range)}
            empty={!sms.sent}
            emptyLabel="No texts sent in this range"
            onExpand={() => openDrawer('sms:sent')}
          >
            <div className={styles.tiles} style={{ '--tile-count': 3 }}>
              {channelTiles('sms', sms).map(({ key, ...t }) => <KpiTile key={key} {...t} onClick={() => openDrawer(`sms:${key}`)} />)}
            </div>
            <ExecutionBarChart data={smsSeries} keys={['sent', 'delivered', 'failed']} />
          </ChartContainer>
        </div>
      )}

      {!loading && drawerKind === 'overview' && (
        <OverviewDrawer
          automation={automation}
          graphOf={graphOf}
          members={members}
          range={range}
          tab={MEMBER_STATUSES.some(s => s.key === drawerArg) ? drawerArg : 'completed'}
          onTab={k => openDrawer(`overview:${k}`)}
          onOpenTrace={openTrace}
          onClose={closeDrawer}
        />
      )}
      {!loading && (drawerKind === 'email' || drawerKind === 'sms') && (
        <ChannelDrawer
          automation={automation}
          channel={drawerKind}
          tile={drawerArg || 'sent'}
          onTile={k => openDrawer(`${drawerKind}:${k}`)}
          messages={messages}
          membersById={membersById}
          range={range}
          onOpenTrace={openTrace}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}

function Skeletons() {
  return (
    <div className={styles.cards}>
      <DashboardCardSkeleton title="Automation Overview" rows={4} />
      <DashboardCardSkeleton title="Email Execution" rows={4} />
      <DashboardCardSkeleton title="SMS Execution" rows={4} />
    </div>
  );
}
