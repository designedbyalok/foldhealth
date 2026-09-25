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
  label: 'Report Print Header',
  description: 'Employer logo, report title and date, clinic logo, brand band.',
  accent: '#1376BC',
  isDefault: true,
  isLocal: true,
  tree: reportHeaderTree(),
};

// ── Report footer ──
export const REPORT_FOOTER_SLUG = 'report-print-footer';

export const REPORT_FOOTER_NOTE = 'Strictly Confidential - Prepared for internal Fold use';

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
  label: 'Report Print Footer',
  description: 'Neutral band: confidentiality note on the left, page number on the right.',
  accent: '#1376BC',
  isDefault: true,
  isLocal: true,
  tree: reportFooterTree(),
};

// ── Picking a report component ──
/**
 * Saved components plus the built-in one (`local`), when it isn't saved yet
 * (the components migration and seed haven't run).
 */
export function withLocalComponent(saved, local) {
  return saved.some(c => c.slug === local.slug) ? saved : [local, ...saved];
}
export const withReportHeader = (saved) => withLocalComponent(saved, REPORT_HEADER_COMPONENT);
export const withReportFooter = (saved) => withLocalComponent(saved, REPORT_FOOTER_COMPONENT);

/** The component a report starts with: a saved default, else the built-in one (`slug`). */
export function defaultReportComponent(list, slug) {
  return list.find(c => c.isDefault && !c.isLocal)
    || list.find(c => c.slug === slug)
    || list[0];
}
export const defaultReportHeader = (headers) => defaultReportComponent(headers, REPORT_HEADER_SLUG);
export const defaultReportFooter = (footers) => defaultReportComponent(footers, REPORT_FOOTER_SLUG);
