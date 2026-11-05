import styles from './EmailBuilder.module.css';

// Skeleton shown while the campaign is fetching from Supabase on a hard
// refresh. Mirrors the real builder chrome, topbar + left components +
// canvas with stacked block placeholders + right design panel, so the
// transition to the populated UI is visually continuous.
export function EmailBuilderSkeleton() {
  return (
    <div className={styles.builder}>
      <div className={styles.skTopBar}>
        <div className={styles.skTopGroup}>
          <div className={styles.skPill} />
        </div>
        <div className={styles.skTopGroup}>
          <div className={styles.skPillSmall} />
          <div className={styles.skPillSmall} />
          <div className={styles.skPillSmall} />
        </div>
        <div className={styles.skTopGroup}>
          <div className={styles.skPillMedium} />
          <div className={styles.skPillLarge} />
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.skLeftPanel}>
          <div className={styles.skTabs}>
            <div className={styles.skTab} />
            <div className={styles.skTab} />
          </div>
          <div className={styles.skSectionHeader}><div /></div>
          <div className={styles.skTileGrid}>
            {Array.from({ length: 15 }).map((_, i) => <div key={i} className={styles.skTile} />)}
          </div>
        </div>
        <div className={styles.skCanvasWrap}>
          <div className={styles.skCanvas}>
            <div className={styles.skHero} />
            <div className={`${styles.skLine} ${styles.skLineMedium}`} />
            <div className={`${styles.skLine} ${styles.skLineFull}`} />
            <div className={`${styles.skLine} ${styles.skLineWide}`} />
            <div className={`${styles.skLine} ${styles.skLineFull}`} />
            <div className={`${styles.skLine} ${styles.skLineMedium}`} />
            <div className={styles.skCard} />
            <div className={styles.skButton} />
            <div className={`${styles.skLine} ${styles.skLineNarrow}`} />
            <div className={`${styles.skLine} ${styles.skLineWide}`} />
            <div className={`${styles.skLine} ${styles.skLineFull}`} />
          </div>
        </div>
        <div className={styles.skRightPanel}>
          <div className={styles.skTabs}>
            <div className={styles.skTab} />
            <div className={styles.skTab} />
            <div className={styles.skTab} />
          </div>
          <div className={styles.skSectionStrip}><div /></div>
          <div className={styles.skFieldRow}>
            <div className={styles.skFieldLabel} />
            <div className={styles.skFieldInput} />
          </div>
          <div className={styles.skSectionStrip}><div /></div>
          <div className={styles.skFieldRow}>
            <div className={styles.skFieldLabel} />
            <div className={styles.skFieldInput} />
            <div className={styles.skFieldDuo}>
              <div className={styles.skFieldInput} />
              <div className={styles.skFieldInput} />
            </div>
          </div>
          <div className={styles.skSectionStrip}><div /></div>
          <div className={styles.skFieldRow}>
            <div className={styles.skFieldLabel} />
            <div className={styles.skFieldInput} />
          </div>
        </div>
      </div>
    </div>
  );
}
