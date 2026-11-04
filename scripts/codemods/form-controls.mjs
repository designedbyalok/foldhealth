#!/usr/bin/env node
/**
 * Codemod: form controls onto the library contract
 * (docs/components/library-contract.mdx).
 *
 * Input, Select, Textarea
 *   variant="error"                     → invalid
 *   variant={cond ? 'error' : 'default'} → invalid={cond}
 *   variant="default" | "outline"       → (default, removed)
 *   variant="quiet"                     → variant="ghost"
 * Select
 *   onChange   → onValueChange (it always passed the value)
 *   ariaLabel  → aria-label (was dropped before Select spread its props)
 * Textarea with a label, counter or rich text (title, showInfo, info,
 * mandatory, supportingText, richText, maxLength)
 *   onChange   → onValueChange (it passed the text, not the event)
 * Toggle, SubTabs
 *   active / activeKey → value, onChange → onValueChange,
 *   size="S" → size="sm", size="M" → (default, removed)
 *
 * What it can't decide (other variant expressions, spread props) is
 * reported; the components still accept the old names with a dev warning.
 *
 * usage: node scripts/codemods/form-controls.mjs [--dry] <dir|file>...
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const COMPONENTS = ['Input', 'Select', 'Textarea', 'Toggle', 'SubTabs'];
const FIELDS = new Set(['Input', 'Select', 'Textarea']);
const ENHANCED_TEXTAREA = new Set(['title', 'showInfo', 'info', 'mandatory', 'supportingText', 'richText', 'maxLength']);
const SKIP = [/\/scripts\/codemods\//, /\/lib\/legacyProps\.js$/];
SKIP.push(...COMPONENTS.map(c => new RegExp(`/components/${c}/${c}\\.jsx$`)));

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const roots = args.filter(a => a !== '--dry');
const report = [];

const isStr = (n) => n && n.type === 'StringLiteral';
const literalOf = (v) => (isStr(v) ? v.value : v?.type === 'JSXExpressionContainer' && isStr(v.expression) ? v.expression.value : null);
const isDefaultLook = (n) => !n || (n.type === 'Identifier' && n.name === 'undefined')
  || (isStr(n) && (n.value === 'default' || n.value === 'outline'));

function localNames(ast, file) {
  const local = {};
  for (const n of ast.program.body) {
    if (n.type !== 'ImportDeclaration') continue;
    for (const c of COMPONENTS) {
      const own = n.source.value === `./${c}` && file.includes(`/components/${c}/`);
      if (!n.source.value.endsWith(`/${c}/${c}`) && !own) continue;
      for (const s of n.specifiers) if ((s.imported?.name || s.local.name) === c) local[s.local.name] = c;
    }
  }
  return local;
}

function migrateFile(file, src) {
  let ast;
  try { ast = parse(src, { sourceType: 'module', plugins: ['jsx'] }); } catch { return null; }
  const local = localNames(ast, file);
  if (!Object.keys(local).length) return { out: src, n: 0 };
  const edits = [];
  const text = (n) => src.slice(n.start, n.end);
  const replace = (n, t) => { if (text(n) !== t) edits.push({ start: n.start, end: n.end, text: t }); };
  const remove = (a) => {
    let s = a.start;
    while (s > 0 && /\s/.test(src[s - 1])) s--;
    edits.push({ start: s, end: a.end, text: '' });
  };
  const rename = (attr, name) => replace(attr.name, name);

  traverse(ast, {
    JSXOpeningElement(p) {
      const c = local[p.node.name.name];
      if (!c) return;
      const where = `${file}:${p.node.loc.start.line} <${p.node.name.name}>`;
      const attrs = p.node.attributes.filter(a => a.type === 'JSXAttribute');
      const get = (n) => attrs.find(a => a.name.name === n);
      if (p.node.attributes.some(a => a.type === 'JSXSpreadAttribute')) report.push(`${where} spreads props (check them by hand)`);

      if (FIELDS.has(c)) {
        const variant = get('variant');
        if (variant) {
          const lit = literalOf(variant.value);
          const e = variant.value?.type === 'JSXExpressionContainer' ? variant.value.expression : null;
          if (lit === 'error') replace(variant, 'invalid');
          else if (lit === 'default' || lit === 'outline') remove(variant);
          else if (lit === 'quiet') replace(variant, 'variant="ghost"');
          else if (lit === 'ghost') { /* already canonical */ }
          else if (e?.type === 'ConditionalExpression' && isStr(e.consequent) && e.consequent.value === 'error' && isDefaultLook(e.alternate)) {
            replace(variant, `invalid={${text(e.test)}}`);
          } else report.push(`${where} variant=${text(variant.value)}`);
        }
      }

      const onChange = get('onChange');
      if (c === 'Select') {
        if (onChange) rename(onChange, 'onValueChange');
        const ariaLabel = get('ariaLabel');
        if (ariaLabel) rename(ariaLabel, 'aria-label');
      }
      // With onValueChange already there, onChange is the native event on purpose.
      if (c === 'Textarea' && onChange && !get('onValueChange') && attrs.some(a => ENHANCED_TEXTAREA.has(a.name.name))) {
        rename(onChange, 'onValueChange');
      }

      if (c === 'Toggle' || c === 'SubTabs') {
        const active = get(c === 'Toggle' ? 'active' : 'activeKey');
        if (active) rename(active, 'value');
        if (onChange) rename(onChange, 'onValueChange');
        const size = get('size');
        const lit = size && literalOf(size.value);
        if (lit === 'S') replace(size, 'size="sm"');
        else if (lit === 'M') remove(size);
        else if (size && lit == null) report.push(`${where} size=${text(size.value)}`);
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
