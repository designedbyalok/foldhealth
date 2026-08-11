import { describe, it, expect } from 'vitest';
import { renderEmailHtml } from './patchEmailHtml';

// A tiny 1-block document harness; the shape mirrors what useAppStore emits.
function doc(block) {
  return { root: { type: 'EmailLayout', data: { childrenIds: ['b'] } }, b: block };
}

describe('patchEmailHtml — translucent hex handling', () => {
  it('emits an Outlook-safe opaque fallback before rgba() for standalone color props', () => {
    const html = renderEmailHtml(doc({
      type: 'Text',
      data: {
        props: { text: 'Hi' },
        style: { color: '#7C5CFA59', backgroundColor: '#FF000080' },
      },
    }));
    // color: flattened first, rgba() second — order matters for Outlook's
    // "last valid declaration wins" quirk.
    expect(html).toMatch(/color:#[0-9A-F]{6};color:rgba\(124, 92, 250, 0\.\d+\)/);
    expect(html).toMatch(/background-color:#[0-9A-F]{6};background-color:rgba\(255, 0, 0, 0\.\d+\)/);
    // The 8-digit hex must not survive to the wire.
    expect(html).not.toMatch(/#[0-9A-F]{8}/);
  });

  it('rewrites translucent stops inside a gradient background-image with rgba()', () => {
    const html = renderEmailHtml(doc({
      type: 'Container',
      data: {
        props: {},
        style: { backgroundColor: 'linear-gradient(90deg, #7C5CFA59 0%, #22C55E 100%)' },
        childrenIds: [],
      },
    }));
    // 0x59 / 255 = 0.349019… — the emitted rgba matches within 3 decimals.
    expect(html).toMatch(/rgba\(124, 92, 250, 0\.34\d?\)/);
    expect(html).not.toMatch(/#7C5CFA59/i);
  });

  it('flattens translucent hex inside border shorthands so Outlook still sees the border', () => {
    const html = renderEmailHtml(doc({
      type: 'Container',
      data: {
        props: {},
        style: { borderWidth: 2, borderStyle: 'solid', borderColor: '#7C5CFA59' },
        childrenIds: [],
      },
    }));
    expect(html).toMatch(/border:2px solid #[0-9A-F]{6}/);
    expect(html).not.toMatch(/border:[^;"]*rgba/);
  });

  it('leaves fully opaque colors as untouched hex', () => {
    const html = renderEmailHtml(doc({
      type: 'Text',
      data: { props: { text: 'x' }, style: { color: '#7C5CFA' } },
    }));
    expect(html).toContain('color:#7C5CFA');
    expect(html).not.toContain('rgba(');
  });
});
