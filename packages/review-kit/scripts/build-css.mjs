// Flatten src/styles.css (and its @imports) into dist/styles.css, so
// consumers import one plain stylesheet: 'review-dock/styles.css'.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = new URL('../src/', import.meta.url);
const out = new URL('../dist/styles.css', import.meta.url);

const inline = (file) => readFileSync(new URL(file, src), 'utf8')
  .replace(/^@import\s+['"](.+?)['"];\s*$/gm, (_m, path) => inline(path));

mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(out, inline('styles.css'));
console.log('dist/styles.css written');
