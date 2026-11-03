import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './Button';

export default {
  title: 'Core/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The single button primitive used everywhere in the app. Two independent axes: `variant` is emphasis (`solid` for the main action, `soft` for a tinted secondary action, `outline` for the alternative, `ghost` for low-emphasis controls) and `tone` is intent (`primary`, `neutral`, `success`, `warning`, `danger`, `info`). Tone defaults to primary for solid and soft and neutral for outline and ghost, so most buttons need one prop. `size` is `sm` (dense toolbars), `md` (default) or `lg` (mobile). Supports leading and trailing Solar icons, an `iconOnly` square, and a split button via `menuItems`. See the Variant Matrix story for every combination.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['solid', 'soft', 'outline', 'ghost'],
      description: 'Emphasis: filled, tinted, bordered, or bare until hover',
      table: { defaultValue: { summary: 'solid' } },
    },
    tone: {
      control: 'select',
      options: [undefined, 'primary', 'neutral', 'success', 'warning', 'danger', 'info'],
      description: 'Intent. Defaults to primary for solid and soft, neutral for outline and ghost',
      table: { defaultValue: { summary: 'by variant' } },
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'sm = 24px, md = 32px (default), lg = 52px (mobile)',
      table: { defaultValue: { summary: 'md' } },
    },
    children: {
      control: 'text',
      description: 'Button label text',
    },
    showLeadingIcon: {
      control: 'boolean',
      description: 'Toggle the leading icon on/off (uses `leadingIcon` for the glyph)',
      table: { defaultValue: { summary: 'false' } },
    },
    leadingIcon: {
      control: 'text',
      description: 'Solar icon name used when `showLeadingIcon` is on (or when `iconOnly` is on)',
    },
    showTrailingIcon: {
      control: 'boolean',
      description: 'Toggle the trailing icon on/off (uses `trailingIcon` for the glyph)',
      table: { defaultValue: { summary: 'false' } },
    },
    trailingIcon: {
      control: 'text',
      description: 'Solar icon name used when `showTrailingIcon` is on',
    },
    iconOnly: {
      control: 'boolean',
      description: 'Square icon-only button (hides text)',
      table: { defaultValue: { summary: 'false' } },
    },
    dropdown: {
      control: 'boolean',
      description: 'Split-button mode: appends a chevron with a MenuPopover of secondary actions',
      table: { defaultValue: { summary: 'false' } },
    },
    fullWidth: {
      control: 'boolean',
      description: 'Expand to fill container width',
      table: { defaultValue: { summary: 'false' } },
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the button',
      table: { defaultValue: { summary: 'false' } },
    },
    loading: {
      control: 'boolean',
      description: 'Busy: spinner over the label, same size and colors, clicks ignored. Also set automatically while a promise returned from onClick is pending',
      table: { defaultValue: { summary: 'false' } },
    },
  },
};

/**
 * The default playground: tweak every prop in the Controls panel.
 * This single story replaces all the individual variant stories.
 *
 * Leading / trailing icons live behind their own boolean toggles so the
 * default preview stays label-only; flip `showLeadingIcon` (or set
 * `iconOnly`) to bring the glyph in.
 */
const DROPDOWN_MENU = [
  { key: 'draft',     icon: 'solar:document-linear',        label: 'Save as draft' },
  { key: 'template',  icon: 'solar:copy-linear',            label: 'Save as template' },
  { key: 'duplicate', icon: 'solar:documents-linear',       label: 'Duplicate' },
  { divider: true },
  { key: 'delete',    icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true },
];

export const Playground = {
  args: {
    variant: 'solid',
    size: 'md',
    children: 'Button Text',
    showLeadingIcon: false,
    leadingIcon: 'solar:add-circle-linear',
    showTrailingIcon: false,
    trailingIcon: 'solar:alt-arrow-right-linear',
    iconOnly: false,
    dropdown: false,
    fullWidth: false,
    disabled: false,
  },
  render: ({ showLeadingIcon, leadingIcon, showTrailingIcon, trailingIcon, iconOnly, dropdown, ...rest }) => (
    <Button
      {...rest}
      iconOnly={iconOnly}
      leadingIcon={(showLeadingIcon || iconOnly) ? leadingIcon : ''}
      trailingIcon={showTrailingIcon ? trailingIcon : ''}
      menuItems={dropdown ? DROPDOWN_MENU : undefined}
      onMenuSelect={dropdown ? (key) => alert(`Menu action: ${key}`) : undefined}
    />
  ),
};

const VARIANTS = ['solid', 'soft', 'outline', 'ghost'];
const TONES = ['primary', 'neutral', 'success', 'warning', 'danger', 'info'];
const cell = { padding: 'var(--space-2)', fontSize: 'var(--font-sm)', color: 'var(--neutral-300)', textAlign: 'left' };

/** Every variant × tone, at each size. Hover a cell to see its hover state. */
export const VariantMatrix = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {['sm', 'md'].map(size => (
        <table key={size} style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={cell}>size="{size}"</th>
              {TONES.map(t => <th key={t} style={cell}>{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {VARIANTS.map(v => (
              <tr key={v}>
                <th style={cell}>{v}</th>
                {TONES.map(t => (
                  <td key={t} style={cell}>
                    <Button variant={v} tone={t} size={size}>Button</Button>
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th style={cell}>disabled</th>
              {TONES.map(t => <td key={t} style={cell}><Button tone={t} size={size} disabled>Button</Button></td>)}
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  ),
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * An async `onClick` makes the button busy on its own: the click registers at
 * once (repeat clicks are ignored) and, after 150ms, a spinner replaces the
 * label until the promise settles. No `loading` prop needed.
 */
export const LoadingFromAsyncClick = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <Button onClick={() => wait(2000)}>Save</Button>
      <Button variant="outline" leadingIcon="solar:refresh-linear" onClick={() => wait(2000)}>Sync</Button>
      <Button variant="soft" tone="danger" size="sm" onClick={() => wait(2000)}>Delete</Button>
      <Button variant="ghost" onClick={() => wait(100)}>Fast (no flicker)</Button>
      <Button
        onClick={() => wait(2000)}
        menuItems={[{ key: 'draft', label: 'Save as draft' }]}
      >
        Publish
      </Button>
    </div>
  ),
};

/** A second click while the first is still running doesn't run the handler again. */
export const IgnoresRepeatClicks = {
  args: { children: 'Save', onClick: fn(() => wait(300)) },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Save' });
    await userEvent.click(button);
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(button).not.toHaveAttribute('aria-busy'));
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};

/** `loading` set by the caller, for work that doesn't come from the click. */
export const Loading = {
  args: { loading: true, children: 'Save' },
};

/** Disabled with a reason: hovering the greyed-out button says what's missing. */
export const DisabledWithReason = {
  render: () => (
    <Button disabled disabledReason="Pick a form">Add Form Link</Button>
  ),
};
