/* Finds a quoted passage among a PDF page's text items (pdf.js
   getTextContent), so the viewer can highlight the lines it came from.
   Matching ignores spacing, case and punctuation, since a quote that went
   through text extraction and an AI rarely keeps them exactly. When the whole
   passage isn't found, its longest leading part that is (down to a few words)
   is used. Plain JS. */

const MIN_MATCH = 12;
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * The indexes of the text items that hold `passage`, in page order, or []
 * when nothing long enough matches.
 */
export function findPassageItems(items, passage) {
  const wanted = norm(passage);
  if (wanted.length < MIN_MATCH || !Array.isArray(items)) return [];
  let text = '';
  const owner = [];
  items.forEach((item, i) => {
    const n = norm(item?.str);
    text += n;
    for (let k = 0; k < n.length; k += 1) owner.push(i);
  });

  let start = -1;
  let len = wanted.length;
  while (len >= MIN_MATCH) {
    start = text.indexOf(wanted.slice(0, len));
    if (start >= 0) break;
    len = Math.floor(len * 0.75);
  }
  if (start < 0) return [];
  return [...new Set(owner.slice(start, start + len))];
}
