import { useState, useRef, useCallback, Fragment } from 'react';
import { renderEmailHtml } from './patchEmailHtml';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Toggle } from '../../components/Toggle/Toggle';
import { Input } from '../../components/Input/Input';
import { Textarea } from '../../components/Textarea/Textarea';
import { Select as SharedSelect } from '../../components/Select/Select';
import { makeInitialDocument } from './initialDocument';
import { HEADER_PRESETS, FOOTER_PRESETS } from './headerFooterLibrary';
import { PresetLivePreview } from './PresetLivePreview';
import { extractSubtree, fingerprintTree } from './blockHelpers';
import { GOOGLE_FONTS, injectGoogleFonts, availableWeights, normalizeWeight } from './googleFonts';
import { ColorPicker } from './ColorPicker';
import { ColorInput } from './ColorInput';
import { parseHtmlToDocument, collectUnknownFonts } from './htmlToDocument';
import { DesignTab, ColumnDesignTab, BulkDesignTab } from './PropertiesPanelDesignTab';
import { CodeTab } from './PropertiesPanelCodeTab';
import { SectionHeading, SectionSubHeading } from './PropertiesPanelFields';
import styles from './EmailBuilder.module.css';

// Inject the Google Fonts stylesheet once so the canvas + inline previews
// render with the actual web fonts. Safe to call repeatedly.
injectGoogleFonts();

const MIN_WIDTH = 280;
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 320;


// Pulled from the curated Google Fonts catalogue. Each entry stores the
// Google font name directly so the value renders the same way in builder,
// preview, and the exported email <link rel="stylesheet">.

// Fallback used until the selected fontFamily is known. The real options
// come from availableWeights(fontFamily) at render time so each family
// surfaces only the weights it ships with on Google Fonts.

const TEMPLATE_PRESETS = [
  { id: 'welcome',  label: 'Welcome',          accent: '#7C5CFA' },
  { id: 'reminder', label: 'Care Reminder',    accent: '#22C55E' },
  { id: 'followup', label: 'Visit Follow-up',  accent: '#F59E0B' },
  { id: 'survey',   label: 'Patient Survey',   accent: '#EC4899' },
];

const TABS = [
  { id: 'design',   icon: 'solar:settings-linear',     label: 'Design' },
  { id: 'code',     icon: 'solar:code-square-linear',  label: 'Code' },
  { id: 'template', icon: 'solar:palette-linear',      label: 'Template' },
];


export function PropertiesPanel() {
  const [tab, setTab] = useState('design');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const doc = useAppStore(s => s.emailDocument);
  const id = useAppStore(s => s.selectedBlockId);
  const selectedColumnIdx = useAppStore(s => s.selectedColumnIdx);
  const updateBlock = useAppStore(s => s.updateBlock);
  const bulkIds = useAppStore(s => s.bulkSelectedIds);
  const setHtmlPreviewOverride = useAppStore(s => s.setHtmlPreviewOverride);

  const block = doc?.[id];
  const isBulk = bulkIds.length > 0;
  const isColumnSelected = selectedColumnIdx !== null && block?.type === 'ColumnsContainer';

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!dragging.current) return;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - ev.clientX));
      setWidth(next);
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div className={styles.rightPanel} style={{ width }}>
      <div className={styles.dragHandle} onMouseDown={handleMouseDown} aria-label="Resize panel">
        <div className={styles.dragHandleLine} />
      </div>

      <div className={styles.rightTabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={[styles.rightTab, tab === t.id ? styles.rightTabActive : ''].join(' ')}
            onClick={() => setTab(t.id)}
            title={t.label}
            aria-label={t.label}
          >
            <Icon name={t.icon} size={16} color="currentColor" />
            <span className={styles.rightTabLabel}>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'design' && (isBulk
        ? <BulkDesignTab doc={doc} bulkIds={bulkIds} updateBlock={updateBlock} />
        : isColumnSelected
          ? <ColumnDesignTab block={block} updateBlock={updateBlock} id={id} columnIdx={selectedColumnIdx} />
          : <DesignTab block={block} updateBlock={updateBlock} id={id} />
      )}
      {tab === 'code' && <CodeTab doc={doc} />}
      {tab === 'template' && <TemplateTab block={block} />}
    </div>
  );
}
function TemplateTab({ block }) {
  const editingCampaignName = useAppStore(s => s.editingCampaignName);
  const replaceHeaderFooter = useAppStore(s => s.replaceHeaderFooter);
  const customHeaderPresets = useAppStore(s => s.customHeaderPresets);
  const customFooterPresets = useAppStore(s => s.customFooterPresets);
  const saveCurrentAsPreset = useAppStore(s => s.saveCurrentAsPreset);
  const deleteCustomPreset = useAppStore(s => s.deleteCustomPreset);
  const updateCustomPreset = useAppStore(s => s.updateCustomPreset);
  const applyCustomPreset = useAppStore(s => s.applyCustomPreset);
  const setDocument = useAppStore.setState;
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [presetQuery, setPresetQuery] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameName, setRenameName] = useState('');
  const [renameDesc, setRenameDesc] = useState('');

  const role = block?.data?.role;
  const isHeaderOrFooter = role === 'header' || role === 'footer';

  const applyPreset = (preset) => {
    const fresh = makeInitialDocument({ name: editingCampaignName || preset.label });
    fresh.root.data.backdropColor = preset.accent + '22';
    fresh['header-text'].data.style.color = preset.accent;
    setDocument({ emailDocument: fresh, selectedBlockId: 'root' });
  };

  const applyRolePreset = (preset) => {
    if (preset.isUserPreset) {
      applyCustomPreset(role, preset);
      return;
    }
    let counter = Date.now();
    const genId = () => `block-${counter++}-${Math.random().toString(36).slice(2, 5)}`;
    const tree = preset.build(genId, editingCampaignName || undefined);
    replaceHeaderFooter(role, tree);
  };

  const handleSave = async () => {
    setSaving(true);
    let result;
    try {
      result = await saveCurrentAsPreset(role, { name: saveName, description: saveDesc });
    } finally {
      setSaving(false);
    }
    if (result) {
      setSaveOpen(false);
      setSaveName('');
      setSaveDesc('');
    }
  };

  if (isHeaderOrFooter) {
    const builtIn = role === 'header' ? HEADER_PRESETS : FOOTER_PRESETS;
    const userPresets = role === 'header' ? customHeaderPresets : customFooterPresets;
    const label = role === 'header' ? 'Header' : 'Footer';

    // Detect whether the currently-selected header/footer matches an existing
    // built-in or user preset byte-for-byte. If it does, hiding the Save
    // button avoids creating duplicate library entries. Read `doc` via the
    // *prop* (`block`) so this recomputes whenever the doc mutates — using
    // useAppStore.getState() here would skip re-runs since it doesn't sub.
    let currentFingerprint = '';
    if (block?.data?.role === role) {
      const doc = useAppStore.getState().emailDocument;
      const rootChildren = doc?.root?.data?.childrenIds || [];
      const rootId = rootChildren.find(id => doc[id]?.data?.role === role);
      if (rootId) currentFingerprint = fingerprintTree(extractSubtree(doc, rootId));
    }
    const knownFingerprints = new Set();
    builtIn.forEach(p => {
      let n = 0;
      const tree = p.build(() => `fp-${p.id}-${++n}`, editingCampaignName || 'Welcome');
      knownFingerprints.add(fingerprintTree(tree));
    });
    userPresets.forEach(p => {
      if (p.tree) knownFingerprints.add(fingerprintTree(p.tree));
    });
    const canSavePreset = !!currentFingerprint && !knownFingerprints.has(currentFingerprint);

    const matches = (p) => {
      if (!presetQuery.trim()) return true;
      const q = presetQuery.trim().toLowerCase();
      return (p.label || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    };
    const filteredUser = userPresets.filter(matches);
    const filteredBuiltIn = builtIn.filter(matches);

    const startRename = (p) => {
      setRenamingId(p.id);
      setRenameName(p.label || '');
      setRenameDesc(p.description || '');
    };
    const commitRename = (p) => {
      updateCustomPreset(p.id, role, { name: renameName, description: renameDesc });
      setRenamingId(null);
    };

    return (
      <div className={styles.templateScroll}>
        <SectionHeading>{`Change ${label}`}</SectionHeading>

        {/* Save current as preset — only when the current header/footer
            differs from every known preset. Avoids creating duplicates. */}
        {canSavePreset && (
        <div className={styles.presetSaveBar}>
          {!saveOpen ? (
            <button
              type="button"
              className={styles.presetSaveBtn}
              onClick={() => { setSaveOpen(true); setSaveName(''); setSaveDesc(''); }}
            >
              <Icon name="solar:bookmark-linear" size={14} color="currentColor" />
              Save current {label.toLowerCase()} as preset
            </button>
          ) : (
            <div className={styles.presetSaveForm}>
              <input
                autoFocus
                className={styles.presetSaveInput}
                placeholder={`${label} name (e.g. Brand banner)`}
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaveOpen(false); }}
                maxLength={60}
              />
              <input
                className={styles.presetSaveInput}
                placeholder="Short description (optional)"
                value={saveDesc}
                onChange={e => setSaveDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaveOpen(false); }}
                maxLength={120}
              />
              <div className={styles.presetSaveActions}>
                <button type="button" className={styles.presetSaveCancel} onClick={() => setSaveOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.presetSavePrimary}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Search across both saved + built-in presets, using the shared
            <Input> so the field matches the rest of the app. */}
        <div className={styles.presetSearchBar}>
          <Input
            placeholder={`Search ${label.toLowerCase()}s…`}
            value={presetQuery}
            onChange={(e) => setPresetQuery(e.target.value)}
          />
        </div>

        <div className={styles.presetCardList}>
          {filteredUser.length > 0 && (
            <>
              <SectionSubHeading>Your presets</SectionSubHeading>
              {filteredUser.map(p => (
                <TemplatePresetCard
                  key={`u-${p.id}`}
                  preset={p}
                  isRenaming={renamingId === p.id}
                  draftName={renameName}
                  draftDesc={renameDesc}
                  onDraftName={setRenameName}
                  onDraftDesc={setRenameDesc}
                  onCommitRename={() => commitRename(p)}
                  onCancelRename={() => setRenamingId(null)}
                  onApply={() => applyRolePreset(p)}
                  onEdit={() => startRename(p)}
                  onDelete={() => { if (window.confirm(`Delete preset "${p.label}"?`)) deleteCustomPreset(p.id, role); }}
                />
              ))}
            </>
          )}
          {filteredBuiltIn.length > 0 && (
            <>
              {filteredUser.length > 0 && <SectionSubHeading>Built-in</SectionSubHeading>}
              {filteredBuiltIn.map(p => (
                <TemplatePresetCard key={p.id} preset={p} onApply={() => applyRolePreset(p)} />
              ))}
            </>
          )}
          {filteredUser.length === 0 && filteredBuiltIn.length === 0 && (
            <div className={styles.presetPickerEmpty}>No {label.toLowerCase()}s match "{presetQuery}"</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.templateScroll}>
      <SectionHeading>Templates</SectionHeading>
      <div className={styles.templateGrid}>
        {TEMPLATE_PRESETS.map(p => (
          <button key={p.id} className={styles.templateTile} onClick={() => applyPreset(p)}>
            <div className={styles.templateThumb} style={{ background: p.accent + '22', borderColor: p.accent + '44' }}>
              <div className={styles.templateThumbBar} style={{ background: p.accent }} />
            </div>
            <div className={styles.templateLabel}>{p.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Section primitives ──────────────────────────────────────────────────────
// ── Column width ratio bar ──────────────────────────────────────────────────


// Header/footer preset card — live preview + meta. User presets show edit /
// delete actions on hover; built-in presets are apply-only. Shares the same
// CSS classes as the ComponentsPanel PresetCard so the picker and the right-
// panel list stay visually identical.
function TemplatePresetCard({
  preset,
  isRenaming = false,
  draftName,
  draftDesc,
  onDraftName,
  onDraftDesc,
  onCommitRename,
  onCancelRename,
  onApply,
  onEdit,
  onDelete,
}) {
  const isUser = !!preset.isUserPreset;
  return (
    <div className={styles.presetCardWrap}>
      <button
        type="button"
        className={styles.presetCard}
        onClick={isRenaming ? undefined : onApply}
        disabled={isRenaming}
      >
        <PresetLivePreview preset={preset} />
        {!isRenaming && (
          <div className={styles.presetCardMeta}>
            <div className={styles.presetCardTitle}>{preset.label}</div>
            {preset.description && (
              <div className={styles.presetCardDesc}>{preset.description}</div>
            )}
          </div>
        )}
      </button>
      {isRenaming && (
        <div className={styles.presetCardEditForm}>
          <input
            autoFocus
            className={styles.presetCardEditInput}
            placeholder="Name"
            value={draftName}
            onChange={(e) => onDraftName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onCancelRename(); }}
            maxLength={60}
          />
          <input
            className={styles.presetCardEditInput}
            placeholder="Description (optional)"
            value={draftDesc}
            onChange={(e) => onDraftDesc(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onCancelRename(); }}
            maxLength={120}
          />
          <div className={styles.presetCardEditActions}>
            <button type="button" className={styles.presetCardEditCancel} onClick={onCancelRename}>Cancel</button>
            <button type="button" className={styles.presetCardEditSave} onClick={onCommitRename}>Save</button>
          </div>
        </div>
      )}
      {isUser && !isRenaming && (
        <div className={styles.presetCardActions}>
          <button
            type="button"
            className={styles.presetCardActionBtn}
            title="Rename"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Icon name="solar:pen-2-linear" size={12} color="currentColor" />
          </button>
          <button
            type="button"
            className={[styles.presetCardActionBtn, styles.presetCardActionDanger].join(' ')}
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Icon name="solar:trash-bin-minimalistic-linear" size={12} color="currentColor" />
          </button>
        </div>
      )}
    </div>
  );
}


// ── Image uploader ──────────────────────────────────────────────────────────

// ── Color Variables (global) ────────────────────────────────────────────────


// Line height with px/% unit toggle. Storage stays backward-compatible:
// number = unitless multiplier (legacy %), string like "18px" = explicit px.


// ── Field primitives ────────────────────────────────────────────────────────

// Thin wrappers around the shared Input/Select primitives so the rest of
// PropertiesPanel keeps its label-above-control field-col layout but stops
// reimplementing the chrome. Single source of truth for visual style now
// lives in src/components/{Input,Select}.


// ── Social / NavBar editors ────────────────────────────────────────────────


// Quick-style chips at the top of the Content section. Tapping one applies a
// preset of typography settings (fontSize + fontWeight, and for Headings the
// `level` too). The matching chip highlights if the current style is already
// at that preset.

// Strip inline HTML for plain-text display in the right-panel Text
// textarea. The DOM parses the markup and `innerText` gives us the
// visible characters with `<br>` honoured as newlines. Empty / non-string
// inputs short-circuit so we don't hit jsdom in tests.


// Link input — inline collapsible row. Shows a "+ Add link" affordance when
// no link is set, expands to an Input that captures the href and a checkbox
// to toggle target="_blank" (defaults to true to match prior behaviour).

// Padding control — three modes:
//  • uniform:   one value for all four sides (1 input)
//  • symmetric: top/bottom + left/right (2 inputs)
//  • per-side:  four independent values (4 inputs)
// The mode auto-detects from current values so something else editing
// padding can't strand the UI in the wrong mode.

// Border control — uses the same +/− toggle pattern as LinkInput so the
// builder UI is consistent. Collapsed when no border values are set;
// expanding applies sensible defaults.

// ── Independent decoration toggles — bold/italic/underline/strike can combine ─
// The leading "none" button is a one-click clear that turns every decoration
// off in a single tap (matches the Figma reference).

// ── Inline icons (precise to match Figma) ──────────────────────────────────

// Uniform / Symmetric (vertical bars) / Per-side mode icons. Symmetric is a
// square with two vertical guides hinting at independent top/bottom only.

// PadAllSidesIcon — used as the input-field icon when padding is in
// uniform mode. Two concentric squares clearly read as "padding on all
// sides" and avoid clashing with RadiusIcon (rounded-corner glyph).

// Symmetric input icons — vertical & horizontal axes.


// Vertical-align icons for the fixed-height container Position toggle.
// Top: heavy bar at the top, two shorter rows below. Middle: shorter
// rows above and below a heavy bar. Bottom: heavy bar at the bottom.


// Three icons for the list-style toggle on Text blocks.