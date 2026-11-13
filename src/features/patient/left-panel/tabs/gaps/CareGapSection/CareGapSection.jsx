import { Fragment, useMemo, useState } from 'react';
import { ProfileTable } from '../../../../../../components/ProfileTable/ProfileTable';
import { CareGapItem } from '../CareGapItem/CareGapItem.jsx';
import { GAP_TABLE_COLUMNS } from '../gapTableColumns';
import styles from './CareGapSection.module.css';

export function CareGapSection({ section, selectedGaps, onToggleGap, onOpenGap }) {
  const selectedSet = useMemo(() => new Set(selectedGaps), [selectedGaps]);
  // Open gaps whose previous instances are expanded below them.
  const [expanded, setExpanded] = useState(() => new Set());
  const togglePrevious = (id) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  if (!section.items.length) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.sectionLabel}>{section.title}</div>
      <ProfileTable
        columns={GAP_TABLE_COLUMNS}
        rows={section.items}
        renderRow={item => (
          <Fragment key={item.id}>
            <CareGapItem
              item={item}
              selected={selectedSet.has(item.id)}
              onSelect={onToggleGap}
              onOpen={onOpenGap}
              previousOpen={expanded.has(item.id)}
              onTogglePrevious={() => togglePrevious(item.id)}
            />
            {expanded.has(item.id) && (item.previous || []).map(prev => (
              <CareGapItem key={prev.id} item={prev} nested onOpen={onOpenGap} />
            ))}
          </Fragment>
        )}
      />
    </div>
  );
}
