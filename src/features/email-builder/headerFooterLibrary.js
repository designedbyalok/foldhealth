// Preset Header / Footer designs. Each preset returns { rootId, blocks }
// when invoked with an id generator — same shape as createBlockTree() so the
// store's addBlock can drop them in without special-casing.

export const HEADER_PRESETS = [
  {
    id: 'simple',
    label: 'Simple Brand',
    description: 'Centered logo + headline',
    accent: '#7C5CFA',
    build(genId, name = 'Welcome') {
      const heading = genId();
      const root = genId();
      return {
        rootId: root,
        blocks: {
          [heading]: {
            type: 'Heading',
            data: {
              props: { text: `Welcome to ${name}`, level: 'h1' },
              style: { color: '#7C5CFA', textAlign: 'center', padding: { top: 8, bottom: 8, left: 16, right: 16 } },
            },
          },
          [root]: {
            type: 'Container',
            data: {
              role: 'header',
              style: { backgroundColor: '#F2EEFE', padding: { top: 32, bottom: 32, left: 24, right: 24 } },
              props: { childrenIds: [heading] },
            },
          },
        },
      };
    },
  },
  {
    id: 'logoTagline',
    label: 'Logo + Tagline',
    description: 'Logo image with subline',
    accent: '#22C55E',
    build(genId, name = 'Care') {
      const logo = genId();
      const tagline = genId();
      const root = genId();
      return {
        rootId: root,
        blocks: {
          [logo]: {
            type: 'Image',
            data: {
              props: { url: 'https://i.imgur.com/2VDjY3W.png', alt: 'Logo', contentAlignment: 'middle' },
              style: { padding: { top: 16, bottom: 8, left: 24, right: 24 }, textAlign: 'center' },
            },
          },
          [tagline]: {
            type: 'Text',
            data: {
              props: { text: `${name} — your wellness, our priority` },
              style: { color: '#6B7280', fontSize: 13, textAlign: 'center', padding: { top: 0, bottom: 16, left: 24, right: 24 } },
            },
          },
          [root]: {
            type: 'Container',
            data: {
              role: 'header',
              style: { backgroundColor: '#FFFFFF', padding: { top: 16, bottom: 16, left: 24, right: 24 } },
              props: { childrenIds: [logo, tagline] },
            },
          },
        },
      };
    },
  },
  {
    id: 'gradientBanner',
    label: 'Gradient Banner',
    description: 'Bold colored hero strip',
    accent: '#EC4899',
    build(genId, name = 'Hello') {
      const heading = genId();
      const sub = genId();
      const root = genId();
      return {
        rootId: root,
        blocks: {
          [heading]: {
            type: 'Heading',
            data: {
              props: { text: name, level: 'h1' },
              style: { color: '#FFFFFF', textAlign: 'center', padding: { top: 16, bottom: 4, left: 24, right: 24 } },
            },
          },
          [sub]: {
            type: 'Text',
            data: {
              props: { text: 'A note from your care team' },
              style: { color: '#FFFFFF', fontSize: 14, textAlign: 'center', padding: { top: 0, bottom: 16, left: 24, right: 24 } },
            },
          },
          [root]: {
            type: 'Container',
            data: {
              role: 'header',
              style: { backgroundColor: '#7C5CFA', padding: { top: 32, bottom: 32, left: 24, right: 24 } },
              props: { childrenIds: [heading, sub] },
            },
          },
        },
      };
    },
  },
];

export const FOOTER_PRESETS = [
  {
    id: 'team',
    label: 'From Team',
    description: 'Team name + support contact',
    accent: '#7B8499',
    build(genId, name = 'Fold Health') {
      const text = genId();
      const root = genId();
      return {
        rootId: root,
        blocks: {
          [text]: {
            type: 'Text',
            data: {
              props: { text: `FROM TEAM\n${name}\nNeed Help?\nIf you have any questions, our support team is here for you at customers@fold.care.` },
              style: { color: '#7B8499', fontSize: 12, textAlign: 'center', padding: { top: 16, bottom: 32, left: 24, right: 24 } },
            },
          },
          [root]: {
            type: 'Container',
            data: {
              role: 'footer',
              style: { backgroundColor: '#FFFFFF', padding: { top: 0, bottom: 0, left: 0, right: 0 } },
              props: { childrenIds: [text] },
            },
          },
        },
      };
    },
  },
  {
    id: 'unsubscribe',
    label: 'Compact',
    description: 'Just an unsubscribe line',
    accent: '#9CA3AF',
    build(genId) {
      const text = genId();
      const root = genId();
      return {
        rootId: root,
        blocks: {
          [text]: {
            type: 'Text',
            data: {
              props: { text: 'You are receiving this because you subscribed. Unsubscribe at any time.' },
              style: { color: '#9CA3AF', fontSize: 11, textAlign: 'center', padding: { top: 16, bottom: 16, left: 24, right: 24 } },
            },
          },
          [root]: {
            type: 'Container',
            data: {
              role: 'footer',
              style: { backgroundColor: '#FAFAFA', padding: { top: 0, bottom: 0, left: 0, right: 0 } },
              props: { childrenIds: [text] },
            },
          },
        },
      };
    },
  },
  {
    id: 'social',
    label: 'Social + Contact',
    description: 'Branded with social link icons',
    accent: '#7C5CFA',
    build(genId, name = 'Fold Health') {
      const heading = genId();
      const text = genId();
      const root = genId();
      return {
        rootId: root,
        blocks: {
          [heading]: {
            type: 'Heading',
            data: {
              props: { text: name, level: 'h3' },
              style: { color: '#7C5CFA', textAlign: 'center', padding: { top: 16, bottom: 4, left: 24, right: 24 } },
            },
          },
          [text]: {
            type: 'Text',
            data: {
              props: { text: '✉ hello@fold.care    ✆ (555) 010-2400\nFollow us on Twitter · LinkedIn · Instagram' },
              style: { color: '#6B7280', fontSize: 12, textAlign: 'center', padding: { top: 4, bottom: 16, left: 24, right: 24 } },
            },
          },
          [root]: {
            type: 'Container',
            data: {
              role: 'footer',
              style: { backgroundColor: '#F8F9FB', padding: { top: 16, bottom: 16, left: 24, right: 24 } },
              props: { childrenIds: [heading, text] },
            },
          },
        },
      };
    },
  },
];

export function getDefaultHeader() { return HEADER_PRESETS[0]; }
export function getDefaultFooter() { return FOOTER_PRESETS[0]; }
