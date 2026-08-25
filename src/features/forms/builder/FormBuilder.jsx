/**
 * Full-screen form builder. Three modes via the header segmented control:
 *   • Edit Form — palette (drag) → canvas (drop/reorder) → properties
 *   • Score     — define scores + bands over the scorable fields
 *   • Preview   — fill the form for real, with live scoring
 *
 * The working copy (name / fields / scoring) lives in local state; Save pushes
 * it to Supabase via store.saveForm. Opened/closed through editingFormId.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, useDraggable, useDroppable, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Switch } from '../../../components/Switch/Switch';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Toggle } from '../../../components/Toggle/Toggle';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { useAppStore } from '../../../store/useAppStore';
import { PALETTE_TABS, paletteFor } from './componentCatalog';
import { instantiateInstrument } from './validatedInstruments';
import {
  CONSENT_CATEGORY_OPTIONS,
  reorderConsentItems,
  syncConsentQuestions,
} from './memberConsent';
import { formShareLink, copyToClipboard } from '../formLink';
import { FieldInput } from './FieldInput';
import { ScorePanel } from './ScorePanel';
import { LogicPanel } from './LogicPanel';
import { PreviewPanel } from './PreviewPanel';
import { FormAnalyticsPanel } from '../analytics/FormAnalyticsPanel';
import { FormSettings } from './FormSettings';

const DEFAULT_SETTINGS = {
  layout: 'entire-page', fontFamily: 'Inter', background: 'var(--neutral-0)',
  header: { enabled: false }, footer: { enabled: false },
  start: { enabled: true, title: '', description: '', buttonLabel: 'Start' },
  end: { enabled: true, title: 'Thank you!', description: 'Your response has been recorded.' },
};
import styles from './FormBuilder.module.css';

// ── linkId generation + tree helpers (pure) ────────────────────────────────
let _uid = 0;
const uid = () => `q${(_uid++).toString(36)}${Math.abs(Date.now() % 100000).toString(36)}`;

function assignIds(field) {
  const next = { ...field, linkId: uid() };
  if (Array.isArray(field.items)) next.items = field.items.map(assignIds);
  if (Array.isArray(field.options)) next.options = field.options.map((o) => ({ ...o }));
  return next;
}
function findField(items, id) {
  for (const it of items) {
    if (it.linkId === id) return it;
    if (it.items) { const hit = findField(it.items, id); if (hit) return hit; }
  }
  return null;
}
function updateField(items, id, patch) {
  return items.map((it) => {
    if (it.linkId === id) return { ...it, ...patch };
    if (it.items) return { ...it, items: updateField(it.items, id, patch) };
    return it;
  });
}
function removeField(items, id) {
  const out = [];
  for (const it of items) {
    if (it.linkId === id) continue;
    out.push(it.items ? { ...it, items: removeField(it.items, id) } : it);
  }
  return out;
}

// ── Palette ─────────────────────────────────────────────────────────────────
function PaletteCard({ entry, onInsert }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${entry.key}`, data: { entry },
  });
  return (
    <div
      ref={setNodeRef}
      className={styles.palItem}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      title={`Drag or double-click to add ${entry.label}`}
      onDoubleClick={() => onInsert(entry)}
      {...listeners}
      {...attributes}
    >
      <span className={styles.palIconAvatar}>
        <Icon name={entry.icon} size={20} color="var(--primary-300)" />
      </span>
      <span className={styles.palLabel}>{entry.label}</span>
      {entry.validated ? (
        <span className={styles.validatedBadge} title="Validated, locked instrument">
          <Icon name="solar:verified-check-linear" size={12} color="var(--status-success)" />
        </span>
      ) : null}
      <span className={styles.dragDots} aria-hidden><DotsGrid /></span>
    </div>
  );
}

function DotsGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {[3, 7, 11].map((y) => [4, 10].map((x) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="var(--neutral-200)" />
      )))}
    </svg>
  );
}

function Palette({ tab, setTab, search, setSearch, custom, onInsert }) {
  const list = paletteFor(tab, custom).filter((e) =>
    e.label.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <aside className={styles.palette}>
      <div className={styles.palTabs}>
        {PALETTE_TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.palTab} ${tab === t.key ? styles.palTabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.palSearch}>
        <Icon name="solar:magnifer-linear" size={15} color="var(--neutral-300)" />
        <input aria-label="Search fields"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className={styles.palList}>
        {list.length === 0 ? (
          <div className={styles.palEmpty}>
            {tab === 'custom' ? 'Mark a field “reusable” to save it here.' : 'No components match.'}
          </div>
        ) : (
          list.map((entry) => <PaletteCard key={entry.key} entry={entry} onInsert={onInsert} />)
        )}
      </div>
    </aside>
  );
}

// ── Canvas ────────────────────────────────────────────────────────────────
function QuestionBlock({ field, selectedId, onSelect }) {
  // A group renders its title + nested fields (each selectable); a leaf renders
  // its label + inert input preview.
  if (field.type === 'group') {
    const isMemberConsent = field.healthKey === 'memberConsent';
    return (
      <div className={styles.groupBlock}>
        <div className={styles.groupTitle}>{field.text}</div>
        {field.description ? <div className={styles.qDesc}>{field.description}</div> : null}
        <div className={styles.groupFields}>
          {(field.items || []).map((sub) => (
            <div
              key={sub.linkId}
              role="button"
              tabIndex={0}
              className={[
                styles.subField,
                isMemberConsent ? styles.consentCanvasItem : '',
                !isMemberConsent && selectedId === sub.linkId ? styles.subFieldSel : '',
              ].filter(Boolean).join(' ')}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(isMemberConsent ? field.linkId : sub.linkId);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                onSelect(isMemberConsent ? field.linkId : sub.linkId);
              }}
            >
              {sub.type !== 'display' && (
                <span className={styles.qLabel}>
                  {sub.text}{sub.required && <span className={styles.req}>*</span>}
                </span>
              )}
              {sub.description ? <span className={styles.qDesc}>{sub.description}</span> : null}
              <FieldInput field={sub} interactive={false} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <>
      {field.type !== 'display' && (
        <span className={styles.qLabel}>
          {field.text}{field.required && <span className={styles.req}>*</span>}
        </span>
      )}
      {field.description ? <span className={styles.qDesc}>{field.description}</span> : null}
      <FieldInput field={field} interactive={false} />
    </>
  );
}

function SortableCard({ field, selectedId, onSelect, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.linkId });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const selected = selectedId === field.linkId;
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-form-card
      className={`${styles.card} ${selected ? styles.cardSelected : ''}`}
      onClick={() => onSelect(field.linkId)}
    >
      <button className={styles.cardDrag} {...listeners} {...attributes} aria-label="Drag to reorder">
        <DotsGrid />
      </button>
      <div className={styles.cardBody}>
        <QuestionBlock field={field} selectedId={selectedId} onSelect={onSelect} />
      </div>
      <button
        className={styles.cardDelete}
        onClick={(e) => { e.stopPropagation(); onDelete(field.linkId); }}
        aria-label="Delete"
      >
        <Icon name="solar:trash-bin-trash-linear" size={15} color="var(--status-error)" />
      </button>
    </div>
  );
}

function Canvas({ fields, selectedId, onSelect, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-drop' });
  // Clicking anywhere on the canvas that isn't a field card deselects, which
  // surfaces the global Form Settings in the Properties column.
  const handleBackgroundClick = (e) => {
    if (!e.target.closest('[data-form-card]')) onSelect(null);
  };
  return (
    <div className={styles.canvasWrap} onClick={handleBackgroundClick}>
      <div ref={setNodeRef} className={`${styles.sheet} ${isOver ? styles.sheetOver : ''}`}>
        {fields.length === 0 ? (
          <div className={styles.canvasEmpty}>
            <Icon name="solar:document-add-linear" size={36} color="var(--neutral-150)" />
            <p>Drag components here to build your form</p>
          </div>
        ) : (
          <SortableContext items={fields.map((f) => f.linkId)} strategy={verticalListSortingStrategy}>
            {fields.map((f) => (
              <SortableCard
                key={f.linkId}
                field={f}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

// ── Properties ──────────────────────────────────────────────────────────────
function CheckRow({ label, checked, onChange }) {
  return (
    <label className={styles.propCheck}>
      <Checkbox checked={!!checked} onCheckedChange={(c) => onChange(!!c)} />
      <span>{label}</span>
    </label>
  );
}

function ConsentRow({ item, fieldLinkId, onToggleIncluded, onPatchItem, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `consent:${item.id}`,
    data: { consentFieldId: fieldLinkId, category: item.category },
  });
  const [editing, setEditing] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.consentItemBlock} ${item.included ? '' : styles.consentRowOff}`}
    >
      <div className={styles.consentRow}>
        <button
          className={styles.consentRowDrag}
          {...listeners}
          {...attributes}
          aria-label={`Reorder ${item.name}`}
        >
          <DotsGrid />
        </button>
        <Checkbox
          checked={!!item.included}
          onCheckedChange={(checked) => onToggleIncluded(item, !!checked)}
          aria-label={`Show ${item.name} on this form`}
        />
        <span className={styles.consentRowName} title={item.name}>{item.name}</span>
        {item.custom && (
          <ActionButton
            icon="solar:trash-bin-trash-linear"
            size="S"
            tooltip="Remove"
            tooltipLeft
            onClick={() => onRemove(item)}
          />
        )}
        <ActionButton
          icon="solar:pen-linear"
          size="S"
          tooltip={editing ? 'Hide description' : 'Edit description'}
          tooltipLeft
          active={editing}
          onClick={() => setEditing((v) => !v)}
        />
      </div>
      {editing && (
        <div className={styles.consentAgreement}>
          <Textarea
            className={styles.ctl}
            rows={4}
            placeholder="Describe what the member is consenting to"
            value={item.agreement || ''}
            aria-label={`${item.name} consent description`}
            onChange={(e) => onPatchItem(item.id, { agreement: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

function ConsentProperties({ field, onPatch }) {
  const uid = useId();
  const consentItems = field.consentItems || [];
  const showDecline = !!field.showDecline;

  const commitItems = (nextItems) => {
    onPatch({
      consentItems: nextItems,
      items: syncConsentQuestions(field.items, nextItems, assignIds, showDecline),
    });
  };

  const patchItem = (id, patch) => {
    commitItems(consentItems.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    )));
  };

  const toggleIncluded = (item, included) => {
    patchItem(item.id, { included });
  };

  // Global toggle: regenerate every question with/without its "I decline"
  // option in one write. Off by default; the author opts in.
  const setShowDecline = (next) => {
    onPatch({
      showDecline: next,
      items: syncConsentQuestions(field.items, consentItems, assignIds, next),
    });
  };

  return (
    <aside className={styles.props}>
      <div className={styles.propsHeader}>Member Consent</div>
      <div className={styles.propsBody}>
        <label className={styles.propLabel} htmlFor={`${uid}-label`}>Label</label>
        <Input
          id={`${uid}-label`}
          className={styles.ctl}
          value={field.text || ''}
          onChange={(e) => onPatch({ text: e.target.value })}
        />

        <CheckRow
          label="Is this field required?"
          checked={field.required}
          onChange={(required) => onPatch({ required })}
        />
        <CheckRow
          label="Make this component reusable"
          checked={field.reusable}
          onChange={(reusable) => onPatch({ reusable })}
        />
        <CheckRow
          label="Share with patient"
          checked={field.shareWithPatient}
          onChange={(shareWithPatient) => onPatch({ shareWithPatient })}
        />

        <label className={styles.propLabel} htmlFor={`${uid}-description`}>Description</label>
        <Textarea
          id={`${uid}-description`}
          className={styles.ctl}
          rows={3}
          placeholder="Add description"
          value={field.description || ''}
          onChange={(e) => onPatch({ description: e.target.value })}
        />

        <div className={styles.consentToggleRow}>
          <span className={styles.consentToggleLabel}>Show decline option</span>
          <Switch
            checked={showDecline}
            ariaLabel="Show a decline option on every consent item"
            onChange={setShowDecline}
          />
        </div>

        <div className={styles.consentDivider} />
        <div className={styles.consentSectionHead}>
          <span className={styles.consentSectionTitle}>Consent items on this form</span>
          <span className={styles.propHint}>
            Pick the items to show, then edit each description to match what the
            member is agreeing to.
          </span>
        </div>

        {CONSENT_CATEGORY_OPTIONS.map(({ value, label }) => {
          const rows = consentItems.filter((item) => item.category === value);
          if (!rows.length) return null;
          const shown = rows.filter((item) => item.included).length;
          return (
            <div key={value} className={styles.consentGroup}>
              <div className={styles.consentGroupHead}>
                <span className={styles.consentGroupTitle}>{label}</span>
                <span className={styles.consentGroupCount}>{shown}/{rows.length}</span>
              </div>
              <SortableContext
                items={rows.map((item) => `consent:${item.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {rows.map((item) => (
                  <ConsentRow
                    key={item.id}
                    item={item}
                    fieldLinkId={field.linkId}
                    onToggleIncluded={toggleIncluded}
                    onPatchItem={patchItem}
                    onRemove={(target) => commitItems(consentItems.filter((i) => i.id !== target.id))}
                  />
                ))}
              </SortableContext>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function Properties({ field, onPatch, settings, onSettingsChange }) {
  const uid = useId();
  if (!field) {
    // Nothing selected → form-level settings (font, background, header/footer).
    return (
      <aside className={styles.props}>
        <div className={styles.propsHeader}>Form Settings</div>
        <FormSettings settings={settings} onChange={onSettingsChange} />
      </aside>
    );
  }
  if (field.healthKey === 'memberConsent') {
    return <ConsentProperties field={field} onPatch={onPatch} />;
  }
  // Validated instruments are locked: show their config read-only.
  if (field.locked) {
    return (
      <aside className={styles.props}>
        <div className={styles.propsHeader}>{field.type === 'group' ? 'Validated Scale' : 'Question'}</div>
        <div className={styles.propsBody}>
          <div className={styles.lockedBanner}>
            <Icon name="solar:lock-keyhole-minimalistic-linear" size={14} color="var(--status-success)" />
            Validated &amp; locked — items and scoring can’t be edited.
          </div>
          <label className={styles.propLabel} htmlFor={`${uid}-locked-label`}>Label</label>
          <Input id={`${uid}-locked-label`} className={styles.ctl} value={field.text || ''} disabled readOnly />
          {field.source ? <p className={styles.propHint}>Source: {field.source}</p> : null}
          {field.type === 'choice' && (
            <>
              <span className={styles.propLabel}>Options &amp; scores</span>
              {(field.options || []).map((o, i) => (
                <div key={i} className={styles.optRow}>
                  <Input className={styles.optText} value={o.value} disabled readOnly />
                  <Input className={styles.optScore} value={o.score ?? ''} disabled readOnly />
                </div>
              ))}
            </>
          )}
        </div>
      </aside>
    );
  }

  const isChoice = field.type === 'choice';
  const setOpt = (i, patch) => {
    const options = field.options.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    onPatch({ options });
  };
  return (
    <aside className={styles.props}>
      <div className={styles.propsHeader}>{field.type === 'group' ? 'Section' : 'Question'}</div>
      <div className={styles.propsBody}>
        <label className={styles.propLabel} htmlFor={`${uid}-label`}>Label</label>
        <Input
          id={`${uid}-label`}
          className={styles.ctl}
          value={field.text || ''}
          onChange={(e) => onPatch({ text: e.target.value })}
        />

        {field.type !== 'group' && field.type !== 'display' && (
          <>
            <CheckRow label="Is this field required?" checked={field.required} onChange={(v) => onPatch({ required: v })} />
            <CheckRow label="Make this component reusable" checked={field.reusable} onChange={(v) => onPatch({ reusable: v })} />
            <CheckRow label="Share with patient" checked={field.shareWithPatient} onChange={(v) => onPatch({ shareWithPatient: v })} />

            <label className={styles.propLabel} htmlFor={`${uid}-description`}>Description</label>
            <Textarea
              id={`${uid}-description`}
              className={styles.ctl}
              rows={3}
              placeholder="Add description"
              value={field.description || ''}
              onChange={(e) => onPatch({ description: e.target.value })}
            />

            {(field.type === 'string' || field.type === 'integer' || field.type === 'decimal' || field.type === 'text') && (
              <>
                <label className={styles.propLabel} htmlFor={`${uid}-placeholder`}>Placeholder</label>
                <Input
                  id={`${uid}-placeholder`}
                  className={styles.ctl}
                  value={field.placeholder || ''}
                  onChange={(e) => onPatch({ placeholder: e.target.value })}
                />
              </>
            )}
          </>
        )}

        {isChoice && (
          <>
            <span className={styles.propLabel}>Options &amp; scoring</span>
            <p className={styles.propHint}>Set a score per option to make this question scorable.</p>
            {(field.options || []).map((o, i) => (
              <div key={i} className={styles.optRow}>
                <Input
                  className={styles.optText}
                  value={o.value}
                  onChange={(e) => setOpt(i, { value: e.target.value })}
                />
                <Input
                  className={styles.optScore}
                  type="number"
                  placeholder="—"
                  value={o.score ?? ''}
                  onChange={(e) => setOpt(i, { score: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
                <CloseButton
                  size={16}
                  onClick={() => onPatch({ options: field.options.filter((_, idx) => idx !== i) })}
                  className={styles.optRemove}
                  label="Remove option"
                />
              </div>
            ))}
            <button
              className={styles.optAdd}
              onClick={() => onPatch({ options: [...(field.options || []), { value: `Option ${(field.options?.length || 0) + 1}` }] })}
            >
              <Icon name="solar:add-circle-linear" size={15} color="var(--primary-300)" /> Add option
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export function FormBuilder() {
  const form = useAppStore((s) => s.formBuilderForm);
  const saving = useAppStore((s) => s.formBuilderSaving);
  const saveForm = useAppStore((s) => s.saveForm);
  const closeFormBuilder = useAppStore((s) => s.closeFormBuilder);
  const showToast = useAppStore((s) => s.showToast);
  // Active tab lives in the store so it's mirrored into the URL (refresh-safe).
  const mode = useAppStore((s) => s.formBuilderMode);
  const setMode = useAppStore((s) => s.setFormBuilderMode);

  const copyShareLink = async () => {
    if (typeof form?.id === 'string' && form.id.startsWith('local-')) {
      showToast?.('Save the form first to get a shareable link');
      return;
    }
    const ok = await copyToClipboard(formShareLink(form.id));
    showToast?.(ok ? 'Shareable form link copied' : 'Could not copy — link: ' + formShareLink(form.id));
  };

  const [name, setName] = useState(form?.name || 'Untitled Form');
  const [fields, setFields] = useState(() => form?.schema?.items || []);
  const [scoring, setScoring] = useState(() => form?.scoring || { scores: [], criticalTriggers: [] });
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...(form?.settings || {}) }));
  const [selectedId, setSelectedId] = useState(null);
  const [paletteTab, setPaletteTab] = useState('health');
  const [search, setSearch] = useState('');
  const [activeDrag, setActiveDrag] = useState(null);

  // Skip the auto-save that the very next render would otherwise trigger right
  // after we (re)load a form's state — we only want to persist real user edits.
  const skipAutoSave = useRef(true);

  // Re-sync when a different form is opened.
  useEffect(() => {
    setName(form?.name || 'Untitled Form');
    setFields(form?.schema?.items || []);
    setScoring(form?.scoring || { scores: [], criticalTriggers: [] });
    setSettings({ ...DEFAULT_SETTINGS, ...(form?.settings || {}) });
    setSelectedId(null);
    skipAutoSave.current = true;
  }, [form?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save: debounce-persist edits so nothing is lost if the builder is
  // closed without an explicit Save. Silent (no toast); the Save button stays
  // for an explicit, confirmed save. Skips unsaved local drafts.
  useEffect(() => {
    if (skipAutoSave.current) { skipAutoSave.current = false; return; }
    if (!form?.id || (typeof form.id === 'string' && form.id.startsWith('local-'))) return;
    const t = setTimeout(() => {
      saveForm({ name, schema: { items: fields }, scoring, settings }, { silent: true });
    }, 800);
    return () => clearTimeout(t);
  }, [name, fields, scoring, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const selectedField = useMemo(() => (selectedId ? findField(fields, selectedId) : null), [fields, selectedId]);

  const insertEntry = (entry, overId = null) => {
    if (!entry) return;
    const insertAt = (prev, field) => {
      const idx = overId ? prev.findIndex((f) => f.linkId === overId) : -1;
      if (idx === -1) return [...prev, field];
      const next = [...prev];
      next.splice(idx, 0, field);
      return next;
    };

    if (entry.validated) {
      const { field, score, criticalTriggers } = instantiateInstrument(entry.instrument);
      setFields((prev) => insertAt(prev, field));
      setScoring((prev) => ({
        scores: [...(prev?.scores || []), score],
        criticalTriggers: [...(prev?.criticalTriggers || []), ...criticalTriggers],
      }));
      setSelectedId(field.linkId);
      return;
    }

    const newField = assignIds(entry.make());
    setFields((prev) => insertAt(prev, newField));
    setSelectedId(newField.linkId);
  };

  const handleDragStart = (e) => {
    const id = String(e.active.id);
    if (id.startsWith('palette:')) setActiveDrag(e.active.data.current?.entry || null);
  };

  const handleDragEnd = (e) => {
    setActiveDrag(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);

    if (activeId.startsWith('palette:')) {
      const entry = active.data.current?.entry;
      if (!entry) return;
      insertEntry(entry, String(over.id));
      return;
    }

    // Reorder consent items inside a Member Consent component. Rows only move
    // within their own category so the Care Program / Service Line grouping
    // holds, and the questions follow the new order.
    if (activeId.startsWith('consent:')) {
      const overId = String(over.id);
      if (!overId.startsWith('consent:') || activeId === overId) return;
      const consentFieldId = active.data.current?.consentFieldId;
      if (!consentFieldId) return;
      const fromKey = activeId.slice('consent:'.length);
      const toKey = overId.slice('consent:'.length);
      setFields((prev) => {
        const target = findField(prev, consentFieldId);
        if (!target) return prev;
        const items = target.consentItems || [];
        const nextItems = reorderConsentItems(items, fromKey, toKey);
        if (nextItems === items) return prev;
        return updateField(prev, consentFieldId, {
          consentItems: nextItems,
          items: syncConsentQuestions(target.items, nextItems, assignIds, !!target.showDecline),
        });
      });
      return;
    }

    // Reorder existing top-level cards.
    if (active.id !== over.id) {
      setFields((prev) => {
        const from = prev.findIndex((f) => f.linkId === active.id);
        const to = prev.findIndex((f) => f.linkId === over.id);
        if (from === -1 || to === -1) return prev;
        return arrayMove(prev, from, to);
      });
    }
  };

  const patchSelected = (patch) => setFields((prev) => updateField(prev, selectedId, patch));
  const deleteField = (id) => {
    setFields((prev) => removeField(prev, id));
    // Remove any score / critical triggers registered by a validated instrument
    // instance (their ids are suffixed with the group's linkId).
    setScoring((prev) => ({
      scores: (prev?.scores || []).filter((s) => !String(s.id).endsWith(`_${id}`)),
      criticalTriggers: (prev?.criticalTriggers || []).filter((t) => !String(t.id).endsWith(`_${id}`)),
    }));
    if (selectedId === id) setSelectedId(null);
  };

  const handleSave = () => saveForm({ name, schema: { items: fields }, scoring, settings });

  return (
    <div className={styles.builder}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.crumb} onClick={closeFormBuilder}>Forms</button>
          <span className={styles.crumbSep}>/</span>
          <input
            className={styles.nameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Form name"
          />
          <Icon name="solar:pen-2-linear" size={14} color="var(--neutral-300)" />
        </div>

        <Toggle
          items={[{ key: 'edit', label: 'Edit Form' }, { key: 'logic', label: 'Logic' }, { key: 'score', label: 'Score' }, { key: 'preview', label: 'Preview' }, { key: 'analytics', label: 'Analytics' }]}
          active={mode}
          onChange={setMode}
          size="M"
        />

        <div className={styles.headerRight}>
          <ActionButton icon="solar:link-linear" size="L" tooltip="Copy share link" onClick={copyShareLink} />
          <ActionButton icon="solar:printer-linear" size="L" tooltip="Print" onClick={() => window.print()} />
          <span className={styles.hDivider} />
          <Button variant="primary" size="L" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <span className={styles.hDivider} />
          <CloseButton onClick={closeFormBuilder} />
        </div>
      </header>

      {/* Body */}
      {mode === 'edit' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDrag(null)}
        >
          <div className={styles.body}>
            <Palette
              tab={paletteTab}
              setTab={setPaletteTab}
              search={search}
              setSearch={setSearch}
              custom={[]}
              onInsert={insertEntry}
            />
            <Canvas fields={fields} selectedId={selectedId} onSelect={setSelectedId} onDelete={deleteField} />
            <Properties field={selectedField} onPatch={patchSelected} settings={settings} onSettingsChange={setSettings} />
          </div>
          <DragOverlay>
            {activeDrag ? (
              <div className={`${styles.palItem} ${styles.palItemGhost}`}>
                <span className={styles.palIconAvatar}>
                  <Icon name={activeDrag.icon} size={20} color="var(--primary-300)" />
                </span>
                <span className={styles.palLabel}>{activeDrag.label}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {mode === 'logic' && (
        <div className={styles.body}>
          <LogicPanel fields={fields} settings={settings} onChange={setFields} />
        </div>
      )}

      {mode === 'score' && (
        <div className={styles.body}>
          <ScorePanel fields={fields} scoring={scoring} onChange={setScoring} />
        </div>
      )}

      {mode === 'preview' && (
        <div className={styles.body}>
          <PreviewPanel fields={fields} scoring={scoring} formName={name} settings={settings} />
        </div>
      )}

      {mode === 'analytics' && (
        <div className={styles.body}>
          <FormAnalyticsPanel formId={form?.id} fields={fields} scoring={scoring} formName={name} />
        </div>
      )}

      {/* Footer notice (from Figma) */}
      <footer className={styles.footer}>
        <span className={styles.footerNote}>
          <Icon name="solar:info-circle-linear" size={15} color="var(--status-warning)" />
          Please do not request financial information (credit card details etc.) using these forms.
        </span>
      </footer>
    </div>
  );
}

export default FormBuilder;
