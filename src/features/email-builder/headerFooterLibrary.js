// Preset Header / Footer designs. Each preset returns { rootId, blocks }
// when invoked with an id generator, same shape as createBlockTree() so the
// store's addBlock can drop them in without special-casing.

// Built-in HEADER_PRESETS: designed to look like real email headers, not
// abstract bars. The preset picker renders each tree LIVE via Reader so
// users can preview the actual visual before applying.
export const HEADER_PRESETS = [
  // 1. Gradient hero: bold purple gradient banner with eyebrow + headline +
  //    one-line tagline. Good for product announcements / release notes.
  {
    id: 'gradientHero',
    label: 'Gradient Hero',
    description: 'Bold gradient banner with eyebrow + headline',
    accent: '#7C5CFA',
    build(genId, name = 'Welcome') {
      const eyebrow = genId();
      const heading = genId();
      const tagline = genId();
      const root = genId();
      return {
        rootId: root,
        blocks: {
          [eyebrow]: {
            type: 'Text',
            data: {
              props: { text: 'NEWSLETTER' },
              style: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold', textAlign: 'center', letterSpacing: 6, padding: { top: 24, bottom: 4, left: 24, right: 24 } },
            },
          },
          [heading]: {
            type: 'Heading',
            data: {
              props: { text: name, level: 'h1' },
              style: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold', textAlign: 'center', padding: { top: 0, bottom: 8, left: 24, right: 24 } },
            },
          },
          [tagline]: {
            type: 'Text',
            data: {
              props: { text: 'A note from your care team' },
              style: { color: '#FFFFFF', fontSize: 13, textAlign: 'center', lineHeight: 1.5, padding: { top: 0, bottom: 24, left: 32, right: 32 } },
            },
          },
          [root]: {
            type: 'Container',
            data: {
              role: 'header',
              style: {
                backgroundColor: '#5020A0',
                backgroundImage: 'linear-gradient(135deg, #5020A0 0%, #8C5AE2 100%)',
                padding: { top: 8, bottom: 8, left: 0, right: 0 },
              },
              props: { childrenIds: [eyebrow, heading, tagline] },
            },
          },
        },
      };
    },
  },

  // 2. Logo + Nav: clean white header with a logo image on top and a
  //    NavBar underneath. Works well for transactional or branded sends.
  {
    id: 'logoNav',
    label: 'Logo + Navigation',
    description: 'Centered logo with a nav bar underneath',
    accent: '#22C55E',
    build(genId, _name) {
      const logo = genId();
      const nav = genId();
      const divider = genId();
      const root = genId();
      return {
        rootId: root,
        blocks: {
          [logo]: {
            type: 'Image',
            data: {
              props: { url: 'https://i.imgur.com/2VDjY3W.png', alt: 'Logo', width: 48 },
              style: { padding: { top: 24, bottom: 8, left: 24, right: 24 }, textAlign: 'center' },
            },
          },
          [nav]: {
            type: 'NavBar',
            data: {
              props: {
                links: [
                  { label: 'Home', url: '#' },
                  { label: 'Care Plan', url: '#' },
                  { label: 'Messages', url: '#' },
                  { label: 'Help', url: '#' },
                ],
                alignment: 'center',
                gap: 24,
                linkColor: '#3A485F',
                fontSize: 13,
                fontWeight: 'bold',
              },
              style: { padding: { top: 8, bottom: 16, left: 16, right: 16 }, backgroundColor: '#FFFFFF' },
            },
          },
          [divider]: {
            type: 'Divider',
            data: {
              props: { lineColor: '#E9ECF1', lineHeight: 1 },
              style: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
            },
          },
          [root]: {
            type: 'Container',
            data: {
              role: 'header',
              style: { backgroundColor: '#FFFFFF', padding: { top: 0, bottom: 0, left: 0, right: 0 } },
              props: { childrenIds: [logo, nav, divider] },
            },
          },
        },
      };
    },
  },

  // 3. Promo banner: eyebrow tag + big headline + CTA button on a colored
  //    background. For promotional / campaign-style emails.
  {
    id: 'promoBanner',
    label: 'Promo Banner',
    description: 'Bold headline with a call-to-action button',
    accent: '#F47A3E',
    build(genId, name = 'Limited Time') {
      const eyebrow = genId();
      const heading = genId();
      const cta = genId();
      const root = genId();
      return {
        rootId: root,
        blocks: {
          [eyebrow]: {
            type: 'Text',
            data: {
              props: { text: '🔥 LIMITED TIME' },
              style: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold', textAlign: 'center', letterSpacing: 4, padding: { top: 32, bottom: 4, left: 24, right: 24 } },
            },
          },
          [heading]: {
            type: 'Heading',
            data: {
              props: { text: name, level: 'h1' },
              style: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold', textAlign: 'center', padding: { top: 0, bottom: 16, left: 32, right: 32 } },
            },
          },
          [cta]: {
            type: 'Button',
            data: {
              props: {
                text: 'View Details',
                url: '#',
                size: 'medium',
                buttonStyle: 'pill',
                buttonBackgroundColor: '#FFFFFF',
                buttonTextColor: '#F47A3E',
              },
              style: { padding: { top: 0, bottom: 32, left: 24, right: 24 }, textAlign: 'center' },
            },
          },
          [root]: {
            type: 'Container',
            data: {
              role: 'header',
              style: { backgroundColor: '#F47A3E', padding: { top: 0, bottom: 0, left: 0, right: 0 } },
              props: { childrenIds: [eyebrow, heading, cta] },
            },
          },
        },
      };
    },
  },

  // 4. Minimal text: quiet, text-only header. Brand name + thin divider.
  //    For when the body content is the focus and you want a low-key top.
  {
    id: 'minimalText',
    label: 'Minimal Text',
    description: 'Quiet text-only header with a divider',
    accent: '#3A485F',
    build(genId, name = 'Fold Health') {
      const brand = genId();
      const tagline = genId();
      const divider = genId();
      const root = genId();
      return {
        rootId: root,
        blocks: {
          [brand]: {
            type: 'Heading',
            data: {
              props: { text: name, level: 'h3' },
              style: { color: '#3A485F', fontSize: 18, fontWeight: 'bold', textAlign: 'center', padding: { top: 24, bottom: 2, left: 24, right: 24 } },
            },
          },
          [tagline]: {
            type: 'Text',
            data: {
              props: { text: 'Your wellness, our priority' },
              style: { color: '#6F7A90', fontSize: 12, textAlign: 'center', padding: { top: 0, bottom: 16, left: 24, right: 24 } },
            },
          },
          [divider]: {
            type: 'Divider',
            data: {
              props: { lineColor: '#E9ECF1', lineHeight: 1 },
              style: { padding: { top: 0, bottom: 0, left: 24, right: 24 } },
            },
          },
          [root]: {
            type: 'Container',
            data: {
              role: 'header',
              style: { backgroundColor: '#FFFFFF', padding: { top: 0, bottom: 0, left: 0, right: 0 } },
              props: { childrenIds: [brand, tagline, divider] },
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
