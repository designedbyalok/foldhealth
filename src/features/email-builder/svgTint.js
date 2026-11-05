// Apply a tint color to inline SVG markup by replacing every fill= and
// stroke= attribute that isn't already "none" or "transparent" with the
// provided hex. Also adds a fill on the <svg> root if neither it nor its
// direct children declare one: covers icons that rely on `currentColor`.
//
// This is intentionally a regex pass (not a DOM parse) so it runs in the
// renderer's hot path without pulling DOMParser/serialization in. The
// substitution handles the common Solar/Heroicons/Feather output shape.
export function tintSvgMarkup(svgRaw, tintColor) {
  if (!svgRaw || !tintColor) return svgRaw || '';
  const fillRe = /fill="(?!none|transparent)([^"]*)"/g;
  const strokeRe = /stroke="(?!none|transparent)([^"]*)"/g;
  let out = svgRaw.replace(fillRe, `fill="${tintColor}"`).replace(strokeRe, `stroke="${tintColor}"`);
  // If the root <svg> has no fill, drop one in so currentColor-only icons
  // still pick up the tint.
  out = out.replace(/<svg(\s[^>]*)?>/i, (m, attrs = '') => {
    if (/\sfill=/.test(attrs)) return m;
    return `<svg${attrs} fill="${tintColor}">`;
  });
  return out;
}
