import { useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Switch } from '../../../components/Switch/Switch';

const FEATURES = [
  { key: 'toc_outreach', label: 'TOC Outreach', desc: 'Post-discharge follow-up calls', icon: 'solar:phone-calling-bold', color: 'var(--status-success)' },
  { key: 'med_reconciliation', label: 'Medication Reconciliation', desc: 'Review medications during calls', icon: 'solar:pill-bold', color: 'var(--primary-300)' },
  { key: 'appointment_scheduling', label: 'Appointment Scheduling', desc: 'Book follow-up appointments', icon: 'solar:calendar-bold', color: 'var(--status-info)' },
  { key: 'care_gap_outreach', label: 'Care Gap Outreach', desc: 'Proactive care gap notifications', icon: 'solar:clipboard-heart-bold', color: '#E8742C' },
  { key: 'refill_reminders', label: 'Refill Reminders', desc: 'Medication refill notifications', icon: 'solar:bottle-bold', color: 'var(--status-warning)' },
  { key: 'waitlist_notifications', label: 'Waitlist Notifications', desc: 'Notify when appointment slots open', icon: 'solar:bell-bold', color: 'var(--status-error)' },
  { key: 'ai_disclosure', label: 'AI Disclosure', desc: 'Automated AI agent disclosure', icon: 'solar:bot-bold', color: 'var(--neutral-400)' },
  { key: 'recording_consent', label: 'Recording Consent', desc: 'Capture consent for call recording', icon: 'solar:microphone-bold', color: 'var(--neutral-400)' },
  { key: 'identity_verification', label: 'Identity Verification', desc: 'Verify patient identity before call', icon: 'solar:verified-check-bold', color: 'var(--neutral-400)' },
  { key: 'emergency_detection', label: 'Emergency Detection', desc: 'Detect emergency keywords in calls', icon: 'solar:danger-triangle-bold', color: 'var(--status-error)' },
];

const s = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16 },
  card: { background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-150)', borderRadius: 8, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 12 },
  iconWrap: (color) => ({ width: 36, height: 36, borderRadius: 8, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
  info: { flex: 1 },
  label: { fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)', marginBottom: 2 },
  desc: { fontSize: 12, color: 'var(--neutral-300)' },
};

export function FeatureTogglesPanel() {
  const [toggles, setToggles] = useState(
    () => Object.fromEntries(FEATURES.map(f => [f.key, true]))
  );

  return (
    <div style={s.grid}>
      {FEATURES.map(f => (
        <div key={f.key} style={s.card}>
          <div style={s.iconWrap(f.color)}>
            <Icon name={f.icon} size={18} color={f.color} />
          </div>
          <div style={s.info}>
            <div style={s.label}>{f.label}</div>
            <div style={s.desc}>{f.desc}</div>
          </div>
          <Switch checked={toggles[f.key]} onChange={() => setToggles(p => ({ ...p, [f.key]: !p[f.key] }))} />
        </div>
      ))}
    </div>
  );
}
