#!/usr/bin/env node
/**
 * Codemod: Alert / InfoBar → Banner, RingEmptyState → EmptyState
 * (docs/components/library-contract.mdx).
 *
 *   <InfoBar …>          → <Banner …>
 *     variant="inline"   → size="sm"
 *     tone="error"       → tone="danger"
 *     (no icon, tone ≠ info) → icon="solar:info-circle-linear" (InfoBar's default)
 *   <Alert message={x} …/> → <Banner variant="outline" …>{x}</Banner>
 *     (no tone)          → tone="danger" (Alert's default)
 *     tone="error"       → tone="danger"
 *   <RingEmptyState …>   → <EmptyState …>
 *     label=             → title=
 *     size="S" | "XS" | "M" → "sm" | "xs" | (default)
 *
 * Imports are re-pointed and de-duplicated. What it can't decide (a dynamic
 * tone on Alert, spread props) is reported; the old components still work.
 *
 * usage: node scripts/codemods/banner-emptystate.mjs [--dry] <dir|file>...
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const MOVES = { Alert: 'Banner', InfoBar: 'Banner', RingEmptyState: 'EmptyState' };
const SKIP = [/\/scripts\/codemods\//, ...Object.keys(MOVES).map(c => new RegExp(`/components/${c}/`))];

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const roots = args.filter(a => a !== '--dry');
const report = [];

const isStr = (n) => n && n.type === 'StringLiteral';
const literalOf = (v) => (isStr(v) ? v.value : v?.type === 'JSXExpressionContainer' && isStr(v.expression) ? v.expression.value : null);

function migrateFile(file, src) {
  let ast;
  try { ast = parse(src, { sourceType: 'module', plugins: ['jsx'] }); } catch { return null; }
  const edits = [];
  const text = (n) => src.slice(n.start, n.end);
  const replace = (start, end, t) => edits.push({ start, end, text: t });
  const removeAttr = (a) => {
    let s = a.start;
    while (s > 0 && /\s/.test(src[s - 1])) s--;
    replace(s, a.end, '');
  };

  // Imports: which local names are old components, and which new ones exist.
  const local = {};
  const have = new Set();
  const importDecls = [];
  for (const n of ast.program.body) {
    if (n.type !== 'ImportDeclaration') continue;
    for (const c of [...Object.keys(MOVES), ...new Set(Object.values(MOVES))]) {
      if (!n.source.value.endsWith(`/${c}/${c}`)) continue;
      for (const s of n.specifiers) {
        if ((s.imported?.name || s.local.name) !== c) continue;
        if (MOVES[c]) local[s.local.name] = c; else have.add(c);
      }
      importDecls.push({ node: n, c });
    }
  }
  if (!Object.keys(local).length) return { out: src, n: 0 };

  for (const { node, c } of importDecls) {
    const next = MOVES[c];
    if (!next) continue;
    if (node.specifiers.length !== 1) { report.push(`${file}: import of ${c} has other specifiers (fix by hand)`); continue; }
    if (have.has(next)) {
      let end = node.end;
      if (src[end] === '\n') end++;
      replace(node.start, end, '');
    } else {
      replace(node.start, node.end, text(node).replace(new RegExp(`\\b${c}\\b`, 'g'), next));
      have.add(next);
    }
  }

  traverse(ast, {
    JSXElement(p) {
      const open = p.node.openingElement;
      const c = local[open.name.name];
      if (!c) return;
      const next = MOVES[c];
      const where = `${file}:${open.loc.start.line} <${c}>`;
      const attrs = open.attributes.filter(a => a.type === 'JSXAttribute');
      const get = (n) => attrs.find(a => a.name.name === n);
      if (open.attributes.some(a => a.type === 'JSXSpreadAttribute')) report.push(`${where} spreads props (check them by hand)`);

      replace(open.name.start, open.name.end, next);
      // New props go where this tag puts its props: on the same line, or one
      // per line at the first prop's indent.
      const first = open.attributes[0];
      const lineBreak = first && src.slice(open.name.end, first.start).includes('\n');
      const sep = lineBreak ? src.slice(open.name.end, first.start).replace(/^[^\n]*/, '') : ' ';
      const addProps = (...props) => replace(open.name.end, open.name.end, props.map(x => sep + x).join(''));
      if (p.node.closingElement) replace(p.node.closingElement.name.start, p.node.closingElement.name.end, next);

      if (c === 'RingEmptyState') {
        const label = get('label');
        if (label) replace(label.name.start, label.name.end, 'title');
        const size = get('size');
        const lit = size && literalOf(size.value);
        if (lit === 'S') replace(size.start, size.end, 'size="sm"');
        else if (lit === 'XS') replace(size.start, size.end, 'size="xs"');
        else if (lit === 'M') removeAttr(size);
        else if (size) report.push(`${where} size=${text(size.value)}`);
        return;
      }

      const tone = get('tone');
      const toneLit = tone ? literalOf(tone.value) : null;
      if (toneLit === 'error') replace(tone.start, tone.end, 'tone="danger"');
      else if (tone && toneLit == null) report.push(`${where} tone=${text(tone.value)} ('error' still maps to danger at runtime)`);

      if (c === 'InfoBar') {
        const variant = get('variant');
        const vLit = variant && literalOf(variant.value);
        if (vLit === 'inline') replace(variant.start, variant.end, 'size="sm"');
        else if (vLit === 'banner') removeAttr(variant);
        else if (variant) report.push(`${where} variant=${text(variant.value)}`);
        if (!get('icon') && tone && toneLit !== 'info') {
          addProps('icon="solar:info-circle-linear"');
        }
        return;
      }

      // Alert
      addProps('variant="outline"', ...(tone ? [] : ['tone="danger"']));
      const message = get('message');
      if (!message) return;
      if (!open.selfClosing) { report.push(`${where} has both message and children`); return; }
      const body = isStr(message.value)
        ? (/[{}<>]/.test(message.value.value) ? `{${JSON.stringify(message.value.value)}}` : message.value.value)
        : text(message.value);
      removeAttr(message);
      // Turn `… />` into `…>{body}</Banner>`.
      let close = open.end - 2;
      while (close > open.start && /\s/.test(src[close - 1])) close--;
      if (lineBreak) {
        const indent = src.slice(src.lastIndexOf('\n', open.start) + 1, open.start).match(/^\s*/)[0];
        replace(close, open.end, `\n${indent}>\n${indent}  ${body}\n${indent}</${next}>`);
      } else {
        replace(close, open.end, `>${body}</${next}>`);
      }
    },
  });

  edits.sort((x, y) => y.start - x.start || y.end - x.end);
  let out = src;
  let last = Infinity;
  for (const e of edits) {
    if (e.end > last) throw new Error(`${file}: overlapping edits at ${e.start}`);
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    last = e.start;
  }
  return { out, n: edits.length };
}

function* files(target) {
  if (fs.statSync(target).isFile()) { yield target; return; }
  for (const f of fs.readdirSync(target)) {
    if (f === 'node_modules' || f === 'dist' || f.startsWith('.')) continue;
    yield* files(path.join(target, f));
  }
}

let total = 0;
let touchedFiles = 0;
for (const root of roots) {
  for (const f of files(root)) {
    if (!/\.(jsx|js)$/.test(f) || SKIP.some(r => r.test(f))) continue;
    const src = fs.readFileSync(f, 'utf8');
    const r = migrateFile(f, src);
    if (!r?.n) continue;
    total += r.n;
    touchedFiles++;
    if (!dry) fs.writeFileSync(f, r.out);
  }
}
console.log(`${dry ? '[dry] ' : ''}${total} edit(s) in ${touchedFiles} file(s).`);
if (report.length) {
  console.log(`\nFor a person to check (${report.length}):`);
  for (const r of [...new Set(report)]) console.log(`  ${r}`);
}
