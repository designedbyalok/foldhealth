#!/usr/bin/env node
/**
 * Codemod: hand a Button's own busy state to its `loading` prop.
 *
 *   <Button disabled={saving || !name} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
 *   → <Button disabled={!name} onClick={save} loading={saving}>Save</Button>
 *
 * Only buttons whose label switches on a busy flag are touched (that label
 * marks the button doing the work; a Cancel that is merely disabled while
 * saving is left alone). The steady label keeps the width from jumping, and
 * the flag leaves `disabled` because `loading` already ignores clicks.
 *
 * Edits are applied at exact offsets, so nothing else is reformatted.
 *
 * usage: node scripts/codemods/button-loading.mjs [--dry] <dir|file>...
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const BUSY = /^(is)?(saving|submitting|sending|loading|busy|pending|creating|deleting|removing|uploading|signing|publishing|applying|importing|exporting|generating|processing|approving|archiving|sharing|inviting|resetting|syncing|fetching|working|running|starting|attesting|claiming|scheduling|updating|retrying|restoring|cancelling|canceling|confirming|completing|marking|resending|testing|verifying|connecting|disconnecting|unlocking|locking|merging|moving|copying|downloading)([A-Z]\w*)?$/i;
const BUSY_LABEL = /(ing|…|\.\.\.)\s*$/;

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const roots = args.filter(a => a !== '--dry');

function isBusyRef(node) {
  if (node.type === 'Identifier') return BUSY.test(node.name);
  if (node.type === 'MemberExpression' && !node.computed) return BUSY.test(node.property.name);
  return false;
}

function migrateFile(file, src) {
  let ast;
  try { ast = parse(src, { sourceType: 'module', plugins: ['jsx'] }); } catch { return null; }
  const imported = new Set();
  for (const node of ast.program.body) {
    if (node.type !== 'ImportDeclaration') continue;
    for (const s of node.specifiers) {
      if (s.local.name === 'Button' && node.source.value.endsWith('/Button/Button')) imported.add('Button');
      if (s.local.name === 'ActionButton' && node.source.value.endsWith('/ActionButton/ActionButton')) imported.add('ActionButton');
    }
  }
  if (!imported.size) return null;
  const text = (n) => src.slice(n.start, n.end);
  const edits = [];

  traverse(ast, {
    JSXElement(p) {
      const open = p.node.openingElement;
      if (!imported.has(open.name.name)) return;
      const attrs = open.attributes.filter(a => a.type === 'JSXAttribute');
      if (attrs.some(a => a.name.name === 'loading')) return;
      const label = p.node.children.find(c => c.type === 'JSXExpressionContainer'
        && c.expression.type === 'ConditionalExpression'
        && isBusyRef(c.expression.test)
        && c.expression.consequent.type === 'StringLiteral'
        && BUSY_LABEL.test(c.expression.consequent.value));
      if (!label) return;
      const flag = text(label.expression.test);
      const alt = label.expression.alternate;
      if (alt.type === 'StringLiteral' && /[{}<>]/.test(alt.value)) return;
      edits.push({ start: label.start, end: label.end, text: alt.type === 'StringLiteral' ? alt.value : `{${text(alt)}}` });

      const dis = attrs.find(a => a.name.name === 'disabled');
      if (dis?.value?.type === 'JSXExpressionContainer') {
        const operands = [];
        const collect = (e) => {
          if (e.type === 'LogicalExpression' && e.operator === '||') { collect(e.left); collect(e.right); } else operands.push(e);
        };
        collect(dis.value.expression);
        const kept = operands.filter(e => text(e) !== flag);
        if (kept.length !== operands.length) {
          if (!kept.length) {
            let s = dis.start;
            while (s > 0 && /\s/.test(src[s - 1])) s--;
            edits.push({ start: s, end: dis.end, text: '' });
          } else {
            edits.push({ start: dis.start, end: dis.end, text: `disabled={${kept.map(text).join(' || ')}}` });
          }
        }
      }
      // After the last attribute (or the tag name), on the same line.
      const last = open.attributes[open.attributes.length - 1];
      const at = last ? last.end : open.name.end;
      edits.push({ start: at, end: at, text: ` loading={${flag}}` });
    },
  });

  edits.sort((x, y) => y.start - x.start || y.end - x.end);
  let out = src;
  let last = Infinity;
  for (const e of edits) {
    if (e.end > last) throw new Error(`${file}: overlapping edits`);
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

let buttons = 0;
let touched = 0;
for (const root of roots) {
  for (const f of files(root)) {
    if (!/\.jsx$/.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    if (!/<(Action)?Button\b/.test(src)) continue;
    const r = migrateFile(f, src);
    if (!r?.n) continue;
    touched++;
    buttons += (r.out.match(/ loading=\{/g) || []).length - (src.match(/ loading=\{/g) || []).length;
    if (!dry) fs.writeFileSync(f, r.out);
  }
}
console.log(`${dry ? '[dry] ' : ''}${buttons} button(s) in ${touched} file(s).`);
