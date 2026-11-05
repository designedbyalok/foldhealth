import { Banner } from './Banner';
import { Link } from '../Link/Link';

const TONES = ['info', 'success', 'warning', 'danger'];

export default {
  title: 'Feedback/Banner',
  component: Banner,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A message that stays put in the layout: what an action does, where its output goes, a deadline, a warning. `tone` is the meaning; `variant="soft"` (default) tints the strip and keeps the text neutral, `variant="outline"` adds a tone border and tone text for a notice that has to stand out; `size="sm"` is the compact in-flow form. Slots: `meta` (short text at the right end), `action` (a link or button), `onClose` (a dismiss button). Replaces `InfoBar` and `Alert`.',
      },
    },
  },
  argTypes: {
    tone: { control: 'select', options: TONES, table: { defaultValue: { summary: 'info' } } },
    variant: { control: 'select', options: ['soft', 'outline'], table: { defaultValue: { summary: 'soft' } } },
    size: { control: 'select', options: ['sm', 'md'], table: { defaultValue: { summary: 'md' } } },
    icon: { control: 'text', description: "Solar icon; defaults to the tone's" },
    meta: { control: 'text' },
    children: { control: 'text' },
  },
};

export const Playground = {
  args: { tone: 'info', variant: 'soft', size: 'md', children: "All signed notes sync to the patient's EHR." },
};

const col = { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: 460 };

/** Every tone in each variant and size. */
export const ToneMatrix = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
      {[['soft', 'md'], ['soft', 'sm'], ['outline', 'md']].map(([variant, size]) => (
        <div key={variant + size} style={col}>
          {TONES.map(tone => (
            <Banner key={tone} tone={tone} variant={variant} size={size} meta={variant === 'outline' ? 'Due 11/06' : undefined}>
              {`${variant}${size === 'sm' ? ', sm' : ''}: ${tone}`}
            </Banner>
          ))}
        </div>
      ))}
    </div>
  ),
};

/** The right-end slots: meta, an action, and dismiss. */
export const Slots = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={col}>
      <Banner variant="outline" tone="warning" meta="Due 11/06">Verbal order expires in 2 days</Banner>
      <Banner tone="info" action={<Link onClick={() => {}}>Stop</Link>}>Recording this call for the note</Banner>
      <Banner tone="success" onClose={() => {}}>Template published</Banner>
    </div>
  ),
};
