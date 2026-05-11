import { renderToStaticMarkup } from '@usewaypoint/email-builder';

function collectBlocks(doc) {
  const blocks = [];
  function walk(id) {
    const block = id === 'root' ? doc.root : doc[id];
    if (!block) return;
    const type = block.type;
    const props = block.data?.props || {};
    const style = block.data?.style || {};
    blocks.push({ id, type, props, style });
    if (type === 'EmailLayout') {
      (block.data?.childrenIds || []).forEach(walk);
    } else if (type === 'Container') {
      (props.childrenIds || []).forEach(walk);
    } else if (type === 'ColumnsContainer') {
      (props.columns || []).forEach(col => (col.childrenIds || []).forEach(walk));
    }
  }
  walk('root');
  return blocks;
}

function injectStyle(el, prop, val) {
  const cur = el.getAttribute('style') || '';
  const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
  el.setAttribute('style', `${cur}; ${kebab}: ${val}`);
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
  let body = `<line x1="${pad}" y1="${midY}" x2="calc(100% - ${pad}px)" y2="${midY}" stroke="${color}" stroke-width="${thickness}"${dash}/>`;
  // SVG calc() doesn't work everywhere — use 100% with viewBox trick
  // Actually, use a rect instead for reliability
  body = '';

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
  let html;
  try {
    html = renderToStaticMarkup(doc, { rootBlockId: 'root' });
  } catch {
    return '<html><body><p style="padding:24px;color:#999;">Could not render preview.</p></body></html>';
  }

  const blocks = collectBlocks(doc);
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');

  const containers = blocks.filter(b => b.type === 'Container');
  const containerDivs = [];
  // Library renders containers as plain <div> with backgroundColor set.
  // The email layout wraps everything in a <table> inside a backdrop <div>.
  // Containers are direct children of <td> inside that table.
  const tds = parsed.querySelectorAll('td');
  for (const td of tds) {
    for (const child of td.children) {
      if (child.tagName === 'DIV') {
        const bg = child.style.backgroundColor;
        const border = child.style.border;
        const radius = child.style.borderRadius;
        const padding = child.style.padding;
        // A container div typically has some of: backgroundColor, border, borderRadius, padding
        // Distinguish from button wrappers (which also have textAlign) and divider wrappers
        // A container div will contain child elements, not just an <hr> or an <a>
        if (child.children.length > 0 && child.querySelector('div, table, img, a, hr, p')) {
          containerDivs.push(child);
        }
      }
    }
  }

  // Match containers by order and inject background images
  containers.forEach((block, i) => {
    const bgImg = block.style.backgroundImage;
    if (!bgImg || !containerDivs[i]) return;
    const el = containerDivs[i];
    injectStyle(el, 'backgroundImage', `url(${bgImg})`);
    injectStyle(el, 'backgroundSize', block.style.backgroundSize || 'cover');
    injectStyle(el, 'backgroundPosition', block.style.backgroundPosition || 'center');
    injectStyle(el, 'backgroundRepeat', block.style.backgroundRepeat || 'no-repeat');
  });

  // Patch ColumnsContainer background images
  const colsContainers = blocks.filter(b => b.type === 'ColumnsContainer');
  const colsDivs = [];
  for (const td of tds) {
    for (const child of td.children) {
      if (child.tagName === 'DIV' && child.querySelector('table[align="center"]')) {
        colsDivs.push(child);
      }
    }
  }
  colsContainers.forEach((block, i) => {
    const bgImg = block.style.backgroundImage;
    if (!bgImg || !colsDivs[i]) return;
    const el = colsDivs[i];
    injectStyle(el, 'backgroundImage', `url(${bgImg})`);
    injectStyle(el, 'backgroundSize', block.style.backgroundSize || 'cover');
    injectStyle(el, 'backgroundPosition', block.style.backgroundPosition || 'center');
    injectStyle(el, 'backgroundRepeat', block.style.backgroundRepeat || 'no-repeat');
  });

  // Patch Button borders
  const buttons = blocks.filter(b => b.type === 'Button');
  const linkEls = parsed.querySelectorAll('a[href]');
  const buttonLinks = Array.from(linkEls).filter(a => {
    const s = a.style;
    return s.backgroundColor && (s.borderRadius !== undefined || s.padding) && s.textDecoration === 'none';
  });
  buttons.forEach((block, i) => {
    const bw = block.props.borderWidth;
    const bc = block.props.borderColor;
    if (!bw || !buttonLinks[i]) return;
    injectStyle(buttonLinks[i], 'border', `${bw}px solid ${bc || 'transparent'}`);
  });

  // Patch Divider styles (dashed + endpoints)
  const dividers = blocks.filter(b => b.type === 'Divider');
  const hrEls = parsed.querySelectorAll('hr');
  dividers.forEach((block, i) => {
    const lineStyle = block.props.lineStyle || 'solid';
    const endLeft = block.props.endLeft || 'none';
    const endRight = block.props.endRight || 'none';
    const hr = hrEls[i];
    if (!hr) return;

    if (lineStyle === 'dashed') {
      hr.style.borderTopStyle = 'dashed';
    }

    if (endLeft !== 'none' || endRight !== 'none') {
      const wrapper = hr.parentElement;
      if (wrapper) {
        const svg = buildDividerSvg(block.props);
        hr.remove();
        wrapper.innerHTML = svg;
      }
    }
  });

  return '<!DOCTYPE html>' + parsed.documentElement.outerHTML;
}
