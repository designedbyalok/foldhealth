import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { CheckIcon } from '../../components/Icon/CheckIcon';
import { CloseIcon } from '../../components/Icon/CloseIcon';
import { useAppStore } from '../../store/useAppStore';
import styles from './SavedFiltersChip.module.css';

/**
 * Top-bar "Saved Filters" dropdown (Paper 21UY). Sole surface for managing
 * saved views on this worklist now that the SubNav's Saved Filters section
 * has been removed: applies a view on click, filters the list with a search
 * box, and exposes Rename / Delete per row via a ⋯ menu.
 *
 * Props:
 *  - list (string)  Worklist name ('HCC' | 'HEDIS'). Scopes which saved
 *                   filters are read from the store and which filter slice
 *                   the Clear/Apply actions write to. Defaults to 'HCC' so
 *                   HccWorklistTable's existing callsite keeps working.
 */
// Stable empty-array fallback so `s.savedFiltersByList[list] ?? EMPTY`
// returns the SAME reference across renders when a list hasn't been seeded
// yet. Inlining `|| []` there minted a fresh `[]` each render, which
// triggered React 18's "getSnapshot should be cached" infinite loop.
const EMPTY_SAVED = [];

export function SavedFiltersChip({ list = 'HCC' }) {
  const savedFilters = useAppStore(s => s.savedFiltersByList[list] ?? EMPTY_SAVED);
  const activeId = useAppStore(s => s.activeSavedIdByList[list] ?? null);
  const applySavedFilter = useAppStore(s => s.applySavedFilter);
  const resetSavedFilter = useAppStore(s => s.resetSavedFilter);
  const renameSavedFilter = useAppStore(s => s.renameSavedFilter);
  const copySavedFilter = useAppStore(s => s.copySavedFilter);
  const deleteSavedFilter = useAppStore(s => s.deleteSavedFilter);
  const active = savedFilters.find(f => f.id === activeId) || null;

  // The shared FilterChip, so it reads like the filters beside it:
  // "Saved Filters ⌄", or "Saved Filters : <first two words>… ⌄" once one is
  // applied. It keeps the chevron (no ✕); Reset Selection in the list clears.
  return (
    <FilterChip
      label="Saved Filters"
      active={!!active}
      activeSummary={active ? firstWords(active.name, 2) : undefined}
      noClear
      noClearNeutral={false}
      renderPopover={({ anchorRect, onClose }) => (
        <SavedFiltersPopover
          pos={{ top: anchorRect.bottom + 6, left: anchorRect.left }}
          savedFilters={savedFilters}
          activeId={activeId}
          onSelect={(id) => { applySavedFilter(list, id); onClose(); }}
          onClear={() => { resetSavedFilter(list); onClose(); }}
          onRename={(f, name) => renameSavedFilter(list, f.id, name)}
          onCopy={(f) => copySavedFilter(list, f.id)}
          onDelete={(f) => deleteSavedFilter(list, f.id)}
          onClose={onClose}
        />
      )}
    />
  );
}

function firstWords(text, n) {
  const words = String(text || '').trim().split(/\s+/);
  return words.length > n ? `${words.slice(0, n).join(' ')}…` : words.join(' ');
}

function SavedFiltersPopover({ pos, savedFilters, activeId, onSelect, onClear, onRename, onCopy, onDelete, onClose }) {
  const [query, setQuery] = useState('');
  // Per-row ⋯ menu, anchored to the ⋯ button.
  const [rowMenu, setRowMenu] = useState(null); // { id, rect } | null
  // The row being renamed in place (Figma's edit state).
  const [editing, setEditing] = useState(null); // { id, name } | null
  // The saved filter waiting on "Delete Saved Filter?".
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    // While the delete dialog is up, Escape belongs to it.
    const onKey = (e) => { if (e.key === 'Escape' && !deleteTarget) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, deleteTarget]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return savedFilters;
    return savedFilters.filter(f => f.name.toLowerCase().includes(q));
  }, [query, savedFilters]);

  const menuTarget = rowMenu ? savedFilters.find(f => f.id === rowMenu.id) : null;
  const commitRename = () => {
    const f = savedFilters.find(x => x.id === editing?.id);
    const name = editing?.name.trim();
    if (f && name && name !== f.name) onRename(f, name);
    setEditing(null);
  };

  return createPortal(
    <>
      <div aria-hidden="true" className={styles.overlay} onClick={onClose} />
      <div className={styles.popover} style={{ top: pos.top, left: pos.left }}>
        <div className={styles.popHeader}>Apply Saved Filters</div>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <Icon name="solar:magnifer-linear" size={14} />
          </span>
          <input aria-label="Search saved filters"
            type="text"
            className={styles.searchInput}
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.optionList}>
          {savedFilters.length === 0 && (
            <div className={styles.emptyState}>
              <Icon name="solar:filter-linear" size={24} color="var(--neutral-200)" />
              No Filter Combination Saved
            </div>
          )}
          {savedFilters.length > 0 && filtered.length === 0 && (
            <div className={styles.emptyState}>No matches</div>
          )}
          {filtered.map((f) => (editing?.id === f.id ? (
            <div key={f.id} className={styles.editRow}>
              <Input
                className={styles.editInput}
                autoFocus
                aria-label="Filter name"
                placeholder="Enter Filter name"
                value={editing.name}
                onChange={(e) => setEditing({ id: f.id, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                  if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); }
                }}
              />
              <Button
                size="sm"
                iconOnly
                aria-label="Save name"
                disabled={!editing.name.trim()}
                leadingIconElement={<CheckIcon size={14} />}
                onClick={commitRename}
              />
              <ActionButton size="sm" tooltip="Cancel" onClick={() => setEditing(null)}>
                <CloseIcon size={16} color="var(--neutral-300)" />
              </ActionButton>
            </div>
          ) : (
            <div
              key={f.id}
              className={[styles.optionRow, activeId === f.id ? styles.optionRowActive : ''].filter(Boolean).join(' ')}
            >
              <button
                type="button"
                className={styles.optionMain}
                aria-current={activeId === f.id ? 'true' : undefined}
                onClick={() => onSelect(f.id)}
              >
                <span className={styles.optionLabel}>{f.name}</span>
              </button>
              <ActionButton
                icon="solar:menu-dots-linear"
                size="sm"
                tooltip="More"
                aria-label={`Manage ${f.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setRowMenu({ id: f.id, rect: e.currentTarget.getBoundingClientRect() });
                }}
              />
            </div>
          )))}
        </div>
        <Button variant="outline" fullWidth onClick={onClear}>
          Reset Selection
        </Button>
      </div>

      {rowMenu && menuTarget && (
        <MenuPopover
          anchorRect={rowMenu.rect}
          align="left"
          width="auto"
          ariaLabel={`Manage ${menuTarget.name}`}
          items={[
            { key: 'rename', icon: 'solar:pen-linear', label: 'Edit Name' },
            { key: 'copy', icon: 'solar:copy-linear', label: 'Make a Copy' },
            { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true },
          ]}
          onSelect={(key) => {
            if (key === 'rename') setEditing({ id: menuTarget.id, name: menuTarget.name });
            if (key === 'copy') {
              // Open the copy for renaming straight away.
              const id = onCopy(menuTarget);
              if (id) setEditing({ id, name: `${menuTarget.name} (Copy)` });
            }
            if (key === 'delete') setDeleteTarget(menuTarget);
            setRowMenu(null);
          }}
          onClose={() => setRowMenu(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          variant="destructive"
          icon="solar:trash-bin-trash-linear"
          title="Delete Saved Filter?"
          description="Please confirm if you want to delete your saved filter. This action can’t be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>,
    document.body,
  );
}
