import { useCallback, useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../components/Drawer/Drawer';
import { SplitDrawerLayout } from '../../../../../../../components/Drawer/SplitDrawerLayout';
import { Button } from '../../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { TabStrip } from '../../../../../../../components/TabStrip/TabStrip';
import { PdfPreview } from '../../../../../../../components/PdfPreview/PdfPreview';
import { PreviewLoader } from '../../../../../../../components/PreviewLoader/PreviewLoader';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { downloadBlob, printBlob } from '../../../../../../../lib/blobActions';
import { withReportHeader, withReportFooter, defaultReportComponent } from '../../../../../../email-builder/reportHeaderComponent';
import { interFontFaces } from '../../../../../../email-builder/rasterizeComponent';
import { useComponentImage, loadPng, loadInter } from '../../../../../../email-builder/reportPrintAssets';
import { loadReportFont } from '../../../../../../analytics/views/employer/reportFonts';
import { PRESET_COVERS, loadCoverImage } from '../../../../../../analytics/views/employer/reportCovers';
import { COVER_GRADIENTS, generatedOnLabel, isLightBackground } from '../../../../../../analytics/views/employer/generateEmployerReportPdf';
import clinicLogoUrl from '../../../../../../../assets/trailhead-clinics-logo.png';
import clinicLogoWhiteUrl from '../../../../../../../assets/trailhead-clinics-logo-white.png';
import { findPatientRecord } from '../../care-plan/lib/carePlanPrintSettings';
import { CARE_GAP_SECTIONS_EXTENDED } from '../../../../../data/careGapsMock';
import { REFERRAL_REVIEW_MOCK } from '../../../../../data/referralReviewMock';
import { getOpenIcdsForMember } from '../../../../../../hcc/data/icds';
import { buildProgramReport, resolveRange, OVERVIEW_KEY, stepKind } from './programReportModel';
import { generateProgramReport } from './generateProgramReport';
import {
  COVER_DESCRIPTION_MAX, DEFAULT_FOOTER_SLUG, DEFAULT_HEADER_SLUG, loadReportSettings, reportTitleFor, saveReportSettings,
} from './programReportSettings';
import { ProgramReportSteps } from './ProgramReportSteps';
import { ProgramReportPersonalize } from './ProgramReportPersonalize';
import styles from './ProgramReportDrawer.module.css';

const EDITOR_TABS = [
  { key: 'steps', label: 'Program Steps' },
  { key: 'personalize', label: 'Personalize' },
];
const CLINIC_SIZE = { width: 170, height: 150, format: 'PNG' };
// How long the first preview waits for the fonts and logos before building without them.
const ASSET_WAIT_MS = 3000;
const EMPTY = [];

/**
 * Download Report for a care program: a live PDF preview on the left; on the
 * right, the date range and the steps to include (Program Steps), and the
 * cover, title, logo, header and footer (Personalize). Modelled on the
 * Employer Impact Report's print drawer.
 *
 * @param {object}   props
 * @param {object}   props.program   – the enrollment as it is now
 * @param {object[]} props.stepList  – the program's steps (sections with children), each with its derived status
 * @param {object}   props.stepCtx   – the step view's records: manual statuses, care plan, tasks, documents, appointments
 * @param {number}   props.progress  – program progress, 0–100
 * @param {object[]} props.activity  – this program's activity log entries
 * @param {object[]} props.letters
 * @param {function} [props.onExport] – ('pdf' | 'print') after an export
 */
export function ProgramReportDrawer({ program, stepList, stepCtx, progress, activity, letters, onExport, onClose }) {
  const patientId = useAppStore(s => s.selectedPatientId);
  // Read once per patient: the record is assembled from several worklist slices.
  const patient = useMemo(() => findPatientRecord(useAppStore.getState(), patientId), [patientId]);
  const medications = useAppStore(s => s.patientMedications[patientId]) || EMPTY;
  const fetchPatientMedications = useAppStore(s => s.fetchPatientMedications);
  const billing = useAppStore(s => s.ccmBillableActivitiesByPatient?.[patientId]) || EMPTY;
  const fetchCcmBilling = useAppStore(s => s.fetchCcmBilling);
  const addedAppointments = useAppStore(s => s.programAddedAppointments[program.code]) || EMPTY;
  useEffect(() => {
    if (!patientId) return;
    fetchPatientMedications?.(patientId);
    if (program.code === 'CCM') fetchCcmBilling?.(patientId);
  }, [patientId, program.code, fetchPatientMedications, fetchCcmBilling]);

  const [editorTab, setEditorTab] = useState('steps');

  // ── Program Steps: date range and the steps switched on ──
  const flatSteps = useMemo(() => stepList.flatMap(s => (s.type === 'section'
    ? s.children.map(c => ({ ...c, section: s.name }))
    : [s])), [stepList]);
  const [enabled, setEnabled] = useState(() => new Set([OVERVIEW_KEY, ...flatSteps.map(s => s.id)]));
  const toggle = key => setEnabled((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleMany = (keys, on) => setEnabled((prev) => {
    const next = new Set(prev);
    keys.forEach(k => (on ? next.add(k) : next.delete(k)));
    return next;
  });
  const [rangePreset, setRangePreset] = useState('enrollment');
  const [customRange, setCustomRange] = useState([]);
  const range = useMemo(
    () => resolveRange(rangePreset, { custom: customRange, enrolledOn: program.startDate }),
    [rangePreset, customRange, program.startDate],
  );

  // ── Personalize ──
  const [settings, setSettings] = useState(() => loadReportSettings(program.code));
  useEffect(() => {
    const t = window.setTimeout(() => saveReportSettings(program.code, settings), 400);
    return () => window.clearTimeout(t);
  }, [settings, program.code]);
  const defaultTitle = reportTitleFor(program);
  const reportTitle = settings.title.trim() || defaultTitle;
  const [addedCovers, setAddedCovers] = useState([]);

  // Fonts and the clinic logo for the PDF.
  const [assets, setAssets] = useState({});
  const [generatedAt] = useState(() => new Date());
  useEffect(() => {
    let live = true;
    Promise.all([loadPng(clinicLogoUrl, 510, 450), loadPng(clinicLogoWhiteUrl, 510, 450), loadInter()])
      .then(([clinicLogo, clinicLogoWhite, fonts]) => { if (live) setAssets({ clinicLogo, clinicLogoWhite, fonts }); });
    return () => { live = false; };
  }, []);
  const [coverFonts, setCoverFonts] = useState({});
  useEffect(() => {
    let live = true;
    [settings.titleStyle.family, settings.introStyle.family].forEach((family) => {
      if (coverFonts[family] !== undefined) return;
      loadReportFont(family).then((files) => { if (live && files) setCoverFonts(prev => ({ ...prev, [family]: files })); });
    });
    return () => { live = false; };
  }, [settings.titleStyle.family, settings.introStyle.family, coverFonts]);

  // The cover image as jsPDF needs it; until it loads the cover shows the default gradient.
  const coverSrc = settings.bgType !== 'image' ? null
    : addedCovers.find(c => c.id === settings.bgCover)?.dataUrl || PRESET_COVERS.find(c => c.id === settings.bgCover)?.src || PRESET_COVERS[0].src;
  const [bgImage, setBgImage] = useState(null);
  useEffect(() => {
    let live = true;
    if (!coverSrc) return undefined;
    loadCoverImage(coverSrc).then((img) => { if (live) setBgImage(img); });
    return () => { live = false; };
  }, [coverSrc]);
  const background = useMemo(() => {
    const custom = settings.customGradients.find(g => g.id === settings.bgGradient);
    if (settings.bgType === 'color') return { type: 'color', color: settings.bgColor };
    if (settings.bgType === 'image' && bgImage) return { type: 'image', ...bgImage };
    if (settings.bgType === 'gradient' && custom) return { type: 'gradient', css: custom.css };
    const preset = COVER_GRADIENTS.some(g => g.key === settings.bgGradient) ? settings.bgGradient : COVER_GRADIENTS[0].key;
    return { type: 'gradient', gradient: settings.bgType === 'gradient' ? preset : COVER_GRADIENTS[0].key };
  }, [settings, bgImage]);
  const lightCover = isLightBackground(background);
  // The clinic logo, unless one was uploaded; white on a dark cover.
  const { clinicLogo, logo, coverLogo } = useMemo(() => {
    const clinic = assets.clinicLogo ? { ...CLINIC_SIZE, ...assets.clinicLogo } : null;
    const onCover = assets.clinicLogo ? { ...CLINIC_SIZE, ...(lightCover ? assets.clinicLogo : assets.clinicLogoWhite) } : null;
    return {
      clinicLogo: clinic,
      logo: settings.customLogo || clinic,
      coverLogo: settings.customLogo || onCover,
    };
  }, [assets, lightCover, settings.customLogo]);

  // Header and footer: Report Header / Report Footer components, drawn on every page.
  const savedHeaders = useAppStore(s => s.customReportHeaderPresets);
  const savedFooters = useAppStore(s => s.customReportFooterPresets);
  const fetchCustomPresets = useAppStore(s => s.fetchCustomPresets);
  useEffect(() => { fetchCustomPresets?.(); }, [fetchCustomPresets]);
  const headerComponents = useMemo(() => withReportHeader(savedHeaders || EMPTY), [savedHeaders]);
  const footerComponents = useMemo(() => withReportFooter(savedFooters || EMPTY), [savedFooters]);
  const headerComponent = headerComponents.find(h => String(h.id) === String(settings.headerId))
    || defaultReportComponent(headerComponents, DEFAULT_HEADER_SLUG);
  const footerComponent = footerComponents.find(f => String(f.id) === String(settings.footerId))
    || defaultReportComponent(footerComponents, DEFAULT_FOOTER_SLUG);
  const fontFaces = useMemo(() => interFontFaces(assets.fonts), [assets.fonts]);
  const [pageCount, setPageCount] = useState(0);
  const componentCtx = useMemo(() => ({
    reportTitle,
    generatedOn: generatedOnLabel(generatedAt).replace(/^Generated On\s*:\s*/, ''),
    employerLogo: logo?.dataUrl || '',
    pageCount,
  }), [reportTitle, generatedAt, logo, pageCount]);
  const { image: headerImage, settled: headerSettled } = useComponentImage(headerComponent, componentCtx, fontFaces, settings.showHeader && !!assets.fonts);
  const { image: footerImage, settled: footerSettled } = useComponentImage(footerComponent, componentCtx, fontFaces, settings.showFooter && !!assets.fonts);
  const [assetWaitOver, setAssetWaitOver] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setAssetWaitOver(true), ASSET_WAIT_MS);
    return () => window.clearTimeout(t);
  }, []);
  const previewReady = ('fonts' in assets || assetWaitOver) && headerSettled && footerSettled;

  // ── The report ──
  const wantsDiagnosisGaps = flatSteps.some(s => enabled.has(s.id) && stepKind(s) === 'diagnosisGaps');
  const model = useMemo(() => buildProgramReport({
    program: { ...program, progress },
    patient: patient || { name: '' },
    steps: flatSteps,
    manual: stepCtx.manual,
    range,
    enabled,
    progress,
    data: {
      activity,
      carePlan: stepCtx.carePlan,
      tasks: stepCtx.tasks,
      documents: stepCtx.documents,
      appointments: [...stepCtx.appointments, ...addedAppointments],
      medications,
      letters,
      careGaps: CARE_GAP_SECTIONS_EXTENDED,
      referrals: REFERRAL_REVIEW_MOCK,
      diagnosisGaps: wantsDiagnosisGaps && patient?.name ? getOpenIcdsForMember(patient.name).all : [],
      billing,
    },
  }), [program, progress, patient, flatSteps, stepCtx, range, enabled, activity, addedAppointments, medications, letters, wantsDiagnosisGaps, billing]);
  const nothingSelected = model.sections.length === 0;

  const report = useMemo(() => ({
    title: reportTitle,
    generatedAt,
    model,
    header: settings.showHeader ? headerImage || undefined : null,
    footer: settings.showFooter ? footerImage || undefined : null,
    fonts: assets.fonts,
    coverFonts,
    cover: settings.includeCover ? {
      range: range.label,
      description: settings.coverDescription.slice(0, COVER_DESCRIPTION_MAX).trim(),
      background,
      logo: coverLogo,
      clientLogo: null,
      logoScale: settings.logoScale,
      logoAlign: settings.logoAlign,
      titleStyle: settings.titleStyle,
      introStyle: settings.introStyle,
    } : null,
  }), [reportTitle, generatedAt, model, settings, headerImage, footerImage, assets.fonts, coverFonts, range.label, background, coverLogo]);
  const generate = useCallback(() => {
    const out = generateProgramReport(report);
    // Called from the preview's timer and from Download / Print, never during render.
    setPageCount(out.numberedPages);
    return out;
  }, [report]);

  // Where the preview opens after the next redraw: the part last touched.
  const [focus, setFocus] = useState(null);
  const focusOn = key => setFocus(prev => (prev?.key === key ? prev : { key, n: (prev?.n || 0) + 1 }));

  const filename = `${program.code}-summary-report-${(patient?.name || 'patient').replace(/[^a-z0-9]+/gi, '-')}`.replace(/-+$/, '');
  const headerRight = (
    <>
      <Button
        leadingIcon="solar:download-minimalistic-linear"
        disabled={nothingSelected}
        onClick={() => { downloadBlob(generate().blob, `${filename}.pdf`); onExport?.('pdf'); }}
      >
        Download PDF
      </Button>
      <span className={styles.headerDivider} aria-hidden="true" />
      <ActionButton
        icon="solar:printer-minimalistic-linear"
        tooltip="Print"
        tooltipBelow
        aria-label="Print report"
        disabled={nothingSelected}
        onClick={() => { printBlob(generate().blob); onExport?.('print'); }}
      />
      <span className={styles.headerDivider} aria-hidden="true" />
    </>
  );

  const editor = (
    <div className={styles.editorScroll}>
      <div className={styles.tabBar}>
        <TabStrip items={EDITOR_TABS} activeKey={editorTab} onChange={setEditorTab} fullWidth={false} />
      </div>
      <div className={styles.body}>
        {editorTab === 'steps' ? (
          <ProgramReportSteps
            steps={stepList}
            enabled={enabled}
            onToggle={(key) => { toggle(key); focusOn(key); }}
            onToggleMany={toggleMany}
            rangePreset={rangePreset}
            onRangePreset={setRangePreset}
            customRange={customRange}
            onCustomRange={setCustomRange}
            rangeLabel={range.label}
            onFocus={focusOn}
          />
        ) : (
          <ProgramReportPersonalize
            settings={settings}
            onChange={setSettings}
            defaultTitle={defaultTitle}
            clinicLogo={clinicLogo}
            addedCovers={addedCovers}
            onAddCover={cover => setAddedCovers(list => [cover, ...list])}
            onRemoveCover={id => setAddedCovers(list => list.filter(c => c.id !== id))}
            headerComponents={headerComponents}
            footerComponents={footerComponents}
            headerId={headerComponent?.id}
            footerId={footerComponent?.id}
            onFocusCover={() => focusOn('cover')}
          />
        )}
      </div>
    </div>
  );

  const preview = (
    <div className={styles.previewPane}>
      <PdfPreview
        generate={generate}
        focus={focus}
        loader={<PreviewLoader />}
        ready={previewReady}
        empty={nothingSelected}
        emptyLabel="Switch on at least one step to preview the report."
        title={`${reportTitle} PDF preview`}
      />
    </div>
  );

  return (
    <Drawer
      title="Download Program Report"
      onClose={onClose}
      headerRight={headerRight}
      noCloseDivider
      width="min(1280px, calc(100vw - 16px))"
      bodyClassName={SplitDrawerLayout.bodyClassName}
    >
      <SplitDrawerLayout left={preview} right={editor} />
    </Drawer>
  );
}
