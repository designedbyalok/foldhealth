import { PriorityIcon } from './PriorityIcon';

export default {
  title: 'Icons/PriorityIcon',
  component: PriorityIcon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Task-priority glyph shared across the Tasks module, the Patient profile drawer\'s Tasks tab, and anywhere else a task priority needs an at-a-glance indicator. High = coral stacked chevrons; Medium = amber double-bar; Low = blue stacked chevrons; None = neutral outlined circle. Decorative by default (`aria-hidden`); pass `title` to give it an accessible name.',
      },
    },
  },
  argTypes: {
    priority: {
      control: { type: 'select' },
      options: ['high', 'medium', 'low', 'none'],
      description: 'Task priority level.',
      table: { type: { summary: "'high' | 'medium' | 'low' | 'none'" } },
    },
    size: {
      control: { type: 'number', min: 12, max: 48, step: 2 },
      description: 'Icon edge in px.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '16' } },
    },
    title: {
      control: 'text',
      description: 'Optional accessible label. When set, the SVG gets `role="img"` and `aria-label`; when omitted, it stays `aria-hidden` for decorative use.',
      table: { type: { summary: 'string' } },
    },
  },
};

export const High = { args: { priority: 'high' } };
export const Medium = { args: { priority: 'medium' } };
export const Low = { args: { priority: 'low' } };
export const None = { args: { priority: 'none' } };

export const AllLevels = {
  parameters: {
    docs: { description: { story: 'All four variants at the size used in the Tasks row (16px).' } },
  },
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      {['high', 'medium', 'low', 'none'].map(p => (
        <div key={p} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <PriorityIcon priority={p} size={16} />
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-300)', textTransform: 'capitalize' }}>{p}</span>
        </div>
      ))}
    </div>
  ),
};

export const Sizes = {
  parameters: {
    docs: { description: { story: 'Scales cleanly from 14px to 32px, the internal gradient stays legible across sizes.' } },
  },
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      {[14, 16, 20, 24, 32].map(s => (
        <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <PriorityIcon priority="high" size={s} />
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-300)' }}>{s}px</span>
        </div>
      ))}
    </div>
  ),
};

export const WithAccessibleLabel = {
  args: { priority: 'high', title: 'High priority' },
  parameters: {
    docs: { description: { story: 'Pass `title` when the priority isn\'t announced by surrounding text. The icon then renders as `<svg role="img" aria-label="…">`.' } },
  },
};
