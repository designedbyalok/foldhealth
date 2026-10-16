import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { FilePreview } from '../../../components/FilePreview/FilePreview';
import { getIcdsForMember } from '../data/icds';
import styles from './DocEvidenceViewer.module.css';

/**
 * DocEvidenceViewer — the source-document preview shown in the LeftWorkspace
 * Documents tab when an ICD is selected (Paper 1UD1 / 5IX).
 *
 * Rendering priority:
 *   1. If the selected doc carries a real file URL (uploaded via
 *      UploadChartDrawer / DocumentsUploader), embed that directly —
 *      <iframe> for PDF/Office types, <img> for image types.
 *   2. Otherwise, synthesize a one-page outpatient note as a PDF
 *      (client-side via jsPDF) tagged with the doc's name / type, and
 *      highlight the icdScope's Past-Medical-History line as the
 *      coding evidence. This keeps demo/system-seeded docs viewable
 *      until a real backend streams the source file.
 */
export function DocEvidenceViewer({ member, icdScope, openDoc = null }) {
  const [url, setUrl] = useState(null);
  const docPdf = openDoc?.pdf || null;
  const docFile = openDoc?.file || null;
  const docExt = (openDoc?.ext || '').toLowerCase();
  const useDirect = !!(docPdf || docFile); // real uploaded file — render as-is

  // Build a synthesized note (blob URL) only when we DON'T have a real doc
  // file. Each mount — including StrictMode's double-mount — gets a fresh
  // URL and revokes its own on cleanup; using useMemo would revoke the URL
  // on first cleanup and reuse it stale on remount (blank viewer).
  useEffect(() => {
    if (useDirect) { setUrl(null); return undefined; }
    const next = buildNotePdfUrl(member, icdScope, openDoc);
    setUrl(next);
    return () => { if (next) URL.revokeObjectURL(next); };
  }, [useDirect, member?.name, member?.dos, icdScope, openDoc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (useDirect) {
    // FilePreview routes by type — image/pdf inline, DOCX rendered to HTML,
    // anything else gets an explicit open-in-new-tab card (never a
    // surprise download from an <iframe> the browser can't render).
    return (
      <FilePreview
        key={docPdf || docFile?.name || openDoc?.id}
        src={docPdf}
        file={docFile}
        name={openDoc.name || 'Source document'}
        ext={docExt}
        className={styles.frame}
        hideScrollbar
      />
    );
  }

  if (!url) return null;
  return (
    <iframe
      key={url}
      title={openDoc?.name || 'Source document'}
      src={url}
      className={styles.frame}
    />
  );
}

// Build a one-page outpatient note as a PDF blob URL, highlighting the line
// for `icdScope`. Returns a `blob:` URL (revoke it when done). The `openDoc`
// (when present) tags the header with the specific document's name/type so
// each tab in the Documents viewer renders its own titled note instead of
// looking identical.
function buildNotePdfUrl(member, icdScope, openDoc = null) {
  if (!member?.name) return null;
  const icds = getIcdsForMember(member.name);
  const dos = member?.dos_list?.[0]?.date || member?.dos || '—';
  const provider = member?.rp || 'Dr. Aldo Richman';
  const first = member.name.split(' ')[0];
  // Map doc type → header title so each doc's rendered note reads as
  // distinct from the others in the tab strip. Fallbacks retain the
  // original "OUTPATIENT CLINIC VISIT NOTE" for docs with no type.
  const docTitleFor = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('lab'))            return 'LABORATORY REPORT';
    if (t.includes('radiology'))      return 'RADIOLOGY REPORT';
    if (t.includes('imaging'))        return 'IMAGING REPORT';
    if (t.includes('discharge'))      return 'HOSPITAL DISCHARGE SUMMARY';
    if (t.includes('referral'))       return 'REFERRAL LETTER';
    if (t.includes('consult'))        return 'CONSULTATION REPORT';
    if (t.includes('progress'))       return 'PROGRESS NOTE';
    if (t.includes('visit'))          return 'OUTPATIENT VISIT NOTE';
    if (t.includes('note'))           return 'CLINICAL NOTE';
    return 'CLINICAL DOCUMENT';
  };
  const headerTitle = openDoc?.type ? docTitleFor(openDoc.type) : 'OUTPATIENT CLINIC VISIT NOTE';

  const doc = new jsPDF({ unit: 'pt', format: 'letter' }); // 612 × 792 pt
  const L = 56;               // left margin
  const R = 612 - 56;         // right edge
  let y = 64;

  const heading = (text) => {
    y += 10;
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(30, 41, 59);
    doc.text(text, L, y);
    y += 14;
  };
  const para = (text) => {
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(text, R - L);
    doc.text(lines, L, y);
    y += lines.length * 14 + 4;
  };

  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(15, 23, 42);
  doc.text(headerTitle, L, y);
  y += 20;
  if (openDoc?.name) {
    doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(100, 116, 139);
    doc.text(openDoc.name, L, y);
    y += 14;
  }
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(51, 65, 85);
  doc.text(
    doc.splitTextToSize(
      `Patient: ${member.name}    Date of Service: ${dos}    Visit Type: Follow-up — Chronic Disease Management    Attending Physician: ${provider}`,
      R - L,
    ),
    L, y,
  );
  y += 34;

  heading('CHIEF COMPLAINT');
  para('Follow-up for chronic condition management and medication review.');

  heading('HISTORY OF PRESENT ILLNESS');
  para(`${first} is a patient with known chronic conditions presenting today for scheduled follow-up. Reports ongoing symptoms consistent with the documented problem list below. Adherent to medications; home readings have been variable. No acute distress at time of visit.`);

  heading('PAST MEDICAL HISTORY');
  doc.setFont('helvetica', 'normal').setFontSize(10);
  icds.forEach((icd) => {
    const line = `•  ${icd.desc} (${icd.code})`;
    const wrapped = doc.splitTextToSize(line, R - L - 12);
    const blockH = wrapped.length * 13;
    if (icd.code === icdScope) {
      // Evidence highlight — yellow fill behind the matched line.
      doc.setFillColor(255, 234, 138);
      doc.rect(L - 3, y - 9, R - L + 6, blockH + 2, 'F');
    }
    doc.setTextColor(icd.code === icdScope ? 30 : 51, icd.code === icdScope ? 27 : 65, icd.code === icdScope ? 12 : 85);
    doc.text(wrapped, L + 8, y);
    y += blockH + 3;
  });

  heading('MEDICATIONS');
  ['Metformin (dose per medication list)', 'ACE inhibitor / ARB for nephroprotection', 'Insulin regimen as prescribed', 'Nutritional supplementation per dietary plan']
    .forEach((m) => { doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(51, 65, 85); doc.text(`•  ${m}`, L + 8, y); y += 14; });

  heading('ALLERGIES');
  para('NKDA');
  heading('SOCIAL HISTORY');
  para('Lives at home. Support from family. Non-smoker. Denies alcohol use.');
  heading('REVIEW OF SYSTEMS');
  para('Constitutional: no fever or chills. Otherwise negative except as noted in HPI.');

  y += 12;
  doc.setDrawColor(203, 213, 225).line(L, y, R, y);
  y += 16;
  doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(100, 116, 139);
  doc.text(`Electronically signed · ${provider} · ${dos}`, L, y);

  return doc.output('bloburl').toString();
}
