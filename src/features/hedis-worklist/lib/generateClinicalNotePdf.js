import { GAP_TEMPLATES, MEASURE_CPT, savedGapData } from '../ClinicalNotePanel.utils';
import { contentOf, isFieldVisible } from '../../../lib/noteTemplateRules';

const hasTemplateRules = (fields) => !!fields?.some(f => f.type === 'content' || f.showWhen || f.derive);
// False for notes saved against an older template, which use the generic dump.
const hasTemplateValues = (fields, data) => fields.some(f => f.type !== 'content' && data?.[f.key] != null && data[f.key] !== '');

/**
 * Build the consolidated Clinical Note PDF for a HEDIS care-gap encounter.
 *
 * Layout follows AC-14: one document with a shared header (patient + DOS +
 * Telehealth Statement) and one clearly-segregated section per gap with the
 * staff's responses. Header/footer style is intentionally kept generic so it
 * can be swapped for the production template later.
 *
 * @param {object} params
 * @param {object} params.member        HEDIS member record
 * @param {string[]} params.gapCodes    Codes included in this note
 * @param {string} params.dateOfService MM-DD-YYYY from the DatePicker
 * @param {boolean} params.audioOnly
 * @param {boolean} params.audioVideo
 * @param {Record<string, object>} params.gapData per-gap form values (state)
 * @param {string} [params.signedBy]   actor that triggered generation
 *
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function generateClinicalNotePdf({
  member,
  gapCodes,
  dateOfService,
  audioOnly,
  audioVideo,
  gapData,
  signedBy = 'Care Manager',
}) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const ensureRoom = (rows = 80) => {
    if (y > pageH - margin - rows) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (text, size = 14, weight = 'bold') => {
    ensureRoom(36);
    doc.setFont('helvetica', weight);
    doc.setFontSize(size);
    doc.setTextColor(20, 24, 32);
    doc.text(text, margin, y);
    y += size + 6;
  };

  const subHeading = (text) => {
    ensureRoom(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(80, 88, 100);
    doc.text(text.toUpperCase(), margin, y);
    y += 14;
  };

  const body = (text, opts = {}) => {
    const { indent = 0, color = [40, 44, 52], size = 10 } = opts;
    if (!text) return;
    ensureRoom(24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text), pageW - margin * 2 - indent);
    for (const line of lines) {
      ensureRoom(16);
      doc.text(line, margin + indent, y);
      y += size + 4;
    }
  };

  const kv = (key, value) => {
    if (!value) return;
    ensureRoom(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(60, 64, 72);
    doc.text(`${key}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 44, 52);
    doc.text(String(value), margin + 130, y);
    y += 16;
  };

  const divider = () => {
    ensureRoom(20);
    doc.setDrawColor(220, 224, 230);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  };

  // ── Header ────────────────────────────────────────────────────────────
  // One gap is that gap's Visit Note; two or more are a Consolidated note.
  const noteTitle = gapCodes.length === 1 ? `${gapCodes[0]} Visit Note` : 'Consolidated Clinical Note';
  heading(noteTitle, 18);
  body(`Patient: ${member.name}   ·   ${member.gender === 'F' ? 'Female' : member.gender === 'M' ? 'Male' : 'Other'} · Age ${member.age}`);
  body(`Fold ID: ${member.memberId}`);
  body(`Date of Service: ${dateOfService || '-'}`);
  body(`Generated: ${new Date().toLocaleString()}   ·   Signed by: ${signedBy}`);
  divider();

  // ── Telehealth Statement ──────────────────────────────────────────────
  subHeading('Telehealth Statement');
  if (!audioOnly && !audioVideo) {
    body('No telehealth consent recorded.');
  } else {
    if (audioOnly) {
      body('☑ Audio-only visit: Verbal consent obtained. Patient was informed of the nature of the visit and the limitations of audio-only communication, and agreed to proceed.');
    }
    if (audioVideo) {
      body('☑ Audio-video visit: Verbal consent obtained. Patient was informed of the nature of the visit and the limitations of audio-video communication, and agreed to proceed.');
    }
  }
  divider();

  // ── Per-gap sections ──────────────────────────────────────────────────
  const MEASURE_NAMES = {
    CBP: 'Controlling Blood Pressure',
    COL: 'Colorectal Cancer Screening',
    'COA-FS': 'Care for Older Adults: Functional Status',
    'COA-M': 'Care for Older Adults: Medication Review',
    BCS: 'Breast Cancer Screening',
    DM: 'Diabetes Management',
    GSD3: 'Glycemic Status Assessment (HbA1c > 9%)',
    ABA: 'Adult BMI Assessment',
    FUH: 'Follow-Up After Hospitalization',
    AMR: 'Asthma Medication Ratio',
    KED: 'Kidney Health Evaluation',
    EED: 'Eye Exam for Patients With Diabetes',
    OMW: 'Osteoporosis Management in Women',
    BPD: 'Blood Pressure Documentation',
    CCS: 'Cervical Cancer Screening',
    LSC: 'Lead Screening in Children',
    WCV: 'Child and Adolescent Well-Care Visits',
  };

  gapCodes.forEach((code, i) => {
    const data = savedGapData(code, gapData?.[code] ?? {}) || {};
    ensureRoom(60);
    if (i > 0) {
      y += 8;
      divider();
    }
    heading(`${code}: ${MEASURE_NAMES[code] ?? code}`, 13);

    if (code === 'CBP') {
      // Aligned with the CBP Visit Note form fields in ClinicalNotePanel.utils.js
      // (defaultGapData): Initial Blood Pressure card + Location + the five
      // patient-question radios.
      const LOCATION_LABEL = {
        outpatient: 'Outpatient visit',
        telehealth: 'Telehealth visit',
        clinic: 'Clinic',
        home: 'Home',
      };
      const bp = (data.systolic && data.diastolic) ? `${data.systolic} / ${data.diastolic} mmHg` : null;
      kv('Date of BP reading', data.bpDate);
      kv('Blood Pressure', bp);
      kv('Location', LOCATION_LABEL[data.location] || data.location);
      const yn = (v) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'denies' ? 'Patient denies any symptoms at this time' : v === 'med-list' ? 'Medication list captured' : null);
      kv('Checks BP regularly and logs results?', yn(data.selfMonitors));
      kv('Taking BP medications as prescribed?', yn(data.takingMeds));
      kv('Symptoms (BP < 100/60)', yn(data.symptomsLow));
      kv('Symptoms (BP > 140/90 and < 160/100)', yn(data.symptomsMid));
      kv('Symptoms (BP > 160/100)', yn(data.symptomsHigh));
    } else if (code === 'COL') {
      kv('Screening method', data.screeningMethod);
      kv('Result date', data.colResultDate);
    } else if (code === 'KED') {
      kv('eGFR (mL/min/1.73 m²)', data.egfr);
      kv('eGFR result date', data.egfrResultDate);
      kv('uACR (mg/g)', data.uacr);
      kv('uACR result date', data.uacrResultDate);
    } else if (code === 'DM') {
      kv('HbA1c Value (%)', data.a1cValue);
      kv('HbA1c Draw Date', data.a1cDate);
      kv('Diabetes Type', data.diabetesType);
      kv('Current Management', data.currentManagement);
      kv('Last Eye Exam Date', data.lastEyeExamDate);
      kv('Last Foot Exam Date', data.lastFootExamDate);
      kv('Systolic BP (mmHg)', data.bpSystolic);
      kv('Diastolic BP (mmHg)', data.bpDiastolic);
      kv('Nephropathy screening completed?', data.nephropathyScreened);
      kv('Plan updated?', data.planUpdated);
      kv('Counseling provided?', data.counselingProvided ? 'Yes' : null);
      kv('Additional Notes', data.notes);
    } else if (code === 'GSD3') {
      kv('HbA1c Value (%)', data.a1cValue);
      kv('HbA1c Draw Date', data.a1cDate);
      kv('Diabetes Type', data.diabetesType);
      kv('Current Management', data.currentManagement);
      kv('Plan updated?', data.planUpdated);
      kv('Additional Notes', data.notes);
    } else if (hasTemplateRules(GAP_TEMPLATES[code]) && hasTemplateValues(GAP_TEMPLATES[code], data)) {
      // Templates with display rules (e.g. LSC): only the visible fields,
      // labelled as on the form, plus the care plan block that applies.
      // The PDF's base font has no "≥", so it prints as ">=".
      const pdfText = (t) => String(t).replace(/≥/g, '>=');
      for (const f of GAP_TEMPLATES[code].filter(f2 => isFieldVisible(f2, data))) {
        const raw = data[f.key];
        if (f.type === 'content') {
          const block = contentOf(f, data);
          body(pdfText(block.title), { color: [60, 64, 72] });
          for (const b of block.bullets || []) body(`• ${pdfText(b)}`, { indent: 10 });
        } else if (f.type === 'checkbox') {
          kv(f.label, raw ? pdfText(f.checkboxLabel || 'Yes') : null);
        } else if (f.options) {
          kv(f.label, pdfText(f.options.find(o => o.value === raw)?.label || raw || ''));
        } else {
          kv(f.label, raw !== '' && raw != null ? `${raw}${f.unit ? ` ${f.unit}` : ''}` : null);
        }
      }
      if (MEASURE_CPT[code]) kv('CPT Code', MEASURE_CPT[code]);
    } else {
      // Generic fallback for GAP_TEMPLATES-driven gaps: render all stored
      // key/value pairs so DM and future templates automatically appear in
      // the PDF without needing a bespoke branch per code.
      const entries = Object.entries(data || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false);
      if (entries.length === 0) {
        body('No evidence documented.', { color: [120, 124, 132] });
      } else {
        for (const [k, v] of entries) {
          if (k === 'evidenceLabel' || k === 'manuallyOff' || typeof v === 'object') continue;
          const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          kv(label, typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));
        }
      }
    }
  });

  // ── Footer (page numbers) ─────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(140, 144, 152);
    doc.text(`${member.name}  ·  ${noteTitle}`, margin, pageH - 24);
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 24, { align: 'right' });
  }

  // Return the jsPDF-native Blob: it's far more reliable to render in an
  // <object>/<iframe> via URL.createObjectURL(blob) than to round-trip through
  // a `data:application/pdf;filename=…;base64,…` URL (which some browsers
  // refuse to render inline because of the non-standard `filename=` segment).
  const blob = doc.output('blob');
  // dataUrl serves two callers: (a) handleSignAndPrint's window.open(...)
  // path (which won't accept a Blob URL that revokes on unload), and (b)
  // the clinical_notes.pdf_data_url column so a later reader can render
  // the PDF straight from the row without re-generating it. Base64 keeps
  // the string safely storable in Supabase JSONB / text columns.
  const dataUrl = doc.output('datauristring');
  const safeName = member.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const datePart = new Date().toISOString().slice(0, 10);
  return {
    blob,
    dataUrl,
    filename: `consolidated-clinical-note__${safeName}__${datePart}.pdf`,
  };
}
