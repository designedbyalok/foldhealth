/**
 * Score tab — manage the form's scores and their interpretation bands. Forms
 * can hold several scores: validated instruments register locked scores on
 * drop, and the user can add custom scores over any scorable fields.
 *
 * Three columns: Scores (list + select) | Configure (aggregation, range) |
 * Interpretations (bands). Locked (validated) scores are read-only.
 */
import { useId, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { AGGREGATION, SEVERITY } from '../scoring/types';
import { scoreRange } from '../scoring/validate';
import { scorableFields, engineItemIndex } from './engineAdapter';
import styles from './FormBuilder.module.css';

const AGG_OPTIONS = [AGGREGATION.SUM, AGGREGATION.AVERAGE, AGGREGATION.COUNT, AGGREGATION.MAX, AGGREGATION.MIN];
const SEVERITIES = [SEVERITY.NEUTRAL, SEVERITY.INFO, SEVERITY.WARNING, SEVERITY.HIGH, SEVERITY.CRITICAL];

export function ScorePanel({ fields, scoring, onChange }) {
  const uid = useId();
  const scores = scoring?.scores || [];
  const scorable = scorableFields(fields);
  const index = engineItemIndex(fields);
  const [selectedId, setSelectedId] = useState(scores[0]?.id || null);

  const selected = scores.find((s) => s.id === selectedId) || scores[0] || null;
  const range = selected
    ? (selected.locked ? selected.range : scoreRange(selected, index, new Map()))
    : { min: 0, max: 0 };

  const setScores = (next) =>
    onChange({ ...scoring, scores: next, criticalTriggers: scoring?.criticalTriggers || [] });
  const replace = (patch) => setScores(scores.map((s) => (s.id === selected.id ? { ...s, ...patch } : s)));

  const createCustom = () => {
    const id = `custom_${scores.length + 1}`;
    const def = {
      id, label: `Custom Score ${scores.length + 1}`, aggregation: AGGREGATION.SUM,
      missingPolicy: 'exclude', sources: scorable.map((f) => ({ linkId: f.linkId })),
      range: scoreRange({ aggregation: AGGREGATION.SUM, sources: scorable.map((f) => ({ linkId: f.linkId })) }, index, new Map()),
      interpretations: [],
    };
    setScores([...scores, def]);
    setSelectedId(id);
  };

  const setAgg = (aggregation) => replace({ aggregation, range: scoreRange({ ...selected, aggregation }, index, new Map()) });
  const syncSources = () => {
    const sources = scorable.map((f) => ({ linkId: f.linkId }));
    replace({ sources, range: scoreRange({ ...selected, sources }, index, new Map()) });
  };
  const setBand = (i, patch) => replace({ interpretations: selected.interpretations.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });
  const addBand = () => {
    const bands = selected.interpretations || [];
    const start = bands.length ? bands[bands.length - 1].max + 1 : range.min;
    replace({ interpretations: [...bands, { min: start, max: range.max, label: 'New band', severity: SEVERITY.NEUTRAL }] });
  };
  const removeBand = (i) => replace({ interpretations: selected.interpretations.filter((_, idx) => idx !== i) });

  const locked = selected?.locked;

  return (
    <div className={styles.scoreGrid}>
      {/* Scores list */}
      <section className={styles.scoreCol}>
        <div className={styles.scoreColHead}>Scores</div>
        <div className={styles.scoreFieldList}>
          {scores.length === 0 ? (
            <div className={styles.scoreEmpty}>
              <Icon name="solar:speedometer-linear" size={28} color="var(--neutral-150)" />
              <p>No scores yet. Drop a validated scale, or create a custom score over {scorable.length} scorable field{scorable.length === 1 ? '' : 's'}.</p>
            </div>
          ) : (
            scores.map((s) => (
              <button
                key={s.id}
                className={`${styles.scoreFieldItem} ${selected?.id === s.id ? styles.scoreFieldItemSel : ''}`}
                onClick={() => setSelectedId(s.id)}
                style={{ cursor: 'pointer', textAlign: 'left' }}
              >
                <Icon name={s.locked ? 'solar:lock-keyhole-minimalistic-linear' : 'solar:speedometer-linear'} size={16} color={s.locked ? 'var(--status-success)' : 'var(--primary-300)'} />
                <span>{s.label}</span>
                {s.locked ? <span className={styles.scoreFieldPts}>validated</span> : null}
              </button>
            ))
          )}
          {scorable.length > 0 ? (
            <button className={styles.optAdd} onClick={createCustom}>
              <Icon name="solar:add-circle-linear" size={15} color="var(--primary-300)" /> Custom score
            </button>
          ) : null}
        </div>
      </section>

      {/* Configure */}
      <section className={styles.scoreCol}>
        <div className={styles.scoreColHead}>Configure</div>
        {!selected ? (
          <div className={styles.scoreEmpty}>
            <Icon name="solar:tuning-linear" size={28} color="var(--neutral-150)" />
            <p>Select a score to configure it.</p>
          </div>
        ) : (
          <div className={styles.scoreConfig}>
            {locked ? (
              <div className={styles.lockedBanner}>
                <Icon name="solar:lock-keyhole-minimalistic-linear" size={14} color="var(--status-success)" />
                Validated &amp; locked — cutoffs can’t be edited.
              </div>
            ) : null}
            <label className={styles.propLabel} htmlFor={`${uid}-score-name`}>Score name</label>
            <Input id={`${uid}-score-name`} className={styles.ctl} value={selected.label} disabled={locked} readOnly={locked} onChange={(e) => replace({ label: e.target.value })} />
            <label className={styles.propLabel} htmlFor={`${uid}-aggregation`}>Aggregation</label>
            <Select
              id={`${uid}-aggregation`}
              className={styles.ctl}
              value={selected.aggregation}
              disabled={locked}
              options={AGG_OPTIONS.map((a) => ({ value: a, label: a }))}
              onChange={setAgg}
            />
            <div className={styles.rangePill}>Possible range <strong>{range.min}–{range.max}</strong></div>
            <div className={styles.scoreSourcesRow}>
              <span>{selected.sources.length} field{selected.sources.length === 1 ? '' : 's'} included</span>
              {!locked ? <button className={styles.linkBtn} onClick={syncSources}>Sync to scorable fields</button> : null}
            </div>
          </div>
        )}
      </section>

      {/* Interpretations */}
      <section className={styles.scoreCol}>
        <div className={styles.scoreColHead}>Result — Interpretations</div>
        {!selected ? (
          <div className={styles.scoreEmpty}>
            <Icon name="solar:ranking-linear" size={28} color="var(--neutral-150)" />
            <p>Bands appear here for the selected score.</p>
          </div>
        ) : (
          <div className={styles.bandList}>
            {(selected.interpretations || []).map((b, i) => (
              <div key={i} className={styles.bandRow}>
                <Input className={styles.bandNum} type="number" value={b.min} disabled={locked} readOnly={locked} onChange={(e) => setBand(i, { min: Number(e.target.value) })} />
                <span className={styles.bandDash}>–</span>
                <Input className={styles.bandNum} type="number" value={b.max} disabled={locked} readOnly={locked} onChange={(e) => setBand(i, { max: Number(e.target.value) })} />
                <Input className={styles.bandLabel} value={b.label} disabled={locked} readOnly={locked} onChange={(e) => setBand(i, { label: e.target.value })} />
                <Select
                  className={styles.bandSevSel}
                  value={b.severity}
                  disabled={locked}
                  options={SEVERITIES.map((s) => ({ value: s, label: s }))}
                  onChange={(v) => setBand(i, { severity: v })}
                />
                {!locked ? (
                  <CloseButton size={16} onClick={() => removeBand(i)} className={styles.optRemove} label="Remove band" />
                ) : null}
              </div>
            ))}
            {!locked ? (
              <button className={styles.optAdd} onClick={addBand}>
                <Icon name="solar:add-circle-linear" size={15} color="var(--primary-300)" /> Add band
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

export default ScorePanel;
