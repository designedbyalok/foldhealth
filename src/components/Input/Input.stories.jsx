import { useState } from 'react';
import { Input } from './Input';

export default {
  title: 'Core/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Single-line text input: matches Figma Fold-Pixel node 25:21239 exactly. Renders a bare `<input>` when only styling props are passed (backward-compatible with 20+ existing callers); adds a wrapper with label / helper / error / slot chrome when any structural slot is set. Native `type` drives sensible `inputMode` + `autoComplete` defaults and unlocks type-aware validation via native `checkValidity()` or a custom `validate()` function.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['outline', 'ghost'],
      description: '`outline` is the bordered field; `ghost` shows its border only on hover / focus (inline-editable table cells).',
      table: { defaultValue: { summary: 'outline' } },
    },
    invalid: { control: 'boolean', description: 'Red chrome and `aria-invalid`. `errorText` implies it and adds the message.' },
    size: { control: 'select', options: ['sm', 'md'], description: 'md 32px, sm 28px', table: { defaultValue: { summary: 'md' } } },
    onValueChange: { action: 'onValueChange', description: '(value) => void, alongside the native `onChange(event)`.' },
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'time', 'datetime-local'],
      description: 'Native input type. Drives inputMode + autoComplete defaults. Date/time types delegate the calendar/clock UI to the browser while keeping Input\'s field chrome.',
    },
    // Label row
    showLabel: { control: 'boolean', description: 'Storybook-only toggle for the Title slot. Renders `label` when true.' },
    label: { control: 'text', description: 'Text above the input.' },
    required: { control: 'boolean', description: 'Adds a 4×4 red dot next to the label and forwards `required`.' },
    showInfo: { control: 'boolean', description: 'Info icon next to the label (`infoText` sets its tooltip).' },
    infoText: { control: 'text', description: 'Tooltip for the info icon.' },
    // Leading slots
    showLeadingIcon: { control: 'boolean', description: 'Storybook-only toggle for the leading icon slot.' },
    leadingIcon: { control: 'text', description: 'Solar icon name (e.g. `solar:user-linear`) or React node rendered before the input.' },
    showPriority: { control: 'boolean', description: 'Leading priority flag icon (Figma "Show Priority" toggle).' },
    // Trailing slots: each slot has a boolean toggle + a separate text value
    showTrailingText: { control: 'boolean', description: 'Show static trailing text.' },
    trailingText: { control: 'text', description: 'Trailing text value (e.g. "Days").' },
    showChevron: { control: 'boolean', description: 'Show the trailing chevron.' },
    chevronDirection: { control: 'select', options: ['down', 'up'], description: 'Chevron direction.' },
    // Superseded by `showChevron` + `chevronDirection` in the Playground,
    // hidden from Controls so it doesn't fall through as a "Set object"
    // catch-all. Still a first-class prop on the component itself.
    chevron: { table: { disable: true } },
    trailingAction: { control: 'boolean', description: 'Trailing icon action button (Figma "Trailing Action", default is a microphone).' },
    trailingActionLabel: { control: 'text' },
    trailingButton: { control: 'boolean', description: 'Show the trailing tertiary Button slot.' },
    trailingButtonText: { control: 'text', description: 'Label for the trailing Button.' },
    characterLimit: { control: 'boolean', description: 'Show the "N/limit" character counter on the trailing edge.' },
    characterLimitMax: { control: 'number', description: 'Max character count.' },
    showPasswordToggle: { control: 'boolean', description: 'Only meaningful for `type=password`. Adds an inline eye toggle.' },
    // Below the field
    showSupportingText: { control: 'boolean', description: 'Show supporting text below the input (helperText slot).' },
    helperText: { control: 'text', description: 'Muted text below the input. Hidden while an error shows.' },
    errorText: { control: 'text', description: 'Error message below the input. Forces the error state.' },
    validateOn: {
      control: 'select',
      options: ['blur', 'change', 'none'],
      description: 'When to run validation.',
    },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    defaultValue: { control: 'text' },
  },
};

const stack = { display: 'flex', flexDirection: 'column', gap: 16, width: 320 };

// Storybook glue: fold every "show*" toggle + its string/number value into
// the real Input props. Keeps the component API idiomatic (string-only
// slots) while the Storybook Controls panel mirrors Figma's toggle-first
// pattern where every string field has a boolean gate above it.
function InputFromArgs({
  showLabel, label,
  showLeadingIcon, leadingIcon,
  showTrailingText, trailingText,
  showChevron, chevronDirection,
  characterLimit, characterLimitMax,
  showSupportingText, helperText,
  ...rest
}) {
  return (
    <Input
      {...rest}
      label={showLabel ? label : undefined}
      leadingIcon={showLeadingIcon ? leadingIcon : undefined}
      trailingText={showTrailingText ? trailingText : undefined}
      chevron={showChevron ? (chevronDirection || 'down') : false}
      characterLimit={characterLimit ? characterLimitMax : undefined}
      helperText={showSupportingText ? helperText : undefined}
    />
  );
}

// ── Playground ──
export const Playground = {
  args: {
    variant: 'outline',
    invalid: false,
    size: 'md',
    type: 'text',
    // Label row
    showLabel: true,
    label: 'Title',
    required: true,
    showInfo: false,
    infoText: '',
    // Leading slots
    showLeadingIcon: false,
    leadingIcon: 'solar:user-linear',
    showPriority: false,
    // Field
    placeholder: 'Enter Task Title',
    // Trailing slots
    showTrailingText: false,
    trailingText: 'Days',
    showChevron: false,
    chevronDirection: 'down',
    trailingAction: false,
    trailingActionLabel: 'Voice input',
    trailingButton: false,
    trailingButtonText: 'Button Text',
    characterLimit: false,
    characterLimitMax: 150,
    // Below the field
    showSupportingText: false,
    helperText: 'This is supporting text',
    errorText: '',
    validateOn: 'blur',
    disabled: false,
    readOnly: false,
    defaultValue: '',
    showPasswordToggle: false,
  },
  render: (args) => <InputFromArgs {...args} />,
};

// ── Every Figma slot toggled on, mirrors the "Text Input Web" playground
// on Fold-Pixel-1.0 node 25:21239. Every flag here maps 1:1 to the Figma
// component's boolean/enum controls. ──
export const AllSlots = {
  args: {
    showLabel: true,
    label: 'Title',
    placeholder: 'Enter Task Title',
    required: true,
    showInfo: true,
    infoText: 'Task titles help teammates find work quickly.',
    showLeadingIcon: true,
    leadingIcon: 'solar:user-linear',
    showPriority: true,
    showTrailingText: true,
    trailingText: 'Days',
    showChevron: true,
    chevronDirection: 'down',
    trailingAction: true,
    trailingButton: true,
    trailingButtonText: 'Button Text',
    characterLimit: true,
    characterLimitMax: 150,
    showSupportingText: true,
    helperText: 'This is supporting text',
  },
  render: (args) => <InputFromArgs {...args} />,
  parameters: {
    docs: { description: { story: 'Every slot from the Figma Text Input Web component turned on at once.' } },
  },
};

// ── Every Figma state, top-to-bottom, matching the source frame ──
export const AllStates = {
  render: () => (
    <div style={stack}>
      <Input label="Title" placeholder="Enter Task Title" />
      <Input label="Title (filled)" defaultValue="Enter Task Title" />
      <Input label="Title (disabled)" defaultValue="Enter Task Title" disabled />
      <Input label="Title (readonly)" defaultValue="Enter Task Title" readOnly />
      <Input label="Title (error)" defaultValue="Enter Task Title" errorText="This field is required" />
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Every state from the Figma "Text Input Web" component set, rendered in order.' } },
  },
};

// ── variant × size, with invalid ──
export const LookMatrix = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 200px)', gap: 'var(--space-3)', alignItems: 'center' }}>
      {['outline', 'ghost'].flatMap(variant => ['md', 'sm'].map(size => (
        [false, true].map(invalid => (
          <Input
            key={`${variant}-${size}-${invalid}`}
            variant={variant}
            size={size}
            invalid={invalid}
            aria-label={`${variant} ${size}${invalid ? ' invalid' : ''}`}
            defaultValue={`${variant} ${size}${invalid ? ' invalid' : ''}`}
          />
        )).concat(
          <Input key={`${variant}-${size}-icon`} variant={variant} size={size} leadingIcon="solar:magnifer-linear" aria-label="With icon" placeholder="With icon" />,
        )
      )))}
    </div>
  ),
};

// ── Native input types ──
export const Types = {
  render: () => (
    <div style={stack}>
      <Input label="Email" type="email" placeholder="you@fold.health" />
      <Input label="Password" type="password" placeholder="••••••••" showPasswordToggle />
      <Input label="Phone" type="tel" placeholder="(415) 555-0123" />
      <Input label="Website" type="url" placeholder="https://…" />
      <Input label="Age" type="number" placeholder="0" min={0} max={120} />
      <Input label="Search" type="search" placeholder="Search patients" />
      <Input label="Date of Birth" type="date" />
      <Input label="Appointment Time" type="time" />
      <Input label="Follow-up" type="datetime-local" />
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Each `type` wires inputMode + autoComplete for the right mobile keyboard and password-manager behaviour. Password gets an inline eye toggle when `showPasswordToggle` is set. Date/time types keep Input\'s field chrome and let the browser render the native calendar/clock, `src/components/DatePicker` delegates to `<Input type="date">` under the hood so every date row across the app looks identical to a text row.' } },
  },
};

// ── Validation: native constraints ──
function NativeValidationDemo() {
  return (
    <div style={stack}>
      <Input label="Email" type="email" required placeholder="you@fold.health" helperText="Blur to validate." />
      <Input label="Phone" type="tel" required pattern="[0-9\-\(\) ]{7,}" placeholder="(415) 555-0123" helperText="7+ digits, blur to validate." />
      <Input label="Age" type="number" min={18} max={120} placeholder="18" helperText="18 – 120." />
      <Input label="Password" type="password" required minLength={8} showPasswordToggle placeholder="Min 8 chars" helperText="Min 8 characters." />
    </div>
  );
}
export const NativeValidation = {
  render: () => <NativeValidationDemo />,
  parameters: {
    docs: { description: { story: 'Native HTML5 constraints (`type`, `required`, `pattern`, `min`, `max`, `minLength`) drive validation on blur. Input reads `checkValidity()` + `validationMessage`.' } },
  },
};

// ── Validation: custom function ──
function CustomValidationDemo() {
  const [value, setValue] = useState('');
  return (
    <div style={stack}>
      <Input
        label="Fold Health email"
        type="email"
        placeholder="you@fold.health"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        validate={(v) => {
          if (!v) return 'Required.';
          if (!/^[^@\s]+@fold\.health$/i.test(v)) return 'Must end in @fold.health.';
          return null;
        }}
        helperText="Blur to validate: only @fold.health addresses pass."
      />
    </div>
  );
}
export const CustomValidation = {
  render: () => <CustomValidationDemo />,
  parameters: {
    docs: { description: { story: 'Pass `validate={(value) => string | null}` for arbitrary rules. Errors clear the moment the user edits again.' } },
  },
};
