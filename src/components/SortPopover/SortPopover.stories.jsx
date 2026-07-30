import { useRef, useState } from 'react';
import { SortPopover } from './SortPopover';

export default {
  title: 'Overlays/SortPopover',
  component: SortPopover,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Sort picker with explicit ascending/descending direction. One-item mode = per-column sort menu; multi-item mode = "Sort by [Field]" list. Anchored to a trigger rect and rendered via portal; closes on overlay click / Escape.',
      },
    },
  },
  argTypes: {
    items: {
      control: 'object',
      description: 'Sortable axes for this column. One item = compact per-column menu, 2+ items = multi-field mode.',
      table: { type: { summary: '{ key: string; label: string }[]' } },
    },
    currentKey: {
      control: 'text',
      description: 'Currently active sort key (across the table).',
      table: { type: { summary: 'string | null' } },
    },
    currentDir: {
      control: 'radio',
      options: ['asc', 'desc'],
      description: 'Currently active sort direction.',
      table: { type: { summary: "'asc' | 'desc'" } },
    },
    width: {
      control: { type: 'number', min: 160, max: 360 },
      description: 'Popover width in px.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '208' } },
    },
    onSort: {
      action: 'onSort',
      description: 'Fires with the picked `(key, dir)` selection.',
      table: { type: { summary: '(key: string, dir: "asc" | "desc") => void' } },
    },
    onClear: {
      action: 'onClear',
      description: 'Fires when the "Clear Sort" footer is clicked.',
      table: { type: { summary: '() => void' } },
    },
    onClose: {
      action: 'onClose',
      description: 'Fires when the popover should dismiss.',
      table: { type: { summary: '() => void' } },
    },
  },
};

function Demo(props) {
  const btnRef = useRef(null);
  const [rect, setRect] = useState(null);
  const [sort, setSort] = useState({ key: props.currentKey, dir: props.currentDir });
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => setRect(rect ? null : e.currentTarget.getBoundingClientRect())}
        style={{
          padding: '6px 12px', borderRadius: 6, border: '1px solid var(--neutral-150)',
          background: 'var(--neutral-0)', cursor: 'pointer', fontSize: 13, color: 'var(--neutral-400)',
        }}
      >
        Sort {sort.key ? `— ${sort.key} ${sort.dir}` : ''}
      </button>
      {rect && (
        <SortPopover
          {...props}
          anchorRect={rect}
          currentKey={sort.key}
          currentDir={sort.dir}
          onSort={(key, dir) => { setSort({ key, dir }); setRect(null); }}
          onClear={() => { setSort({ key: null, dir: 'asc' }); setRect(null); }}
          onClose={() => setRect(null)}
        />
      )}
    </div>
  );
}

const MULTI_ITEMS = [
  { key: 'name', label: 'Name' },
  { key: 'lastVisit', label: 'Last visit' },
  { key: 'risk', label: 'Risk score' },
];

export const Playground = {
  render: (args) => <Demo {...args} />,
  args: { items: MULTI_ITEMS, currentKey: 'name', currentDir: 'asc', width: 208 },
};
