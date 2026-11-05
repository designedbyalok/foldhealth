import { PDFDocument, StandardFonts, grayscale, rgb } from 'pdf-lib';

// Where the bundled sample fax prints the patient's name (page 1, PDF points),
// and the cell's fill.
// Faxes don't carry real files yet, so each one shows the sample with the
// name it was read as written in, highlighted.
const NAME_SLOT = { x: 128.4, y: 658.3, width: 128.5, size: 8.5 };

const tokenRgb = (token) => {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(token).trim().replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex.slice(0, 6), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** An object URL for the fax at `src` with `name` in the patient name field, highlighted. Revoke it when done. */
export async function faxWithName(src, name, title) {
  const doc = await PDFDocument.load(await fetch(src).then(r => r.arrayBuffer()));
  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const { x, y, width, size } = NAME_SLOT;
  const box = { y: y - 2.5, height: size + 4 };
  page.drawRectangle({ x: x - 1, width: width + 2, ...box, color: grayscale(245 / 255) });
  page.drawRectangle({ x: x - 2, width: font.widthOfTextAtSize(name, size) + 4, ...box, color: tokenRgb('--accent-amber'), opacity: 0.35 });
  page.drawText(name, { x, y, size, font, color: grayscale(0) });
  if (title) doc.setTitle(title);
  return URL.createObjectURL(new Blob([await doc.save()], { type: 'application/pdf' }));
}
