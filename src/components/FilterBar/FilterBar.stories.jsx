import { FilterBar } from './FilterBar';

export default {
  title: 'Composed/FilterBar',
  component: FilterBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: { component: 'The full worklist filter bar: View By toggle plus the FilterChip cluster. Reads/writes state directly from the shared Zustand store; no props.' },
    },
  },
};

// FilterBar pulls state entirely from the shared Zustand store
// (viewBy, activeFilters, patients, savedFilters). No props to configure,
// interact with it directly inside the canvas.
export const Playground = {
  render: () => (
    <div style={{ padding: 16, background: 'var(--neutral-50)', minHeight: 200 }}>
      <FilterBar />
    </div>
  ),
};
