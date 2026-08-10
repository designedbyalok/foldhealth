import { useState, useEffect } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from '../../../../../components/LazyRecharts/LazyRecharts';
import { Icon } from '../../../../../components/Icon/Icon';
import { Toggle } from '../../../../../components/Toggle/Toggle';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../../components/Badge/Badge';
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
function HealthRadarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} margin={{ top: 24, right: 48, bottom: 24, left: 48 }}>
        <PolarGrid stroke="#e9ecf1" strokeWidth={0.75} />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fontSize: 11, fill: '#6f7a90', fontFamily: 'Inter, sans-serif' }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 3]}
          tickCount={4}
          tick={{ fontSize: 8, fill: '#d0d6e1', fontFamily: 'Inter, sans-serif' }}
          axisLine={false}
          tickLine={false}
        />
        <Radar
          dataKey="value"
          stroke="#8c5ae2"
          strokeWidth={1.5}
          fill="rgba(140,90,226,0.12)"
          dot={{ fill: '#8c5ae2', r: 3, strokeWidth: 0 }}
          activeDot={false}
          isAnimationActive={true}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ── Stethoscope icon ── */
function StethoscopeIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

/* ── User icon ── */
function UserIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

/* ── Unity logo ── */
function UnityDot({ size = 14 }) {
  return <img src={UnityAILogo} width={size} height={size} alt="Unity AI" />;
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
    <div className={styles.loadingArea}>
      <div className={styles.loadingContent}>
        <span className={`${styles.loadingIconWrap} ${styles.loadingSpinning}`}>
          <UnityDot size={16} />
        </span>
        <span className={`${styles.loadingText} ${visible ? styles.loadingTextVisible : styles.loadingTextHidden}`}>
          {LOADING_STEPS[stepIdx]}…
        </span>
      </div>
      <div className={styles.loadingSteps}>
        {LOADING_STEPS.map((step, i) => (
          <span
            key={step}
            className={`${styles.loadingStep} ${i < stepIdx ? styles.loadingStepDone : ''} ${i === stepIdx ? styles.loadingStepActive : ''}`}
          >
            {i < stepIdx && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="#8c5ae2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {i === stepIdx && <span className={styles.loadingDot} />}
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
  const [collapsed, setCollapsed] = useState(false);

  const chartData = activeToggle === 'clinic' ? CLINIC_DATA : PATIENT_DATA;
  const isLoading = view === 'open';

  return (
    <div className={`${styles.widget} ${collapsed ? styles.widgetCollapsed : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.titleBtn} onClick={() => setCollapsed(v => !v)}>
            <Icon
              name={collapsed ? 'solar:alt-arrow-right-linear' : 'solar:alt-arrow-down-linear'}
              size={13}
              color="var(--neutral-400)"
            />
            <span className={styles.title}>Health Map</span>
          </button>
        </div>

        <div className={styles.headerRight}>
          {!collapsed && !isLoading && (
            <>
              <Toggle
                size="S"
                active={activeToggle}
                items={[
                  { key: 'clinic',  icon: <span className={styles.toggleItem}><StethoscopeIcon size={14} />Clinic</span> },
                  { key: 'patient', icon: <span className={styles.toggleItem}><UserIcon size={14} />Patient</span> },
                ]}
                onChange={(key) => {
                  setActiveToggle(key);
                  if (key === 'patient') setView('patientGenerated');
                  else if (view !== 'generated' && view !== 'open') setView('generated');
                }}
              />
              <span className={styles.divider} />
            </>
          )}

          {!collapsed && (
            <div className={styles.headerActions}>
              {!isLoading && (
                <ActionButton icon="solar:refresh-linear" size="S" onClick={() => setView('open')} />
              )}
              <ActionButton icon="solar:menu-dots-linear" size="S" />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <>
          {isLoading ? (
            <LoadingState onComplete={() => setView('generated')} />
          ) : (
            <div className={styles.chartArea} style={compact ? { height: 260 } : undefined}>
              <div className={styles.chartInner}>
                <HealthRadarChart data={chartData} />
              </div>

              <div className={styles.footer}>
                <div className={styles.footerMeta}>
                  <span className={styles.metaText}>
                    Last Generated on:<br />
                    11/09/2025, 2:30 PM • Dr. Michael Chen
                  </span>

                  {view === 'generated' && (
                    <Badge variant="toc-new" icon="solar:lock-keyhole-linear" label="Internal Use Only" />
                  )}

                  {view === 'shared' && (
                    <Badge variant="ai-care" icon="solar:share-linear" label="Shared with Patient" />
                  )}
                </div>

                {view === 'patientGenerated' && (
                  <div className={styles.sharePrompt}>
                    <UnityDot size={12} />
                    <span className={styles.sharePromptText}>Want to share with patient?</span>
                    <button className={styles.shareYesBtn} onClick={() => setView('shared')}>Yes</button>
                    <button className={styles.shareNoBtn} onClick={() => setView('generated')}>No</button>
                  </div>
                )}

                <div className={styles.unityRow}>
                  <div className={styles.unityBrand}>
                    <UnityDot size={14} />
                    <span className={styles.unityName}>Unity</span>
                    <span className={styles.unityAlpha}>Alpha</span>
                  </div>
                  <div className={styles.feedbackBtns}>
                    <ActionButton
                      icon="solar:like-linear"
                      size="S"
                      iconColor={feedback === 'up' ? 'var(--primary-300)' : undefined}
                      onClick={() => setFeedback(v => v === 'up' ? null : 'up')}
                    />
                    <ActionButton
                      icon="solar:dislike-linear"
                      size="S"
                      iconColor={feedback === 'down' ? 'var(--primary-300)' : undefined}
                      onClick={() => setFeedback(v => v === 'down' ? null : 'down')}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
