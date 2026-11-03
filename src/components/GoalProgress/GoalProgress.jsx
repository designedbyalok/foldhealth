import { Icon } from '../Icon/Icon';
import { Badge } from '../Badge/Badge';
import styles from './GoalProgress.module.css';

/**
 * Reusable Goal Progress panel.
 *
 * Accepts a flat `goalsDetail` array:
 *   [{ name, desc, pass }]  ← from callDetails / DetailDrawer
 *
 * OR a structured `goals` object (from CallQueueDrawer):
 *   { mandatory, optional, progress, passed, total, mandatoryMet }
 */
export function GoalProgress({ goalsDetail, goals }) {
  // Normalise both input shapes into one structure
  let items, passed, total, progress, goalsMet;

  if (goals) {
    const all = [...(goals.mandatory || []), ...(goals.optional || [])];
    const mandatorySet = new Set(goals.mandatory || []);
    items    = all.map(g => ({ ...g, section: mandatorySet.has(g) ? 'Mandatory' : 'Optional' }));
    passed   = goals.passed;
    total    = goals.total;
    progress = goals.progress;
    goalsMet = goals.mandatoryMet;
  } else if (goalsDetail?.length) {
    items    = goalsDetail.map(g => ({ ...g, section: null }));
    passed   = goalsDetail.filter(g => g.pass).length;
    total    = goalsDetail.length;
    progress = Math.round((passed / total) * 100);
    goalsMet = passed === total;
  } else {
    return null;
  }

  const fillColor = goalsMet ? '#009b53' : '#D72825';

  // Group items by section label (null → single flat list)
  const sections = items.reduce((acc, item) => {
    const key = item.section || '';
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.label}>Goal Progress</span>
        <Badge
          tone={goalsMet ? 'success' : 'danger'}
          label={goalsMet ? 'Goals Met' : 'Goals Not Met'}
          icon="solar:info-circle-linear"
        />
      </div>

      {/* Progress bar */}
      <div className={styles.bar}>
        <div className={styles.fill} style={{ width: `${progress}%`, background: fillColor }} />
      </div>
      <span className={styles.progressText}>
        {progress}% &bull; {passed} of {total} Goals Passed Successfully
      </span>

      {/* Goal cards grouped by section */}
      {Object.entries(sections).map(([section, sectionItems]) => (
        <div key={section} className={styles.section}>
          {section && <span className={styles.sectionTitle}>{section}</span>}
          {sectionItems.map((g, i) => (
            <div key={i} className={`${styles.card} ${g.pass ? styles.pass : styles.fail}`}>
              <div className={styles.cardIcon}>
                <Icon
                  name={g.pass ? 'solar:check-circle-bold' : 'solar:close-circle-bold'}
                  size={16}
                  color={g.pass ? '#009b53' : '#D72825'}
                />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.cardName}>{g.name}</span>
                {g.desc && <span className={styles.cardDesc}>{g.desc}</span>}
              </div>
              <Badge
                tone={g.pass ? 'success' : 'danger'}
                label={g.pass ? 'Pass' : 'Fail'}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
