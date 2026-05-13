// Full custom email renderer — produces table-based HTML that matches
// the builder canvas exactly across all email clients.

const FONT_MAP = {
  MODERN_SANS: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  BOOK_SANS: "Helvetica, Arial, sans-serif",
  ORGANIC_SANS: "Verdana, Geneva, sans-serif",
  GEOMETRIC_SANS: "Tahoma, Geneva, sans-serif",
  HEAVY_SANS: "Arial, Helvetica, sans-serif",
  ROUNDED_SANS: "'Comic Sans MS', cursive, sans-serif",
  MODERN_SERIF: "Garamond, 'Times New Roman', serif",
  BOOK_SERIF: "Georgia, 'Times New Roman', serif",
  MONOSPACE: "'Courier New', Courier, monospace",
};

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
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
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
      const tag = type === 'Heading' ? (props.level || 'h2') : 'p';
      const s = {
        margin: '0',
        padding,
        color: style.color || 'inherit',
        'font-size': `${style.fontSize || (type === 'Heading' ? 24 : 14)}px`,
        'font-weight': style.fontWeight || (type === 'Heading' ? 'bold' : 'normal'),
        'text-align': style.textAlign || 'left',
        'font-family': FONT_MAP[style.fontFamily] || 'inherit',
        'line-height': style.lineHeight ? String(style.lineHeight) : '1.5',
      };
      if (style.fontStyle) s['font-style'] = style.fontStyle;
      if (style.textDecoration) s['text-decoration'] = style.textDecoration;
      if (style.letterSpacing) s['letter-spacing'] = `${style.letterSpacing}%`;
      return `<${tag} style="${styleStr(s)}">${nl2br(props.text || '')}</${tag}>`;
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
      const wrapS = { margin: '0', padding, 'text-align': style.textAlign || 'center' };
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
      const align = style.textAlign || 'center';
      const wrapS = {
        margin: '0',
        padding,
        'text-align': align,
        'background-color': style.backgroundColor || '',
      };
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
      if (isFixedPx && align === 'center') {
        imgS['margin-left'] = 'auto';
        imgS['margin-right'] = 'auto';
      } else if (isFixedPx && align === 'right') {
        imgS['margin-left'] = 'auto';
        imgS['margin-right'] = '0';
      }
      if (!props.url) {
        return `<div style="${styleStr(wrapS)}"><div style="padding:24px;border:1px dashed #CED4DD;border-radius:8px;color:#9CA3AF;font-size:12px">No image</div></div>`;
      }
      const linkOpen = props.linkHref ? `<a href="${esc(props.linkHref)}" target="_blank">` : '';
      const linkClose = props.linkHref ? '</a>' : '';
      const fixedClass = isFixedPx ? ' class="img-fixed"' : '';
      return `<div style="${styleStr(wrapS)}">${linkOpen}<img src="${esc(props.url)}" alt="${esc(props.alt || '')}" width="${widthAttr}"${fixedClass} style="${styleStr(imgS)}" />${linkClose}</div>`;
    }

    case 'Avatar': {
      const size = props.size || 64;
      const radius = props.shape === 'circle' ? '50%' : props.shape === 'rounded' ? '8px' : '0';
      const wrapS = { margin: '0', padding, 'text-align': style.textAlign || 'center' };
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
      const s = {
        padding,
        'background-color': style.backgroundColor || '',
        'border-radius': style.borderRadius ? `${style.borderRadius}px` : '',
      };
      if (style.backgroundImage) {
        s['background-image'] = `url(${style.backgroundImage})`;
        s['background-size'] = style.backgroundSize || 'cover';
        s['background-position'] = style.backgroundPosition || 'center';
        s['background-repeat'] = style.backgroundRepeat || 'no-repeat';
      }
      if (props.heightMode === 'fixed' && props.height) {
        s['height'] = typeof props.height === 'number' ? `${props.height}px` : props.height;
        s['overflow'] = 'hidden';
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
        'background-color': style.backgroundColor || '',
        'border-radius': style.borderRadius ? `${style.borderRadius}px` : '',
      };
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
          const tdS = { 'padding-bottom': `${rowGap}px` };
          return `<tr><td style="${styleStr(tdS)}">${children || '&nbsp;'}</td></tr>`;
        }).join('');
        return `<div style="${styleStr(wrapS)}"><table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">${rows}</table></div>`;
      }

      let colsHtml = visible.map((col, idx) => {
        const children = (col.childrenIds || []).map(cid => renderBlock(doc, cid)).join('');
        const w = columnWidths[idx] || (100 / count);
        const tdS = {
          width: `${Math.round(w)}%`,
          'vertical-align': 'top',
          'padding-right': idx < visible.length - 1 ? `${gap}px` : '0',
        };
        return `<td style="${styleStr(tdS)}">${children || '&nbsp;'}</td>`;
      }).join('');

      return `<div style="${styleStr(wrapS)}"><table class="cols-table" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>${colsHtml}</tr></table></div>`;
    }

    case 'Social': {
      const platforms = props.platforms || [];
      const iconSize = props.iconSize || 24;
      const gap = props.gap || 16;
      const alignment = props.alignment || 'center';
      const align = alignment === 'left' ? 'left' : alignment === 'right' ? 'right' : 'center';
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
      const align = alignment === 'left' ? 'left' : alignment === 'right' ? 'right' : 'center';
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

      return `<div style="padding:${padding};overflow-x:auto"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
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

export function renderEmailHtml(doc) {
  if (!doc) return '';
  const root = doc.root;
  if (!root) return '';

  const backdropColor = root.data?.backdropColor || '#F2EEFE';
  const canvasColor = root.data?.canvasColor || '#FFFFFF';
  const textColor = root.data?.textColor || '#3A485F';
  const fontFamily = FONT_MAP[root.data?.fontFamily] || FONT_MAP.MODERN_SANS;
  const childrenIds = root.data?.childrenIds || [];

  const bodyContent = childrenIds.map(cid => renderBlock(doc, cid)).join('');

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>Email</title>
<style>
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
<body style="margin:0;padding:0;background-color:${backdropColor};font-family:${fontFamily};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${backdropColor}">
<tr><td align="center" style="padding:24px 0">
  <table role="presentation" class="email-container" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:${canvasColor};color:${textColor};font-family:${fontFamily};">
  <tr><td>
    ${bodyContent}
  </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
