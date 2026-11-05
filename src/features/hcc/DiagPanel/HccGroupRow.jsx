import { useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { IcdRow } from './IcdRow';
import styles from './HccGroupRow.module.css';

// Static map of HCCs that have known override counts. Ported from the
// prototype's HCC_OVERRIDES (line 1251): currently only HCC 18 has data.
const HCC_OVERRIDES = {
  'HCC 18 - Diabetes w/ Complications': 2,
};

const DEFAULT_PROVIDER = 'Robert Langdon';

/**
 * HccGroupRow: collapsible card grouping one HCC's worth of ICDs.
 *
 * Header layout (single line): HCC title (flex-1) · Overrides chip (if any) ·
 * RAF chip · Status pill (Open/Closed) · chevron.
 *
 * Body splits into two sections:
 *   1. "ICD Associated with DOS", regular ICDs (and AI-suggested ones that
 *      have been Accepted).
 *   2. "ICD Not Associated with DOS", AI suggestions still pending
 *      acceptance, plus genuinely unlinked ICDs. Marked with a small
 *      "Unity Suggested" tag.
 *
 * Props:
 *  - hccTitle  (string)     Full HCC label e.g. "HCC 18 - Diabetes w/ Complications".
 *  - assoc     (icd[])      ICDs whose DOS link is established (or AI-accepted).
 *  - unlinked  (icd[])      AI-suggested or genuinely unlinked ICDs.
 *  - defaultOpen (boolean)  Initial collapsed/expanded state.
 *
 * Back-compat: the legacy `icds` + `rafImpact` props are still accepted,
 * `icds` flows through as `assoc` so older call-sites keep rendering until
 * they migrate.
 */
export function HccCard({
  hccTitle,
  assoc,
  unlinked,
  icds,            // legacy
  rafImpact,       // legacy, ignored if we can compute it from assoc
  defaultOpen = true,
}) {
  const associated = assoc ?? icds ?? [];
  const notAssociated = unlinked ?? [];
  const [open, setOpen] = useState(defaultOpen);

  const allICDs = [...associated, ...notAssociated];
  const overrides = HCC_OVERRIDES[hccTitle];
  const allResolved =
    allICDs.length > 0 && allICDs.every(i => ['Accepted', 'Dismissed'].includes(i.status));
  const stateLabel = allResolved ? 'Closed' : 'Open';

  // RAF sum: prefer accepted-only when there's at least one, otherwise sum
  // every associated row so the chip has *something* to show before any
  // accept actions have been taken.
  const acceptedSum = associated
    .filter(i => i.status === 'Accepted')
    .reduce((acc, i) => acc + (i.raf || 0), 0);
  const allSum = associated.reduce((acc, i) => acc + (i.raf || 0), 0);
  const raf = acceptedSum > 0 ? acceptedSum : allSum;
  const rafDisplay = raf > 0
    ? raf.toFixed(3)
    : (rafImpact != null ? Number(rafImpact).toFixed(3) : '0.000');

  return (
    <section className={styles.card}>
      <button
        type="button"
        className={styles.cardHeader}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className={styles.cardTitle}>{hccTitle}</span>

        <span className={styles.headerBadges}>
          {overrides && (
            <>
              <span className={styles.overrideChip}>
                <Icon name="solar:refresh-linear" size={10} color="var(--neutral-300)" />
                Overrides {overrides}
              </span>
              <span className={styles.miniDivider} />
            </>
          )}

          <span className={styles.rafChip}>
            <Icon name="solar:arrow-up-linear" size={10} color="var(--neutral-300)" />
            RAF: {rafDisplay}
          </span>

          <span className={styles.miniDivider} />

          <span className={`${styles.statePill} ${allResolved ? styles.statePillClosed : styles.statePillOpen}`}>
            {stateLabel}
          </span>
        </span>

        <Icon
          name={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
          size={12}
          color="var(--neutral-300)"
          className={styles.chev}
        />
      </button>

      {/* Provider strip removed: assignee is shown at the DOS-row level in
          DiagPanel header, not duplicated on every HCC group. */}

      {open && (
        <div className={styles.cardBody}>
          {/* ── Associated section ── */}
          {associated.length > 0 && (
            <>
              <div className={styles.sectionHeader}>
                <span>ICD Associated with DOS</span>
              </div>
              <div className={styles.icdList}>
                {associated.map((icd, i) => (
                  <IcdRow key={`a-${icd.code}-${i}`} icd={icd} />
                ))}
              </div>
            </>
          )}

          {/* ── Not Associated / AI-Suggested section ── */}
          {notAssociated.length > 0 && (
            <>
              <div className={`${styles.sectionHeader} ${styles.sectionHeaderUnlinked}`}>
                <span>ICD Not Associated with DOS</span>
                <span className={styles.unitySuggestedTag}>Unity Suggested</span>
              </div>
              <div className={styles.icdList}>
                {notAssociated.map((icd, i) => (
                  <IcdRow key={`u-${icd.code}-${i}`} icd={icd} />
                ))}
              </div>
            </>
          )}

          {/* Empty state (rare: both arrays empty) */}
          {associated.length === 0 && notAssociated.length === 0 && (
            <div className={styles.empty}>No ICDs in this group.</div>
          )}
        </div>
      )}
    </section>
  );
}

/* Keep the old export name available so existing imports don't break */
export { HccCard as HccGroupRow };
