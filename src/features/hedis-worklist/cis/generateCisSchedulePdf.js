import jsPDF from 'jspdf';
import { CIS_DOSE_STATUS } from './cisRules';
import { fmtDate } from './cisStatusConfig';
import { ASTRANA_CONTACT, TRAILHEAD_CONTACT } from '../../email-builder/reportHeaderComponent';

// Layout from the Patient Summary report (Figma CCM-Story 11295:487395 /
// Mar-Present 2568:6418): A4, logo + title header, brand band, label : value
// patient block, titled sections of bordered tables, contact footer. The
// header and footer follow the report components (Trailhead: Patient
// Summary header / footer; Astrana: Astrana Report header / footer).
const PAGE = { w: 595, h: 842 };
const PAD = 24;
const CONTENT_W = PAGE.w - PAD * 2;
const HEADER_H = 72;          // 16 + 40 logo + 16
const FOOTER_H = 28;          // 8 + 12 + 8
const BODY_TOP = HEADER_H + 16 + 12; // header, band, gap
const BODY_BOTTOM = PAGE.h - FOOTER_H - 16;
const CELL_X = 8;             // table cell padding (left)
const CELL_R = 12;            // table cell padding (right)
const LINE = 1.2;             // line height factor

const C = {
  ink: [22, 24, 29],          // Monochrome/Black #16181D
  body: [58, 72, 95],         // Neutral/400 #3A485F
  muted: [138, 148, 168],     // Grey/200 #8A94A8
  border: [208, 214, 225],    // Grey/150 #D0D6E1
  head: [243, 244, 247],      // Grey/75 #F3F4F7
  divider: [233, 236, 241],   // Grey/100 #E9ECF1
  white: [255, 255, 255],
  blue: [19, 118, 188],       // Trailhead #1376BC
  blueLight: [172, 207, 232], // #ACCFE8
  blueDark: [11, 67, 107],    // #0B436B
};
const STATUS_COLOR = {
  [CIS_DOSE_STATUS.completed]: [0, 122, 66],
  [CIS_DOSE_STATUS.completedLate]: [0, 122, 66],
  [CIS_DOSE_STATUS.notCounted]: [215, 40, 37],
  [CIS_DOSE_STATUS.overdue]: [215, 40, 37],
  [CIS_DOSE_STATUS.cannotMeet]: [215, 40, 37],
  [CIS_DOSE_STATUS.dueNow]: [178, 120, 0],
};
// The brand band (/brand/report-header-band-*.svg, 595 × 16): a light
// block, four slashes, then the brand bar to the edge.
const band = (light, slash, bar) => [
  { fill: light, pts: [[0, 0], [140.5, 0], [145, 16], [0, 16]] },
  ...[145, 153.5, 162, 170.5].map(x => ({ fill: slash, pts: [[x, 0], [x + 4, 0], [x + 8.5, 16], [x + 4.5, 16]] })),
  { fill: bar, pts: [[179, 0], [595, 0], [595, 16], [183.5, 16]] },
];
const BRANDS = {
  trailhead: {
    name: 'Trailhead Clinics',
    logo: 'trailhead', logoW: 51, logoH: 40,
    accent: C.blue,
    band: band(C.blueLight, C.blueDark, C.blue),
    contact: TRAILHEAD_CONTACT,
  },
  astrana: {
    name: 'Astrana Health',
    logo: 'astrana', logoW: 168.781, logoH: 16,
    accent: [108, 12, 70],                                  // #6C0C46
    band: band([226, 204, 217], C.ink, [108, 12, 70]),      // #730D4B at 21% on white
    contact: ASTRANA_CONTACT,
  },
};

// The Note column only when the child has notes; its width goes to Status
// otherwise. Date columns fit "MM/DD/YYYY" and their header on one line.
const scheduleCols = (withNotes) => [
  { label: 'Vaccine (Dose)', w: withNotes ? 96 : 108 },
  { label: 'Recommended Window', w: withNotes ? 112 : 124 },
  { label: 'Earliest Allowed', w: 90 },
  { label: 'Date Administered', w: 100 },
  { label: 'Status', w: withNotes ? 90 : 0, status: true },
  ...(withNotes ? [{ label: 'Note', w: 0 }] : []),
];
const RECORD_COLS = [
  { label: 'Dose', w: 60 },
  { label: 'Product', w: 170 },
  { label: 'CVX', w: 44 },
  { label: 'Date Administered', w: 90 },
  { label: 'Status', w: 0, status: true },
];

const ageLabel = (m) => (m === 0 ? 'At birth' : `${m} Month${m === 1 ? '' : 's'}`);
const windowOf = (r) => (r.recommendedEnd ? `${fmtDate(r.start)} - ${fmtDate(r.recommendedEnd)}` : fmtDate(r.start));
const ageText = (months) => (months == null ? '' : months < 24 ? `${months}M` : `${Math.floor(months / 12)}Y`);
const generatedOn = (d = new Date()) => `${fmtDate(d)} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

/**
 * CIS-CMB10 as a branded PDF. 'schedule' (default): every dose, a section
 * per age it starts at. 'record': only the doses given, a section per
 * vaccine, with product and CVX: the confirmed immunization history saved
 * to the gap as evidence (no billing).
 *
 * @param {object} params
 * @param {'schedule'|'record'} [params.mode='schedule']
 * @param {'trailhead'|'astrana'} [params.brand='trailhead'] – header / footer branding
 * @param {object} [params.assets] – loadCisPdfAssets(): Inter, logos, icons; Helvetica / none without
 * @returns {{ blob: Blob, filename: string }}
 */
export function generateCisSchedulePdf({ member, result, notes, startedOn, mode = 'schedule', brand = 'trailhead', assets = {} }) {
  const isRecord = mode === 'record';
  const B = BRANDS[brand] || BRANDS.trailhead;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const hasInter = !!(assets.fonts?.regular && assets.fonts?.medium);
  if (hasInter) {
    doc.addFileToVFS('Inter-Regular.ttf', assets.fonts.regular);
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    doc.addFileToVFS('Inter-Medium.ttf', assets.fonts.medium);
    doc.addFont('Inter-Medium.ttf', 'InterMedium', 'normal');
  }
  const setFont = (medium) => (hasInter
    ? doc.setFont(medium ? 'InterMedium' : 'Inter', 'normal')
    : doc.setFont('helvetica', medium ? 'bold' : 'normal'));
  const text = (value, x, y, { size = 9, color = C.ink, medium = false, align = 'left' } = {}) => {
    setFont(medium);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(value, x, y, { align, baseline: 'top', lineHeightFactor: LINE });
  };
  const width = (value, size, medium) => { setFont(medium); doc.setFontSize(size); return doc.getTextWidth(value); };
  const wrap = (value, maxW, size, medium) => { setFont(medium); doc.setFontSize(size); return doc.splitTextToSize(String(value || ''), maxW); };

  let y = BODY_TOP;
  const newPage = () => { doc.addPage(); y = BODY_TOP; };
  const ensure = (h) => { if (y + h > BODY_BOTTOM) newPage(); };

  // Section title: 12pt medium over a 100pt rule.
  const sectionTitle = (title, right) => {
    ensure(80);
    text(title, PAD, y, { size: 12, medium: true });
    if (right) text(right, PAD + CONTENT_W, y + 2, { size: 9, color: C.muted, align: 'right' });
    doc.setDrawColor(...C.ink);
    doc.setLineWidth(0.5);
    doc.line(PAD, y + 16, PAD + 100, y + 16);
    y += 22;
  };

  // label : value pairs in two columns, 9pt, between hairlines.
  const facts = (left, right) => {
    const rows = Math.max(left.length, right.length);
    const colW = (CONTENT_W - 16) / 2;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.5);
    doc.line(PAD, y, PAD + CONTENT_W, y);
    [left, right].forEach((list, ci) => {
      const x0 = PAD + ci * (colW + 16);
      list.forEach(([k, v], ri) => {
        const ty = y + 8 + ri * 14;
        text(k, x0, ty, { medium: true });
        text(':', x0 + colW - 146, ty);
        text(String(v ?? '-'), x0 + colW - 140, ty);
      });
    });
    y += 8 + rows * 14 + 4;
    doc.line(PAD, y, PAD + CONTENT_W, y);
    y += 16;
  };

  // Bordered table, grey header row; repeats the header on a new page.
  const table = (cols, rows) => {
    const fixed = cols.reduce((n, c) => n + c.w, 0);
    const cs = cols.map(c => ({ ...c, w: c.w || CONTENT_W - fixed }));
    const head = () => {
      doc.setFillColor(...C.head);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.5);
      doc.rect(PAD, y, CONTENT_W, 24, 'FD');
      let x = PAD;
      cs.forEach((c, i) => {
        if (i) doc.line(x, y, x, y + 24);
        text(c.label, x + CELL_X, y + 7.5, { size: 9, medium: true });
        x += c.w;
      });
      y += 24;
    };
    ensure(24 + 30);
    head();
    rows.forEach((row) => {
      const cells = row.cells.map((v, i) => wrap(v, cs[i].w - CELL_X - CELL_R, 9, cs[i].status));
      const h = Math.max(...cells.map(l => l.length)) * 9 * LINE + 16;
      if (y + h > BODY_BOTTOM) { newPage(); head(); }
      let x = PAD;
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.5);
      cells.forEach((lines, i) => {
        if (i) doc.line(x, y, x, y + h);
        text(lines, x + CELL_X, y + 8, { size: 9, medium: cs[i].status, color: cs[i].status ? (STATUS_COLOR[row.status] || C.ink) : C.ink });
        x += cs[i].w;
      });
      doc.line(PAD, y, PAD, y + h);
      doc.line(PAD + CONTENT_W, y, PAD + CONTENT_W, y + h);
      y += h;
      doc.line(PAD, y, PAD + CONTENT_W, y);
    });
    y += 16;
  };

  // ── Patient block ──
  const dobAge = result.dob ? `${fmtDate(result.dob)} (${ageText(result.ageMonths)})` : '-';
  const gender = member?.gender === 'F' ? 'Female' : member?.gender === 'M' ? 'Male' : member?.gender;
  const given = result.antigens.reduce((n, a) => n + a.rows.filter(r => r.kind === 'given').length, 0);
  facts(
    [['Patient Name', member?.name], ['Date Of Birth', dobAge], ['Gender', gender], ['Member ID', member?.memberId ? `#${String(member.memberId).replace(/^#/, '')}` : '-']],
    [
      ['Care Gap', 'CIS-CMB10 (Combo 10)'],
      isRecord ? ['Doses On Record', String(given)] : ['Doses Complete', `${result.doses.completed}/${result.doses.total}`],
      ['Status', result.evaluation],
      ['2nd Birthday Deadline', fmtDate(result.secondBirthday)],
    ],
  );
  if (isRecord) {
    const note = wrap('Immunization history documented for HEDIS CIS-CMB10 care coordination. No vaccines were administered by this organization; not a billable service.', CONTENT_W, 9);
    text(note, PAD, y, { size: 9, color: C.body });
    y += note.length * 9 * LINE + 16;
  } else if (startedOn) {
    text(`Series started ${fmtDate(startedOn)}`, PAD, y, { size: 9, color: C.body });
    y += 9 * LINE + 16;
  }

  // ── Sections ──
  if (isRecord) {
    const withDoses = result.antigens.filter(a => a.rows.some(r => r.kind === 'given'));
    if (!withDoses.length) text('No immunizations on record.', PAD, y, { size: 9, color: C.muted });
    withDoses.forEach(a => {
      sectionTitle(`${a.name} (${a.label})`, `${Math.min(a.valid.length, a.required)} of ${a.requiredLabel} counted`);
      table(RECORD_COLS, a.rows.filter(r => r.kind === 'given').map(r => ({
        status: r.status,
        cells: [`Dose ${r.number}`, r.record.title, r.record.code, fmtDate(r.record.date), r.reason ? `${r.status}: ${r.reason}` : r.status],
      })));
    });
  } else {
    const groups = [];
    result.antigens
      .flatMap(a => a.rows.map(r => ({ a, r })))
      .sort((p, q) => p.r.ageMonths - q.r.ageMonths || p.r.start - q.r.start)
      .forEach(it => {
        const last = groups[groups.length - 1];
        if (last && last.age === it.r.ageMonths) last.items.push(it);
        else groups.push({ age: it.r.ageMonths, items: [it] });
      });
    const noteOf = (a, r) => notes?.[`${a.key}:${r.number}`]?.note || '';
    const withNotes = result.antigens.some(a => a.rows.some(r => noteOf(a, r)));
    groups.forEach(g => {
      sectionTitle(`${ageLabel(g.age)} (${g.items.length})`, `Start date: ${fmtDate(g.items[0].r.start)}`);
      table(scheduleCols(withNotes), g.items.map(({ a, r }) => ({
        status: r.status,
        cells: [
          `${a.label} (Dose ${r.number})`,
          windowOf(r),
          fmtDate(r.earliest),
          r.record ? fmtDate(r.record.date) : '-',
          [CIS_DOSE_STATUS.notCounted, CIS_DOSE_STATUS.completedLate].includes(r.status) && r.reason ? `${r.status}: ${r.reason}` : r.status,
          ...(withNotes ? [noteOf(a, r)] : []),
        ],
      })));
    });
  }

  // ── Header, band and footer on every page ──
  const title = isRecord ? 'Immunization Record' : 'Immunization Schedule';
  const stamp = `Generated On : ${generatedOn()}`;
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    const logo = assets.logos?.[B.logo];
    if (logo?.dataUrl) doc.addImage(logo.dataUrl, 'PNG', PAD, (HEADER_H - B.logoH) / 2, B.logoW, B.logoH);
    else text(B.name, PAD, 30, { size: 14, medium: true, color: B.accent });
    const right = PAD + CONTENT_W;
    text(`Page ${p} of ${pages}`, right, 17, { size: 10, align: 'right' });
    text(title, right, 30, { size: 14, medium: true, align: 'right' });
    text(stamp, right, 47, { size: 10, color: C.muted, align: 'right' });
    B.band.forEach(({ fill, pts }) => {
      doc.setFillColor(...fill);
      const [x0, y0] = pts[0];
      doc.lines(pts.slice(1).map(([px, py], i) => [px - pts[i][0], py - pts[i][1]]), x0, HEADER_H + y0, [1, 1], 'F', true);
    });
    doc.setFillColor(...B.accent);
    doc.rect(0, PAGE.h - FOOTER_H, PAGE.w, FOOTER_H, 'F');
    let fx = PAD;
    const fy = PAGE.h - FOOTER_H + 8;
    [['phone', B.contact.phone], ['mail', B.contact.email], ['map', B.contact.address]].forEach(([icon, value], i) => {
      if (i) {
        doc.setFillColor(...C.divider);
        doc.rect(fx + 4, fy, 0.5, 12, 'F');
        fx += 8.5;
      }
      const img = assets.icons?.[icon];
      if (img?.dataUrl) { doc.addImage(img.dataUrl, 'PNG', fx, fy, 12, 12); fx += 14; }
      text(value, fx, fy + 1, { size: 10, color: C.white });
      fx += width(value, 10) + 4;
    });
  }

  return {
    blob: doc.output('blob'),
    filename: `${(member?.name || 'patient').replace(/\s+/g, '_')}_CIS-CMB10_${isRecord ? 'immunization_record' : 'schedule'}.pdf`,
  };
}
