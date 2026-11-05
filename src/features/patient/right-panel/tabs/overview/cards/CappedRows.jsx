import { useState } from 'react';
import { PanelSectionMore } from '../../../../../../components/PanelSection/PanelSection';
import styles from './overviewCards.module.css';

// A list that stays short until the reader asks for the rest, so one widget
// cannot push the rest of its column off the screen.
export function CappedRows({ items, limit = 3, resetKey, render }) {
  const [expanded, setExpanded] = useState(false);
  const [seenKey, setSeenKey] = useState(resetKey);
  if (resetKey !== seenKey) {
    setSeenKey(resetKey);
    setExpanded(false);
  }
  const shown = expanded ? items : items.slice(0, limit);
  return (
    <>
      {shown.map(render)}
      <PanelSectionMore className={styles.listMore} expanded={expanded} hiddenCount={items.length - limit} onToggle={() => setExpanded(v => !v)} />
    </>
  );
}
