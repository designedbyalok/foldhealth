#!/usr/bin/env node
/**
 * Codemod: Badge onto tone / variant / size (docs/components/library-contract.mdx).
 *
 * 1. The old feature looks ('toc-enrolled', 'compliance-pass', 'ai-neutral', …)
 *    are distinctive strings, so every string literal holding one becomes its
 *    tone, wherever it sits. That rewrites the features' status tables in place.
 * 2. On <Badge>:
 *      variant="status-failed"   → tone="danger"
 *      variant={expr}            → tone={expr}      (expr now yields tones)
 *      tone="grey"               → (default, removed)
 *      tone="white" / "ghost"    → variant="outline" / variant="ghost"
 *      tone="error"              → tone="danger"
 *      tone="disabled"           → disabled
 *      size="XS" | "S" | "M" | "L" → "xs" | "sm" | "md" | "lg"
 * 3. Tables the same file feeds into a Badge `tone={…}` get 'grey' → 'neutral',
 *    'error' → 'danger', 'green' → 'success'.
 *
 * What it can't see (tables imported from another file, template strings) is
 * reported; Badge still accepts the old names at runtime with a dev warning.
 *
 * usage: node scripts/codemods/badge-tones.mjs [--dry] <dir|file>...
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const FEATURE_LOOK = {
  'lace-high': 'danger', 'lace-medium': 'warning', 'lace-low': 'success',
  'toc-enrolled': 'success', 'toc-engaged': 'info', 'toc-attempted': 'warning', 'toc-new': 'neutral', 'toc-oncall': 'primary',
  'status-ready': 'success', 'status-completed': 'success', 'status-oncall': 'success', 'status-scheduled': 'info',
  'status-queued': 'warning', 'status-failed': 'danger', 'status-review': 'warning',
  'ai-risk': 'danger', 'ai-care': 'primary', 'ai-social': 'warning', 'ai-med': 'success', 'ai-neutral': 'neutral',
  'outreach-48h': 'danger', 'outreach-7d': 'info',
  'dos-source-documents': 'neutral', 'dos-source-claims': 'primary', 'dos-source-manual': 'secondary',
  'care-plan-none': 'neutral', 'care-plan-updated': 'success', 'care-plan-pending': 'warning',
  'awv-open': 'info', 'awv-new': 'info', 'awv-unable': 'neutral', 'awv-engaged': 'success', 'awv-attempted': 'warning', 'awv-engaged-followup': 'warning',
  'compliance-pass': 'success', 'compliance-fail': 'danger', 'compliance-warn': 'warning', 'compliance-na': 'neutral', 'compliance-emergency': 'danger',
  'priority-critical': 'danger', 'priority-high': 'secondary', 'priority-medium': 'warning', 'priority-low': 'neutral',
  'outreach-appointment': 'info', 'outreach-refill': 'success', 'outreach-care-gap': 'warning', 'outreach-post-visit': 'primary', 'outreach-waitlist': 'neutral',
  'quality-good': 'success', 'quality-fair': 'warning', 'quality-poor': 'danger',
  'sentiment-positive': 'success', 'sentiment-neutral': 'neutral', 'sentiment-negative': 'danger',
  'health-ok': 'success', 'health-degraded': 'warning', 'health-down': 'danger',
  // Never had a class (rendered unstyled); the neutral pill is what it meant.
  'snp-new': 'neutral',
};
// Common words: only rewritten as a literal on <Badge variant="…">.
const BADGE_ONLY_LOOK = { yes: 'danger', no: 'neutral', overflow: 'neutral' };
const TONE_ALIAS = { grey: 'neutral', error: 'danger', green: 'success' };
const SIZE = { XS: 'xs', S: 'sm', M: 'md', L: 'lg' };
const SKIP = [/\/components\/Badge\/Badge\.jsx$/, /\/scripts\/codemods\//];

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
  const replace = (n, t) => { if (text(n) !== t) edits.push({ start: n.start, end: n.end, text: t }); };
  const remove = (a) => {
    let s = a.start;
    while (s > 0 && /\s/.test(src[s - 1])) s--;
    edits.push({ start: s, end: a.end, text: '' });
  };
  const quoted = (n, v) => { const q = text(n)[0]; return q === '"' || q === "'" ? `${q}${v}${q}` : `'${v}'`; };
  const touched = new Set();
  const swapString = (n, table) => {
    if (!isStr(n) || !(n.value in table) || touched.has(n.start)) return;
    touched.add(n.start);
    replace(n, quoted(n, table[n.value]));
  };

  // 1. Distinctive feature-look strings, anywhere except JSX attribute values
  //    (step 2 owns those on <Badge>; on anything else they're reported).
  traverse(ast, {
    StringLiteral(p) {
      if (p.parent.type === 'JSXAttribute') {
        const el = p.parentPath.parent;
        if (p.node.value in FEATURE_LOOK && el.name?.name !== 'Badge') report.push(`${file}:${p.node.loc.start.line} <${el.name?.name}> ${p.parent.name.name}="${p.node.value}"`);
        return;
      }
      swapString(p.node, FEATURE_LOOK);
    },
  });

  const importsBadge = ast.program.body.some(n => n.type === 'ImportDeclaration'
    && n.source.value.endsWith('/Badge/Badge') && n.specifiers.some(s => s.local.name === 'Badge'))
    || file.endsWith('/Badge/Badge.stories.jsx');
  const bindings = new Map();
  if (importsBadge) {
    traverse(ast, {
      VariableDeclarator(p) { if (p.node.id.type === 'Identifier' && p.node.init) bindings.set(p.node.id.name, p.node.init); },
      FunctionDeclaration(p) { if (p.node.id) bindings.set(p.node.id.name, p.node); },
    });
  }
  const roots = (e, out = new Set()) => {
    if (!e) return out;
    if (e.type === 'Identifier') out.add(e.name);
    else if (e.type === 'MemberExpression' || e.type === 'OptionalMemberExpression') { roots(e.object, out); if (e.computed) roots(e.property, out); }
    else if (e.type === 'CallExpression' || e.type === 'OptionalCallExpression') roots(e.callee, out);
    else if (e.type === 'LogicalExpression' || e.type === 'BinaryExpression') { roots(e.left, out); roots(e.right, out); }
    else if (e.type === 'ConditionalExpression') { roots(e.consequent, out); roots(e.alternate, out); }
    return out;
  };
  const rewriteToneSource = (expr, where) => {
    const seen = new Set();
    const visit = (node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      traverse(node, {
        noScope: true,
        StringLiteral(q) {
          if (q.node.value in TONE_ALIAS) swapString(q.node, TONE_ALIAS);
          else if (['white', 'ghost', 'disabled'].includes(q.node.value)) report.push(`${where} tone source holds '${q.node.value}' (set variant / disabled by hand)`);
        },
      }, null, {});
    };
    // The expression itself ({x || 'grey'}) and the local tables it reads.
    if (isStr(expr)) swapString(expr, TONE_ALIAS); else visit({ type: 'File', program: { type: 'Program', body: [{ type: 'ExpressionStatement', expression: expr }] } });
    for (const name of roots(expr)) {
      const b = bindings.get(name);
      if (b) visit({ type: 'File', program: { type: 'Program', body: [b.type === 'FunctionDeclaration' ? b : { type: 'ExpressionStatement', expression: b }] } });
    }
  };

  if (importsBadge) {
    traverse(ast, {
      JSXOpeningElement(p) {
        if (p.node.name.name !== 'Badge') return;
        const attrs = p.node.attributes.filter(a => a.type === 'JSXAttribute');
        const get = (n) => attrs.find(a => a.name.name === n);
        const where = `${file}:${p.node.loc.start.line}`;
        const variant = get('variant');
        let tone = get('tone');
        const size = get('size');

        if (size) {
          const lit = literalOf(size.value);
          if (lit in SIZE) replace(size, `size="${SIZE[lit]}"`);
          else if (size.value?.type === 'JSXExpressionContainer') {
            const e = size.value.expression;
            if (e.type === 'ConditionalExpression' && isStr(e.consequent) && isStr(e.alternate) && e.consequent.value in SIZE && e.alternate.value in SIZE) {
              replace(e.consequent, quoted(e.consequent, SIZE[e.consequent.value]));
              replace(e.alternate, quoted(e.alternate, SIZE[e.alternate.value]));
            } else report.push(`${where} size=${text(size.value)}`);
          }
        }

        if (variant) {
          const lit = literalOf(variant.value);
          // Step 1 may already have turned a feature look into a tone name.
          const look = lit == null ? null
            : lit === 'notification' ? 'notification'
            : FEATURE_LOOK[lit] || BADGE_ONLY_LOOK[lit] || (['neutral', 'primary', 'secondary', 'success', 'warning', 'danger', 'info'].includes(lit) ? lit : null);
          if (look) {
            if (tone) { remove(tone); tone = null; }
            const t = look === 'notification' ? 'tone="secondary" variant="solid"' : look === 'neutral' ? '' : `tone="${look}"`;
            if (t) replace(variant, t); else remove(variant);
            return;
          }
          if (lit == null && variant.value) {
            if (tone) { report.push(`${where} has both tone and a dynamic variant`); }
            else {
              replace(variant.name, 'tone');
              rewriteToneSource(variant.value.expression, where);
            }
            return;
          }
          if (lit != null) report.push(`${where} variant="${lit}"`);
        }

        if (tone) {
          const lit = literalOf(tone.value);
          if (lit === 'grey') remove(tone);
          else if (lit === 'white' || lit === 'ghost') {
            if (get('variant')) report.push(`${where} tone="${lit}" with a variant`);
            else replace(tone, `variant="${lit === 'white' ? 'outline' : 'ghost'}"`);
          } else if (lit === 'disabled') replace(tone, 'disabled');
          else if (lit in TONE_ALIAS) replace(tone, `tone="${TONE_ALIAS[lit]}"`);
          else if (lit == null && tone.value) rewriteToneSource(tone.value.expression, where);
        }
      },
    });
  }

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
