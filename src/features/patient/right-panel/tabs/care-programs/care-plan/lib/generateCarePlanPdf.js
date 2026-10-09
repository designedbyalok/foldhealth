import jsPDF from 'jspdf';
import { parseLocalDate } from '../../../../../../../lib/localDate';
import { formatGoalTarget, formatGoalDuration } from '../../../../../../settings/care-plan-library/lib/goalFormat';
import { CARE_PLAN_INTERVENTION_MENU } from './carePlanInterventionMenu';
import { matchesShareConditionFilter } from './carePlanShareFilters';
import { generateCarePlanSummaryPdf } from './generateCarePlanSummaryPdf';

/**
 * Care plan PDF, "Tables" format: a patient card, then Goals, Interventions
 * and Barriers as one clean table each (or a block per condition), the Care
 * Note and the note to the recipient. A4, Inter when the fonts are passed.
 * Empty values print "—"; nothing is filled in.
 */
const PAGE = { w: 595, h: 842 };
const M = 32;
const CONTENT_W = PAGE.w - M * 2;
const DASH = '—';

const C = {
  ink: [31, 41, 55],
  body: [58, 72, 95],
  muted: [95, 106, 126],
  faint: [151, 160, 178],
  rule: [229, 231, 235],
  band: [246, 247, 249],
  card: [248, 249, 251],
  chip: [238, 240, 244],
  white: [255, 255, 255],
};

const STATUS_STYLE = {
  'Not Started': { bg: [241, 243, 246], text: [95, 106, 126] },
  'In Progress': { bg: [233, 242, 255], text: [32, 96, 199] },
  'On Hold': { bg: [255, 244, 229], text: [176, 104, 0] },
  Met: { bg: [230, 246, 236], text: [22, 128, 61] },
  Completed: { bg: [230, 246, 236], text: [22, 128, 61] },
  Resolved: { bg: [230, 246, 236], text: [22, 128, 61] },
  'Not Met': { bg: [254, 236, 236], text: [196, 43, 28] },
  Overdue: { bg: [254, 236, 236], text: [196, 43, 28] },
};
const statusStyle = s => STATUS_STYLE[s] || STATUS_STYLE['Not Started'];

const STATUS_RANK = { 'In Progress': 0, 'On Hold': 1, 'Not Met': 2, Overdue: 2, 'Not Started': 3, Met: 4, Completed: 4, Resolved: 4 };
const byStatus = (a, b) => ((STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3))
  || (a.title || '').localeCompare(b.title || '');

const KIND_LABEL = Object.fromEntries(CARE_PLAN_INTERVENTION_MENU.filter(i => i.key).map(i => [i.key, i.label]));

function fmtDate(value) {
  if (!value) return '';
  const d = parseLocalDate(value) || new Date(value);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * The selection split by the plan's conditions: each goal, intervention and
 * barrier under the first condition it relates to, and any left over under
 * Other. Conditions with nothing under them are left out.
 */
export function conditionGroups(selection) {
  const labels = (selection.conditions || []).filter(Boolean);
  const groups = [...labels, 'Other'].map(label => ({ label, goals: [], interventions: [], barriers: [] }));
  const place = (kind, item) => {
    const i = labels.findIndex(l => matchesShareConditionFilter(item, [l]));
    groups[i === -1 ? labels.length : i][kind].push(item);
  };
  for (const kind of ['goals', 'interventions', 'barriers']) {
    for (const item of selection[kind] || []) place(kind, item);
  }
  return groups.filter(g => g.goals.length || g.interventions.length || g.barriers.length);
}

/**
 * Build the care plan PDF from the selected elements.
 * @param {{patientName?:string, programName?:string, sharedBy?:string, date?:string, note?:string}} meta
 * @param {{conditions:string[], goals:Array, interventions:Array, barriers?:Array}} selection
 * @param {object} [options] Personalize settings: format, groupBy, carePlanNote,
 *   demographics ([{ label, value }]), header / footer (drawn components;
 *   header undefined or null for none, footer undefined for the standard
 *   line and null for none), logo, fonts
 * @returns {Blob}
 */
export function generateCarePlanPdf(meta, selection, options = {}) {
  // The Care Plan Summary format (goal by goal) has its own layout.
  if (options.format === 'summary-compact' || options.format === 'summary-detailed') {
    return generateCarePlanSummaryPdf(meta, selection, {
      ...options,
      detail: options.format === 'summary-detailed' ? 'detailed' : 'compact',
    });
  }
  const {
    groupBy = 'type',
    carePlanNote = '',
    demographics = [],
    header,
    footer: footerImage,
    logo = null,
    fonts = null,
  } = options;
  const { patientName = 'Patient', programName = '', sharedBy = '', date = '', note = '' } = meta;

  const doc = new jsPDF({ unit: 'pt', format: [PAGE.w, PAGE.h] });
  let REG = ['helvetica', 'normal'];
  let MED = ['helvetica', 'bold'];
  if (fonts?.regular && fonts?.medium) {
    doc.addFileToVFS('Inter-Regular.ttf', fonts.regular);
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    doc.addFileToVFS('Inter-Medium.ttf', fonts.medium);
    doc.addFont('Inter-Medium.ttf', 'InterMedium', 'normal');
    REG = ['Inter', 'normal'];
    MED = ['InterMedium', 'normal'];
  }
  const font = (weight, size, color) => {
    doc.setFont(...(weight === 'medium' ? MED : REG));
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const wrap = (text, width) => doc.splitTextToSize(String(text ?? ''), width);

  const headerH = header ? (PAGE.w * header.height) / header.width : 0;
  const footerH = footerImage ? (PAGE.w * footerImage.height) / footerImage.width : 0;
  const top = header ? headerH + 20 : M;
  const bottom = PAGE.h - (footerImage ? footerH + 16 : footerImage === null ? M : 44);
  let y = top;

  const newPage = () => { doc.addPage([PAGE.w, PAGE.h]); y = top; };
  const ensure = (needed) => { if (y + needed > bottom) newPage(); };
  const rule = () => {
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.5);
    doc.line(M, y, PAGE.w - M, y);
  };

  const pill = (label, x, midY, maxW) => {
    const s = statusStyle(label);
    font('medium', 7, s.text);
    const text = label || DASH;
    const w = Math.min(maxW, doc.getTextWidth(text) + 12);
    doc.setFillColor(...s.bg);
    doc.roundedRect(x, midY - 7, w, 14, 7, 7, 'F');
    doc.text(text, x + 6, midY + 2.5);
  };

  // ── Title block (a header component carries its own title) ──
  if (!header) {
    if (logo?.dataUrl) {
      const lh = 26;
      const lw = Math.min(150, (logo.width / logo.height) * lh);
      doc.addImage(logo.dataUrl, 'PNG', M, y, lw, (lw / logo.width) * logo.height);
      y += lh + 14;
    }
    font('medium', 18, C.ink);
    doc.text('Care Plan', M, y + 14);
    const metaItems = [['Date', date], ['Prepared by', sharedBy]].filter(([, v]) => v);
    metaItems.forEach(([label, value], i) => {
      const x = PAGE.w - M - (metaItems.length - 1 - i) * 120;
      font('regular', 7.5, C.faint);
      doc.text(label, x, y + 4, { align: 'right' });
      font('regular', 9, C.ink);
      doc.text(value, x, y + 16, { align: 'right' });
    });
    y += 22;
    if (programName) {
      font('regular', 9, C.muted);
      doc.text(programName, M, y + 6);
      y += 12;
    }
    y += 12;
  } else {
    font('regular', 9, C.muted);
    doc.text([programName, sharedBy && `Prepared by ${sharedBy}`, date].filter(Boolean).join('  •  '), M, y);
    y += 14;
  }

  // ── Patient card: name, conditions as chips, picked demographics ──
  {
    const PAD = 14;
    const innerW = CONTENT_W - PAD * 2;
    const conds = (selection.conditions || []).filter(Boolean);
    // Lay the chips out first to know the card's height.
    font('regular', 7.5, C.body);
    const chipRows = [];
    let row = [];
    let rowW = 0;
    for (const c of conds) {
      const w = doc.getTextWidth(c) + 14;
      if (row.length && rowW + w > innerW) { chipRows.push(row); row = []; rowW = 0; }
      row.push({ c, w });
      rowW += w + 6;
    }
    if (row.length) chipRows.push(row);
    const COLS = 4;
    const demoRows = Math.ceil(demographics.length / COLS);
    const cardH = PAD + 14 + (chipRows.length ? 6 + chipRows.length * 20 : 0) + (demoRows ? 10 + demoRows * 28 : 0) + PAD - 4;
    ensure(cardH + 16);
    doc.setFillColor(...C.card);
    doc.setDrawColor(...C.rule);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CONTENT_W, cardH, 6, 6, 'FD');
    let cy = y + PAD + 10;
    font('medium', 11, C.ink);
    doc.text(patientName, M + PAD, cy);
    cy += 10;
    if (chipRows.length) {
      cy += 6;
      for (const r of chipRows) {
        let cx = M + PAD;
        for (const { c, w } of r) {
          doc.setFillColor(...C.chip);
          doc.roundedRect(cx, cy, w, 15, 4, 4, 'F');
          font('regular', 7.5, C.body);
          doc.text(c, cx + 7, cy + 10.2);
          cx += w + 6;
        }
        cy += 20;
      }
    }
    if (demoRows) {
      cy += 8;
      const colW = innerW / COLS;
      demographics.forEach((d, i) => {
        const x = M + PAD + (i % COLS) * colW;
        const ry = cy + Math.floor(i / COLS) * 28;
        font('regular', 7, C.faint);
        doc.text(d.label, x, ry + 6);
        font('regular', 9, d.value ? C.ink : C.faint);
        doc.text(wrap(d.value || 'Not recorded', colW - 10)[0], x, ry + 18);
      });
    }
    y += cardH + 26;
  }

  // ── Tables ──
  const sectionTitle = (title, count, size = 11) => {
    ensure(64);
    font('medium', size, C.ink);
    doc.text(title, M, y);
    if (count != null) {
      const tw = doc.getTextWidth(title);
      font('medium', 7.5, C.muted);
      const label = String(count);
      const w = doc.getTextWidth(label) + 10;
      doc.setFillColor(...C.chip);
      doc.roundedRect(M + tw + 6, y - 9.5, w, 13, 6.5, 6.5, 'F');
      doc.text(label, M + tw + 11, y - 0.5);
    }
    y += 10;
  };

  /**
   * cols: [{ label, w (fraction of the width), kind: 'status' }]
   * A row's first cell is { title, sub }; the rest are strings.
   */
  const table = (cols, rows, emptyText) => {
    const widths = cols.map(c => c.w * CONTENT_W);
    const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const PADX = 8;
    const head = () => {
      doc.setFillColor(...C.band);
      doc.rect(M, y, CONTENT_W, 20, 'F');
      font('regular', 7.5, C.muted);
      cols.forEach((c, i) => doc.text(c.label, xs[i] + PADX, y + 13));
      y += 20;
    };
    if (!rows.length) {
      ensure(30);
      font('regular', 8.5, C.faint);
      doc.text(emptyText, M, y + 12);
      y += 30;
      return;
    }
    ensure(20 + 34);
    head();
    rows.forEach((cells) => {
      const first = cells[0];
      font('medium', 8.5, C.ink);
      const titleLines = wrap(first.title || DASH, widths[0] - PADX * 2);
      font('regular', 7.5, C.muted);
      const subLines = first.sub ? wrap(first.sub, widths[0] - PADX * 2).slice(0, 3) : [];
      font('regular', 8, C.body);
      const otherLines = cells.slice(1).map((cell, j) => (cols[j + 1].kind === 'status'
        ? [''] : wrap(cell || DASH, widths[j + 1] - PADX * 2).slice(0, 3)));
      const textH = titleLines.length * 11 + (subLines.length ? 2 + subLines.length * 10 : 0);
      const h = Math.max(30, textH + 14, ...otherLines.map(l => l.length * 10.5 + 14));
      if (y + h > bottom) { newPage(); head(); }
      let ty = y + 7 + 8.5;
      font('medium', 8.5, C.ink);
      doc.text(titleLines, xs[0] + PADX, ty);
      ty += titleLines.length * 11;
      if (subLines.length) {
        font('regular', 7.5, C.muted);
        doc.text(subLines, xs[0] + PADX, ty + 1);
      }
      const mid = y + h / 2;
      cells.slice(1).forEach((cell, j) => {
        const i = j + 1;
        if (cols[i].kind === 'status') { pill(cell, xs[i] + PADX, mid, widths[i] - PADX * 2); return; }
        const lines = otherLines[j];
        font('regular', 8, cell ? C.body : C.faint);
        doc.text(lines, xs[i] + PADX, mid - ((lines.length - 1) * 10.5) / 2 + 3);
      });
      y += h;
      rule();
    });
    y += 22;
  };

  const goalRow = g => [
    { title: g.title, sub: g.subtitle },
    [formatGoalTarget(g), g.duration ? `in ${formatGoalDuration(g)}` : ''].filter(Boolean).join(' '),
    [g.currentValue && g.currentValue !== 'No Data' ? g.currentValue : '', g.trend && g.trend !== '-' ? g.trend : ''].filter(Boolean).join(' · '),
    fmtDate(g.createdAt),
    g.status,
  ];
  const intvRow = i => [
    { title: i.title, sub: [KIND_LABEL[i.kind], i.config?.dueDate ? `Due ${fmtDate(i.config.dueDate)}` : ''].filter(Boolean).join(' · ') },
    i.assignee?.name && i.assignee.name !== 'Unassigned' ? i.assignee.name : '',
    fmtDate(i.createdAt),
    i.status,
  ];
  const barrierRow = b => [{ title: b.title, sub: b.description }, fmtDate(b.createdAt), b.status];

  const GOAL_COLS = [
    { label: 'Goal', w: 0.38 }, { label: 'Target', w: 0.22 }, { label: 'Current', w: 0.13 },
    { label: 'Start', w: 0.13 }, { label: 'Status', w: 0.14, kind: 'status' },
  ];
  const INTV_COLS = [
    { label: 'Intervention', w: 0.46 }, { label: 'Assigned to', w: 0.27 },
    { label: 'Start', w: 0.13 }, { label: 'Status', w: 0.14, kind: 'status' },
  ];
  const BARRIER_COLS = [
    { label: 'Barrier', w: 0.73 }, { label: 'Start', w: 0.13 }, { label: 'Status', w: 0.14, kind: 'status' },
  ];

  const drawTypeSections = (part, { skipEmpty = false, titleSize = 11 } = {}) => {
    [
      { title: 'Goals', items: part.goals || [], cols: GOAL_COLS, row: goalRow, empty: 'No goals included.' },
      { title: 'Interventions', items: part.interventions || [], cols: INTV_COLS, row: intvRow, empty: 'No interventions included.' },
      { title: 'Barriers', items: part.barriers || [], cols: BARRIER_COLS, row: barrierRow, empty: 'No barriers included.' },
    ].filter(s => !skipEmpty || s.items.length).forEach(s => {
      sectionTitle(s.title, s.items.length, titleSize);
      table(s.cols, [...s.items].sort(byStatus).map(s.row), s.empty);
    });
  };

  if (groupBy === 'condition') {
    // Each item sits under the first condition it relates to, so nothing
    // prints twice; the rest go under Other.
    const groups = conditionGroups(selection);
    if (!groups.length) drawTypeSections(selection);
    groups.forEach((g) => {
      ensure(100);
      doc.setFillColor(...C.body);
      doc.roundedRect(M, y - 11, 3, 15, 1.5, 1.5, 'F');
      font('medium', 13, C.ink);
      doc.text(g.label, M + 10, y);
      y += 22;
      drawTypeSections(g, { skipEmpty: true, titleSize: 10 });
      y += 4;
    });
  } else {
    drawTypeSections(selection);
  }

  // ── Notes ──
  const noteBlock = (title, text) => {
    font('regular', 9, C.body);
    const lines = wrap(text.trim(), CONTENT_W - 28);
    sectionTitle(title);
    let i = 0;
    while (i < lines.length) {
      ensure(40);
      const fit = Math.max(1, Math.floor((bottom - y - 24) / 13));
      const chunk = lines.slice(i, i + fit);
      const h = chunk.length * 13 + 20;
      doc.setFillColor(...C.card);
      doc.roundedRect(M, y, CONTENT_W, h, 6, 6, 'F');
      font('regular', 9, C.body);
      doc.text(chunk, M + 14, y + 17);
      y += h + 4;
      i += chunk.length;
    }
    y += 18;
  };
  if (carePlanNote?.trim()) noteBlock('Care Plan Note', carePlanNote);
  if (note?.trim()) noteBlock('Note', note);

  ensure(30);
  font('regular', 7, C.faint);
  doc.text(wrap('This document reflects the selected parts of the care plan at the time it was exported. Review it before sharing with patients or external systems.', CONTENT_W), M, y);

  // ── Header and footer on every page, now the page count is known ──
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    if (header) {
      const src = header.images ? header.images[p - 1] || header.images[0] : header.dataUrl;
      if (src) doc.addImage(src, 'PNG', 0, 0, PAGE.w, headerH);
    }
    if (footerImage) {
      const src = footerImage.images ? footerImage.images[p - 1] : footerImage.dataUrl;
      if (src) {
        doc.addImage(src, 'PNG', 0, PAGE.h - footerH, PAGE.w, footerH);
        if (!footerImage.images) {
          font('regular', 8, footerImage.pageInk === 'light' ? C.white : C.muted);
          doc.text(String(p), PAGE.w - M, PAGE.h - footerH / 2 + 3, { align: 'right' });
        }
      }
    } else if (footerImage !== null) {
      doc.setDrawColor(...C.rule);
      doc.setLineWidth(0.5);
      doc.line(M, PAGE.h - 30, PAGE.w - M, PAGE.h - 30);
      font('regular', 7, C.faint);
      doc.text([patientName, 'Care Plan'].filter(Boolean).join('  •  '), M, PAGE.h - 18);
      doc.text(`Page ${p} of ${total}`, PAGE.w - M, PAGE.h - 18, { align: 'right' });
    }
  }

  const blob = doc.output('blob');
  // For a header or footer showing "Page x of y".
  blob.pageCount = total;
  return blob;
}
