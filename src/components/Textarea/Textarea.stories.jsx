import { useState } from 'react';
import { expect, fireEvent, fn, within } from 'storybook/test';
import { Textarea } from './Textarea';

export default {
  title: 'Core/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Multi-line text input. Two shapes: a plain <textarea> (no label props set) and an enhanced labeled card with an optional rich-text toolbar, character counter, speech-to-text mic, and CTA. Mirrors Figma Fold-Pixel 5786:1273 / 25:78337.',
      },
    },
  },
  argTypes: {
    invalid: { control: 'boolean', description: 'Red chrome and `aria-invalid`.' },
    onValueChange: { action: 'onValueChange', description: '(value) => void; `(html, plain)` in rich text. `onChange` stays the native event.' },
    rows: { control: { type: 'number', min: 1, max: 20 } },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    // Boolean toggles for the three optional label / helper regions. When
    // `true` they render with a default string; consumers can still pass a
    // string via code to override the copy.
    title: { control: 'boolean', description: 'Show the label above the field. Accepts a string to override the default "Title" copy.' },
    info: { control: 'boolean', description: 'Show the info icon next to the title. Accepts a string to override the tooltip copy.' },
    supportingText: { control: 'boolean', description: 'Show the helper line below the field. Accepts a string to override the default copy.' },
    mandatory: { control: 'boolean' },
    richText: { control: 'boolean', description: 'Reveals the toolbar footer. Only when richText is on can attachment / speech-to-text / bottomButton surface.' },
    attachment: { control: 'boolean', description: 'Paperclip button: only visible when richText is on.' },
    speechToText: { control: 'boolean', description: 'Speech-to-text mic: only visible when richText is on.' },
    bottomButton: { control: 'boolean', description: 'Publish CTA: only visible when richText is on. Pass `{ label, onClick, variant, disabled }` in code to customize.' },
    maxLength: { control: 'number' },
  },
};

export const Playground = {
  args: {
    invalid: false,
    rows: 3,
    placeholder: 'Add a note…',
  },
};

// ── Plain (legacy) shapes ─────────────────────────────────────────────
export const Plain = {
  args: { placeholder: 'Add a note…', rows: 3 },
};
export const PlainError = {
  args: { placeholder: 'Add a note…', invalid: true, defaultValue: 'This value is invalid.' },
};
export const PlainDisabled = {
  args: { placeholder: 'Add a note…', disabled: true },
};

// ── Enhanced (labeled) shapes ─────────────────────────────────────────
export const Labeled = {
  args: {
    title: true,
    supportingText: true,
    placeholder: 'Enter Task Title',
  },
};

export const LabeledMandatory = {
  args: {
    title: true,
    info: true,
    mandatory: true,
    supportingText: true,
    placeholder: 'Enter Task Title',
    maxLength: 150,
  },
};

export const RichText = {
  args: {
    title: 'Description',
    info: false,
    mandatory: false,
    richText: false,
    placeholder: 'Enter Task Title',
    supportingText: false,
    maxLength: 150,
    speechToText: false,
    attachment: true,
    bottomButton: false,
  },
};

export const ErrorState = {
  args: {
    title: true,
    invalid: true,
    supportingText: 'This field is required.',
    mandatory: true,
    placeholder: 'Enter Task Title',
    maxLength: 150,
  },
};

export const Disabled = {
  args: {
    title: true,
    disabled: true,
    supportingText: true,
    placeholder: 'Enter Task Title',
    maxLength: 150,
  },
};

/** Plain textarea with `highlightLinks`: web links show blue and underlined while typing. */
function LinkHighlightDemo() {
  const [value, setValue] = useState('Please fill this form: https://example.com/forms/54');
  return <Textarea highlightLinks rows={4} value={value} onChange={e => setValue(e.target.value)} />;
}
export const LinkHighlight = { render: () => <LinkHighlightDemo /> };

/**
 * The change contract: `onChange` is the native event in both the plain and
 * the labelled shape, and `onValueChange` gets the text. Rich text has no
 * native event, so it reports `(html, plain)` through `onValueChange` only.
 */
const contractOnChange = fn();
const contractOnValueChange = fn();
const contractRichValueChange = fn();
export const ChangeContract = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: 320 }}>
      <Textarea aria-label="Plain" placeholder="Plain" onChange={contractOnChange} onValueChange={contractOnValueChange} />
      {/* The test checks the native onChange a labelled Textarea now passes. */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <Textarea aria-label="Labelled" title="Labelled" maxLength={50} placeholder="Labelled" onChange={contractOnChange} onValueChange={contractOnValueChange} />
      <Textarea title="Rich" richText placeholder="Rich" onValueChange={contractRichValueChange} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ['Plain', 'Labelled']) {
      const box = canvas.getByRole('textbox', { name });
      contractOnChange.mockClear();
      contractOnValueChange.mockClear();
      await fireEvent.change(box, { target: { value: 'ok' } });
      await expect(contractOnValueChange).toHaveBeenLastCalledWith('ok');
      await expect(contractOnChange.mock.lastCall[0].target.value).toBe('ok');
    }
    const rich = canvas.getByRole('textbox', { name: 'Rich' });
    rich.innerHTML = 'ok';
    await fireEvent.input(rich);
    await expect(contractRichValueChange).toHaveBeenLastCalledWith('ok', 'ok');
  },
};
