import type { CSSProperties, ReactElement, ReactNode } from 'react';

/** Design tokens. Every key maps to a `--rk-*` CSS variable; any CSS value works. */
export interface ReviewKitTheme {
  fontFamily?: string;
  fontFamilyMono?: string;
  fontSizeXs?: string;
  fontSizeSm?: string;
  fontSizeMd?: string;
  fontWeightMedium?: string | number;
  space1?: string;
  space2?: string;
  space3?: string;
  space4?: string;
  radius?: string;
  radiusSm?: string;
  background?: string;
  backgroundSubtle?: string;
  border?: string;
  text?: string;
  textMuted?: string;
  accent?: string;
  accentSoft?: string;
  accentText?: string;
  danger?: string;
  /** Also the annotator's amber marker colour. */
  warning?: string;
  success?: string;
  shadow?: string;
  pickFill?: string;
  /** Backdrop behind the image preview and annotator. */
  overlay?: string;
  zIndex?: string | number;
}

/** Every visible string. Pass any subset to `labels`. */
export interface ReviewKitLabels {
  select: string;
  selectHint: string;
  picking: string;
  pickHint: string;
  screenshot: string;
  screenshotHint: string;
  capturing: string;
  upload: string;
  uploadHint: (maxMb: number) => string;
  send: string;
  sendPoints: (count: number) => string;
  sending: string;
  sent: (count: number) => string;
  point: string;
  pointTitle: (n: number) => string;
  newPointHint: string;
  deletePoint: (n: number) => string;
  placeholder: string;
  pointPlaceholder: (n: number) => string;
  dropHint: (n: number) => string;
  collapse: string;
  close: string;
  open: (title: string) => string;
  screenLabel: string;
  skipped: (count: number, maxMb: number) => string;
  captureFailed: (message: string) => string;
  screenshotFailed: (message: string) => string;
  sendFailed: (message: string) => string;
  linkPrompt: string;
  attachments: string;
  remove: (name: string) => string;
  openImage: (name: string) => string;
  preview: (name: string) => string;
  closePreview: string;
  annotate: string;
  annotateTitle: (name: string) => string;
  annotateLoading: string;
  done: string;
  cancel: string;
  zoom: string;
  textPlaceholder: string;
  /** Annotator toolbar names (also their tooltips). */
  tools: {
    select: string; rect: string; highlight: string; ellipse: string;
    arrow: string; line: string; pen: string; text: string; step: string;
    redact: string; crop: string; color: string; undo: string; redo: string; remove: string;
    /** Names for the palette: danger, warning, success, accent, text, background. */
    colorNames: string[];
  };
  formatting: {
    bold: string;
    italic: string;
    underline: string;
    strike: string;
    bulletList: string;
    orderedList: string;
    link: string;
    code: string;
  };
}

export type ReviewKitLabelOverrides = Partial<Omit<ReviewKitLabels, 'formatting' | 'tools'>> & {
  formatting?: Partial<ReviewKitLabels['formatting']>;
  tools?: Partial<ReviewKitLabels['tools']>;
};

/** Extra class names for styling with your own CSS or utility classes. */
export interface ReviewKitClassNames {
  root?: string;
  panel?: string;
  header?: string;
  points?: string;
  /** The row of attachment thumbnails. */
  attachments?: string;
  editor?: string;
  footer?: string;
  toolButton?: string;
  sendButton?: string;
  tab?: string;
}

export interface PageContext {
  url: string;
  title: string;
  viewport: { width: number; height: number };
}

export interface ReviewAttachment {
  file: Blob;
  name: string;
  type: string;
  /** element: picked from the page; screen: a screenshot of the screen; upload: uploaded, pasted or dropped. */
  kind: 'element' | 'screen' | 'upload';
  /** Unique CSS selector of a picked element. */
  selector?: string | null;
  /** Readable name of a picked element, e.g. "div.cardBody". */
  element?: string;
  /** Picked element's position in page coordinates. */
  rect?: { x: number; y: number; width: number; height: number };
  /** True when the reviewer marked the image up in the annotator. */
  annotated?: boolean;
}

export interface ReviewPoint {
  /** Plain text of the comment. */
  text: string;
  /** The comment as HTML. Sanitize it before rendering (e.g. DOMPurify). */
  html: string;
  attachments: ReviewAttachment[];
  /** The page the point was made on. */
  context: PageContext;
}

export interface ReviewSubmission {
  points: ReviewPoint[];
  context: PageContext & { userAgent: string; createdAt: string };
}

export interface ReviewDockProps {
  /** What is being reviewed. */
  title: string;
  subtitle?: string;
  /** Save the feedback. Resolve truthy (or nothing) to clear the box; resolve false or throw to keep it. */
  onSubmit: (submission: ReviewSubmission) => Promise<boolean | void> | boolean | void;
  /** Show a close button. */
  onClose?: () => void;
  /** localStorage key for the box's position, size and collapsed side. Default "review-kit:dock". */
  storageKey?: string;
  /** Per-file upload limit in MB. Default 10. */
  maxFileSizeMb?: number;
  theme?: ReviewKitTheme;
  labels?: ReviewKitLabelOverrides;
  classNames?: ReviewKitClassNames;
  className?: string;
  /** Extra content under the editor. */
  children?: ReactNode;
}

export declare function ReviewDock(props: ReviewDockProps): ReactElement | null;

export interface PickElementOptions {
  /** Extra elements to skip. */
  ignore?: (el: Element) => boolean;
  /** Instruction shown while picking. */
  hint?: string;
  /** CSS variables for the overlay, e.g. themeToStyle(theme). */
  style?: Record<string, string>;
}

/** Hover-highlight picker. ↑/↓ move to parent/child; click or Enter picks; Esc resolves null. */
export declare function pickElement(options?: PickElementOptions): Promise<Element | null>;
/** Readable name, e.g. "div#checkout" or "button.primary". */
export declare function describeElement(el: Element): string;
/** Attribute on everything the kit renders; elements carrying it are never picked or captured. */
export declare const KIT_ATTR: 'data-review-kit';

/** PNG of one element. */
export declare function captureElement(el: Element): Promise<Blob>;
/** PNG of what's on screen. */
export declare function captureViewport(): Promise<Blob>;
/** Unique CSS selector for an element, or null. Options are passed to @medv/finder. */
export declare function selectorFor(el: Element, options?: Record<string, unknown>): string | null;

export declare const THEME_TOKENS: Readonly<Record<keyof ReviewKitTheme, string>>;
/** Theme object → inline style of CSS variables. */
export declare function themeToStyle(theme?: ReviewKitTheme): CSSProperties | undefined;
/** A dark preset: spread it and override what you need. */
export declare const darkTheme: ReviewKitTheme;
export declare const DEFAULT_LABELS: ReviewKitLabels;
export declare function mergeLabels(labels?: ReviewKitLabelOverrides): ReviewKitLabels;
