import { useState, useEffect, useCallback, useRef } from 'react';
import { Reader } from '@usewaypoint/email-builder';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Toggle } from '../../components/Toggle/Toggle';
import { ConfirmDialog } from '../../components/Modal/ConfirmDialog';
import { ComponentsPanel } from './ComponentsPanel';
import { PreviewCanvas } from './PreviewCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { DevicePreview } from './DevicePreview';
import { renderEmailHtml } from './patchEmailHtml';
import { buildParentMap } from './blockHelpers';
import styles from './EmailBuilder.module.css';

function getFirstChild(doc, id) {
  if (id === 'root') return doc.root?.data?.childrenIds?.[0] || null;
  const block = doc[id];
  if (!block) return null;
  const props = block.data?.props || {};
  if (Array.isArray(props.childrenIds) && props.childrenIds.length > 0) return props.childrenIds[0];
  if (Array.isArray(props.columns)) {
    for (const col of props.columns) {
      if (col.childrenIds?.length > 0) return col.childrenIds[0];
    }
  }
  return null;
}

function getParentId(doc, id) {
  if (id === 'root') return null;
  const map = buildParentMap(doc);
  return map[id]?.parentId || null;
}

// Match the active.id and over.id strings produced in ComponentsPanel and
// PreviewCanvas to figure out the right store action.
const NEW_PREFIX = '__new:';   // dragging a tile from the panel
const EMPTY_PREFIX = '__empty:'; // dropping into an empty container/column

function parseDropTarget(overId, doc) {
  if (!overId) return null;
  if (overId.startsWith(EMPTY_PREFIX)) {
    // __empty:parentId  OR  __empty:parentId:colIdx  → append to that container
    const rest = overId.slice(EMPTY_PREFIX.length);
    const parts = rest.split(':');
    if (parts.length === 1) {
      const parent = doc[parts[0]];
      const list = parent?.data?.props?.childrenIds || [];
      return { parentId: parts[0], index: list.length };
    }
    const containerId = parts[0];
    const columnIdx = Number(parts[1]);
    const parent = doc[containerId];
    const list = parent?.data?.props?.columns?.[columnIdx]?.childrenIds || [];
    return { parentId: containerId, columnIdx, index: list.length };
  }
  // Otherwise the over id is a real block id — drop adjacent to that block.
  const map = buildParentMap(doc);
  const slot = map[overId];
  if (!slot) return null;
  return { parentId: slot.parentId, columnIdx: slot.columnIdx, index: slot.index + 1 };
}

function SendTestPopover({ onClose }) {
  const doc = useAppStore(s => s.emailDocument);
  const campaignName = useAppStore(s => s.editingCampaignName);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // null | 'sending' | 'ok' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSend = async () => {
    if (!email || !email.includes('@')) return;
    setStatus('sending');
    setErrorMsg('');
    const html = renderEmailHtml(doc);
    if (!html || html.includes('Could not render')) {
      setStatus('error');
      setErrorMsg('Failed to render email template');
      return;
    }
    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `[Test] ${campaignName || 'Email Template'}`,
          html,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = 'Send failed';
        try { const j = JSON.parse(text); msg = j.error?.message || j.error || msg; } catch { msg = text || msg; }
        setStatus('error');
        setErrorMsg(msg);
      } else {
        const json = await res.json();
        if (json.error) {
          setStatus('error');
          setErrorMsg(json.error?.message || json.error || 'Send failed');
        } else {
          setStatus('ok');
        }
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Network error');
    }
  };

  return (
    <div ref={popoverRef} className={styles.testEmailPopover}>
      <div className={styles.testEmailLabel}>Send test email</div>
      <input
        ref={inputRef}
        type="email"
        className={styles.testEmailInput}
        placeholder="name@example.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSend(); if (e.key === 'Escape') onClose(); }}
      />
      {status === 'ok' && (
        <div className={`${styles.testEmailStatus} ${styles.testEmailStatusOk}`}>
          <Icon name="solar:check-circle-linear" size={14} /> Sent successfully
        </div>
      )}
      {status === 'error' && (
        <div className={`${styles.testEmailStatus} ${styles.testEmailStatusErr}`}>
          <Icon name="solar:close-circle-linear" size={14} /> {errorMsg}
        </div>
      )}
      <div className={styles.testEmailActions}>
        <Button variant="secondary" size="S" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="S" onClick={handleSend} disabled={status === 'sending' || !email}>
          {status === 'sending' ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </div>
  );
}

function countChanges(a, b) {
  if (!a || !b) return 0;
  let n = 0;
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) n++;
  }
  return n;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function EmailBuilder() {
  const name = useAppStore(s => s.editingCampaignName) || 'Untitled Template';
  const setName = useAppStore(s => s.setEditingCampaignName);
  const closeEmailBuilder = useAppStore(s => s.closeEmailBuilder);
  const saveEmailTemplate = useAppStore(s => s.saveEmailTemplate);
  const showToast = useAppStore(s => s.showToast);
  const moveBlock = useAppStore(s => s.moveBlock);
  const insertNewBlock = useAppStore(s => s.insertNewBlock);
  const emailDocument = useAppStore(s => s.emailDocument);
  const [activeDrag, setActiveDrag] = useState(null);
  const [viewMode, setViewMode] = useState('builder');
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (emailDocument && !savedSnapshot) setSavedSnapshot(structuredClone(emailDocument));
  }, []);

  const unsavedCount = savedSnapshot ? countChanges(savedSnapshot, emailDocument) : 0;

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
      const s = useAppStore.getState();
      const doc = s.emailDocument;
      const id = s.selectedBlockId;
      if (!doc || !id) return;

      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+D — duplicate
      if (isMeta && e.key === 'd') {
        e.preventDefault();
        if (id !== 'root') s.duplicateBlock(id);
        return;
      }

      // Cmd+R — rename layer
      if (isMeta && e.key === 'r') {
        e.preventDefault();
        if (id !== 'root') {
          window.dispatchEvent(new CustomEvent('eb:rename', { detail: { id } }));
        }
        return;
      }

      if (isEditable) return;

      // Enter — bulk-select children if container, otherwise select first child
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const block = id === 'root' ? doc.root : doc[id];
        const blockType = block?.type;
        if (blockType === 'Container' || blockType === 'ColumnsContainer') {
          const p = block.data?.props || {};
          let childIds = [];
          if (blockType === 'Container') {
            childIds = p.childrenIds || [];
          } else {
            (p.columns || []).forEach(col => { childIds.push(...(col.childrenIds || [])); });
          }
          if (childIds.length > 0) {
            s.setBulkSelectedIds(childIds);
            return;
          }
        }
        const child = getFirstChild(doc, id);
        if (child) s.setSelectedBlockId(child);
        return;
      }

      // Shift+Enter — select parent
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const parent = getParentId(doc, id);
        if (parent) s.setSelectedBlockId(parent);
        return;
      }

      // Escape — clear bulk selection
      if (e.key === 'Escape') {
        if (s.bulkSelectedIds.length > 0) {
          e.preventDefault();
          s.setBulkSelectedIds([]);
          return;
        }
      }

      // Delete / Backspace — remove block
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (id !== 'root') s.removeBlock(id);
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragStart = (event) => {
    const id = String(event.active.id);
    if (id.startsWith(NEW_PREFIX)) {
      setActiveDrag({ kind: 'new', type: id.slice(NEW_PREFIX.length) });
    } else {
      setActiveDrag({ kind: 'block', id });
    }
  };

  const handleDragEnd = (event) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const doc = useAppStore.getState().emailDocument;
    if (!doc) return;
    const target = parseDropTarget(String(over.id), doc);
    if (!target) return;

    const activeId = String(active.id);
    if (activeId.startsWith(NEW_PREFIX)) {
      insertNewBlock(activeId.slice(NEW_PREFIX.length), target);
    } else {
      moveBlock(activeId, target);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
    <div className={styles.builder}>
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <input
            className={styles.titleInput}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            spellCheck={false}
          />
        </div>
        <div className={styles.topCenter}>
          <Toggle
            items={[
              { key: 'builder', label: 'Builder', icon: 'solar:pen-new-square-linear' },
              { key: 'desktop', label: 'Desktop', icon: 'solar:monitor-linear' },
              { key: 'mobile', label: 'Mobile', icon: 'solar:smartphone-linear' },
            ]}
            active={viewMode}
            onChange={setViewMode}
            size="S"
          />
        </div>
        <div className={styles.topRight} style={{ position: 'relative' }}>
          <Button
            variant="secondary"
            size="L"
            leadingIcon="solar:letter-linear"
            onClick={() => setShowTestEmail(v => !v)}
          >
            Test Mail
          </Button>
          {showTestEmail && <SendTestPopover onClose={() => setShowTestEmail(false)} />}
          <ActionButton icon="solar:chart-2-linear" size="L" tooltip="Analytics" onClick={() => showToast('Analytics — coming soon')} />
          {lastSavedAt && unsavedCount === 0 && (
            <span className={styles.saveStatus}>
              <Icon name="solar:check-circle-linear" size={14} color="var(--status-success)" />
              Saved at {formatTime(lastSavedAt)}
            </span>
          )}
          {unsavedCount > 0 && (
            <span className={styles.saveStatus} style={{ color: 'var(--status-warning)' }}>
              <Icon name="solar:pen-2-linear" size={14} color="var(--status-warning)" />
              {unsavedCount} unsaved change{unsavedCount !== 1 ? 's' : ''}
            </span>
          )}
          <Button
            variant="primary"
            size="L"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const ok = await saveEmailTemplate();
              setSaving(false);
              if (ok) {
                setLastSavedAt(new Date());
                setSavedSnapshot(structuredClone(useAppStore.getState().emailDocument));
                showToast('Template saved');
              } else {
                showToast('Save failed — check console');
              }
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <button
            className={styles.closeBtn}
            onClick={() => unsavedCount > 0 ? setShowCloseConfirm(true) : closeEmailBuilder()}
            aria-label="Close"
          >
            <Icon name="solar:close-circle-linear" size={22} color="var(--neutral-300)" />
          </button>
        </div>
      </div>

      {viewMode === 'builder' ? (
        <div className={styles.body}>
          <ComponentsPanel />
          <PreviewCanvas />
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
      {showCloseConfirm && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-warning)"
          title="Unsaved changes"
          description={`You have ${unsavedCount} unsaved change${unsavedCount !== 1 ? 's' : ''}. Are you sure you want to close without saving?`}
          confirmLabel="Discard & Close"
          cancelLabel="Keep Editing"
          variant="error"
          onConfirm={() => { setShowCloseConfirm(false); closeEmailBuilder(); }}
          onCancel={() => setShowCloseConfirm(false)}
        />
      )}
    </DndContext>
  );
}

// Re-export Reader so consumers (e.g. the canvas) can use it
export { Reader };
