#!/usr/bin/env node
/**
 * Design-system guardrails — CHANGED-LINES-ONLY enforcement.
 *
 * The repo carries thousands of pre-existing hardcoded values, so we never
 * lint whole files. Instead we run ESLint (JS/JSX) + Stylelint (CSS) on the
 * changed files, then keep only the violations that land on lines this change
 * actually ADDED or modified. New code must follow the design system; the
 * existing debt never blocks anyone.
 *
 * Two modes:
 *   --staged            diff the git index (local pre-commit hook)
 *   --base <ref>        diff <ref>...HEAD via merge-base (CI, ref = base branch)
 *
 * Exit 1 if any design-system violation falls on a changed line.
 *
 * Blocking ESLint rules: only design-system rules (see DS_ESLINT_RULES).
 * Generic lint noise (unused vars, hooks deps, …) never blocks here — that's
 * what `bun run lint` is for.
 * Blocking Stylelint rules: all of them (the stylelint config is DS-only).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const MODE = process.argv.includes('--staged') ? 'staged' : 'base';
const baseIdx = process.argv.indexOf('--base');
const BASE_REF = baseIdx !== -1 ? process.argv[baseIdx + 1] : null;

// ESLint ruleIds that represent design-system violations. Our DS JSX checks
// are all implemented via `no-restricted-syntax`, so that single id is the
// design-system gate. Everything else ESLint reports is informational here.
const DS_ESLINT_RULES = new Set(['no-restricted-syntax']);

const JS_EXT = new Set(['.js', '.jsx']);
const CSS_EXT = new Set(['.css']);

// Files that legitimately contain raw values and must never be gated:
//   tokens.css defines the color tokens (hex is the whole point);
//   index.css holds global resets / @font-face;
//   the review-kit package's theme.css is its own token file (it must work
//   outside Fold, so it can't use Fold's tokens).
const CSS_IGNORE = new Set(['src/tokens/tokens.css', 'src/index.css']);
// Standalone packages ship their own theme tokens for other apps, so Fold's
// token rules don't apply to them.
const CSS_IGNORE_PREFIX = 'packages/';

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/**
 * Return Map<relPath, Set<addedLineNumber>> for the current change set.
 * Uses --unified=0 so hunks contain only added/removed lines (no context).
 */
function changedLines() {
  const args = MODE === 'staged'
    ? ['diff', '--cached', '--unified=0', '--diff-filter=ACM']
    : ['diff', '--unified=0', '--diff-filter=ACM', `${BASE_REF}...HEAD`];
  const { stdout } = sh('git', args);

  const map = new Map();
  let file = null;
  let newLine = 0;
  for (const line of stdout.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).replace(/^b\//, '').trim();
      file = p === '/dev/null' ? null : p;
      if (file && !map.has(file)) map.set(file, new Set());
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) { newLine = parseInt(hunk[1], 10); continue; }
    if (!file) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      map.get(file).add(newLine);
      newLine += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      // removed line — does not advance the new-file counter
    } else if (!line.startsWith('\\')) {
      newLine += 1; // shouldn't occur with --unified=0, but stay safe
    }
  }
  return map;
}

// Parse a JSON array from a command's output. bunx routes some tools'
// formatter output to stderr (and exits non-zero on findings), so accept
// whichever stream carries the JSON.
function parseJsonReport(stdout, stderr) {
  for (const s of [stdout, stderr]) {
    const t = (s || '').trim();
    if (t.startsWith('[')) {
      try { return JSON.parse(t); } catch { /* try next */ }
    }
  }
  return null;
}

function runEslint(files) {
  if (!files.length) return [];
  const { stdout, stderr } = sh('bunx', ['eslint', '--format', 'json', ...files]);
  const report = parseJsonReport(stdout, stderr);
  if (!report) return [];
  const out = [];
  for (const f of report) {
    const rel = path.relative(process.cwd(), f.filePath);
    for (const m of f.messages) {
      if (m.ruleId && DS_ESLINT_RULES.has(m.ruleId)) {
        out.push({ file: rel, line: m.line, rule: m.ruleId, text: m.message });
      }
    }
  }
  return out;
}

function runStylelint(files) {
  if (!files.length) return [];
  const { stdout, stderr } = sh('bunx', ['stylelint', '--formatter', 'json', ...files]);
  const report = parseJsonReport(stdout, stderr);
  if (!report) return [];
  const out = [];
  for (const f of report) {
    const rel = path.relative(process.cwd(), f.source);
    for (const w of f.warnings || []) {
      out.push({ file: rel, line: w.line, rule: w.rule, text: w.text });
    }
  }
  return out;
}

function main() {
  if (MODE === 'base' && !BASE_REF) {
    console.error('ds-guardrails: --base <ref> is required (or use --staged)');
    process.exit(2);
  }

  const changed = changedLines();
  const files = [...changed.keys()];
  const jsFiles = files.filter(f => JS_EXT.has(path.extname(f)));
  const cssFiles = files.filter(f => CSS_EXT.has(path.extname(f)) && !CSS_IGNORE.has(f) && !f.startsWith(CSS_IGNORE_PREFIX));

  const violations = [...runEslint(jsFiles), ...runStylelint(cssFiles)]
    .filter(v => changed.get(v.file)?.has(v.line));

  if (!violations.length) {
    console.log('✓ Design-system guardrails: no violations on changed lines.');
    process.exit(0);
  }

  console.error('\n✖ Design-system guardrails failed — fix these on the lines you changed:\n');
  const byFile = new Map();
  for (const v of violations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file).push(v);
  }
  for (const [file, vs] of byFile) {
    console.error(`  ${file}`);
    for (const v of vs.sort((a, b) => a.line - b.line)) {
      console.error(`    ${v.line}: ${v.text}  [${v.rule}]`);
    }
    console.error('');
  }
  console.error(`${violations.length} violation(s). See CONTRIBUTING.md → Design system.\n`);
  process.exit(1);
}

main();
