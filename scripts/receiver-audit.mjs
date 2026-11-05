#!/usr/bin/env node
/**
 * Receiver-type guardrail: CHANGED-LINES-ONLY enforcement.
 *
 * Catches calls to Array-only methods on receivers that are not arrays: Sets,
 * Maps, NodeLists, URLSearchParams, FormData. Nothing else in the toolchain
 * sees this class of bug: it type-checks fine, lints fine, builds fine, and
 * then throws at runtime.
 *
 * It is here because it already shipped. A perf pass rewrote
 *
 *     [...vt].sort()   ->   vt.toSorted()
 *
 * across 28 sites, dropping the spread that turned the Set into an array.
 * `toSorted` is Array.prototype only, so four clinical worklists (HCC, Annual
 * Visit, HEDIS, CCM) white-screened in production with
 * "TypeError: vt.toSorted is not a function".
 *
 * Two modes, matching ds-guardrails:
 *   --staged            diff the git index (local pre-commit hook)
 *   --base <ref>        diff <ref>...HEAD via merge-base (CI, ref = base branch)
 *   --all               scan every file, ignore git (manual audit)
 *
 * Exit 1 if a violation lands on a line this change ADDED or modified.
 * Pre-existing code never blocks anyone: same philosophy as ds-guardrails.
 *
 * Type resolution: for each `name.method(` call we take the NEAREST
 * `const/let/var name = …` at or above that line and read its right-hand side.
 * Using the nearest declaration rather than any declaration in the file is what
 * makes this usable as a gate, `const errors = []` next to the call and a
 * `const errors = new Set()` 1,300 lines away in another function must not be
 * confused for each other.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ARGV = process.argv.slice(2);
const MODE = ARGV.includes('--all') ? 'all'
  : ARGV.includes('--staged') ? 'staged'
  : 'base';
const baseIdx = ARGV.indexOf('--base');
const BASE_REF = baseIdx !== -1 ? ARGV[baseIdx + 1] : null;

const JS_EXT = new Set(['.js', '.jsx']);

/** Methods each non-array receiver genuinely has. Anything else is a bug. */
const ALLOWED = {
  Set: new Set(['add', 'has', 'delete', 'clear', 'forEach', 'entries', 'keys', 'values', 'size',
    'constructor', 'union', 'intersection', 'difference', 'symmetricDifference',
    'isSubsetOf', 'isSupersetOf', 'isDisjointFrom']),
  Map: new Set(['set', 'get', 'has', 'delete', 'clear', 'forEach', 'entries', 'keys', 'values',
    'size', 'constructor']),
  NodeList: new Set(['forEach', 'item', 'entries', 'keys', 'values', 'length']),
  HTMLCollection: new Set(['item', 'namedItem', 'length']),
  URLSearchParams: new Set(['append', 'delete', 'get', 'getAll', 'has', 'set', 'sort', 'forEach',
    'entries', 'keys', 'values', 'toString', 'size']),
  FormData: new Set(['append', 'delete', 'get', 'getAll', 'has', 'set', 'forEach', 'entries',
    'keys', 'values']),
};

/** Recognise a receiver's type from its declaration's right-hand side. */
const RHS_TYPE = [
  [/^\s*new Set\b/, 'Set'],
  [/^\s*new Map\b/, 'Map'],
  [/^\s*new URLSearchParams\b/, 'URLSearchParams'],
  [/^\s*new FormData\b/, 'FormData'],
  [/^\s*[\w.?]*querySelectorAll\s*\(/, 'NodeList'],
  [/^\s*document\.getElementsBy\w+\s*\(/, 'HTMLCollection'],
];

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/** Map<relPath, Set<addedLineNumber>> for the current change set. */
function changedLines() {
  const args = MODE === 'staged'
    ? ['diff', '--cached', '--unified=0', '--diff-filter=ACM']
    : ['diff', '--unified=0', '--diff-filter=ACM', `${BASE_REF}...HEAD`];
  const { stdout } = sh('git', args);

  const map = new Map();
  let file = null;
  for (const line of stdout.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).replace(/^b\//, '').trim();
      file = p === '/dev/null' ? null : p;
      if (file && !map.has(file)) map.set(file, new Set());
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk && file) {
      const start = parseInt(hunk[1], 10);
      const count = hunk[2] === undefined ? 1 : parseInt(hunk[2], 10);
      for (let i = 0; i < count; i++) map.get(file).add(start + i);
    }
  }
  return map;
}

function allJsFiles() {
  const { stdout } = sh('git', ['ls-files', 'src', 'api', 'scripts']);
  return stdout.split('\n').filter(f => f && JS_EXT.has(path.extname(f)));
}

/**
 * Nearest `const/let/var <name> = <rhs>` at or above `line`, as a type or null.
 * Returns null when the nearest declaration is not one of the tracked types,
 * which is the common case and means "treat as array: fine".
 */
function typeAt(lines, name, line) {
  const declRe = new RegExp(`^\\s*(?:const|let|var)\\s+${name}\\s*=\\s*(.*)$`);
  for (let i = line - 1; i >= 0; i--) {
    const m = lines[i].match(declRe);
    if (!m) continue;
    for (const [re, type] of RHS_TYPE) if (re.test(m[1])) return type;
    return null;                        // nearest decl is something else
  }
  return null;                          // never declared locally (prop, param, import)
}

/**
 * Every identifier used as a function parameter anywhere in the file.
 *
 * Parameters shadow outer declarations but are not `const/let/var`, so the
 * upward walk sails straight past them. `function roleIndexFromBy(by = '')`
 * calling `by.match(…)` was being blamed on a `const by = new Set()` 1,200
 * lines away in a different function.
 *
 * Excluding these names entirely is deliberately conservative: this gate blocks
 * commits, so a missed detection is far cheaper than a false accusation.
 */
function paramNames(src) {
  const names = new Set();
  const add = (params) => {
    for (const m of params.matchAll(/([A-Za-z_$][\w$]*)\s*(?=[,:}\])=]|$)/g)) names.add(m[1]);
  };
  for (const m of src.matchAll(/function\s*[A-Za-z_$][\w$]*\s*\(([^)]*)\)/g)) add(m[1]);
  for (const m of src.matchAll(/function\s*\(([^)]*)\)/g)) add(m[1]);
  for (const m of src.matchAll(/\(([^)]*)\)\s*=>/g)) add(m[1]);
  for (const m of src.matchAll(/(?:^|[^\w$])([A-Za-z_$][\w$]*)\s*=>/g)) names.add(m[1]);
  return names;
}

function scanFile(rel, abs) {
  let src;
  try { src = fs.readFileSync(abs, 'utf8'); } catch { return []; }
  const lines = src.split('\n');
  const params = paramNames(src);
  const out = [];

  lines.forEach((line, i) => {
    // bare identifier receiver only: `filters.dos.includes()` must not match `dos`
    for (const m of line.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/g)) {
      const [, name, method] = m;
      if (params.has(name)) continue;          // shadowed by a parameter somewhere
      const before = line.slice(0, m.index);
      // already converted at the call site
      if (/\[\s*\.\.\.\s*$/.test(before) || /Array\.from\(\s*$/.test(before)) continue;

      const type = typeAt(lines, name, i);
      if (!type) continue;
      if (ALLOWED[type].has(method)) continue;

      out.push({ file: rel, line: i + 1, type, name, method, text: line.trim() });
    }
  });
  return out;
}

function main() {
  if (MODE === 'base' && !BASE_REF) {
    console.error('receiver-audit: --base <ref> is required (or use --staged / --all)');
    process.exit(2);
  }

  let violations = [];
  if (MODE === 'all') {
    for (const f of allJsFiles()) violations.push(...scanFile(f, f));
  } else {
    const changed = changedLines();
    for (const [file, lineSet] of changed) {
      if (!JS_EXT.has(path.extname(file))) continue;
      if (!fs.existsSync(file)) continue;             // deleted in this change
      violations.push(...scanFile(file, file).filter(v => lineSet.has(v.line)));
    }
  }

  if (!violations.length) process.exit(0);

  console.error('\n✖ Receiver-type guardrail failed: these methods do not exist on the receiver:\n');
  const byFile = new Map();
  for (const v of violations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file).push(v);
  }
  for (const [file, vs] of byFile) {
    console.error(`  ${file}`);
    for (const v of vs) {
      console.error(`    ${v.line}: ${v.text}`);
      console.error(`          \`${v.name}\` is a ${v.type}; ${v.type}.prototype has no .${v.method}()`);
      if (['Set', 'Map'].includes(v.type)) {
        console.error(`          fix: [...${v.name}].${v.method}(…)  or  Array.from(${v.name}).${v.method}(…)`);
      } else {
        console.error(`          fix: Array.from(${v.name}).${v.method}(…)`);
      }
    }
    console.error('');
  }
  console.error(`${violations.length} violation(s). This class throws at runtime, build and lint cannot see it.\n`);
  process.exit(1);
}

main();
