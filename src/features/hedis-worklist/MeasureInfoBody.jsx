import { MEASURE_INFO, DEFAULT_MEASURE_INFO } from './measureInfoData';
import styles from './MeasureInfoBody.module.css';

/**
 * MeasureInfoBody: read-only content pane for the "Measure Details"
 * left workspace of the Care Gap drawer. Mirrors the HCC Tutorial pane:
 * each section is a bordered card with a primary-tone heading, followed
 * by nested bullets (Requirements) or scenario + action groups
 * (Instructions).
 */
export function MeasureInfoBody({ gapCode }) {
  const info = MEASURE_INFO[gapCode] || DEFAULT_MEASURE_INFO;

  return (
    <div className={styles.body}>
      <Section title="Measure Requirements">
        <NestedList items={info.requirements} />
      </Section>

      <Section title="Measure Instructions">
        {info.instructions.map((group, i) => {
          if (group.intro) {
            return (
              <p key={`intro-${i}`} className={styles.intro}>{group.intro}</p>
            );
          }
          return (
            <div key={`grp-${i}`} className={styles.scenarioGroup}>
              {group.heading && <div className={styles.scenarioHeading}>{group.heading}</div>}
              {group.items?.length ? (
                <ul className={styles.actionList}>
                  {group.items.map((it, j) => (
                    <li key={`item-${i}-${j}`}>{it.text}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionHeading}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function NestedList({ items, level = 0 }) {
  if (!items?.length) return null;
  const cls = level === 0 ? styles.listL0 : level === 1 ? styles.listL1 : styles.listL2;
  return (
    <ul className={cls}>
      {items.map((it, i) => (
        <li key={`n-${level}-${i}`}>
          <span>{it.text}</span>
          {it.children?.length ? <NestedList items={it.children} level={level + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}
