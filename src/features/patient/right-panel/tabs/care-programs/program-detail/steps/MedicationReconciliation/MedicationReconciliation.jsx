import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from '../../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../../components/Input/Input';
import { Select } from '../../../../../../../../components/Select/Select';
import { DatePicker } from '../../../../../../../../components/DatePicker/DatePicker';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { AIIcon } from '../../../../../../../../components/Icon/AIIcon';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { RingEmptyState } from '../../../../../../../../components/RingEmptyState/RingEmptyState';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { SearchBar } from '../../../../../../../../components/SearchBar/SearchBar';
import { DocumentUploader, FileRow } from '../../../../../../../../components/DocumentUploader/DocumentUploader';
import { CloseButton } from '../../../../../../../../components/CloseButton/CloseButton';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Toggle } from '../../../../../../../../components/Toggle/Toggle';
import { TableIcon } from '../../../../../../../../components/Icon/TableIcon';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { searchMedications } from '../../../../../../../../lib/openfda';
import { MED_RECON_MOCK } from '../../../../../../data/medReconMock';
import styles from './MedicationReconciliation.module.css';

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Stopped', label: 'Stopped' },
  { value: 'On Hold', label: 'On Hold' },
];

const STOP_REASON_OPTIONS = [
  { value: 'Adverse Reaction', label: 'Adverse Reaction' },
  { value: 'Ineffective', label: 'Ineffective' },
  { value: 'Patient Request', label: 'Patient Request' },
  { value: 'Prescriber Discontinued', label: 'Prescriber Discontinued' },
  { value: 'Other', label: 'Other' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

// DatePicker needs ISO (native <input type="date">); the table/store use
// MM/DD/YYYY strings — convert only at save time.
function isoToMMDDYYYY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return m && d && y ? `${m}/${d}/${y}` : iso;
}

function mmddyyyyToISO(str) {
  if (!str) return '';
  const [m, d, y] = str.split('/');
  return m && d && y ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
}

// Empty template for the inline form once a med is picked from OpenFDA.
const blankDraft = () => ({
  name: '', status: 'Active', start: todayISO(), stopDate: '', stopReason: '',
  sig: '', note: '', noteOpen: false, openfdaMeta: null, source: 'manual',
});

// "Add New" dropdown — only "Add Manually" is wired (opens the existing
// search → form container); the other two are placeholders for future flows.
const ADD_NEW_MENU_ITEMS = [
  { key: 'manual', icon: 'solar:pen-2-linear', label: 'Add Manually' },
  { key: 'discharge', icon: 'solar:upload-minimalistic-linear', label: 'Upload Discharge Summary' },
  { key: 'surescript', icon: 'solar:refresh-circle-linear', label: 'Sync Surescript' },
];

// Active Medications view toggle — mirrors the list/grid Toggle used on
// Program Related Files.
const MED_VIEW_ITEMS = [
  // Passed as an element, not a `custom:table` name, so the glyph inherits the
  // Toggle's active/hover text color instead of TableIcon's neutral default.
  { key: 'table', icon: <TableIcon size={14} color="currentColor" /> },
  { key: 'card', icon: 'solar:list-linear' },
];

// Matches a numbered line like "1. Metformin 1000mg - 1 tab daily on empty
// stomach" — the format our own sample discharge PDFs use.
const NUMBERED_MED_LINE_RE = /^\d+\.\s*(.+?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|g))\b\s*-\s*(.+)$/i;
// Looser fallback for real-world summaries: a drug-dose token anywhere in the
// line (e.g. "Lisinopril 10 MG Tablet — take 1 tablet by mouth daily").
const DOSE_TOKEN_RE = /\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|unit|units|iu)\b/i;

function parseMedLine(line) {
  const numbered = line.match(NUMBERED_MED_LINE_RE);
  if (numbered) return { name: `${numbered[1].trim()} ${numbered[2].trim()}`, sig: numbered[3].trim() };

  const dose = line.match(DOSE_TOKEN_RE);
  if (!dose) return null;
  const cut = dose.index + dose[0].length;
  const name = line.slice(0, cut).trim();
  const sig = line.slice(cut).replace(/^[\s\-–—:,]+/, '').trim();
  // Require the name half to actually look like a drug name, not a stray number/date.
  if (!/[A-Za-z]{3,}/.test(name)) return null;
  return { name, sig };
}

function parseMedsFromLines(lines) {
  const today = isoToMMDDYYYY(todayISO());
  const meds = [];
  lines.forEach((line, i) => {
    const parsed = parseMedLine(line.trim());
    if (parsed) meds.push({ id: `ex-parsed-${i}`, name: parsed.name, start: today, stop: '', sig: parsed.sig });
  });
  return meds;
}

// Fast path: works when the PDF has a real (uncompressed) text layer — true
// for the sample discharge PDFs generated for this feature, not for most
// real-world exports/scans (see ocrPdf below for those).
async function parseMedsFromPdfText(file) {
  const text = await file.text();
  const lines = [...text.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)].map(m => m[1]);
  return parseMedsFromLines(lines);
}

// Renders each PDF page to a canvas via pdf.js — needed for scanned/
// image-only discharge summaries, which have no text layer at all.
async function renderPdfPagesToCanvases(file) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const canvases = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    // eslint-disable-next-line no-await-in-loop
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

// OCRs a scanned PDF page-by-page with Tesseract.js. Slow (real recognition,
// not a mock) — callers should show progress via `onProgress`.
async function ocrPdf(file, onProgress) {
  // Loading tesseract.js and rasterising the PDF are independent, and both are
  // slow — the import is a network/parse cost, the rasterisation walks every
  // page. Run them concurrently; createWorker still has to wait for the import.
  const [{ createWorker }, canvases] = await Promise.all([
    import('tesseract.js'),
    renderPdfPagesToCanvases(file),
  ]);
  const worker = await createWorker('eng');
  try {
    let text = '';
    for (let i = 0; i < canvases.length; i++) {
      onProgress?.(`Reading page ${i + 1} of ${canvases.length}…`);
      // eslint-disable-next-line no-await-in-loop
      const { data } = await worker.recognize(canvases[i]);
      text += `\n${data.text}`;
    }
    return text;
  } finally {
    await worker.terminate();
  }
}

// OpenFDA matching — disabled for now, kept for reference.
// Splits a parsed name like "acetaminophen (TYLENOL) 500 mg" into its
// generic/brand/strength parts so OpenFDA lookup can search the more
// specific brand name (when present) and score candidates by matching
// strength, instead of a single leading word blindly.
// function splitDrugName(name) {
//   const m = name.match(/^([A-Za-z][A-Za-z\s-]*?)\s*(?:\(([^)]+)\))?\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|unit|units|iu)?/i);
//   if (!m) return { generic: name.match(/^[A-Za-z][A-Za-z-]*/)?.[0] || '', brand: '', strength: null };
//   return {
//     generic: (m[1] || '').trim(),
//     brand: (m[2] || '').trim(),
//     strength: m[3] ? parseFloat(m[3]) : null,
//   };
// }
//
// Scores an OpenFDA candidate against the parsed generic/brand/strength.
// The NDC directory returns many packager/combo variants per drug — a bare
// generic-prefix match is weak evidence on its own, since combo products
// (e.g. "acetaminophen and diphenhydramine…") also start with the target
// generic name. Exact-name matches, matching strength, and single-ingredient
// products (the common case for a discharge-summary line) are weighted
// much more heavily than a loose prefix match.
//
// `strengthMatched` is tracked separately from the score: when the
// extracted line has a dose and no candidate at that dose exists (a real
// gap — e.g. the directory only carries Tricor at 145mg, not the patient's
// 54mg), the caller must NOT accept a same-name-wrong-dose candidate just
// because it scored well on name alone — that would silently show the
// wrong strength, which is worse than leaving the OCR text untouched.
// function scoreCandidate(x, { generic, brand, strength }) {
//   let score = 0;
//   let strengthMatched = strength == null;
//   const xGeneric = (x.genericName || '').toLowerCase();
//   const xBrand = (x.brandName || '').toLowerCase();
//   const lowerBrand = brand.toLowerCase();
//   const lowerGeneric = generic.toLowerCase();
//
//   if (lowerBrand && xBrand === lowerBrand) score += 4;
//   else if (lowerBrand && xBrand.startsWith(lowerBrand)) score += 2;
//
//   if (lowerGeneric && xGeneric === lowerGeneric) score += 4;
//   else if (lowerGeneric && xGeneric.startsWith(lowerGeneric)) score += 1;
//
//   if (strength != null) {
//     const xStrength = parseFloat(x.strength);
//     if (!Number.isNaN(xStrength) && Math.abs(xStrength - strength) < 0.01) {
//       score += 3;
//       strengthMatched = true;
//     }
//   }
//
//   const ingredientCount = x.raw?.active_ingredients?.length || 1;
//   if (ingredientCount > 1) score -= 3;
//
//   return { score, strengthMatched };
// }
//
// Minimum score to accept a match at all — at least one exact name signal
// (brand or generic), so a lone weak generic-prefix hit can't win by default.
// const MIN_MATCH_SCORE = 4;
//
// Matches each extracted med against OpenFDA's NDC directory so the DC
// updates list shows the canonical generic (brand) name OpenFDA carries,
// same as the manual-add search does, instead of whatever the OCR/text
// scrape produced verbatim. Searches by brand name first (more specific),
// falling back to generic, and picks the best-scored candidate rather than
// the first result — the NDC directory returns many packager/strength
// variants per drug, and an unscored pick regularly landed on the wrong
// strength. Leaves the as-extracted med untouched when the score is too
// low, or when the line names a specific dose that no candidate matches.
// async function matchMedsWithOpenFDA(meds) {
//   return Promise.all(meds.map(async (m) => {
//     const parts = splitDrugName(m.name);
//     const terms = [parts.brand, parts.generic].filter(Boolean);
//     if (terms.length === 0) return m;
//     try {
//       let best = null;
//       for (const term of terms) {
//         const candidates = await searchMedications(term, { limit: 20 });
//         for (const x of candidates) {
//           const { score, strengthMatched } = scoreCandidate(x, parts);
//           if (!best || score > best.score) best = { x, score, strengthMatched };
//         }
//         // A strong, dose-confirmed hit is good enough — no need to also
//         // burn a generic-name request.
//         if (best?.score >= 7 && best.strengthMatched) break;
//       }
//       if (!best || best.score < MIN_MATCH_SCORE || !best.strengthMatched) return m;
//       return { ...m, name: best.x.displayName, dosageForm: best.x.dosageForm, route: best.x.route, openfdaMeta: best.x.raw };
//     } catch {
//       return m;
//     }
//   }));
// }

async function extractMedsFromFile(file, onProgress) {
  const parsed = await parseMedsFromPdfText(file).catch(() => []);
  let meds = parsed;
  if (meds.length === 0) {
    const text = await ocrPdf(file, onProgress).catch(() => '');
    meds = parseMedsFromLines(text.split(/\r?\n/));
  }

  // OpenFDA matching is disabled for now — return the extracted meds as-is.
  // return meds.length === 0 ? meds : matchMedsWithOpenFDA(meds);
  return meds;
}

// Per-row overflow menu holding Edit + Delete. Each row needs its own
// trigger ref and open state, so this can't be hoisted into the parent.
const MED_ROW_MENU_ITEMS = [
  { key: 'edit', icon: 'solar:pen-2-linear', label: 'Edit' },
  { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true },
];

function MedRowMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={styles.extractedIconBtn}
        onClick={() => setOpen(v => !v)}
        aria-label="More actions"
        title="More actions"
      >
        <Icon name="solar:menu-dots-linear" size={16} color="var(--neutral-300)" />
      </button>
      {open && (
        <MenuPopover
          anchorRef={btnRef}
          items={MED_ROW_MENU_ITEMS}
          onSelect={(key) => {
            if (key === 'edit') onEdit();
            else onDelete();
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          width={160}
          ariaLabel="Medication actions"
        />
      )}
    </>
  );
}

export function MedicationReconciliation() {
  const patientId          = useAppStore(s => s.selectedPatientId);
  const storedMeds         = useAppStore(s => (patientId ? s.patientMedications[patientId] : null));
  const fetchPatientMedications = useAppStore(s => s.fetchPatientMedications);
  const addPatientMedication    = useAppStore(s => s.addPatientMedication);
  const updatePatientMedication = useAppStore(s => s.updatePatientMedication);
  const deletePatientMedication = useAppStore(s => s.deletePatientMedication);
  const showToast = useAppStore(s => s.showToast);

  useEffect(() => {
    if (patientId) fetchPatientMedications(patientId);
  }, [patientId, fetchPatientMedications]);

  const medications = storedMeds || [];

  // Checklist stays local — it's not persisted yet. Items come from the
  // mock (labels only); every box starts unchecked regardless of the mock's
  // `checked` field.
  const [checks, setChecks] = useState({});

  // Which Active Medications rows have their "View Note" expanded — keyed
  // by medication id, matches Figma 2556:46848.
  const [noteExpanded, setNoteExpanded] = useState({});

  // table (grid/columns) vs card (Figma 7211:452572) view of Active Medications.
  const [medView, setMedView] = useState('table');

  // Add-New container state. Three phases:
  //   closed  — the "Add New" button is idle, nothing rendered below the header.
  //   search  — the container shows a search input; the user is typing or picking.
  //   form    — a med was picked; the container shows the inline row with
  //             editable Name/Start/Stop/Sig + Save/Discard.
  const [phase, setPhase] = useState('closed');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [draft, setDraft] = useState(blankDraft);
  const [saving, setSaving] = useState(false);
  const [dischargeUploadOpen, setDischargeUploadOpen] = useState(false);
  const [extractedMeds, setExtractedMeds] = useState(null);
  const [extractedExpanded, setExtractedExpanded] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractStage, setExtractStage] = useState('');
  const [editingExtractedId, setEditingExtractedId] = useState(null);
  // Id of a saved medication being edited inline; its row is replaced by the
  // shared form card and the surrounding rows blur out behind it.
  const [editingMedId, setEditingMedId] = useState(null);
  const searchRowRef = useRef(null);
  const abortRef = useRef(null);

  // Debounced OpenFDA search. Cancels the previous in-flight fetch before
  // firing a new one — typeahead should never race stale responses onto the
  // list. Minimum 2 chars because 1-letter wildcards are noise.
  useEffect(() => {
    if (phase !== 'search') return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError('');
      return;
    }
    setSearching(true);
    setSearchError('');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      try {
        const rows = await searchMedications(q, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResults(rows);
          setSearching(false);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          setSearchError('Could not reach OpenFDA. Try again.');
          setSearching(false);
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [phase, query]);

  const openContainer = () => {
    setPhase('search');
    setQuery('');
    setResults([]);
    setDraft(blankDraft());
    setEditingExtractedId(null);
  };

  const discard = () => {
    setPhase('closed');
    setQuery('');
    setResults([]);
    setDraft(blankDraft());
    setEditingExtractedId(null);
    setEditingMedId(null);
    abortRef.current?.abort();
  };

  const pickMed = (med) => {
    setDraft({
      name: med.displayName,
      status: 'Active',
      start: todayISO(),
      stopDate: '',
      stopReason: '',
      sig: '',
      note: '',
      noteOpen: false,
      openfdaMeta: med.raw,
      source: 'openfda',
    });
    setPhase('form');
  };

  const editExtracted = (m) => {
    setDraft({
      name: m.name,
      status: 'Active',
      start: mmddyyyyToISO(m.start) || todayISO(),
      stopDate: mmddyyyyToISO(m.stop),
      stopReason: '',
      sig: m.sig,
      note: '',
      noteOpen: false,
      openfdaMeta: m.openfdaMeta || null,
      source: m.openfdaMeta ? 'openfda' : 'discharge_import',
    });
    setEditingExtractedId(m.id);
    setPhase('form');
    setDischargeUploadOpen(false);
  };

  const openNote = () => setDraft(d => ({ ...d, noteOpen: true }));
  const closeNote = () => setDraft(d => ({ ...d, noteOpen: false, note: '' }));

  const isStopped = draft.status === 'Stopped';
  const canSave = !!draft.status && !!draft.start && draft.sig.trim().length > 0
    && (!isStopped || (!!draft.stopDate && !!draft.stopReason))
    && !saving;

  const saveDraft = async () => {
    if (!canSave) return;

    // Editing a not-yet-added discharge extraction — update that row in
    // place and re-close the form. It stays in the extracted list until the
    // user explicitly clicks "Add to List"; it must NOT land in Active
    // Medications just because it was edited.
    if (editingExtractedId) {
      const id = editingExtractedId;
      setExtractedMeds(prev => (prev || []).map(m => (m.id === id ? {
        ...m,
        name: draft.name.trim(),
        start: isoToMMDDYYYY(draft.start),
        stop: isStopped ? isoToMMDDYYYY(draft.stopDate) : '',
        sig: draft.sig.trim(),
        status: draft.status,
        note: draft.note.trim(),
        stopReason: isStopped ? draft.stopReason : '',
        openfdaMeta: draft.openfdaMeta,
      } : m)));
      discard();
      return;
    }

    // Editing a medication that's already persisted — update it in place
    // rather than inserting a duplicate row.
    if (editingMedId) {
      if (!patientId) return;
      setSaving(true);
      try {
        await updatePatientMedication(patientId, editingMedId, {
          name: draft.name.trim(),
          start: isoToMMDDYYYY(draft.start),
          stop: isStopped ? isoToMMDDYYYY(draft.stopDate) : '',
          stopReason: isStopped ? draft.stopReason : '',
          sig: draft.sig.trim(),
          status: draft.status,
          note: draft.note.trim(),
        });
      } finally {
        setSaving(false);
      }
      discard();
      return;
    }

    if (!patientId) return;
    setSaving(true);
    let id;
    try {
      id = await addPatientMedication(patientId, {
        name: draft.name.trim(),
        start: isoToMMDDYYYY(draft.start),
        stop: isStopped ? isoToMMDDYYYY(draft.stopDate) : '',
        stopReason: isStopped ? draft.stopReason : '',
        sig: draft.sig.trim(),
        status: draft.status,
        note: draft.note.trim(),
        source: draft.source,
        openfdaMeta: draft.openfdaMeta,
      });
    } finally {
      setSaving(false);
    }
    if (id) discard();
  };

  const extractMeds = async (file) => {
    setExtracting(true);
    setExtractStage('Reading document…');
    try {
      const result = await extractMedsFromFile(file, setExtractStage);
      if (result.length === 0) {
        showToast("Couldn't find any medications in this document.");
      } else {
        setExtractedMeds(result);
        setExtractedExpanded(true);
        setDischargeUploadOpen(false);
      }
    } catch {
      showToast('Extraction failed — try a different file.');
    } finally {
      setExtracting(false);
      setExtractStage('');
    }
  };

  // Dismissing an extracted row slides it out to the right first; the row is
  // only dropped from state once the animation ends (see removeExtracted).
  // Reduced-motion users skip straight to the removal.
  const [exitingExtractedIds, setExitingExtractedIds] = useState(new Set());

  const removeExtracted = (id) => {
    setExtractedMeds(prev => {
      const next = (prev || []).filter(m => m.id !== id);
      return next.length ? next : null;
    });
    setExitingExtractedIds(prev => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const dismissExtracted = (id) => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { removeExtracted(id); return; }
    setExitingExtractedIds(prev => new Set(prev).add(id));
  };

  const addExtracted = async (m) => {
    if (!patientId) return;
    const id = await addPatientMedication(patientId, {
      name: m.name,
      start: m.start,
      stop: m.stop,
      sig: m.sig,
      status: m.status || 'Active',
      note: m.note || '',
      stopReason: m.stopReason || '',
      source: m.openfdaMeta ? 'openfda' : 'discharge_import',
      openfdaMeta: m.openfdaMeta || null,
    });
    if (id) dismissExtracted(m.id);
  };

  // Stop/Continue toggle — commented out for now, kept for reference.
  // "Stop" set the medication Stopped as of today; "Continue" had no backing
  // field yet, so it only marked the pill green locally (continuedIds), and
  // clicking Stop cleared that so both never looked selected.
  // const [continuedIds, setContinuedIds] = useState(new Set());
  //
  // const stopMedication = (m) => {
  //   if (!patientId) return;
  //   setContinuedIds(prev => {
  //     if (!prev.has(m.id)) return prev;
  //     const next = new Set(prev);
  //     next.delete(m.id);
  //     return next;
  //   });
  //   updatePatientMedication(patientId, m.id, { status: 'Stopped', stop: isoToMMDDYYYY(todayISO()) });
  // };
  //
  // const continueMedication = (m) => {
  //   setContinuedIds(prev => new Set(prev).add(m.id));
  // };

  // Inline note editor — the Note action expands the med's own row into a
  // grey strip holding a labelled Textarea (Figma 2529:16692). Edits live in
  // `noteDrafts` while typing and persist to Supabase on blur, so we're not
  // firing a write per keystroke.
  const [openNoteIds, setOpenNoteIds] = useState(new Set());
  const [noteDrafts, setNoteDrafts] = useState({});

  const toggleNote = (m) => {
    // Both updaters are called from the event, not nested. A state updater must
    // be pure: React can invoke it more than once for a single update (Strict
    // Mode does this deliberately), which would have run the seeding twice.
    // Seeding is idempotent either way, but the nesting also meant the draft was
    // set while React was mid-way through computing another piece of state.
    const isOpen = openNoteIds.has(m.id);
    setOpenNoteIds(prev => {
      const next = new Set(prev);
      if (next.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
    if (!isOpen) {
      setNoteDrafts(d => (m.id in d ? d : { ...d, [m.id]: m.note || '' }));
    }
  };

  const commitNote = (m) => {
    if (!patientId) return;
    const draft = noteDrafts[m.id] ?? '';
    if (draft === (m.note || '')) return;
    updatePatientMedication(patientId, m.id, { note: draft });
  };

  // The Note action badges the number of notes on the med. There's a single
  // `note` field today, so that's 1 or nothing — `count` is left undefined
  // when empty so ActionButton skips the badge entirely.
  const noteCount = (m) => (m.note?.trim() ? 1 : undefined);

  const renderNoteEditor = (m) => (
    <div className={styles.noteEditor}>
      <span className={styles.noteEditorLabel}>Note</span>
      <Textarea
        value={noteDrafts[m.id] ?? ''}
        onChange={e => setNoteDrafts(d => ({ ...d, [m.id]: e.target.value }))}
        onBlur={() => commitNote(m)}
        placeholder="Add a note"
        rows={2}
      />
    </div>
  );

  // Inline single-cell editing in the table — clicking Start/Stop Date, Sig
  // or Status swaps just that cell for its matching control. Dates and
  // Status commit on change (the control closes itself); Sig commits on
  // blur or Enter, and Escape abandons the edit.
  const [editingCell, setEditingCell] = useState(null); // { id, field }
  const [cellDraft, setCellDraft] = useState('');

  const isEditingCell = (m, field) => editingCell?.id === m.id && editingCell?.field === field;

  const beginCellEdit = (m, field) => {
    // A full-row edit owns the whole row — don't let a cell edit race it.
    if (editingMedId) return;
    setEditingCell({ id: m.id, field });
    setCellDraft(
      field === 'start' ? mmddyyyyToISO(m.start)
        : field === 'stop' ? mmddyyyyToISO(m.stop)
          : field === 'sig' ? (m.sig || '')
            : (m.status || 'Active')
    );
  };

  const cancelCellEdit = () => { setEditingCell(null); setCellDraft(''); };

  const cellEditRef = useRef(null);


  const commitCell = (m, field, rawValue) => {
    const value = rawValue !== undefined ? rawValue : cellDraft;
    const patch =
      field === 'start' ? { start: value ? isoToMMDDYYYY(value) : '' }
        : field === 'stop' ? { stop: value ? isoToMMDDYYYY(value) : '' }
          : field === 'sig' ? { sig: value.trim() }
            : { status: value };
    const [key] = Object.keys(patch);
    if (patientId && (m[key] || '') !== (patch[key] || '')) {
      updatePatientMedication(patientId, m.id, patch);
    }
    cancelCellEdit();
  };

  // Clicking anywhere outside the open editor closes it, committing whatever
  // is in the draft (a no-op when nothing changed). No dep array on purpose:
  // the handler reads cellDraft/editingCell, and re-binding each render is
  // cheaper than reasoning about stale closures.
  useEffect(() => {
    if (!editingCell) return undefined;
    const med = medications.find(x => x.id === editingCell.id);
    if (!med) return undefined;
    const onPointerDown = (e) => {
      if (cellEditRef.current?.contains(e.target)) return;
      // Status portals its menu to document.body, so clicking an option is
      // technically outside the cell — don't treat that as clicking away.
      if (e.target.closest?.('[role="listbox"]')) return;
      commitCell(med, editingCell.field);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  });

  // Read-only cell content doubles as the edit trigger. Rendered as a real
  // button so it stays keyboard-reachable rather than a click-only span.
  const cellTrigger = (m, field, text) => (
    <button
      type="button"
      className={styles.cellEditTrigger}
      onClick={() => beginCellEdit(m, field)}
    >
      {text}
    </button>
  );

  // Bulk selection — mirrors the Letters step: a Set of ids drives the row
  // checkboxes and a floating action bar (Figma 2570:46879).
  const [selectedMedIds, setSelectedMedIds] = useState(new Set());
  const allMedsSelected = selectedMedIds.size === medications.length && medications.length > 0;
  const someMedsSelected = selectedMedIds.size > 0 && !allMedsSelected;
  const toggleMed = (id) =>
    setSelectedMedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAllMeds = () =>
    setSelectedMedIds(prev => (prev.size === medications.length ? new Set() : new Set(medications.map(m => m.id))));
  const clearMedSelection = () => setSelectedMedIds(new Set());

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Deleting a medication slides its row out before the row leaves state.
  // The store's delete is optimistic — calling it up front would unmount the
  // row mid-animation — so the row is marked exiting first and the actual
  // delete fires from onAnimationEnd. `pendingDeletes` holds the ids still
  // animating plus the callback that reports the result once they land.
  const [exitingMedIds, setExitingMedIds] = useState(new Set());
  const pendingDeletes = useRef({ remaining: new Set(), onDone: null, failures: 0 });

  const beginMedExit = (ids, onDone) => {
    if (ids.length === 0) return;
    pendingDeletes.current = { remaining: new Set(ids), onDone, failures: 0 };
    // Reduced motion skips the slide — animationend never fires when
    // animations are off, so the rows would otherwise linger forever.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      ids.forEach(id => finishMedExit(id));
      return;
    }
    setExitingMedIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
  };

  const finishMedExit = async (id) => {
    const ok = await deletePatientMedication(patientId, id);
    setExitingMedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    const p = pendingDeletes.current;
    if (!p.remaining.has(id)) return;
    p.remaining.delete(id);
    if (!ok) p.failures += 1;
    // Only report once the whole batch has settled, and only if at least one
    // actually deleted — the store surfaces its own error toast per failure.
    if (p.remaining.size === 0 && p.failures === 0) p.onDone?.();
  };

  const stopSelectedMeds = async () => {
    if (!patientId) return;
    const ids = [...selectedMedIds];
    const today = isoToMMDDYYYY(todayISO());
    setBulkBusy(true);
    try {
      await Promise.all(ids.map(id => updatePatientMedication(patientId, id, { status: 'Stopped', stop: today })));
      showToast(`${ids.length} medication${ids.length === 1 ? '' : 's'} stopped`);
      clearMedSelection();
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmBulkDelete = () => {
    if (!patientId) return;
    const ids = [...selectedMedIds];
    setBulkDeleteOpen(false);
    clearMedSelection();
    beginMedExit(ids, () => {
      showToast(`${ids.length} medication${ids.length === 1 ? '' : 's'} deleted`);
    });
  };

  // Delete confirmation — Figma 2564:46849. Holds the medication pending
  // deletion; null means the dialog is closed.
  const [deleteTarget, setDeleteTarget] = useState(null);

  const confirmDeleteMedication = () => {
    if (!patientId || !deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleteTarget(null);
    beginMedExit([id], () => showToast(`"${name}" deleted`));
  };

  // Opens the shared form card in place of a saved medication's row,
  // pre-filled from that medication (Figma 2094:37808).
  const editMedication = (m) => {
    setDraft({
      name: m.name,
      status: m.status || 'Active',
      start: mmddyyyyToISO(m.start) || todayISO(),
      stopDate: mmddyyyyToISO(m.stop),
      stopReason: m.stopReason || '',
      sig: m.sig || '',
      note: m.note || '',
      noteOpen: !!m.note,
      openfdaMeta: m.openfdaMeta || null,
      source: m.source || 'manual',
    });
    setEditingExtractedId(null);
    setEditingMedId(m.id);
    setPhase('form');
    setDischargeUploadOpen(false);
  };

  // Shared by the top "Add New" container (a fresh manual add), the inline
  // edit of a discharge-extracted row, and the inline edit of a saved
  // medication — same draft/handlers, just rendered in a different spot
  // depending on `editingExtractedId` / `editingMedId`.
  const formCard = (
    <div className={styles.formCard}>
      {editingMedId && <span className={styles.formEyebrow}>Edit Medication</span>}
      <div className={styles.formMedName}>{draft.name}</div>

      <div className={styles.formGrid}>
        <div className={styles.formField}>
          <span className={styles.formFieldLabel}>Status <span className={styles.required}>•</span></span>
          <Select
            options={STATUS_OPTIONS}
            value={draft.status}
            onChange={v => setDraft(d => ({ ...d, status: v }))}
          />
        </div>
        <div className={styles.formField}>
          <span className={styles.formFieldLabel}>Start Date <span className={styles.required}>•</span></span>
          <DatePicker
            value={draft.start}
            onSelect={v => setDraft(d => ({ ...d, start: v }))}
          />
        </div>
        {isStopped && (
          <>
            <div className={styles.formField}>
              <span className={styles.formFieldLabel}>Stop Date <span className={styles.required}>•</span></span>
              <DatePicker
                value={draft.stopDate}
                onSelect={v => setDraft(d => ({ ...d, stopDate: v }))}
              />
            </div>
            <div className={styles.formField}>
              <span className={styles.formFieldLabel}>Select Reason for Stopping med <span className={styles.required}>•</span></span>
              <Select
                options={STOP_REASON_OPTIONS}
                value={draft.stopReason}
                onChange={v => setDraft(d => ({ ...d, stopReason: v }))}
                placeholder="Select Reason"
              />
            </div>
          </>
        )}
        <div className={`${styles.formField} ${styles.formFieldWide} ${isStopped ? styles.formFieldWideStopped : ''}`}>
          <span className={styles.formFieldLabel}>Sig <span className={styles.required}>•</span></span>
          <Input
            value={draft.sig}
            onChange={e => setDraft(d => ({ ...d, sig: e.target.value }))}
            placeholder="Enter Sig"
          />
        </div>
      </div>

      {draft.noteOpen ? (
        <div className={styles.formNoteBox}>
          <div className={styles.formNoteHeader}>
            <span className={styles.formFieldLabel}>Add Note</span>
            <button type="button" className={styles.formNoteClose} onClick={closeNote} aria-label="Remove note">
              <Icon name="solar:close-linear" size={14} color="var(--neutral-300)" />
            </button>
          </div>
          <Textarea
            value={draft.note}
            onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
            placeholder="Add a note"
          />
        </div>
      ) : (
        <button type="button" className={styles.formAddNoteLink} onClick={openNote}>
          <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
          Add Note
        </button>
      )}

      <div className={styles.formActions}>
        <Button variant="primary" size="S" onClick={saveDraft} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <span className={styles.formDivider} />
        <button type="button" className={styles.formCancel} onClick={discard} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      {/* Active Medications */}
      <div className={styles.medHeader}>
        <div className={styles.medHeaderLeft}>
          <span className={styles.medHeaderTitle}>Member's Medications</span>
        </div>
        <div className={styles.medHeaderRight}>
          <Toggle size="S" items={MED_VIEW_ITEMS} active={medView} onChange={setMedView} />
          <Button
            variant="tertiary"
            size="L"
            menuItems={ADD_NEW_MENU_ITEMS}
            menuWidth={250}
            menuAriaLabel="Add medication"
            onMenuSelect={(key) => {
              if (key === 'manual') { setDischargeUploadOpen(false); openContainer(); }
              else if (key === 'discharge') { discard(); setDischargeUploadOpen(true); }
              else showToast(`${ADD_NEW_MENU_ITEMS.find(i => i.key === key)?.label} — coming soon`);
            }}
          >
            Add New
          </Button>
        </div>
      </div>

      {/* Search phase — no wrapping card, the search bar sits flush in the
          panel until a med is picked or another "Add New" method is chosen. */}
      {phase === 'search' && !editingExtractedId && (
        <div className={styles.panelEnter}>
          <div ref={searchRowRef} className={styles.searchRow}>
            <SearchBar
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search medications from OpenFDA (brand or generic)…"
              fullWidth
              autoFocus
            />
            {searching && <span className={styles.searchHint}>Searching…</span>}
          </div>
          {searchError && <div className={styles.searchError}>{searchError}</div>}
          {!searching && query.trim().length >= 2 && results.length === 0 && !searchError && (
            <div className={styles.searchEmpty}>No matches. Try a different name.</div>
          )}
          {results.length > 0 && (
            <MenuPopover
              anchorRef={searchRowRef}
              align="left"
              width={searchRowRef.current?.getBoundingClientRect().width || 320}
              items={results.map(m => ({
                key: m.id,
                label: (m.dosageForm || m.route)
                  ? `${m.displayName} — ${[m.dosageForm, m.route].filter(Boolean).join(', ').toLowerCase()}`
                  : m.displayName,
              }))}
              onSelect={(key) => pickMed(results.find(m => m.id === key))}
              onClose={() => setResults([])}
              ariaLabel="Medication results"
            />
          )}
        </div>
      )}

      {/* Form phase — a med was picked; card matches Figma 2086:24739.
          When editing an extracted med, its form renders inline in the
          discharge list below instead (see editingExtractedId). */}
      {phase === 'form' && !editingExtractedId && !editingMedId && (
        <div className={`${styles.addPanel} ${styles.panelEnter}`}>
          {formCard}
        </div>
      )}

      {dischargeUploadOpen && (
        <div className={styles.panelEnter}>
          <DocumentUploader
            accept=".pdf"
            onCancel={() => setDischargeUploadOpen(false)}
            readyContent={({ file, onRemove }) => (
              <FileRow
                file={file}
                phase="ready"
                actions={
                  <>
                    <Button
                      variant="primary"
                      size="S"
                      leadingIconElement={<AIIcon size={14} />}
                      disabled={extracting}
                      onClick={() => extractMeds(file)}
                    >
                      {extracting ? (extractStage || 'Extracting…') : 'Extract Meds'}
                    </Button>
                    <CloseButton
                      size={14}
                      onClick={() => { onRemove(); setDischargeUploadOpen(false); }}
                      label="Remove"
                    />
                  </>
                }
              />
            )}
          />
        </div>
      )}

      {/* Discharge updates callout — the entry point banked for this flow;
          now live once "Extract Meds" has produced results. */}
      {extractedMeds && extractedMeds.length > 0 && (
        <>
          <div className={styles.discharge}>
            <button type="button" className={styles.dischargeLink} onClick={() => setExtractedExpanded(v => !v)}>
              <AIIcon size={16} />
              New Medication Updates from Discharge Report
              <span className={styles.dischargeBadge}>{extractedMeds.length}</span>
            </button>
            <span className={styles.dischargeDivider} />
            <button type="button" className={styles.viewAll} onClick={() => setExtractedExpanded(v => !v)}>
              {extractedExpanded ? 'Hide' : 'View All'}
            </button>
          </div>
          <div className={`${styles.extractedCollapse} ${extractedExpanded ? styles.extractedCollapseOpen : ''}`}>
            <div className={styles.extractedCollapseInner}>
              <div className={styles.extractedList}>
                {extractedMeds.map(m => (
                  phase === 'form' && editingExtractedId === m.id ? (
                    <div key={m.id} className={styles.extractedEditRow}>
                      {formCard}
                    </div>
                  ) : (
                  <div
                    key={m.id}
                    className={`${styles.extractedRow} ${exitingExtractedIds.has(m.id) ? styles.extractedRowExiting : ''}`}
                    onAnimationEnd={() => { if (exitingExtractedIds.has(m.id)) removeExtracted(m.id); }}
                  >
                    <Checkbox aria-label={`Select ${m.name}`} />
                    <div className={styles.extractedText}>
                      <div className={styles.extractedName}>{m.name}</div>
                      <div className={styles.extractedMeta}>
                        {m.start} - {m.stop} <span className={styles.extractedDot}>•</span> {m.sig}
                        {m.note && (
                          <>
                            {' '}<span className={styles.extractedDot}>•</span>
                            <button
                              type="button"
                              className={styles.viewNoteLink}
                              onClick={() => setNoteExpanded(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                            >
                              View Note
                              <Icon
                                name="solar:alt-arrow-down-linear"
                                size={12}
                                color="currentColor"
                                className={noteExpanded[m.id] ? styles.viewNoteChevronOpen : styles.viewNoteChevron}
                              />
                            </button>
                          </>
                        )}
                      </div>
                      {noteExpanded[m.id] && m.note && (
                        <div className={styles.noteLine}>
                          <span className={styles.noteLabel}>Note:</span> {m.note}
                        </div>
                      )}
                    </div>
                    <div className={styles.extractedActions}>
                      <button type="button" className={styles.extractedAdd} onClick={() => addExtracted(m)}>
                        Add to List
                      </button>
                      <span className={styles.extractedDivider} />
                      <button
                        type="button"
                        className={styles.extractedIconBtn}
                        onClick={() => editExtracted(m)}
                        aria-label="Edit"
                        title="Edit"
                      >
                        <Icon name="solar:pen-2-linear" size={16} color="var(--neutral-300)" />
                      </button>
                      <span className={styles.extractedDivider} />
                      <CloseButton size={16} onClick={() => dismissExtracted(m.id)} label="Dismiss" />
                    </div>
                  </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Medications — table (columns) or card (Figma 7211:452572) view */}
      {medications.length === 0 ? (
        <div className={styles.empty}>
          <RingEmptyState icon="solar:pill-linear" label="No Active Medications" />
        </div>
      ) : medView === 'card' ? (
        <div className={styles.medCardSection}>
          <div className={`${styles.medCardSelectAll} ${editingMedId ? styles.medRowDimmed : ''}`}>
            <Checkbox
              checked={someMedsSelected ? 'indeterminate' : allMedsSelected}
              onCheckedChange={toggleAllMeds}
              aria-label="Select all medications"
              disabled={medications.length === 0}
            />
            <span>Select All</span>
          </div>
          <div className={styles.medCardList}>
          {medications.map(m => (
            <Fragment key={m.id}>
            {editingMedId === m.id ? (
            <div className={`${styles.addPanel} ${styles.medEditRow}`}>{formCard}</div>
            ) : (
            <div
              className={[
                styles.medCardRow,
                openNoteIds.has(m.id) ? styles.medCardRowNoteOpen : '',
                editingMedId ? styles.medRowDimmed : '',
                exitingMedIds.has(m.id) ? styles.medRowExiting : '',
              ].filter(Boolean).join(' ')}
              onAnimationEnd={() => { if (exitingMedIds.has(m.id)) finishMedExit(m.id); }}
            >
              <Checkbox
                checked={selectedMedIds.has(m.id)}
                onCheckedChange={() => toggleMed(m.id)}
                aria-label={`Select ${m.name}`}
              />
              <div className={styles.medCardText}>
                <div className={styles.medCardNameRow}>
                  <span className={styles.medCardName}>{m.name}</span>
                  {m.source === 'discharge_import' && (
                    <Badge tone="primary" size="S" label="New" />
                  )}
                </div>
                <div className={styles.medCardMeta}>
                  {m.start} - {m.stop || '—'} <span className={styles.extractedDot}>•</span> {m.sig || '—'}
                </div>
              </div>
              <div className={styles.medCardActions}>
                {/* Stop/Continue toggle — commented out for now.
                <div className={styles.medStopContinue}>
                  <button
                    type="button"
                    className={m.status === 'Stopped' ? styles.stopActive : ''}
                    onClick={() => stopMedication(m)}
                    disabled={m.status === 'Stopped'}
                  >
                    Stop
                  </button>
                  <button
                    type="button"
                    className={continuedIds.has(m.id) ? styles.continueActive : ''}
                    onClick={() => continueMedication(m)}
                    disabled={m.status === 'Stopped'}
                  >
                    Continue
                  </button>
                </div>
                <span className={styles.extractedDivider} />
                */}
                <ActionButton
                  icon="solar:document-text-linear"
                  size="S"
                  tooltip="Note"
                  count={noteCount(m)}
                  onClick={() => toggleNote(m)}
                />
                <span className={styles.extractedDivider} />
                <MedRowMenu
                  onEdit={() => editMedication(m)}
                  onDelete={() => setDeleteTarget(m)}
                />
              </div>
            </div>
            )}
            {editingMedId !== m.id && openNoteIds.has(m.id) && renderNoteEditor(m)}
            </Fragment>
          ))}
          </div>
        </div>
      ) : (
        <div className={styles.tableScroll}>
        <div className={styles.table}>
          <div className={`${styles.headRow} ${editingMedId ? styles.medRowDimmed : ''}`}>
            <span className={styles.checkCell} onClick={e => e.stopPropagation()}>
              <Checkbox
              checked={someMedsSelected ? 'indeterminate' : allMedsSelected}
              onCheckedChange={toggleAllMeds}
              aria-label="Select all medications"
              disabled={medications.length === 0}
            />
            </span>
            <span className={styles.nameCell}>Medication Name</span>
            <span className={styles.dateCell}>Start Date</span>
            <span className={styles.dateCell}>Stop Date</span>
            <span className={styles.sigCell}>Sig</span>
            <span className={styles.statusCell}>Status</span>
            <span className={styles.actionsCell}>Actions</span>
          </div>
          {medications.map(m => (
            <Fragment key={m.id}>
            {editingMedId === m.id ? (
            <div className={`${styles.addPanel} ${styles.medEditRow}`}>{formCard}</div>
            ) : (
            <div
              className={[
                styles.row,
                openNoteIds.has(m.id) ? styles.rowNoteOpen : '',
                editingMedId ? styles.medRowDimmed : '',
                exitingMedIds.has(m.id) ? styles.medRowExiting : '',
              ].filter(Boolean).join(' ')}
              onAnimationEnd={() => { if (exitingMedIds.has(m.id)) finishMedExit(m.id); }}
            >
              <span className={styles.checkCell} onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={selectedMedIds.has(m.id)}
                  onCheckedChange={() => toggleMed(m.id)}
                  aria-label={`Select ${m.name}`}
                />
              </span>
              <span className={styles.nameCell}>{m.name}</span>
              <span className={styles.dateCell}>
                {isEditingCell(m, 'start') ? (
                  <span ref={cellEditRef} className={styles.cellEditDate}>
                    <DatePicker
                      value={cellDraft}
                      aria-label="Start date"
                      onSelect={v => commitCell(m, 'start', v)}
                    />
                  </span>
                ) : cellTrigger(m, 'start', m.start || '—')}
              </span>
              <span className={styles.dateCell}>
                {isEditingCell(m, 'stop') ? (
                  <span ref={cellEditRef} className={styles.cellEditDate}>
                    <DatePicker
                      value={cellDraft}
                      aria-label="Stop date"
                      onSelect={v => commitCell(m, 'stop', v)}
                    />
                  </span>
                ) : cellTrigger(m, 'stop', m.stop || '—')}
              </span>
              <span className={styles.sigCell}>
                {isEditingCell(m, 'sig') ? (
                  <span ref={cellEditRef}>
                    <Input
                      value={cellDraft}
                      autoFocus
                      aria-label="Sig"
                      onChange={e => setCellDraft(e.target.value)}
                      // mousedown fires before blur, so an outside click has
                      // already committed and closed by now — guard against
                      // committing the same edit twice.
                      onBlur={() => { if (isEditingCell(m, 'sig')) commitCell(m, 'sig'); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitCell(m, 'sig');
                        if (e.key === 'Escape') cancelCellEdit();
                      }}
                    />
                  </span>
                ) : cellTrigger(m, 'sig', m.sig || '—')}
              </span>
              <span className={styles.statusCell}>
                {isEditingCell(m, 'status') ? (
                  <span ref={cellEditRef} className={styles.cellEditStatus}>
                    <Select
                      options={STATUS_OPTIONS}
                      value={cellDraft}
                      onChange={v => commitCell(m, 'status', v)}
                      portal
                    />
                  </span>
                ) : cellTrigger(m, 'status', m.status || 'Active')}
              </span>
              <span className={styles.actionsCell}>
                {/* Stop/Continue toggle — commented out for now.
                <div className={styles.medStopContinue}>
                  <button
                    type="button"
                    className={m.status === 'Stopped' ? styles.stopActive : ''}
                    onClick={() => stopMedication(m)}
                    disabled={m.status === 'Stopped'}
                  >
                    Stop
                  </button>
                  <button
                    type="button"
                    className={continuedIds.has(m.id) ? styles.continueActive : ''}
                    onClick={() => continueMedication(m)}
                    disabled={m.status === 'Stopped'}
                  >
                    Continue
                  </button>
                </div>
                <span className={styles.extractedDivider} />
                */}
                <ActionButton
                  icon="solar:document-text-linear"
                  size="S"
                  tooltip="Note"
                  count={noteCount(m)}
                  onClick={() => toggleNote(m)}
                />
                <span className={styles.extractedDivider} />
                <MedRowMenu
                  onEdit={() => editMedication(m)}
                  onDelete={() => setDeleteTarget(m)}
                />
              </span>
            </div>
            )}
            {editingMedId !== m.id && openNoteIds.has(m.id) && renderNoteEditor(m)}
            </Fragment>
          ))}
        </div>
        </div>
      )}

      {/* Medication Checklist — items from the mock, all boxes start unchecked */}
      <div className={styles.checklist}>
        <div className={styles.checklistTitle}>
          Medication Checklist
          <span className={styles.mandatoryDot} aria-hidden="true" />
        </div>
        {MED_RECON_MOCK.checklist.map(c => (
          <label key={c.id} className={styles.checkItem}>
            <Checkbox
              checked={!!checks[c.id]}
              onCheckedChange={v => setChecks(prev => ({ ...prev, [c.id]: v === true }))}
            />
            <span className={`${styles.checkLabel} ${checks[c.id] ? styles.checkLabelDone : ''}`}>{c.label}</span>
          </label>
        ))}
      </div>

      {/* Delete confirmation — Figma 2564:46849 */}
      {deleteTarget && (
        <ConfirmDialog
          variant="error"
          icon="solar:trash-bin-2-linear"
          title="Delete Medication?"
          description="This medication will be deleted from the patient's record in Fold."
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          overlayClassName="bg-black/25"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteMedication}
        />
      )}

      {/* Bulk delete — same dialog, pluralised for the selection. */}
      {bulkDeleteOpen && (
        <ConfirmDialog
          variant="error"
          icon="solar:trash-bin-2-linear"
          title={`Delete ${selectedMedIds.size} Medication${selectedMedIds.size === 1 ? '' : 's'}?`}
          description="These medications will be deleted from the patient's record in Fold."
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          overlayClassName="bg-black/25"
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={confirmBulkDelete}
        />
      )}

      {/* Bulk action bar — Figma 2570:46879. Mirrors the Letters step: sits
          absolutely over the content column so it stays put while the
          medication list scrolls underneath. */}
      {selectedMedIds.size > 0 && (
        <div className={styles.bulkBar} role="toolbar" aria-label="Medication bulk actions">
          <div className={styles.bulkSelect}>
            <Checkbox
              checked={someMedsSelected ? 'indeterminate' : allMedsSelected}
              onCheckedChange={toggleAllMeds}
              aria-label="Select all medications"
            />
            <span className={styles.bulkCount}>{selectedMedIds.size} Selected</span>
          </div>
          <span className={styles.bulkDivider} />
          <Button
            variant="secondary"
            size="L"
            leadingIcon="solar:forbidden-circle-linear"
            disabled={bulkBusy}
            onClick={stopSelectedMeds}
          >
            Stop Medication
          </Button>
          <ActionButton
            icon="solar:trash-bin-trash-linear"
            size="S"
            tooltip="Delete"
            onClick={() => setBulkDeleteOpen(true)}
          />
          <span className={styles.bulkDivider} />
          <ActionButton
            icon="solar:close-circle-linear"
            size="S"
            tooltip="Clear selection"
            onClick={clearMedSelection}
          />
        </div>
      )}
    </div>
  );
}
