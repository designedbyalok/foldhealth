import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardCard, DashboardCardBody } from '../../../../../../components/DashboardCard/DashboardCard';
import { Icon } from '../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { ColumnConfigPopover } from '../../../../../../components/ColumnConfigPopover/ColumnConfigPopover';
import { useAppStore } from '../../../../../../store/useAppStore';
import { vitalsHistory } from '../../../../left-panel/tabs/vitals-labs/vitalsConfig';
import { shownVitals, vitalCatalog } from './vitalsData';
import {
  ResponsiveContainer, AreaChart, Area, YAxis, Tooltip, ReferenceLine,
} from '../../../../../../components/LazyRecharts/LazyRecharts';
import { goalTarget } from './vitalGoal';
import styles from './overviewCards.module.css';
import { CardHeaderActions, CardInsights } from '../attention/CardInsights';

const TONE_COLOR = {
  error: 'var(--status-error-dark)',
  warning: 'var(--status-warning-dark)',
  success: 'var(--status-success-dark)',
};

const SOURCE_ICON = {
  bp: 'solar:stethoscope-linear',
  a1c: 'solar:test-tube-linear',
  glucose: 'solar:test-tube-linear',
  bmi: 'solar:scale-linear',
};

function ageLabel(measuredAt) {
  if (!measuredAt) return null;
  const match = String(measuredAt).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return measuredAt;
  const then = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
  const days = Math.round((Date.now() - then.getTime()) / 86400000);
  if (Number.isNaN(days) || days < 0 || days >= 90) return measuredAt;
  if (days === 0) return 'Today';
  return `${days} d`;
}

// One reading under the cursor, with the goal. Only the latest reading has a
// date and the full value (e.g. 142/88); earlier BP readings carry a
// diastolic only when the data has a `diastolicSeries`.
function VitalTooltip({ active, payload, unit, measuredAt, latestValue, goal, dual, total }) {
  if (!active || !payload?.length) return null;
  const { value, dia, index } = payload[0].payload;
  const latest = index === total - 1;
  const reading = latest && latestValue ? latestValue : dia != null ? `${value}/${dia}` : value;
  const systolicOnly = dual && !(latest && latestValue) && dia == null;
  // "120/80" or "25" take the unit; "7%" and "140 mg/dL" already carry one.
  const goalText = goal && (/[a-z%]/i.test(goal) ? goal : `${goal} ${unit}`);
  return (
    <div className={styles.vitalTooltip}>
      <span className={styles.vitalTooltipLabel}>
        {latest ? `Latest${measuredAt ? ` · ${measuredAt}` : ''}` : `Reading ${index + 1} of ${total}`}
      </span>
      <span className={styles.vitalTooltipValue}>
        {systolicOnly ? 'Systolic ' : ''}{reading} {unit}
      </span>
      {systolicOnly && <span className={styles.vitalTooltipLabel}>Diastolic not on file</span>}
      {goalText && <span className={styles.vitalTooltipLabel}>Goal {goalText}</span>}
    </div>
  );
}

function VitalTrend({ values, diastolic, color, target, unit, measuredAt, latestValue, goal, dual }) {
  if (!Array.isArray(values) || values.length < 2) return <div className={styles.vitalTrend} />;
  const hasDia = Array.isArray(diastolic) && diastolic.length === values.length;
  const data = values.map((value, index) => ({ index, value, dia: hasDia ? diastolic[index] : null }));
  // The scale stretches to include the target, so its line is always on the chart.
  const all = [...values, ...(hasDia ? diastolic : []), ...(target != null ? [target] : [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min || 1) * 0.12;
  return (
    <div className={styles.vitalTrend}>
      <ResponsiveContainer width="100%" height="100%" minHeight={48}>
        {/* Edge to edge: the area meets the card's sides and bottom. */}
        <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
          <YAxis hide domain={[min - pad, max + pad]} />
          {target != null && <ReferenceLine y={target} stroke="var(--neutral-300)" strokeDasharray="3 3" ifOverflow="extendDomain" />}
          <Tooltip
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '2 2' }}
            content={(
              <VitalTooltip unit={unit} measuredAt={measuredAt} latestValue={latestValue} goal={goal} dual={dual} total={values.length} />
            )}
            wrapperStyle={{ zIndex: 2 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={color}
            fillOpacity={0.16}
            dot={{ r: 2.5, fill: 'var(--neutral-0)', stroke: color, strokeWidth: 1 }}
            activeDot={{ r: 4, fill: color, stroke: 'var(--neutral-0)', strokeWidth: 1.5 }}
            isAnimationActive={false}
          />
          {hasDia && (
            <Area
              type="monotone"
              dataKey="dia"
              stroke={color}
              strokeWidth={1}
              strokeDasharray="4 2"
              fill="none"
              dot={false}
              activeDot={{ r: 3, fill: color, stroke: 'var(--neutral-0)', strokeWidth: 1 }}
              isAnimationActive={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** One vital: goal, latest reading with its change, age, and the trend with the goal line. */
export function VitalTile({ vital: v }) {
  const tone = v.tone === 'error' || v.tone === 'warning' || v.tone === 'success' ? v.tone : 'success';
  const color = TONE_COLOR[tone];
  const when = ageLabel(v.measuredAt);
  const icon = v.sourceIcon || SOURCE_ICON[v.key];
  return (
    <article className={styles.vital} data-tone={tone}>
      <div className={styles.vitalBody}>
        {(v.goalFrom || v.goalTo) && (
          <p className={styles.vitalGoal}>
            Goal:
            {v.goalFrom && <span>{v.goalFrom}</span>}
            {v.goalFrom && v.goalTo && <span aria-hidden="true">→</span>}
            {v.goalTo && <span>{v.goalTo}</span>}
          </p>
        )}
        <p className={styles.vitalName}>{v.label}</p>
        <p className={styles.vitalValueRow}>
          <span className={styles.vitalReading}>
            <span className={styles.vitalValue}>{v.value}</span>
            {v.unit && <span className={styles.vitalUnit}>{v.unit}</span>}
          </span>
          {v.change && (
            <span className={styles.vitalChange}>
              <Icon name={v.direction === 'down' ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'} size={10} />
              {v.change}
            </span>
          )}
        </p>
        {(when || icon) && (
          <p className={styles.vitalMeta}>
            {when}
            {when && icon && <span aria-hidden="true">•</span>}
            {icon && <Icon name={icon} size={12} />}
          </p>
        )}
      </div>
      <VitalTrend
        values={v.series}
        diastolic={v.diastolicSeries}
        color={color}
        target={goalTarget(v.goalTo)}
        goal={v.goalTo}
        unit={v.unit}
        measuredAt={v.measuredAt}
        latestValue={v.value}
        dual={v.key === 'bp'}
      />
    </article>
  );
}

export function VitalsCard({ overview, memberId, patientId }) {
  const rows = useAppStore(s => s.patientVitals[patientId]);
  const fetchPatientVitals = useAppStore(s => s.fetchPatientVitals);
  const savedKeys = useAppStore(s => s.overviewVitalKeys[patientId]);
  const fetchOverviewVitalKeys = useAppStore(s => s.fetchOverviewVitalKeys);
  const setOverviewVitalKeys = useAppStore(s => s.setOverviewVitalKeys);
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [configRect, setConfigRect] = useState(null);

  useEffect(() => {
    if (!patientId) return;
    fetchPatientVitals(patientId);
    fetchOverviewVitalKeys(patientId);
  }, [patientId, fetchPatientVitals, fetchOverviewVitalKeys]);

  const catalog = useMemo(() => vitalCatalog(overview, memberId, vitalsHistory(rows)), [overview, memberId, rows]);
  // The care team's order when they have saved one; otherwise readings off goal lead.
  const vitals = useMemo(() => {
    const TONE_ORDER = { error: 0, warning: 1 };
    const shown = shownVitals(catalog, overview, savedKeys);
    return savedKeys ? shown : shown.sort((a, b) => (TONE_ORDER[a.tone] ?? 2) - (TONE_ORDER[b.tone] ?? 2));
  }, [catalog, overview, savedKeys]);
  const shownKeys = vitals.map(v => v.key);
  const shownSet = new Set(shownKeys);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({ left: el.scrollLeft > 2, right: max - el.scrollLeft > 2 });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [vitals.length]);

  const scrollByCard = (direction) => {
    const el = scroller.current;
    const card = el?.firstElementChild;
    if (!el || !card) return;
    const gap = 12;
    el.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: 'smooth' });
  };

  // The popover lists the shown tiles in order, then the rest of the catalog.
  const columns = [
    ...vitals,
    ...catalog.filter(t => !shownSet.has(t.key)),
  ].map(t => ({ k: t.key, lb: t.label }));
  const hidden = new Set(columns.filter(c => !shownSet.has(c.k)).map(c => c.k));
  const toggleVital = (key) => setOverviewVitalKeys(patientId, shownSet.has(key) ? shownKeys.filter(k => k !== key) : [...shownKeys, key]);
  const moveVital = (from, to) => {
    const keys = columns.map(c => c.k);
    keys.splice(keys.indexOf(to), 0, ...keys.splice(keys.indexOf(from), 1));
    setOverviewVitalKeys(patientId, keys.filter(k => shownSet.has(k)));
  };

  return (
    <DashboardCard
      icon="solar:heart-pulse-linear"
      title="Vitals"
      actions={(
        <CardHeaderActions insightsOpen={insightsOpen} onToggleInsights={() => setInsightsOpen(v => !v)}>
          <span className={styles.headerActions}>
            <ActionButton
              size="sm"
              icon="solar:add-linear"
              tooltip="Add or reorder vitals"
              tooltipLeft
              active={!!configRect}
              disabled={!patientId}
              onClick={(e) => setConfigRect(configRect ? null : e.currentTarget.getBoundingClientRect())}
            />
            {vitals.length > 0 && (
              <>
                <span className={styles.headerDivider} />
                <ActionButton size="sm" icon="solar:alt-arrow-left-linear" tooltip="Previous" disabled={!edges.left} onClick={() => scrollByCard(-1)} />
                <ActionButton size="sm" icon="solar:alt-arrow-right-linear" tooltip="Next" tooltipLeft disabled={!edges.right} onClick={() => scrollByCard(1)} />
              </>
            )}
          </span>
        </CardHeaderActions>
      )}
    >
      <CardInsights open={insightsOpen} />
      <DashboardCardBody>
        {vitals.length === 0 ? (
          <p className={styles.empty}>No vitals on this widget. Use + to add vitals and biomarkers.</p>
        ) : (
          <div className={styles.vitalsRow} ref={scroller}>
            {vitals.map(v => <VitalTile key={v.key} vital={v} />)}
          </div>
        )}
      </DashboardCardBody>
      {configRect && (
        <ColumnConfigPopover
          anchorRect={configRect}
          title="Vitals & biomarkers"
          emptyText="No vitals match"
          columns={columns}
          hidden={hidden}
          onToggle={toggleVital}
          onReorder={moveVital}
          onReset={() => setOverviewVitalKeys(patientId, null)}
          onClose={() => setConfigRect(null)}
          lockedTop={[]}
          lockedBottom={[]}
          width={260}
        />
      )}
    </DashboardCard>
  );
}
