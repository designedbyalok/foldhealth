import { HEADER_PRESETS, FOOTER_PRESETS } from './headerFooterLibrary';

// Default email template — every new template gets a Header preset on top and
// a Footer preset on the bottom (auto-loaded; the user can change either via
// the Header/Footer dropdowns in the components panel).

export function makeInitialDocument(campaign) {
  const name = campaign?.name || 'Welcome';
  let counter = 1;
  const genId = () => `block-${Date.now()}-${counter++}`;

  const header = HEADER_PRESETS[0].build(genId, name);
  const footer = FOOTER_PRESETS[0].build(genId, 'Fold Health');

  const bodyContainer = genId();
  const heading = genId();
  const greeting = genId();
  const body = genId();
  const spacer = genId();
  const signoff = genId();
  const divider = genId();

  return {
    root: {
      type: 'EmailLayout',
      data: {
        backdropColor: '#F2EEFE',
        canvasColor: '#FFFFFF',
        textColor: '#3A485F',
        fontFamily: 'MODERN_SANS',
        preheader: 'A quick update from your care team',
        childrenIds: [header.rootId, bodyContainer, footer.rootId],
      },
    },
    ...header.blocks,
    [bodyContainer]: {
      type: 'Container',
      data: {
        role: 'body',
        props: { childrenIds: [heading, greeting, body, spacer, signoff, divider] },
        style: {},
      },
    },
    [heading]: {
      type: 'Heading',
      data: {
        props: { text: 'Write title here', level: 'h2' },
        style: { color: '#3A485F', textAlign: 'left', padding: { top: 16, bottom: 8, left: 24, right: 24 } },
      },
    },
    [greeting]: {
      type: 'Text',
      data: {
        props: { text: 'Dear {{first_name}},' },
        style: { color: '#3A485F', fontSize: 14, textAlign: 'left', padding: { top: 4, bottom: 4, left: 24, right: 24 } },
      },
    },
    [body]: {
      type: 'Text',
      data: {
        props: { text: 'Write your email body…' },
        style: { color: '#6B7280', fontSize: 14, textAlign: 'left', padding: { top: 8, bottom: 16, left: 24, right: 24 } },
      },
    },
    [spacer]: {
      type: 'Spacer',
      data: { props: { height: 24 }, style: {} },
    },
    [signoff]: {
      type: 'Text',
      data: {
        props: { text: 'Thank you for trusting us with your health,\nStanford Care Center\n[Signature]' },
        style: { color: '#3A485F', fontSize: 14, textAlign: 'left', padding: { top: 8, bottom: 16, left: 24, right: 24 } },
      },
    },
    [divider]: {
      type: 'Divider',
      data: { props: { lineColor: '#E1E4EA', lineHeight: 1 }, style: { padding: { top: 8, bottom: 8, left: 24, right: 24 } } },
    },
    ...footer.blocks,
  };
}
