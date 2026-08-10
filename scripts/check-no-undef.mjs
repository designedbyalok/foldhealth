#!/usr/bin/env node
/**
 * Gate on ESLint's `no-undef` only.
 *
 * Why a dedicated check instead of `bun run lint`: the repo carries ~880
 * pre-existing lint problems, so a blanket gate would be red on day one and
 * get ignored. `no-undef` is different in kind — a referenced-but-undefined
 * identifier is a guaranteed ReferenceError on whatever code path reaches it,
 * which in this app means a white screen (there is no error boundary above
 * AppLayout, so React unmounts to an empty #root).
 *
 * That is not theoretical: PR #162 fixed exactly this in AccountPanel, where a
 * 338-file split refactor dropped two helper functions and blanked all of
 * Settings -> Account. That error sat in the lint output the whole time.
 *
 * Uses the project's own eslint.config.js, so rule config stays in one place.
 *
 * Usage:
 *   node scripts/check-no-undef.mjs            # lint src/
 *   node scripts/check-no-undef.mjs a.jsx b.js # lint specific files
 */
import { ESLint } from 'eslint';

const RULE = 'no-undef';
const targets = process.argv.slice(2);
const patterns = targets.length ? targets : ['src'];

const eslint = new ESLint();
let results;
try {
  results = await eslint.lintFiles(patterns);
} catch (err) {
  // An unmatched pattern is normal when this runs over a staged-file list that
  // contains no lintable files — treat it as nothing to do rather than a fail.
  if (/All files matched by .* are ignored|No files matching/.test(err.message)) {
    console.log(`✓ ${RULE}: no lintable files in scope`);
    process.exit(0);
  }
  throw err;
}

const findings = results.flatMap((r) =>
  r.messages
    .filter((m) => m.ruleId === RULE)
    .map((m) => ({ file: r.filePath, line: m.line, column: m.column, message: m.message })),
);

if (findings.length === 0) {
  console.log(`✓ ${RULE}: clean across ${results.length} file(s)`);
  process.exit(0);
}

const cwd = process.cwd();
const rel = (p) => (p.startsWith(cwd) ? p.slice(cwd.length + 1) : p);

console.error(`\n✗ ${findings.length} ${RULE} error(s) — each is a ReferenceError waiting on a code path:\n`);
for (const f of findings) {
  console.error(`  ${rel(f.file)}:${f.line}:${f.column}  ${f.message}`);
}
console.error(
  '\nFix by importing the symbol, threading it as a prop, or deleting the dead reference.\n' +
    'Do not silence it — this rule is the last line of defence against a blank screen.\n',
);
process.exit(1);
