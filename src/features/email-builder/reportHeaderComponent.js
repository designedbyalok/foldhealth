/* eslint-disable no-restricted-syntax -- email block data: sizes are px in the
   rendered email HTML (as in headerFooterLibrary.js), not app styles. */
/**
 * The report print header, as a saved header component: the employer logo on
 * the left, the report title and "Generated On" in the middle, the clinic
 * logo on the right, and the brand band underneath. Built from ordinary
 * builder blocks, so it opens and edits in the email builder like any other
 * component.
 *
 * Report values are merge tags ({{report_title}}, {{generated_on}},
 * {{employer_logo}}), filled in when the header is drawn on a report.
 *
 * Seeded to `email_header_footer_presets` by scripts/seed.js (slug below),
 * and used as the local fallback until that migration has run.
 */
export const REPORT_HEADER_SLUG = 'report-print-header';

const ids = {
  root: 'rh-root',
  cols: 'rh-cols',
  clinic: 'rh-clinic-logo',
  title: 'rh-title',
  generated: 'rh-generated',
  employer: 'rh-employer-logo',
  band: 'rh-band',
};
const noPad = { top: 0, bottom: 0, left: 0, right: 0 };

/** `{ rootId, blocks }`, the shape every saved component stores. */
export function reportHeaderTree() {
  return {
    rootId: ids.root,
    blocks: {
      [ids.clinic]: {
        type: 'Image',
        data: {
          // Figma: 60.8 × 48, centred in a 108 × 48 slot.
          props: { url: '/brand/trailhead-clinics-logo.png', alt: 'Trailhead Clinics', width: 61, height: 48 },
          style: { blockAlign: 'center', padding: noPad },
        },
      },
      [ids.title]: {
        type: 'Heading',
        data: {
          props: { text: '{{report_title}}', level: 'h1' },
          style: { color: '#16181D', fontSize: 16, fontWeight: '500', textAlign: 'center', fontFamily: 'Inter', lineHeight: 1.2, padding: noPad },
        },
      },
      [ids.generated]: {
        type: 'Text',
        data: {
          props: { text: 'Generated On : {{generated_on}}' },
          style: { color: '#8A94A8', fontSize: 10, textAlign: 'center', fontFamily: 'Inter', lineHeight: 1.2, padding: noPad },
        },
      },
      [ids.employer]: {
        type: 'Image',
        data: {
          // Fitted to a 108 × 20 slot, left-aligned.
          props: { url: '{{employer_logo}}', alt: 'Employer logo', width: 108, height: 20, objectFit: 'contain', objectPosition: 'left' },
          style: { blockAlign: 'left', padding: noPad },
        },
      },
      [ids.cols]: {
        type: 'ColumnsContainer',
        data: {
          style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
          props: {
            columnsCount: 3,
            // Two 108px logo slots either side of the 552px row, the title between.
            columnsGap: 0,
            columnWidths: [19.57, 60.86, 19.57],
            contentAlignment: 'middle',
            columns: [
              { childrenIds: [ids.employer], valign: 'middle', align: 'left' },
              { childrenIds: [ids.title, ids.generated], valign: 'middle', align: 'center' },
              { childrenIds: [ids.clinic], valign: 'middle', align: 'right' },
            ],
          },
        },
      },
      [ids.band]: {
        type: 'Image',
        data: {
          props: { url: '/brand/report-header-band.svg', alt: '', width: '100%' },
          style: { padding: noPad },
        },
      },
      [ids.root]: {
        type: 'Container',
        data: {
          role: 'report_header',
          style: { backgroundColor: '#FFFFFF', padding: noPad },
          props: { childrenIds: [ids.cols, ids.band] },
        },
      },
    },
  };
}

/** The header as a component row (see fetchCustomPresets), for the local fallback. */
export const REPORT_HEADER_COMPONENT = {
  id: REPORT_HEADER_SLUG,
  slug: REPORT_HEADER_SLUG,
  role: 'report_header',
  label: 'Print Report Header Option 1',
  description: 'Employer logo, report title and date, clinic logo, brand band.',
  accent: '#1376BC',
  isDefault: true,
  isLocal: true,
  tree: reportHeaderTree(),
};

// ── Report footer ──
export const REPORT_FOOTER_SLUG = 'report-print-footer';

export const REPORT_FOOTER_NOTE = 'Strictly Confidential - Prepared for internal use';

/**
 * The report print footer: a Neutral 50 band with the confidentiality note
 * on the left and the page number ({{page_number}}, filled per page) on the
 * right. 24pt tall on A4.
 */
export function reportFooterTree() {
  const text = (value, align) => ({
    type: 'Text',
    data: {
      props: { text: value },
      style: { color: '#5F6A7E', fontSize: 10, textAlign: align, fontFamily: 'Inter', lineHeight: 1.2, padding: { top: 6, bottom: 6, left: 0, right: 0 } },
    },
  });
  return {
    rootId: 'rf-root',
    blocks: {
      'rf-note': text(REPORT_FOOTER_NOTE, 'left'),
      'rf-page': text('{{page_number}}', 'right'),
      'rf-cols': {
        type: 'ColumnsContainer',
        data: {
          style: { padding: { top: 0, bottom: 0, left: 24, right: 24 } },
          props: {
            columnsCount: 2,
            columnsGap: 0,
            columnWidths: [80, 20],
            contentAlignment: 'middle',
            columns: [
              { childrenIds: ['rf-note'], valign: 'middle', align: 'left' },
              { childrenIds: ['rf-page'], valign: 'middle', align: 'right' },
            ],
          },
        },
      },
      'rf-root': {
        type: 'Container',
        data: {
          role: 'report_footer',
          style: { backgroundColor: '#F6F7F8', padding: noPad },
          props: { childrenIds: ['rf-cols'] },
        },
      },
    },
  };
}

export const REPORT_FOOTER_COMPONENT = {
  id: REPORT_FOOTER_SLUG,
  slug: REPORT_FOOTER_SLUG,
  role: 'report_footer',
  label: 'Print Report Footer Option 1',
  description: 'Neutral band: confidentiality note on the left, page number on the right.',
  accent: '#1376BC',
  isDefault: true,
  isLocal: true,
  tree: reportFooterTree(),
};

// ── Patient summary report (Figma CCM-Story 11211:481704) ──
// Trailhead Clinics' logo, the title with "Generated On" and "Page x of y",
// and the brand band in Trailhead blue (#1376BC) instead of the frame's
// purple; the footer is a blue bar with the clinic's contact details.
export const PATIENT_SUMMARY_HEADER_SLUG = 'patient-summary-report-header';
export const PATIENT_SUMMARY_FOOTER_SLUG = 'patient-summary-report-footer';

// Sample contact details for Trailhead Clinics, Glenwood Springs, CO.
export const TRAILHEAD_CONTACT = {
  phone: '(970) 555-0142',
  email: 'info@trailheadclinics.com',
  address: '1607 Grand Ave Unit 22, Glenwood Springs, CO 81601',
};

export function patientSummaryHeaderTree() {
  const right = (value, color, size, weight) => ({
    type: size === 14 ? 'Heading' : 'Text',
    data: {
      props: size === 14 ? { text: value, level: 'h1' } : { text: value },
      style: { color, fontSize: size, fontWeight: weight, textAlign: 'right', fontFamily: 'Inter', lineHeight: 1.2, padding: noPad },
    },
  });
  return {
    rootId: 'ps-h-root',
    blocks: {
      'ps-h-logo': {
        type: 'Image',
        data: {
          props: { url: '/brand/trailhead-clinics-logo.png', alt: 'Trailhead Clinics', width: 51, height: 40 },
          style: { blockAlign: 'left', padding: noPad },
        },
      },
      'ps-h-title': right('{{report_title}}', '#16181D', 14, '500'),
      'ps-h-generated': right('Generated On : {{generated_on}}', '#8A94A8', 10, '400'),
      'ps-h-page': right('Page {{page_number}} of {{page_count}}', '#3A485F', 10, '400'),
      'ps-h-cols': {
        type: 'ColumnsContainer',
        data: {
          style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
          props: {
            columnsCount: 2,
            columnsGap: 8,
            columnWidths: [50, 50],
            contentAlignment: 'middle',
            columns: [
              { childrenIds: ['ps-h-logo'], valign: 'middle', align: 'left' },
              { childrenIds: ['ps-h-title', 'ps-h-generated', 'ps-h-page'], valign: 'middle', align: 'right' },
            ],
          },
        },
      },
      'ps-h-band': {
        type: 'Image',
        data: {
          props: { url: '/brand/report-header-band-blue.svg', alt: '', width: '100%' },
          style: { padding: noPad },
        },
      },
      'ps-h-root': {
        type: 'Container',
        data: {
          role: 'report_header',
          style: { backgroundColor: '#FFFFFF', padding: noPad },
          props: { childrenIds: ['ps-h-cols', 'ps-h-band'] },
        },
      },
    },
  };
}

export function patientSummaryFooterTree() {
  const item = (icon, text) => `<span style="display:inline-flex;align-items:center;gap:2px;white-space:nowrap"><img src="${icon}" alt="" width="12" height="12" style="display:block;width:12px;height:12px">${text}</span>`;
  const divider = '<span style="display:inline-block;width:0.5px;height:12px;margin:0 4px;background:#E9ECF1"></span>';
  const c = TRAILHEAD_CONTACT;
  const html = `<div style="display:flex;align-items:center;gap:4px;color:#FFFFFF;font-family:Inter,Arial,sans-serif;font-size:10px;line-height:1.2">${[
    item('/brand/icon-phone-white.svg', c.phone),
    item('/brand/icon-mail-white.svg', c.email),
    item('/brand/icon-map-point-white.svg', c.address),
  ].join(divider)}</div>`;
  return {
    rootId: 'ps-f-root',
    blocks: {
      'ps-f-contact': {
        type: 'RawHtml',
        data: { props: { html }, style: { padding: { top: 8, bottom: 8, left: 24, right: 24 } } },
      },
      'ps-f-root': {
        type: 'Container',
        data: {
          role: 'report_footer',
          style: { backgroundColor: '#1376BC', padding: noPad },
          props: { childrenIds: ['ps-f-contact'] },
        },
      },
    },
  };
}

export const PATIENT_SUMMARY_HEADER_COMPONENT = {
  id: PATIENT_SUMMARY_HEADER_SLUG,
  slug: PATIENT_SUMMARY_HEADER_SLUG,
  role: 'report_header',
  label: 'Print Report Header Option 2',
  description: 'Trailhead logo, report name, date and page, blue brand band.',
  accent: '#1376BC',
  isDefault: false,
  isLocal: true,
  tree: patientSummaryHeaderTree(),
};

export const PATIENT_SUMMARY_FOOTER_COMPONENT = {
  id: PATIENT_SUMMARY_FOOTER_SLUG,
  slug: PATIENT_SUMMARY_FOOTER_SLUG,
  role: 'report_footer',
  label: 'Print Report Footer Option 2',
  description: 'Blue bar with the clinic\'s phone, email and address.',
  accent: '#1376BC',
  isDefault: false,
  isLocal: true,
  tree: patientSummaryFooterTree(),
};

// ── Astrana Health (Figma Mar-Present 2568:6418 / CCM-Story 11295:487395) ──
// The Patient Summary layout in Astrana branding, for the Astrana team's
// preview: their wordmark, page / title / Generated On on the right, the
// maroon brand band, and a maroon footer with the contact details shown in
// the frame. The Trailhead components above are unchanged.
export const ASTRANA_HEADER_SLUG = 'astrana-report-header';
export const ASTRANA_FOOTER_SLUG = 'astrana-report-footer';
export const ASTRANA_BRAND = {
  logo: '/brand/astrana-health-logo.svg',
  logoSize: { width: 168.781, height: 16 },
  band: '/brand/report-header-band-astrana.svg',
  footer: '#6C0C46',
};
// Contact details as shown in the Figma frames.
export const ASTRANA_CONTACT = {
  phone: '+1 92841 36978',
  email: 'support@fold.health',
  address: 'Level 4, Office # 401, Amar Tech Park, 402, Balewadi, Pune',
};

export function astranaHeaderTree() {
  const right = (value, color, size, weight) => ({
    type: size === 14 ? 'Heading' : 'Text',
    data: {
      props: size === 14 ? { text: value, level: 'h1' } : { text: value },
      style: { color, fontSize: size, fontWeight: weight, textAlign: 'right', fontFamily: 'Inter', lineHeight: 1.2, padding: noPad },
    },
  });
  return {
    rootId: 'as-h-root',
    blocks: {
      'as-h-logo': {
        type: 'Image',
        data: {
          props: { url: ASTRANA_BRAND.logo, alt: 'Astrana Health', ...ASTRANA_BRAND.logoSize },
          style: { blockAlign: 'left', padding: noPad },
        },
      },
      'as-h-page': right('Page {{page_number}} of {{page_count}}', '#16181D', 10, '400'),
      'as-h-title': right('{{report_title}}', '#16181D', 14, '500'),
      'as-h-generated': right('Generated On : {{generated_on}}', '#8A94A8', 10, '400'),
      'as-h-cols': {
        type: 'ColumnsContainer',
        data: {
          style: { padding: { top: 16, bottom: 16, left: 24, right: 24 } },
          props: {
            columnsCount: 2,
            columnsGap: 8,
            columnWidths: [50, 50],
            contentAlignment: 'middle',
            columns: [
              { childrenIds: ['as-h-logo'], valign: 'middle', align: 'left' },
              { childrenIds: ['as-h-page', 'as-h-title', 'as-h-generated'], valign: 'middle', align: 'right' },
            ],
          },
        },
      },
      'as-h-band': {
        type: 'Image',
        data: {
          props: { url: ASTRANA_BRAND.band, alt: '', width: '100%' },
          style: { padding: noPad },
        },
      },
      'as-h-root': {
        type: 'Container',
        data: {
          role: 'report_header',
          style: { backgroundColor: '#FFFFFF', padding: noPad },
          props: { childrenIds: ['as-h-cols', 'as-h-band'] },
        },
      },
    },
  };
}

export function astranaFooterTree() {
  const item = (icon, text) => `<span style="display:inline-flex;align-items:center;gap:2px;white-space:nowrap"><img src="${icon}" alt="" width="12" height="12" style="display:block;width:12px;height:12px">${text}</span>`;
  const divider = '<span style="display:inline-block;width:0.5px;height:12px;margin:0 4px;background:#E9ECF1"></span>';
  const c = ASTRANA_CONTACT;
  const html = `<div style="display:flex;align-items:center;gap:4px;color:#FFFFFF;font-family:Inter,Arial,sans-serif;font-size:10px;line-height:1.2">${[
    item('/brand/icon-phone-white.svg', c.phone),
    item('/brand/icon-mail-white.svg', c.email),
    item('/brand/icon-map-point-white.svg', c.address),
  ].join(divider)}</div>`;
  return {
    rootId: 'as-f-root',
    blocks: {
      'as-f-contact': {
        type: 'RawHtml',
        data: { props: { html }, style: { padding: { top: 8, bottom: 8, left: 24, right: 24 } } },
      },
      'as-f-root': {
        type: 'Container',
        data: {
          role: 'report_footer',
          style: { backgroundColor: ASTRANA_BRAND.footer, padding: noPad },
          props: { childrenIds: ['as-f-contact'] },
        },
      },
    },
  };
}

export const ASTRANA_HEADER_COMPONENT = {
  id: ASTRANA_HEADER_SLUG,
  slug: ASTRANA_HEADER_SLUG,
  role: 'report_header',
  label: 'Astrana Report Header',
  description: 'Astrana Health logo, page, report name and date, maroon brand band.',
  accent: '#6C0C46',
  isDefault: false,
  isLocal: true,
  tree: astranaHeaderTree(),
};

export const ASTRANA_FOOTER_COMPONENT = {
  id: ASTRANA_FOOTER_SLUG,
  slug: ASTRANA_FOOTER_SLUG,
  role: 'report_footer',
  label: 'Astrana Report Footer',
  description: 'Maroon bar with Astrana\'s phone, email and address.',
  accent: '#6C0C46',
  isDefault: false,
  isLocal: true,
  tree: astranaFooterTree(),
};

// ── Options 3 and 4 ──
export const HEADER_OPTION_3_SLUG = 'print-report-header-option-3';
export const HEADER_OPTION_4_SLUG = 'print-report-header-option-4';
export const FOOTER_OPTION_3_SLUG = 'print-report-footer-option-3';
export const FOOTER_OPTION_4_SLUG = 'print-report-footer-option-4';

const text = (value, { color, size, weight = '400', align = 'left', pad = noPad }) => ({
  type: size >= 14 ? 'Heading' : 'Text',
  data: {
    props: size >= 14 ? { text: value, level: 'h1' } : { text: value },
    style: { color, fontSize: size, fontWeight: weight, textAlign: align, fontFamily: 'Inter', lineHeight: 1.2, padding: pad },
  },
});
const image = (url, alt, width, height, align) => ({
  type: 'Image',
  data: { props: { url, alt, width, height, objectFit: 'contain', objectPosition: align }, style: { blockAlign: align, padding: noPad } },
});
const columns = (widths, cols, pad, gap = 8) => ({
  type: 'ColumnsContainer',
  data: {
    style: { padding: pad },
    props: {
      columnsCount: cols.length,
      columnsGap: gap,
      columnWidths: widths,
      contentAlignment: 'middle',
      columns: cols.map(([ids, align]) => ({ childrenIds: ids, valign: 'middle', align })),
    },
  },
});
const container = (role, bg, childrenIds, pad = noPad) => ({
  type: 'Container',
  data: { role, style: { backgroundColor: bg, padding: pad }, props: { childrenIds } },
});

/**
 * Option 3, minimal: the report name and "Generated On" on the left, the
 * clinic logo on the right, and a 2px Trailhead-blue rule underneath.
 */
export function headerOption3Tree() {
  return {
    rootId: 'h3-root',
    blocks: {
      'h3-title': text('{{report_title}}', { color: '#16181D', size: 16, weight: '500' }),
      'h3-generated': text('Generated On : {{generated_on}}', { color: '#8A94A8', size: 10, pad: { ...noPad, top: 2 } }),
      'h3-logo': image('/brand/trailhead-clinics-logo.png', 'Trailhead Clinics', 41, 32, 'right'),
      'h3-cols': columns([70, 30], [[['h3-title', 'h3-generated'], 'left'], [['h3-logo'], 'right']], { top: 16, bottom: 12, left: 24, right: 24 }),
      'h3-rule': { type: 'Divider', data: { props: { lineColor: '#1376BC', lineHeight: 2 }, style: { padding: { top: 0, bottom: 0, left: 24, right: 24 } } } },
      'h3-root': container('report_header', '#FFFFFF', ['h3-cols', 'h3-rule']),
    },
  };
}

/**
 * Option 4, solid band: a Trailhead-blue header with the white clinic logo
 * on the left, the report name and "Generated On" in the middle, and the
 * page on the right, all in white.
 */
export function headerOption4Tree() {
  return {
    rootId: 'h4-root',
    blocks: {
      'h4-logo': image('/brand/trailhead-clinics-logo-white.png', 'Trailhead Clinics', 46, 36, 'left'),
      'h4-title': text('{{report_title}}', { color: '#FFFFFF', size: 16, weight: '500', align: 'center' }),
      'h4-generated': text('Generated On : {{generated_on}}', { color: '#DCEAF6', size: 10, align: 'center', pad: { ...noPad, top: 2 } }),
      'h4-page': text('Page {{page_number}} of {{page_count}}', { color: '#FFFFFF', size: 10, align: 'right' }),
      'h4-cols': columns([22, 56, 22], [[['h4-logo'], 'left'], [['h4-title', 'h4-generated'], 'center'], [['h4-page'], 'right']], { top: 14, bottom: 14, left: 24, right: 24 }),
      'h4-root': container('report_header', '#1376BC', ['h4-cols']),
    },
  };
}

/**
 * Option 3, minimal: a thin rule, then the clinic and its town on the left
 * and "Page x of y" on the right, in grey.
 */
export function footerOption3Tree() {
  return {
    rootId: 'f3-root',
    blocks: {
      'f3-rule': { type: 'Divider', data: { props: { lineColor: '#D0D6E1', lineHeight: 1 }, style: { padding: { top: 0, bottom: 0, left: 24, right: 24 } } } },
      'f3-clinic': text('Trailhead Clinics · Glenwood Springs, CO', { color: '#6F7A90', size: 10 }),
      'f3-page': text('Page {{page_number}} of {{page_count}}', { color: '#6F7A90', size: 10, align: 'right' }),
      'f3-cols': columns([70, 30], [[['f3-clinic'], 'left'], [['f3-page'], 'right']], { top: 7, bottom: 7, left: 24, right: 24 }, 0),
      'f3-root': container('report_footer', '#FFFFFF', ['f3-rule', 'f3-cols']),
    },
  };
}

/**
 * Option 4, tinted band: a light Trailhead-blue bar with the
 * confidentiality note on the left and the page number, in blue, on the right.
 */
export function footerOption4Tree() {
  return {
    rootId: 'f4-root',
    blocks: {
      'f4-note': text(REPORT_FOOTER_NOTE, { color: '#0B436B', size: 10 }),
      'f4-page': text('Page {{page_number}}', { color: '#1376BC', size: 10, weight: '600', align: 'right' }),
      'f4-cols': columns([80, 20], [[['f4-note'], 'left'], [['f4-page'], 'right']], { top: 7, bottom: 7, left: 24, right: 24 }, 0),
      'f4-root': container('report_footer', '#EAF2F9', ['f4-cols']),
    },
  };
}

const option = (slug, role, label, description, tree) => ({
  id: slug, slug, role, label, description, accent: '#1376BC', isDefault: false, isLocal: true, tree,
});
export const HEADER_OPTION_3_COMPONENT = option(HEADER_OPTION_3_SLUG, 'report_header', 'Print Report Header Option 3', 'Report name and date, clinic logo, thin blue rule.', headerOption3Tree());
export const HEADER_OPTION_4_COMPONENT = option(HEADER_OPTION_4_SLUG, 'report_header', 'Print Report Header Option 4', 'Solid blue band: white logo, report name and date, page.', headerOption4Tree());
export const FOOTER_OPTION_3_COMPONENT = option(FOOTER_OPTION_3_SLUG, 'report_footer', 'Print Report Footer Option 3', 'Thin rule, clinic and town, page x of y.', footerOption3Tree());
export const FOOTER_OPTION_4_COMPONENT = option(FOOTER_OPTION_4_SLUG, 'report_footer', 'Print Report Footer Option 4', 'Light blue bar: confidentiality note, page number.', footerOption4Tree());

// ── Picking a report component ──
/**
 * Saved components plus the built-in one (`local`), when it isn't saved yet
 * (the components migration and seed haven't run).
 */
export function withLocalComponent(saved, local) {
  return saved.some(c => c.slug === local.slug) ? saved : [local, ...saved];
}
// The built-in options stand in only until they're seeded (saved rows carry
// their slug); after that the saved list is the whole truth, so a seeded
// option that's deleted stays deleted instead of its stand-in coming back.
const withLocals = (saved, locals) => (saved.some(c => c.slug)
  ? saved
  : locals.reduceRight((list, local) => withLocalComponent(list, local), saved));
// The built-in options, in order (Option 1 … 4).
export const REPORT_HEADER_OPTIONS = [REPORT_HEADER_COMPONENT, PATIENT_SUMMARY_HEADER_COMPONENT, HEADER_OPTION_3_COMPONENT, HEADER_OPTION_4_COMPONENT, ASTRANA_HEADER_COMPONENT];
export const REPORT_FOOTER_OPTIONS = [REPORT_FOOTER_COMPONENT, PATIENT_SUMMARY_FOOTER_COMPONENT, FOOTER_OPTION_3_COMPONENT, FOOTER_OPTION_4_COMPONENT, ASTRANA_FOOTER_COMPONENT];
export const withReportHeader = (saved) => withLocals(saved, REPORT_HEADER_OPTIONS);
export const withReportFooter = (saved) => withLocals(saved, REPORT_FOOTER_OPTIONS);

/** The component a report starts with: a saved default, else the built-in one (`slug`). */
export function defaultReportComponent(list, slug) {
  return list.find(c => c.isDefault && !c.isLocal)
    || list.find(c => c.slug === slug)
    || list[0];
}
export const defaultReportHeader = (headers) => defaultReportComponent(headers, REPORT_HEADER_SLUG);
export const defaultReportFooter = (footers) => defaultReportComponent(footers, REPORT_FOOTER_SLUG);
