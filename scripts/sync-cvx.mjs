#!/usr/bin/env node
/**
 * Refresh the cached CVX code set.
 *
 * Downloads the CDC's CVX workbook, parses it, and writes
 * `api/_lib/cvxCodes.generated.js`. The lookup route reads only that file, so
 * `/api/reference/immunizations` never touches the network at request time
 * and needs no API key: unlike the allergy substance route, which proxies
 * UMLS live.
 *
 * Usage:
 *   node scripts/sync-cvx.mjs                 # download from the CDC
 *   node scripts/sync-cvx.mjs --file a.xlsx   # parse a local workbook
 *   node scripts/sync-cvx.mjs --check         # exit 1 if the cache is stale
 *
 * Run weekly by .github/workflows/cvx-sync.yml: CVX gains vaccines and
 * retires others a few times a year, and the table should not need a code
 * change to keep up.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCvxFile } from './lib/parseCvxFile.mjs';

const CVX_URL = 'https://www2a.cdc.gov/vaccines/iis/iisstandards/downloads/WEB_cvx.xlsx';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'api/_lib/cvxCodes.generated.js');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

async function load() {
  const local = value('file');
  if (local) {
    console.log(`[cvx] reading ${local}`);
    return readFile(local);
  }
  console.log(`[cvx] downloading ${CVX_URL}`);
  const res = await fetch(CVX_URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`CDC returned ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function render(codes) {
  const generatedOn = new Date().toISOString().slice(0, 10);
  return `// GENERATED FILE: do not edit by hand.
//
// The CDC CVX code set, cached so /api/reference/immunizations can answer
// without a network call or an API key. Regenerate with:
//
//   bun run sync:cvx
//
// Source: ${CVX_URL}
// Synced: ${generatedOn} (${codes.length} codes)

export const CVX_SYSTEM = 'http://hl7.org/fhir/sid/cvx';
export const CVX_SYNCED_ON = '${generatedOn}';

/** @type {Array<{code: string, display: string, fullName: string, note: string, status: string, nonVaccine: boolean, updatedAt: string|null}>} */
export const CVX_CODES = ${JSON.stringify(
    codes.map(c => ({
      code: c.code,
      display: c.shortDescription,
      fullName: c.fullName,
      note: c.note,
      status: c.status,
      nonVaccine: c.nonVaccine,
      updatedAt: c.updatedAt,
    })),
    null,
    0,
  ).replace(/\},\{/g, '},\n  {').replace(/^\[/, '[\n  ').replace(/\]$/, ',\n]')};

export default CVX_CODES;
`;
}

const codes = parseCvxFile(await load());
if (!codes.length) throw new Error('Parsed 0 CVX codes: refusing to write an empty cache');

const next = render(codes);

// The header carries today's date, so compare only the payload; otherwise
// every run looks like a change and the weekly job commits noise.
const payload = (src) => src.replace(/^\/\/ Synced:.*$/m, '').replace(/^export const CVX_SYNCED_ON = .*$/m, '');
const prev = existsSync(OUT) ? await readFile(OUT, 'utf8') : '';
const changed = payload(prev) !== payload(next);

if (flag('check')) {
  console.log(changed ? '[cvx] cache is STALE' : `[cvx] cache is current (${codes.length} codes)`);
  process.exit(changed ? 1 : 0);
}

if (!changed) {
  console.log(`[cvx] no change (${codes.length} codes)`);
  process.exit(0);
}

await writeFile(OUT, next, 'utf8');
const active = codes.filter(c => c.status === 'Active').length;
console.log(`[cvx] wrote ${path.relative(ROOT, OUT)}, ${codes.length} codes (${active} active)`);
