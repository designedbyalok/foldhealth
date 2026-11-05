import { useMemo } from 'react';
import { ProfileTable } from '../../../../../../components/ProfileTable/ProfileTable';
import { CareGapItem } from '../CareGapItem/CareGapItem.jsx';
import { GAP_TABLE_COLUMNS } from '../gapTableColumns';
import styles from './CareGapSection.module.css';

export function CareGapSection({ section, selectedGaps, onToggleGap, onOpenGap }) {
  const selectedSet = useMemo(() => new Set(selectedGaps), [selectedGaps]);
  if (!section.items.length) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.sectionLabel}>{section.title}</div>
      <ProfileTable
        columns={GAP_TABLE_COLUMNS}
        rows={section.items}
        renderRow={item => (
          <CareGapItem
            key={item.id}
            item={item}
            selected={selectedSet.has(item.id)}
            onSelect={onToggleGap}
            onOpen={onOpenGap}
          />
        )}
      />
    </div>
  );
}
