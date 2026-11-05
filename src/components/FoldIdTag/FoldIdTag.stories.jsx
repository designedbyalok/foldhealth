import { useEffect, useState } from 'react';
import { FoldIdTag } from './FoldIdTag';
import { formatFoldId } from '../../lib/foldId';
import styles from './FoldIdTag.module.css';

export default {
  title: 'Data/FoldIdTag',
  component: FoldIdTag,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'The clickable "#10070" Fold ID shown on every worklist row. Hover shows "Click to copy Fold ID"; clicking copies it and swaps the tooltip to "Copied: #10070" for a beat instead of firing a toast. The label swap fades in, see FoldIdTag.module.css.',
      },
    },
  },
  argTypes: {
    id: {
      control: 'text',
      description: 'Raw Fold ID to copy: formatted for display via formatFoldId unless `display` is passed',
      table: { type: { summary: 'string | number' } },
    },
    display: {
      control: 'text',
      description: 'Override the shown text (e.g. a raw payer member id instead of the "#" prefixed default)',
      table: { type: { summary: 'string' } },
    },
    label: {
      control: 'text',
      description: 'Hover tooltip text before a copy',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'Click to copy Fold ID' } },
    },
  },
};

const previewStyles = `
  .foldId-storybook-preview {
    cursor: pointer;
    color: var(--neutral-300);
    transition: color .12s;
  }
  .foldId-storybook-preview:hover { color: var(--primary-300); text-decoration: underline; }
`;

export const Playground = {
  args: { id: '10070' },
  render: (args) => (
    <div style={{ padding: 48, fontFamily: 'Inter, sans-serif', fontSize: 'var(--font-md)' }}>
      <FoldIdTag
        {...args}
        showToast={() => {}}
        className="foldId-storybook-preview"
      />
      <p style={{ marginTop: 32, fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>
        Hover the ID above to see "Click to copy Fold ID", then click to trigger the "Copied" transition.
      </p>
      <style>{previewStyles}</style>
    </div>
  ),
};

/**
 * Auto-cycles between the "idle" and "copied" tooltip states so the fade
 * animation is visible without needing to hover or click. This renders a
 * mock of the Tooltip bubble (same styling, always open) with the same
 * `.labelFade` keyed span the real component uses, the swap fades in
 * every 1.6s so the animation loops for anyone reviewing the story.
 */
export const TransitionDemo = {
  parameters: {
    docs: {
      description: {
        story: 'Auto-loops the label-swap animation on a 1.6s interval so the fade transition is always visible in Storybook (without needing hover/click, which is unreliable in sandboxed preview iframes).',
      },
    },
  },
  render: () => {
    const [copied, setCopied] = useState(false);
    useEffect(() => {
      const id = setInterval(() => setCopied(c => !c), 1600);
      return () => clearInterval(id);
    }, []);
    const shown = formatFoldId('10070');
    return (
      <div style={{ padding: '96px 48px 48px', fontFamily: 'Inter, sans-serif', fontSize: 'var(--font-md)', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', position: 'relative' }}>
          {/* Mock of the Tooltip bubble: same neutral-500 background,
              same 6px radius, same 12/font shadow, anchored above a
              plain #10070 span so the label swap is watchable. */}
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '6px 10px',
              background: 'var(--neutral-500)',
              color: 'var(--neutral-0)',
              borderRadius: 6,
              fontSize: 'var(--font-sm)',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,.14)',
              pointerEvents: 'none',
            }}
          >
            <span key={copied ? 'copied' : 'idle'} className={styles.labelFade}>
              {copied ? `Copied: ${shown}` : 'Click to copy Fold ID'}
            </span>
          </div>
          <span className="foldId-storybook-preview">{shown}</span>
        </div>
        <p style={{ marginTop: 48, fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>
          Label swaps every 1.6s so you can watch the fade animation loop.
        </p>
        <style>{previewStyles}</style>
      </div>
    );
  },
};
