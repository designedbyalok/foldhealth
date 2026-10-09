import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { SplitDrawerLayout } from '../../../../../../../../components/Drawer/SplitDrawerLayout';
import { Button } from '../../../../../../../../components/Button/Button';
import { Textarea } from '../../../../../../../../components/Textarea/Textarea';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { FilterChip } from '../../../../../../../../components/FilterChip/FilterChip';
import { Toggle } from '../../../../../../../../components/Toggle/Toggle';
import { TabStrip } from '../../../../../../../../components/TabStrip/TabStrip';
import { withReportHeader, withReportFooter } from '../../../../../../../email-builder/reportHeaderComponent';
import { interFontFaces } from '../../../../../../../email-builder/rasterizeComponent';
import { useComponentImage, loadInter, loadPng } from '../../../../../../../email-builder/reportPrintAssets';
import clinicLogoUrl from '../../../../../../../../assets/trailhead-clinics-logo.png';
import {
  DEFAULT_PRINT_SETTINGS, demographicRows, findPatientRecord, normalizePrintSettings, samePrintSettings,
} from '../../lib/carePlanPrintSettings';
import { CarePlanPrintPersonalize } from './CarePlanPrintPersonalize';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { buildCarePlanDownloadFilename, downloadCarePlanPdf } from '../../lib/carePlanExport';
import {
  SHARE_DATE_OPTIONS,
  SHARE_FILTERS_DEFAULT,
  SHARE_GBI_STATUSES,
  SHARE_PRIORITY_LABELS,
  isShareFiltersActive,
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
const CLINIC_LOGO = { width: 190, height: 150 };

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
  // With unsigned changes, the draft can still be previewed before signing;
  // only the signed version can be shared.
  const [view, setView] = useState('signed');
  const showDraft = !signed || (draft.hasUnsignedChanges && view === 'draft');
  const data = useMemo(() => (!showDraft ? {
    conditions: signedCopy.plan?.conditions || [],
    goals: signedCopy.goals || [],
    interventions: signedCopy.interventions || [],
    barriers: signedCopy.barriers || [],
  } : draftData), [showDraft, signedCopy, draftData]);
  const signedVersion = signedCopy?.signedVersion || draft.latestVersion?.versionNumber || null;
  const canShare = canEdit && signed && !showDraft;
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
    demographics: demographicRows(patientRecord, printSettings.demographics),
    header: printSettings.showHeader ? headerImage || null : null,
    // undefined: the standard footer line; null: none.
    footer: !printSettings.showFooter ? null : (footerComponent ? footerImage || undefined : undefined),
    // A header shows the logo itself, so the page body doesn't repeat it.
    logo: printSettings.showHeader ? null : logo,
  }), [printSettings, carePlanNote, patientRecord, headerImage, footerImage, footerComponent, logo, assets.fonts]);

  const [shareFilters, setShareFilters] = useState(() => ({ ...SHARE_FILTERS_DEFAULT }));
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

  const assigneeOptions = useMemo(
    () => [...new Set((data.interventions || []).map(i => i.assignee?.name).filter(Boolean))],
    [data.interventions],
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

  const handleDownload = () => {
    downloadCarePlanPdf(
      docMeta,
      selection,
      buildCarePlanDownloadFilename({
        patientName,
        programCode: program.code,
        programName: program.name,
      }),
      pdfOptions,
    );
    showToast('Care plan downloaded');
  };

  const handleShare = async (shareTarget = 'EHR') => {
    setSharing(true);
    const rec = await sharePatientCarePlan(patientId, program, {
      target: TARGET_ID[shareTarget],
      format: 'standard',
      note: note.trim(),
      goalIds: selectedGoalIds,
      interventionIds: selectedIntvIds,
      versionNumber: signedVersion,
    });
    setSharing(false);
    if (!rec) return;
    showToast(signedVersion
      ? `Version ${signedVersion} shared to ${shareTarget}`
      : `Care plan shared to ${shareTarget}`);
    onClose();
  };

  const headerRight = (
    <>
      <Button variant="secondary" size="L" leadingIcon="solar:download-minimalistic-linear" onClick={handleDownload} disabled={nothingSelected}>
        Download PDF
      </Button>
      <Button
        variant="primary"
        size="L"
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

  const dateChipSelected = useMemo(() => {
    if (shareFilters.datePreset === 'all') return [];
    const opt = SHARE_DATE_OPTIONS.find(o => o.key === shareFilters.datePreset);
    return opt ? [opt.label] : [];
  }, [shareFilters.datePreset]);

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
      {signed && draft.hasUnsignedChanges && (
        <Toggle
          size="S"
          fullWidth
          className={styles.versionToggle}
          items={[
            { key: 'signed', label: `Version ${signedVersion} (signed)` },
            { key: 'draft', label: 'Draft with unsigned changes' },
          ]}
          active={view}
          onChange={setView}
        />
      )}
      <div className={styles.stickyTop}>
      <TabStrip items={EDITOR_TABS} activeKey={editorTab} onChange={setEditorTab} fullWidth={false} />
      {editorTab === 'content' && (
      <div className={styles.filterBar}>
          <FilterChip
            label="Date"
            options={SHARE_DATE_OPTIONS.map(o => o.label)}
            selected={dateChipSelected}
            singleSelect
            onChange={(next) => {
              const pick = next[0];
              const opt = SHARE_DATE_OPTIONS.find(o => o.label === pick);
              setShareFilter('datePreset', opt?.key || 'all');
            }}
          />
          <FilterChip
            label="Status"
            options={SHARE_GBI_STATUSES}
            selected={shareFilters.status}
            onChange={(v) => setShareFilter('status', v)}
          />
          <FilterChip
            label="Priority"
            options={SHARE_PRIORITY_LABELS}
            selected={shareFilters.priority}
            onChange={(v) => setShareFilter('priority', v)}
          />
          {assigneeOptions.length > 0 && (
            <FilterChip
              label="Assignee"
              options={assigneeOptions}
              selected={shareFilters.assignee}
              searchable
              onChange={(v) => setShareFilter('assignee', v)}
            />
          )}
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
                      <Badge tone={active ? 'primary' : 'grey'} size="S" label={label} />
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
        {signed && draft.hasUnsignedChanges && (
          <div className={styles.warn}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--status-warning)" />
            {showDraft
              ? 'Previewing the draft with its unsigned changes. Sign the care plan to share it.'
              : `Showing version ${signedVersion} as signed. Unsigned changes are not included; sign the care plan to share them.`}
          </div>
        )}
      </div>
      )}
    </div>
  );

  const previewPane = (
    <div className={styles.previewPane}>
      <CarePlanPdfPreview
        docMeta={docMeta}
        selection={selection}
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
