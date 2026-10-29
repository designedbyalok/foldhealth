# review-dock

A drop-in visual review widget for React apps. Reviewers open a floating comment
box over your product and leave feedback in **points**: each point can carry
screenshots of a picked element or the whole screen, uploaded or pasted images
and GIFs, and a rich-text comment. A long flow across several screens becomes
one piece of feedback with a point per screen.

- **Floating box**: drag it anywhere, resize it, or drop it against a side of
  the screen to tuck it into a small tab.
- **Select**: DevTools-style hover highlight. Press ↑ / ↓ to move to the parent
  or child element, then click or Enter to capture it (with a CSS selector).
- **Screenshot**: one click captures what's on screen.
- **Upload**: images and GIFs via button, paste, or drag and drop anywhere on
  the box (including onto the text).
- **Preview and annotate**: attachments show as square thumbnails; click one to
  see it full size, then **Annotate**: rectangle, highlight, ellipse, arrow,
  line, pen, text, numbered steps, redact (pixelate, for private data) and
  crop, with colours, undo/redo, keyboard shortcuts and hover tooltips. The
  marked-up image replaces the original at its full resolution.
- **Rich text**: bold, italic, underline, strike, lists, links, inline code.
  Cmd/Ctrl+Enter sends.
- **Matches your design system**: theme tokens, CSS variables, or class names.
- **Storage-agnostic**: you get the feedback in `onSubmit` and save it anywhere.

## Install

```bash
npm install review-dock
```

React 19 or newer is a peer dependency. Then import the stylesheet once (in
your app entry or root layout):

```js
import 'review-dock/styles.css';
```

## Quick start

```jsx
import { useState } from 'react';
import { ReviewDock } from 'review-dock';
import 'review-dock/styles.css';

export function Review() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <ReviewDock
      title="Checkout flow"
      subtitle="Design review"
      onClose={() => setOpen(false)}
      onSubmit={async ({ points, context }) => {
        await saveFeedback({ points, context }); // your API
        return true; // false (or throw) keeps the feedback in the box
      }}
    />
  );
}
```

Render it wherever reviews happen: behind a "Review" button, a query flag
(`?review=1`), or only for internal users.

### Next.js (app router)

The component is a client component (the build starts with `"use client"`) and
is safe to server-render. Import the stylesheet in `app/layout.js`, and render
`ReviewDock` from any component.

## What `onSubmit` receives

```ts
{
  points: [
    {
      text: string,          // plain text of the comment
      html: string,          // rich text: sanitize before rendering (e.g. DOMPurify)
      attachments: [
        {
          file: Blob,        // PNG for screenshots, the original file for uploads
          name: string,
          type: string,      // MIME type
          kind: 'element' | 'screen' | 'upload',
          selector?: string, // element picks: unique CSS selector
          element?: string,  // element picks: e.g. "div.cardBody"
          rect?: { x, y, width, height }, // element picks: page coordinates
          annotated: boolean, // marked up in the annotator (the file is then a PNG)
        },
      ],
      context: { url, title, viewport: { width, height } }, // where the point was made
    },
  ],
  context: { url, title, viewport, userAgent, createdAt },  // when it was sent
}
```

### Example: save to your API

```js
async function saveFeedback({ points, context }) {
  const form = new FormData();
  const meta = points.map((p, i) => ({
    text: p.text,
    html: p.html,
    context: p.context,
    attachments: p.attachments.map((a, j) => {
      const field = `file-${i}-${j}`;
      form.append(field, a.file, a.name);
      return { field, name: a.name, kind: a.kind, selector: a.selector, element: a.element, rect: a.rect };
    }),
  }));
  form.append('feedback', JSON.stringify({ points: meta, context }));
  const res = await fetch('/api/feedback', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Could not save feedback');
}
```

## Match your design system

There are three levels; use whichever fits your stack. They combine.

### 1. The `theme` prop (design tokens)

```jsx
<ReviewDock
  theme={{
    fontFamily: 'Inter, sans-serif',
    accent: '#0f62fe',
    accentSoft: '#e5edff',
    accentText: '#ffffff',
    radius: '10px',
    radiusSm: '6px',
  }}
  …
/>
```

| Token | Variable | Default |
| --- | --- | --- |
| `fontFamily` | `--rk-font` | `inherit` (your app's font) |
| `fontFamilyMono` | `--rk-font-mono` | system monospace |
| `fontSizeXs` / `fontSizeSm` / `fontSizeMd` | `--rk-font-xs` / `-sm` / `-md` | 11 / 12 / 14px |
| `fontWeightMedium` | `--rk-font-weight-medium` | 500 |
| `space1`…`space4` | `--rk-space-1`…`-4` | 4 / 8 / 12 / 16px |
| `radius` / `radiusSm` | `--rk-radius` / `--rk-radius-sm` | 12 / 6px |
| `background` / `backgroundSubtle` | `--rk-bg` / `--rk-bg-subtle` | white / light grey |
| `border` | `--rk-border` | light grey |
| `text` / `textMuted` | `--rk-text` / `--rk-text-muted` | near-black / grey |
| `accent` / `accentSoft` / `accentText` | `--rk-accent` / `-soft` / `-text` | purple / pale purple / white |
| `danger` / `success` | `--rk-danger` / `--rk-success` | red / green |
| `shadow` | `--rk-shadow` | soft drop shadow |
| `pickFill` | `--rk-pick-fill` | translucent accent |
| `warning` | `--rk-warning` | amber (also an annotation colour) |
| `overlay` | `--rk-overlay` | backdrop behind the preview; crop shade |
| `zIndex` | `--rk-z` | very high, above modals |

### 2. CSS variables (point them at your own tokens)

Override the variables once, globally, and the kit follows your tokens,
including dark mode if your tokens switch:

```css
/* shadcn/ui */
:root {
  --rk-font: var(--font-sans);
  --rk-bg: hsl(var(--background));
  --rk-bg-subtle: hsl(var(--muted));
  --rk-border: hsl(var(--border));
  --rk-text: hsl(var(--foreground));
  --rk-text-muted: hsl(var(--muted-foreground));
  --rk-accent: hsl(var(--primary));
  --rk-accent-soft: hsl(var(--accent));
  --rk-accent-text: hsl(var(--primary-foreground));
  --rk-danger: hsl(var(--destructive));
  --rk-radius: var(--radius);
}
```

```css
/* Tailwind v4 theme variables */
:root {
  --rk-accent: var(--color-indigo-600);
  --rk-accent-soft: var(--color-indigo-50);
  --rk-border: var(--color-gray-200);
  --rk-radius: var(--radius-xl);
}
```

```jsx
// MUI: derive the tokens from your theme
const muiTheme = useTheme();
<ReviewDock theme={{
  fontFamily: muiTheme.typography.fontFamily,
  accent: muiTheme.palette.primary.main,
  accentText: muiTheme.palette.primary.contrastText,
  background: muiTheme.palette.background.paper,
  text: muiTheme.palette.text.primary,
  textMuted: muiTheme.palette.text.secondary,
  border: muiTheme.palette.divider,
  radius: `${muiTheme.shape.borderRadius * 2}px`,
}} … />
```

### 3. Class names (utility classes or your own CSS)

```jsx
<ReviewDock
  classNames={{
    panel: 'ring-1 ring-black/5',
    sendButton: 'font-semibold',
    toolButton: 'hover:bg-gray-100',
  }}
  …
/>
```

Slots: `root`, `panel`, `header`, `points`, `attachments`, `editor`, `footer`,
`toolButton`, `sendButton`, `tab`. Every element also has a stable `rk-*` class
you can target.

### Dark mode

```jsx
import { ReviewDock, darkTheme } from 'review-dock';

<ReviewDock theme={isDark ? { ...darkTheme, accent: '#8ab4ff' } : lightTokens} … />
```

## Wording and translations

Every visible string can be replaced:

```jsx
<ReviewDock
  labels={{
    send: 'Envoyer',
    sendPoints: (n) => `Envoyer ${n} points`,
    placeholder: 'Laissez un commentaire…',
    formatting: { bold: 'Gras' },
  }}
  …
/>
```

See `DEFAULT_LABELS` for the full list.

## Props

| Prop | Type | |
| --- | --- | --- |
| `title` | `string` | What is being reviewed (required). |
| `subtitle` | `string` | Second line in the header. |
| `onSubmit` | `(submission) => Promise<boolean \| void>` | Save the feedback (required). |
| `onClose` | `() => void` | Shows a close button. |
| `theme` | `ReviewKitTheme` | Design tokens (see above). |
| `labels` | partial `ReviewKitLabels` | Wording and translations. |
| `classNames` | `ReviewKitClassNames` | Extra classes per slot. |
| `className` | `string` | Extra class on the root layer. |
| `storageKey` | `string` | Where position and size are remembered. Default `review-kit:dock`. The box always opens expanded and fully on screen. |
| `maxFileSizeMb` | `number` | Per-file upload limit. Default `10`. |
| `children` | `ReactNode` | Extra content under the editor. |

## Lower-level helpers

```js
import { pickElement, captureElement, captureViewport, selectorFor, themeToStyle } from 'review-dock';

const el = await pickElement({ style: themeToStyle(theme) }); // null on Esc
const png = await captureElement(el);   // Blob
const shot = await captureViewport();   // Blob of the visible screen
const selector = selectorFor(el);       // e.g. "#checkout > .summary button"
```

Anything rendered by the kit carries `data-review-kit`, so it is never picked or
captured. Add that attribute to your own UI to keep it out of screenshots too
(for example a "Review" toolbar).

## How screenshots work, and their limits

Screenshots are rendered from the DOM in the browser (no browser extension, no
screen-share prompt), using [snapDOM](https://github.com/zumerlab/snapdom).

- **Whole-screen shots** are composed from layers. DOM renderers lose
  full-height app shells (a `100vh` flex container with `overflow: hidden`
  comes out with an empty main column), so the kit captures the shell's visible
  panes and any overlays (drawers, modals) separately and draws them at their
  on-screen positions.
- **Cross-origin images** need CORS headers to appear; otherwise they render
  blank.
- **`<iframe>`s** from other origins, and **video frames**, can't be captured.
- The kit's own UI is always excluded.

## Accessibility

Keyboard: Tab through all controls; in the picker, ↑ / ↓ / Enter / Esc; in the
editor, Cmd/Ctrl+B / I / U and Cmd/Ctrl+Enter to send. Buttons have labels,
points are tabs, thumbnails open a labelled preview dialog, and motion respects
`prefers-reduced-motion`.

## Browser support

Current Chrome, Edge, Firefox and Safari.

## Develop

```bash
npm run build   # dist/index.js (ESM), dist/index.cjs, dist/styles.css
```

## Built on

- [snapDOM](https://github.com/zumerlab/snapdom): element and screen screenshots
- [@medv/finder](https://github.com/antonmedv/finder): unique CSS selectors
- [react-rnd](https://github.com/bokuweb/react-rnd): drag and resize
- [react-dropzone](https://github.com/react-dropzone/react-dropzone): file drop and pick
- [Tiptap](https://github.com/ueberdosis/tiptap): the rich-text editor
- [Konva](https://github.com/konvajs/konva) and [react-konva](https://github.com/konvajs/react-konva):
  the annotator's canvas, loaded only when someone opens it

All MIT. The annotator's toolbar icons are [Solar](https://www.figma.com/community/file/1166831539721848736)
linear icons by 480 Design (CC BY 4.0), redrawn at a 1px stroke
(`scripts/build-annotator-icons.mjs`).

## License

MIT
