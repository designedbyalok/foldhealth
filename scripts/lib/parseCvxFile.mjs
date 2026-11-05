/**
 * CVX workbook parser.
 *
 * CVX is the CDC's code set for administered vaccines. It ships as
 * `WEB_cvx.xlsx` from
 * https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads/WEB_cvx.xlsx
 * with one row per code:
 *
 *   CVX Code | CVX Short Description | Full Vaccine Name | Note |
 *   VaccineStatus | internalID | nonvaccine | update_date
 *
 * An .xlsx is a ZIP of XML parts, so this reads the archive directly rather
 * than pulling in a spreadsheet dependency for one file: Node's zlib already
 * does the only hard part (raw DEFLATE), and the two parts that matter,
 * `xl/sharedStrings.xml` and `xl/worksheets/sheet1.xml`, are plain XML.
 */

import { inflateRawSync } from 'node:zlib';

/** ZIP end-of-central-directory / central-directory / local-header magics. */
const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;

/**
 * Read a ZIP archive into a `Map<name, Buffer>`.
 *
 * Walks the central directory rather than scanning for local headers, so a
 * streamed entry (whose local header carries no sizes) still resolves.
 */
function unzip(buf) {
  // The EOCD sits at the end, after a comment of up to 64KB.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a ZIP archive: no end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== CEN_SIG) throw new Error('Corrupt ZIP central directory');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // The local header repeats the name/extra with its own lengths, which are
    // the ones that locate the data.
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compressedSize);

    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, inflateRawSync(raw));
    else throw new Error(`Unsupported ZIP compression method ${method} for ${name}`);

    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const XML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
};

function decodeXml(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return XML_ENTITIES[ent] ?? m;
  });
}

/**
 * Shared strings table. Every `<si>` is one string, but a run-formatted cell
 * splits it across several `<t>`, so the runs are concatenated.
 */
function readSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(([, body]) =>
    [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map(([, t]) => decodeXml(t))
      .join(''));
}

/** Sheet rows as arrays of strings, resolving shared-string cells. */
function readRows(xml, shared) {
  const rows = [];
  for (const [, rowXml] of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const m of rowXml.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = m[1] || '';
      const body = m[2] || '';
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1];

      let value = '';
      if (type === 'inlineStr') {
        value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(([, t]) => decodeXml(t)).join('');
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (v != null) value = type === 's' ? (shared[Number(v)] ?? '') : decodeXml(v);
      }

      // Empty cells are omitted from the XML, so place by column letter rather
      // than by order or a row would shift left around a blank.
      if (ref) {
        let col = 0;
        for (const ch of ref) col = col * 26 + (ch.charCodeAt(0) - 64);
        cells[col - 1] = value;
      } else {
        cells.push(value);
      }
    }
    rows.push(cells);
  }
  return rows;
}

/**
 * Excel serial date → ISO `YYYY-MM-DD`.
 *
 * Day 1 is 1900-01-01, and Excel counts a 1900-02-29 that never existed, so
 * serials past that day are one ahead of the real calendar. Anchoring on the
 * 1899-12-30 epoch cancels both.
 */
function excelSerialToIso(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = Date.UTC(1899, 11, 30) + n * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

const HEADER_KEYS = {
  'cvx code': 'code',
  'cvx short description': 'shortDescription',
  'full vaccine name': 'fullName',
  note: 'note',
  vaccinestatus: 'status',
  nonvaccine: 'nonVaccine',
  update_date: 'updatedAt',
};

/**
 * Parse a CVX workbook into records.
 *
 * @param {Buffer|ArrayBuffer|Uint8Array} input – the `.xlsx` bytes
 * @returns {Array<{code: string, shortDescription: string, fullName: string,
 *   note: string, status: 'Active'|'Inactive'|'Never Active',
 *   nonVaccine: boolean, updatedAt: string|null}>}
 *   Codes in file order, `nonvaccine` rows included: the caller decides
 *   whether a non-vaccine code (e.g. "no vaccine administered") belongs in
 *   its picker.
 */
export function parseCvxFile(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const files = unzip(buf);

  const sheetName = [...files.keys()].find(n => /^xl\/worksheets\/sheet1\.xml$/.test(n))
    || [...files.keys()].find(n => /^xl\/worksheets\/.*\.xml$/.test(n));
  if (!sheetName) throw new Error('CVX workbook has no worksheet');

  const shared = readSharedStrings(files.get('xl/sharedStrings.xml')?.toString('utf8'));
  const rows = readRows(files.get(sheetName).toString('utf8'), shared);
  if (!rows.length) throw new Error('CVX workbook is empty');

  // Map by header text, so a column added or reordered upstream doesn't
  // silently shift every field by one.
  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  const index = {};
  header.forEach((h, i) => { if (HEADER_KEYS[h]) index[HEADER_KEYS[h]] = i; });

  for (const required of ['code', 'shortDescription', 'status']) {
    if (index[required] == null) {
      throw new Error(`CVX workbook is missing the "${required}" column; got: ${header.filter(Boolean).join(', ')}`);
    }
  }

  const at = (row, key) => String(row[index[key]] ?? '').trim();

  return rows.slice(1)
    .filter(row => at(row, 'code'))
    .map(row => ({
      code: at(row, 'code'),
      shortDescription: at(row, 'shortDescription'),
      fullName: at(row, 'fullName'),
      note: at(row, 'note'),
      status: at(row, 'status'),
      nonVaccine: at(row, 'nonVaccine').toLowerCase() === 'true',
      updatedAt: excelSerialToIso(at(row, 'updatedAt')),
    }));
}

export default parseCvxFile;
