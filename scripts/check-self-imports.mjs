#!/usr/bin/env node
/**
 * Fail on any module that imports itself.
 *
 * A wrapper that means to import the component it wraps but resolves to its
 * own file (`import { FilterBar as Base } from './FilterBar'` inside
 * FilterBar.jsx) builds, lints and tests clean, then renders itself inside
 * itself forever: the browser tab freezes with nothing in the console. That
 * shipped in #774 and froze every worklist, Tasks, Campaign and Settings
 * until #781. eslint-plugin-import's no-self-import would catch it, but the
 * repo doesn't carry that plugin, so this resolves the specifiers itself:
 * relative paths and the `@/` alias (src/, see vite.config.js).
 *
 * Usage:
 *   node scripts/check-self-imports.mjs            # src/, patient/, api/
 *   node scripts/check-self-imports.mjs a.jsx b.js # specific files
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['src', 'patient', 'api'];
const SOURCE = /\.(jsx?|mjs|tsx?)$/;
const EXTENSIONS = ['', '.js', '.jsx', '.mjs', '.ts', '.tsx'];
const cwd = process.cwd();
const aliasRoot = path.join(cwd, 'src');

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (SOURCE.test(name)) out.push(p);
  }
  return out;
}

// What a specifier points at: the file itself, the file plus an extension,
// or the directory's index file.
function resolve(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(aliasRoot, spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const ext of EXTENSIONS) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  for (const ext of EXTENSIONS.slice(1)) {
    const p = path.join(base, `index${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

// Static imports, `export ... from`, and dynamic import().
const SPECIFIERS = [
  /\bimport\s+(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+[^'"`;]*?\s+from\s+['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
];

const targets = process.argv.slice(2);
const files = targets.length
  ? targets.filter(f => SOURCE.test(f)).map(f => path.resolve(f))
  : ROOTS.filter(r => existsSync(r)).flatMap(r => walk(path.join(cwd, r), []));

const findings = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const re of SPECIFIERS) {
    for (const m of text.matchAll(re)) {
      if (resolve(file, m[1]) === file) {
        const line = text.slice(0, m.index).split('\n').length;
        findings.push(`  ${path.relative(cwd, file)}:${line}  imports itself via '${m[1]}'`);
      }
    }
  }
}

if (findings.length === 0) {
  console.log(`✓ self-imports: clean across ${files.length} file(s)`);
  process.exit(0);
}
console.error(`\n✗ ${findings.length} self-import(s): a module that imports itself (a wrapper rendering itself forever):\n`);
console.error(findings.join('\n'));
console.error('\nPoint the import at the module you meant, e.g. the component in src/components/.\n');
process.exit(1);
