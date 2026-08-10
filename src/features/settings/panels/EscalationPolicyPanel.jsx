import { useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';

const s = {
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 },
  card: { background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-150)', borderRadius: 8, padding: 16, marginBottom: 12 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid var(--neutral-100)', fontSize: 14, color: 'var(--neutral-400)' },
  input: { padding: '4px 8px', border: '0.5px solid var(--neutral-150)', borderRadius: 4, fontSize: 13, color: 'var(--neutral-400)', width: 80, textAlign: 'center' },
  label: { flex: 1 },
  desc: { fontSize: 12, color: 'var(--neutral-300)', marginTop: 2 },
  keywordsList: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  keyword: { padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: 'var(--status-error-light)', color: 'var(--status-error)', border: '0.5px solid rgba(215,40,37,0.2)', display: 'flex', alignItems: 'center', gap: 4 },
  select: { padding: '6px 10px', border: '0.5px solid var(--neutral-150)', borderRadius: 4, fontSize: 13, color: 'var(--neutral-400)', background: 'var(--neutral-0)' },
};

const EMERGENCY_KEYWORDS = ['suicide', 'kill', 'hurt myself', 'emergency', '911', 'chest pain', 'can\'t breathe', 'overdose', 'bleeding', 'unconscious'];

export function EscalationPolicyPanel() {
  const [config, setConfig] = useState({
    confidenceThreshold: 70,
    sentimentThreshold: 30,
    maxLoops: 3,
    maxTurns: 20,
    callbackSlaMinutes: 30,
    transferNumber: '(555) 123-4567',
    queueThreshold: 5,
  });

  const update = (key, val) => setConfig(p => ({ ...p, [key]: val }));

  return (
    <div style={{ padding: 16 }}>
      {/* Confidence & Sentiment Thresholds */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <Icon name="solar:tuning-square-2-bold" size={16} color="var(--primary-300)" />
          Escalation Triggers
        </div>
        <div style={s.card}>
          <div style={s.row}>
            <div style={s.label}>
              Confidence Threshold
              <div style={s.desc}>Escalate when AI confidence drops below this %</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input aria-label="Confidence Threshold" style={s.input} type="number" min={0} max={100} value={config.confidenceThreshold} onChange={e => update('confidenceThreshold', +e.target.value)} />
              <span style={{ fontSize: 12, color: 'var(--neutral-300)' }}>%</span>
            </div>
          </div>
          <div style={s.row}>
            <div style={s.label}>
              Negative Sentiment Threshold
              <div style={s.desc}>Escalate when negative sentiment exceeds this %</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input aria-label="Negative Sentiment Threshold" style={s.input} type="number" min={0} max={100} value={config.sentimentThreshold} onChange={e => update('sentimentThreshold', +e.target.value)} />
              <span style={{ fontSize: 12, color: 'var(--neutral-300)' }}>%</span>
            </div>
          </div>
          <div style={s.row}>
            <div style={s.label}>
              Max Conversation Loops
              <div style={s.desc}>Escalate after this many repeated loops</div>
            </div>
            <input aria-label="Max Conversation Loops" style={s.input} type="number" min={1} max={10} value={config.maxLoops} onChange={e => update('maxLoops', +e.target.value)} />
          </div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.label}>
              Max Turn Count
              <div style={s.desc}>Escalate after this many conversation turns</div>
            </div>
            <input aria-label="Max Turn Count" style={s.input} type="number" min={5} max={50} value={config.maxTurns} onChange={e => update('maxTurns', +e.target.value)} />
          </div>
        </div>
      </div>

      {/* Transfer Configuration */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <Icon name="solar:phone-calling-bold" size={16} color="#E8742C" />
          Transfer Configuration
        </div>
        <div style={s.card}>
          <div style={s.row}>
            <div style={s.label}>Transfer Phone Number</div>
            <input aria-label="Transfer Phone Number" style={{ ...s.input, width: 140 }} value={config.transferNumber} onChange={e => update('transferNumber', e.target.value)} />
          </div>
          <div style={s.row}>
            <div style={s.label}>
              Queue Threshold
              <div style={s.desc}>Offer callback when queue exceeds this count</div>
            </div>
            <input aria-label="Queue Threshold" style={s.input} type="number" min={1} max={50} value={config.queueThreshold} onChange={e => update('queueThreshold', +e.target.value)} />
          </div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.label}>
              Callback SLA
              <div style={s.desc}>Promised callback time in minutes</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input aria-label="Callback SLA" style={s.input} type="number" min={5} max={120} value={config.callbackSlaMinutes} onChange={e => update('callbackSlaMinutes', +e.target.value)} />
              <span style={{ fontSize: 12, color: 'var(--neutral-300)' }}>min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Keywords */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <Icon name="solar:danger-triangle-bold" size={16} color="var(--status-error)" />
          Emergency Keywords
        </div>
        <div style={s.card}>
          <div style={{ fontSize: 13, color: 'var(--neutral-300)', marginBottom: 8 }}>
            Calls containing these keywords will trigger immediate escalation to a human agent.
          </div>
          <div style={s.keywordsList}>
            {EMERGENCY_KEYWORDS.map(kw => (
              <span key={kw} style={s.keyword}>
                {kw}
                <Icon name="solar:close-circle-bold" size={12} color="var(--status-error)" style={{ cursor: 'pointer' }} />
              </span>
            ))}
          </div>
          <Button variant="secondary" size="S" leadingIcon="solar:add-circle-linear" style={{ marginTop: 10 }}>
            Add Keyword
          </Button>
        </div>
      </div>
    </div>
  );
}
