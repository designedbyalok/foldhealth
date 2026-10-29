import { useRef, useState } from 'react';
import { MenuPopover } from './MenuPopover';
import { CheckboxListPopover } from '../CheckboxListPopover/CheckboxListPopover';
import { RadioListPopover } from '../RadioListPopover/RadioListPopover';
import { SearchListPopover } from '../SearchListPopover/SearchListPopover';

export default {
  title: 'Overlays/Popover Family',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Family of anchor-positioned popovers that FilterChip and toolbar buttons open. Every variant takes an `anchorRect` (the trigger\'s bounding rect) plus its own value/options shape:\n\n- **`MenuPopover`** — flat action list (used by `⋯` overflow menus)\n- **`CheckboxListPopover`** — multi-select with optional search + Clear\n- **`RadioListPopover`** — single-select with optional Clear\n- **`SortPopover`** — sortable-column picker with asc/desc directions\n- **`SearchListPopover`** — search-filtered single-pick list\n- **`DateRangePopover`** — two-calendar date range picker\n- **`RangeSliderPopover`** — numeric min/max slider with unit label\n\nUse the `kind` control to flip between the variants; `searchable` applies to the checkbox list.',
      },
    },
  },
  argTypes: {
    kind: {
      control: { type: 'select' },
      options: ['menu', 'checkbox-list', 'radio-list', 'search-list'],
      description: 'Which popover variant to render.',
    },
    searchable: {
      control: 'boolean',
      description: 'Adds the search row (checkbox-list only).',
      if: { arg: 'kind', eq: 'checkbox-list' },
    },
  },
  args: { kind: 'menu', searchable: false },
};

function PopoverDemo({ buttonLabel = 'Open popover', children }) {
  const btnRef = useRef(null);
  const [rect, setRect] = useState(null);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => setRect(rect ? null : e.currentTarget.getBoundingClientRect())}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid var(--neutral-150)',
          background: 'var(--white)',
          cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
          fontSize: 'var(--font-md)',
          color: 'var(--neutral-400)',
        }}
      >
        {buttonLabel}
      </button>
      {rect && children({ rect, close: () => setRect(null) })}
    </div>
  );
}

function MenuDemo() {
  return (
    <PopoverDemo buttonLabel="Row actions">
      {({ rect, close }) => (
        <MenuPopover
          anchorRect={rect}
          onClose={close}
          onSelect={() => {}}
          items={[
            { key: 'edit', icon: 'solar:pen-linear', label: 'Edit' },
            { key: 'copy', icon: 'solar:copy-linear', label: 'Duplicate' },
            { key: 'archive', icon: 'solar:archive-linear', label: 'Archive', trailing: true },
            { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true },
          ]}
        />
      )}
    </PopoverDemo>
  );
}

function CheckboxDemo({ label, options, initial = [], searchable = false, buttonLabel }) {
  const [selected, setSelected] = useState(initial);
  return (
    <PopoverDemo buttonLabel={buttonLabel || label}>
      {({ rect, close }) => (
        <CheckboxListPopover
          anchorRect={rect}
          onClose={close}
          label={label}
          options={options}
          selected={selected}
          onChange={setSelected}
          searchable={searchable}
        />
      )}
    </PopoverDemo>
  );
}


function RadioDemo({ label, options, initial = [], buttonLabel }) {
  const [selected, setSelected] = useState(initial);
  return (
    <PopoverDemo buttonLabel={buttonLabel || label}>
      {({ rect, close }) => (
        <RadioListPopover
          anchorRect={rect}
          onClose={close}
          label={label}
          options={options}
          selected={selected}
          onChange={setSelected}
        />
      )}
    </PopoverDemo>
  );
}

function SearchListDemo() {
  return (
    <PopoverDemo buttonLabel="Assignee">
      {({ rect, close }) => (
        <SearchListPopover
          anchorRect={rect}
          onClose={close}
          searchPlaceholder="Search team members…"
          options={[
            { value: 'alice', label: 'Alice Nguyen' },
            { value: 'bob', label: 'Bob Chen' },
            { value: 'charlie', label: 'Charlie Rivera' },
            { value: 'diana', label: 'Diana Patel' },
            { value: 'eve', label: 'Eve Johnson' },
            { value: 'frank', label: 'Frank Weber', disabled: true },
          ]}
          onSelect={() => {}}
        />
      )}
    </PopoverDemo>
  );
}

export const Playground = {
  render: ({ kind, searchable }) => {
    // Each kind is its own demo component — switching the control swaps the
    // whole subtree, so hook order never changes within one component.
    if (kind === 'checkbox-list') {
      return searchable ? (
        <CheckboxDemo
          label="Diagnosis"
          buttonLabel="Filter diagnosis"
          searchable
          options={[
            'E11.9 Type 2 diabetes',
            'I10 Essential hypertension',
            'J45.909 Asthma, unspecified',
            'N18.3 CKD stage 3',
            'F32.9 Depression, unspecified',
            'M17.11 Osteoarthritis, right knee',
          ]}
        />
      ) : (
        <CheckboxDemo
          label="Status"
          buttonLabel="Filter status"
          options={['New', 'In Progress', 'Under Review', 'Closed']}
          initial={['New']}
        />
      );
    }
    if (kind === 'radio-list') {
      return (
        <RadioDemo
          label="Sort by"
          buttonLabel="Sort"
          options={['Newest first', 'Oldest first', 'Highest score', 'Lowest score']}
          initial={['Newest first']}
        />
      );
    }
    if (kind === 'search-list') return <SearchListDemo />;
    return <MenuDemo />;
  },
};
