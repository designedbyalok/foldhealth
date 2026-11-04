import { useState, useEffect } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from '../../../../../components/LazyRecharts/LazyRecharts';
import { Toggle } from '../../../../../components/Toggle/Toggle';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../components/Button/Button';
import { Icon } from '../../../../../components/Icon/Icon';
import { PanelSection } from '../../../../../components/PanelSection/PanelSection';
import { UnityFooter } from '../UnityFooter/UnityFooter';
import UnityAILogo from '../../../../../assets/unity-ai-logo.svg';
import styles from './HealthMapWidget.module.css';

/* ── Data ── */
const CLINIC_DATA = [
  { axis: 'Cardiometabolic', value: 2.7 },
  { axis: 'Cancer Risk',     value: 2.3 },
  { axis: 'Immune Health',   value: 2.5 },
  { axis: 'Performance',     value: 2.2 },
  { axis: 'Gut Health',      value: 2.8 },
  { axis: 'Neurocognitive',  value: 2.6 },
  { axis: 'Musculoskeletal', value: 2.4 },
];

const PATIENT_DATA = [
  { axis: 'Cardiometabolic', value: 2.5 },
  { axis: 'Cancer Risk',     value: 2.7 },
  { axis: 'Immune Health',   value: 2.3 },
  { axis: 'Performance',     value: 2.9 },
  { axis: 'Gut Health',      value: 2.4 },
  { axis: 'Neurocognitive',  value: 2.6 },
  { axis: 'Musculoskeletal', value: 2.8 },
];

/* ── Recharts Radar Chart ── */
const MAX_SCORE = 3;

function HealthMapTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { payload: point, name } = payload[0];
  return (
    <div className={styles.tooltip}>
      <span className={styles.tooltipAxis}>{point.axis}</span>
      <span className={styles.tooltipRow}>
        <span className={styles.tooltipDot} />
        {name}
        <span className={styles.tooltipValue}>{point.value.toFixed(1)} / {MAX_SCORE}</span>
      </span>
    </div>
  );
}

function HealthRadarChart({ data, name }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} margin={{ top: 16, right: 48, bottom: 16, left: 48 }}>
        <PolarGrid stroke="var(--neutral-100)" strokeWidth={0.75} />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fontSize: 'var(--font-xs)', fill: 'var(--neutral-200)' }}
          tickLine={false}
        />
        <PolarRadiusAxis angle={90} domain={[0, MAX_SCORE]} tickCount={4} tick={false} axisLine={false} tickLine={false} />
        <Tooltip content={<HealthMapTooltip />} cursor={{ stroke: 'var(--primary-200)', strokeWidth: 1 }} />
        <Radar
          name={name}
          dataKey="value"
          stroke="var(--primary-300)"
          strokeWidth={1}
          fill="var(--primary-300)"
          fillOpacity={0.12}
          dot={{ fill: 'var(--primary-300)', r: 3, strokeWidth: 0 }}
          activeDot={{ fill: 'var(--primary-300)', stroke: 'var(--neutral-0)', strokeWidth: 2, r: 5 }}
          isAnimationActive
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ── Loading state ── */
const LOADING_STEPS = [
  'Analyzing Health',
  'Analyzing Reports',
  'Synthesizing Learnings',
  'Creating Health Radar',
];

function LoadingState({ onComplete }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeouts = new Set();
    const cycle = setInterval(() => {
      setVisible(false);
      const t = setTimeout(() => {
        setStepIdx(i => (i + 1 < LOADING_STEPS.length ? i + 1 : i));
        setVisible(true);
      }, 250);
      timeouts.add(t);
    }, 1400);
    return () => { clearInterval(cycle); timeouts.forEach(clearTimeout); };
  }, []);

  // Fire onComplete once the final step is reached (kept out of the state
  // updater above so it never runs twice under StrictMode/replayed renders).
  useEffect(() => {
    if (stepIdx < LOADING_STEPS.length - 1) return undefined;
    const t = setTimeout(() => onComplete?.(), 600);
    return () => clearTimeout(t);
  }, [stepIdx, onComplete]);

  return (
    <div className={styles.loading}>
      <div className={styles.loadingHead}>
        <img src={UnityAILogo} width={16} height={16} alt="" className={styles.spin} />
        <span className={[styles.loadingText, visible ? '' : styles.hidden].join(' ')}>
          {LOADING_STEPS[stepIdx]}…
        </span>
      </div>
      <div className={styles.steps}>
        {LOADING_STEPS.map((step, i) => (
          <span
            key={step}
            className={[styles.step, i < stepIdx ? styles.stepDone : '', i === stepIdx ? styles.stepActive : ''].join(' ')}
          >
            {i < stepIdx
              ? <Icon name="solar:check-circle-linear" size={12} color="currentColor" />
              : <span className={[styles.stepDot, i === stepIdx ? styles.pulse : ''].join(' ')} />}
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Main widget ── */
export function HealthMapWidget({ compact = false }) {
  const [view, setView] = useState('generated'); // 'open' | 'generated' | 'patientGenerated' | 'shared'
  const [activeToggle, setActiveToggle] = useState('clinic');
  const [feedback, setFeedback] = useState(null);

  const chartData = activeToggle === 'clinic' ? CLINIC_DATA : PATIENT_DATA;
  const isLoading = view === 'open';
  const visibility = view === 'generated' ? 'internal' : view === 'shared' ? 'shared' : undefined;

  return (
    <PanelSection
      title="Health Map"
      actions={(
        <>
          {!isLoading && (
            <Toggle
              size="sm"
              value={activeToggle}
              items={[
                { key: 'clinic', icon: <span className={styles.toggleItem}><Icon name="solar:stethoscope-linear" size={14} color="currentColor" />Clinic</span> },
                { key: 'patient', icon: <span className={styles.toggleItem}><Icon name="solar:user-linear" size={14} color="currentColor" />Patient</span> },
              ]}
              onValueChange={(key) => {
                setActiveToggle(key);
                if (key === 'patient') setView('patientGenerated');
                else if (view !== 'generated' && view !== 'open') setView('generated');
              }}
            />
          )}
          {!isLoading && <ActionButton icon="solar:refresh-linear" size="sm" tooltip="Regenerate" onClick={() => setView('open')} />}
          <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" />
        </>
      )}
    >
      {isLoading ? (
        <LoadingState onComplete={() => setView('generated')} />
      ) : (
        <>
          <div className={styles.container}>
            <div className={[styles.chart, compact ? styles.compact : ''].join(' ')}>
              <HealthRadarChart data={chartData} name={activeToggle === 'clinic' ? 'Clinic' : 'Patient'} />
            </div>
          </div>

          {view === 'patientGenerated' && (
            <div className={styles.sharePrompt}>
              <span className={styles.sharePromptText}>Share this health map with the patient?</span>
              <Button variant="ghost" size="sm" onClick={() => setView('generated')}>Don&apos;t Share</Button>
              <Button variant="soft" size="sm" onClick={() => setView('shared')}>Share</Button>
            </div>
          )}

          <UnityFooter
            visibility={visibility}
            generatedOn="11/09/2025, 2:30 PM"
            generatedBy="Dr. Michael Chen"
            actions={(
              <>
                <ActionButton
                  icon="solar:like-linear"
                  size="sm"
                  tooltip="Helpful"
                  iconColor={feedback === 'up' ? 'var(--primary-300)' : undefined}
                  onClick={() => setFeedback(v => (v === 'up' ? null : 'up'))}
                />
                <ActionButton
                  icon="solar:dislike-linear"
                  size="sm"
                  tooltip="Not helpful"
                  iconColor={feedback === 'down' ? 'var(--primary-300)' : undefined}
                  onClick={() => setFeedback(v => (v === 'down' ? null : 'down'))}
                />
              </>
            )}
          />
        </>
      )}
    </PanelSection>
  );
}
