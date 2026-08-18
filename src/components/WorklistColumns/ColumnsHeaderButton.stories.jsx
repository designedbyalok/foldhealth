import { useState } from 'react';
import { ColumnsHeaderButton } from './ColumnsHeaderButton';

export default {
  title: 'Popovers/ColumnsHeaderButton',
  component: ColumnsHeaderButton,
};

const COLUMNS = [
  { key: 'dos', label: 'DOS' },
  { key: 'icds', label: 'Open ICDs' },
  { key: 'visit', label: 'Visit Type' },
  { key: 'provider', label: 'Rendering Provider' },
  { key: 'created', label: 'Created Date' },
];

export const InActionsHeader = () => {
  const [hidden, setHidden] = useState(new Set());
  return (
    <div style={{ padding: 24, background: 'var(--neutral-0)', width: 240 }}>
      <ColumnsHeaderButton
        columns={COLUMNS}
        hiddenSet={hidden}
        onToggle={(k) => setHidden(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; })}
        onReorder={() => {}}
        onReset={() => setHidden(new Set())}
      />
    </div>
  );
};
