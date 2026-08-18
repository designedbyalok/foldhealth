import { useState } from 'react';
import { ColumnConfigPopover } from './ColumnConfigPopover';

export default {
  title: 'Popovers/ColumnConfigPopover',
  component: ColumnConfigPopover,
};

const COLUMNS = [
  { k: 'dos', lb: 'DOS' },
  { k: 'icds', lb: 'Open ICDs' },
  { k: 'visit', lb: 'Visit Type' },
  { k: 'provider', lb: 'Rendering Provider' },
  { k: 'created', lb: 'Created Date' },
];

export const Interactive = () => {
  const [hidden, setHidden] = useState(new Set());
  const [anchor, setAnchor] = useState(null);
  return (
    <div style={{ padding: 48 }}>
      <button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget.getBoundingClientRect())}
        style={{ padding: '6px 12px' }}
      >
        Open Show Columns
      </button>
      {anchor && (
        <ColumnConfigPopover
          anchorRect={anchor}
          columns={COLUMNS}
          hidden={hidden}
          onToggle={(k) => setHidden(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; })}
          onReorder={() => {}}
          onReset={() => setHidden(new Set())}
          onClose={() => setAnchor(null)}
        />
      )}
    </div>
  );
};
