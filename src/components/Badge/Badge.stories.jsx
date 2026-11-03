import { Badge } from './Badge';

const TONES = ['neutral', 'primary', 'secondary', 'success', 'warning', 'danger', 'info', 'magenta', 'unity'];
const VARIANTS = ['soft', 'outline', 'ghost', 'solid'];
const SIZES = ['xs', 'sm', 'md', 'lg'];

export default {
  title: 'Core/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A small pill that surfaces a status, category or count. Two axes, as in the Figma "Fold Pixel 1.0" Badge (node 24:1678): `tone` is the meaning (`neutral`, `primary`, `secondary`, `success`, `warning`, `danger`, `info`, plus the `magenta` Out of Office and `unity` AI accents) and `variant` is the emphasis (`soft` tinted pill, `outline` white with a border, `ghost` bare text, `solid` filled count). Statuses belong to features: a feature maps its own values to a tone and the Badge only paints it.',
      },
    },
  },
  argTypes: {
    tone: { control: 'select', options: TONES, table: { defaultValue: { summary: 'neutral' } } },
    variant: { control: 'select', options: VARIANTS, table: { defaultValue: { summary: 'soft' } } },
    size: {
      control: 'select',
      options: [undefined, ...SIZES],
      description: 'xs 18px, sm 20px, md 24px, lg 28px. Unset is the compact base (about 18px) older rows use.',
    },
    disabled: { control: 'boolean', description: 'Muted, for a value that does not apply' },
    hover: { control: 'boolean', description: 'Force the hover look (only badges with a chevron or dismiss button tint for real)' },
    label: { control: 'text' },
    icon: { control: 'text', description: 'Leading Solar icon name' },
    trailingIcon: { control: 'text', description: 'Trailing Solar icon name' },
    dot: { control: 'boolean', description: 'Leading dot in the text color' },
    chevron: { control: 'boolean', description: 'Trailing chevron, for a popover-trigger badge' },
  },
};

export const Playground = {
  args: { tone: 'primary', variant: 'soft', size: 'md', label: 'Badge', disabled: false, hover: false, dot: false, chevron: false },
};

const cell = { padding: 'var(--space-1) var(--space-2)' };
const head = { ...cell, fontSize: 'var(--font-xs)', color: 'var(--neutral-300)', textAlign: 'left', fontWeight: 500 };

/** Every tone × variant at md, plus the hover look. The Figma matrix, node 24:1678. */
export const ToneMatrix = {
  parameters: { controls: { disable: true } },
  render: () => (
    <table style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={head} />
          {VARIANTS.map(v => <th key={v} style={head}>{v}</th>)}
          <th style={head}>soft, hover</th>
        </tr>
      </thead>
      <tbody>
        {TONES.map(t => (
          <tr key={t}>
            <th style={head}>{t}</th>
            {VARIANTS.map(v => <td key={v} style={cell}><Badge tone={t} variant={v} size="md" label="Badge" /></td>)}
            <td style={cell}><Badge tone={t} size="md" hover chevron label="Badge" /></td>
          </tr>
        ))}
        <tr>
          <th style={head}>disabled</th>
          <td style={cell} colSpan={5}><Badge size="md" disabled label="Not applicable" /></td>
        </tr>
      </tbody>
    </table>
  ),
};

/** The four sizes, and the unsized compact base. */
export const Sizes = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      {SIZES.map(s => <Badge key={s} tone="primary" size={s} icon="solar:check-circle-linear" label={`size="${s}"`} />)}
      <Badge tone="primary" icon="solar:check-circle-linear" label="unsized" />
    </div>
  ),
};

/** Slots: dot, leading icon, chevron, count, dismiss. */
export const Slots = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
      <Badge tone="success" size="md" label="Enrolled" />
      <Badge tone="success" size="md" label="Enrolled" dot />
      <Badge tone="success" size="md" label="Enrolled" icon="solar:check-circle-linear" />
      <Badge tone="primary" size="md" label="DOS" chevron />
      <Badge size="md" label="Recorded By" chevron />
      <Badge tone="secondary" variant="solid" size="xs" label="3" />
      <Badge variant="outline" size="md" label="Tag" trailingIcon="solar:close-circle-linear" onTrailingIconClick={() => {}} />
    </div>
  ),
};

/**
 * How a feature shows its statuses: it owns the map from its values to a tone.
 * (Before, each status was its own Badge variant.)
 */
export const FeatureStatusMap = {
  parameters: { controls: { disable: true } },
  render: () => {
    const TOC_STATUS_TONE = { Enrolled: 'success', Engaged: 'info', Attempted: 'warning', New: 'neutral', 'On Call': 'primary' };
    return (
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        {Object.entries(TOC_STATUS_TONE).map(([status, tone]) => <Badge key={status} tone={tone} size="md" label={status} />)}
      </div>
    );
  },
};
