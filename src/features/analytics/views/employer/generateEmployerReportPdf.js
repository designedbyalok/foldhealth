/**
 * Employer Impact Report as a PDF (jsPDF, the same library as the care
 * plan export), in the report format of Figma 5635:12209: an A4 page with
 * a branded header and footer on every page, sections titled over a short
 * rule with their note as body text, and charts in two-up cards.
 *
 * Charts are drawn natively from the same widget models the page renders,
 * so the PDF shows exactly what the report does, without screenshotting
 * the DOM. Chart colours are read from the design tokens.
 */
import jsPDF from 'jspdf';
import { formatValue, compactTick, niceTicks } from './employerImpactFormat';
import { parseGradient } from '../../../email-builder/colorHelpers';

// A4 in points, laid out as in the Figma frame.
const PAGE = { w: 595, h: 842 };
const MARGIN = 24;
const CONTENT_W = PAGE.w - MARGIN * 2;
const HEADER_H = 80;
const BAND_H = 16;
const FOOTER_H = 24;
const BODY_TOP = HEADER_H + BAND_H + 12;
const BODY_BOTTOM = PAGE.h - FOOTER_H - 12;
const GAP = 6;
const CARD_H = 161;
const CARD_PAD = 6;       // Figma: 6pt padding in the card header and the chart area
const CARD_HEAD_H = 30;   // 6 + title (8pt) + 0.8 gap + range (6pt) + 6
const SAVINGS_H = 62;

// Figma "Colors/…" values; jsPDF takes RGB, not CSS variables.
const C = {
  black: [22, 24, 29],      // Monochrome/Black #16181D
  body: [58, 72, 95],       // Grey/400 #3A485F
  muted: [111, 122, 144],   // Grey/300 #6F7A90
  faint: [138, 148, 168],   // Grey/200 #8A94A8
  border: [233, 236, 241],  // Grey/100 #E9ECF1
  grid: [240, 242, 245],
  white: [255, 255, 255],
  line: [111, 122, 144],
  gain: [18, 183, 106],
  loss: [217, 45, 32],
  // Report brand band (header stripe and footer).
  bandTeal: [124, 206, 211],  // #7CCED3
  bandBlue: [19, 118, 188],   // #1376BC
};

const TICK = 6;     // axis tick and legend text
const LABEL = 6;    // axis titles

// ── Colours from tokens ──
function parseColor(value) {
  const v = (value || '').trim();
  // Alpha (#RGBA / #RRGGBBAA) is dropped: a PDF page has nothing beneath to blend with.
  const hex = v.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const h = hex[1].length <= 4 ? hex[1].slice(0, 3).split('').map(c => c + c).join('') : hex[1].slice(0, 6);
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  const rgb = v.match(/rgba?\(([^)]+)\)/i);
  if (rgb) return rgb[1].split(',').slice(0, 3).map(n => Math.round(parseFloat(n)));
  return null;
}

function tokenPalette() {
  const fallback = [[126, 160, 214], [190, 214, 245], [141, 226, 208], [193, 160, 214], [184, 199, 143]];
  if (typeof document === 'undefined') return fallback;
  const cs = getComputedStyle(document.documentElement);
  return Array.from({ length: 12 }, (_, i) => parseColor(cs.getPropertyValue(`--chart-${i + 1}`)) || fallback[i % fallback.length]);
}

// ── Small drawing helpers ──
const fill = (doc, rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
const stroke = (doc, rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
const ink = (doc, rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

// ── Fonts ──
// Inter when the caller supplies it (jsPDF embeds TTFs), else Helvetica.
// Set per generateEmployerReportPdf call, which runs synchronously.
let FAMILY = 'helvetica';
let MEDIUM = ['helvetica', 'bold'];
let SEMIBOLD = ['helvetica', 'bold'];

const INTER_FILES = [
  ['regular', 'Inter-Regular.ttf', 'Inter', 'normal'],
  ['bold', 'Inter-Bold.ttf', 'Inter', 'bold'],
  ['italic', 'Inter-Italic.ttf', 'Inter', 'italic'],
  ['boldItalic', 'Inter-BoldItalic.ttf', 'Inter', 'bolditalic'],
  ['medium', 'Inter-Medium.ttf', 'InterMedium', 'normal'],
  ['semibold', 'Inter-SemiBold.ttf', 'InterSemiBold', 'normal'],
];

/**
 * Registers Inter on `doc` from base64 TTFs; falls back to Helvetica if a
 * core weight is missing. SemiBold (cover title only) is optional and
 * falls back to Inter Bold.
 */
function registerFonts(doc, fonts) {
  const core = INTER_FILES.filter(([key]) => key !== 'semibold');
  if (!fonts || core.some(([key]) => !fonts[key])) {
    FAMILY = 'helvetica';
    MEDIUM = ['helvetica', 'bold'];
    SEMIBOLD = ['helvetica', 'bold'];
    return;
  }
  INTER_FILES.forEach(([key, file, family, style]) => {
    if (!fonts[key]) return;
    doc.addFileToVFS(file, fonts[key]);
    doc.addFont(file, family, style);
  });
  FAMILY = 'Inter';
  MEDIUM = ['InterMedium', 'normal'];
  SEMIBOLD = fonts.semibold ? ['InterSemiBold', 'normal'] : ['Inter', 'bold'];
}

function setWeight(doc, weight) {
  if (weight === 'medium') doc.setFont(MEDIUM[0], MEDIUM[1]);
  else if (weight === 'semibold') doc.setFont(SEMIBOLD[0], SEMIBOLD[1]);
  else doc.setFont(FAMILY, weight === 'bold' ? 'bold' : 'normal');
}

function text(doc, str, x, y, { size = 8, color = C.body, weight = 'regular', align = 'left', baseline = 'alphabetic', angle } = {}) {
  setWeight(doc, weight);
  doc.setFontSize(size);
  ink(doc, color);
  doc.text(String(str), x, y, { align, baseline, ...(angle != null ? { angle } : {}) });
}

/** `str` shortened with "…" to fit `maxW`, measured in the font it will draw in. */
function fitText(doc, str, maxW, size, weight = 'regular') {
  setWeight(doc, weight);
  doc.setFontSize(size);
  const s = String(str);
  if (doc.getTextWidth(s) <= maxW) return s;
  let out = s;
  while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxW) out = out.slice(0, -1);
  return `${out}…`;
}

// ── Rich text (section notes) ──
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };
const decode = (t) => t.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (ENTITIES[e.toLowerCase()] != null) return ENTITIES[e.toLowerCase()];
  if (e[0] === '#') return String.fromCharCode(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return m;
});

/**
 * The Textarea's rich-text HTML as paragraphs of styled runs:
 * `[[{ text, bold, italic, underline, strike }]]`. Handles what its toolbar
 * produces (b/strong, i/em, u, s/strike/del, br, div/p, ul/ol/li); other
 * tags are dropped and their text kept.
 */
export function parseRichText(html) {
  const paragraphs = [[]];
  const style = { bold: 0, italic: 0, underline: 0, strike: 0 };
  const TAG = { b: 'bold', strong: 'bold', i: 'italic', em: 'italic', u: 'underline', s: 'strike', strike: 'strike', del: 'strike' };
  const plainRun = (text) => ({ text, bold: false, italic: false, underline: false, strike: false });
  const lists = []; // open <ul>/<ol>, innermost last: { ordered, n }
  const newParagraph = () => { if (paragraphs[paragraphs.length - 1].length) paragraphs.push([]); };
  const re = /<\/?([a-z0-9]+)[^>]*>|([^<]+)/gi;
  let m;
  while ((m = re.exec(html || ''))) {
    if (m[2] != null) {
      const text = decode(m[2]);
      if (text) paragraphs[paragraphs.length - 1].push({ text, bold: !!style.bold, italic: !!style.italic, underline: !!style.underline, strike: !!style.strike });
      continue;
    }
    const tag = m[1].toLowerCase();
    const closing = m[0][1] === '/';
    if (TAG[tag]) style[TAG[tag]] = Math.max(0, style[TAG[tag]] + (closing ? -1 : 1));
    else if (tag === 'br') paragraphs.push([]);
    else if (tag === 'ul' || tag === 'ol') {
      if (closing) lists.pop(); else lists.push({ ordered: tag === 'ol', n: 0 });
      newParagraph();
    } else if (tag === 'li' && !closing) {
      // Each list item is its own line, led by a bullet or its number,
      // indented a step per level of nesting.
      newParagraph();
      const list = lists[lists.length - 1] || { ordered: false, n: 0 };
      list.n += 1;
      const indent = '    '.repeat(Math.max(0, lists.length - 1));
      paragraphs[paragraphs.length - 1].push(plainRun(`${indent}${list.ordered ? `${list.n}.` : '•'} `));
    } else if ((tag === 'div' || tag === 'p') && !closing) newParagraph();
  }
  return paragraphs.filter((p, i) => p.length || i < paragraphs.length - 1);
}

const fontStyle = (r) => (r.bold && r.italic ? 'bolditalic' : r.bold ? 'bold' : r.italic ? 'italic' : 'normal');

/** Wraps styled paragraphs to `width`; returns lines of positioned pieces. */
function layoutRichText(doc, paragraphs, width, size) {
  doc.setFontSize(size);
  const lines = [];
  paragraphs.forEach((runs) => {
    let line = [];
    let x = 0;
    const push = () => { lines.push(line); line = []; x = 0; };
    runs.forEach((run) => {
      doc.setFont(FAMILY, fontStyle(run));
      // Split on spaces but keep them, so words wrap and spacing survives.
      run.text.split(/(\s+)/).forEach((token) => {
        if (!token) return;
        // A word wider than the whole line (a long URL, a string with no
        // spaces) is broken across lines rather than running off the page.
        const pieces = [];
        if (token.trim() && doc.getTextWidth(token) > width) {
          let piece = '';
          for (const ch of token) {
            if (piece && doc.getTextWidth(piece + ch) > width) { pieces.push(piece); piece = ''; }
            piece += ch;
          }
          if (piece) pieces.push(piece);
        } else {
          pieces.push(token);
        }
        pieces.forEach((word) => {
          const w = doc.getTextWidth(word);
          if (x + w > width && x > 0 && word.trim()) push();
          if (!line.length && !word.trim()) return; // no leading space on a new line
          line.push({ ...run, text: word, x, w });
          x += w;
        });
      });
    });
    push();
  });
  return lines;
}

function drawRichLines(doc, lines, x, y, size, lineH, color) {
  doc.setFontSize(size);
  ink(doc, color);
  stroke(doc, color);
  doc.setLineWidth(0.4);
  lines.forEach((line, i) => {
    const by = y + lineH * i;
    line.forEach((piece) => {
      doc.setFont(FAMILY, fontStyle(piece));
      doc.text(piece.text, x + piece.x, by);
      if (piece.underline) doc.line(x + piece.x, by + 1.2, x + piece.x + piece.w, by + 1.2);
      if (piece.strike) doc.line(x + piece.x, by - size * 0.3, x + piece.x + piece.w, by - size * 0.3);
    });
  });
}

// ── Charts ──
function gridLines(doc, ticks, x, y, w, h) {
  const top = ticks[ticks.length - 1] || 1;
  stroke(doc, C.grid);
  doc.setLineWidth(0.5);
  ticks.forEach((t) => { const ty = y + h - (t / top) * h; doc.line(x, ty, x + w, ty); });
}

/** Tick labels down the left; returns the width they take plus a gap. */
function yLabels(doc, ticks, fmt, x, y, h) {
  const labels = ticks.map(fmt);
  setWeight(doc, 'regular');
  doc.setFontSize(TICK);
  const labelW = Math.max(...labels.map(l => doc.getTextWidth(l)));
  const top = ticks[ticks.length - 1] || 1;
  ticks.forEach((t, i) => {
    text(doc, labels[i], x + labelW, y + h - (t / top) * h, { size: TICK, color: C.muted, align: 'right', baseline: 'middle' });
  });
  return labelW + 5;
}

function xLabels(doc, labels, x0, slot, y) {
  const every = labels.length > 12 ? Math.ceil(labels.length / 12) : 1;
  labels.forEach((l, i) => {
    if (i % every) return;
    text(doc, fitText(doc, l, slot * every - 2, TICK), x0 + slot * i + slot / 2, y, { size: TICK, color: C.muted, align: 'center' });
  });
}

/** Dot legend, right-aligned on one line starting at `top`, as in the Figma cards. */
function legend(doc, items, x, top, w) {
  const y = top + TICK; // baseline of the first line
  let cx = x + w;
  setWeight(doc, 'regular');
  doc.setFontSize(TICK);
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const it = items[i];
    const width = 5 + doc.getTextWidth(it.label);
    cx -= width;
    if (cx < x) break;
    fill(doc, it.color);
    if (it.line) doc.rect(cx - 1, y - 2.4, 4, 1, 'F');
    else doc.circle(cx + 1.2, y - 2, 1.4, 'F');
    text(doc, it.label, cx + 4, y, { size: TICK, color: C.muted });
    cx -= 7;
  }
  return 9;
}

function emptyState(doc, x, y, w, h) {
  text(doc, 'No Data to show', x + w / 2, y + h / 2, { size: 7, color: C.faint, align: 'center', baseline: 'middle' });
}

/**
 * Frame for a cartesian chart: legend on top, rotated y title on the left,
 * x title centred below. Returns the plot rectangle inside it.
 */
function chartFrame(doc, { legendItems, yLabel, xLabel }, x, y, w, h) {
  const legendH = legendItems?.length ? legend(doc, legendItems, x, y, w) : 0;
  const yTitleW = yLabel ? LABEL + 3 : 0;
  const xTitleH = xLabel ? LABEL + 6 : 0;
  const top = y + legendH + 6;
  const bottom = y + h - xTitleH - 10; // room for the x tick labels
  if (yLabel) {
    // Rotated 90° it reads bottom-to-top from its start point, so start
    // half its length below the middle to centre it on the plot.
    const label = fitText(doc, yLabel, bottom - top, LABEL);
    const len = doc.getTextWidth(label); // fitText left the regular weight set
    text(doc, label, x + LABEL, (top + bottom) / 2 + len / 2, { size: LABEL, color: C.muted, angle: 90 });
  }
  return { x: x + yTitleW, top, h: Math.max(10, bottom - top), w: w - yTitleW, titleY: y + h, xLabel };
}

function xTitle(doc, frame) {
  if (frame.xLabel) text(doc, frame.xLabel, frame.plotX + frame.plotW / 2, frame.titleY, { size: LABEL, color: C.muted, align: 'center', baseline: 'bottom' });
}

function barChart(doc, { data, series, line, format, yLabel, xLabel }, palette, x, y, w, h) {
  const legendItems = series.map((s, i) => ({ label: s.label, color: palette[i % palette.length] }));
  if (line) legendItems.push({ label: line.label, color: C.line, line: true });
  const f = chartFrame(doc, { legendItems, yLabel, xLabel }, x, y, w, h);
  const max = Math.max(0, ...data.map(r => Math.max(series.reduce((a, s) => a + (r[s.key] || 0), 0), line ? r[line.key] || 0 : 0)));
  const ticks = format === 'percent' ? [0, 25, 50, 75, 100] : niceTicks(max);
  const axisW = yLabels(doc, ticks, compactTick(format), f.x, f.top, f.h);
  f.plotX = f.x + axisW;
  f.plotW = f.w - axisW;
  gridLines(doc, ticks, f.plotX, f.top, f.plotW, f.h);
  const top = ticks[ticks.length - 1] || 1;
  const slot = f.plotW / Math.max(1, data.length);
  const barW = Math.min(slot * 0.5, 14);
  data.forEach((r, i) => {
    let acc = 0;
    const bx = f.plotX + slot * i + (slot - barW) / 2;
    series.forEach((s, si) => {
      const v = r[s.key] || 0;
      if (!v) return;
      const by = f.top + f.h - ((acc + v) / top) * f.h;
      fill(doc, palette[si % palette.length]);
      doc.rect(bx, by, barW, (v / top) * f.h, 'F');
      acc += v;
    });
  });
  if (line) {
    stroke(doc, C.line);
    doc.setLineWidth(0.8);
    const pts = data.map((r, i) => [f.plotX + slot * i + slot / 2, f.top + f.h - ((r[line.key] || 0) / top) * f.h]);
    for (let i = 1; i < pts.length; i += 1) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    fill(doc, C.line);
    pts.forEach(([px, py]) => doc.circle(px, py, 1.3, 'F'));
  }
  xLabels(doc, data.map(r => r.x), f.plotX, slot, f.top + f.h + 8);
  xTitle(doc, f);
}

function lineChart(doc, { data, series, format, yLabel, xLabel }, palette, x, y, w, h) {
  const legendItems = series.map((s, i) => ({ label: s.label, color: palette[i % palette.length] }));
  const f = chartFrame(doc, { legendItems, yLabel, xLabel }, x, y, w, h);
  const ticks = niceTicks(Math.max(0, ...data.flatMap(r => series.map(s => r[s.key] || 0))));
  const axisW = yLabels(doc, ticks, compactTick(format), f.x, f.top, f.h);
  f.plotX = f.x + axisW;
  f.plotW = f.w - axisW;
  gridLines(doc, ticks, f.plotX, f.top, f.plotW, f.h);
  const top = ticks[ticks.length - 1] || 1;
  const slot = f.plotW / Math.max(1, data.length);
  series.forEach((s, si) => {
    const color = palette[si % palette.length];
    stroke(doc, color);
    doc.setLineWidth(0.8);
    const pts = data.map((r, i) => [f.plotX + slot * i + slot / 2, f.top + f.h - ((r[s.key] || 0) / top) * f.h]);
    for (let i = 1; i < pts.length; i += 1) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    fill(doc, color);
    pts.forEach(([px, py]) => doc.circle(px, py, 1.3, 'F'));
  });
  xLabels(doc, data.map(r => r.x), f.plotX, slot, f.top + f.h + 8);
  xTitle(doc, f);
}

function hbarChart(doc, { data, seriesKey, seriesLabel, format, xLabel }, palette, x, y, w, h) {
  const legendH = seriesLabel ? legend(doc, [{ label: seriesLabel, color: palette[0] }], x, y, w) : 0;
  const xTitleH = xLabel ? LABEL + 6 : 0;
  setWeight(doc, 'regular');
  doc.setFontSize(TICK);
  const labelW = Math.min(90, Math.max(...data.map(r => doc.getTextWidth(String(r.x)))) + 5);
  const ticks = niceTicks(Math.max(0, ...data.map(r => r[seriesKey] || 0)));
  const top = ticks[ticks.length - 1] || 1;
  const plotX = x + labelW;
  const plotW = w - labelW - 28;
  const areaTop = y + legendH + 4;
  const areaH = h - legendH - 4 - xTitleH;
  const rowH = Math.min(18, areaH / Math.max(1, data.length));
  data.forEach((r, i) => {
    const cy = areaTop + rowH * i + rowH / 2;
    text(doc, fitText(doc, r.x, labelW - 5, TICK), x, cy, { size: TICK, color: C.muted, baseline: 'middle' });
    const v = r[seriesKey] || 0;
    const bw = (v / top) * plotW;
    fill(doc, palette[0]);
    doc.rect(plotX, cy - Math.min(4, rowH * 0.3), Math.max(bw, 0.5), Math.min(8, rowH * 0.6), 'F');
    text(doc, formatValue(v, format), plotX + bw + 3, cy, { size: TICK, color: C.body, baseline: 'middle' });
  });
  if (xLabel) text(doc, xLabel, plotX + plotW / 2, y + h, { size: LABEL, color: C.muted, align: 'center', baseline: 'bottom' });
}

function donutChart(doc, { data, seriesKey }, palette, x, y, w, h) {
  const total = data.reduce((a, r) => a + (r[seriesKey] || 0), 0);
  const r = Math.min(h / 2 - 4, w * 0.2);
  const cx = x + r + 4;
  const cy = y + h / 2;
  let start = -Math.PI / 2;
  data.forEach((row, i) => {
    const v = row[seriesKey] || 0;
    if (!v || !total) return;
    const sweep = (v / total) * Math.PI * 2;
    fill(doc, palette[i % palette.length]);
    // A pie slice as a fan of thin triangles; the centre is cut out below.
    const steps = Math.max(2, Math.ceil(sweep / 0.08));
    for (let s = 0; s < steps; s += 1) {
      const a0 = start + (sweep * s) / steps;
      const a1 = start + (sweep * (s + 1)) / steps + 0.004;
      doc.triangle(cx, cy, cx + r * Math.cos(a0), cy + r * Math.sin(a0), cx + r * Math.cos(a1), cy + r * Math.sin(a1), 'F');
    }
    start += sweep;
  });
  fill(doc, C.white);
  doc.circle(cx, cy, r * 0.55, 'F');
  const lx = cx + r + 12;
  const lineH = Math.min(14, (h - 6) / Math.max(1, data.length));
  data.forEach((row, i) => {
    const ly = y + 6 + lineH * i + lineH / 2;
    fill(doc, palette[i % palette.length]);
    doc.circle(lx + 1.4, ly, 1.4, 'F');
    const v = row[seriesKey] || 0;
    const pct = total ? Math.round((v / total) * 100) : 0;
    text(doc, fitText(doc, row.x, x + w - lx - 56, TICK), lx + 6, ly, { size: TICK, color: C.muted, baseline: 'middle' });
    text(doc, `${formatValue(v)} (${pct}%)`, x + w, ly, { size: TICK, color: C.body, align: 'right', baseline: 'middle' });
  });
}

function statList(doc, stats, x, y, w) {
  const colW = w / Math.max(1, stats.length);
  stats.forEach((s, i) => {
    const sx = x + colW * i;
    text(doc, fitText(doc, s.label, colW - 6, TICK), sx, y + 8, { size: TICK, color: C.muted });
    text(doc, s.hasData ? `${s.pct}%` : '–', sx, y + 21, { size: 11, color: C.black, weight: 'bold' });
    if (s.hasData) text(doc, `${s.count.toLocaleString()} / ${s.total.toLocaleString()}`, sx, y + 30, { size: TICK, color: C.faint });
  });
  return 34;
}

function satisfaction(doc, model, widget, palette, x, y, w, h) {
  const colW = 88;
  text(doc, fitText(doc, model.form || 'Survey', colW, 7, 'medium'), x, y + 9, { size: 7, color: C.body, weight: 'medium' });
  text(doc, 'Average Score', x, y + 24, { size: TICK, color: C.muted });
  text(doc, model.averageScore ?? '–', x, y + 37, { size: 11, color: C.black, weight: 'bold' });
  text(doc, 'Total form sent', x, y + 54, { size: TICK, color: C.muted });
  text(doc, model.sent.toLocaleString(), x, y + 66, { size: 9, color: C.black, weight: 'bold' });
  text(doc, `Responded ${model.responded.toLocaleString()}`, x, y + 80, { size: TICK, color: C.muted });
  text(doc, `Not Responded ${model.notResponded.toLocaleString()}`, x, y + 90, { size: TICK, color: C.muted });
  barChart(doc, {
    data: model.data,
    series: [{ key: 'responded', label: 'Responded' }, { key: 'not_responded', label: 'Not Responded' }],
    format: 'percent',
    yLabel: widget.yLabel,
    xLabel: widget.xLabel,
  }, palette, x + colW + 6, y, w - colW - 6, h);
}

/** A widget's chart inside its card body. */
function widgetBody(doc, item, palette, x, y, w, h) {
  const { widget, model } = item;
  if (!model.hasData) { emptyState(doc, x, y, w, h); return; }
  const axes = { yLabel: widget.yLabel, xLabel: widget.xLabel, format: widget.format };
  switch (widget.type) {
    case 'stats': statList(doc, model.stats, x, y, w); return;
    case 'duration': hbarChart(doc, { data: model.data, seriesKey: 'in_person', seriesLabel: widget.series?.[0]?.label, format: 'minutes', xLabel: widget.xLabel }, palette, x, y, w, h); return;
    case 'satisfaction': satisfaction(doc, model, widget, palette, x, y, w, h); return;
    case 'donut': donutChart(doc, { data: model.data, seriesKey: widget.series[0].key }, palette, x, y, w, h); return;
    case 'hbar': hbarChart(doc, { data: model.data, seriesKey: widget.series[0].key, seriesLabel: widget.series[0].label, format: widget.format, xLabel: widget.xLabel }, palette, x, y, w, h); return;
    case 'line': lineChart(doc, { data: model.data, series: widget.series, ...axes }, palette, x, y, w, h); return;
    default: {
      let top = y;
      let height = h;
      if (model.sideStats?.length) {
        const used = statList(doc, model.sideStats, x, y, w);
        top += used;
        height -= used;
      }
      barChart(doc, { data: model.data, series: widget.series, line: widget.line, ...axes }, palette, x, top, w, height);
    }
  }
}

// ── Cards ──
/** Card with the Figma chart header: title, date range, hairline under. */
function card(doc, x, y, w, h, title, subtitle) {
  stroke(doc, C.border);
  doc.setLineWidth(0.5);
  fill(doc, C.white);
  doc.roundedRect(x, y, w, h, 4, 4, 'FD');
  const inner = w - CARD_PAD * 2;
  text(doc, fitText(doc, title, inner, 8, 'medium'), x + CARD_PAD, y + CARD_PAD, { size: 8, color: C.body, weight: 'medium', baseline: 'top' });
  if (subtitle) text(doc, fitText(doc, subtitle, inner, 6), x + CARD_PAD, y + CARD_PAD + 9.6 + 0.8, { size: 6, color: C.faint, baseline: 'top' });
  doc.line(x, y + CARD_HEAD_H, x + w, y + CARD_HEAD_H);
}

function savingsCard(doc, item, x, y, w) {
  const { card: c } = item;
  stroke(doc, C.border);
  doc.setLineWidth(0.5);
  fill(doc, C.white);
  doc.roundedRect(x, y, w, SAVINGS_H, 4, 4, 'FD');
  const headH = CARD_PAD * 2 + 9.6; // 6 + title (8pt) + 6
  text(doc, fitText(doc, c.title, w - CARD_PAD * 2, 8, 'medium'), x + CARD_PAD, y + CARD_PAD, { size: 8, color: C.body, weight: 'medium', baseline: 'top' });
  doc.line(x, y + headH, x + w, y + headH);
  if (!c.hasData) { emptyState(doc, x, y + headH, w, SAVINGS_H - headH); return; }
  const colW = (w - CARD_PAD * 2) / 3;
  [['Traditional Cost', formatValue(c.traditional, 'currency'), C.body],
    ['Our Cost', formatValue(c.ours, 'currency'), C.body],
    ['Savings Amt.', `${c.savings < 0 ? '-' : ''}${formatValue(Math.abs(c.savings), 'currency')}`, c.savings < 0 ? C.loss : C.gain],
  ].forEach(([label, value, color], i) => {
    const cx = x + CARD_PAD + colW * i;
    text(doc, label, cx, y + 34, { size: TICK, color: C.muted });
    text(doc, fitText(doc, value, colW - 6, 8, 'bold'), cx, y + 48, { size: 8, color, weight: 'bold' });
  });
}

// ── Page chrome ──
/** A closed polygon from absolute points. */
function polygon(doc, points) {
  const [x0, y0] = points[0];
  const deltas = points.slice(1).map(([px, py], i) => [px - points[i][0], py - points[i][1]]);
  doc.lines(deltas, x0, y0, [1, 1], 'F', true);
}

function pageHeader(doc, { title, generatedOn, logo, clientLogo }) {
  // Client logo on the left, in the Figma's 108 × 48 slot.
  if (clientLogo?.dataUrl) {
    const { w, h } = fitLogo(clientLogo, 108, 48);
    doc.addImage(clientLogo.dataUrl, clientLogo.format || 'PNG', MARGIN + (108 - w) / 2, 16 + (48 - h) / 2, w, h);
  }
  text(doc, title, PAGE.w / 2, 40, { size: 16, color: C.black, weight: 'medium', align: 'center' });
  text(doc, generatedOn, PAGE.w / 2, 53, { size: 10, color: C.faint, align: 'center' });
  // Employer logo on the right: the Fold Health wordmark by default, or
  // an uploaded one fitted to the 108 × 20 slot and right-aligned.
  if (logo?.dataUrl) {
    const { w, h } = logo.width ? fitLogo(logo, 108, 20) : { w: 108, h: 20 };
    doc.addImage(logo.dataUrl, logo.format || 'PNG', PAGE.w - MARGIN - w, 30 + (20 - h) / 2, w, h);
  }
  // Brand band: a teal block, four slashes, then a blue bar to the edge.
  const top = HEADER_H;
  const bottom = HEADER_H + BAND_H;
  fill(doc, C.bandTeal);
  polygon(doc, [[0, top], [140.5, top], [145, bottom], [0, bottom]]);
  fill(doc, C.bandBlue);
  for (let i = 0; i < 4; i += 1) {
    const sx = 145 + 8.5 * i;
    polygon(doc, [[sx, top], [sx + 4, top], [sx + 8.5, bottom], [sx + 4.5, bottom]]);
  }
  polygon(doc, [[179, top], [PAGE.w, top], [PAGE.w, bottom], [183.5, bottom]]);
}

function pageFooter(doc, page) {
  fill(doc, C.bandTeal);
  doc.rect(0, PAGE.h - FOOTER_H, PAGE.w, FOOTER_H, 'F');
  text(doc, String(page), PAGE.w / 2, PAGE.h - FOOTER_H / 2, { size: 10, color: C.white, align: 'center', baseline: 'middle' });
}

// ── Cover page (Figma 5634:11783) ──
const GRID_CELL = 18.1818;

/**
 * Cover background presets: CSS-style angle (180 = top to bottom) and
 * colour stops `[rgb, position 0–1]`. RGB, since they go straight into the
 * PDF; the first is the Figma cover. The pastel and deep rows are from the
 * Electronic ID Figma (834:44624). Exported so the drawer can show swatches.
 */
const vertical = (from, to) => ({ angle: 180, stops: [[from, 0], [to, 1]] });
const DIAGONAL = 138.08;
export const COVER_GRADIENTS = [
  { key: 'ocean', label: 'Ocean', ...vertical([19, 118, 188], [4, 51, 85]) },
  { key: 'violet', label: 'Violet', ...vertical([140, 90, 226], [52, 28, 110]) },
  { key: 'teal', label: 'Teal', ...vertical([22, 160, 160], [8, 70, 82]) },
  { key: 'graphite', label: 'Graphite', ...vertical([79, 90, 112], [22, 24, 29]) },
  // Pastels
  { key: 'frost', label: 'Frost', angle: DIAGONAL, stops: [[[238, 244, 255], 0], [[243, 247, 255], 0.38], [[184, 208, 255], 1]] },
  { key: 'honey', label: 'Honey', angle: DIAGONAL, stops: [[[255, 251, 236], 0], [[255, 228, 165], 1]] },
  { key: 'mint', label: 'Mint', angle: DIAGONAL, stops: [[[255, 255, 255], 0], [[178, 254, 251], 1]] },
  { key: 'blush', label: 'Blush', angle: DIAGONAL, stops: [[[255, 255, 255], 0], [[250, 206, 254], 1]] },
  { key: 'lavender', label: 'Lavender', angle: DIAGONAL, stops: [[[255, 255, 255], 0], [[216, 195, 255], 1]] },
  // Deep
  { key: 'amethyst', label: 'Amethyst', angle: DIAGONAL, stops: [[[164, 65, 250], 0], [[94, 9, 173], 0.38], [[37, 3, 114], 1]] },
  { key: 'lagoon', label: 'Lagoon', angle: DIAGONAL, stops: [[[53, 92, 118], 0], [[115, 188, 184], 1]] },
  { key: 'forest', label: 'Forest', angle: DIAGONAL, stops: [[[6, 146, 101], 0], [[2, 57, 2], 1]] },
  { key: 'sapphire', label: 'Sapphire', angle: DIAGONAL, stops: [[[17, 153, 244], 0], [[4, 23, 122], 1]] },
  { key: 'magenta', label: 'Magenta', angle: 138.56, stops: [[[202, 17, 244], 0], [[31, 29, 133], 0.8933]] },
];
export const DEFAULT_COVER_BACKGROUND = { type: 'gradient', gradient: 'ocean' };

export const hexToRgb = (hex) => parseColor(hex) || [19, 118, 188];
export const rgbCss = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;
/** A preset as a CSS background, for the drawer's swatches. */
export const gradientCss = (g) => `linear-gradient(${g.angle}deg, ${g.stops.map(([c, p]) => `${rgbCss(c)} ${Math.round(p * 1000) / 10}%`).join(', ')})`;
const gradientByKey = (key) => COVER_GRADIENTS.find(x => x.key === key) || COVER_GRADIENTS[0];

/**
 * A custom CSS gradient from the colour picker (`linear-gradient(90deg, #hex 0%, …)`
 * or `radial-gradient(…)`) in the preset shape: `{ type, angle, stops: [[rgb, 0–1]] }`.
 */
export function gradientFromCss(css) {
  const g = parseGradient(css);
  if (!g?.stops?.length) return null;
  const stops = g.stops
    .map(st => [parseColor(st.color), Math.max(0, Math.min(1, st.position / 100))])
    .filter(([c]) => c)
    .sort((a, b) => a[1] - b[1]);
  if (!stops.length) return null;
  return { type: g.type, angle: g.angle, stops };
}

/** The gradient a cover background describes: a custom CSS one, else a preset. */
const resolveGradient = (bg) => (bg?.css && gradientFromCss(bg.css)) || gradientByKey(bg?.gradient);

/** Colour at `t` (0–1) along a preset's stops. */
function colorAt(stops, t) {
  if (t <= stops[0][1]) return stops[0][0];
  for (let i = 1; i < stops.length; i += 1) {
    const [c1, p1] = stops[i];
    const [c0, p0] = stops[i - 1];
    if (t <= p1) {
      const k = p1 === p0 ? 1 : (t - p0) / (p1 - p0);
      return c0.map((c, j) => Math.round(c + (c1[j] - c) * k));
    }
  }
  return stops[stops.length - 1][0];
}

/** Relative luminance (WCAG), to choose light or dark cover text. */
function luminance([r, g, b]) {
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** True when the cover background is light enough to need dark text. */
export function isLightBackground(bg) {
  if (bg?.type === 'color') return luminance(hexToRgb(bg.color)) > 0.4;
  if (bg?.type === 'gradient') {
    // Average over the gradient, sampled, so a long light stop counts for more.
    const g = resolveGradient(bg);
    const samples = Array.from({ length: 9 }, (_, i) => luminance(colorAt(g.stops, i / 8)));
    return samples.reduce((a, b) => a + b, 0) / samples.length > 0.4;
  }
  return false; // images get a dark overlay
}

/**
 * A CSS-style linear gradient over the page, drawn as thin bands across the
 * gradient line (jsPDF has no simple gradient fill). The gradient line runs
 * through the page centre at `angle`, long enough that its ends touch the
 * corners, as CSS does.
 */
function pageGradient(doc, { angle, stops }) {
  const rad = (angle * Math.PI) / 180;
  const dir = [Math.sin(rad), -Math.cos(rad)];   // CSS: 0deg points up
  const perp = [-dir[1], dir[0]];
  const len = Math.abs(PAGE.w * dir[0]) + Math.abs(PAGE.h * dir[1]);
  const cx = PAGE.w / 2;
  const cy = PAGE.h / 2;
  const far = PAGE.w + PAGE.h; // band half-width, past every page edge
  const bands = 420;
  const at = (s, side) => [cx + dir[0] * s + perp[0] * far * side, cy + dir[1] * s + perp[1] * far * side];
  for (let i = 0; i < bands; i += 1) {
    const s0 = (i / bands - 0.5) * len - 0.4;       // slight overlap hides seams
    const s1 = ((i + 1) / bands - 0.5) * len + 0.4;
    fill(doc, colorAt(stops, (i + 0.5) / bands));
    polygon(doc, [at(s0, -1), at(s0, 1), at(s1, 1), at(s1, -1)]);
  }
}

/**
 * A CSS radial gradient (ellipse, farthest-corner, centred): filled ellipses
 * from the outside in, each a step closer to the first stop.
 */
function pageRadialGradient(doc, { stops }) {
  const rx = (PAGE.w / 2) * Math.SQRT2;
  const ry = (PAGE.h / 2) * Math.SQRT2;
  const rings = 240;
  fill(doc, colorAt(stops, 1));
  doc.rect(0, 0, PAGE.w, PAGE.h, 'F');
  for (let i = rings; i > 0; i -= 1) {
    const t = i / rings;
    fill(doc, colorAt(stops, t));
    doc.ellipse(PAGE.w / 2, PAGE.h / 2, rx * t, ry * t, 'F');
  }
}

/** An image scaled to cover the page (overflow falls off the page edge). */
function coverImage(doc, { dataUrl, format, width, height }) {
  const scale = Math.max(PAGE.w / width, PAGE.h / height);
  const w = width * scale;
  const h = height * scale;
  doc.addImage(dataUrl, format, (PAGE.w - w) / 2, (PAGE.h - h) / 2, w, h);
  // Darken it so the white cover text stays readable on any photo.
  fill(doc, [0, 0, 0]);
  doc.setGState(new doc.GState({ opacity: 0.4 }));
  doc.rect(0, 0, PAGE.w, PAGE.h, 'F');
  doc.setGState(new doc.GState({ opacity: 1 }));
}

/**
 * The cover's grid overlay: 0.5pt lines on an 18.18pt grid, fading
 * radially from 30% at the centre to nothing at the ellipse edge, like the
 * Figma's radial-gradient stroke. Segments are bucketed into a few
 * opacity steps so the PDF stays small.
 */
function fadingGrid(doc, color, x0, y0, w, h, cx, cy, rx, ry) {
  const buckets = new Map();
  const add = (x1, y1, x2, y2) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    if (mx < 0 || mx > PAGE.w || my < 0 || my > PAGE.h) return;
    const d = Math.hypot((mx - cx) / rx, (my - cy) / ry);
    if (d >= 1) return;
    const level = Math.round((1 - d) * 12) / 12;
    if (!level) return;
    if (!buckets.has(level)) buckets.set(level, []);
    buckets.get(level).push([x1, y1, x2, y2]);
  };
  for (let x = x0; x <= x0 + w + 0.1; x += GRID_CELL) {
    for (let y = y0; y < y0 + h - 0.1; y += GRID_CELL) add(x, y, x, Math.min(y + GRID_CELL, y0 + h));
  }
  for (let y = y0; y <= y0 + h + 0.1; y += GRID_CELL) {
    for (let x = x0; x < x0 + w - 0.1; x += GRID_CELL) add(x, y, Math.min(x + GRID_CELL, x0 + w), y);
  }
  stroke(doc, color);
  doc.setLineWidth(0.5);
  buckets.forEach((segments, level) => {
    // Figma blends the grid as "overlay", which reads softer than plain
    // lines would, so the 30% peak is halved.
    doc.setGState(new doc.GState({ 'stroke-opacity': 0.3 * level * 0.5 }));
    segments.forEach(([x1, y1, x2, y2]) => doc.line(x1, y1, x2, y2));
  });
  doc.setGState(new doc.GState({ 'stroke-opacity': 1 }));
}

/**
 * @param {object} cover
 * @param {string} cover.title
 * @param {string} cover.range
 * @param {string} [cover.description]
 * @param {object} [cover.background] – `{ type: 'color', color: '#RRGGBB' }`,
 *   `{ type: 'gradient', gradient: key }`, `{ type: 'gradient', css }` (a custom CSS
 *   gradient) or `{ type: 'image', dataUrl, format, width, height }`
 * @param {{ dataUrl }} [cover.logo]       – Employer logo (Fold Health wordmark by default)
 * @param {{ dataUrl }} [cover.clientLogo] – Provider logo for "Provided By"
 */
function coverPage(doc, { title, range, description, background = DEFAULT_COVER_BACKGROUND, logo, clientLogo }) {
  const light = isLightBackground(background);
  const ink1 = light ? C.black : [255, 255, 255];
  const ink2 = light ? C.body : [182, 216, 239]; // Figma #B6D8EF on the blue

  if (background.type === 'image' && background.dataUrl) {
    coverImage(doc, background);
  } else {
    if (background.type === 'color') {
      fill(doc, hexToRgb(background.color));
      doc.rect(0, 0, PAGE.w, PAGE.h, 'F');
    } else {
      const g = resolveGradient(background);
      if (g.type === 'radial') pageRadialGradient(doc, g);
      else pageGradient(doc, g);
    }
    // Two grid panels, as placed in the Figma frame (top right, bottom left).
    fadingGrid(doc, ink1, 0, -120, 800.5, 346, 400.25, 53, 323, 173);
    fadingGrid(doc, ink1, -205, 610, 800.5, 346, 195.25, 783, 323, 173);
  }

  // Centre stack: wordmark, 24pt gap, title, date range, description.
  const descW = 366;
  setWeight(doc, 'regular');
  doc.setFontSize(10);
  const descLines = description ? doc.splitTextToSize(description, descW) : [];
  setWeight(doc, 'semibold');
  doc.setFontSize(30);
  const titleLines = doc.splitTextToSize(title, 514);
  // Employer logo slot: 151 × 28 for the wordmark; uploads may be up to 48 tall.
  const logoBox = logo?.dataUrl ? (logo.width ? fitLogo(logo, 151, 48) : { w: 151, h: 28 }) : { w: 0, h: 0 };
  const logoH = logoBox.h;
  const titleH = titleLines.length * 36;
  const rangeH = 14.4;
  const descH = descLines.length * 12;
  const stackH = (logoH ? logoH + 24 : 0) + titleH + 4 + rangeH + (descLines.length ? 4 + descH : 0);
  let y = (PAGE.h - stackH) / 2;
  if (logo?.dataUrl) {
    doc.addImage(logo.dataUrl, logo.format || 'PNG', (PAGE.w - logoBox.w) / 2, y, logoBox.w, logoBox.h);
    y += logoH + 24;
  }
  titleLines.forEach((line, i) => {
    text(doc, line, PAGE.w / 2, y + 28 + i * 36, { size: 30, color: ink1, weight: 'semibold', align: 'center' });
  });
  y += titleH + 4;
  text(doc, range, PAGE.w / 2, y + 11, { size: 12, color: ink1, weight: 'medium', align: 'center' });
  y += rangeH;
  if (descLines.length) {
    setWeight(doc, 'regular');
    doc.setFontSize(10);
    ink(doc, ink2);
    doc.text(descLines, PAGE.w / 2, y + 4 + 9, { align: 'center', lineHeightFactor: 1.2 });
  }

  // "Provided By:" with the employer's logo, centred near the foot.
  if (clientLogo?.dataUrl) {
    setWeight(doc, 'medium');
    doc.setFontSize(12);
    const label = 'Provided By:';
    const labelW = doc.getTextWidth(label);
    const logoW = fitLogo(clientLogo, 54, 24);
    const gx = (PAGE.w - (labelW + 4 + 54)) / 2;
    text(doc, label, gx, 755 + 16, { size: 12, color: ink1, weight: 'medium' });
    doc.addImage(clientLogo.dataUrl, clientLogo.format || 'PNG', gx + labelW + 4 + (54 - logoW.w) / 2, 755 + (24 - logoW.h) / 2, logoW.w, logoW.h);
  }

  text(doc, '1', PAGE.w / 2, PAGE.h - 12, { size: 10, color: ink1, align: 'center', baseline: 'middle' });
}

/** A logo's size fitted inside a box, keeping its proportions. */
function fitLogo(logo, boxW, boxH) {
  const ratio = logo.width && logo.height ? logo.width / logo.height : 190 / 150;
  return ratio > boxW / boxH ? { w: boxW, h: boxW / ratio } : { w: boxH * ratio, h: boxH };
}

const pad = (n) => String(n).padStart(2, '0');
/** "Generated On : 09/25/2026 at 9:00 PM". */
export function generatedOnLabel(date = new Date()) {
  const h = date.getHours();
  const time = `${h % 12 || 12}:${pad(date.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
  return `Generated On : ${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} at ${time}`;
}

/**
 * @param {object} report
 * @param {string} report.title
 * @param {string} [report.meta]      – Filters in effect, one line (employer, view, time frame)
 * @param {Date}   [report.generatedAt]
 * @param {{ dataUrl: string }} [report.logo] – Employer logo, header right (Fold Health wordmark by default)
 * @param {{ dataUrl: string }} [report.clientLogo] – Provider logo, header left (Trailhead Clinics)
 * @param {object} [report.cover] – Adds the cover page: `{ range, description?,
 *   background?, logo?, clientLogo? }` (see coverPage)
 * @param {{ regular, medium, semibold, bold, italic, boldItalic }} [report.fonts] – Inter TTFs, base64;
 *   without them the PDF falls back to Helvetica
 * @param {{ id?: string, title: string, subtitle?: string, note?: string, items: object[] }[]} report.sections – `note` is
 *   the Textarea's rich-text HTML; items are
 *   `{ kind: 'widget', widget, model, full }` or `{ kind: 'savings', card }`
 * @returns {Blob} application/pdf
 */
export function generateEmployerReportPdf(report) {
  return generateEmployerReport(report).blob;
}

/**
 * The same PDF, plus where things landed: `anchors` maps 'cover' and each
 * section's `id` to its 1-based page, so a preview can scroll to what changed.
 *
 * @returns {{ blob: Blob, anchors: Object<string, number> }}
 */
export function generateEmployerReport(report) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  registerFonts(doc, report.fonts);
  const palette = tokenPalette();
  const hasCover = !!report.cover;
  const anchors = {};
  if (hasCover) {
    anchors.cover = 1;
    coverPage(doc, { title: report.title, ...report.cover });
    doc.addPage();
  }
  let y = BODY_TOP;

  const ensure = (needed) => {
    if (y + needed <= BODY_BOTTOM) return;
    doc.addPage();
    y = BODY_TOP;
  };

  if (report.meta) {
    text(doc, report.meta, MARGIN, y + 6, { size: 8, color: C.faint });
    y += 18;
  }

  /**
   * A section's note, after its cards: "Note:" in bold on its own line, then
   * the note's rich text, wrapped to the page width and carried onto the next
   * page if needed.
   */
  const drawNote = (html) => {
    if (!html) return;
    const paragraphs = parseRichText(html);
    if (!paragraphs.length) return;
    const plain = { bold: false, italic: false, underline: false, strike: false };
    // "Note:" on its own line; the note text starts on the next one.
    paragraphs.unshift([{ ...plain, text: 'Note:', bold: true }]);
    const lines = layoutRichText(doc, paragraphs, CONTENT_W, NOTE_SIZE);
    y += 4;
    lines.forEach((line) => {
      ensure(NOTE_LINE);
      drawRichLines(doc, [line], MARGIN, y + 9, NOTE_SIZE, NOTE_LINE, C.black);
      y += NOTE_LINE;
    });
  };

  const halfW = (CONTENT_W - GAP) / 2;
  const thirdW = (CONTENT_W - GAP * 2) / 3;
  const NOTE_SIZE = 10;
  const NOTE_LINE = 12;

  let sectionCount = 0;
  report.sections.forEach((section) => {
    if (!section.items.length) return;
    // Every section after the first starts on a fresh page.
    if (sectionCount > 0) {
      doc.addPage();
      y = BODY_TOP;
    }
    sectionCount += 1;
    if (section.id) anchors[section.id] = doc.getNumberOfPages();
    const firstH = section.items[0].kind === 'savings' ? SAVINGS_H : CARD_H;
    setWeight(doc, 'regular');
    doc.setFontSize(10);
    const subtitleLines = section.subtitle ? doc.splitTextToSize(section.subtitle, CONTENT_W) : [];
    const subtitleH = subtitleLines.length ? subtitleLines.length * 12 + 6 : 0;
    // Title, subtitle and the first row of cards stay on one page.
    ensure(24 + subtitleH + firstH);

    // Title over a short rule (Figma: 12pt medium, 100pt × 0.5pt divider).
    text(doc, section.title, MARGIN, y + 11, { size: 12, color: C.black, weight: 'medium' });
    stroke(doc, C.black);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y + 17, MARGIN + 100, y + 17);
    y += 24;
    if (subtitleLines.length) {
      // Subtitle under the rule, in grey.
      setWeight(doc, 'medium');
      doc.setFontSize(10);
      ink(doc, C.muted);
      doc.text(subtitleLines, MARGIN, y + 8, { lineHeightFactor: 1.2 });
      y += subtitleH;
    }
    y += 8;

    if (section.items[0].kind === 'savings') {
      section.items.forEach((item, i) => {
        const col = i % 3;
        if (col === 0 && i) y += SAVINGS_H + GAP;
        if (col === 0) ensure(SAVINGS_H);
        savingsCard(doc, item, MARGIN + (thirdW + GAP) * col, y, thirdW);
      });
      y += SAVINGS_H + GAP * 2;
      drawNote(section.note);
      y += 12;
      return;
    }

    // Two cards per row; wide charts (24 hourly bars) take a full row.
    let col = 0;
    section.items.forEach((item) => {
      if (item.full && col === 1) { y += CARD_H + GAP; col = 0; }
      if (col === 0) ensure(CARD_H);
      const w = item.full ? CONTENT_W : halfW;
      const x = MARGIN + (item.full ? 0 : (halfW + GAP) * col);
      card(doc, x, y, w, CARD_H, item.widget.title, item.subtitle);
      widgetBody(doc, item, palette, x + CARD_PAD, y + CARD_HEAD_H + CARD_PAD, w - CARD_PAD * 2, CARD_H - CARD_HEAD_H - CARD_PAD * 2);
      if (item.full || col === 1) { y += CARD_H + GAP; col = 0; } else col = 1;
    });
    if (col === 1) y += CARD_H + GAP;
    drawNote(section.note);
    y += 12;
  });

  const chrome = { title: report.title, generatedOn: generatedOnLabel(report.generatedAt), logo: report.logo, clientLogo: report.clientLogo };
  const pages = doc.getNumberOfPages();
  // The cover carries its own number (1); content pages continue from it.
  for (let p = hasCover ? 2 : 1; p <= pages; p += 1) {
    doc.setPage(p);
    pageHeader(doc, chrome);
    pageFooter(doc, p);
  }
  return { blob: doc.output('blob'), anchors };
}
