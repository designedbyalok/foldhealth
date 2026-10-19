import { useState } from 'react';
import { Button } from '../Button/Button';
import { Badge } from '../Badge/Badge';
import { Icon } from '../Icon/Icon';
import { FoldHealthLogo } from '../FoldHealthLogo/FoldHealthLogo';
import { useAppStore } from '../../store/useAppStore';
import styles from './UpdateCard.module.css';

/**
 * UpdateCard — floating announcement card: gradient hero with the Fold mark,
 * a title with an optional pill tag, a short description, up to three highlight lines,
 * and a primary + secondary action. Pinned to the bottom-right corner above
 * everything else unless `floating` is false (e.g. inside a story canvas).
 */
export function UpdateCard({
  title,
  tag,
  description,
  highlights = [],
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  floating = true,
}) {
  return (
    <section
      className={`${styles.card} ${floating ? styles.floating : ''}`}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className={styles.hero} aria-hidden="true">
        <div className={styles.mark}>
          <FoldHealthLogo size={28} color="currentColor" />
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          {tag && <Badge tone="primary" size="S" label={tag} />}
        </div>
        {description && <p className={styles.description}>{description}</p>}
        {highlights.length > 0 && (
          <ul className={styles.highlights}>
            {highlights.slice(0, 3).map(h => (
              <li key={h} className={styles.highlight} title={h}>
                <Icon name="solar:check-circle-linear" size={14} className={styles.check} />
                <span className={styles.highlightText}>{h}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          <Button variant="primary" size="L" fullWidth onClick={onPrimary}>
            {primaryLabel}
          </Button>
          <Button variant="ghost" size="L" fullWidth onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

const DISMISS_KEY = 'fold:update-dismissed-version';

function readDismissed() {
  try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
}

// Store-connected: shows when the update checker has seen a newer deploy.
// Dismiss remembers that deploy's version, so the card stays away until a
// later one lands. Refresh reloads onto the new bundle.
export function UpdateAvailableCard() {
  const hasNewBuild = useAppStore(s => s.hasNewBuild);
  const version = useAppStore(s => s.newBuildVersion);
  const highlights = useAppStore(s => s.newBuildHighlights);
  const [dismissed, setDismissed] = useState(readDismissed);

  const key = version || 'unknown';
  if (!hasNewBuild || dismissed === key) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, key); } catch {/* still hide for this tab */}
    setDismissed(key);
  };

  return (
    <UpdateCard
      title="New update available"
      description="Refresh to get the latest version."
      highlights={highlights}
      primaryLabel="Refresh"
      secondaryLabel="Dismiss"
      onPrimary={() => window.location.reload()}
      onSecondary={dismiss}
    />
  );
}
