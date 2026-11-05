import { useState } from 'react';
import { CommentComposer } from './CommentComposer';

export default {
  title: 'Composed/CommentComposer',
  component: CommentComposer,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: { component: 'Multi-line comment composer used on task, chart, and diagnosis drawers. Supports @-mentions and can morph into a status-change card.' },
    },
  },
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'Add a comment, use @ to mention someone' } },
    },
    autoFocus: {
      control: 'boolean',
      description: 'Focus the textarea and expand actions on mount.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    statusChange: {
      control: 'object',
      description: 'When provided, morphs into a status-change card.',
      table: { type: { summary: '{ fromStatus, toStatus, onCancel }' } },
    },
    onSubmit: {
      action: 'onSubmit',
      description: 'Fires with the trimmed body on Comment click.',
      table: { type: { summary: '(body: string) => void' } },
    },
  },
};

function Wrapper(props) {
  const [submissions, setSubmissions] = useState([]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      <CommentComposer
        {...props}
        onSubmit={(body) => {
          setSubmissions(s => [...s, body]);
          props.onSubmit?.(body);
        }}
      />
      {submissions.length > 0 && (
        <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-300)', borderTop: '1px solid var(--neutral-150)', paddingTop: '0.5rem' }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Submitted:</div>
          {submissions.map((s, i) => <div key={i}>{i + 1}. {s}</div>)}
        </div>
      )}
    </div>
  );
}

export const Playground = {
  render: (args) => <Wrapper {...args} />,
  args: {
    placeholder: 'Add a comment, use @ to mention someone',
    autoFocus: false,
  },
};

export const Collapsed = {
  name: 'Default (collapsed)',
  parameters: {
    docs: { description: { story: 'Default state: matches the Input primitive: 32px control, 0.5px --neutral-150 border, 6px radius. Focus lifts the border to --primary-300 with a primary glow.' } },
  },
  render: (args) => <Wrapper {...args} />,
  args: {
    placeholder: 'Add a comment, use @ to mention someone',
    autoFocus: false,
  },
};

export const Expanded = {
  name: 'Expanded',
  parameters: {
    docs: { description: { story: 'Focused state: the field grows to an 80px min-height, actions appear, and the bottom-right corner shows a native drag handle to resize the composer vertically up to 320px.' } },
  },
  render: (args) => <Wrapper {...args} />,
  args: {
    placeholder: 'Add a comment, use @ to mention someone',
    autoFocus: true,
  },
};

export const StatusChangeMode = {
  name: 'Status change mode',
  parameters: {
    docs: { description: { story: 'Morphs into a "Status Changed" card with a mandatory-comment helper: used when a workflow transition (e.g. Coder → Record Requested) requires a note before firing.' } },
  },
  render: (args) => <Wrapper {...args} />,
  args: {
    placeholder: 'Add a comment, use @ to mention someone',
    statusChange: { fromStatus: 'Coder', toStatus: 'Record Requested', onCancel: () => {} },
  },
};
