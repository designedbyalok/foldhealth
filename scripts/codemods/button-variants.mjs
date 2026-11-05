#!/usr/bin/env node
/**
 * Codemod: Button and ActionButton onto the variant / tone / size vocabulary
 * (docs/components/library-contract.mdx).
 *
 *   Button        variant="secondary"      → variant="outline"
 *                 variant="tertiary"       → variant="soft"
 *                 variant="alt"            → variant="outline" tone="primary"
 *                 variant="danger"         → variant="soft" tone="danger"
 *                 variant="dangerFilled"   → tone="danger"
 *                 variant="primary"        → (default, removed)
 *                 size="S" / "L" / "XL"    → "sm" / (default, removed) / "lg"
 *   ActionButton  state="disabled"         → disabled
 *                 state="error"            → tone="danger"
 *                 state={c ? 'disabled' : 'active'} → disabled={c}
 *                 size="S" / "L" / "XL"    → "sm" / (default, removed) / "lg"
 *
 * String literals and `cond ? 'a' : 'b'` are rewritten; anything else
 * (values from data) is reported and left alone; the components still accept
 * the old names at runtime with a development warning.
 *
 * Edits are applied to the source text at the attributes' exact offsets, so
 * nothing else in a file is reformatted.
 *
 * usage: node scripts/codemods/button-variants.mjs [--dry] <dir|file>...
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const DEFAULT_TONE = { solid: 'primary', soft: 'primary', outline: 'neutral', ghost: 'neutral' };
const LEGACY_VARIANT = {
  primary: ['solid', 'primary'],
  secondary: ['outline', 'neutral'],
  tertiary: ['soft', 'primary'],
  ghost: ['ghost', 'neutral'],
  alt: ['outline', 'primary'],
  success: ['soft', 'success'],
  danger: ['soft', 'danger'],
  error: ['soft', 'danger'],
  dangerFilled: ['solid', 'danger'],
  info: ['solid', 'info'],
};
const LEGACY_SIZE = { S: 'sm', s: 'sm', M: 'md', L: 'md', XL: 'lg' };

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const roots = args.filter(a => a !== '--dry');

const isStr = (n) => n && n.type === 'StringLiteral';
function literalOf(value) {
  if (isStr(value)) return value.value;
  if (value?.type === 'JSXExpressionContainer' && isStr(value.expression)) return value.expression.value;
  return null;
}
function conditionalOf(value) {
  const e = value?.type === 'JSXExpressionContainer' && value.expression;
  if (e?.type !== 'ConditionalExpression' || !isStr(e.consequent) || !isStr(e.alternate)) return null;
  return { test: e.test, a: e.consequent.value, c: e.alternate.value };
}

function migrateFile(file, src) {
  let ast;
  try { ast = parse(src, { sourceType: 'module', plugins: ['jsx'] }); } catch { return null; }
  const imported = new Set();
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    const from = node.source.value;
    for (const s of node.specifiers) {
      if (s.local.name === 'Button' && from.endsWith('/Button/Button')) imported.add('Button');
      if (s.local.name === 'ActionButton' && from.endsWith('/ActionButton/ActionButton')) imported.add('ActionButton');
    }
  }
  if (file.endsWith('/Button/Button.stories.jsx')) imported.add('Button');
  if (file.endsWith('/ActionButton/ActionButton.stories.jsx')) imported.add('ActionButton');
  if (!imported.size) return null;

  const edits = [];
  const dynamic = [];
  const text = (n) => src.slice(n.start, n.end);
  const cond = (c, a, b) => (a === b ? `"${a}"` : `{${text(c.test)} ? '${a}' : '${b}'}`);
  // Remove an attribute together with the whitespace before it.
  const remove = (a) => {
    let s = a.start;
    while (s > 0 && /\s/.test(src[s - 1])) s--;
    edits.push({ start: s, end: a.end, text: '' });
  };
  const replace = (a, t) => { if (src.slice(a.start, a.end) !== t) edits.push({ start: a.start, end: a.end, text: t }); };
  const negate = (test) => {
    if (test.type === 'UnaryExpression' && test.operator === '!') return text(test.argument);
    const simple = ['Identifier', 'MemberExpression', 'OptionalMemberExpression', 'CallExpression', 'OptionalCallExpression'].includes(test.type);
    return simple ? `!${text(test)}` : `!(${text(test)})`;
  };

  function size(a) {
    const lit = literalOf(a.value);
    if (lit != null && LEGACY_SIZE[lit]) {
      if (LEGACY_SIZE[lit] === 'md') remove(a); else replace(a, `size="${LEGACY_SIZE[lit]}"`);
      return;
    }
    const c = conditionalOf(a.value);
    if (c && LEGACY_SIZE[c.a] && LEGACY_SIZE[c.c]) {
      const [x, y] = [LEGACY_SIZE[c.a], LEGACY_SIZE[c.c]];
      if (x === 'md' && y === 'md') remove(a); else replace(a, `size=${cond(c, x, y)}`);
    }
  }

  function button(el) {
    const attrs = el.attributes.filter(a => a.type === 'JSXAttribute');
    const hasTone = attrs.some(a => a.name.name === 'tone');
    for (const a of attrs) {
      if (a.name.name === 'size') size(a);
      if (a.name.name !== 'variant') continue;
      const lit = literalOf(a.value);
      const c = conditionalOf(a.value);
      if (lit != null && LEGACY_VARIANT[lit]) {
        const [v, t] = LEGACY_VARIANT[lit];
        const parts = [];
        if (v !== 'solid') parts.push(`variant="${v}"`);
        if (t !== DEFAULT_TONE[v] && !hasTone) parts.push(`tone="${t}"`);
        if (parts.length) replace(a, parts.join(' ')); else remove(a);
      } else if (c && LEGACY_VARIANT[c.a] && LEGACY_VARIANT[c.c]) {
        const [va, ta] = LEGACY_VARIANT[c.a];
        const [vc, tc] = LEGACY_VARIANT[c.c];
        const parts = [];
        if (!(va === 'solid' && vc === 'solid')) parts.push(`variant=${cond(c, va, vc)}`);
        if (!hasTone && !(ta === DEFAULT_TONE[va] && tc === DEFAULT_TONE[vc])) parts.push(`tone=${cond(c, ta, tc)}`);
        if (parts.length) replace(a, parts.join(' ')); else remove(a);
      } else if (a.value && lit == null) {
        dynamic.push(`${file}:${a.loc.start.line} Button variant=${text(a.value)}`);
      }
    }
  }

  function actionButton(el) {
    const attrs = el.attributes.filter(a => a.type === 'JSXAttribute');
    for (const a of attrs) if (a.name.name === 'size') size(a);
    const state = attrs.find(a => a.name.name === 'state');
    if (!state) return;
    const disabledAttr = attrs.find(a => a.name.name === 'disabled');
    const lit = literalOf(state.value);
    const c = conditionalOf(state.value);
    let expr = null;
    if (lit === 'active') { remove(state); return; }
    if (lit === 'error') { replace(state, 'tone="danger"'); return; }
    if (lit === 'disabled') expr = true;
    else if (c && new Set([c.a, c.c]).size === 2 && [c.a, c.c].every(v => v === 'active' || v === 'disabled')) {
      expr = c.a === 'disabled' ? text(c.test) : negate(c.test);
    } else {
      dynamic.push(`${file}:${state.loc.start.line} ActionButton state=${text(state.value)}`);
      return;
    }
    if (!disabledAttr) {
      replace(state, expr === true ? 'disabled' : `disabled={${expr}}`);
    } else {
      remove(state);
      if (expr === true) replace(disabledAttr, 'disabled');
      else if (disabledAttr.value) replace(disabledAttr, `disabled={(${text(disabledAttr.value.expression)}) || ${expr}}`);
    }
  }

  traverse(ast, {
    JSXOpeningElement(p) {
      const name = p.node.name.name;
      if (name === 'Button' && imported.has('Button')) button(p.node);
      if (name === 'ActionButton' && imported.has('ActionButton')) actionButton(p.node);
    },
  });

  edits.sort((x, y) => y.start - x.start);
  let out = src;
  let last = Infinity;
  for (const e of edits) {
    if (e.end > last) throw new Error(`${file}: overlapping edits`);
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    last = e.start;
  }
  return { out, n: edits.length, dynamic };
}

function* files(target) {
  if (fs.statSync(target).isFile()) { yield target; return; }
  for (const f of fs.readdirSync(target)) {
    if (f === 'node_modules' || f === 'dist' || f.startsWith('.')) continue;
    yield* files(path.join(target, f));
  }
}

let total = 0;
let touched = 0;
const dynamic = [];
for (const root of roots) {
  for (const f of files(root)) {
    if (!/\.(jsx|js)$/.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    if (!/<(Action)?Button\b/.test(src)) continue;
    const r = migrateFile(f, src);
    if (!r) continue;
    if (r.n) {
      total += r.n;
      touched++;
      if (!dry) fs.writeFileSync(f, r.out);
    }
    dynamic.push(...r.dynamic);
  }
}
console.log(`${dry ? '[dry] ' : ''}${total} edit(s) in ${touched} file(s).`);
if (dynamic.length) {
  console.log(`\nLeft as is (values from data), ${dynamic.length}:`);
  for (const d of dynamic) console.log(`  ${d}`);
}
