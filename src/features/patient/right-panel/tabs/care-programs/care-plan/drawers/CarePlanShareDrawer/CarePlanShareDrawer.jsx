import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { SplitDrawerLayout } from '../../../../../../../../components/Drawer/SplitDrawerLayout';
import { Button } from '../../../../../../../../components/Button/Button';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Checkbox } from '../../../../../../../../components/Checkbox/Checkbox';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Select } from '../../../../../../../../components/Select/Select';
import { DatePickerPopover } from '../../../../../../../../components/DatePicker/DatePickerPopover';
import { Tabs } from '../../../../../../../../components/Tabs/Tabs';
import { withReportHeader, withReportFooter } from '../../../../../../../email-builder/reportHeaderComponent';
import { interFontFaces } from '../../../../../../../email-builder/rasterizeComponent';
import { useComponentImage, loadInter, loadPng } from '../../../../../../../email-builder/reportPrintAssets';
import clinicLogoUrl from '../../../../../../../../assets/trailhead-clinics-logo.png';
import {
  DEFAULT_PRINT_SETTINGS, demographicRows, findPatientRecord, normalizePrintSettings, samePrintSettings,
} from '../../lib/carePlanPrintSettings';
import { historySection, labSection, medicationSection, printContentSections } from '../../lib/carePlanPrintContent';
import { onlyRecentChanges } from '../../lib/carePlanRecentChanges';
import { buildCarePlanSnapshot } from '../../lib/carePlanDraft';
import { CarePlanPrintPersonalize } from './CarePlanPrintPersonalize';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { buildCarePlanDownloadFilename } from '../../lib/carePlanExport';
import { buildCarePlanVersionsPdf } from '../../lib/carePlanVersionsPdf';
import {
  SHARE_DATE_RANGE_PRESETS,
  SHARE_FILTERS_DEFAULT,
  isShareFiltersActive,
  shareDateRangeFor,
  matchesShareFilters,
} from '../../lib/carePlanShareFilters';
import { useCarePlanDraftState } from '../../lib/useCarePlanDraftState';
import { CarePlanPdfPreview } from './CarePlanPdfPreview';
import styles from './CarePlanShareDrawer.module.css';

const TARGET_ID = { EHR: 'ehr', Patient: 'patient', POA: 'poa' };
const EDITOR_TABS = [
  { key: 'content', label: 'Content' },
  { key: 'personalize', label: 'Personalize' },
];
const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
// The clinic logo, drawn once to PNG for jsPDF.
const CLINIC_LOGO = { width: 510, height: 450 };

/**
 * Print settings and the presets that keep them. Opens on the organization's
 * default preset when there is one, otherwise the standard settings.
 */
function usePrintPresets() {
  const presets = useAppStore(s => s.carePlanPrintPresets);
  const fetchPresets = useAppStore(s => s.fetchCarePlanPrintPresets);
  const savePreset = useAppStore(s => s.saveCarePlanPrintPreset);
  const deletePreset = useAppStore(s => s.deleteCarePlanPrintPreset);
  const authUserId = useAppStore(s => s.authUserId);
  const showToast = useAppStore(s => s.showToast);
  const [presetId, setPresetId] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_PRINT_SETTINGS);
  const touched = useRef(false);

  useEffect(() => {
    let live = true;
    fetchPresets().then(() => {
      // The default applies on open, unless someone already changed something.
      const def = useAppStore.getState().carePlanPrintPresets.find(p => p.isDefault);
      if (!live || !def || touched.current) return;
      setPresetId(def.id);
      setSettings(normalizePrintSettings(def.settings));
    });
    return () => { live = false; };
  }, [fetchPresets]);

  const preset = presets.find(p => p.id === presetId) || null;
  const dirty = !samePrintSettings(settings, preset ? preset.settings : DEFAULT_PRINT_SETTINGS);
  // Org presets are everyone's to edit; a private one only its owner's.
  const canEditPreset = !!preset && (preset.scope === 'org' || preset.ownerUserId === authUserId);

  return {
    presets, presetId, settings, dirty, canEditPreset,
    setSettings: (next) => { touched.current = true; setSettings(next); },
    pickPreset: (id) => {
      touched.current = true;
      const next = presets.find(p => p.id === id);
      setPresetId(next ? next.id : null);
      setSettings(normalizePrintSettings(next?.settings));
    },
    saveToPreset: async () => {
      if (!preset) return;
      const saved = await savePreset({ settings }, preset.id);
      if (saved) showToast(`Saved "${saved.name}"`);
    },
    saveAsPreset: async (values) => {
      const saved = await savePreset({ ...values, settings });
      if (!saved) return;
      setPresetId(saved.id);
      showToast(`Saved "${saved.name}" ${saved.scope === 'org' ? 'for everyone' : 'for you only'}`);
    },
    makeDefault: async () => {
      if (!preset) return;
      const saved = await savePreset({ isDefault: true, scope: 'org' }, preset.id);
      if (saved) showToast(`"${saved.name}" is now the default`);
    },
    removePreset: async () => {
      if (!preset) return;
      if (await deletePreset(preset.id)) {
        showToast(`Deleted "${preset.name}"`);
        setPresetId(null);
      }
    },
  };
}

function SectionSelectAll({ label, ids, off, setOff, collapsed, onToggle }) {
  const total = ids.length;
  const count = ids.filter(id => !off.has(id)).length;
  const allOn = count === total && total > 0;
  return (
    <div className={styles.sectionHead}>
      <button
        type="button"
        className={styles.sectionToggle}
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <DownChevronIcon
          size={12}
          color="var(--neutral-400)"
          className={`${styles.sectionChevron} ${collapsed ? '' : styles.sectionChevronOpen}`}
        />
        <span className={styles.sectionTitle}>
          {label}
          {' '}
          <span className={styles.count}>{count}/{total}</span>
        </span>
      </button>
      <button
        type="button"
        className={styles.selectAll}
        onClick={() => setOff(allOn ? new Set(ids) : new Set())}
      >
        {allOn ? 'Clear all' : 'Select all'}
      </button>
    </div>
  );
}

function SectionToggleHead({ title, collapsed, onToggle, trailing }) {
  return (
    <div className={styles.sectionHead}>
      <button
        type="button"
        className={styles.sectionToggle}
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <DownChevronIcon
          size={12}
          color="var(--neutral-400)"
          className={`${styles.sectionChevron} ${collapsed ? '' : styles.sectionChevronOpen}`}
        />
        <span className={styles.sectionTitle}>{title}</span>
      </button>
      {trailing}
    </div>
  );
}

// Preview the plan, choose which goals/interventions to include, then download
// a PDF or share it to the EHR / patient / POA (#8, #13, #40).
//
// What is shared is the plan as last signed: unsigned changes stay out until
// someone signs them, and a plan that was never signed can be previewed and
// downloaded as a draft but not shared.
// `carePlanNote` is the plan's latest Care Note ({ detail, actor, createdAt }) or null.
export function CarePlanShareDrawer({ patientId, program, data: draftData, patientName, carePlanNote = null, canShare: canEdit = true, onClose }) {
  const sharePatientCarePlan = useAppStore(s => s.sharePatientCarePlan);
  const key = `${patientId}::${program.id}`;
  const signedCopy = useAppStore(s => s.patientSignedCarePlans[key]);
  const fetchSignedCarePlans = useAppStore(s => s.fetchSignedCarePlans);
  const draft = useCarePlanDraftState(patientId, program.id);
  useEffect(() => { fetchSignedCarePlans(patientId); }, [patientId, fetchSignedCarePlans]);
  const signed = draft.signed && !!signedCopy;
  const signedVersion = signedCopy?.signedVersion || draft.latestVersion?.versionNumber || null;
  // Earlier versions come from their saved snapshots, so any of them can be
  // previewed, downloaded and (if it was signed) shared again.
  const fetchCarePlanVersions = useAppStore(s => s.fetchCarePlanVersions);
  const versions = useAppStore(s => s.patientCarePlanVersions[key]);
  useEffect(() => {
    if (versions === undefined) fetchCarePlanVersions(patientId, program.id);
  }, [versions, patientId, program.id, fetchCarePlanVersions]);
  const olderVersions = useMemo(
    () => (versions || []).filter(v => v.versionNumber !== signedVersion && Array.isArray(v.snapshot?.goals)),
    [versions, signedVersion],
  );
  const versionFmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '');
  // Newest first: the draft, the latest signed version, then earlier ones.
  const versionOptions = useMemo(() => [
    ...(!signed || draft.hasUnsignedChanges ? [{ value: 'draft', label: signed ? 'Draft with unsigned changes' : 'Draft (not signed)' }] : []),
    ...(signed ? [{ value: 'signed', label: `Version ${signedVersion} (signed, latest)` }] : []),
    ...olderVersions.map(v => ({
      value: `v${v.versionNumber}`,
      label: `Version ${v.versionNumber} (${v.reason === 'signed' ? 'signed' : v.reason === 'restore' ? 'restored' : 'saved'} ${versionFmt(v.createdAt)})`,
    })),
  ], [signed, draft.hasUnsignedChanges, signedVersion, olderVersions]);
  // Up to two versions, printed back to back.
  const [pickedVersions, setPickedVersions] = useState(null);
  const defaultVersion = signed ? 'signed' : 'draft';
  const pickedKeys = (pickedVersions || []).filter(k => versionOptions.some(o => o.value === k));
  const versionKeysStr = (pickedKeys.length ? pickedKeys : [defaultVersion]).join(',');
  const pickVersions = (vals) => { if (vals.length) setPickedVersions(vals.slice(-2)); };
  const versionParts = useMemo(() => {
    const order = versionOptions.map(o => o.value);
    return versionKeysStr.split(',')
      .toSorted((a, b) => order.indexOf(a) - order.indexOf(b))
      .map((k) => {
        if (k === 'draft') return { key: k, versionNumber: null, reason: null, label: 'Draft (unsigned)', data: draftData };
        if (k === 'signed') {
          return {
            key: k, versionNumber: signedVersion, reason: 'signed', label: `Version ${signedVersion}`,
            signedBy: signedCopy.plan?.signedBy, signedAt: signedCopy.plan?.signedAt,
            data: {
              conditions: signedCopy.plan?.conditions || [],
              goals: signedCopy.goals || [],
              interventions: signedCopy.interventions || [],
              barriers: signedCopy.barriers || [],
            },
          };
        }
        const v = olderVersions.find(x => `v${x.versionNumber}` === k);
        const s = v.snapshot;
        return {
          key: k, versionNumber: v.versionNumber, reason: v.reason, label: `Version ${v.versionNumber}`,
          signedBy: v.createdBy, signedAt: v.createdAt, createdAt: v.createdAt,
          data: {
            conditions: (s.conditions || []).map(x => (typeof x === 'string' ? { label: x } : x)),
            goals: s.goals || [],
            interventions: s.interventions || [],
            barriers: s.barriers || [],
          },
        };
      });
  }, [versionKeysStr, versionOptions, draftData, signedCopy, signedVersion, olderVersions]);
  // The editor lists every item in the picked versions (newest copy wins), so
  // one checkbox includes or leaves out an item in both.
  const data = useMemo(() => {
    const firstById = (lists) => {
      const seen = new Map();
      for (const list of lists) for (const item of list || []) if (item?.id != null && !seen.has(String(item.id))) seen.set(String(item.id), item);
      return [...seen.values()];
    };
    const labels = new Map();
    for (const p of versionParts) for (const cnd of p.data.conditions || []) if (cnd?.label && !labels.has(cnd.label)) labels.set(cnd.label, cnd);
    return {
      conditions: [...labels.values()],
      goals: firstById(versionParts.map(p => p.data.goals)),
      interventions: firstById(versionParts.map(p => p.data.interventions)),
      barriers: firstById(versionParts.map(p => p.data.barriers)),
    };
  }, [versionParts]);
  // With two versions picked, each row says which version(s) it is in.
  const versionTags = useMemo(() => {
    if (versionParts.length < 2) return null;
    const map = { goals: new Map(), interventions: new Map(), barriers: new Map() };
    versionParts.forEach((p, idx) => {
      for (const kind of Object.keys(map)) {
        for (const item of p.data[kind] || []) {
          const id = String(item.id);
          map[kind].set(id, [...(map[kind].get(id) || []), { short: p.versionNumber ? `V${p.versionNumber}` : 'Draft', newest: idx === 0 }]);
        }
      }
    });
    return map;
  }, [versionParts]);
  const tagsFor = (kind, id) => (versionTags ? (
    <span className={styles.rowVersions}>
      {(versionTags[kind].get(String(id)) || []).map(t => (
        <Badge key={t.short} size="xs" tone={t.newest ? 'primary' : 'neutral'} label={t.short} />
      ))}
    </span>
  ) : null);
  const primaryPart = versionParts[0];
  const singleVersion = versionParts.length === 1;
  // Share sends one signed version; two picked versions download together.
  const shownVersion = singleVersion ? primaryPart.versionNumber : null;
  const canShare = canEdit && signed && singleVersion && primaryPart.reason === 'signed';
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const showToast = useAppStore(s => s.showToast);
  const lastVisit = useAppStore((s) => {
    const p = (s.patients || []).find(x => x.id === patientId)
      || (s.allPatients || []).find(x => x.id === patientId);
    return p?.lastVisit || p?.last_visit || null;
  });

  const [editorTab, setEditorTab] = useState('content');
  const print = usePrintPresets();
  const { settings: printSettings } = print;

  // Personalize > Content: medications and history load only when asked for;
  // lab readings come with the plan.
  const medications = useAppStore(s => s.patientMedications[patientId]);
  const pamiHistory = useAppStore(s => s.patientPamiRecords[patientId]?.history);
  const liveSlice = useAppStore(s => s.patientCarePlans[key]);
  const fetchPatientMedications = useAppStore(s => s.fetchPatientMedications);
  const fetchPatientPamiRecords = useAppStore(s => s.fetchPatientPamiRecords);
  useEffect(() => {
    if (printSettings.showMedications) fetchPatientMedications(patientId);
  }, [printSettings.showMedications, patientId, fetchPatientMedications]);
  useEffect(() => {
    if (printSettings.showHistory && !pamiHistory) fetchPatientPamiRecords(patientId);
  }, [printSettings.showHistory, pamiHistory, patientId, fetchPatientPamiRecords]);

  // Header / footer components (Settings > Content > Components) and the
  // fonts and clinic logo they're drawn with.
  const savedHeaders = useAppStore(s => s.customReportHeaderPresets);
  const savedFooters = useAppStore(s => s.customReportFooterPresets);
  const fetchCustomPresets = useAppStore(s => s.fetchCustomPresets);
  useEffect(() => { fetchCustomPresets(); }, [fetchCustomPresets]);
  const headerComponents = useMemo(() => withReportHeader(savedHeaders), [savedHeaders]);
  const footerComponents = useMemo(() => withReportFooter(savedFooters), [savedFooters]);
  const [assets, setAssets] = useState({});
  useEffect(() => {
    let live = true;
    Promise.all([loadInter(), loadPng(clinicLogoUrl, CLINIC_LOGO.width, CLINIC_LOGO.height)])
      .then(([fonts, clinicLogo]) => { if (live) setAssets({ fonts, clinicLogo }); });
    return () => { live = false; };
  }, []);
  // An uploaded logo, redrawn as PNG (jsPDF places PNGs).
  const customLogo = printSettings.customLogo;
  const [customLogoPng, setCustomLogoPng] = useState({ src: null, png: null });
  useEffect(() => {
    if (!customLogo?.dataUrl) return undefined;
    let live = true;
    const h = 150;
    const w = Math.round((customLogo.width / customLogo.height) * h) || 190;
    loadPng(customLogo.dataUrl, w, h, { trim: true, pad: 2 })
      .then(png => { if (live) setCustomLogoPng({ src: customLogo.dataUrl, png }); });
    return () => { live = false; };
  }, [customLogo]);
  const customPng = customLogo && customLogoPng.src === customLogo.dataUrl ? customLogoPng.png : null;
  const logo = printSettings.showLogo ? (customLogo ? customPng : assets.clinicLogo) || null : null;

  const fontFaces = useMemo(() => interFontFaces(assets.fonts), [assets.fonts]);
  const generatedOn = useMemo(() => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), []);
  // The page count of the last PDF built, for "Page 1 of 5" in a header or
  // footer; a change redraws those (and the PDF with them), then settles.
  const [pageCount, setPageCount] = useState(0);
  const componentCtx = useMemo(() => ({
    reportTitle: printSettings.format === 'table' ? 'Care Plan' : 'Care Plan Summary',
    generatedOn,
    // A header with a logo slot gets a blank image when the logo is off, not
    // a broken one.
    employerLogo: logo?.dataUrl || BLANK_PNG,
    pageCount: pageCount || '',
  }), [generatedOn, logo, pageCount, printSettings.format]);
  const headerComponent = headerComponents.find(h => String(h.id) === String(printSettings.headerId)) || headerComponents[0] || null;
  const footerComponent = footerComponents.find(f => String(f.id) === String(printSettings.footerId)) || null;
  const { image: headerImage } = useComponentImage(headerComponent, componentCtx, fontFaces, printSettings.showHeader && !!assets.fonts);
  const { image: footerImage } = useComponentImage(footerComponent, componentCtx, fontFaces, printSettings.showFooter && !!footerComponent && !!assets.fonts);

  // Read once on open: the patient record doesn't change while sharing.
  const patientRecord = useMemo(() => findPatientRecord(useAppStore.getState(), patientId), [patientId]);
  const pdfOptions = useMemo(() => ({
    format: printSettings.format,
    fonts: assets.fonts || null,
    showCarePlanNote: printSettings.showCarePlanNote,
    groupBy: printSettings.groupBy,
    carePlanNote: printSettings.showCarePlanNote ? carePlanNote?.detail || '' : '',
    demographics: printSettings.showDemographics ? demographicRows(patientRecord, printSettings.demographics) : [],
    sections: printContentSections({
      labs: printSettings.showLabs ? labSection(data.goals, liveSlice?.measurements) : null,
      medications: printSettings.showMedications ? medicationSection(medications) : null,
      history: printSettings.showHistory ? historySection(pamiHistory) : null,
    }),
    header: printSettings.showHeader ? headerImage || null : null,
    // undefined: the standard footer line; null: none.
    footer: !printSettings.showFooter ? null : (footerComponent ? footerImage || undefined : undefined),
    // A header shows the logo itself, so the page body doesn't repeat it.
    logo: printSettings.showHeader ? null : logo,
  }), [printSettings, carePlanNote, patientRecord, headerImage, footerImage, footerComponent, logo, assets.fonts, data.goals, liveSlice?.measurements, medications, pamiHistory]);

  const [shareFilters, setShareFilters] = useState(() => ({ ...SHARE_FILTERS_DEFAULT }));
  const rangeFieldRef = useRef(null);
  const [rangeAnchor, setRangeAnchor] = useState(null);
  const setShareFilter = (key, value) => setShareFilters(f => ({ ...f, [key]: value }));
  const clearShareFilters = () => setShareFilters({ ...SHARE_FILTERS_DEFAULT });
  const filtersActive = isShareFiltersActive(shareFilters);

  const filterCtx = useMemo(
    () => ({ lastVisitIso: lastVisit }),
    [lastVisit],
  );

  const filteredGoals = useMemo(
    () => data.goals.filter(g => matchesShareFilters(g, shareFilters, filterCtx)),
    [data.goals, shareFilters, filterCtx],
  );
  const filteredInterventions = useMemo(
    () => data.interventions.filter(i => matchesShareFilters(i, shareFilters, { ...filterCtx, kind: 'intervention' })),
    [data.interventions, shareFilters, filterCtx],
  );
  const filteredBarriers = useMemo(
    () => (data.barriers || []).filter(b => matchesShareFilters(b, shareFilters, filterCtx)),
    [data.barriers, shareFilters, filterCtx],
  );

  const filteredGoalIds = useMemo(() => filteredGoals.map(g => g.id), [filteredGoals]);
  const filteredIntvIds = useMemo(() => filteredInterventions.map(i => i.id), [filteredInterventions]);
  const filteredBarrierIds = useMemo(() => filteredBarriers.map(b => b.id), [filteredBarriers]);

  const [goalOff, setGoalOff] = useState(() => new Set());
  const [intvOff, setIntvOff] = useState(() => new Set());
  const [barrierOff, setBarrierOff] = useState(() => new Set());
  const [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false);
  // Per-section collapse (Goals / Interventions / Barriers).
  const [collapsed, setCollapsed] = useState({});
  const toggleCollapsed = (key) => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  const toggleConditionFilter = (label) => {
    setShareFilters((f) => {
      const set = new Set(f.conditions || []);
      if (set.has(label)) set.delete(label);
      else set.add(label);
      return { ...f, conditions: [...set] };
    });
  };

  const conditionLabels = useMemo(
    () => (data.conditions || []).map(c => c.label).filter(Boolean),
    [data.conditions],
  );

  const toggleOff = (set, id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  };

  const selectedGoalIds = filteredGoals.filter(g => !goalOff.has(g.id)).map(g => g.id);
  const selectedIntvIds = filteredInterventions.filter(i => !intvOff.has(i.id)).map(i => i.id);

  const selection = useMemo(() => ({
    conditions: data.conditions.map(c => c.label),
    goals: filteredGoals.filter(g => !goalOff.has(g.id)),
    interventions: filteredInterventions.filter(i => !intvOff.has(i.id)),
    barriers: filteredBarriers.filter(b => !barrierOff.has(b.id)),
  }), [data.conditions, filteredGoals, filteredInterventions, filteredBarriers, goalOff, intvOff, barrierOff]);

  const nothingSelected = selection.goals.length === 0
    && selection.interventions.length === 0
    && selection.barriers.length === 0;

  const plan = useAppStore(s => s.patientCarePlans[`${patientId}::${program.id}`]?.plan || null);
  const docMeta = useMemo(() => {
    // Plan progress: the average of the included goals' recorded progress.
    const progresses = selection.goals.map(g => Number(g.progress)).filter(n => Number.isFinite(n));
    return {
      patientName,
      programName: program.name,
      sharedBy: currentUserProfile?.name || '',
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      note: note.trim(),
      // For the Care Plan Summary format.
      plan: plan ? {
        createdBy: plan.createdBy,
        createdAt: plan.createdDate,
        signedBy: plan.signedBy,
        signedAt: plan.signedAt,
        progress: progresses.length ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length) : null,
      } : null,
      carePlanNote,
      patient: patientRecord,
    };
  }, [patientName, program.name, currentUserProfile?.name, note, plan, selection.goals, carePlanNote, patientRecord]);

  // One PDF part per picked version: that version's items, minus whatever the
  // filters and checkboxes leave out, signed by whoever signed it.
  const pdfParts = useMemo(() => versionParts.map((p) => {
    const keep = (list, opts, off) => (list || []).filter(x => matchesShareFilters(x, shareFilters, opts) && !off.has(x.id));
    let partSelection = {
      conditions: (p.data.conditions || []).map(x => x.label),
      goals: keep(p.data.goals, filterCtx, goalOff),
      interventions: keep(p.data.interventions, { ...filterCtx, kind: 'intervention' }, intvOff),
      barriers: keep(p.data.barriers, filterCtx, barrierOff),
    };
    // Recent changes only: this version against the one before it (the draft
    // against the latest signed version).
    let changesNote = '';
    if (printSettings.recentChangesOnly) {
      const signedSnapshots = (versions || []).filter(v => v.snapshot).toSorted((a, b) => b.versionNumber - a.versionNumber);
      const prev = p.key === 'draft'
        ? signedSnapshots[0]
        : signedSnapshots.find(v => v.versionNumber < p.versionNumber);
      const after = p.key === 'draft'
        ? (liveSlice ? buildCarePlanSnapshot(liveSlice) : p.data)
        : (signedSnapshots.find(v => v.versionNumber === p.versionNumber)?.snapshot || p.data);
      partSelection = onlyRecentChanges(partSelection, prev?.snapshot || null, after);
      changesNote = prev
        ? `Recent changes only: what was added, changed or removed since version ${prev.versionNumber}.`
        : 'Recent changes only: there is no earlier version, so everything on the plan is new.';
    }
    // Patient-facing wording: an IPA overlay's patient title stands in for the clinical one.
    if (printSettings.patientWording) {
      const reword = list => (list || []).map(x => (x.patientTitle ? { ...x, title: x.patientTitle } : x));
      partSelection = { ...partSelection, goals: reword(partSelection.goals), interventions: reword(partSelection.interventions), barriers: reword(partSelection.barriers) };
    }
    const progresses = partSelection.goals.map(g => Number(g.progress)).filter(n => Number.isFinite(n));
    return {
      meta: {
        ...docMeta,
        versionLabel: p.label,
        // Only needed when two versions share one PDF.
        versionBanner: versionParts.length > 1
          ? [p.label, p.signedBy || p.signedAt ? `Signed${p.signedBy ? ` by ${p.signedBy}` : ''}${p.signedAt ? ` on ${versionFmt(p.signedAt)}` : ''}` : (p.key === 'draft' ? 'Unsigned changes' : '')].filter(Boolean).join('  •  ')
          : '',
        changesNote,
        plan: docMeta.plan ? {
          ...docMeta.plan,
          signedBy: p.signedBy ?? docMeta.plan.signedBy,
          signedAt: p.signedAt ?? docMeta.plan.signedAt,
          progress: progresses.length ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length) : null,
        } : null,
      },
      selection: partSelection,
    };
  }), [versionParts, docMeta, shareFilters, filterCtx, goalOff, intvOff, barrierOff, printSettings.recentChangesOnly, printSettings.patientWording, versions, liveSlice]);

  const handleDownload = async () => {
    const base = buildCarePlanDownloadFilename({
      patientName,
      programCode: program.code,
      programName: program.name,
    });
    // Anything but the latest signed copy alone names its version(s).
    const suffix = singleVersion && primaryPart.key === 'signed'
      ? ''
      : `-${versionParts.map(p => (p.versionNumber ? `v${p.versionNumber}` : 'draft')).join('-')}`;
    const blob = await buildCarePlanVersionsPdf(pdfParts, pdfOptions);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = base.replace(/\.pdf$/, `${suffix}.pdf`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(singleVersion ? 'Care plan downloaded' : `${versionParts.map(p => p.label).join(' and ')} downloaded`);
  };

  const handleShare = async (shareTarget = 'EHR') => {
    setSharing(true);
    const rec = await sharePatientCarePlan(patientId, program, {
      target: TARGET_ID[shareTarget],
      format: 'standard',
      note: note.trim(),
      goalIds: selectedGoalIds,
      interventionIds: selectedIntvIds,
      versionNumber: shownVersion,
    });
    setSharing(false);
    if (!rec) return;
    showToast(shownVersion
      ? `Version ${shownVersion} shared to ${shareTarget}`
      : `Care plan shared to ${shareTarget}`);
    onClose();
  };

  const headerRight = (
    <>
      <Button variant="outline" leadingIcon="solar:download-minimalistic-linear" onClick={handleDownload} disabled={nothingSelected}>
        Download PDF
      </Button>
      <Button
        leadingIcon="solar:share-linear"
        onClick={() => handleShare('EHR')}
        disabled={nothingSelected || sharing || !canShare}
        menuItems={[
          { key: 'EHR', label: 'Share to EHR' },
          { key: 'Patient', label: 'Share to Patient' },
          { key: 'POA', label: 'Share to POA' },
        ]}
        onMenuSelect={(key) => handleShare(key)}
        menuAriaLabel="Share to"
      >
        Share
      </Button>
      <span className={styles.headerDivider} />
    </>
  );

  // A picked custom range reads as its dates in the same field.
  const fmtIso = (iso) => { const [y, m, d] = String(iso).split('-'); return `${m}/${d}/${y}`; };
  const rangeOptions = SHARE_DATE_RANGE_PRESETS.map(o => ({
    value: o.key,
    label: o.label,
    triggerLabel: o.key === 'custom' && shareFilters.dateRange
      ? `${fmtIso(shareFilters.dateRange.start)} - ${fmtIso(shareFilters.dateRange.end)}`
      : undefined,
  }));

  let versionNote = null;
  if (!singleVersion) {
    versionNote = `Printing ${versionParts.map(p => p.label).join(' and ')} back to back. Share sends one version at a time.`;
  } else if (primaryPart.key === 'draft') {
    versionNote = 'Previewing the draft with its unsigned changes. Sign the care plan to share it.';
  } else if (primaryPart.key !== 'signed') {
    versionNote = `Showing version ${primaryPart.versionNumber} from ${versionFmt(primaryPart.createdAt)}. Version ${signedVersion} is the latest.${canShare ? '' : ' Only signed versions can be shared; this one can be downloaded.'}`;
  } else if (draft.hasUnsignedChanges) {
    versionNote = `Showing version ${signedVersion} as signed. Unsigned changes are not included; sign the care plan to share them.`;
  }

  const personalizePane = (
    <CarePlanPrintPersonalize
      settings={printSettings}
      onChange={print.setSettings}
      presets={print.presets}
      presetId={print.presetId}
      onPickPreset={print.pickPreset}
      dirty={print.dirty}
      canEditPreset={print.canEditPreset}
      onSavePreset={print.saveToPreset}
      onSaveAsPreset={print.saveAsPreset}
      onDeletePreset={print.removePreset}
      onMakeDefault={print.makeDefault}
      headerComponents={headerComponents}
      footerComponents={footerComponents}
      clinicLogo={assets.clinicLogo}
    />
  );

  const editorPane = (
    <div className={styles.editorScroll}>
      <div className={styles.stickyTop}>
      <Tabs items={EDITOR_TABS} value={editorTab} onValueChange={setEditorTab} fullWidth={false} />
      {editorTab === 'content' && (
      <div className={styles.filterBar}>
        <div className={styles.filterField}>
          <span className={styles.filterLabel}>Select Version</span>
          <Select
            multiple
            checkboxes
            options={versionOptions}
            value={versionKeysStr.split(',')}
            onValueChange={pickVersions}
            placeholder="Select version"
          />
        </div>
        <div className={styles.filterField}>
          <span className={styles.filterLabel}>Select Date Range</span>
          <div ref={rangeFieldRef}>
            <Select
              options={rangeOptions}
              value={shareFilters.rangePreset || ''}
              onValueChange={(key) => {
                // Custom opens the calendar on this field; the pick lands here.
                if (key === 'custom') { setRangeAnchor(rangeFieldRef.current?.getBoundingClientRect() ?? null); return; }
                setShareFilters(f => ({ ...f, rangePreset: key, dateRange: shareDateRangeFor(key) }));
              }}
              placeholder="Select date range"
            />
          </div>
          <DatePickerPopover
            mode="range"
            open={!!rangeAnchor}
            anchorRect={rangeAnchor}
            value={shareFilters.rangePreset === 'custom' && shareFilters.dateRange ? shareFilters.dateRange : { start: '', end: '' }}
            onChange={(r) => {
              if (!r?.start || !r?.end) return;
              setShareFilters(f => ({ ...f, rangePreset: 'custom', dateRange: r }));
              setRangeAnchor(null);
            }}
            onClose={() => setRangeAnchor(null)}
          />
        </div>
        {filtersActive && (
          <button type="button" className={styles.clearFilters} onClick={clearShareFilters}>
            <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
            Clear all
          </button>
        )}
      </div>
      )}
      </div>

      {editorTab === 'personalize' ? personalizePane : (
      <div className={styles.body}>
        <div className={styles.field}>
          <SectionToggleHead
            title={<>Note <span className={styles.optional}>(optional)</span></>}
            collapsed={collapsed.note}
            onToggle={() => toggleCollapsed('note')}
          />
          {!collapsed.note && (
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note for the recipient"
              rows={2}
            />
          )}
        </div>

        {conditionLabels.length > 0 && (
          <div className={styles.field}>
            <SectionToggleHead
              title="Conditions"
              collapsed={collapsed.conditions}
              onToggle={() => toggleCollapsed('conditions')}
              trailing={shareFilters.conditions?.length > 0 ? (
                <button
                  type="button"
                  className={styles.selectAll}
                  onClick={() => setShareFilter('conditions', [])}
                >
                  Clear filter
                </button>
              ) : null}
            />
            {!collapsed.conditions && (
              <div className={styles.chips}>
                {conditionLabels.map((label) => {
                  const active = shareFilters.conditions?.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={styles.conditionChipBtn}
                      aria-pressed={active}
                      onClick={() => toggleConditionFilter(label)}
                    >
                      <Badge tone={active ? 'primary' : 'neutral'} size="sm" label={label} />
                    </button>
                  );
                })}
              </div>
            )}
            {shareFilters.conditions?.length > 0 && (
              <p className={styles.filterHint}>Showing goals, interventions, and barriers related to selected conditions.</p>
            )}
          </div>
        )}

        <div className={styles.field}>
          <SectionSelectAll label="Goals" ids={filteredGoalIds} off={goalOff} setOff={setGoalOff} collapsed={collapsed.goals} onToggle={() => toggleCollapsed('goals')} />
          {!collapsed.goals && (
          <div className={styles.list}>
            {data.goals.length === 0 && <div className={styles.empty}>No goals on this plan.</div>}
            {data.goals.length > 0 && filteredGoals.length === 0 && (
              <div className={styles.empty}>No goals match the filters.</div>
            )}
            {filteredGoals.map(g => (
              <div key={g.id} className={styles.row}>
                <Checkbox checked={!goalOff.has(g.id)} onCheckedChange={() => setGoalOff(s => toggleOff(s, g.id))} aria-label={`Include ${g.title}`} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{g.title}</span>
                  {g.subtitle && <span className={styles.rowSub}>{g.subtitle}</span>}
                </span>
                {tagsFor('goals', g.id)}
              </div>
            ))}
          </div>
          )}
        </div>

        <div className={styles.field}>
          <SectionSelectAll label="Interventions" ids={filteredIntvIds} off={intvOff} setOff={setIntvOff} collapsed={collapsed.interventions} onToggle={() => toggleCollapsed('interventions')} />
          {!collapsed.interventions && (
          <div className={styles.list}>
            {data.interventions.length === 0 && <div className={styles.empty}>No interventions on this plan.</div>}
            {data.interventions.length > 0 && filteredInterventions.length === 0 && (
              <div className={styles.empty}>No interventions match the filters.</div>
            )}
            {filteredInterventions.map(i => (
              <div key={i.id} className={styles.row}>
                <Checkbox checked={!intvOff.has(i.id)} onCheckedChange={() => setIntvOff(s => toggleOff(s, i.id))} aria-label={`Include ${i.title}`} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{i.title}</span>
                  <span className={styles.rowSub}>{i.assignee?.name}</span>
                </span>
                {tagsFor('interventions', i.id)}
              </div>
            ))}
          </div>
          )}
        </div>

        {(data.barriers || []).length > 0 && (
          <div className={styles.field}>
            <SectionSelectAll label="Barriers" ids={filteredBarrierIds} off={barrierOff} setOff={setBarrierOff} collapsed={collapsed.barriers} onToggle={() => toggleCollapsed('barriers')} />
            {!collapsed.barriers && (
            <div className={styles.list}>
              {filteredBarriers.length === 0 && (
                <div className={styles.empty}>No barriers match the filters.</div>
              )}
              {filteredBarriers.map(b => (
                <div key={b.id} className={styles.row}>
                  <Checkbox checked={!barrierOff.has(b.id)} onCheckedChange={() => setBarrierOff(s => toggleOff(s, b.id))} aria-label={`Include ${b.title}`} />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{b.title}</span>
                  </span>
                  {tagsFor('barriers', b.id)}
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {nothingSelected && (
          <div className={styles.warn}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" />
            Select at least one goal, intervention, or barrier to preview or download.
          </div>
        )}
        {!draft.signed && (
          <div className={styles.warn}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" />
            This care plan has not been signed. Sign it before sharing. The preview shows the draft, which you can still download.
          </div>
        )}
        {signed && versionNote && (
          <div className={styles.warn}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" />
            {versionNote}
          </div>
        )}
      </div>
      )}
    </div>
  );

  const previewPane = (
    <div className={styles.previewPane}>
      <CarePlanPdfPreview
        parts={pdfParts}
        options={pdfOptions}
        nothingSelected={nothingSelected}
        onPageCount={setPageCount}
      />
    </div>
  );

  return (
    <>
      <Drawer
        title="Preview & Share Care Plan"
        onClose={onClose}
        headerRight={headerRight}
        noCloseDivider
        width={1300}
        bodyClassName={SplitDrawerLayout.bodyClassName}
      >
        <SplitDrawerLayout left={previewPane} right={editorPane} />
      </Drawer>
    </>
  );
}
