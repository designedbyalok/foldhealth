/* ── xlsxLite ──
   Dependency-free .xlsx reader. An .xlsx is a ZIP of XML parts; we read the
   ZIP central directory, inflate the needed parts with the browser-native
   DecompressionStream('deflate-raw'), then extract cell values from the first
   worksheet. Returns rows as string[][] (same shape as the CSV parser).
   Only the first sheet is read, sufficient for the patient-list upload.
*/

const td = new TextDecoder();

/* Inflate a raw-DEFLATE byte range (ZIP method 8) using the browser stream API. */
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* Read ZIP central directory → map of { fileName: Uint8Array(decompressed) } for wanted parts. */
async function readZip(buf, wanted) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const n = dv.byteLength;

  // Locate End Of Central Directory record (sig 0x06054b50), scanning backwards.
  let eocd = -1;
  for (let i = n - 22; i >= 0 && i >= n - 22 - 65536; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP / xlsx');

  const cdCount  = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);

  const out = {};
  let p = cdOffset;
  for (let e = 0; e < cdCount; e++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break; // central dir header sig
    const method     = dv.getUint16(p + 10, true);
    const compSize   = dv.getUint32(p + 20, true);
    const nameLen    = dv.getUint16(p + 28, true);
    const extraLen   = dv.getUint16(p + 30, true);
    const cmtLen     = dv.getUint16(p + 32, true);
    const localOff   = dv.getUint32(p + 42, true);
    const name       = td.decode(u8.subarray(p + 46, p + 46 + nameLen));

    if (wanted.some(w => name === w || name.endsWith(w))) {
      // Local file header → data starts after its own name+extra fields.
      const lNameLen  = dv.getUint16(localOff + 26, true);
      const lExtraLen = dv.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const raw = u8.subarray(dataStart, dataStart + compSize);
      out[name] = method === 0 ? raw : await inflateRaw(raw);
    }
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

/* "B12" → zero-based column index (11). */
function colIndex(ref) {
  const m = /^([A-Z]+)/.exec(ref || '');
  if (!m) return 0;
  let idx = 0;
  for (const ch of m[1]) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

export async function parseXlsxArrayBuffer(buf) {
  const wanted = ['xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml'];
  const parts = await readZip(buf, wanted);

  const parser = new DOMParser();

  // Shared strings table (cells with t="s" reference these by index).
  const shared = [];
  const ssBytes = parts['xl/sharedStrings.xml'];
  if (ssBytes) {
    const ss = parser.parseFromString(td.decode(ssBytes), 'application/xml');
    for (const si of ss.getElementsByTagName('si')) {
      let s = '';
      for (const t of si.getElementsByTagName('t')) s += t.textContent;
      shared.push(s);
    }
  }

  const sheetBytes = parts['xl/worksheets/sheet1.xml'];
  if (!sheetBytes) return [];
  const sheet = parser.parseFromString(td.decode(sheetBytes), 'application/xml');

  const rows = [];
  for (const row of sheet.getElementsByTagName('row')) {
    const cells = [];
    for (const c of row.getElementsByTagName('c')) {
      const ci = colIndex(c.getAttribute('r'));
      const t  = c.getAttribute('t');
      let val = '';
      if (t === 'inlineStr') {
        const tt = c.getElementsByTagName('t')[0];
        val = tt ? tt.textContent : '';
      } else {
        const v = c.getElementsByTagName('v')[0];
        const raw = v ? v.textContent : '';
        val = t === 's' ? (shared[+raw] ?? '') : raw;
      }
      cells[ci] = (val == null ? '' : String(val)).trim();
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = '';
    if (cells.some(x => x !== '')) rows.push(cells);
  }
  return rows;
}
