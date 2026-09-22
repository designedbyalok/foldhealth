import { useState, useEffect, useCallback, useRef } from 'react';
import { Reader } from '@usewaypoint/email-builder';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { useAppStore } from '../../store/useAppStore';
import { ComponentsPanel } from './ComponentsPanel';
import { PreviewCanvas } from './PreviewCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { DevicePreview } from './DevicePreview';
import { SelectionToolbar } from './SelectionToolbar';
import { FontSubstitutionDialog } from './FontSubstitutionDialog';
import { computeDropPosition } from './blockHelpers';
import { NEW_PREFIX, countChanges } from './EmailBuilder.utils';
import { EmailBuilderSkeleton } from './EmailBuilderSkeleton';
import { EmailBuilderToolbar } from './EmailBuilderToolbar';
import { EmailBuilderUnsavedDialog } from './EmailBuilderUnsavedDialog';
import { useEmailBuilderKeyboard } from './useEmailBuilderKeyboard';
import styles from './EmailBuilder.module.css';

export function EmailBuilder() {
  const name = useAppStore(s => s.editingCampaignName) || 'Untitled Template';
  const setName = useAppStore(s => s.setEditingCampaignName);
  const closeEmailBuilder = useAppStore(s => s.closeEmailBuilder);
  const saveEmailTemplate = useAppStore(s => s.saveEmailTemplate);
  const showToast = useAppStore(s => s.showToast);
  const moveBlock = useAppStore(s => s.moveBlock);
  const insertNewBlock = useAppStore(s => s.insertNewBlock);
  const emailDocument = useAppStore(s => s.emailDocument);
  const undoEmailEdit = useAppStore(s => s.undoEmailEdit);
  const redoEmailEdit = useAppStore(s => s.redoEmailEdit);
  const canUndo = useAppStore(s => s.emailHistory.length > 0);
  const canRedo = useAppStore(s => s.emailFuture.length > 0);
  const pendingNavTarget = useAppStore(s => s.pendingNavTarget);
  const setPendingNavTarget = useAppStore(s => s.setPendingNavTarget);
  const setActivePage = useAppStore(s => s.setActivePage);
  const [activeDrag, setActiveDrag] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  const [viewMode, setViewMode] = useState('builder');
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [pendingClose, setPendingClose] = useState(null);
  const [saving, setSaving] = useState(false);

  useEmailBuilderKeyboard();

  useEffect(() => {
    if (emailDocument && !savedSnapshot) setSavedSnapshot(structuredClone(emailDocument));
  }, []);

  const unsavedCount = savedSnapshot ? countChanges(savedSnapshot, emailDocument) : 0;

  // Each save rewrites the whole email_template and color_variables JSONB
  // via TOAST (~35 shared blocks per call). On the free tier that is the
  // top single write source. 15s debounce cuts autosave frequency roughly
  // 3x during active editing without exposing more edits to loss, because
  // the visibilitychange handler below flushes any pending save when the
  // tab is backgrounded and beforeunload warns on hard close.
  const autosaveTimer = useRef(null);
  const flushPendingAutosave = useCallback(async () => {
    if (unsavedCount === 0 || saving) return;
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = null;
    const ok = await saveEmailTemplate();
    if (ok) {
      setLastSavedAt(new Date());
      setSavedSnapshot(structuredClone(useAppStore.getState().emailDocument));
    }
  }, [unsavedCount, saving, saveEmailTemplate]);

  useEffect(() => {
    if (unsavedCount === 0 || saving) return;
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(flushPendingAutosave, 15000);
    return () => clearTimeout(autosaveTimer.current);
  }, [emailDocument]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushPendingAutosave(); };
    const onBeforeUnload = (e) => {
      if (unsavedCount === 0) return;
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [flushPendingAutosave, unsavedCount]);

  useEffect(() => {
    if (!pendingNavTarget) return;
    if (unsavedCount > 0) {
      setPendingClose({ reason: 'nav', target: pendingNavTarget });
    } else {
      closeEmailBuilder();
      setActivePage(pendingNavTarget);
      setPendingNavTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNavTarget]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragStart = (event) => {
    const id = String(event.active.id);
    if (id.startsWith(NEW_PREFIX)) {
      setActiveDrag({ kind: 'new', type: id.slice(NEW_PREFIX.length) });
    } else {
      setActiveDrag({ kind: 'block', id });
    }
  };

  const handleDragOver = useCallback((event) => {
    const doc = useAppStore.getState().emailDocument;
    if (!doc) { setDropIndicator(null); return; }
    const activeId = String(event.active.id);
    const resolvedId = activeId.startsWith(NEW_PREFIX) ? null : activeId;
    setDropIndicator(computeDropPosition(event, doc, resolvedId));
  }, []);

  const handleDragEnd = (event) => {
    setActiveDrag(null);
    const target = dropIndicator;
    setDropIndicator(null);
    const { active, over } = event;
    if (!over || !target) return;
    const doc = useAppStore.getState().emailDocument;
    if (!doc) return;

    const activeId = String(active.id);
    if (activeId.startsWith(NEW_PREFIX)) {
      insertNewBlock(activeId.slice(NEW_PREFIX.length), target);
    } else {
      const bulkIds = useAppStore.getState().bulkSelectedIds;
      const isBulk = bulkIds.length > 1 && bulkIds.includes(activeId);
      if (isBulk) {
        const ordered = bulkIds.slice().sort((a, b) => bulkIds.indexOf(a) - bulkIds.indexOf(b));
        ordered.forEach((id, idx) => {
          moveBlock(id, { ...target, index: target.index + idx });
        });
      } else {
        moveBlock(activeId, target);
      }
    }
  };

  const handleSave = async () => {
    // The Save button used to fire an UPDATE even when nothing had changed,
    // rewriting the whole email_template + color_variables JSONB via TOAST.
    // Autosave already gates on unsavedCount; the explicit button did not.
    if (unsavedCount === 0) {
      showToast('Nothing to save');
      return;
    }
    setSaving(true);
    let ok = false;
    try {
      ok = await saveEmailTemplate();
    } finally {
      setSaving(false);
    }
    if (ok) {
      setLastSavedAt(new Date());
      setSavedSnapshot(structuredClone(useAppStore.getState().emailDocument));
      showToast('Template saved');
    } else {
      showToast('Save failed, check console');
    }
  };

  if (!emailDocument) {
    return <EmailBuilderSkeleton />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveDrag(null); setDropIndicator(null); }}
    >
      <div className={styles.builder}>
        <EmailBuilderToolbar
          name={name}
          setName={setName}
          viewMode={viewMode}
          setViewMode={setViewMode}
          canUndo={canUndo}
          canRedo={canRedo}
          undoEmailEdit={undoEmailEdit}
          redoEmailEdit={redoEmailEdit}
          showTestEmail={showTestEmail}
          setShowTestEmail={setShowTestEmail}
          lastSavedAt={lastSavedAt}
          unsavedCount={unsavedCount}
          saving={saving}
          onSave={handleSave}
          closeEmailBuilder={closeEmailBuilder}
          setPendingClose={setPendingClose}
        />

        {viewMode === 'builder' ? (
          <div className={styles.body}>
            <ComponentsPanel />
            <PreviewCanvas dropIndicator={dropIndicator} />
            <PropertiesPanel />
          </div>
        ) : (
          <DevicePreview device={viewMode} />
        )}
      </div>
      <DragOverlay>
        {activeDrag && (
          <div className={styles.dragOverlay}>
            {activeDrag.kind === 'new' ? `New ${activeDrag.type}` : 'Moving block'}
          </div>
        )}
      </DragOverlay>
      <SelectionToolbar />
      <EmailBuilderUnsavedDialog
        unsavedCount={unsavedCount}
        pendingClose={pendingClose}
        setPendingClose={setPendingClose}
        closeEmailBuilder={closeEmailBuilder}
        setActivePage={setActivePage}
        setPendingNavTarget={setPendingNavTarget}
      />
      <FontSubstitutionDialog />
    </DndContext>
  );
}

export { Reader };
