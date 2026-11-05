import { Fragment, useState } from 'react';
import { DashboardCard, DashboardCardBody } from '../../../../../../components/DashboardCard/DashboardCard';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { useAppStore } from '../../../../../../store/useAppStore';
import styles from './overviewCards.module.css';

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Renders the summary with the key values (HbA1c, BP, programs) in medium
// weight so they can be scanned without reading the whole paragraph.
function EmphasizedText({ text, phrases }) {
  const list = (phrases || []).filter(Boolean);
  if (!list.length) return text;
  const emphasized = new Set(list);
  const parts = text.split(new RegExp(`(${list.map(escapeRegExp).join('|')})`, 'g'));
  return parts.map((part, i) => (
    emphasized.has(part) ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>
  ));
}

function formatGenerated(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// `action`: the header's right side (the Recap button); "Powered by Unity" without it.
export function SynopsisCard({ overview, action }) {
  const showToast = useAppStore(s => s.showToast);
  const [feedback, setFeedback] = useState(null);

  const copy = async () => {
    const text = [overview.synopsis, ...overview.takeaways.map(t => `• ${t.text}`)].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast('Synopsis copied');
    } catch {
      showToast('Could not copy the synopsis');
    }
  };

  const generated = formatGenerated(overview?.generatedAt);

  return (
    <DashboardCard
      tone="ai"
      icon="custom:ai"
      title="Patient Synopsis"
      actions={action ?? <span className={styles.poweredBy}>Powered by Unity</span>}
      footer={overview?.synopsis ? (
        <>
          <span>Was this helpful?</span>
          <ActionButton icon="solar:like-linear" size="sm" tooltip="Helpful" active={feedback === 'up'} iconColor={feedback === 'up' ? 'var(--primary-300)' : undefined} onClick={() => setFeedback(f => (f === 'up' ? null : 'up'))} />
          <ActionButton icon="solar:dislike-linear" size="sm" tooltip="Not helpful" active={feedback === 'down'} iconColor={feedback === 'down' ? 'var(--primary-300)' : undefined} onClick={() => setFeedback(f => (f === 'down' ? null : 'down'))} />
          <ActionButton icon="solar:copy-linear" size="sm" tooltip="Copy" onClick={copy} />
        </>
      ) : null}
    >
      <DashboardCardBody className={styles.synopsisBody}>
        {overview?.synopsis ? (
          <>
            {(generated || overview.sourcesCount) && (
              <span className={styles.muted}>
                {generated && `Generated ${generated}`}
                {generated && overview.sourcesCount ? '  •  ' : ''}
                {overview.sourcesCount ? `${overview.sourcesCount} sources` : ''}
              </span>
            )}
            <p className={styles.synopsisText}>
              <EmphasizedText text={overview.synopsis} phrases={overview.synopsisEmphasis} />
            </p>
            {overview.takeaways.length > 0 && (
              <>
                <h4 className={styles.sectionLabel}>Key takeaways</h4>
                <ul className={styles.takeaways}>
                  {overview.takeaways.map(t => (
                    <li key={t.text} className={styles.takeaway}>
                      <span className={`${styles.takeawayDot} ${styles[t.tone] || ''}`} aria-hidden="true" />
                      {t.text}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <p className={styles.empty}>No synopsis has been generated for this patient yet.</p>
        )}
      </DashboardCardBody>
    </DashboardCard>
  );
}
