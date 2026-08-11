import { useState } from 'react';
import { ColorPicker } from './ColorPicker';
import { ColorInput } from './ColorInput';

const VARIABLES = [
  { name: 'Brand', hex: '#7C5CFA' },
  { name: 'Accent', hex: '#22C55E' },
  { name: 'Text', hex: '#3A485F' },
  { name: 'Muted', hex: '#7B8499' },
];

const RECENT = ['#7C5CFA', '#F97316', '#0EA5E9', '#111827', '#FDE68A'];

const LINEAR = 'linear-gradient(90deg, #7C5CFA 0%, #22C55E 100%)';
const RADIAL = 'radial-gradient(#FDE68A 0%, #F97316 100%)';
const MULTI_STOP = 'linear-gradient(135deg, #7C5CFA 0%, #0EA5E9 35%, #22C55E 70%, #FDE68A 100%)';

export default {
  title: 'Email Builder/ColorPicker',
  component: ColorPicker,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          'Color picker popover behind every color field in the email builder and form-builder settings.',
          'Controlled — the host owns `value`, which is a hex string (`#RRGGBB`, or `#RRGGBBAA` when opacity is',
          'below 100%) or a CSS gradient string. The Solid/Gradient toggle reads the initial `value`: a gradient',
          'string opens in Gradient mode, anything else in Solid.',
          '',
          'The value field reads and accepts **Hex, RGB, HSL, HSB, OKLCH and CSS** — a display preference only,',
          'since the stored value is always hex. Opacity has its own ramp and `%` field.',
          'Drag the picker anywhere by the grip at the top.',
          '',
          'The eyedropper button only renders where the native `EyeDropper` API exists (Chromium, Edge, Opera) —',
          'expect it to be missing in Firefox and Safari rather than present-but-dead.',
        ].join(' '),
      },
    },
  },
  argTypes: {
    value: {
      control: 'text',
      description: 'Current color — `#RRGGBB` (or `#RRGGBBAA` with opacity) for solid, or a `linear-gradient(…)` / `radial-gradient(…)` string.',
      table: { type: { summary: 'string' } },
    },
    onChange: {
      action: 'onChange',
      description: 'Fires with the next hex or gradient string on every edit.',
      table: { type: { summary: '(next: string) => void' } },
    },
    variables: {
      control: 'object',
      description: 'Brand color variables shown in the Variables grid. Hidden when empty.',
      table: { type: { summary: '{ name: string, hex: string }[]' }, defaultValue: { summary: '[]' } },
    },
    recentlyUsed: {
      control: 'object',
      description: 'MRU hex list shown in the Recently used grid. Hidden when empty.',
      table: { type: { summary: 'string[]' }, defaultValue: { summary: '[]' } },
    },
    onCommitRecent: {
      action: 'onCommitRecent',
      description: 'Fires with each committed solid hex so the host can maintain the MRU list. Gradients skip it.',
      table: { type: { summary: '(hex: string) => void' } },
    },
    allowGradient: {
      control: 'boolean',
      description: 'Show the Solid / Gradient toggle. When false the picker is solid-only.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' } },
    },
  },
};

// The picker is controlled, so every story needs a host that owns the value.
// Committed hexes feed the Recently-used list the same way the store does in
// the real app.
function Wrapper({ value: initial = '#7C5CFA', recentlyUsed = [], onCommitRecent, onChange, ...props }) {
  const [value, setValue] = useState(initial);
  const [recent, setRecent] = useState(recentlyUsed);
  return (
    <ColorPicker
      {...props}
      value={value}
      onChange={(next) => { setValue(next); onChange?.(next); }}
      recentlyUsed={recent}
      onCommitRecent={(hex) => {
        setRecent(prev => [hex, ...prev.filter(c => c.toUpperCase() !== hex.toUpperCase())].slice(0, 10));
        onCommitRecent?.(hex);
      }}
    />
  );
}

// Keyed on the incoming value so editing the `value` control remounts the
// picker — mode is derived from `value` at mount only.
const render = (args) => <Wrapper key={args.value} {...args} />;

export const Playground = {
  render,
  args: {
    value: '#7C5CFA',
    variables: VARIABLES,
    recentlyUsed: RECENT,
    allowGradient: true,
  },
};

export const Solid = {
  render,
  args: { value: '#7C5CFA', variables: VARIABLES, recentlyUsed: RECENT },
  parameters: {
    docs: { description: { story: 'Default state: HSV square, hue slider, eyedropper + hex + RGB inputs, then the Recently used and Variables grids.' } },
  },
};

export const SolidOnly = {
  render,
  args: { value: '#22C55E', variables: VARIABLES, recentlyUsed: RECENT, allowGradient: false },
  parameters: {
    docs: { description: { story: '`allowGradient={false}` — the mode toggle is gone and the picker can only produce a hex. Used by fields where a gradient is not a valid value (e.g. text color).' } },
  },
};

export const Translucent = {
  render,
  args: { value: '#7C5CFA59', variables: VARIABLES, recentlyUsed: RECENT },
  parameters: {
    docs: { description: { story: 'Opacity rides along in the value as an 8-digit hex (`#RRGGBBAA`) — here 35%. The opacity ramp sits under the hue ramp with a checkerboard track, and the `%` field mirrors it. Note the MRU list only takes opaque hexes, so translucent picks are not recorded as recents.' } },
  },
};

export const Bare = {
  render,
  args: { value: '#0EA5E9', variables: [], recentlyUsed: [] },
  parameters: {
    docs: { description: { story: 'No variables and no history — both swatch sections collapse and the popover is just square + hue + inputs. This is the first-run state.' } },
  },
};

export const VariablesOnly = {
  render,
  args: { value: '#3A485F', variables: VARIABLES, recentlyUsed: [] },
  parameters: {
    docs: { description: { story: 'Variables present, history empty — what a fresh session on a branded template looks like.' } },
  },
};

export const LinearGradient = {
  render,
  args: { value: LINEAR, variables: VARIABLES, recentlyUsed: RECENT },
  parameters: {
    docs: { description: { story: 'A gradient value opens in Gradient mode: type select, reverse action, preview, angle slider, the stops list, and an inline solid picker bound to the active stop.' } },
  },
};

export const RadialGradient = {
  render,
  args: { value: RADIAL, variables: VARIABLES, recentlyUsed: RECENT },
  parameters: {
    docs: { description: { story: 'Radial gradients have no direction, so the angle row is hidden.' } },
  },
};

export const MultiStopGradient = {
  render,
  args: { value: MULTI_STOP, variables: VARIABLES, recentlyUsed: RECENT },
  parameters: {
    docs: { description: { story: 'Four stops. Above two stops the per-row remove buttons are enabled; at exactly two they are disabled, since a gradient needs at least two stops.' } },
  },
};

// The field that opens the picker. It pulls variables and the MRU list from
// the store itself, so it takes no data props.
function FieldRow({ label, value: initial, allowGradient }) {
  const [value, setValue] = useState(initial);
  return <ColorInput label={label} value={value} onChange={setValue} allowGradient={allowGradient} />;
}

export const TriggerField = {
  parameters: {
    layout: 'padded',
    docs: { description: { story: 'The `ColorInput` field that hosts the picker — a swatch dot plus a hex input, opening the popover on click. A white swatch gets a visible border so it does not disappear against the panel; a gradient value shows a read-only "Gradient" label instead of a hex.' } },
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 220 }}>
      <FieldRow label="Solid" value="#7C5CFA" />
      <FieldRow label="White (bordered swatch)" value="#FFFFFF" />
      <FieldRow label="Gradient (read-only hex)" value={LINEAR} />
      <FieldRow label="Solid only" value="#22C55E" allowGradient={false} />
    </div>
  ),
};

const MATRIX = [
  ['Solid', { value: '#7C5CFA', variables: VARIABLES, recentlyUsed: RECENT }],
  ['Solid only', { value: '#22C55E', variables: VARIABLES, recentlyUsed: RECENT, allowGradient: false }],
  ['Translucent', { value: '#7C5CFA59', variables: VARIABLES, recentlyUsed: RECENT }],
  ['Bare', { value: '#0EA5E9', variables: [], recentlyUsed: [] }],
  ['Linear gradient', { value: LINEAR, variables: VARIABLES, recentlyUsed: RECENT }],
  ['Radial gradient', { value: RADIAL, variables: VARIABLES, recentlyUsed: RECENT }],
  ['Multi-stop gradient', { value: MULTI_STOP, variables: VARIABLES, recentlyUsed: RECENT }],
];

export const AllStates = {
  parameters: {
    layout: 'padded',
    docs: { description: { story: 'Every popover state side by side for a visual sweep.' } },
  },
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>
      {MATRIX.map(([label, args]) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ font: '500 12px/1.4 Inter, sans-serif', color: 'var(--neutral-300)' }}>{label}</span>
          <Wrapper {...args} />
        </div>
      ))}
    </div>
  ),
};
