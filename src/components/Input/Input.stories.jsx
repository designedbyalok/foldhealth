import { useState } from 'react';
import { Input } from './Input';

export default {
  title: 'Forms/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Single-line text input — matches Figma Fold-Pixel node 25:21239 exactly. Renders a bare `<input>` when only styling props are passed (backward-compatible with 20+ existing callers); adds a wrapper with label / helper / error / password-toggle when any structural slot is set. Native `type` drives sensible `inputMode` + `autoComplete` defaults and unlocks type-aware validation via native `checkValidity()` or a custom `validate()` function.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'error'],
      description: 'Legacy visual state. Prefer `errorText` for message + state in one prop.',
    },
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
      description: 'Native input type. Drives inputMode + autoComplete defaults.',
    },
    label: { control: 'text', description: 'Text above the input.' },
    helperText: { control: 'text', description: 'Muted text below the input. Hidden while an error shows.' },
    errorText: { control: 'text', description: 'Error message below the input. Forces the error state.' },
    required: { control: 'boolean', description: 'Adds a red asterisk to the label and forwards `required`.' },
    showPasswordToggle: { control: 'boolean', description: 'Only meaningful for `type=password`. Adds an inline eye toggle.' },
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

// ── Playground ──
export const Playground = {
  args: {
    variant: 'default',
    type: 'text',
    label: 'Title',
    placeholder: 'Enter Task Title',
    helperText: '',
    errorText: '',
    required: false,
    showPasswordToggle: false,
    validateOn: 'blur',
    disabled: false,
    readOnly: false,
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
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Each `type` wires inputMode + autoComplete for the right mobile keyboard and password-manager behaviour. Password gets an inline eye toggle when `showPasswordToggle` is set.' } },
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
        helperText="Blur to validate — only @fold.health addresses pass."
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
