// Parse a raw HTML email body into the document shape used by the email
// builder so the imported HTML lands as editable blocks in the layers panel.
//
// We render the HTML into a hidden iframe first and read getComputedStyle so
// classes defined in <style> blocks, shorthand `background`, the inherited
// `color`/`font-family` chain, etc. are all resolved. Walking the parsed
// `style` attribute alone misses everything that isn't inline: which is
// most of what designers use.

import { GOOGLE_FONTS } from './googleFonts';

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const TEXT_TAGS = new Set(['P', 'SPAN', 'BLOCKQUOTE', 'PRE', 'CODE', 'EM', 'STRONG', 'B', 'I', 'U']);
const ALLOWED_INLINE_TAGS = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'A', 'BR', 'CODE', 'SPAN']);

// rgb(58, 72, 95) → #3A485F. We always store colors as hex so the color
// picker shows hex codes (the user explicitly wants this).
export function rgbToHex(value) {
  if (!value || typeof value !== 'string') return value;
  const v = value.trim();
  if (v.startsWith('#')) return v.toUpperCase();
  // Named "transparent" → leave it; the renderer treats it as no fill.
  if (v === 'transparent' || v === 'rgba(0, 0, 0, 0)') return null;
  const m = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)$/i);
  if (!m) return v;
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  if (a === 0) return null;
  const toHex = n => parseInt(n, 10).toString(16).padStart(2, '0');
  return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`.toUpperCase();
}

function parsePxNumber(value) {
  if (value == null || value === '') return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

function firstFontFamily(family) {
  if (!family) return null;
  const first = family.replace(/['"]/g, '').split(',')[0].trim();
  // Skip generic fallbacks so we don't overwrite the parent's choice.
  if (['sans-serif', 'serif', 'monospace', 'system-ui', '-apple-system'].includes(first)) return null;
  return first;
}

function readPadding(cs) {
  return {
    top: parsePxNumber(cs.paddingTop) || 0,
    right: parsePxNumber(cs.paddingRight) || 0,
    bottom: parsePxNumber(cs.paddingBottom) || 0,
    left: parsePxNumber(cs.paddingLeft) || 0,
  };
}

function readBackgroundImage(cs) {
  const bg = cs.backgroundImage;
  if (!bg || bg === 'none') return null;
  // Capture gradient values verbatim: our renderer accepts gradient strings.
  if (bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient')) return bg;
  const m = bg.match(/url\((['"]?)([^'")]+)\1\)/);
  return m ? m[2] : null;
}

function extractStyle(el, win) {
  const cs = win.getComputedStyle(el);
  const out = {};

  const pad = readPadding(cs);
  if (pad.top || pad.right || pad.bottom || pad.left) out.padding = pad;

  const color = rgbToHex(cs.color);
  if (color) out.color = color;

  const bgColor = rgbToHex(cs.backgroundColor);
  if (bgColor) out.backgroundColor = bgColor;

  const bgImage = readBackgroundImage(cs);
  if (bgImage) {
    if (bgImage.startsWith('linear-gradient') || bgImage.startsWith('radial-gradient')) {
      // Gradient → our renderer reads gradients off backgroundColor.
      out.backgroundColor = bgImage;
    } else {
      out.backgroundImage = bgImage;
      if (cs.backgroundSize && cs.backgroundSize !== 'auto') out.backgroundSize = cs.backgroundSize;
      if (cs.backgroundPosition && cs.backgroundPosition !== '0% 0%') out.backgroundPosition = cs.backgroundPosition;
      if (cs.backgroundRepeat && cs.backgroundRepeat !== 'repeat') out.backgroundRepeat = cs.backgroundRepeat;
    }
  }

  if (cs.textAlign && cs.textAlign !== 'start') out.textAlign = cs.textAlign;

  const ff = firstFontFamily(cs.fontFamily);
  if (ff) out.fontFamily = ff;

  const fs = parsePxNumber(cs.fontSize);
  if (fs != null) out.fontSize = fs;

  if (cs.fontWeight) {
    const w = parseInt(cs.fontWeight, 10);
    if (!Number.isNaN(w) && w !== 400) out.fontWeight = w;
  }
  if (cs.fontStyle && cs.fontStyle !== 'normal') out.fontStyle = cs.fontStyle;
  if (cs.textDecorationLine && cs.textDecorationLine !== 'none') out.textDecoration = cs.textDecorationLine;
  if (cs.textTransform && cs.textTransform !== 'none') out.textTransform = cs.textTransform;
  if (cs.letterSpacing && cs.letterSpacing !== 'normal') out.letterSpacing = cs.letterSpacing;
  if (cs.lineHeight && cs.lineHeight !== 'normal') {
    // getComputedStyle returns px; store as that. parseLineHeight in dimUnits
    // will treat the trailing "px" as the unit when the field renders.
    out.lineHeight = cs.lineHeight;
  }

  const br = parsePxNumber(cs.borderTopLeftRadius);
  if (br != null && br > 0) out.borderRadius = br;

  // Border: take the top side as representative; if any side differs the
  // user can refine inside the builder. Width 0 = no border.
  const bw = parsePxNumber(cs.borderTopWidth);
  if (bw != null && bw > 0) {
    out.borderWidth = bw;
    const bc = rgbToHex(cs.borderTopColor);
    if (bc) out.borderColor = bc;
    if (cs.borderTopStyle && cs.borderTopStyle !== 'none') out.borderStyle = cs.borderTopStyle;
  }

  // Hero / fixed-height layout fidelity. getComputedStyle returns the
  // resolved pixel value, so we just pass the string through and let the
  // CSS renderer use it.
  if (cs.minHeight && cs.minHeight !== '0px' && cs.minHeight !== 'auto') {
    out.minHeight = cs.minHeight;
  }
  // Centered email containers commonly set max-width:600px + margin:auto.
  // Preserve max-width so the parsed Container renders at the source width.
  if (cs.maxWidth && cs.maxWidth !== 'none') {
    out.maxWidth = cs.maxWidth;
  }

  return out;
}

// Preserve the inline-only style attributes we know our InlineEditable
// renderer will honour. Whitelisted to avoid leaking layout properties
// (padding/margin/etc.) into a span that the renderer would treat as
// inline. Color goes through rgbToHex so the result matches the rest of
// the document storage convention.
function inlineStyleAttr(el) {
  const s = el.style;
  if (!s) return '';
  const parts = [];
  const color = rgbToHex(s.color);
  if (color) parts.push(`color:${color}`);
  if (s.fontWeight && s.fontWeight !== 'normal' && s.fontWeight !== '400') {
    parts.push(`font-weight:${s.fontWeight}`);
  }
  if (s.fontStyle && s.fontStyle !== 'normal') parts.push(`font-style:${s.fontStyle}`);
  if (s.textDecoration && s.textDecoration !== 'none') parts.push(`text-decoration:${s.textDecoration}`);
  if (s.textTransform && s.textTransform !== 'none') parts.push(`text-transform:${s.textTransform}`);
  if (s.backgroundColor) {
    const bg = rgbToHex(s.backgroundColor);
    if (bg) parts.push(`background-color:${bg}`);
  }
  return parts.length ? ` style="${parts.join(';')}"` : '';
}

function extractInlineHtml(el) {
  const parts = [];
  el.childNodes.forEach(node => {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      parts.push(node.textContent);
    } else if (node.nodeType === 1 /* ELEMENT_NODE */) {
      const tag = node.tagName;
      if (ALLOWED_INLINE_TAGS.has(tag)) {
        const inner = extractInlineHtml(node);
        if (tag === 'BR') parts.push('<br>');
        else if (tag === 'A') {
          const href = node.getAttribute('href') || '#';
          parts.push(`<a href="${href}"${inlineStyleAttr(node)}>${inner}</a>`);
        } else {
          const lower = tag.toLowerCase();
          parts.push(`<${lower}${inlineStyleAttr(node)}>${inner}</${lower}>`);
        }
      } else {
        parts.push(extractInlineHtml(node));
      }
    }
  });
  return parts.join('');
}

function hasVisualStyle(style) {
  return !!(style.backgroundColor || style.backgroundImage || style.borderWidth ||
            style.borderRadius || (style.padding && (style.padding.top || style.padding.right || style.padding.bottom || style.padding.left)));
}

function isAnchorButton(el, cs) {
  if (el.tagName !== 'A') return false;
  const hasPad = parsePxNumber(cs.paddingTop) > 0 || parsePxNumber(cs.paddingLeft) > 0;
  const hasBg = !!rgbToHex(cs.backgroundColor);
  const hasBorder = (parsePxNumber(cs.borderTopWidth) || 0) > 0;
  return hasPad && (hasBg || hasBorder);
}

function isColumnsRow(el) {
  if (el.tagName === 'TR') {
    const tds = Array.from(el.children).filter(c => c.tagName === 'TD');
    return tds.length >= 2;
  }
  if (el.tagName === 'DIV') {
    const cs = el.ownerDocument.defaultView.getComputedStyle(el);
    const display = cs.display;
    const childDivs = Array.from(el.children).filter(c => c.tagName === 'DIV');
    if (childDivs.length < 2) return false;
    // Side-by-side: flex/grid container, or each child is inline-block.
    if (display === 'flex' || display === 'grid') return true;
    const childDisplays = childDivs.map(c => el.ownerDocument.defaultView.getComputedStyle(c).display);
    return childDisplays.every(d => d === 'inline-block' || d.startsWith('table-cell'));
  }
  return false;
}

// Map a parsed anchor-button into the exact block shape the Button renderer
// expects: color/shape/size live on `props`, only padding/textAlign and an
// optional borderRadius override stay on `style`. Without this normalization
// the renderer's `props.buttonBackgroundColor || '#7C5CFA'` falls back to
// the builder's default purple, ignoring the parsed value entirely.
function inferButtonSize(padding) {
  if (!padding) return 'medium';
  const horiz = (padding.left || 0) + (padding.right || 0);
  if (horiz <= 18) return 'x-small';
  if (horiz <= 24) return 'small';
  if (horiz <= 40) return 'medium';
  return 'large';
}

function extractButtonBlock(el, win) {
  const raw = extractStyle(el, win);
  // Gradient strings on Button don't round-trip through the renderer,
  // drop them so the renderer falls back cleanly. Solid hex passes through.
  const bg = raw.backgroundColor && !/^(linear|radial)-gradient/.test(raw.backgroundColor)
    ? raw.backgroundColor
    : undefined;
  const radius = raw.borderRadius;
  let buttonStyle = 'rectangle';
  if (radius != null) {
    if (radius >= 100) buttonStyle = 'pill';
    else if (radius > 0) buttonStyle = 'rounded';
  }
  const props = {
    text: el.textContent.trim() || 'Button',
    url: el.getAttribute('href') || '#',
    buttonStyle,
    size: inferButtonSize(raw.padding),
  };
  if (bg) props.buttonBackgroundColor = bg;
  if (raw.color) props.buttonTextColor = raw.color;
  if (raw.borderWidth) {
    props.borderWidth = raw.borderWidth;
    if (raw.borderColor) props.borderColor = raw.borderColor;
  }
  // Keep only the keys the renderer reads off style: padding, textAlign,
  // blockAlign, borderRadius. The renderer's `style.borderRadius ?? preset`
  // means a numeric radius here will override the preset cleanly.
  const style = {};
  if (raw.padding) style.padding = raw.padding;
  if (raw.textAlign) style.textAlign = raw.textAlign;
  if (raw.blockAlign) style.blockAlign = raw.blockAlign;
  if (radius != null) style.borderRadius = radius;
  return { type: 'Button', data: { props, style } };
}

function makeIdGen() {
  let n = 1;
  const base = Date.now();
  return () => `block-${base}-${n++}`;
}

// Pull family names out of any `<link href="…fonts.googleapis.com/css2?
// family=A+B:wght@400&family=C:wght@500">` tags in the head. Used to tell
// the substitution dialog "these are loaded externally: don't flag them
// as unknowns." Returns an array of human-readable family names with
// spaces (e.g. "IBM Plex Serif"), de-duped.
function extractLinkedGoogleFonts(idoc) {
  const links = Array.from(idoc?.head?.querySelectorAll('link[href*="fonts.googleapis.com"]') || []);
  const families = new Set();
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    // family= params can repeat; the value is "Family+Name:axis@list".
    const matches = href.matchAll(/[?&]family=([^&]+)/g);
    for (const m of matches) {
      const raw = decodeURIComponent(m[1]).split(':')[0];
      const name = raw.replace(/\+/g, ' ').trim();
      if (name) families.add(name);
    }
  }
  return [...families];
}

// Walk the body into a flat blocks map + root child list. The walker
// (`walk`) returns an array of block IDs the caller should treat as the
// element's contribution to its parent's child list: usually one ID, but
// pass-through wrappers can return their children's IDs directly so we
// don't generate empty Containers.
function buildDocFromDom(idoc, win) {
  const blocks = {};
  const genId = makeIdGen();
  const body = idoc.body;

  // Capture linked Google Fonts BEFORE we strip the head (well: body links;
  // head links survive `body.querySelectorAll` but we still want the read to
  // happen up-front in case a future change moves the strip).
  const linkedFonts = extractLinkedGoogleFonts(idoc);

  // Sentinel-strip elements with no editable representation.
  body.querySelectorAll('script, style, meta, link, noscript').forEach(el => el.remove());

  const bodyCs = win.getComputedStyle(body);
  const backdropColor = rgbToHex(bodyCs.backgroundColor) || '#F2EEFE';
  const rootFontFamily = firstFontFamily(bodyCs.fontFamily);
  const rootTextColor = rgbToHex(bodyCs.color) || '#3A485F';

  // Find the inner email container: usually a single child of body or the
  // first table/.email-container. Its background is the canvas color.
  let canvasColor = '#FFFFFF';
  const wrapper = body.querySelector('table[role="presentation"], .email-container, .container, [class*="email"]');
  if (wrapper) {
    const wcs = win.getComputedStyle(wrapper);
    const bg = rgbToHex(wcs.backgroundColor);
    if (bg) canvasColor = bg;
  }

  // Tag the source element with the block ID we're about to create so the
  // editor can later click on the rendered HTML and resolve back to a block.
  // We also tag a `__textPath` on Text blocks pointing at the original
  // element so style edits can find the right DOM node when syncing.
  const tagEl = (el, id) => { el.setAttribute('data-eb-block-id', id); };

  const walk = (el) => {
    const cs = win.getComputedStyle(el);

    // Skip hidden elements outright.
    if (cs.display === 'none' || cs.visibility === 'hidden') return [];

    // Buttons (anchors that look like buttons)
    if (isAnchorButton(el, cs)) {
      const id = genId();
      tagEl(el, id);
      blocks[id] = extractButtonBlock(el, win);
      return [id];
    }

    // Headings
    if (HEADING_TAGS.has(el.tagName)) {
      const id = genId();
      tagEl(el, id);
      blocks[id] = {
        type: 'Heading',
        data: {
          props: { text: extractInlineHtml(el), level: el.tagName.toLowerCase() },
          style: extractStyle(el, win),
        },
      };
      return [id];
    }

    // Inline SVG: preserved as an Image block with the raw markup. Common
    // for logo squares, icon bubbles, and social-bar glyphs in production
    // emails. Without this branch the SVG element would either fall through
    // to the text-leaf branch (where it gets stripped) or be inlined as
    // HTML inside a Text block (the renderer doesn't pass through unknown
    // tags). Image's existing svgRaw path renders the markup as-is.
    if (el.tagName === 'svg' || el.tagName === 'SVG') {
      const id = genId();
      tagEl(el, id);
      // Prefer explicit width/height attrs (SVG icons usually set both);
      // fall back to viewBox-derived dimensions or a 24px default.
      const w = parsePxNumber(el.getAttribute('width')) || parsePxNumber(cs.width);
      const h = parsePxNumber(el.getAttribute('height')) || parsePxNumber(cs.height);
      const props = {
        url: '',
        alt: '',
        svgRaw: el.outerHTML,
      };
      if (w) props.width = w;
      if (h) props.height = h;
      blocks[id] = {
        type: 'Image',
        data: { props, style: extractStyle(el, win) },
      };
      return [id];
    }

    // Images
    if (el.tagName === 'IMG') {
      const id = genId();
      tagEl(el, id);
      const w = parsePxNumber(el.getAttribute('width')) ?? parsePxNumber(cs.width);
      const h = parsePxNumber(el.getAttribute('height')) ?? parsePxNumber(cs.height);
      const props = { url: el.getAttribute('src') || '', alt: el.getAttribute('alt') || '' };
      if (w) props.width = w;
      if (h) props.height = h;
      blocks[id] = {
        type: 'Image',
        data: { props, style: extractStyle(el, win) },
      };
      return [id];
    }

    // Horizontal rule → Divider
    if (el.tagName === 'HR') {
      const id = genId();
      tagEl(el, id);
      const lineColor = rgbToHex(cs.borderTopColor) || rgbToHex(cs.color) || '#E1E4EA';
      const lineHeight = parsePxNumber(cs.borderTopWidth) || 1;
      blocks[id] = {
        type: 'Divider',
        data: { props: { lineColor, lineHeight }, style: {} },
      };
      return [id];
    }

    // Lists (UL / OL) → single Text block with listStyle so the builder's
    // list controls in PropertiesPanel can edit them. Each <li> becomes a
    // line in the text. Nested lists fall through to the wrapper branch
    // below and end up rendered as raw HTML inside a Text block.
    if ((el.tagName === 'UL' || el.tagName === 'OL') && !el.querySelector('ul, ol')) {
      const items = Array.from(el.children).filter(c => c.tagName === 'LI');
      if (items.length > 0) {
        const id = genId();
        tagEl(el, id);
        const text = items.map(li => extractInlineHtml(li)).join('\n');
        blocks[id] = {
          type: 'Text',
          data: {
            props: { text, listStyle: el.tagName === 'OL' ? 'number' : 'bullet' },
            style: extractStyle(el, win),
          },
        };
        return [id];
      }
    }

    // Columns row (TR with multiple TDs, or div with flex/grid children)
    if (isColumnsRow(el)) {
      const id = genId();
      tagEl(el, id);
      const cols = (el.tagName === 'TR'
        ? Array.from(el.children).filter(c => c.tagName === 'TD')
        : Array.from(el.children).filter(c => c.tagName === 'DIV'));
      const columns = cols.map(col => {
        const childrenIds = [];
        Array.from(col.children).forEach(child => {
          const ids = walk(child);
          if (ids) childrenIds.push(...ids);
        });
        if (!childrenIds.length && col.textContent.trim()) {
          const tid = genId();
          tagEl(col, tid);
          blocks[tid] = {
            type: 'Text',
            data: { props: { text: extractInlineHtml(col) }, style: extractStyle(col, win) },
          };
          childrenIds.push(tid);
        }
        // Capture per-cell styling so the ColumnsContainer renderer can
        // paint backgrounds, padding, alignment, and fixed widths on each
        // column. Common in production emails, the principle-rows in the
        // NodeOps template use a 3px coloured bar as column 1.
        const colCs = win.getComputedStyle(col);
        const colInfo = { childrenIds };
        const colBg = rgbToHex(colCs.backgroundColor);
        if (colBg) colInfo.backgroundColor = colBg;
        const cp = readPadding(colCs);
        if (cp.top || cp.right || cp.bottom || cp.left) colInfo.padding = cp;
        if (colCs.textAlign && colCs.textAlign !== 'start') {
          colInfo.align = colCs.textAlign;
        }
        const vAttr = col.getAttribute('valign');
        if (vAttr === 'top' || vAttr === 'middle' || vAttr === 'bottom') {
          colInfo.valign = vAttr;
        }
        const wAttr = col.getAttribute('width');
        const wPx = parsePxNumber(wAttr) || parsePxNumber(colCs.width);
        if (wAttr && /^\d+$/.test(wAttr)) {
          // numeric attribute (no `px`) is per-table-width: treat as px
          colInfo.customWidth = wPx;
        }
        return colInfo;
      });
      blocks[id] = {
        type: 'ColumnsContainer',
        data: { props: { columns }, style: extractStyle(el, win) },
      };
      return [id];
    }

    // Wrappers with element children → Container (or hoist if pass-through).
    const elementChildren = Array.from(el.children);
    const isWrapperTag = ['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'NAV', 'TABLE', 'TBODY', 'TR', 'TD', 'UL', 'OL', 'LI', 'FIGURE'].includes(el.tagName);

    // Empty wrapper with a fixed height → Spacer. Catches the common
    // pattern of `<div style="height: 40px"></div>` used to push content
    // apart in pasted templates. Whitespace-only text content still counts
    // as empty here.
    if ((el.tagName === 'DIV' || el.tagName === 'TD') &&
        elementChildren.length === 0 &&
        !el.textContent?.trim()) {
      const h = parsePxNumber(cs.height);
      if (h != null && h >= 8) {
        const id = genId();
        tagEl(el, id);
        blocks[id] = {
          type: 'Spacer',
          data: { props: { height: Math.round(h) }, style: {} },
        };
        return [id];
      }
    }

    // Anchor-button wrapped in a single-child <p>/<div>. Without this
    // shortcut the walker falls into the text-leaf branch below and inlines
    // the anchor as raw HTML in a Text block, visually fine, but the user
    // can't edit it as a Button. Hoist the inner Button block up.
    if (['P', 'DIV', 'TD'].includes(el.tagName) && elementChildren.length === 1) {
      const only = elementChildren[0];
      const textNodeCount = Array.from(el.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim()).length;
      if (textNodeCount === 0 && only.tagName === 'A') {
        const onlyCs = win.getComputedStyle(only);
        // Pattern A: the anchor itself is button-styled (background +
        // padding on the <a>). Common in MJML/Hubspot output.
        if (isAnchorButton(only, onlyCs)) {
          const id = genId();
          tagEl(only, id);
          blocks[id] = extractButtonBlock(only, win);
          return [id];
        }
        // Pattern B: the wrapper carries the styling (bg + radius), the
        // anchor is just a styled text label inside. This is the classic
        // production email CTA: <td bgcolor="#1C1917" style="border-radius:
        // 9999px"><a href="#" style="padding:12px 22px;color:#fff">…</a></td>
        const wrapperBg = rgbToHex(cs.backgroundColor);
        const wrapperRadius = parsePxNumber(cs.borderTopLeftRadius);
        if (wrapperBg && wrapperRadius != null && wrapperRadius > 0) {
          const id = genId();
          tagEl(el, id);
          const innerPadding = readPadding(onlyCs);
          let buttonStyle = 'rectangle';
          if (wrapperRadius >= 100) buttonStyle = 'pill';
          else if (wrapperRadius > 0) buttonStyle = 'rounded';
          const props = {
            text: only.textContent.trim() || 'Button',
            url: only.getAttribute('href') || '#',
            buttonStyle,
            buttonBackgroundColor: wrapperBg,
            size: inferButtonSize(innerPadding),
          };
          const textColor = rgbToHex(onlyCs.color);
          if (textColor) props.buttonTextColor = textColor;
          blocks[id] = {
            type: 'Button',
            data: {
              props,
              style: {
                padding: innerPadding,
                textAlign: 'center',
                borderRadius: wrapperRadius,
              },
            },
          };
          return [id];
        }
      }
    }

    if (isWrapperTag && elementChildren.length > 0) {
      const childrenIds = [];
      Array.from(el.childNodes).forEach(node => {
        if (node.nodeType === 3) {
          const txt = node.textContent.trim();
          if (txt) {
            const tid = genId();
            // No element to tag for bare text nodes, they get inline-edited
            // via the parent's contenteditable.
            blocks[tid] = {
              type: 'Text',
              data: { props: { text: txt }, style: {} },
            };
            childrenIds.push(tid);
          }
        } else if (node.nodeType === 1) {
          const ids = walk(node);
          if (ids) childrenIds.push(...ids);
        }
      });
      if (!childrenIds.length) return [];

      const style = extractStyle(el, win);
      // Pass-through wrappers (no visual style, single child), hoist the
      // child up so we don't create a stack of nested empty Containers.
      if (!hasVisualStyle(style) && childrenIds.length === 1) {
        return childrenIds;
      }
      const id = genId();
      tagEl(el, id);
      blocks[id] = {
        type: 'Container',
        data: {
          role: 'body',
          props: { childrenIds },
          style,
        },
      };
      return [id];
    }

    // Text-like leaves (P, SPAN, etc.) and DIVs with only text content
    if (TEXT_TAGS.has(el.tagName) || el.tagName === 'DIV' || el.tagName === 'A') {
      const text = extractInlineHtml(el);
      if (!text.trim()) return [];
      const id = genId();
      tagEl(el, id);
      blocks[id] = {
        type: 'Text',
        data: { props: { text }, style: extractStyle(el, win) },
      };
      return [id];
    }

    // Final fallback: recurse into children, dropping the wrapper.
    const all = [];
    Array.from(el.children).forEach(c => {
      const ids = walk(c);
      if (ids) all.push(...ids);
    });
    return all;
  };

  const rootChildren = [];
  Array.from(body.children).forEach(child => {
    const ids = walk(child);
    if (ids) rootChildren.push(...ids);
  });
  // Bare text under body.
  body.childNodes.forEach(n => {
    if (n.nodeType === 3) {
      const txt = n.textContent.trim();
      if (txt) {
        const tid = genId();
        blocks[tid] = { type: 'Text', data: { props: { text: txt }, style: {} } };
        rootChildren.push(tid);
      }
    }
  });

  if (!rootChildren.length) return null;

  return {
    doc: {
      root: {
        type: 'EmailLayout',
        data: {
          backdropColor,
          canvasColor,
          textColor: rootTextColor,
          fontFamily: rootFontFamily || undefined,
          childrenIds: rootChildren,
          // Track families the source HTML linked from Google Fonts so the
          // Confirm handler can skip the substitution dialog for them.
          ...(linkedFonts.length ? { linkedFonts } : {}),
        },
      },
      ...blocks,
    },
    linkedFonts,
  };
}

// Async because we render the HTML into a hidden iframe and wait for it to
// load before reading computed styles. Times out at 2000ms and returns null
// so the caller can fall back to a raw customHtml body.
export function parseHtmlToDocument(html) {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    // 800px keeps the parser above common mobile-first @media (max-width:620px)
    // breakpoints so the captured computed styles reflect the desktop layout,
    // not a collapsed mobile view that would hijack font sizes and padding.
    iframe.style.cssText = 'position:absolute;left:-99999px;top:0;width:800px;height:1200px;visibility:hidden;pointer-events:none;border:0';
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      try { document.body.removeChild(iframe); } catch { /* already removed */ }
    };
    const finish = (value) => { cleanup(); resolve(value); };
    // Append first so contentDocument exists, then write the HTML via
    // document.open/write/close, this is more reliable than `srcdoc`,
    // which fires an extra `load` event for the initial empty document.
    document.body.appendChild(iframe);
    const idoc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!idoc || !win) return finish(null);
    try {
      idoc.open();
      idoc.write(html);
      idoc.close();
    } catch (err) {
      console.error('parseHtmlToDocument write failed:', err);
      return finish(null);
    }
    // Read after the next paint so the browser has applied <style> rules.
    const attempt = () => {
      try {
        if (!idoc.body) return finish(null);
        const built = buildDocFromDom(idoc, win);
        if (!built?.doc) return finish(null);
        // Serialize the now-tagged document so the canvas iframe can use
        // `[data-eb-block-id]` to map clicks back to blocks.
        const taggedHtml = '<!doctype html>\n' + idoc.documentElement.outerHTML;
        finish({ doc: built.doc, html: taggedHtml, linkedFonts: built.linkedFonts || [] });
      } catch (err) {
        console.error('parseHtmlToDocument build failed:', err);
        finish(null);
      }
    };
    // Two rafs covers the case where styles haven't been applied on the
    // first paint of a freshly-written doc.
    requestAnimationFrame(() => requestAnimationFrame(attempt));
    setTimeout(() => finish(null), 2000);
  });
}

// Walk a parsed document and surface font-family values the email builder
// can't render natively. Used to drive the post-import font substitution
// dialog so the user maps unknown fonts to one of the Google Fonts the
// builder knows how to load.
const GENERIC_FONTS = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'inherit']);
const KNOWN_FONT_VALUES = new Set(GOOGLE_FONTS.map(f => f.value.toLowerCase()));
const KNOWN_FONT_LABELS = new Set(GOOGLE_FONTS.map(f => f.label.toLowerCase()));

export function collectUnknownFonts(doc) {
  if (!doc) return [];
  const found = new Set();
  // Treat any font the source HTML linked from Google Fonts as known,
  // the iframe parser already loaded them and we'll preserve the family
  // name. The substitution dialog should only nag about families we
  // truly can't render.
  const linked = doc.root?.data?.linkedFonts || [];
  const linkedLower = new Set(linked.map(f => f.toLowerCase()));
  const check = (name) => {
    if (!name || typeof name !== 'string') return;
    const lower = name.toLowerCase().trim();
    if (KNOWN_FONT_VALUES.has(lower) || KNOWN_FONT_LABELS.has(lower)) return;
    if (GENERIC_FONTS.has(lower)) return;
    if (linkedLower.has(lower)) return;
    found.add(name);
  };
  check(doc.root?.data?.fontFamily);
  Object.keys(doc).forEach(id => {
    if (id === 'root') return;
    check(doc[id]?.data?.style?.fontFamily);
  });
  return Array.from(found);
}

// Apply font substitutions to a parsed doc, `mappings` is `{ original: target }`.
// Returns a new doc with every fontFamily replaced according to the map.
export function applyFontMappings(doc, mappings) {
  if (!doc || !mappings) return doc;
  const remap = (name) => (name && mappings[name]) || name;
  const next = { ...doc };
  if (next.root?.data?.fontFamily) {
    next.root = { ...next.root, data: { ...next.root.data, fontFamily: remap(next.root.data.fontFamily) } };
  }
  Object.keys(next).forEach(id => {
    if (id === 'root') return;
    const b = next[id];
    const ff = b?.data?.style?.fontFamily;
    if (ff && mappings[ff]) {
      next[id] = { ...b, data: { ...b.data, style: { ...b.data.style, fontFamily: mappings[ff] } } };
    }
  });
  return next;
}
