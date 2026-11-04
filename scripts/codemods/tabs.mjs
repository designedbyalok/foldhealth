#!/usr/bin/env node
/**
 * Codemod: TabStrip / SubTabs → Tabs, OverflowTabStrip → OverflowTabs,
 * Toggle → SegmentedControl (docs/components/library-contract.mdx).
 *
 *   <TabStrip activeKey onChange size="S">  → <Tabs value onValueChange size="sm">
 *   <SubTabs tabs={…}>                      → <Tabs variant="pill" items={…}>
 *   <OverflowTabStrip activeKey onChange>   → <OverflowTabs value onValueChange>
 *   <Toggle …>                              → <SegmentedControl …>
 *
 * Imports are re-pointed and de-duplicated. Spread props are reported; the
 * old components still work.
 *
 * usage: node scripts/codemods/tabs.mjs [--dry] <dir|file>...
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// old name → [new name, new import path tail, old import path tail]
const MOVES = {
  TabStrip: ['Tabs', 'Tabs/Tabs', 'TabStrip/TabStrip'],
  SubTabs: ['Tabs', 'Tabs/Tabs', 'SubTabs/SubTabs'],
  OverflowTabStrip: ['OverflowTabs', 'Tabs/OverflowTabs', 'TabStrip/OverflowTabStrip'],
  Toggle: ['SegmentedControl', 'SegmentedControl/SegmentedControl', 'Toggle/Toggle'],
};
const SKIP = [/\/scripts\/codemods\//, /\/components\/(TabStrip|SubTabs|Toggle)\//];

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

  const local = {};
  const have = new Set();
  const decls = [];
  for (const n of ast.program.body) {
    if (n.type !== 'ImportDeclaration') continue;
    for (const [old, [next, nextPath, oldPath]] of Object.entries(MOVES)) {
      for (const s of n.specifiers) {
        const name = s.imported?.name || s.local.name;
        if (n.source.value.endsWith(`/${oldPath}`) && name === old) { local[s.local.name] = old; decls.push({ node: n, old }); }
        if (n.source.value.endsWith(`/${nextPath}`) && name === next) have.add(next);
      }
    }
  }
  if (!Object.keys(local).length) return { out: src, n: 0 };

  for (const { node, old } of decls) {
    const [next, nextPath, oldPath] = MOVES[old];
    if (node.specifiers.length !== 1) { report.push(`${file}: import of ${old} has other specifiers (fix by hand)`); continue; }
    if (have.has(next)) {
      let end = node.end;
      if (src[end] === '\n') end++;
      replace(node.start, end, '');
    } else {
      replace(node.start, node.end, text(node).replace(oldPath, nextPath).replace(new RegExp(`\\b${old}\\b`), next));
      have.add(next);
    }
  }

  traverse(ast, {
    JSXElement(p) {
      const open = p.node.openingElement;
      const old = local[open.name.name];
      if (!old) return;
      const [next] = MOVES[old];
      const where = `${file}:${open.loc.start.line} <${old}>`;
      const attrs = open.attributes.filter(a => a.type === 'JSXAttribute');
      const get = (n) => attrs.find(a => a.name.name === n);
      if (open.attributes.some(a => a.type === 'JSXSpreadAttribute')) report.push(`${where} spreads props (check them by hand)`);

      replace(open.name.start, open.name.end, next);
      if (p.node.closingElement) replace(p.node.closingElement.name.start, p.node.closingElement.name.end, next);
      if (old === 'Toggle') return;

      const first = open.attributes[0];
      const lineBreak = first && src.slice(open.name.end, first.start).includes('\n');
      const sep = lineBreak ? src.slice(open.name.end, first.start).replace(/^[^\n]*/, '') : ' ';
      if (old === 'SubTabs') {
        replace(open.name.end, open.name.end, `${sep}variant="pill"`);
        const tabs = get('tabs');
        if (tabs) replace(tabs.name.start, tabs.name.end, 'items');
      }
      const activeKey = get('activeKey');
      if (activeKey) replace(activeKey.name.start, activeKey.name.end, 'value');
      const onChange = get('onChange');
      if (onChange) replace(onChange.name.start, onChange.name.end, 'onValueChange');
      const size = get('size');
      const lit = size && literalOf(size.value);
      if (lit === 'S') replace(size.start, size.end, 'size="sm"');
      else if (lit === 'M') removeAttr(size);
      else if (size && lit == null) report.push(`${where} size=${text(size.value)}`);
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
