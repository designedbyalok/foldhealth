// Full custom email renderer — produces table-based HTML that matches
// the builder canvas exactly across all email clients.

import { getFontStack, getGoogleFontsHref, resolveFont, GOOGLE_FONTS } from './googleFonts';
import { isGradient, firstStopColor } from './colorHelpers';
import { tintSvgMarkup } from './svgTint';

// ── Dark-mode color transforms ──────────────────────────────────────────
// Real device dark mode (iOS Mail / Gmail auto-dark / Outlook) doesn't
// just darken the backdrop — it inverts whiteish surfaces to dark and
// dark text to light, while preserving vivid brand colors (a purple
// gradient header stays purple). Approximated here with three small
// helpers; tuned to the Fold token palette.

function _rgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let h = hex.trim();
  if (!h.startsWith('#')) return null;
  h = h.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

function _luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function _saturation([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

// Backgrounds: only transform unsaturated (gray-scale) colors. Vivid
// brand colors (purple, orange, etc.) pass through unchanged so the
// gradient header / promo banner keep their identity.
function darkenBackground(hex) {
  const rgb = _rgb(hex);
  if (!rgb) return hex;
  if (_saturation(rgb) > 0.25) return hex;
  const lum = _luminance(rgb);
  if (lum > 235) return '#16181D';   // pure white → near-black canvas
  if (lum > 210) return '#1B1E24';   // very light → dark
  if (lum > 170) return '#23262D';   // light gray → mid-dark
  if (lum > 100) return '#2C3038';   // mid gray → slightly lighter dark
  return hex;                        // already dark, leave alone
}

// Text colors: only flip unsaturated text. White-on-dark text used in
// gradient headers (#FFF on #5020A0) would technically get caught but
// would also look fine inverted on a dark surface, so we leave it; the
// guard against high-luminance text covers that.
function lightenText(hex) {
  const rgb = _rgb(hex);
  if (!rgb) return hex;
  if (_saturation(rgb) > 0.25) return hex; // vivid text stays
  const lum = _luminance(rgb);
  if (lum > 200) return hex;         // already light — eg #FFF on a gradient
  if (lum < 80)  return '#E4E5EE';   // very dark → very light
  if (lum < 140) return '#C7CBD4';   // mid dark → light gray
  if (lum < 180) return '#A0A6B2';   // gray → softer light gray
  return hex;
}

// Walk the document and produce a dark-mode copy. Original doc isn't
// mutated. Touches:
//  - root.backdropColor / canvasColor / textColor
//  - every block.data.style { backgroundColor, color }
//  - Button.props.buttonBackgroundColor / .buttonTextColor
//  - NavBar.props.linkColor (only when unsaturated)
//  - Divider.props.lineColor (always darken-then-lighten so the rule's
//    visible against the dark canvas)
function transformDocForDarkMode(doc) {
  if (!doc) return doc;
  const out = {};
  for (const [id, block] of Object.entries(doc)) {
    if (!block || typeof block !== 'object') { out[id] = block; continue; }
    if (id === 'root') {
      const data = block.data || {};
      out.root = {
        ...block,
        data: {
          ...data,
          backdropColor: '#0F1115',
          canvasColor: '#16181D',
          textColor: lightenText(data.textColor || '#3A485F'),
        },
      };
      continue;
    }
    const data = block.data || {};
    const style = data.style || {};
    const newStyle = { ...style };
    if (style.backgroundColor) newStyle.backgroundColor = darkenBackground(style.backgroundColor);
    if (style.color)           newStyle.color           = lightenText(style.color);
    const props = data.props || {};
    const newProps = { ...props };
    if (block.type === 'Button') {
      if (props.buttonBackgroundColor) newProps.buttonBackgroundColor = darkenBackground(props.buttonBackgroundColor);
      if (props.buttonTextColor)       newProps.buttonTextColor       = lightenText(props.buttonTextColor);
    }
    if (block.type === 'NavBar' && props.linkColor) {
      newProps.linkColor = lightenText(props.linkColor);
    }
    if (block.type === 'Divider' && props.lineColor) {
      // A light divider on a dark canvas disappears; lift its luminance.
      newProps.lineColor = lightenText(props.lineColor);
    }
    out[id] = { ...block, data: { ...data, style: newStyle, props: newProps } };
  }
  return out;
}

// Track which Google fonts are actually referenced by the document so the
// exported email only loads the families it needs (the canvas preview can
// load all of them eagerly, but the email should be lean).
function collectUsedFontFamilies(doc) {
  const used = new Set();
  Object.values(doc || {}).forEach(block => {
    const sf = block?.data?.style?.fontFamily;
    if (sf) used.add(sf);
    const df = block?.data?.fontFamily;
    if (df) used.add(df);
  });
  return used;
}

// Apply a (possibly-gradient) background value to an inline style object.
// Solids go to `background-color`; gradients set both `background-image`
// (for modern clients) and a first-stop `background-color` (so legacy
// clients still get a sensible fallback color).
function applyBgColor(s, value) {
  if (!value) return;
  if (isGradient(value)) {
    s['background-color'] = firstStopColor(value);
    s['background-image'] = value;
  } else {
    s['background-color'] = value;
  }
}

// Build per-side `border-top`/`-right`/`-bottom`/`-left` shorthand entries
// for inline CSS. Returns null when no sides are configured so the caller
// can fall back to the legacy uniform `border:` shorthand. null sides
// emit no property at all → that edge stays without a border.
function perSideBorderCss(borderSides) {
  if (!borderSides || !Object.values(borderSides).some(Boolean)) return null;
  const out = {};
  const side = (k) => borderSides[k];
  if (side('top'))    out['border-top']    = `${side('top').width || 1}px ${side('top').style || 'solid'} ${side('top').color || '#3A485F'}`;
  if (side('right'))  out['border-right']  = `${side('right').width || 1}px ${side('right').style || 'solid'} ${side('right').color || '#3A485F'}`;
  if (side('bottom')) out['border-bottom'] = `${side('bottom').width || 1}px ${side('bottom').style || 'solid'} ${side('bottom').color || '#3A485F'}`;
  if (side('left'))   out['border-left']   = `${side('left').width || 1}px ${side('left').style || 'solid'} ${side('left').color || '#3A485F'}`;
  return out;
}

// Format a backgroundImage value for inline CSS. CSS gradient functions
// (linear-gradient / radial-gradient / conic-gradient and their repeating
// variants) must be emitted verbatim — wrapping them in url(...) produces
// invalid CSS that mail clients reject, often discarding the surrounding
// background-color fallback too (which is why a gradient header was showing
// white-on-white in the actual sent email). URLs / paths still get wrapped.
function formatBackgroundImage(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (/^(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i.test(trimmed)) {
    return trimmed;
  }
  // Strip an existing url() wrapper if present so we don't double-wrap.
  if (/^url\s*\(/i.test(trimmed)) return trimmed;
  return `url(${trimmed})`;
}

function pad(p) {
  if (!p) return '';
  return `${p.top || 0}px ${p.right || 0}px ${p.bottom || 0}px ${p.left || 0}px`;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(s) {
  return esc(s).replace(/\n/g, '<br/>');
}

function styleStr(obj) {
  // The serialised string lives inside a double-quoted `style="…"` HTML
  // attribute, so values that contain literal `"` (e.g. font stacks like
  // 'Inter', "Segoe UI', sans-serif) would prematurely close the attribute.
  // Swap any `"` for `'` — equivalent in CSS and safe inside attributes.
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${String(v).replace(/"/g, "'")}`)
    .join(';');
}

function renderBlock(doc, id) {
  const block = doc[id];
  if (!block) return '';
  const { type, data } = block;
  const props = data?.props || {};
  const style = data?.style || {};
  const padding = pad(style.padding);

  switch (type) {
    case 'Heading':
    case 'Text': {
      // Text supports list-style — bullet/number — by splitting on newlines.
      const listStyle = type === 'Text' ? props.listStyle : null;
      const isList = listStyle === 'bullet' || listStyle === 'number';
      const tag = isList
        ? (listStyle === 'number' ? 'ol' : 'ul')
        : (type === 'Heading' ? (props.level || 'h2') : 'p');
      // Gradient text: modern clients (Apple Mail, iOS Mail, recent Gmail
      // webmail) support background-clip: text. Legacy clients ignore the
      // clip and fall back to the first stop's solid color via `color:`.
      const textGradient = isGradient(style.color);
      const textColor = textGradient ? firstStopColor(style.color) : (style.color || 'inherit');
      // Background: gradients render via background-image (the existing
      // formatBackgroundImage path). Solids use background-color.
      const bgIsGradient = isGradient(style.backgroundColor);
      const s = {
        margin: '0',
        padding,
        color: textColor,
        'font-size': `${style.fontSize || (type === 'Heading' ? 24 : 14)}px`,
        'font-weight': style.fontWeight || (type === 'Heading' ? 'bold' : 'normal'),
        'text-align': style.blockAlign || style.textAlign || 'left',
        'font-family': style.fontFamily ? getFontStack(style.fontFamily) : 'inherit',
        'line-height': style.lineHeight ? String(style.lineHeight) : '1.5',
      };
      if (textGradient) {
        s['background-image'] = style.color;
        s['-webkit-background-clip'] = 'text';
        s['background-clip'] = 'text';
        s['-webkit-text-fill-color'] = 'transparent';
      }
      if (style.fontStyle) s['font-style'] = style.fontStyle;
      if (style.textDecoration) s['text-decoration'] = style.textDecoration;
      if (style.letterSpacing !== undefined && style.letterSpacing !== null && style.letterSpacing !== '') {
        if (typeof style.letterSpacing === 'string' && style.letterSpacing.endsWith('%')) {
          const num = parseFloat(style.letterSpacing);
          if (!Number.isNaN(num)) s['letter-spacing'] = `${num / 100}em`;
        } else if (typeof style.letterSpacing === 'number') {
          s['letter-spacing'] = `${style.letterSpacing}px`;
        } else {
          s['letter-spacing'] = String(style.letterSpacing);
        }
      }
      if (style.textTransform) s['text-transform'] = style.textTransform;
      if (style.backgroundColor && !bgIsGradient) s['background-color'] = style.backgroundColor;
      if (bgIsGradient) {
        s['background-color'] = firstStopColor(style.backgroundColor);
        s['background-image'] = style.backgroundColor;
      }
      // Border — per-side wins over the uniform shorthand when present.
      const perSideText = perSideBorderCss(style.borderSides);
      if (perSideText) {
        Object.assign(s, perSideText);
      } else if (style.borderWidth) {
        s.border = `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor || '#3A485F'}`;
      }
      if (style.borderRadius) s['border-radius'] = `${style.borderRadius}px`;
      if (isList) s['list-style-position'] = 'inside';
      // Body content. props.text is now an HTML string (so inline formatting
      // from the floating SelectionToolbar — <strong>/<em>/<u>/<s>/<code>/<a>
      // — round-trips correctly). For non-lists we just convert bare newlines
      // to <br>; for lists we split lines and wrap each in an <li> without
      // escaping (lines may contain their own inline tags).
      let body;
      if (isList) {
        const items = (props.text || '').split(/\n/).filter(l => l.trim() !== '');
        body = items.map(line => `<li>${line}</li>`).join('');
      } else {
        body = (props.text || '').replace(/\n/g, '<br/>');
      }
      // Link wrap — if linkHref is set, wrap the inner content in an <a>.
      // Render the anchor inside the tag so semantics + inheritance hold.
      if (props.linkHref) {
        const target = props.linkOpenInNewTab === false ? '' : ' target="_blank"';
        body = `<a href="${esc(props.linkHref)}"${target} style="color:inherit;text-decoration:underline">${body}</a>`;
      }
      return `<${tag} style="${styleStr(s)}">${body}</${tag}>`;
    }

    case 'Button': {
      const sizeStyles = {
        'x-small': { padding: '6px 12px', fontSize: 12 },
        small: { padding: '8px 16px', fontSize: 13 },
        medium: { padding: '12px 20px', fontSize: 14 },
        large: { padding: '14px 28px', fontSize: 16 },
      };
      const presetRadius = { rectangle: 0, rounded: 6, pill: 9999 };
      const sz = sizeStyles[props.size || 'medium'] || sizeStyles.medium;
      const radius = style.borderRadius ?? presetRadius[props.buttonStyle || 'rectangle'] ?? 0;
      const border = props.borderWidth ? `${props.borderWidth}px solid ${props.borderColor || 'transparent'}` : 'none';
      const wrapS = { margin: '0', padding, 'text-align': style.blockAlign || style.textAlign || 'center' };
      const btnS = {
        display: 'inline-block',
        padding: sz.padding,
        'background-color': props.buttonBackgroundColor || '#7C5CFA',
        color: props.buttonTextColor || '#fff',
        'border-radius': `${radius}px`,
        'text-decoration': 'none',
        'font-weight': '600',
        'font-size': `${sz.fontSize}px`,
        'font-family': 'inherit',
        border,
        'mso-padding-alt': '0',
      };
      return `<div style="${styleStr(wrapS)}"><a href="${esc(props.url || '#')}" target="_blank" style="${styleStr(btnS)}">${esc(props.text || 'Button')}</a></div>`;
    }

    case 'Image': {
      const align = style.blockAlign || style.textAlign || 'center';
      const wrapS = {
        margin: '0',
        padding,
        'text-align': align,
      };
      applyBgColor(wrapS, style.backgroundColor);
      const width = props.width ?? '100%';
      const isFixedPx = typeof width === 'number';
      const widthAttr = isFixedPx ? `${width}` : width.replace('%', '');
      const imgS = {
        display: 'block',
        width: isFixedPx ? `${width}px` : width,
        'max-width': '100%',
        height: 'auto',
        'border-radius': style.borderRadius ? `${style.borderRadius}px` : '',
        border: '0',
      };
      if (props.objectFit && props.objectFit !== 'fill') imgS['object-fit'] = props.objectFit;
      if (props.objectPosition && props.objectPosition !== 'center') imgS['object-position'] = props.objectPosition;
      if (props.height) imgS.height = typeof props.height === 'number' ? `${props.height}px` : props.height;
      if (isFixedPx && align === 'center') {
        imgS['margin-left'] = 'auto';
        imgS['margin-right'] = 'auto';
      } else if (isFixedPx && align === 'right') {
        imgS['margin-left'] = 'auto';
        imgS['margin-right'] = '0';
      }
      if (!props.url && !props.svgRaw) {
        return `<div style="${styleStr(wrapS)}"><div style="padding:24px;border:1px dashed #CED4DD;border-radius:8px;color:#9CA3AF;font-size:12px">No image</div></div>`;
      }
      const linkOpen = props.linkHref ? `<a href="${esc(props.linkHref)}" target="_blank">` : '';
      const linkClose = props.linkHref ? '</a>' : '';
      // SVG tint path: substitute fills inline so modern email clients
      // (Apple Mail, iOS Mail, Gmail web) render the recolored icon. Older
      // clients that strip inline <svg> fall back to the original URL.
      if (props.svgRaw && props.tintColor) {
        const svgInner = tintSvgMarkup(props.svgRaw, props.tintColor);
        return `<div style="${styleStr(wrapS)}">${linkOpen}<span style="${styleStr(imgS)};display:inline-block;line-height:0">${svgInner}</span>${linkClose}</div>`;
      }
      const fixedClass = isFixedPx ? ' class="img-fixed"' : '';
      return `<div style="${styleStr(wrapS)}">${linkOpen}<img src="${esc(props.url)}" alt="${esc(props.alt || '')}" width="${widthAttr}"${fixedClass} style="${styleStr(imgS)}" />${linkClose}</div>`;
    }

    case 'Avatar': {
      const size = props.size || 64;
      const radius = props.shape === 'circle' ? '50%' : props.shape === 'rounded' ? '8px' : '0';
      const wrapS = { margin: '0', padding, 'text-align': style.blockAlign || style.textAlign || 'center' };
      const imgS = {
        width: `${size}px`,
        height: `${size}px`,
        'border-radius': radius,
        'object-fit': 'cover',
        display: 'inline-block',
      };
      return `<div style="${styleStr(wrapS)}"><img src="${esc(props.imageUrl || '')}" alt="${esc(props.alt || '')}" class="img-fixed" style="${styleStr(imgS)}" /></div>`;
    }

    case 'Divider': {
      const thickness = props.lineHeight || 1;
      const color = props.lineColor || '#E1E4EA';
      const lineStyle = props.lineStyle || 'solid';
      const endLeft = props.endLeft || 'none';
      const endRight = props.endRight || 'none';
      const orientation = props.orientation || 'horizontal';

      // Vertical divider: render a thin bar with an explicit height. Email
      // clients can't honour `height: 100%` on a free-standing div, so we
      // commit to a fixed pixel height (matches the canvas).
      if (orientation === 'vertical') {
        const h = props.height ?? 40;
        const vJustify = style.blockAlign === 'left' ? 'flex-start' : style.blockAlign === 'right' ? 'flex-end' : 'center';
        return `<div style="padding:${padding};display:flex;justify-content:${vJustify}"><div style="width:${thickness}px;height:${h}px;border-left:${thickness}px ${lineStyle} ${color}"></div></div>`;
      }

      if (endLeft !== 'none' || endRight !== 'none') {
        return `<div style="padding:${padding}">${buildDividerSvg(props)}</div>`;
      }
      const hrS = {
        width: '100%',
        border: 'none',
        'border-top': `${thickness}px ${lineStyle} ${color}`,
        margin: '0',
      };
      return `<div style="padding:${padding}"><hr style="${styleStr(hrS)}" /></div>`;
    }

    case 'Spacer': {
      const h = props.height || 16;
      return `<div style="height:${typeof h === 'number' ? h + 'px' : h};line-height:${typeof h === 'number' ? h + 'px' : h};font-size:1px">&nbsp;</div>`;
    }

    case 'Container': {
      const children = (props.childrenIds || []).map(cid => renderBlock(doc, cid)).join('');
      const perSideC = perSideBorderCss(style.borderSides);
      const s = {
        padding,
        'border-radius': style.borderRadius ? `${style.borderRadius}px` : '',
        // Container border — per-side overrides uniform when present.
        ...(perSideC || (style.borderWidth
          ? { border: `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor || '#3A485F'}` }
          : {})),
      };
      applyBgColor(s, style.backgroundColor);
      if (style.bgSvgRaw && style.bgTintColor) {
        // Inline-tinted SVG → data-URI background. Encoded so quotes
        // inside the SVG don't break the inline style.
        const tinted = tintSvgMarkup(style.bgSvgRaw, style.bgTintColor);
        s['background-image'] = `url("data:image/svg+xml;utf8,${encodeURIComponent(tinted)}")`;
        s['background-size'] = style.backgroundSize || 'contain';
        s['background-position'] = style.backgroundPosition || 'center';
        s['background-repeat'] = style.backgroundRepeat || 'no-repeat';
      } else if (style.backgroundImage) {
        s['background-image'] = formatBackgroundImage(style.backgroundImage);
        s['background-size'] = style.backgroundSize || 'cover';
        s['background-position'] = style.backgroundPosition || 'center';
        s['background-repeat'] = style.backgroundRepeat || 'no-repeat';
      }
      if (props.heightMode === 'fixed' && props.height) {
        s['height'] = typeof props.height === 'number' ? `${props.height}px` : props.height;
        s['overflow'] = 'hidden';
        // Same flex-position story as the canvas — modern clients honour
        // display:flex; older ones fall back to default block layout.
        s['display'] = 'flex';
        s['flex-direction'] = 'column';
        const vMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
        const hMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
        s['justify-content'] = vMap[props.contentAlign] || 'flex-start';
        s['align-items'] = hMap[props.contentAlignH] || 'stretch';
      }
      // Imported-HTML fidelity — preserve max-width centring and min-height
      // so sent emails match what the user sees in the builder canvas.
      if (style.maxWidth) {
        s['max-width'] = typeof style.maxWidth === 'number' ? `${style.maxWidth}px` : style.maxWidth;
        s['margin-left'] = 'auto';
        s['margin-right'] = 'auto';
      }
      if (style.minHeight) {
        s['min-height'] = typeof style.minHeight === 'number' ? `${style.minHeight}px` : style.minHeight;
      }
      return `<div style="${styleStr(s)}">${children}</div>`;
    }

    case 'ColumnsContainer': {
      const cols = props.columns || [];
      const count = props.columnsCount || cols.length || 2;
      const gap = props.columnsGap ?? 16;
      const rowGap = props.rowGap ?? 0;
      const direction = props.direction || 'row';
      const visible = cols.slice(0, count);
      const columnWidths = props.columnWidths || Array.from({ length: count }, () => Math.round(10000 / count) / 100);

      const wrapS = {
        padding,
        'border-radius': style.borderRadius ? `${style.borderRadius}px` : '',
      };
      const perSideCC = perSideBorderCss(style.borderSides);
      if (perSideCC) Object.assign(wrapS, perSideCC);
      else if (style.borderWidth) wrapS.border = `${style.borderWidth}px ${style.borderStyle || 'solid'} ${style.borderColor || '#3A485F'}`;
      applyBgColor(wrapS, style.backgroundColor);
      if (style.backgroundImage) {
        wrapS['background-image'] = `url(${style.backgroundImage})`;
        wrapS['background-size'] = style.backgroundSize || 'cover';
        wrapS['background-position'] = style.backgroundPosition || 'center';
        wrapS['background-repeat'] = style.backgroundRepeat || 'no-repeat';
      }

      // Direction = column → stack vertically (each column becomes a full-width
      // row). Direction = row → render as a horizontal table of cells.
      if (direction === 'column') {
        const rows = visible.map(col => {
          const children = (col.childrenIds || []).map(cid => renderBlock(doc, cid)).join('');
          const colAlign = col.align || 'left';
          const colValign = col.valign || 'top';
          const colPad = col.padding;
          const tdS = { 'padding-bottom': `${rowGap}px`, 'text-align': colAlign, 'vertical-align': colValign === 'middle' ? 'middle' : colValign === 'bottom' ? 'bottom' : 'top' };
          if (colPad) tdS.padding = `${colPad.top || 0}px ${colPad.right || 0}px ${colPad.bottom || 0}px ${colPad.left || 0}px`;
          if (col.backgroundColor) tdS['background-color'] = col.backgroundColor;
          const cHeight = col.heightMode || 'hug';
          if (cHeight === 'fill') tdS.height = '100%';
          else if (cHeight === 'custom' && col.customHeight) tdS.height = typeof col.customHeight === 'number' ? `${col.customHeight}px` : col.customHeight;
          return `<tr><td style="${styleStr(tdS)}">${children || '&nbsp;'}</td></tr>`;
        }).join('');
        return `<div style="${styleStr(wrapS)}"><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">${rows}</table></div>`;
      }

      let colsHtml = visible.map((col, idx) => {
        const children = (col.childrenIds || []).map(cid => renderBlock(doc, cid)).join('');
        const w = columnWidths[idx] || (100 / count);
        const colAlign = col.align || 'left';
        const colValign = col.valign || 'top';
        const colPad = col.padding;
        const tdS = {
          width: `${Math.round(w)}%`,
          'vertical-align': colValign === 'middle' ? 'middle' : colValign === 'bottom' ? 'bottom' : 'top',
          'text-align': colAlign,
          'padding-right': idx < visible.length - 1 ? `${gap}px` : '0',
        };
        if (colPad) tdS.padding = `${colPad.top || 0}px ${colPad.right || 0}px ${colPad.bottom || 0}px ${colPad.left || 0}px`;
        if (col.backgroundColor) tdS['background-color'] = col.backgroundColor;
        const cHeight = col.heightMode || 'hug';
        if (cHeight === 'fill') tdS.height = '100%';
        else if (cHeight === 'custom' && col.customHeight) tdS.height = typeof col.customHeight === 'number' ? `${col.customHeight}px` : col.customHeight;
        return `<td style="${styleStr(tdS)}">${children || '&nbsp;'}</td>`;
      }).join('');

      return `<div style="${styleStr(wrapS)}"><table class="cols-table" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>${colsHtml}</tr></table></div>`;
    }

    case 'Social': {
      const platforms = props.platforms || [];
      const iconSize = props.iconSize || 24;
      const gap = props.gap || 16;
      const alignment = props.alignment || 'center';
      const align = style.blockAlign || (alignment === 'left' ? 'left' : alignment === 'right' ? 'right' : 'center');
      const wrapS = { padding, 'text-align': align, 'background-color': style.backgroundColor || '' };

      const icons = platforms.map(p => {
        if (!p.iconUrl) return '';
        const imgS = { display: 'inline-block', width: `${iconSize}px`, height: `${iconSize}px`, border: '0' };
        return `<a href="${esc(p.url || '#')}" target="_blank" title="${esc(p.label)}" style="display:inline-block;margin:0 ${gap / 2}px;text-decoration:none"><img src="${esc(p.iconUrl)}" alt="${esc(p.label)}" style="${styleStr(imgS)}" width="${iconSize}" height="${iconSize}" /></a>`;
      }).join('');
      return `<div style="${styleStr(wrapS)}">${icons}</div>`;
    }

    case 'NavBar': {
      const links = props.links || [];
      const gap = props.gap || 24;
      const alignment = props.alignment || 'center';
      const linkColor = props.linkColor || '#7C5CFA';
      const fontSize = props.fontSize || 14;
      const fontWeight = props.fontWeight || 'bold';
      const align = style.blockAlign || (alignment === 'left' ? 'left' : alignment === 'right' ? 'right' : 'center');
      const wrapS = { padding, 'text-align': align, 'background-color': style.backgroundColor || '' };
      const linkS = {
        color: linkColor,
        'font-size': `${fontSize}px`,
        'font-weight': fontWeight,
        'text-decoration': 'none',
        'font-family': 'inherit',
      };

      const linkHtml = links.map((link, i) => {
        const spacer = i < links.length - 1 ? `<span style="display:inline-block;width:${gap}px"></span>` : '';
        return `<a href="${esc(link.url || '#')}" target="_blank" style="${styleStr(linkS)}">${esc(link.label)}</a>${spacer}`;
      }).join('');
      return `<div style="${styleStr(wrapS)}">${linkHtml}</div>`;
    }

    case 'Table': {
      const columns = props.columns || [];
      const rows = props.rows || [];
      const headerBg = props.headerBg || '#7C5CFA';
      const headerColor = props.headerColor || '#fff';
      const borderColor = props.borderColor || '#E1E4EA';
      const stripedRows = props.stripedRows;
      const stripedColor = props.stripedColor || '#F6F4FF';

      const cellS = `padding:8px 12px;border:1px solid ${borderColor};font-size:${style.fontSize || 13}px;font-family:inherit`;
      const headerS = `${cellS};background-color:${headerBg};color:${headerColor};font-weight:600`;

      let thead = '<tr>' + columns.map(c => `<th style="${headerS}">${esc(c.header)}</th>`).join('') + '</tr>';
      let tbody = rows.map((row, ri) => {
        const bg = stripedRows && ri % 2 === 1 ? `background-color:${stripedColor};` : '';
        return '<tr>' + columns.map(c => `<td style="${cellS};${bg}">${esc(row[c.key] || '')}</td>`).join('') + '</tr>';
      }).join('');

      const tableAlign = style.blockAlign ? `text-align:${style.blockAlign};` : '';
      return `<div style="padding:${padding};overflow-x:auto;${tableAlign}"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
    }

    default:
      return '';
  }
}

function buildDividerSvg(props) {
  const thickness = props.lineHeight || 1;
  const color = props.lineColor || '#E1E4EA';
  const lineStyle = props.lineStyle || 'solid';
  const endLeft = props.endLeft || 'none';
  const endRight = props.endRight || 'none';
  const markerSize = Math.max(8, thickness * 4);
  const pad = markerSize / 2 + 2;
  const svgH = Math.max(markerSize + 4, thickness + 8);
  const midY = svgH / 2;

  let defs = '';
  if (endLeft === 'circle' || endRight === 'circle') {
    defs += `<circle id="circ" r="${markerSize / 2}" fill="${color}"/>`;
  }
  if (endLeft === 'arrow' || endRight === 'arrow') {
    const aw = markerSize;
    const ah = markerSize;
    defs += `<polygon id="arrowL" points="0,${ah / 2} ${aw},0 ${aw},${ah}" fill="${color}"/>`;
    defs += `<polygon id="arrowR" points="${aw},${ah / 2} 0,0 0,${ah}" fill="${color}"/>`;
  }

  const dash = lineStyle === 'dashed' ? ` stroke-dasharray="${Math.max(6, thickness * 4)} ${Math.max(4, thickness * 3)}"` : '';

  let markers = '';
  if (endLeft === 'circle') markers += `<use href="#circ" x="${pad}" y="${midY}"/>`;
  if (endLeft === 'arrow') markers += `<use href="#arrowL" x="2" y="${midY - markerSize / 2}"/>`;
  if (endRight === 'circle') markers += `<use href="#circ" x="100%" y="${midY}" transform="translate(-${pad}, 0)"/>`;
  if (endRight === 'arrow') markers += `<use href="#arrowR" x="100%" y="${midY - markerSize / 2}" transform="translate(-${pad + markerSize}, 0)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${svgH}" style="display:block">
    ${defs ? `<defs>${defs}</defs>` : ''}
    <line x1="${pad}" y1="${midY}" x2="99%" y2="${midY}" stroke="${color}" stroke-width="${thickness}"${dash}/>
    ${markers}
  </svg>`;
}

// Options:
//   wrapperPadding — outer table-cell padding around the email body; pass '0'
//     for thumbnail previews so the email sits flush. Default '24px 0'.
//   theme — 'auto' | 'light' | 'dark'. When 'dark', simulates how a device
//     in dark mode renders the email: page backdrop flips to a dark grey,
//     the html element advertises color-scheme: dark so client/system text
//     defaults pick up correctly, and a @media (prefers-color-scheme: dark)
//     rule echoes the override. The email content itself (gradient headers,
//     branded colors) stays untouched — most dark-mode-aware clients leave
//     in-content colors alone and just darken the surrounding chrome.
export function renderEmailHtml(doc, { wrapperPadding = '24px 0', theme = 'auto' } = {}) {
  if (!doc) return '';
  // Custom HTML body takes over ONLY when there are no parsed blocks —
  // mirrors the canvas precedence in PreviewCanvas so block edits never
  // diverge from the exported HTML at send time.
  const hasBlocks = (doc.root?.data?.childrenIds?.length ?? 0) > 0;
  if (doc.root?.data?.customHtml && !hasBlocks) return doc.root.data.customHtml;
  // In dark mode, pre-transform every block in the document so individual
  // backgrounds / text colors invert too — not just the outer backdrop.
  // Vivid brand colors (gradient header, promo banner) pass through.
  const effectiveDoc = theme === 'dark' ? transformDocForDarkMode(doc) : doc;
  const root = effectiveDoc.root;
  if (!root) return '';

  const isDark = theme === 'dark';
  const backdropColor = root.data?.backdropColor || (isDark ? '#0F1115' : '#F2EEFE');
  const canvasColor = root.data?.canvasColor || (isDark ? '#16181D' : '#FFFFFF');
  const textColor = root.data?.textColor || (isDark ? '#E4E5EE' : '#3A485F');
  const fontFamily = getFontStack(root.data?.fontFamily);
  const childrenIds = root.data?.childrenIds || [];

  // Use effectiveDoc (the dark-mode-transformed copy when theme === 'dark')
  // so child blocks render with their flipped backgrounds / text colors.
  const bodyContent = childrenIds.map(cid => renderBlock(effectiveDoc, cid)).join('');
  const colorScheme = theme === 'auto' ? 'light dark' : theme;

  // Build a lean Google Fonts <link> covering only the families this email
  // actually references — keeps the email payload small and avoids loading
  // 30+ fonts every recipient doesn't need.
  const usedFontValues = collectUsedFontFamilies(effectiveDoc);
  const usedFamilies = [...usedFontValues]
    .map(v => resolveFont(v))
    .filter(f => f && f.googleFamily)
    .map(f => `family=${f.googleFamily}`)
    .filter((v, i, a) => a.indexOf(v) === i);
  const googleFontsLink = usedFamilies.length
    ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${usedFamilies.join('&')}&display=swap"/>`
    : '';

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" style="color-scheme: ${colorScheme}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="color-scheme" content="${colorScheme}"/>
<meta name="supported-color-schemes" content="${colorScheme}"/>
<title>Email</title>
${googleFontsLink}
<style>
  :root { color-scheme: ${colorScheme}; }
  body, table, td, p, a, h1, h2, h3 { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; max-width: 100%; height: auto; }
  body { margin: 0; padding: 0; width: 100% !important; }
  a { color: inherit; }
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; max-width: 100% !important; }
    .email-container img:not(.img-fixed) { width: 100% !important; height: auto !important; }
    .email-container img.img-fixed { max-width: 100% !important; height: auto !important; }
    .cols-table td { display: block !important; width: 100% !important; padding-right: 0 !important; padding-bottom: 16px !important; }
    .cols-table td:last-child { padding-bottom: 0 !important; }
  }
</style>
<!--[if mso]>
<style>body, table, td { font-family: Arial, Helvetica, sans-serif !important; }</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${backdropColor};font-family:${fontFamily.replace(/"/g, "'")};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${backdropColor}">
<tr><td align="center" style="padding:${wrapperPadding}">
  <table role="presentation" class="email-container" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:${canvasColor};color:${textColor};font-family:${fontFamily.replace(/"/g, "'")};">
  <tr><td>
    ${bodyContent}
  </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
