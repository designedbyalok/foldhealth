import { isValidV28Code } from './v28Whitelist';
import { evaluateOcrTier, evaluateCompliance } from '../compliance';

/**
 * Scripted demo OCR.
 *
 * Real OCR would call a Vision / Textract endpoint to extract encounter
 * sections from the PDF. For the prototype we map a small set of demo
 * filenames to deterministic encounter payloads covering each test case
 * the Jira ticket calls out:
 *
 *   demo-single.pdf, 1 patient, 1 DOS, clean (happy path)
 *   demo-multi-patient.pdf, 2 patients, 1 DOS each (multi-group review)
 *   demo-missing-dos.pdf, 1 patient, DOS field blank (AC-8 mandatory error)
 *   demo-dob-mismatch.pdf, Patient name doesn't 100%-match any Fold record
 *                              (AC-9 HIPAA gate: manual link required)
 *
 * Any other filename falls back to single-patient/single-DOS with the
 * first available HCC member as the matched patient. Includes a 2.5s
 * delay to simulate processing.
 *
 * Each encounter returned has the shape:
 *   {
 *     tempId,
 *     patient: { name, dob, matchedMemberId|null, matchConfidence },
 *     dos, provider, pos, posDesc,
 *     icds: [{ code, valid }],     // invalid codes per V28 marked valid:false
 *     errors: ['dos', ...],         // mandatory fields missing (AC-8)
 *     docType,                      // OCR-derived document category (impl note)
 *   }
 */

const PROCESSING_DELAY_MS = 8000;

const POS_LABEL = {
  '11': 'Office',
  '12': 'Home',
  '22': 'On Campus-Outpatient Hospital',
  '02': 'Telehealth',
};

const mandatoryFields = ['patientName', 'dob', 'dos', 'provider', 'pos'];

function newTempId() {
  return `enc-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Deterministic graded match-confidence so the same demo file always
 * produces the same distribution of green / amber / orange chips. The
 * real backend will compute this from name-distance + DOB-distance +
 * record-key strength; for the prototype we hash (patientName + dob)
 * and bucket into four bands so the user sees variance without
 * random flicker between reloads.
 */
function gradedMatchConfidence(patientName, dob) {
  if (!patientName) return null;
  let h = 0;
  const key = `${patientName}|${dob || ''}`;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffffffff;
  const bucket = Math.abs(h) % 10;
  // Distribution: 60% high (95-100), 25% mid (70-85), 15% low (55-65).
  if (bucket < 6) return 95 + (Math.abs(h) % 6);   // 95-100
  if (bucket < 9) return 70 + (Math.abs(h >> 4) % 16); // 70-85
  return 55 + (Math.abs(h >> 8) % 11);              // 55-65
}

/**
 * Source-page assignment. Real OCR returns the PDF page each encounter
 * was extracted from; the mock walks encounters in order and packs
 * 1-3 per page so the column shows realistic clustering (some pages
 * with one encounter, some with multiple). The first encounter starts
 * at page 1.
 */
function assignSourcePages(encounters) {
  let page = 1;
  let onPage = 0;
  const cap = () => 1 + Math.floor(Math.random() * 3); // 1-3 per page
  let pageCap = cap();
  encounters.forEach((enc) => {
    enc.sourcePage = page;
    onPage += 1;
    if (onPage >= pageCap) {
      page += 1;
      onPage = 0;
      pageCap = cap();
    }
  });
  return encounters;
}

function annotateIcds(codes) {
  return (codes || []).map(c => ({ code: c.trim().toUpperCase(), valid: isValidV28Code(c) }));
}

function annotateErrors(enc) {
  const errors = [];
  if (!enc.patient?.name) errors.push('patientName');
  if (!enc.patient?.dob) errors.push('dob');
  if (!enc.dos) errors.push('dos');
  if (!enc.provider) errors.push('provider');
  if (!enc.pos) errors.push('pos');
  return errors;
}

/**
 * Resolve a patient by exact name match against the supplied hccMembers
 * list. Used by the mock to set matchedMemberId on each encounter.
 * Real backend uses normalized name + DOB at 100% confidence.
 */
function resolveByName(hccMembers, name) {
  const target = (name || '').trim().toLowerCase();
  return hccMembers.find(m => (m.name || '').trim().toLowerCase() === target) || null;
}

/**
 * Patient-ID-aware resolution. Real OCR returns the patient ID printed
 * on the chart note; matching is then:
 *   1. memberId exact match → strongest, highest confidence
 *   2. name + DOB exact match → medium; if the OCR'd ID disagrees with
 *      the resolved member's memberId, the encounter is flagged
 *      `idMismatch: true` so the reviewer can confirm.
 *   3. nothing → null (manual link required)
 *
 * Returns { member, idMismatch }.
 */
function resolveByIdOrName(hccMembers, { patientId, name, dob }) {
  const cleanId = (patientId || '').trim().toUpperCase();
  if (cleanId) {
    const byId = hccMembers.find(m => (m.memberId || '').toUpperCase() === cleanId);
    if (byId) return { member: byId, idMismatch: false };
  }
  // Fallback: name + DOB exact match.
  const target = (name || '').trim().toLowerCase();
  const byName = hccMembers.find(m => (m.name || '').trim().toLowerCase() === target);
  if (byName) {
    // If the OCR'd ID is present but disagrees with the resolved
    // member's real memberId, flag it.
    const idMismatch = !!cleanId && byName.memberId && cleanId !== (byName.memberId || '').toUpperCase();
    return { member: byName, idMismatch };
  }
  return { member: null, idMismatch: false };
}

/**
 * Synthesize an OCR'd patient ID for the encounter. Deterministic per
 * (patientName, dos). For most encounters the result matches the
 * resolved member's memberId exactly so the row reads as "ID matched".
 * A small fraction (~15%) gets a one-character mutation so reviewers
 * see the ID-Mismatch state surface naturally in demos.
 */
function ocrPatientId(member, patientName, dos) {
  if (!member?.memberId) {
    // Unmatched patient: still emit a plausible looking ID so the
    // reviewer can see what was extracted from the document.
    return `M-${hashStr(patientName)}-${hashStr(dos || 'x')}`;
  }
  // Hash decides whether to mutate (~15% of matched encounters).
  const h = Math.abs(hashStr(`${patientName}|${dos}`));
  if (h % 100 < 15) {
    // Mutate the last digit so it no longer matches verbatim.
    return member.memberId.replace(/(\d)$/, (m, d) => String((Number(d) + 1) % 10));
  }
  return member.memberId;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return String(Math.abs(h) % 9999).padStart(4, '0');
}

export async function runMockOcr(file, hccMembers) {
  await new Promise(r => setTimeout(r, PROCESSING_DELAY_MS));
  return assignSourcePages(buildEncountersForFile(file, hccMembers));
}

/**
 * Synchronous variant: same encounter set, no artificial delay. Used by
 * the "Re-open Review" affordance in the History drawer where the user
 * has already seen extraction land once and just wants to revisit the
 * skipped records.
 */
export function extractEncountersSync(file, hccMembers) {
  return assignSourcePages(buildEncountersForFile(file, hccMembers));
}

// Bundle cohort: one entry per document for the "N Documents" demo chips.
// New rule: a document belongs to exactly ONE patient, who may have several
// DOS. Each entry therefore carries 2–3 DOS so every bundled doc demonstrates
// the single-patient / multi-DOS shape. Names/DOBs match real seed members so
// OCR resolution lands on an actual record.
export const BUNDLE_COHORT = [
  ['William Jammy',   '01/15/1965', [
    { dos: '02/14/2026', provider: 'Dr. Sarah Connor', pos: '11', icds: ['E11.22', 'I48.91'], docType: 'Progress Note' },
    { dos: '03/15/2026', provider: 'Dr. Sarah Connor', pos: '11', icds: ['I50.32'],           docType: 'SOAP Note' },
    { dos: '04/22/2026', provider: 'Dr. Helen Yu',     pos: '02', icds: ['N18.4', 'J44.9'],   docType: 'Progress Note' },
  ]],
  ['Grace Hill',      '04/22/1954', [
    { dos: '02/18/2026', provider: 'Dr. Eamon',        pos: '11', icds: ['F33.1', 'N18.4'],   docType: 'Progress Note' },
    { dos: '04/03/2026', provider: 'Dr. Eamon',        pos: '11', icds: ['I50.22'],           docType: 'SOAP Note' },
  ]],
  ['Annette Brave',   '08/12/1958', [
    { dos: '02/20/2026', provider: 'Dr. Mallory Hayes', pos: '11', icds: ['E11.42'],          docType: 'Progress Note' },
    { dos: '03/28/2026', provider: 'Dr. Mallory Hayes', pos: '11', icds: ['E11.9', 'I10'],    docType: 'Progress Note' },
  ]],
  ['Frank Green',     '06/30/1956', [
    { dos: '02/22/2026', provider: 'Dr. Indigo Bolen', pos: '02', icds: ['I50.21', 'E11.9'],  docType: 'Progress Note' },
    { dos: '03/30/2026', provider: 'Dr. Indigo Bolen', pos: '02', icds: ['I50.21'],           docType: 'Progress Note' },
  ]],
  ['Brian Carter',    '11/04/1952', [
    { dos: '02/25/2026', provider: 'Dr. Ulysses Horne', pos: '11', icds: ['J44.0', 'C18.9'],  docType: 'SOAP Note' },
    { dos: '04/12/2026', provider: 'Dr. Ulysses Horne', pos: '11', icds: ['J44.1'],           docType: 'Progress Note' },
  ]],
  ['David Evans',     '03/18/1949', [
    { dos: '02/27/2026', provider: 'Dr. Tatum',        pos: '11', icds: ['I50.33', 'N18.5'],  docType: 'Progress Note' },
    { dos: '03/24/2026', provider: 'Dr. Tatum',        pos: '11', icds: ['F32.2'],            docType: 'Progress Note' },
  ]],
  ['Cynthia Davis',   '09/08/1959', [
    { dos: '03/02/2026', provider: 'Dr. Reed MacLeod', pos: '02', icds: ['I48.0'],            docType: 'Telehealth Note' },
    { dos: '04/06/2026', provider: 'Dr. Reed MacLeod', pos: '02', icds: ['I48.91', 'E78.5'],  docType: 'Progress Note' },
  ]],
  ['Emily Foster',    '12/12/1965', [
    { dos: '03/04/2026', provider: 'Dr. Tatum',        pos: '11', icds: ['C50.911'],          docType: 'Progress Note' },
    { dos: '04/09/2026', provider: 'Dr. Tatum',        pos: '11', icds: ['C50.911', 'Z51.11'], docType: 'Progress Note' },
  ]],
  ['Robert Kim',      '07/19/1953', [
    { dos: '03/05/2026', provider: 'Dr. Susan Park',   pos: '11', icds: ['I70.221', 'E11.40'], docType: 'Progress Note' },
    { dos: '04/14/2026', provider: 'Dr. Susan Park',   pos: '11', icds: ['E11.51'],           docType: 'Progress Note' },
  ]],
  ['Maria Santos',    '02/01/1961', [
    { dos: '03/07/2026', provider: 'Dr. Alan Morse',   pos: '02', icds: ['F33.2'],            docType: 'Telehealth Note' },
    { dos: '04/10/2026', provider: 'Dr. Alan Morse',   pos: '02', icds: ['F33.1'],            docType: 'Progress Note' },
  ]],
  ['James Walker',    '05/03/1947', [
    { dos: '03/08/2026', provider: 'Dr. Calvin Reed',  pos: '11', icds: ['I50.9', 'J44.1'],   docType: 'Progress Note' },
    { dos: '04/18/2026', provider: 'Dr. Calvin Reed',  pos: '11', icds: ['I70.231'],          docType: 'Progress Note' },
  ]],
  ['Jessica Clark',   '10/15/1965', [
    { dos: '03/10/2026', provider: 'Dr. Karen Mills',  pos: '11', icds: ['E10.9'],            docType: 'Progress Note' },
    { dos: '04/20/2026', provider: 'Dr. Karen Mills',  pos: '11', icds: ['E10.65'],           docType: 'SOAP Note' },
  ]],
  ['Richard Scott',   '07/03/1960', [
    { dos: '03/11/2026', provider: 'Dr. Karen Mills',  pos: '11', icds: ['E11.42', 'I50.22'], docType: 'Progress Note' },
    { dos: '04/21/2026', provider: 'Dr. Karen Mills',  pos: '11', icds: ['E11.22'],           docType: 'Progress Note' },
  ]],
  ['Dorothy Nguyen',  '01/22/1948', [
    { dos: '03/12/2026', provider: 'Dr. Eamon',        pos: '11', icds: ['I48.21', 'N18.6'],  docType: 'SOAP Note' },
    { dos: '04/23/2026', provider: 'Dr. Eamon',        pos: '11', icds: ['N18.5'],            docType: 'Progress Note' },
  ]],
  ['Patricia Moore',  '11/30/1962', [
    { dos: '03/13/2026', provider: 'Dr. Karen Mills',  pos: '11', icds: ['F32.1'],            docType: 'Progress Note' },
    { dos: '04/24/2026', provider: 'Dr. Karen Mills',  pos: '11', icds: ['F32.2', 'G47.33'],  docType: 'Progress Note' },
  ]],
  ['Charles Rivera',  '08/25/1951', [
    { dos: '03/14/2026', provider: 'Dr. Helen Yu',     pos: '02', icds: ['I50.32', 'I70.211'], docType: 'Telehealth Note' },
    { dos: '04/25/2026', provider: 'Dr. Helen Yu',     pos: '02', icds: ['I50.33'],           docType: 'Progress Note' },
  ]],
  ['Linda Chen',      '06/06/1959', [
    { dos: '03/17/2026', provider: 'Dr. Calvin Reed',  pos: '11', icds: ['I48.91'],           docType: 'Progress Note' },
    { dos: '04/26/2026', provider: 'Dr. Calvin Reed',  pos: '11', icds: ['I48.0', 'I10'],     docType: 'Progress Note' },
  ]],
  ['Kevin Brown',     '02/28/1967', [
    { dos: '03/18/2026', provider: 'Dr. Indigo Bolen', pos: '11', icds: ['C61'],              docType: 'Progress Note' },
    { dos: '04/27/2026', provider: 'Dr. Indigo Bolen', pos: '11', icds: ['C61', 'Z51.11'],    docType: 'Progress Note' },
  ]],
  ['Helen Park',      '09/02/1956', [
    { dos: '03/19/2026', provider: 'Dr. Susan Park',   pos: '11', icds: ['E11.21'],           docType: 'Progress Note' },
    { dos: '04/28/2026', provider: 'Dr. Susan Park',   pos: '11', icds: ['E11.22', 'N18.3'],  docType: 'Progress Note' },
  ]],
  ['Thomas Reed',     '04/17/1950', [
    { dos: '03/20/2026', provider: 'Dr. Jesse Flynn',  pos: '11', icds: ['I25.10', 'E78.5'],  docType: 'Progress Note' },
    { dos: '04/29/2026', provider: 'Dr. Jesse Flynn',  pos: '11', icds: ['I25.10'],           docType: 'SOAP Note' },
  ]],
  ['Nancy Lewis',     '12/05/1963', [
    { dos: '03/21/2026', provider: 'Dr. Nancy Wu',     pos: '02', icds: ['J44.9', 'J45.909'], docType: 'Telehealth Note' },
    { dos: '04/30/2026', provider: 'Dr. Nancy Wu',     pos: '02', icds: ['J44.1'],            docType: 'Progress Note' },
  ]],
];

function buildEncountersForFile(file, hccMembers) {
  const name = (file?.name || '').toLowerCase();

  const buildEnc = ({ patientName, dob, dos, provider, pos, icds, docType, matchOverride }) => {
    const fallback = matchOverride === null
      ? { member: null, idMismatch: false }
      : matchOverride
        ? { member: matchOverride, idMismatch: false }
        : resolveByIdOrName(hccMembers, { patientId: null, name: patientName, dob });
    const match = fallback.member;
    const patientId = ocrPatientId(match, patientName, dos);
    // Re-run resolution with the synthesized ID so idMismatch reflects
    // the OCR'd ID vs the resolved member's true memberId.
    const resolved = matchOverride === null
      ? { member: null, idMismatch: false }
      : matchOverride
        ? { member: matchOverride, idMismatch: !!match?.memberId && patientId !== match.memberId }
        : resolveByIdOrName(hccMembers, { patientId, name: patientName, dob });
    const finalMember = resolved.member || match;
    const enc = {
      tempId: newTempId(),
      patient: {
        name: patientName,
        dob,
        patientId,
        matchedMemberId: finalMember?.id || null,
        matchedMemberDisplayId: finalMember?.memberId || null,
        idMismatch: resolved.idMismatch || false,
        matchConfidence: finalMember ? gradedMatchConfidence(patientName, dob) : null,
      },
      dos: dos || '',
      provider: provider || '',
      pos: pos || '',
      posDesc: POS_LABEL[pos] || '',
      icds: annotateIcds(icds || []),
      docType: docType || 'Progress Note',
      errors: [],
    };
    enc.errors = annotateErrors(enc);
    return enc;
  };

  // ── Demo: one bundled document = one patient with multiple DOS ────
  // The "N Documents" chips upload files named demo-patient-{i}.pdf; each
  // resolves to a distinct BUNDLE_COHORT patient and their 2–3 DOS.
  const bundleMatch = name.match(/demo-patient-(\d+)/);
  if (bundleMatch) {
    const idx = parseInt(bundleMatch[1], 10) % BUNDLE_COHORT.length;
    const [patientName, dob, encs] = BUNDLE_COHORT[idx];
    const member = hccMembers.find(m => (m.name || '').trim().toLowerCase() === patientName.toLowerCase());
    return encs.map((e) => buildEnc({
      patientName, dob,
      dos: e.dos, provider: e.provider, pos: e.pos, icds: e.icds, docType: e.docType,
      matchOverride: member || null,
    }));
  }

  // ── Demo: single patient · single DOS · clean ─────────────────────
  if (name.includes('demo-single')) {
    const target = hccMembers.find(m => m.name === 'William Jammy') || hccMembers[0];
    return [
      buildEnc({
        patientName: target?.name || 'William Jammy',
        dob: '01/15/1965',
        dos: '02/14/2026',
        provider: 'Dr. Sarah Connor',
        pos: '11',
        icds: ['E11.22', 'I50.32', 'J44.9'],
        docType: 'Progress Note',
        matchOverride: target,
      }),
    ];
  }

  // ── Demo: large multi-patient (20+ patients, several with multi-DOS,
  //   plus 2 missing-field encounters and 1 unmatched patient) ───────
  // Mirrors a realistic batch upload: a clinic sends one PDF covering a
  // day's worth of progress notes across the panel. Demonstrates that
  // the master-detail list scales (filter chips, sticky banners, per-row
  // status chips) and that mixed-quality OCR output (errors + mismatch)
  // is gated correctly by the Confirm button.
  if (name.includes('demo-bulk') || name.includes('demo-bulk-multi-patient')) {
    // Patients in the seed (name → DOB used by mock OCR). Drawn from
    // src/features/hcc/data/mock.js MEMBERS_RAW so resolveByName lands
    // on real members.
    const COHORT = [
      // [name, dob, encounters[]: { dos, provider, pos, icds, docType, errors? }]
      ['William Jammy',       '01/15/1965', [
        { dos: '02/14/2026', provider: 'Dr. Sarah Connor', pos: '11', icds: ['E11.22', 'I48.91'], docType: 'Progress Note' },
        { dos: '03/15/2026', provider: 'Dr. Sarah Connor', pos: '11', icds: ['I50.32'], docType: 'SOAP Note' },
        { dos: '04/22/2026', provider: 'Dr. Helen Yu',     pos: '02', icds: ['N18.4', 'J44.9'], docType: 'Progress Note' },
      ]],
      ['Grace Hill',          '04/22/1954', [
        { dos: '02/18/2026', provider: 'Dr. Eamon',        pos: '11', icds: ['F33.1', 'N18.4'], docType: 'Progress Note' },
        { dos: '04/03/2026', provider: 'Dr. Eamon',        pos: '11', icds: ['I50.22'], docType: 'SOAP Note' },
      ]],
      ['Annette Brave',       '08/12/1958', [
        { dos: '02/20/2026', provider: 'Dr. Mallory Hayes', pos: '11', icds: ['E11.42'], docType: 'Progress Note' },
      ]],
      ['Frank Green',         '06/30/1956', [
        { dos: '02/22/2026', provider: 'Dr. Indigo I',     pos: '02', icds: ['I50.21', 'E11.9'], docType: 'Progress Note' },
        { dos: '03/30/2026', provider: 'Dr. Indigo I',     pos: '02', icds: ['I50.21'], docType: 'Progress Note' },
      ]],
      ['Brian Carter',        '11/04/1952', [
        { dos: '02/25/2026', provider: 'Dr. Ulysses Horne', pos: '11', icds: ['J44.0', 'C18.9'], docType: 'SOAP Note' },
      ]],
      ['David Evans',         '03/18/1949', [
        { dos: '02/27/2026', provider: 'Dr. Tatum',        pos: '11', icds: ['I50.33', 'N18.5'], docType: 'Progress Note' },
        { dos: '03/24/2026', provider: 'Dr. Tatum',        pos: '11', icds: ['F32.2'], docType: 'Progress Note' },
      ]],
      ['Cynthia Davis',       '09/08/1959', [
        { dos: '03/02/2026', provider: 'Dr. Reed MacLeod', pos: '02', icds: ['I48.0'], docType: 'Telehealth Note' },
      ]],
      ['Emily Foster',        '12/12/1965', [
        { dos: '03/04/2026', provider: 'Dr. Tatum',        pos: '11', icds: ['C50.911'], docType: 'Progress Note' },
      ]],
      ['Robert Kim',          '07/19/1953', [
        { dos: '03/05/2026', provider: 'Dr. Susan Park',   pos: '11', icds: ['I70.221', 'E11.40'], docType: 'Progress Note' },
      ]],
      ['Maria Santos',        '02/01/1961', [
        { dos: '03/07/2026', provider: 'Dr. Alan Morse',   pos: '02', icds: ['F33.2'], docType: 'Telehealth Note' },
        { dos: '04/10/2026', provider: 'Dr. Alan Morse',   pos: '02', icds: ['F33.1'], docType: 'Progress Note' },
      ]],
      ['James Walker',        '05/03/1947', [
        { dos: '03/08/2026', provider: 'Dr. Calvin Reed',  pos: '11', icds: ['I50.9', 'J44.1', 'I70.231'], docType: 'Progress Note' },
      ]],
      ['Jessica Clark',       '10/15/1965', [
        { dos: '03/10/2026', provider: 'Dr. Karen Mills',  pos: '11', icds: ['E10.9'], docType: 'Progress Note' },
      ]],
      ['Richard Scott',       '07/03/1960', [
        { dos: '03/11/2026', provider: 'Dr. Karen Mills',  pos: '11', icds: ['E11.42', 'I50.22'], docType: 'Progress Note' },
      ]],
      ['Dorothy Nguyen',      '01/22/1948', [
        { dos: '03/12/2026', provider: 'Dr. Eamon',        pos: '11', icds: ['I48.21', 'N18.6'], docType: 'SOAP Note' },
      ]],
      ['Patricia Moore',      '11/30/1962', [
        { dos: '03/13/2026', provider: 'Dr. Karen Mills',  pos: '11', icds: ['F32.1'], docType: 'Progress Note' },
      ]],
      ['Charles Rivera',      '08/25/1951', [
        { dos: '03/14/2026', provider: 'Dr. Helen Yu',     pos: '02', icds: ['I50.32', 'I70.211'], docType: 'Telehealth Note' },
      ]],
      ['Michelle Jackson',    '04/14/1964', [
        { dos: '03/16/2026', provider: 'Dr. Alan Morse',   pos: '11', icds: ['F33.1'], docType: 'Progress Note' },
      ]],
      ['Linda Chen',          '06/06/1959', [
        { dos: '03/17/2026', provider: 'Dr. Calvin Reed',  pos: '11', icds: ['I48.91'], docType: 'Progress Note' },
      ]],
      ['Kevin Brown',         '02/28/1967', [
        { dos: '03/18/2026', provider: 'Dr. Indigo I',     pos: '11', icds: ['C61'], docType: 'Progress Note' },
      ]],
      ['Helen Park',          '09/02/1956', [
        { dos: '03/19/2026', provider: 'Dr. Susan Park',   pos: '11', icds: ['E11.21'], docType: 'Progress Note' },
      ]],
    ];

    const out = [];
    COHORT.forEach(([patientName, dob, encs]) => {
      const member = hccMembers.find(m => (m.name || '').trim().toLowerCase() === patientName.toLowerCase());
      encs.forEach((e) => out.push(buildEnc({
        patientName,
        dob,
        dos: e.dos,
        provider: e.provider,
        pos: e.pos,
        icds: e.icds,
        docType: e.docType,
        matchOverride: member || null,
      })));
    });

    // Sprinkle in 2 missing-field encounters (different patients) and
    // 1 unmatched patient so the filter chips show real numbers.
    out.push(buildEnc({
      patientName: 'Dorothy Nguyen',
      dob: '01/22/1948',
      dos: '',                            // ← missing
      provider: 'Dr. Eamon',
      pos: '11',
      icds: ['I48.21'],
      docType: 'Progress Note',
      matchOverride: hccMembers.find(m => (m.name || '').toLowerCase() === 'dorothy nguyen'),
    }));
    out.push(buildEnc({
      patientName: 'James Walker',
      dob: '05/03/1947',
      dos: '03/22/2026',
      provider: '',                       // ← missing
      pos: '11',
      icds: ['I50.9'],
      docType: 'Progress Note',
      matchOverride: hccMembers.find(m => (m.name || '').toLowerCase() === 'james walker'),
    }));
    out.push(buildEnc({
      patientName: 'Jane Doe',            // ← won't match any seed
      dob: '01/01/1970',
      dos: '03/25/2026',
      provider: 'Dr. Lin',
      pos: '02',
      icds: ['E11.22'],
      docType: 'Progress Note',
      matchOverride: null,
    }));

    return out;
  }

  // ── Demo: same patient with multiple DOS sections ─────────────────
  // Common real-world case: a single PDF with 3 progress notes for the
  // same patient across different dates. Each encounter becomes a
  // separate worklist row under the same member.
  if (name.includes('demo-same-patient-multi-dos')) {
    const target = hccMembers.find(m => m.name === 'William Jammy') || hccMembers[0];
    return [
      buildEnc({
        patientName: target?.name || 'William Jammy',
        dob: '01/15/1965',
        dos: '02/14/2026',
        provider: 'Dr. Sarah Connor',
        pos: '11',
        icds: ['E11.22', 'I48.91'],
        docType: 'Progress Note',
        matchOverride: target,
      }),
      buildEnc({
        patientName: target?.name || 'William Jammy',
        dob: '01/15/1965',
        dos: '03/15/2026',
        provider: 'Dr. Sarah Connor',
        pos: '11',
        icds: ['I50.32'],
        docType: 'SOAP Note',
        matchOverride: target,
      }),
      buildEnc({
        patientName: target?.name || 'William Jammy',
        dob: '01/15/1965',
        dos: '04/22/2026',
        provider: 'Dr. Helen Yu',
        pos: '02',
        icds: ['N18.4', 'J44.9'],
        docType: 'Progress Note',
        matchOverride: target,
      }),
    ];
  }

  // ── Demo: multi-patient (2 patients, 1 encounter each) ────────────
  if (name.includes('demo-multi-patient')) {
    const p1 = hccMembers.find(m => m.name === 'William Jammy') || hccMembers[0];
    const p2 = hccMembers.find(m => m.name === 'Grace Hill') || hccMembers[1];
    return [
      buildEnc({
        patientName: p1?.name || 'William Jammy',
        dob: '01/15/1965',
        dos: '03/01/2026',
        provider: 'Dr. Sarah Connor',
        pos: '11',
        icds: ['E11.22', 'I48.91'],
        docType: 'SOAP Note',
        matchOverride: p1,
      }),
      buildEnc({
        patientName: p2?.name || 'Grace Hill',
        dob: '04/22/1954',
        dos: '03/01/2026',
        provider: 'Dr. Eamon',
        pos: '11',
        icds: ['F33.1', 'N18.4'],
        docType: 'Progress Note',
        matchOverride: p2,
      }),
    ];
  }

  // ── Demo: missing DOS field (AC-8 mandatory error) ────────────────
  if (name.includes('demo-missing-dos')) {
    const target = hccMembers.find(m => m.name === 'Richard Scott') || hccMembers[0];
    return [
      buildEnc({
        patientName: target?.name || 'Richard Scott',
        dob: '07/03/1960',
        dos: '',           // ← missing
        provider: 'Dr. Karen Mills',
        pos: '11',
        icds: ['E11.42', 'I50.22'],
        docType: 'Progress Note',
        matchOverride: target,
      }),
    ];
  }

  // ── Demo: DOB mismatch (AC-9 HIPAA gate: manual link required) ───
  if (name.includes('demo-dob-mismatch')) {
    return [
      buildEnc({
        patientName: 'Unknown Patient',     // doesn't match any Fold record
        dob: '12/25/1980',
        dos: '03/05/2026',
        provider: 'Dr. Helen Yu',
        pos: '02',
        icds: ['E11.9', 'J44.1'],
        docType: 'Progress Note',
        matchOverride: null,                // explicit null, no auto-match
      }),
    ];
  }

  // ── Single-patient demo docs: each maps to a DISTINCT member so
  //   uploading several samples produces several unique patients to
  //   page through in review (one patient per document). ──────────────
  const SINGLE_PATIENT_DEMOS = {
    'demo-grace-hill': {
      name: 'Grace Hill', dob: '04/22/1954',
      encs: [
        { dos: '02/18/2026', provider: 'Dr. Eamon', pos: '11', icds: ['F33.1', 'N18.4'], docType: 'Progress Note' },
        { dos: '04/03/2026', provider: 'Dr. Eamon', pos: '11', icds: ['I50.22'], docType: 'SOAP Note' },
      ],
    },
    'demo-frank-green': {
      name: 'Frank Green', dob: '06/30/1956',
      encs: [{ dos: '02/22/2026', provider: 'Dr. Indigo I', pos: '02', icds: ['I50.21', 'E11.9'], docType: 'Telehealth Note' }],
    },
    'demo-brian-carter': {
      name: 'Brian Carter', dob: '11/04/1952',
      encs: [{ dos: '02/25/2026', provider: 'Dr. Ulysses Horne', pos: '11', icds: ['J44.0', 'C18.9'], docType: 'SOAP Note' }],
    },
    'demo-degraded-david-evans': {
      name: 'David Evans', dob: '03/18/1949',
      encs: [{ dos: '02/27/2026', provider: 'Dr. Tatum', pos: '11', icds: ['I50.33', 'N18.5'], docType: 'Progress Note' }],
    },
  };
  const singleKey = Object.keys(SINGLE_PATIENT_DEMOS).find(k => name.includes(k));
  if (singleKey) {
    const demo = SINGLE_PATIENT_DEMOS[singleKey];
    const member = hccMembers.find(m => (m.name || '').toLowerCase() === demo.name.toLowerCase());
    return demo.encs.map(e => buildEnc({
      patientName: demo.name, dob: demo.dob,
      dos: e.dos, provider: e.provider, pos: e.pos, icds: e.icds, docType: e.docType,
      matchOverride: member || null,
    }));
  }

  // ── Fallback: pick the first member, 1 encounter ──────────────────
  const fallback = hccMembers[0];
  return [
    buildEnc({
      patientName: fallback?.name || 'Demo Patient',
      dob: '01/01/1960',
      dos: '03/15/2026',
      provider: 'Dr. Demo',
      pos: '11',
      icds: ['E11.22'],
      docType: 'Progress Note',
      matchOverride: fallback,
    }),
  ];
}

export { mandatoryFields, POS_LABEL };

/**
 * Document pipeline (the canonical entry point going forward).
 *
 * Runs OCR + evaluates document-level OCR tier + 5-point compliance in a
 * single pass, per the Astrana spec. Returns:
 *
 *   {
 *     documentId,                              // stable id for the doc instance
 *     fileName,
 *     ocrTier:    'clean' | 'degraded' | 'unreadable',
 *     compliance: { progressNote, dosCharted, providerNamePrinted,
 *                   posAvailable, legible },   // see compliance.js
 *     encounters: [...]                        // [] when ocrTier === 'unreadable'
 *   }
 *
 * Each encounter is stamped with `documentId` so the UI can group encounters
 * back to their source document (the compliance state is one entity per doc,
 * not per encounter: a single PDF can carry multiple records).
 */
export async function runDocumentPipeline(file, hccMembers) {
  const encounters = await runMockOcr(file, hccMembers);
  return buildDocumentResult(file, encounters);
}

/**
 * Synchronous variant: same shape as runDocumentPipeline, no artificial
 * delay. Used by the "Re-open Review" affordance in the History drawer.
 */
export function buildDocumentSync(file, hccMembers) {
  const encounters = extractEncountersSync(file, hccMembers);
  return buildDocumentResult(file, encounters);
}

function buildDocumentResult(file, rawEncounters) {
  const documentId = `doc-${Math.random().toString(36).slice(2, 10)}`;
  const fileName = file?.name || 'unknown';
  const ocrTier = evaluateOcrTier(fileName);
  const sample = rawEncounters[0] || null;
  const compliance = evaluateCompliance(ocrTier, sample);

  // Unreadable docs short-circuit: no records released downstream. The
  // doc still appears in the queue (Support needs to see it and re-request).
  const encounters = ocrTier === 'unreadable' ? [] : rawEncounters;
  encounters.forEach((e) => { e.documentId = documentId; });

  return { documentId, fileName, ocrTier, compliance, encounters };
}
