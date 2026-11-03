import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Badge } from '../../../components/Badge/Badge';
import { Alert } from '../../../components/Alert/Alert';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Textarea } from '../../../components/Textarea/Textarea';
import { DatePicker } from '../../../components/DatePicker/DatePicker';
import { Icon } from '../../../components/Icon/Icon';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { ChronicConditionSelect } from '../care-plan-library/shared/ChronicConditionSelect';
import { UnityIcon } from '../../../components/UnityIcon/UnityIcon';
import { TabStrip } from '../../../components/TabStrip/TabStrip';
import { useAppStore } from '../../../store/useAppStore';
import { protocolCounts, protocolStatus } from './lib/protocolSchema';
import { isFoldProtocol } from './lib/foldProtocols';
import { PROTOCOL_SECTIONS, itemComplete } from './lib/protocolSections';
import { ProtocolMigrationDrawer } from './ProtocolMigrationDrawer';
import { CategoryPanel, DocumentPanel, ScopeOverview } from './ProtocolScope';
import { PanelSection, PanelSectionItem } from '../../../components/PanelSection/PanelSection';
import { formatFileSize } from '../../../components/AttachmentCard/formatFileSize';
import { planScopeRequest, planSection } from './lib/protocolPlan';
import styles from './ClinicalProtocols.module.css';

const EDITABLE = new Set(['draft', 'active', 'failed']);
const METADATA_KEYS = ['title', 'organization', 'conditions', 'programCodes', 'effectiveDate', 'reviewDate', 'author', 'version'];
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '');

const draftFrom = p => ({ ...Object.fromEntries(METADATA_KEYS.map(k => [k, p[k]])), protocol: p.protocol || {} });

function ItemEditor({ section, item, onSave, onCancel }) {
  const [value, setValue] = useState(item);
  const set = (key, v) => setValue(cur => ({ ...cur, [key]: v }));
  const complete = itemComplete(section, value);
  return (
    <div className={styles.editor}>
      {section.fields.filter(f => !f.showWhen || f.showWhen(value)).map((f) => {
        if (f.type === 'select') {
          return <Select key={f.key} label={f.label} portal options={f.options} value={value[f.key]} onChange={v => set(f.key, v)} />;
        }
        if (f.type === 'textarea') {
          return (
            <div key={f.key} className={styles.editorFull}>
              <Textarea title={f.label} value={value[f.key] || ''} onChange={v => set(f.key, v)} rows={2} />
            </div>
          );
        }
        return (
          <Input
            key={f.key}
            label={f.label}
            required={f.required}
            type={f.type === 'number' ? 'number' : 'text'}
            value={value[f.key] ?? ''}
            onChange={e => set(f.key, f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
          />
        );
      })}
      <div className={styles.editorActions}>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!complete} onClick={() => onSave(value)}>Done</Button>
      </div>
    </div>
  );
}

function ProtocolItem({ section, item, editable, onChange, onRemove, onOpenPage }) {
  // An item added by hand opens in its editor until the user saves or cancels it.
  const [editChoice, setEditing] = useState(null);
  const editing = editChoice ?? !!item.isNew;
  const [showSource, setShowSource] = useState(false);
  if (editing) {
    return (
      <div className={styles.item}>
        <ItemEditor
          section={section}
          item={item}
          onCancel={() => (item.isNew ? onRemove() : setEditing(false))}
          onSave={(next) => { onChange({ ...next, isNew: undefined }); setEditing(false); }}
        />
      </div>
    );
  }
  const detail = section.detail(item);
  return (
    <div className={styles.item}>
      <div className={styles.itemTop}>
        <div className={styles.itemText}>
          <span className={styles.rowTitle}>{section.title(item)}</span>
          {detail && <span className={styles.itemDetail}>{detail}</span>}
        </div>
        {editable && (
          <span className={styles.itemActions}>
            <ActionButton icon="solar:pen-linear" size="sm" tooltip="Edit" onClick={() => setEditing(true)} />
            <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Remove" onClick={onRemove} />
          </span>
        )}
      </div>
      {item.check && (
        // The parser's doubt about this item, beside it so it is fixed in place.
        <div className={styles.itemCheck}>
          <Icon name="solar:danger-triangle-linear" size={14} color="currentColor" />
          <span className={styles.itemCheckText}>{item.check}</span>
          {editable && (
            <button type="button" className={styles.itemCheckDone} onClick={() => onChange({ ...item, check: null })}>
              Mark Checked
            </button>
          )}
        </div>
      )}
      {item.source && (
        <>
          <button
            type="button"
            className={styles.sourceToggle}
            aria-expanded={showSource}
            onClick={() => {
              // Showing the passage also opens the document beside it, highlighted there.
              if (!showSource && item.page) onOpenPage?.(item.page, item.source);
              setShowSource(v => !v);
            }}
          >
            <Icon name="solar:document-text-linear" size={14} color="currentColor" />
            {showSource ? 'Hide source' : `Source${item.page ? ` · page ${item.page}` : ''}`}
          </button>
          {showSource && <p className={styles.source}>{item.source}</p>}
        </>
      )}
    </div>
  );
}

function ProtocolSection({ section, items, editable, onItemsChange, onOpenPage }) {
  const update = (idx, next) => onItemsChange(items.map((x, i) => (i === idx ? next : x)));
  const remove = idx => onItemsChange(items.filter((_, i) => i !== idx));
  const add = () => onItemsChange([...items, { id: `${section.key}-${crypto.randomUUID().slice(0, 8)}`, ...section.blank(), source: '', page: null, isNew: true }]);
  const toCheck = items.filter(i => i.check).length;
  return (
    <PanelSection
      title={(
        <>
          {section.label}<span className={styles.sectionCount}>{items.length}</span>
          {toCheck > 0 && <Badge tone="warning" size="sm" label={`${toCheck} to check`} className={styles.statusWarning} />}
        </>
      )}
      actions={editable && <ActionButton icon="solar:add-linear" size="sm" tooltip={`Add to ${section.label}`} onClick={add} />}
    >
      {section.about && <p className={styles.sectionAbout}>{section.about}</p>}
      {items.length === 0
        ? <p className={styles.sectionEmpty}>Nothing extracted for this section.</p>
        : items.map((item, idx) => (
          <ProtocolItem
            key={item.id || idx}
            section={section}
            item={item}
            editable={editable}
            onChange={next => update(idx, next)}
            onRemove={() => remove(idx)}
            onOpenPage={onOpenPage}
          />
        ))}
    </PanelSection>
  );
}

/**
 * Review a parsed protocol. A client's protocol opens on its scope: the
 * plain-language plan and its categories on the left (editable, Refresh
 * redrafts), and on the right the goals, interventions and barriers that
 * approval turns into its care plan template. Details and the extracted
 * items (each next to the passage it came from) sit in tabs beside the
 * scope. Save, reject (deletes the upload) or approve (Active), which
 * supersedes the Active protocol with the same title and organization and
 * creates the template. `onApproved(id)` runs after a successful
 * approval. Approving a new version of a protocol then opens the impact
 * analysis for the care plans on earlier versions (ProtocolMigrationDrawer).
 */
export function ProtocolReviewDrawer({ protocolId, onClose, onApproved }) {
  const protocol = useAppStore(s => s.clinicalProtocols.find(p => p.id === protocolId));
  const isSample = useAppStore(s => s.clinicalProtocolsSample);
  // The admin flag comes from the profiles roster, which nothing on the
  // Care Plan Library path loads; without this it stays false for admins.
  const isAdmin = useAppStore(s => s.currentUserIsAdmin);
  const adminKnown = useAppStore(s => s.platformUsersDidFetch);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  const careProgramTypes = useAppStore(s => s.careProgramTypes);
  const fetchCareProgramTypes = useAppStore(s => s.fetchCareProgramTypes);
  const saveClinicalProtocol = useAppStore(s => s.saveClinicalProtocol);
  const approveClinicalProtocol = useAppStore(s => s.approveClinicalProtocol);
  const protocolToSupersede = useAppStore(s => s.protocolToSupersede);
  const setClinicalProtocolStatus = useAppStore(s => s.setClinicalProtocolStatus);
  const reparseClinicalProtocol = useAppStore(s => s.reparseClinicalProtocol);
  const deleteClinicalProtocol = useAppStore(s => s.deleteClinicalProtocol);
  const clinicalProtocolFileUrl = useAppStore(s => s.clinicalProtocolFileUrl);
  const showToast = useAppStore(s => s.showToast);
  useEffect(() => { fetchCareProgramTypes?.(); }, [fetchCareProgramTypes]);
  // Care plan templates drafted from this protocol, any version of it.
  const carePlanTemplates = useAppStore(s => s.carePlanTemplates);
  const fetchCarePlanLibrary = useAppStore(s => s.fetchCarePlanLibrary);
  const setCarePlanTemplateScreen = useAppStore(s => s.setCarePlanTemplateScreen);
  useEffect(() => { if (!carePlanTemplates.length) fetchCarePlanLibrary?.(); }, [carePlanTemplates.length, fetchCarePlanLibrary]);
  // UnityAI drafts a template from an approved client protocol (on approval, or here).
  const draftTemplateFromProtocol = useAppStore(s => s.draftTemplateFromProtocol);
  const draftingTemplate = useAppStore(s => !!s.protocolTemplateDrafting[protocolId]);
  const basedOn = useMemo(() => {
    if (!protocol) return [];
    const key = p => `${(p?.title || '').trim().toLowerCase()}|${(p?.organization || '').trim().toLowerCase()}`;
    return carePlanTemplates.filter(t => t.sourceProtocol && (t.sourceProtocol.id === protocol.id || key(t.sourceProtocol) === key(protocol)));
  }, [carePlanTemplates, protocol]);

  const [draft, setDraft] = useState(() => (protocol ? draftFrom(protocol) : null));
  const [menu, setMenu] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'approve' | 'discard' | 'delete' | 'reject' | 'reparse'
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('scope');
  const [building, setBuilding] = useState(false);
  // The left pane shows one of: a scope section (COMMON or a category id) or
  // the original file ({ page }, page null for its start). Opening one closes the other.
  const [selected, setSelected] = useState(null);
  const [doc, setDoc] = useState(null);
  const [docUrl, setDocUrl] = useState(null);
  const buildProtocolScope = useAppStore(s => s.buildProtocolScope);
  const [migrating, setMigrating] = useState(false);

  // A re-parse or another tab replaces the stored protocol: start from it again.
  const storedKey = protocol ? `${protocol.updatedAt}|${protocol.status}` : '';
  const [loadedKey, setLoadedKey] = useState(storedKey);
  if (protocol && storedKey !== loadedKey && protocol.status !== 'processing') {
    setLoadedKey(storedKey);
    setDraft(draftFrom(protocol));
  }

  const dirty = useMemo(() => !!protocol && !!draft && JSON.stringify(draftFrom(protocol)) !== JSON.stringify(draft), [protocol, draft]);
  const programOptions = useMemo(() => {
    const known = (careProgramTypes || []).map(t => ({ value: t.code, label: `${t.name} (${t.code})` }));
    const extra = (draft?.programCodes || []).filter(c => !known.some(o => o.value === c)).map(c => ({ value: c, label: c }));
    return [...known, ...extra];
  }, [careProgramTypes, draft?.programCodes]);

  if (!protocol || !draft) return null;
  if (migrating) return <ProtocolMigrationDrawer protocolId={protocol.id} onClose={onClose} />;
  const status = protocolStatus(protocol.status);
  // Fold's own protocols are maintained by Fold: read-only here.
  const isFold = isFoldProtocol(protocol);
  // Only admins edit, approve, retire or delete (RLS enforces the same).
  const canManage = !isSample && !isFold && isAdmin;
  const editable = canManage && EDITABLE.has(protocol.status);
  const canDraftTemplate = !isSample && !isFold && protocol.status === 'active';
  const counts = protocolCounts(draft.protocol);
  const supersede = protocol.status === 'draft' ? protocolToSupersede(protocol.id) : null;
  const warnings = protocol.parseMeta?.warnings || [];
  const set = (key, v) => setDraft(cur => ({ ...cur, [key]: v }));
  const setItems = (key, items) => setDraft(cur => ({ ...cur, protocol: { ...cur.protocol, [key]: items } }));
  const pendingNew = PROTOCOL_SECTIONS.some(s => (draft.protocol[s.key] || []).some(i => i.isNew));
  const canSubmit = !busy && !building && draft.title?.trim() && !pendingNew;
  // The scope is a client protocol's plan; Fold's and the samples have none.
  const showScope = !isSample && !isFold;
  const plan = draft.protocol.plan || null;
  const setPlan = next => setDraft(cur => ({ ...cur, protocol: { ...cur.protocol, plan: next } }));
  // Approval creates what the output shows, so it waits for a refresh after edits.
  const canApprove = canSubmit && !plan?.edited;
  // A refresh renumbers categories: the open one closes if it is gone.
  const openSection = !doc && planSection(plan, selected) ? selected : null;
  const selectSection = key => { setDoc(null); setSelected(cur => (cur === key ? null : key)); };
  // `passage` is highlighted on `page` (an item's source).
  const openDocument = async (page = null, passage = '') => {
    setSelected(null);
    setDoc({ page, passage });
    if (!docUrl) setDocUrl(await clinicalProtocolFileUrl(protocol.id));
  };
  const fileMeta = [
    (protocol.sourceKind || '').toUpperCase(),
    protocol.sourceSize ? formatFileSize(protocol.sourceSize) : null,
    protocol.parseMeta?.pages ? `${protocol.parseMeta.pages} pages` : null,
    protocol.uploadedBy ? `Uploaded by ${protocol.uploadedBy}` : null,
  ].filter(Boolean).join(' · ');
  // Who may act, who approved, what an approval replaces: quiet lines in
  // Details. Parser flags mark the Extracted Items tab instead.
  const metaLines = [
    adminKnown && !isAdmin && 'View only: an admin edits and approves protocols.',
    supersede && `Approving replaces the active version${supersede.version ? ` ${supersede.version}` : ''}.`,
    protocol.status === 'active' && protocol.approvedBy && `Approved by ${protocol.approvedBy} on ${fmtDate(protocol.approvedAt)}.`,
    protocol.status === 'superseded' && 'A newer version replaced this protocol; it is kept for reference.',
  ].filter(Boolean);
  const buildScope = async (edited) => {
    setBuilding(true);
    try {
      const next = await buildProtocolScope(protocol.id, draft, edited);
      if (next) setPlan(next);
    } finally {
      setBuilding(false);
    }
  };

  const close = () => (dirty ? setConfirm('discard') : onClose());
  const save = async () => {
    setBusy(true);
    try {
      if (await saveClinicalProtocol(protocol.id, draft)) showToast?.('Protocol saved');
    } finally {
      setBusy(false);
    }
  };
  const approve = async () => {
    setConfirm(null);
    setBusy(true);
    try {
      if (await approveClinicalProtocol(protocol.id, draft, { supersede })) {
        showToast?.(supersede ? `Approved; replaces version ${supersede.version || 'on file'}` : 'Protocol approved and active');
        onApproved?.(protocol.id);
        if (supersede) setMigrating(true);
        else onClose();
      }
    } finally {
      setBusy(false);
    }
  };
  const openOriginal = async () => {
    const url = await clinicalProtocolFileUrl(protocol.id);
    if (url) window.open(url, '_blank', 'noopener');
    else showToast?.('The original file is not available');
  };

  const menuItems = [
    ...(showScope && editable && protocol.status === 'draft' ? [{ key: 'reject', icon: 'solar:close-circle-linear', label: 'Reject Upload', danger: true }] : []),
    ...(protocol.sourcePath ? [{ key: 'original', icon: 'solar:file-download-linear', label: 'Open Original File' }] : []),
    ...(editable && protocol.sourceKind !== 'json' ? [{ key: 'reparse', icon: 'solar:refresh-linear', label: 'Parse Again' }] : []),
    ...(protocol.status === 'active' && protocol.supersedesId && canManage ? [{ key: 'migrate', icon: 'solar:transfer-horizontal-linear', label: 'Migrate Care Plans' }] : []),
    ...(protocol.status === 'active' && canManage ? [{ key: 'retire', icon: 'solar:archive-linear', label: 'Retire' }] : []),
    ...(canManage && !(showScope && protocol.status === 'draft') ? [{ key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true }] : []),
  ];

  const alertsEl = (
    <>
      {isSample && <Alert tone="info" message="Sample protocol. Run supabase/clinical_protocols_migration.sql to upload and review your own." />}
      {isFold && <Alert tone="info" message="Fold protocol, built from the published guidelines listed below and kept current by Fold. It can't be edited; to follow different rules, upload your organization's protocol." />}
      {!isSample && !isFold && adminKnown && !isAdmin && <Alert tone="info" message="Only an admin can edit, approve, retire or delete protocols." />}
      {protocol.status === 'failed' && <Alert tone="error" message={protocol.parseError || 'This file could not be parsed.'} />}
      {protocol.status === 'processing' && <Alert tone="info" message="Parsing this document. Its items appear here when it finishes." />}
      {protocol.status === 'draft' && (
        <Alert
          tone="warning"
          message={showScope
            ? 'Check the scope and its care plan output against the document before approving. Nothing is created until it is approved.'
            : 'Check every item against its source passage before approving. Nothing in this protocol is used until it is approved.'}
        />
      )}
      {protocol.status === 'active' && protocol.approvedBy && !isFold && (
        <Alert tone="success" message={`Approved by ${protocol.approvedBy} on ${fmtDate(protocol.approvedAt)}.`} />
      )}
      {protocol.status === 'superseded' && <Alert tone="info" message="A newer version replaced this protocol. It is kept for reference." />}
      {supersede && (
        <Alert tone="info" message={`Approving replaces the active version${supersede.version ? ` ${supersede.version}` : ''} of this protocol.`} />
      )}
    </>
  );
  const detailFields = (
    <div className={styles.fieldGrid}>
      <div className={styles.fieldFull}>
        <Input label="Title" required value={draft.title || ''} disabled={!editable} onChange={e => set('title', e.target.value)} maxLength={200} />
      </div>
      <Input label="Organization" value={draft.organization || ''} disabled={!editable} onChange={e => set('organization', e.target.value)} placeholder="Harbor Health" />
      <Input label="Version" value={draft.version || ''} disabled={!editable} onChange={e => set('version', e.target.value)} placeholder="2.1" />
      <div className={styles.fieldFull}>
        {editable
          ? <ChronicConditionSelect label="Conditions" value={draft.conditions || []} onChange={v => set('conditions', v)} />
          : (
            <div className={styles.nameCell}>
              <span className={styles.label}>Conditions</span>
              <span className={styles.chips}>{(draft.conditions || []).map(c => <Badge key={c} size="sm" label={c} />)}</span>
            </div>
          )}
      </div>
      <div className={styles.fieldFull}>
        <Select
          label="Programs"
          portal
          multiple
          checkboxes
          disabled={!editable}
          options={programOptions}
          value={draft.programCodes || []}
          onChange={v => set('programCodes', v)}
          placeholder="Programs this protocol applies to"
        />
      </div>
      <DatePicker label="Effective date" value={draft.effectiveDate || ''} disabled={!editable} onSelect={v => set('effectiveDate', v || null)} />
      <DatePicker label="Next review" value={draft.reviewDate || ''} min={draft.effectiveDate || undefined} disabled={!editable} onSelect={v => set('reviewDate', v || null)} />
      <div className={styles.fieldFull}>
        <Input label="Author" value={draft.author || ''} disabled={!editable} onChange={e => set('author', e.target.value)} placeholder="Person or committee" />
      </div>
    </div>
  );
  // Fold's and sample protocols keep the Details card; the scope view's Details tab is the fields alone.
  const detailsEl = (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>Details</h3>
      {detailFields}
    </div>
  );
  const templatesEl = (
    (basedOn.length > 0 || canDraftTemplate) && (
      <div className={styles.card}>
        <div className={styles.cardHeadRow}>
          <h3 className={styles.cardTitle}>Care Plan Templates from This Protocol</h3>
          {canDraftTemplate && (
            <Button
              variant="outline"
              size="sm"
              leadingIconElement={<UnityIcon size={14} color="currentColor" />}
              disabled={draftingTemplate}
              onClick={() => draftTemplateFromProtocol(protocol.id)}
            >
              {draftingTemplate ? 'Drafting…' : 'Draft Care Plan Template'}
            </Button>
          )}
        </div>
        {draftingTemplate && (
          <p className={styles.hint}>UnityAI is drafting a template from this protocol: Common goals plus categories by its thresholds, from your library. It is saved as a draft for review.</p>
        )}
        {!basedOn.length && !draftingTemplate && (
          <p className={styles.hint}>No template yet. UnityAI can draft one from this protocol, with categories by its thresholds, as a draft for review.</p>
        )}
        <div className={styles.templateList}>
          {basedOn.map(t => (
            <div key={t.id} className={styles.templateRow}>
              <button
                type="button"
                className={styles.nameLink}
                onClick={() => { onClose(); setCarePlanTemplateScreen({ mode: 'edit', template: t }); }}
              >
                {t.name}
              </button>
              <span className={styles.chips}>
                <Badge tone={t.status === 'draft' ? 'neutral' : 'success'} size="sm" label={t.status === 'draft' ? 'Draft' : 'Published'} />
                {t.sourceProtocol.version && t.sourceProtocol.version !== protocol.version
                  ? <Badge tone="warning" size="sm" label={`From v${t.sourceProtocol.version}, now v${protocol.version || '?'}`} />
                  : t.sourceProtocol.version && <Badge size="sm" label={`v${t.sourceProtocol.version}`} />}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  );
  const warningsEl = (
    warnings.length > 0 && (
      <Alert tone="warning" message={(
        <>
          <strong>The parser flagged {warnings.length === 1 ? 'one thing' : `${warnings.length} things`} to check</strong>
          <ul className={styles.warnings}>{warnings.map(w => <li key={w}>{w}</li>)}</ul>
        </>
      )}
      />
    )
  );
  const itemChecks = PROTOCOL_SECTIONS.reduce((n, s) => n + (draft.protocol[s.key] || []).filter(i => i.check).length, 0);
  // A sentence clipped by an older parse ends in an ellipsis rather than mid-word.
  const asSentence = w => (/[.!?)"”]$/.test(w.trim()) ? w.trim() : `${w.trim()}…`);
  // Flags about the document as a whole; a flag about one item sits on that item.
  const flagsSection = warnings.length > 0 && (
    <PanelSection title={<>About the Whole Document<span className={styles.sectionCount}>{warnings.length}</span></>}>
      <p className={styles.sectionAbout}>What the parser flagged that belongs to no single item below.</p>
      <ol className={styles.flagList}>
        {warnings.map((w, i) => (
          <li key={w} className={styles.flagRow}>
            <span className={styles.flagNumber}>{i + 1}</span>
            <span>{asSentence(w)}</span>
          </li>
        ))}
      </ol>
    </PanelSection>
  );
  // The uploaded file, shown or hidden in the left pane like an HCC chart.
  const fileSection = protocol.sourcePath && (
    <PanelSection title="Original File">
      <p className={styles.sectionAbout}>The uploaded document. Open any item&apos;s Source to see its passage highlighted here.</p>
      <PanelSectionItem
        leading={<span className={styles.fileThumb}><Icon name="custom:pdf-file" size={20} color="var(--neutral-400)" /></span>}
        title={<button type="button" className={styles.fileName} onClick={() => openDocument(null)}>{protocol.sourceName || 'Original file'}</button>}
        meta={fileMeta}
        trailing={(
          <ActionButton
            icon={doc ? 'solar:eye-closed-linear' : 'solar:eye-linear'}
            size="sm"
            tooltip={doc ? 'Hide preview' : 'Show preview'}
            tooltipLeft
            active={!!doc}
            onClick={() => (doc ? setDoc(null) : openDocument(null))}
          />
        )}
      />
    </PanelSection>
  );
  const itemsEl = (
    <>
      {protocol.status !== 'processing' && PROTOCOL_SECTIONS.map(section => (
        <ProtocolSection
          key={section.key}
          section={section}
          items={draft.protocol[section.key] || []}
          editable={editable}
          onItemsChange={items => setItems(section.key, items)}
          onOpenPage={showScope && protocol.sourcePath ? openDocument : undefined}
        />
      ))}
      {counts.total === 0 && protocol.status === 'draft' && (
        <p className={styles.hint}>No items were extracted. Add them by hand, or parse the document again.</p>
      )}
    </>
  );

  return (
    <Drawer
      title={protocol.title}
      onClose={close}
      width={showScope && (openSection || doc) ? 'min(1280px, calc(100vw - 16px))' : undefined}
      bodyClassName={showScope ? styles.splitBody : undefined}
      noCloseDivider
      headerRight={(
        <>
          {!showScope && <Badge tone={status.tone} size="sm" label={status.label} className={status.tone === 'warning' ? styles.statusWarning : undefined} />}
          {!showScope && (menuItems.length > 0 || editable) && <span className={styles.headerDivider} />}
          {menuItems.length > 0 && (
            <ActionButton icon="solar:menu-dots-linear" tooltip="More" onClick={e => setMenu(e.currentTarget.getBoundingClientRect())} />
          )}
          {editable && protocol.status !== 'draft' && (
            <Button variant="outline" disabled={!dirty || !canSubmit} onClick={save}>Save</Button>
          )}
          {editable && protocol.status === 'draft' && (
            <>
              {!showScope && <Button variant="outline" tone="danger" disabled={busy} onClick={() => setConfirm('reject')}>Reject</Button>}
              <Button variant="outline" disabled={!dirty || !canSubmit} onClick={save}>Save Draft</Button>
              <Button leadingIcon="solar:shield-check-linear" disabled={!canApprove} onClick={() => setConfirm('approve')}>Approve</Button>
            </>
          )}
          <span className={styles.headerDivider} />
        </>
      )}
    >
      {showScope ? (
        <div className={styles.split}>
          {doc && (
            <DocumentPanel
              name={protocol.sourceName}
              url={docUrl}
              kind={protocol.sourceKind}
              page={doc.page}
              passage={doc.passage}
              onOpenNewTab={openOriginal}
              onClose={() => setDoc(null)}
            />
          )}
          {openSection && (
            <CategoryPanel
              plan={plan}
              sectionKey={openSection}
              editable={editable && protocol.status === 'draft'}
              onChange={setPlan}
              onClose={() => setSelected(null)}
            />
          )}
          <div className={styles.rightPane}>
            <TabStrip
              fullWidth={false}
              activeKey={tab}
              onChange={setTab}
              items={[
                { key: 'scope', label: 'Scope' },
                { key: 'details', label: 'Details' },
                { key: 'items', label: 'Extracted Items', count: counts.total, notif: warnings.length > 0 || itemChecks > 0 },
              ]}
              trailing={<Badge tone={status.tone} size="sm" label={status.label} className={status.tone === 'warning' ? styles.statusWarning : undefined} />}
            />
            <div className={styles.paneScroll}>
              {protocol.status === 'failed' && <Alert tone="error" message={protocol.parseError || 'This file could not be parsed.'} />}
              {tab === 'scope' && (protocol.status === 'processing'
                ? <p className={styles.hint}>Parsing this document and building its scope. It appears here when it finishes.</p>
                : (
                  <ScopeOverview
                    plan={plan}
                    protocol={draft.protocol}
                    editable={editable && protocol.status === 'draft'}
                    building={building}
                    selected={openSection}
                    onSelect={selectSection}
                    onChange={setPlan}
                    onRefresh={() => buildScope(planScopeRequest(plan))}
                    onBuild={() => buildScope(null)}
                  />
                ))}
              {tab === 'details' && (
                <>
                  {metaLines.length > 0 && <ul className={styles.metaLines}>{metaLines.map(l => <li key={l}>{l}</li>)}</ul>}
                  {detailFields}
                  {templatesEl}
                </>
              )}
              {tab === 'items' && (
                <div className={styles.panelStack}>
                  {fileSection}
                  {flagsSection}
                  {itemsEl}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.drawerBody}>
          {alertsEl}
          {detailsEl}
        {(draft.protocol.summary || draft.protocol.scope) && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Scope</h3>
            {draft.protocol.summary && <p className={styles.summary}>{draft.protocol.summary}</p>}
            {(draft.protocol.scope?.conditions || []).length > 0 && (
              <span className={styles.chips}>
                {draft.protocol.scope.conditions.map(c => <Badge key={c.name} size="sm" label={c.code ? `${c.name} · ${c.code}` : c.name} />)}
              </span>
            )}
            {draft.protocol.scope?.population && <p className={styles.summary}><span className={styles.label}>Population </span>{draft.protocol.scope.population}</p>}
            {(draft.protocol.scope?.exclusions || []).length > 0 && (
              <div>
                <span className={styles.label}>Exclusions</span>
                <ul className={styles.scopeList}>{draft.protocol.scope.exclusions.map(x => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
          </div>
        )}
          {templatesEl}
          {warningsEl}
          {itemsEl}
        </div>
      )}

      {menu && (
        <MenuPopover
          anchorRect={menu}
          align="right"
          ariaLabel="Protocol actions"
          items={menuItems}
          onSelect={(key) => {
            setMenu(null);
            if (key === 'original') openOriginal();
            else if (key === 'reparse') setConfirm('reparse');
            else if (key === 'migrate') setMigrating(true);
            else if (key === 'retire') setClinicalProtocolStatus(protocol.id, 'retired').then(ok => ok && showToast?.('Protocol retired'));
            else if (key === 'delete') setConfirm('delete');
            else if (key === 'reject') setConfirm('reject');
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {confirm === 'approve' && (
        <ConfirmDialog
          variant="warning"
          title={supersede ? 'Approve and replace the active version?' : 'Approve this protocol?'}
          description={supersede
            ? `It becomes the active ${draft.title}. The current active version${supersede.version ? ` (${supersede.version})` : ''} is marked superseded and kept for reference.`
            : `It becomes active with ${counts.total} items${plan ? ', and its scope is created as a draft care plan template' : ''}. Confirm you have checked them against the source document.`}
          confirmLabel="Approve"
          onCancel={() => setConfirm(null)}
          onConfirm={approve}
        />
      )}
      {confirm === 'discard' && (
        <ConfirmDialog
          variant="warning"
          title="Close without saving?"
          description="Your changes to this protocol haven't been saved."
          confirmLabel="Discard Changes"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); onClose(); }}
        />
      )}
      {confirm === 'reparse' && (
        <ConfirmDialog
          variant="warning"
          title="Parse the document again?"
          description="The extracted items are replaced with a fresh parse and the protocol goes back to Needs Review. Edits you made to items are lost."
          confirmLabel="Parse Again"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            if (await reparseClinicalProtocol(protocol.id)) showToast?.('Parsed again; ready for review');
          }}
        />
      )}
      {confirm === 'reject' && (
        <ConfirmDialog
          variant="destructive"
          title={`Reject ${protocol.title}?`}
          description="The upload, its original file and its scope are removed. No care plan template was created from it."
          confirmLabel="Reject"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            if (await deleteClinicalProtocol(protocol.id)) {
              showToast?.('Protocol rejected and removed');
              onClose();
            }
          }}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          variant="destructive"
          title={`Delete ${protocol.title}?`}
          description="The protocol and its original file are removed. This can't be undone."
          confirmLabel="Delete"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            if (await deleteClinicalProtocol(protocol.id)) {
              showToast?.('Protocol deleted');
              onClose();
            }
          }}
        />
      )}
    </Drawer>
  );
}
