import jsPDF from 'jspdf';
import {
  registerFonts, registerCoverFonts, coverPage, generatedOnLabel,
} from '../../../../../../analytics/views/employer/generateEmployerReportPdf';

/**
 * The care program report as a PDF, in the layout of Figma CCM-Story
 * 11211:479858 – 14254:106259: an A4 page with the picked report header and
 * footer (drawn components, as the Employer Impact Report uses), the
 * patient's details under the header, then a section per program step.
 * An optional cover comes first, drawn exactly as the Employer Impact
 * Report's.
 */
const PAGE = { w: 595, h: 842 };
const M = 24;
const CONTENT_W = PAGE.w - M * 2;
const LABEL_W = 116;
const COL_GAP = 24;

// Figma colours; jsPDF takes RGB, not CSS variables.
const C = {
  black: [22, 24, 29],      // Monochrome/Black
  body: [58, 72, 95],       // Neutral/400
  muted: [111, 122, 144],   // Neutral/300
  faint: [138, 148, 168],   // Neutral/200
  rule: [208, 214, 225],    // Neutral/150
  headBg: [243, 244, 246],
  cardBorder: [222, 226, 233],
  track: [233, 236, 241],
  success: [0, 155, 83],
  warning: [245, 133, 50],
  error: [217, 45, 32],
  band: [140, 90, 226],     // built-in header band (Fold purple)
};
const TONE = { success: C.success, warning: C.warning, error: C.error, muted: C.faint };

/** Font names for this document: Inter when its files were supplied, else Helvetica. */
function fontSet(fonts) {
  const inter = fonts && ['regular', 'bold', 'italic', 'boldItalic', 'medium'].every(k => fonts[k]);
  return inter
    ? { regular: ['Inter', 'normal'], medium: ['InterMedium', 'normal'], semibold: fonts.semibold ? ['InterSemiBold', 'normal'] : ['Inter', 'bold'] }
    : { regular: ['helvetica', 'normal'], medium: ['helvetica', 'bold'], semibold: ['helvetica', 'bold'] };
}

/**
 * @param {object} report
 * @param {string} report.title
 * @param {Date}   report.generatedAt
 * @param {{ patientRows: object[], sections: object[] }} report.model – see buildProgramReport
 * @param {object|null|undefined} report.header – a drawn header component `{ width, height, dataUrl?, images? }`;
 *   null for none; undefined (not drawn yet) for the built-in one
 * @param {object|null|undefined} report.footer – the same, for the footer
 * @param {object} [report.fonts]      – Inter TTFs (base64)
 * @param {object} [report.coverFonts] – the cover's other fonts
 * @param {object|null} [report.cover] – the cover's settings (see coverPage), null for no cover
 * @returns {{ blob: Blob, anchors: object, pages: number, numberedPages: number }}
 */
export function generateProgramReport(report) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  registerFonts(doc, report.fonts);
  registerCoverFonts(doc, report.coverFonts);
  const F = fontSet(report.fonts);
  const anchors = {};

  const font = (weight = 'regular') => doc.setFont(...(F[weight] || F.regular));
  const ink = rgb => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const text = (str, x, y, { size = 10, color = C.body, weight = 'regular', align = 'left' } = {}) => {
    font(weight);
    doc.setFontSize(size);
    ink(color);
    doc.text(String(str), x, y, { align });
  };
  const wrap = (str, w, size, weight = 'regular') => {
    font(weight);
    doc.setFontSize(size);
    return doc.splitTextToSize(String(str ?? ''), w);
  };

  const hasCover = !!report.cover;
  if (hasCover) {
    anchors.cover = { page: 1 };
    coverPage(doc, { title: report.title, ...report.cover });
    doc.addPage();
  }

  const { header, footer } = report;
  const headerH = header ? (PAGE.w * header.height) / header.width : 0;
  const footerH = footer ? (PAGE.w * footer.height) / footer.width : 0;
  const BUILTIN_HEADER_H = 96;
  const bodyTop = header === null ? M : header ? headerH + 12 : BUILTIN_HEADER_H + 12;
  const bodyBottom = footer === null ? PAGE.h - M : footer ? PAGE.h - footerH - 12 : PAGE.h - 36;
  let y = bodyTop;

  // ── Patient strip: full on the first page, name and IDs after (Figma). ──
  const fieldGrid = (rows, top, { rules = false } = {}) => {
    const colW = (CONTENT_W - COL_GAP) / 2;
    let rowY = top + (rules ? 12 : 0);
    if (rules) {
      doc.setDrawColor(...C.rule);
      doc.setLineWidth(0.5);
      doc.line(M, top, M + CONTENT_W, top);
    }
    for (let i = 0; i < rows.length; i += 2) {
      const pair = rows.slice(i, i + 2);
      const heights = pair.map((r) => {
        const lines = wrap(`: ${r.value ?? '-'}`, colW - LABEL_W, 10);
        return lines.length * 12;
      });
      const h = Math.max(...heights, 12);
      pair.forEach((r, j) => {
        const x = M + j * (colW + COL_GAP);
        text(r.label, x, rowY + 9, { size: 10, color: C.black });
        const lines = wrap(`: ${r.value ?? '-'}`, colW - LABEL_W, 10);
        font('regular');
        doc.setFontSize(10);
        ink(TONE[r.tone] || C.body);
        doc.text(lines, x + LABEL_W, rowY + 9, { lineHeightFactor: 1.2 });
      });
      rowY += h + 4;
    }
    if (rules) {
      rowY += 4;
      doc.setDrawColor(...C.rule);
      doc.line(M, rowY, M + CONTENT_W, rowY);
      rowY += 4;
    }
    return rowY;
  };
  const shortPatient = report.model.patientRows.slice(0, 4);
  const patientStrip = (first) => {
    y = fieldGrid(first ? report.model.patientRows : shortPatient, y, { rules: true }) + 12;
  };
  const newPage = () => {
    doc.addPage();
    y = bodyTop;
    patientStrip(false);
  };
  const ensure = (needed) => {
    if (y + needed <= bodyBottom) return;
    newPage();
  };
  patientStrip(true);

  // ── Blocks ──
  const sectionTitle = (title) => {
    text(title, M, y + 12, { size: 12, color: C.black, weight: 'medium' });
    doc.setDrawColor(...C.black);
    doc.setLineWidth(0.5);
    doc.line(M, y + 18, M + 100, y + 18);
    y += 28;
  };

  // Two columns of "Label : Value"; a `full` row takes the whole width on its own.
  const drawFields = (block) => {
    const colW = (CONTENT_W - COL_GAP) / 2;
    const lines = [];
    block.rows.forEach((r) => {
      const last = lines[lines.length - 1];
      if (!r.full && last && !last.full && last.rows.length === 1) last.rows.push(r);
      else lines.push({ full: !!r.full, rows: [r] });
    });
    lines.forEach(({ full, rows }) => {
      const valueW = full ? CONTENT_W - LABEL_W : colW - LABEL_W;
      const wrapped = rows.map(r => wrap(`: ${r.value ?? '-'}`, valueW, 10));
      const h = Math.max(...wrapped.map(w => w.length * 12), 12) + 4;
      ensure(h);
      rows.forEach((r, j) => {
        const x = M + j * (colW + COL_GAP);
        text(r.label, x, y + 9, { size: 10, color: C.black });
        font('regular');
        doc.setFontSize(10);
        ink(TONE[r.tone] || C.body);
        doc.text(wrapped[j], x + LABEL_W, y + 9, { lineHeightFactor: 1.2 });
      });
      y += h;
    });
    y += 6;
  };

  const drawCards = (block) => {
    const gap = 8;
    const n = block.items.length;
    const w = (CONTENT_W - gap * (n - 1)) / n;
    const h = 36;
    ensure(h + 8);
    block.items.forEach((card, i) => {
      const x = M + i * (w + gap);
      doc.setDrawColor(...C.cardBorder);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, w, h, 4, 4, 'S');
      text(card.label, x + 8, y + 13, { size: 9, color: C.black });
      const tone = TONE[card.tone] || C.body;
      if (card.pct != null) {
        const barW = w - 16 - 34;
        doc.setFillColor(...C.track);
        doc.roundedRect(x + 8, y + 22, barW, 4, 2, 2, 'F');
        doc.setFillColor(...tone);
        doc.roundedRect(x + 8, y + 22, Math.max(4, (barW * Math.min(100, card.pct)) / 100), 4, 2, 2, 'F');
        text(`${Math.round(card.pct)}%`, x + w - 8, y + 27, { size: 9, color: C.body, align: 'right' });
      } else {
        text(card.value, x + 8, y + 28, { size: 9, color: tone });
      }
    });
    y += h + 12;
  };

  // A table in a rounded frame; long tables carry on over pages, header repeated.
  const drawTable = (block) => {
    const cols = block.columns.map(c => ({ ...c, w: c.width * CONTENT_W }));
    const PAD = 8;
    const HEAD_H = 22;
    const cellLines = (cell, w) => {
      const c = typeof cell === 'string' || cell == null ? { text: cell ?? '-' } : cell;
      const main = wrap(c.text ?? '-', w - PAD * 2, 9.5);
      const sub = c.sub ? wrap(c.sub, w - PAD * 2, 9) : [];
      return { c, main, sub, h: (main.length + sub.length) * 12 };
    };
    let frameTop = y;
    const head = () => {
      frameTop = y;
      doc.setFillColor(...C.headBg);
      doc.roundedRect(M, y, CONTENT_W, HEAD_H, 6, 6, 'F');
      doc.rect(M, y + HEAD_H / 2, CONTENT_W, HEAD_H / 2, 'F');
      let x = M;
      cols.forEach((col) => { text(col.title, x + PAD, y + 14.5, { size: 9.5, color: C.black, weight: 'medium' }); x += col.w; });
      y += HEAD_H;
    };
    const closeFrame = () => {
      doc.setDrawColor(...C.rule);
      doc.setLineWidth(0.5);
      doc.roundedRect(M, frameTop, CONTENT_W, y - frameTop, 6, 6, 'S');
      // Column rules, as in the Figma tables.
      let x = M;
      cols.slice(0, -1).forEach((col) => { x += col.w; doc.line(x, frameTop, x, y); });
    };
    ensure(HEAD_H + 30);
    head();
    block.rows.forEach((row, ri) => {
      const cells = row.map((cell, i) => cellLines(cell, cols[i].w));
      const h = Math.max(...cells.map(c => c.h), 12) + PAD * 2;
      if (y + h > bodyBottom) {
        closeFrame();
        newPage();
        head();
      }
      if (ri > 0) {
        doc.setDrawColor(...C.rule);
        doc.setLineWidth(0.5);
        doc.line(M, y, M + CONTENT_W, y);
      }
      let x = M;
      cells.forEach(({ c, main, sub }, i) => {
        font('regular');
        doc.setFontSize(9.5);
        ink(TONE[c.tone] || C.body);
        doc.text(main, x + PAD, y + PAD + 9, { lineHeightFactor: 1.26 });
        if (sub.length) {
          doc.setFontSize(9);
          ink(C.muted);
          doc.text(sub, x + PAD, y + PAD + 9 + main.length * 12, { lineHeightFactor: 1.33 });
        }
        x += cols[i].w;
      });
      y += h;
    });
    closeFrame();
    y += 14;
  };

  const drawEmpty = (block) => {
    ensure(20);
    text(block.text, M, y + 10, { size: 10, color: C.muted });
    y += 22;
  };
  const drawSubtitle = (block) => {
    ensure(48);
    text(block.text, M, y + 10, { size: 11, color: C.black, weight: 'medium' });
    y += 18;
  };

  report.model.sections.forEach((section, i) => {
    // A section starts where it fits its title and a first row; else on a new page.
    ensure(i === 0 ? 40 : 80);
    if (i > 0) y += 8;
    anchors[section.key] = { page: doc.getNumberOfPages(), top: Math.max(0, Math.round(y - 12)) };
    sectionTitle(section.title);
    section.blocks.forEach((block) => {
      if (block.type === 'fields') drawFields(block);
      else if (block.type === 'cards') drawCards(block);
      else if (block.type === 'table') drawTable(block);
      else if (block.type === 'subtitle') drawSubtitle(block);
      else drawEmpty(block);
    });
  });

  // ── Header and footer on content pages; numbering starts after the cover. ──
  const pages = doc.getNumberOfPages();
  const offset = hasCover ? 1 : 0;
  const total = pages - offset;
  const generatedOn = generatedOnLabel(report.generatedAt);
  for (let p = 1 + offset; p <= pages; p += 1) {
    doc.setPage(p);
    const n = p - offset;
    const headerImg = header && (header.images ? header.images[n - 1] : header.dataUrl);
    if (headerImg) {
      doc.addImage(headerImg, 'PNG', 0, 0, PAGE.w, headerH);
    } else if (header !== null) {
      // Built-in header (until the picked one is drawn): title, date and page on the right, a band below.
      text(report.title, PAGE.w - M, 34, { size: 14, color: C.black, weight: 'medium', align: 'right' });
      text(generatedOn, PAGE.w - M, 50, { size: 10, color: C.faint, align: 'right' });
      text(`Page ${n} of ${total}`, PAGE.w - M, 64, { size: 10, color: C.body, align: 'right' });
      doc.setFillColor(...C.band);
      doc.rect(0, 76, PAGE.w, 8, 'F');
    }
    const footerImg = footer && (footer.images ? footer.images[n - 1] : footer.dataUrl);
    if (footerImg) {
      doc.addImage(footerImg, 'PNG', 0, PAGE.h - footerH, PAGE.w, footerH);
    } else if (footer !== null) {
      text(`Page ${n} of ${total}`, PAGE.w / 2, PAGE.h - 18, { size: 9, color: C.faint, align: 'center' });
    }
  }

  return { blob: doc.output('blob'), anchors, pages, numberedPages: total };
}
