import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { Drawer } from '../../components/Drawer/Drawer';
import { Badge } from '../../components/Badge/Badge';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { Button } from '../../components/Button/Button';
import { Select } from '../../components/Select/Select';
import { DatePicker } from '../../components/DatePicker/DatePicker';
import { Dropzone } from '../../components/Dropzone/Dropzone';
import { DemoPhiStrip } from '../../components/DemoPhiStrip/DemoPhiStrip';
import { Icon } from '../../components/Icon/Icon';
import { CloseIcon } from '../../components/Icon/CloseIcon';
import { IcdSearch } from '../../components/IcdSearch/IcdSearch';
import { POS_SELECT_OPTIONS, posLabel } from './data/posCodes';
import styles from './HccAddDosDrawer.module.css';

// Fallback provider list for when the platform `profiles` table is empty
// (e.g. local dev without auth). Real options come from taskProfiles.
const PROVIDER_FALLBACK = [
  'Dr. Angela White', 'Dr. Katherine Moss', 'Dr. Marcus Osei', 'Dr. Aisha Mehta',
  'Dr. Indigo Bolen', 'Dr. Sarah Connor', 'Dr. Calvin Reed',
];

const DOC_TYPE_OPTIONS = [
  { value: 'AWV', label: 'AWV Note' },
  { value: 'Progress Note', label: 'Progress Note' },
  { value: 'SOAP Note', label: 'SOAP Note' },
  { value: 'Lab', label: 'Lab' },
  { value: 'Other', label: 'Other' },
];

// MM/DD/YYYY (display / extraction format) ↔ YYYY-MM-DD (native date input).
const toIso = (mdy) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mdy || '');
  return m ? `${m[3]}-${m[1]}-${m[2]}` : '';
};
const fromIso = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
};

// Demo extraction payload — mirrors Figma 4687:127406 so the post-upload
// state looks like the design (real integration would call the OCR
// pipeline and populate these from the model's field-level output).
const DEMO_EXTRACTION = {
  fileName: 'thomas_nguyen_clinicalnote_new.pdf',
  uploadedBy: 'Robert Fox',
  uploadedAt: '08/30/2024',
  dos: '09/12/2025',
  dosConf: 44,
  provider: 'Dr. Angela White',
  providerConf: 95,
  pos: '19',
  posConf: 74,
  docType: '',
  docTypeConf: 15,
  docTypeHint: 'Maybe: AWV Note',
  // Clinically accurate code/description pairs (RA coder workflow plan).
  icds: [
    { code: 'E11.22', desc: 'Type 2 diabetes mellitus with diabetic chronic kidney disease', hcc: 'HCC 37', conf: 95 },
    { code: 'I50.32', desc: 'Chronic diastolic (congestive) heart failure', hcc: 'HCC 224', conf: 74 },
    { code: 'E11.21', desc: 'Type 2 diabetes mellitus with diabetic nephropathy', hcc: 'HCC 37', conf: 44 },
  ],
};

function tier(score) {
  return score >= 85 ? 'high' : score >= 60 ? 'medium' : 'low';
}

// Confidence gauge + citation trigger — the small arc meter + % that sits
// next to each auto-filled field's label. Clicking cites the source doc.
function ConfGauge({ score, onCite }) {
  if (typeof score !== 'number') return null;
  const t = tier(score);
  return (
    <button
      type="button"
      className={[styles.gauge, styles[`gauge_${t}`]].join(' ')}
      onClick={onCite}
      title="View citation in source document"
    >
      <Icon name="solar:gauge-minimalistic-linear" size={12} />
      {score}%
    </button>
  );
}

// Orange "M" chip — shown in place of the AI confidence gauge once the user
// manually sets or overrides a field (Figma Task Drawer, node 6OC).
function ManualBadge() {
  return (
    <span className={styles.manualBadge} title="Manually entered">M</span>
  );
}

function FieldRow({ label, required, confidence, manual, onCite, children, error, hint }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldLabel}>
          {label}{required && <span className={styles.req}>•</span>}
        </span>
        {manual
          ? <ManualBadge />
          : typeof confidence === 'number' && <ConfGauge score={confidence} onCite={onCite} />}
      </div>
      {children}
      {hint && <div className={[styles.hint, error ? styles.hintError : ''].join(' ')}>{hint} <Icon name="solar:info-circle-linear" size={11} /></div>}
    </div>
  );
}

/**
 * Source-document viewer — slides in on the LEFT of the drawer (Figma Task
 * Drawer 5IX): dark PDF-style chrome with a toolbar (filename, page count,
 * zoom, download/print) over a white rendered page. The eye action and the
 * confidence gauges open it; ICD citations highlight the matching line.
 */
function DocViewerPanel({ extracted, highlightCode, onClose }) {
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className={styles.docPanel} role="dialog" aria-label={extracted.fileName}>
      <div className={styles.docToolbar}>
        <Icon name="solar:hamburger-menu-linear" size={16} className={styles.docToolbarMuted} />
        <span className={styles.docToolbarTitle}>{extracted.fileName}</span>
        <span className={styles.docToolbarPage}>
          <span className={styles.docToolbarPageNum}>1</span> / 2
        </span>
        <span className={styles.docToolbarDivider} />
        <button type="button" className={styles.docToolbarBtn} aria-label="Zoom out" onClick={() => setZoom(z => Math.max(50, z - 10))}>
          <Icon name="solar:minus-circle-linear" size={15} />
        </button>
        <span className={styles.docToolbarZoom}>{zoom}%</span>
        <button type="button" className={styles.docToolbarBtn} aria-label="Zoom in" onClick={() => setZoom(z => Math.min(200, z + 10))}>
          <Icon name="solar:add-circle-linear" size={15} />
        </button>
        <span className={styles.docToolbarDivider} />
        <button type="button" className={styles.docToolbarBtn} aria-label="Download">
          <Icon name="solar:download-minimalistic-linear" size={15} />
        </button>
        <button type="button" className={styles.docToolbarBtn} aria-label="Print" onClick={() => window.print()}>
          <Icon name="solar:printer-linear" size={15} />
        </button>
        <button type="button" className={styles.docToolbarBtn} aria-label="Close document" onClick={onClose}>
          <CloseIcon size={16} color="currentColor" />
        </button>
      </div>

      <div className={styles.docScroll}>
        <div className={styles.docPage} style={{ zoom: zoom / 100 }}>
          <div className={styles.sheetOrg}>Fold Health Medical Group</div>
          <div className={styles.sheetOrgSub}>123 Main Street · San Francisco, CA 94102 · (415) 555-0123</div>
          <h1 className={styles.sheetH1}>Clinical Progress Note</h1>
          <div className={styles.sheetMeta}>
            <div><strong>DOS:</strong> {extracted.dos}</div>
            <div><strong>Provider:</strong> {extracted.provider}</div>
            <div><strong>POS:</strong> {posLabel(extracted.pos)}</div>
            <div><strong>Uploaded by:</strong> {extracted.uploadedBy}</div>
          </div>
          <div className={styles.sheetSection}>
            <h2 className={styles.sheetH2}>Assessment &amp; Plan</h2>
            <ul className={styles.sheetIcds}>
              {extracted.icds.map(icd => (
                <li key={icd.code} className={icd.code === highlightCode ? styles.sheetHl : undefined}>
                  <strong>{icd.code}</strong> — {icd.desc} <span className={styles.sheetHcc}>({icd.hcc})</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.sheetFooter}>Electronically signed · {extracted.provider} · {extracted.dos}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * In-flight upload/extract card — matches the Upload-process states in
 * Figma (3D6): file row + `{size} • {status}` with a spinner, a green
 * progress bar, and an X to cancel. Renders in place of the dropzone
 * while the document is being processed, then hands off to the extracted
 * Documents state once complete.
 */
function ProcessingCard({ proc, onCancel }) {
  const statusLabel = proc.phase === 'uploading' ? 'Uploading...' : 'Extracting...';
  return (
    <div className={styles.procCard}>
      <div className={styles.procRow}>
        <span className={styles.procIcon}>
          <Icon name="solar:file-text-linear" size={16} color="var(--neutral-400)" />
        </span>
        <div className={styles.procMeta}>
          <div className={styles.procName}>{proc.name}</div>
          <div className={styles.procSub}>
            <span>{proc.sizeLabel}</span>
            <span>•</span>
            <span className={styles.procStatus}>
              <span className={styles.procSpin}><Icon name="solar:refresh-linear" size={13} /></span>
              {statusLabel}
            </span>
          </div>
        </div>
        <button type="button" className={styles.procCancel} onClick={onCancel} aria-label="Cancel upload">
          <CloseIcon size={16} />
        </button>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${proc.progress}%` }} />
      </div>
    </div>
  );
}

/**
 * One DOS block inside the Add DOS drawer. Empty state = dropzone +
 * blank fields; picking a file runs the upload → extract progress
 * (ProcessingCard), then flips to the extracted state (Documents card +
 * auto-filled fields with confidence gauges + ICD list), matching Figma
 * 4684:127213 / 4687:127406. Manually set/overridden fields swap their
 * gauge for the orange M (manual) chip.
 */
function DosBlock({ block, providerOptions, onChange, onRemove }) {
  const { extracted } = block;
  const [preview, setPreview] = useState(null); // null | { code: string|null }
  const [proc, setProc] = useState(null);
  const cite = (code = null) => setPreview({ code });

  const manual = block.manual || {};
  // Mark a field as manually entered/overridden as the user edits it —
  // its gauge flips to the M chip (only meaningful once extraction ran).
  const setField = (name, value) =>
    onChange({ ...block, [name]: value, manual: { ...manual, [name]: true } });

  const complete = !!(block.dos && block.provider && block.pos && block.docType);

  const onPick = (file) => {
    setProc({
      name: file.name || DEMO_EXTRACTION.fileName,
      sizeLabel: '2.5MB / 30 MB',
      phase: 'uploading',
      progress: 0,
    });
  };

  // Drives the fake upload → extract lifecycle. A real integration would
  // stream progress from the OCR pipeline; here each phase ticks 0→100
  // then extraction hands the parsed fields up via onChange.
  useEffect(() => {
    if (!proc) return undefined;
    if (proc.progress < 100) {
      const step = proc.phase === 'uploading' ? 9 : 7;
      const t = setTimeout(() => setProc(p => (p ? { ...p, progress: Math.min(100, p.progress + step) } : p)), 110);
      return () => clearTimeout(t);
    }
    if (proc.phase === 'uploading') {
      const t = setTimeout(() => setProc(p => (p ? { ...p, phase: 'extracting', progress: 0 } : p)), 350);
      return () => clearTimeout(t);
    }
    // Extraction complete — populate the block and drop the processing card.
    const fileName = proc.name;
    const t = setTimeout(() => {
      setProc(null);
      onChange({
        ...block,
        file: { name: fileName },
        extracted: { ...DEMO_EXTRACTION, fileName },
        dos: DEMO_EXTRACTION.dos,
        provider: DEMO_EXTRACTION.provider,
        pos: DEMO_EXTRACTION.pos,
        docType: DEMO_EXTRACTION.docType,
        icds: DEMO_EXTRACTION.icds,
        manual: {},
      });
    }, 300);
    return () => clearTimeout(t);
  }, [proc]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.dosBlock}>
      <div className={styles.dosBlockHead}>
        <div className={styles.dosBlockTitleGroup}>
          <Icon name="solar:alt-arrow-right-linear" size={16} color="var(--neutral-400)" />
          <span className={styles.dosBlockTitle}>DOS: {block.dos || '-'}</span>
          {complete
            ? <Badge variant="status-ready" icon="solar:check-circle-linear" label="Ready" />
            : <Badge variant="status-review" icon="solar:hourglass-line-linear" label="Not Ready" />}
        </div>
        <button type="button" className={styles.trashBtn} onClick={onRemove} aria-label="Remove DOS">
          <Icon name="solar:trash-bin-trash-linear" size={16} color="var(--neutral-300)" />
        </button>
      </div>

      <div className={styles.dosBlockBody}>
      {proc ? (
        <ProcessingCard proc={proc} onCancel={() => setProc(null)} />
      ) : !extracted ? (
        <>
          <DemoPhiStrip />
          <Dropzone
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            helperText="Supported formats: PDF, DOC, JPG, or PNG"
            secondaryText="Max size: 100 MB"
            icon="solar:upload-minimalistic-linear"
            onPick={onPick}
          />
        </>
      ) : (
        <div className={styles.docsSection}>
          <div className={styles.docsHead}>
            <span className={styles.docsLabel}>Documents</span>
            <button type="button" className={styles.uploadLink}>
              <Icon name="solar:upload-minimalistic-linear" size={13} color="var(--primary-300)" />
              Upload
            </button>
          </div>
          <div className={styles.docCard}>
            <span className={styles.docIcon}><Icon name="solar:document-text-linear" size={16} color="var(--primary-300)" /></span>
            <div className={styles.docMeta}>
              <div className={styles.docName}>{extracted.fileName}</div>
              <div className={styles.docSub}>
                {extracted.uploadedAt} • {extracted.uploadedBy} •{' '}
                <span className={styles.docUploaded}><Icon name="solar:check-circle-bold" size={12} color="var(--status-success)" /> Uploaded 1 min ago</span>
              </div>
            </div>
            <button type="button" className={styles.docAction} aria-label="View" onClick={() => setPreview(p => p ? null : { code: null })}><Icon name="solar:eye-linear" size={15} color="var(--neutral-400)" /></button>
            <button type="button" className={styles.docAction} aria-label="Remove" onClick={() => onChange({ id: block.id })}><Icon name="solar:trash-bin-trash-linear" size={15} color="var(--neutral-400)" /></button>
          </div>
        </div>
      )}

      {preview && extracted && (
        <DocViewerPanel
          extracted={extracted}
          highlightCode={preview.code}
          onClose={() => setPreview(null)}
        />
      )}

      {/* Field grid */}
      <div className={styles.grid}>
        <FieldRow
          label="DOS"
          required
          manual={extracted && manual.dos}
          confidence={extracted ? extracted.dosConf : undefined}
          onCite={() => cite()}
        >
          <DatePicker
            value={toIso(block.dos)}
            onSelect={(iso) => setField('dos', fromIso(iso))}
          />
        </FieldRow>
        <FieldRow
          label="Rendering Provider"
          required
          manual={extracted && manual.provider}
          confidence={extracted ? extracted.providerConf : undefined}
          onCite={() => cite()}
        >
          <Select
            options={providerOptions}
            value={block.provider || ''}
            placeholder="Select Rendering Provider"
            searchable
            searchPlaceholder="Search team members…"
            onChange={(v) => setField('provider', v)}
          />
        </FieldRow>
        <FieldRow
          label="POS"
          required
          manual={extracted && manual.pos}
          confidence={extracted ? extracted.posConf : undefined}
          onCite={() => cite()}
        >
          <Select
            options={POS_SELECT_OPTIONS}
            value={block.pos || ''}
            placeholder="Select Place of Service"
            searchable
            searchPlaceholder="Search POS code or name…"
            onChange={(v) => setField('pos', v)}
          />
        </FieldRow>
        <FieldRow
          label="Document Type"
          required
          manual={extracted && manual.docType}
          confidence={extracted ? extracted.docTypeConf : undefined}
          onCite={() => cite()}
          error={extracted && !block.docType}
          hint={extracted && !block.docType ? extracted.docTypeHint : null}
        >
          <Select options={DOC_TYPE_OPTIONS} value={block.docType || ''} placeholder="Select Document Type" onChange={(v) => setField('docType', v)} variant={extracted && !block.docType ? 'error' : 'default'} />
        </FieldRow>
      </div>

      {/* ICD Codes */}
      <div className={styles.icdSection}>
        <span className={styles.fieldLabel}>ICD Codes<span className={styles.req}>•</span></span>
        <IcdSearch
          placeholder="Search and Add ICD Code & Description, HCC Code & Description"
          excludeCodes={(block.icds || []).map(i => i.code)}
          onSelect={(icd) => onChange({
            ...block,
            icds: [...(block.icds || []), { code: icd.code, desc: icd.title, hcc: icd.hcc || icd.chapter || '', manual: true }],
          })}
        />
        {(block.icds || []).map((icd) => (
          <div key={icd.code} className={styles.icdRow}>
            <span className={styles.icdCode}>{icd.code}</span>
            <div className={styles.icdMain}>
              <div className={styles.icdDesc}>{icd.desc}</div>
              <div className={styles.icdHcc}>{icd.hcc}</div>
            </div>
            {icd.manual && extracted
              ? <ManualBadge />
              : <ConfGauge score={icd.conf} onCite={() => cite(icd.code)} />}
            <button type="button" className={styles.trashBtn} onClick={() => onChange({ ...block, icds: block.icds.filter(i => i.code !== icd.code) })} aria-label={`Remove ${icd.code}`}>
              <Icon name="solar:trash-bin-trash-linear" size={15} color="var(--neutral-300)" />
            </button>
          </div>
        ))}
        {(block.icds || []).length === 0 && (
          <div className={styles.icdEmptyHint}>Add at least one ICD code to save this DOS.</div>
        )}
      </div>
      </div>
    </div>
  );
}

export function HccAddDosDrawer() {
  const member = useAppStore(s => s.hccAddDosMember);
  const close = useAppStore(s => s.closeHccAddDos);
  const showToast = useAppStore(s => s.showToast);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const [blocks, setBlocks] = useState([{ id: 1 }]);

  // Providers = the platform's users (Settings → Users / profiles table).
  useEffect(() => {
    if (member && taskProfiles.length === 0) fetchTaskProfiles?.();
  }, [member]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge in any value already on a block (e.g. the extracted provider) so
  // the Select can always display the current selection.
  const providerOptions = useMemo(() => {
    const names = taskProfiles.length ? taskProfiles.map(p => p.name) : PROVIDER_FALLBACK;
    const set = new Set(names);
    blocks.forEach(b => { if (b.provider) set.add(b.provider); });
    return [...set].map(n => ({ value: n, label: n, searchText: n }));
  }, [taskProfiles, blocks]);

  if (!member) return null;

  // Every mandatory field must be present — including at least one ICD, so a
  // worklist record is never created with a zero ICD count.
  const canSave = blocks.some(b => b.file && b.dos && b.provider && b.pos && b.docType && (b.icds?.length > 0));

  const setBlock = (idx, next) => setBlocks(bs => bs.map((b, i) => i === idx ? next : b));
  // Deleting the only DOS clears it back to a fresh empty block.
  const removeBlock = (idx) => setBlocks(bs => {
    const next = bs.filter((_, i) => i !== idx);
    return next.length ? next : [{ id: Date.now() }];
  });
  const addBlock = () => setBlocks(bs => [...bs, { id: Date.now() }]);

  const doClose = () => { setBlocks([{ id: 1 }]); close(); };
  const doSave = () => {
    showToast?.(`DOS added to ${member.name}'s worklist`);
    doClose();
  };

  const headerRight = (
    <>
      <Button variant="primary" size="S" disabled={!canSave} onClick={doSave}>Save</Button>
      <span className={styles.headerDivider} />
    </>
  );

  return (
    <Drawer
      title="Add DOS"
      onClose={doClose}
      headerRight={headerRight}
      noCloseDivider
      bodyClassName={styles.body}
    >
      <PatientBanner
        initials={member.in}
        name={member.name}
        gender={member.g === 'M' ? 'Male' : member.g === 'F' ? 'Female' : member.g}
        age={member.age || ''}
        dob={member.dob}
        memberId={member.memberId || `#${member.id}`}
        raf={member.raf}
        rafChange={member.rafImpact}
        rafUp={member.ru !== false}
        onCall={() => showToast?.('Call — coming soon')}
      />

      <div className={styles.bodyContainer}>
        {blocks.map((b, i) => (
          <DosBlock
            key={b.id}
            block={b}
            providerOptions={providerOptions}
            onChange={(next) => setBlock(i, next)}
            onRemove={() => removeBlock(i)}
          />
        ))}

        <button type="button" className={styles.addMore} onClick={addBlock}>
          <Icon name="solar:add-square-linear" size={15} color="var(--primary-300)" />
          Add More DOS
        </button>
      </div>
    </Drawer>
  );
}
