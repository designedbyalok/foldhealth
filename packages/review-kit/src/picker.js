// DevTools-style element picker: a highlight box and a label follow the
// pointer; a click picks the element under it, Escape cancels. Everything the
// kit renders carries `data-review-kit`, so it can't pick itself and
// screenshots leave it out.

export const KIT_ATTR = 'data-review-kit';

/** Short, readable name for an element: tag#id or tag.class.class */
export function describeElement(el) {
  if (!el?.tagName) return '';
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const classes = [...el.classList].slice(0, 2).map(readableClass);
  return classes.length ? `${tag}.${classes.join('.')}` : tag;
}

// CSS Modules names look like `_welcomeCard_ezgld_180`; show `welcomeCard`.
function readableClass(name) {
  const m = /^_?([A-Za-z][\w-]*?)_[a-z0-9]{5}(?:_\d+)?$/.exec(name);
  return m ? m[1] : name;
}

/**
 * Let the user pick an element on the page.
 * @param {object} [options]
 * @param {(el: Element) => boolean} [options.ignore] extra elements to skip
 * @param {string} [options.hint] instruction shown while picking
 * @param {object} [options.style] CSS variables to apply to the overlay (the box's theme)
 * @returns {Promise<Element|null>} the picked element, or null if cancelled
 */
export function pickElement({ ignore, hint = 'Click or press Enter to capture. ↑ parent · ↓ child · Esc to cancel', style } = {}) {
  return new Promise((resolve) => {
    const make = (className, text) => {
      const node = document.createElement('div');
      node.className = className;
      node.setAttribute(KIT_ATTR, '');
      if (style) Object.entries(style).forEach(([k, v]) => node.style.setProperty(k, v));
      if (text) node.textContent = text;
      document.body.appendChild(node);
      return node;
    };
    const box = make('rk-pick-box');
    const label = make('rk-pick-label');
    const banner = make('rk-pick-hint', hint);
    document.documentElement.classList.add('rk-picking');

    let current = null;
    let lastPoint = null;
    // Set when ↑/↓ moved the selection; small pointer jitter shouldn't undo it.
    let keyboardFrom = null;

    const skip = (el) => !el
      || el === document.documentElement
      || el === document.body
      || el.closest(`[${KIT_ATTR}]`)
      || (ignore && ignore(el));

    const draw = () => {
      if (!current) {
        box.style.display = 'none';
        label.style.display = 'none';
        return;
      }
      const r = current.getBoundingClientRect();
      box.style.display = 'block';
      box.style.transform = `translate(${r.left}px, ${r.top}px)`;
      box.style.width = `${r.width}px`;
      box.style.height = `${r.height}px`;
      label.textContent = `${describeElement(current)}  ${Math.round(r.width)} × ${Math.round(r.height)}`;
      label.style.display = 'block';
      const above = r.top - label.offsetHeight - 4;
      label.style.transform = `translate(${Math.max(4, r.left)}px, ${above >= 4 ? above : r.bottom + 4}px)`;
    };

    const onMove = (e) => {
      if (keyboardFrom && Math.hypot(e.clientX - keyboardFrom[0], e.clientY - keyboardFrom[1]) < 6) return;
      keyboardFrom = null;
      lastPoint = [e.clientX, e.clientY];
      const el = document.elementFromPoint(e.clientX, e.clientY);
      current = skip(el) ? null : el;
      draw();
    };
    const onScroll = () => {
      if (keyboardFrom) { draw(); return; }
      if (lastPoint) onMove({ clientX: lastPoint[0], clientY: lastPoint[1] });
    };

    // ↑ selects the parent; ↓ the child under the pointer (or the first child).
    const step = (direction) => {
      if (!current) return;
      let next;
      if (direction === 'up') {
        next = current.parentElement;
        if (skip(next)) return;
      } else {
        const kids = [...current.children].filter(k => !skip(k) && k.getBoundingClientRect().width > 0);
        const [x, y] = lastPoint || [];
        next = kids.find(k => {
          const r = k.getBoundingClientRect();
          return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        }) || kids[0];
        if (!next) return;
      }
      current = next;
      keyboardFrom = lastPoint;
      draw();
    };
    const swallow = (e) => {
      if (e.target.closest?.(`[${KIT_ATTR}]`)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onClick = (e) => {
      if (e.target.closest?.(`[${KIT_ATTR}]`)) return;
      swallow(e);
      finish(current);
    };
    const onKey = (e) => {
      const handled = { Escape: () => finish(null), Enter: () => finish(current), ArrowUp: () => step('up'), ArrowDown: () => step('down') }[e.key];
      if (!handled) return;
      e.preventDefault();
      e.stopPropagation();
      handled();
    };

    const listeners = [
      ['mousemove', onMove],
      ['pointerdown', swallow],
      ['mousedown', swallow],
      ['pointerup', swallow],
      ['mouseup', swallow],
      ['click', onClick],
      ['keydown', onKey],
      ['scroll', onScroll],
    ];
    listeners.forEach(([type, fn]) => window.addEventListener(type, fn, true));

    function finish(el) {
      listeners.forEach(([type, fn]) => window.removeEventListener(type, fn, true));
      box.remove();
      label.remove();
      banner.remove();
      document.documentElement.classList.remove('rk-picking');
      resolve(el);
    }
  });
}
