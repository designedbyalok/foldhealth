import jsPDF from 'jspdf';
import { parseLocalDate } from '../../../../../../../lib/localDate';
import { formatGoalTarget, formatGoalDuration } from '../../../../../../settings/care-plan-library/lib/goalFormat';
import { CARE_PLAN_INTERVENTION_MENU } from './carePlanInterventionMenu';
import { matchesShareConditionFilter } from './carePlanShareFilters';

/**
 * "Care Plan Summary" print format (Figma, Jun-July 2025 > Care Plan PDF).
 *
 *   Page 1     address block, patient details, Care Plan Details, Problems
 *              Applied, Care Plan Note
 *   Goals      each goal's fields, then its interventions and barriers as
 *              tables and its note. Detailed starts every goal on a new page
 *              and prints intervention descriptions; compact flows on.
 *   Last       Open Interventions: those on no goal, by problem
 *
 * Every page after the first repeats a patient strip under the header. A
 * field with no value prints "—": nothing is filled in.
 */
const PAGE = { w: 595, h: 842 };
const M = 24;
const CONTENT_W = PAGE.w - M * 2;
const LABEL_W = 110;

const C = {
  ink: [58, 72, 95],       // neutral-400
  label: [58, 72, 95],
  muted: [95, 106, 126],   // neutral-200
  faint: [151, 160, 178],
  rule: [208, 214, 225],   // neutral-150
  headBg: [243, 244, 246],
  border: [222, 226, 233],
  white: [255, 255, 255],
};

const DASH = '—';
const KIND_LABEL = Object.fromEntries(CARE_PLAN_INTERVENTION_MENU.filter(i => i.key).map(i => [i.key, i.label]));

function fmtDate(value) {
  if (!value) return '';
  const d = parseLocalDate(value) || new Date(value);
  if (Number.isNaN(d?.getTime?.())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
const noteOf = item => item?.config?.note || item?.note || '';
const descriptionOf = item => item?.config?.description || item?.config?.instructions || item?.description || '';

function interventionMeta(i) {
  const parts = [KIND_LABEL[i.kind] || cap(i.kind?.replace(/-/g, ' '))];
  const due = i.config?.dueDate || i.dueDate;
  if (due) parts.push(`Due on ${fmtDate(due)}`);
  else if (i.duration) parts.push(String(i.duration));
  return parts.filter(Boolean).join(' | ');
}

function goalTitle(g, n) {
  return `${n}. ${g.title}${g.category ? ` (${g.category})` : ''}`;
}

/**
 * @param {object} meta     { patientName, date, plan: { createdBy, createdAt, signedBy, signedAt, progress },
 *                            carePlanNote: { detail, actor, createdAt } | null, patient: { dob, age, gender, memberId } }
 * @param {object} selection { conditions, goals, interventions, barriers }
 * @param {object} options  { detail: 'compact' | 'detailed', demographics, header, footer, logo, fonts, showCarePlanNote }
 * @returns {Blob}
 */
export function generateCarePlanSummaryPdf(meta, selection, options = {}) {
  const {
    detail = 'compact',
    demographics = [],
    header,
    footer: footerImage,
    logo = null,
    fonts = null,
    showCarePlanNote = true,
  } = options;
  const detailed = detail === 'detailed';

  const doc = new jsPDF({ unit: 'pt', format: [PAGE.w, PAGE.h] });
  let FAMILY = 'helvetica';
  let MEDIUM = ['helvetica', 'bold'];
  if (fonts?.regular && fonts?.medium) {
    doc.addFileToVFS('Inter-Regular.ttf', fonts.regular);
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    doc.addFileToVFS('Inter-Medium.ttf', fonts.medium);
    doc.addFont('Inter-Medium.ttf', 'InterMedium', 'normal');
    FAMILY = 'Inter';
    MEDIUM = ['InterMedium', 'normal'];
  }
  const font = (weight = 'regular', size = 8, color = C.ink) => {
    if (weight === 'medium') doc.setFont(...MEDIUM);
    else doc.setFont(FAMILY, 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const lines = (text, width) => doc.splitTextToSize(String(text ?? ''), width);

  // Page chrome geometry: a header component image, else the built-in header.
  const headerH = header ? (PAGE.w * header.height) / header.width : 64;
  const footerH = footerImage ? (PAGE.w * footerImage.height) / footerImage.width : (footerImage === null ? 0 : 24);
  const bodyBottom = PAGE.h - footerH - 16;
  let y = 0;

  const patientStrip = () => {
    const rows = [
      [['Patient Name', meta.patientName], ['Gender', meta.patient?.gender]],
      [['Date Of Birth', meta.patient?.dob ? `${meta.patient.dob}${meta.patient.age ? ` (${meta.patient.age})` : ''}` : ''], ['Fold ID', meta.patient?.memberId ? `#${meta.patient.memberId}` : '']],
    ];
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.5);
    doc.line(M, y, PAGE.w - M, y);
    y += 14;
    const colW = (CONTENT_W - 16) / 2;
    rows.forEach((col, ci) => {
      col.forEach(([label, value], ri) => {
        const x = M + ci * (colW + 16);
        const ry = y + ri * 16;
        font('regular', 8, C.label);
        doc.text(label, x, ry);
        doc.text(`: ${value || DASH}`, x + LABEL_W, ry);
      });
    });
    y += 30;
    doc.line(M, y - 6, PAGE.w - M, y - 6);
    y += 10;
  };

  const startPage = (withStrip) => {
    y = headerH + 16;
    if (withStrip) patientStrip();
  };
  const newPage = () => {
    doc.addPage([PAGE.w, PAGE.h]);
    startPage(true);
  };
  const ensure = (needed) => { if (y + needed > bodyBottom) newPage(); };

  // "Label : value" pairs in two columns, as many rows as the longer side.
  const fieldGrid = (left, right, { labelW = LABEL_W } = {}) => {
    const colW = (CONTENT_W - 16) / 2;
    const valW = colW - labelW - 10;
    const heights = Array.from({ length: Math.max(left.length, right.length) }, (_, i) => {
      const a = left[i] ? lines(left[i][1] || DASH, valW).length : 1;
      const b = right[i] ? lines(right[i][1] || DASH, valW).length : 1;
      return Math.max(a, b) * 11 + 5;
    });
    ensure(heights.reduce((s, h) => s + h, 0));
    heights.forEach((h, i) => {
      [left[i], right[i]].forEach((pair, ci) => {
        if (!pair) return;
        const x = M + ci * (colW + 16);
        font('regular', 8, C.label);
        doc.text(pair[0], x, y);
        doc.text(':', x + labelW, y);
        font('regular', 8, C.ink);
        doc.text(lines(pair[1] || DASH, valW), x + labelW + 8, y);
      });
      y += h;
    });
  };

  const sectionTitle = (title) => {
    ensure(40);
    y += 6;
    font('regular', 11, C.ink);
    doc.text(title, M, y);
    doc.setDrawColor(...C.ink);
    doc.setLineWidth(0.5);
    doc.line(M, y + 5, M + 100, y + 5);
    y += 20;
  };

  /**
   * A bordered table. `cols`: [{ label, w }], widths summing to CONTENT_W.
   * `rows`: arrays of cells; a cell is a string or { title, sub, body, note }.
   */
  const table = (cols, rows) => {
    const PAD = 8;
    const headH = 20;
    const cellLines = (cell, w) => {
      if (typeof cell === 'string' || cell == null) return [{ text: lines(cell || DASH, w - PAD * 2), weight: 'regular', color: C.ink }];
      const out = [{ text: lines(cell.title, w - PAD * 2), weight: 'regular', color: C.ink }];
      if (cell.sub) out.push({ text: lines(cell.sub, w - PAD * 2), weight: 'regular', color: C.muted });
      if (cell.body) out.push({ text: lines(`Description: ${cell.body}`, w - PAD * 2), weight: 'regular', color: C.ink, gap: 6 });
      if (cell.note) out.push({ text: lines(`Note: ${cell.note}`, w - PAD * 2), weight: 'regular', color: C.ink, gap: 6 });
      return out;
    };
    const rowHeight = cells => Math.max(...cells.map((c, i) => cellLines(c, cols[i].w)
      .reduce((h, part) => h + (part.gap || 0) + part.text.length * 11, 0))) + PAD * 2 - 2;
    const head = () => {
      doc.setFillColor(...C.headBg);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.5);
      doc.roundedRect(M, y, CONTENT_W, headH, 3, 3, 'FD');
      let x = M;
      cols.forEach(col => {
        font('regular', 8, C.ink);
        doc.text(col.label, x + PAD, y + 13);
        x += col.w;
      });
      y += headH;
    };
    ensure(headH + 30);
    head();
    rows.forEach((cells) => {
      const h = rowHeight(cells);
      if (y + h > bodyBottom) { newPage(); head(); }
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.5);
      doc.rect(M, y, CONTENT_W, h);
      let x = M;
      cells.forEach((cell, i) => {
        if (i > 0) doc.line(x, y, x, y + h);
        const parts = cellLines(cell, cols[i].w);
        const total = parts.reduce((s, p) => s + (p.gap || 0) + p.text.length * 11, 0);
        // Short cells sit in the middle of a tall row, as in the design.
        let ty = i === 0 ? y + PAD + 8 : y + (h - total) / 2 + 8;
        parts.forEach(p => {
          ty += p.gap || 0;
          font(p.weight, 8, p.color);
          doc.text(p.text, x + PAD, ty);
          ty += p.text.length * 11;
        });
        x += cols[i].w;
      });
      y += h;
    });
    y += 10;
  };

  const intvCols = [{ label: 'Interventions', w: 323 }, { label: 'Adherence', w: 104 }, { label: 'Status', w: CONTENT_W - 427 }];
  const intvRow = i => [
    { title: i.title, sub: interventionMeta(i), body: detailed ? descriptionOf(i) : '', note: noteOf(i) },
    i.adherence && i.adherence !== '-' ? String(i.adherence) : DASH,
    i.status || DASH,
  ];
  const barrierCols = [{ label: 'Barriers', w: 427 }, { label: 'Status', w: CONTENT_W - 427 }];

  // ── Page 1 ──
  startPage(false);
  font('regular', 8, C.ink);
  doc.text(meta.date || '', M, y);
  y += 22;
  font('regular', 9, C.ink);
  doc.text(meta.patientName || '', M, y);
  y += 18;

  doc.setDrawColor(...C.rule);
  doc.setLineWidth(0.5);
  doc.line(M, y, PAGE.w - M, y);
  y += 14;
  const demo = [['Patient Name', meta.patientName], ...demographics.map(d => [d.label, d.value])];
  const half = Math.ceil(demo.length / 2);
  fieldGrid(demo.slice(0, half), demo.slice(half));
  doc.line(M, y - 4, PAGE.w - M, y - 4);
  y += 12;

  const plan = meta.plan || {};
  sectionTitle('Care Plan Details');
  fieldGrid(
    [['Start Date', fmtDate(plan.createdAt)], ['Created by', plan.createdBy], ['Plan Progress', plan.progress != null ? `${plan.progress}% Completed` : '']],
    [['Signed & Shared By', plan.signedBy ? `${plan.signedBy}${plan.signedAt ? ` on ${fmtDate(plan.signedAt)}` : ''}` : '']],
  );

  if ((selection.conditions || []).length) {
    sectionTitle('Problems Applied');
    font('regular', 8, C.ink);
    const text = lines(selection.conditions.join(' | '), CONTENT_W);
    doc.text(text, M, y);
    y += text.length * 11 + 8;
  }

  if (showCarePlanNote && meta.carePlanNote?.detail?.trim()) {
    sectionTitle('Care Plan Note');
    fieldGrid([['Added By', `${meta.carePlanNote.actor || DASH}${meta.carePlanNote.createdAt ? ` on ${fmtDate(meta.carePlanNote.createdAt)}` : ''}`]], []);
    font('regular', 8, C.ink);
    const text = lines(meta.carePlanNote.detail.trim(), CONTENT_W);
    ensure(text.length * 11);
    doc.text(text, M, y);
    y += text.length * 11 + 8;
  }

  // ── Goals ──
  const goals = selection.goals || [];
  const goalIds = new Set(goals.map(g => g.id));
  const barrierGoals = b => (b.goalIds?.length ? b.goalIds : [b.goalId]).filter(Boolean);
  goals.forEach((g, idx) => {
    if (detailed) newPage();
    else if (idx === 0) sectionTitle('Goals');
    if (detailed && idx === 0) sectionTitle('Goals');
    ensure(110);
    font('medium', 10, C.ink);
    const t = lines(goalTitle(g, idx + 1), CONTENT_W);
    doc.text(t, M, y);
    y += t.length * 13 + 6;
    const target = [formatGoalTarget(g), g.duration ? `in ${formatGoalDuration(g)}` : ''].filter(Boolean).join(' ');
    fieldGrid(
      [
        ['Start Date', fmtDate(g.createdAt)],
        ['Priority', cap(g.priority)],
        ['Targeted Value', target],
        ['Problem', (g.conditions || []).join(', ')],
      ],
      [
        ['Current Value', [g.currentValue && g.currentValue !== 'No Data' ? g.currentValue : '', g.trend && g.trend !== '-' ? g.trend : ''].filter(Boolean).join(' | ')],
        ['Status', [g.progress != null && g.progress !== '' ? `${g.progress}%` : '', g.status].filter(Boolean).join(' | ')],
        ['Last Updated Date', fmtDate(g.updatedAt)],
        ['Last Updated by', g.updatedBy],
      ],
    );
    const intv = (selection.interventions || []).filter(i => i.goalId === g.id);
    const bars = (selection.barriers || []).filter(b => barrierGoals(b).includes(g.id));
    if (intv.length || bars.length) {
      // The label, a table head and a first row stay together.
      ensure(90);
      font('regular', 8, C.ink);
      doc.text('Linked Items :', M, y);
      y += 10;
    }
    if (intv.length) table(intvCols, intv.map(intvRow));
    if (bars.length) table(barrierCols, bars.map(b => [{ title: b.title }, b.status || DASH]));
    const gNote = noteOf(g);
    if (gNote) {
      ensure(30);
      font('regular', 8, C.ink);
      doc.text('Goal Note :', M, y);
      y += 12;
      const text = lines(gNote, CONTENT_W);
      doc.text(text, M, y);
      y += text.length * 11 + 8;
    }
    y += 8;
  });

  // ── Open Interventions: on no goal in this selection, by problem ──
  const open = (selection.interventions || []).filter(i => !goalIds.has(i.goalId));
  const openBarriers = (selection.barriers || []).filter(b => !barrierGoals(b).some(id => goalIds.has(id)));
  if (open.length) {
    if (detailed) newPage();
    sectionTitle('Open Interventions');
    const labels = (selection.conditions || []).filter(Boolean);
    const groups = new Map();
    open.forEach(i => {
      const label = labels.find(l => matchesShareConditionFilter(i, [l])) || 'Other';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(i);
    });
    for (const [label, items] of groups) {
      fieldGrid([['Problem', label]], []);
      table([{ label: 'Interventions Name', w: 323 }, intvCols[1], intvCols[2]], items.map(intvRow));
    }
  }
  if (openBarriers.length) {
    sectionTitle('Open Barriers');
    table(barrierCols, openBarriers.map(b => [{ title: b.title }, b.status || DASH]));
  }

  // ── Header and footer on every page, now the page count is known ──
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    if (header) {
      const src = header.images ? header.images[p - 1] || header.images[0] : header.dataUrl;
      if (src) doc.addImage(src, 'PNG', 0, 0, PAGE.w, headerH);
    } else {
      if (logo?.dataUrl) {
        const lh = 24;
        const lw = Math.min(170, (logo.width / logo.height) * lh);
        doc.addImage(logo.dataUrl, 'PNG', M, 22, lw, (lw / logo.width) * logo.height);
      }
      font('regular', 8, C.muted);
      doc.text(`Page ${p} of ${total}`, PAGE.w - M, 24, { align: 'right' });
      font('regular', 12, C.ink);
      doc.text('Care Plan Summary', PAGE.w - M, 38, { align: 'right' });
      font('regular', 8, C.faint);
      doc.text(`Generated On : ${meta.date || ''}`, PAGE.w - M, 50, { align: 'right' });
      doc.setDrawColor(...C.rule);
      doc.setLineWidth(0.5);
      doc.line(0, headerH - 4, PAGE.w, headerH - 4);
    }
    if (footerImage) {
      const src = footerImage.images ? footerImage.images[p - 1] : footerImage.dataUrl;
      if (src) doc.addImage(src, 'PNG', 0, PAGE.h - footerH, PAGE.w, footerH);
    } else if (footerImage !== null) {
      font('regular', 7, C.faint);
      doc.text('Generated from Fold Health', M, PAGE.h - 14);
      doc.text(`Page ${p} of ${total}`, PAGE.w - M, PAGE.h - 14, { align: 'right' });
    }
  }

  const blob = doc.output('blob');
  // For a header or footer showing "Page x of y".
  blob.pageCount = total;
  return blob;
}
