// Design tokens: friendly names for the --rk-* CSS variables in styles.css.
// Pass any subset as the `theme` prop (or set the variables in your own CSS).

export const THEME_TOKENS = {
  fontFamily: '--rk-font',
  fontFamilyMono: '--rk-font-mono',
  fontSizeXs: '--rk-font-xs',
  fontSizeSm: '--rk-font-sm',
  fontSizeMd: '--rk-font-md',
  fontWeightMedium: '--rk-font-weight-medium',
  space1: '--rk-space-1',
  space2: '--rk-space-2',
  space3: '--rk-space-3',
  space4: '--rk-space-4',
  radius: '--rk-radius',
  radiusSm: '--rk-radius-sm',
  background: '--rk-bg',
  backgroundSubtle: '--rk-bg-subtle',
  border: '--rk-border',
  text: '--rk-text',
  textMuted: '--rk-text-muted',
  accent: '--rk-accent',
  accentSoft: '--rk-accent-soft',
  accentText: '--rk-accent-text',
  danger: '--rk-danger',
  warning: '--rk-warning',
  success: '--rk-success',
  shadow: '--rk-shadow',
  pickFill: '--rk-pick-fill',
  overlay: '--rk-overlay',
  zIndex: '--rk-z',
};

/** Theme object → inline style of CSS variables. Unknown keys are ignored. */
export function themeToStyle(theme) {
  if (!theme) return undefined;
  const style = {};
  for (const [key, value] of Object.entries(theme)) {
    const variable = THEME_TOKENS[key];
    if (variable && value != null && value !== '') style[variable] = String(value);
  }
  return style;
}

/** A dark preset; spread it and override what you need: { ...darkTheme, accent: '#…' }. */
export const darkTheme = {
  background: '#1c1f26',
  backgroundSubtle: '#252932',
  border: '#343a46',
  text: '#e8eaee',
  textMuted: '#9aa1ae',
  accent: '#a57bec',
  accentSoft: '#2e2540',
  accentText: '#ffffff',
  danger: '#f97066',
  warning: '#fdb022',
  success: '#47cd89',
  shadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
  pickFill: 'rgba(165, 123, 236, 0.16)',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** Every visible string, for your own wording or translations. */
export const DEFAULT_LABELS = {
  select: 'Select',
  selectHint: 'Select an element to screenshot (↑/↓ for parent or child)',
  picking: 'Picking…',
  pickHint: 'Click or press Enter to capture. ↑ parent · ↓ child · Esc to cancel',
  screenshot: 'Screenshot',
  screenshotHint: 'Screenshot this screen',
  capturing: 'Capturing…',
  upload: 'Upload',
  uploadHint: (mb) => `Upload images or GIFs (up to ${mb} MB)`,
  send: 'Send',
  sendPoints: (n) => `Send ${n} points`,
  sending: 'Sending…',
  moreSendOptions: 'More send options',
  sentTitle: 'Feedback sent',
  sentDetail: (n) => (n > 1 ? `${n} points saved.` : 'Your note is saved.'),
  finishFailed: (message) => `Couldn't finish: ${message}`,
  upNext: 'Up next',
  reviewNext: 'Review next',
  notNow: 'Not now',
  sent: (n) => (n > 1 ? `Feedback sent (${n} points).` : 'Feedback sent.'),
  point: 'Point',
  pointTitle: (n) => `Point ${n}`,
  newPointHint: 'Add new point',
  deletePoint: (n) => `Delete point ${n}`,
  placeholder: 'Leave a comment. Paste or drop images and GIFs here to attach them.',
  pointPlaceholder: (n) => `Point ${n}: what should change here? Drop images here too.`,
  dropHint: (n) => `Drop images or GIFs to attach to point ${n}`,
  collapse: 'Collapse to the side',
  close: 'Close review',
  open: (title) => `Open review: ${title}`,
  screenLabel: 'Screen',
  skipped: (count, mb) => `${count} file${count === 1 ? '' : 's'} skipped: images or GIFs up to ${mb} MB only.`,
  captureFailed: (msg) => `Couldn't capture that element: ${msg}`,
  screenshotFailed: (msg) => `Couldn't take a screenshot: ${msg}`,
  sendFailed: (msg) => `Couldn't send: ${msg}`,
  linkPrompt: 'Link address',
  attachments: 'Attachments',
  remove: (name) => `Remove ${name}`,
  openImage: (name) => `Open ${name}`,
  preview: (name) => `Preview: ${name}`,
  closePreview: 'Close preview',
  annotate: 'Annotate',
  annotateTitle: (name) => `Annotate ${name}`,
  annotateLoading: 'Loading the annotation tools…',
  done: 'Done',
  cancel: 'Cancel',
  zoom: 'Zoom',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  textPlaceholder: 'Type, then press Enter',
  tools: {
    select: 'Select and move', rect: 'Rectangle', highlight: 'Highlight', ellipse: 'Ellipse',
    arrow: 'Arrow', line: 'Line', pen: 'Pen', text: 'Text', step: 'Numbered step',
    redact: 'Redact (pixelate)', crop: 'Crop', color: 'Colour', undo: 'Undo', redo: 'Redo', remove: 'Delete',
    // The palette, in order: danger, warning, success, accent, text, background.
    colorNames: ['Red', 'Amber', 'Green', 'Accent', 'Dark', 'Light'],
  },
  formatting: {
    bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strikethrough',
    bulletList: 'Bulleted list', orderedList: 'Numbered list', link: 'Link', code: 'Code',
    color: 'Text color',
  },
};

/** Merge partial label overrides (including `formatting`) onto the defaults. */
export function mergeLabels(labels) {
  if (!labels) return DEFAULT_LABELS;
  return {
    ...DEFAULT_LABELS,
    ...labels,
    formatting: { ...DEFAULT_LABELS.formatting, ...labels.formatting },
    tools: { ...DEFAULT_LABELS.tools, ...labels.tools },
  };
}
