/**
 * Preview tab: renders the form via the shared FormRenderer (which honors the
 * layout mode: entire-page / by-section / by-question) inside a Web (MacBook) or
 * Mobile (iPhone) device mockup, with a live score sidebar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { evaluate } from '../scoring/evaluate';
import { toQuestionnaire } from './engineAdapter';
import { FormRenderer } from '../render/FormRenderer';
import { MacBookPro, IPhone17Pro } from '../../email-builder/DevicePreview';
import { injectGoogleFonts } from '../../email-builder/googleFonts';
import styles from './FormBuilder.module.css';

injectGoogleFonts();

const SEV_COLOR = {
  neutral: 'var(--neutral-300)',
  info: 'var(--status-info)',
  warning: 'var(--status-warning)',
  high: 'var(--status-warning)',
  critical: 'var(--status-error)',
};

const DEVICES = [
  { key: 'form', label: 'Form', icon: 'solar:document-text-linear' },
  { key: 'web', label: 'Web', icon: 'solar:monitor-linear' },
  { key: 'mobile', label: 'Mobile', icon: 'solar:smartphone-linear' },
];

export function PreviewPanel({ fields, scoring, formName, settings }) {
  const [answers, setAnswers] = useState({});
  const [device, setDevice] = useState('form');
  const setAnswer = (linkId, v) => setAnswers((prev) => ({ ...prev, [linkId]: v }));

  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setStageW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const result = useMemo(() => {
    const form = {
      questionnaire: toQuestionnaire(fields),
      scores: scoring?.scores || [],
      criticalTriggers: scoring?.criticalTriggers || [],
    };
    try {
      return evaluate(form, answers);
    } catch {
      return { scores: [], criticalsTriggered: [] };
    }
  }, [fields, scoring, answers]);

  const hasScores = (scoring?.scores?.length || 0) > 0;
  const avail = Math.max(280, stageW - 48);
  const macWidth = Math.min(860, avail);
  const phoneWidth = Math.min(340, Math.max(280, avail * 0.7));

  const body = (compact) => (
    <FormRenderer
      fields={fields}
      settings={settings}
      scoring={scoring}
      formName={formName}
      answers={answers}
      onAnswer={setAnswer}
      compact={compact}
      scope="embedded"
      onSubmit={() => true}
    />
  );

  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewStage} ref={stageRef}>
        <div className={styles.deviceToolbar}>
          <SegmentedControl size="sm" items={DEVICES} value={device} onValueChange={setDevice} />
        </div>
        {device === 'form' ? (
          <div className={styles.plainArea}>
            <div className={styles.deviceFormScroll} style={{ background: settings?.background || '#fff' }}>
              {body(false)}
            </div>
          </div>
        ) : (
          <div className={styles.deviceArea}>
            <div className={styles.deviceWrap} key={device}>
              {device === 'web'
                ? <MacBookPro width={macWidth} screen={<div className={styles.deviceFormScroll} style={{ background: settings?.background || '#fff' }}>{body(false)}</div>} />
                : <IPhone17Pro width={phoneWidth} screen={<div className={styles.deviceFormScroll} style={{ background: settings?.background || '#fff' }}>{body(true)}</div>} />}
              <div className={styles.deviceMeta}>
                {device === 'web' ? 'MacBook Pro · 16-inch' : 'iPhone 17 Pro · 6.3-inch'}
              </div>
            </div>
          </div>
        )}
      </div>

      {(hasScores || result.criticalsTriggered.length > 0) && (
        <aside className={styles.previewResult}>
          <div className={styles.propsHeader}>Live Score</div>
          <div className={styles.pvResultBody}>
            {result.scores.map((s) => (
              <div key={s.id} className={styles.pvScoreCard}>
                <div className={styles.pvScoreVal}>{s.value ?? '-'}</div>
                <div className={styles.pvScoreMeta}>
                  <span className={styles.pvScoreName}>{scoring.scores.find((d) => d.id === s.id)?.label || s.id}</span>
                  <span className={styles.pvScoreStatus}>{s.status}</span>
                </div>
                {s.band ? (
                  <span className={styles.pvBand} style={{ color: SEV_COLOR[s.band.severity], borderColor: SEV_COLOR[s.band.severity] }}>
                    {s.band.label}
                  </span>
                ) : null}
              </div>
            ))}
            {result.criticalsTriggered.map((c) => (
              <div key={c.triggerId} className={styles.pvAlert}>
                <Icon name="solar:danger-triangle-linear" size={16} color="var(--status-error)" />
                <span>{c.alert}</span>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

export default PreviewPanel;
