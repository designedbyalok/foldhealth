import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../../../components/Icon/Icon';
import { ConfirmDialog } from '../../../../../components/ConfirmDialog/ConfirmDialog';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../components/Button/Button';
import { RingEmptyState } from '../../../../../components/RingEmptyState/RingEmptyState';
import { FilterBar } from '../../../../../components/FilterBar/FilterBar';
import { Input } from '../../../../../components/Input/Input';
import { SimpleTableSkeleton } from '../../../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { openSafeUrl } from '../../../../../lib/openSafeUrl';
import { useAppStore } from '../../../../../store/useAppStore';
import { ProgramDocPreviewDrawer } from '../care-programs/program-detail/related/ProgramDocPreviewDrawer/ProgramDocPreviewDrawer';
import { DocumentCategoryRail } from './DocumentCategoryRail';
import { DocumentsTable } from './DocumentsTable';
import { UploadDocumentDrawer } from './UploadDocumentDrawer';
import { ALL_CATEGORY, categoryOf, withCustomCategories } from './documentsData';
import { AddCategoryDialog } from './AddCategoryDialog';
import { usePatientDocuments } from './usePatientDocuments';
import styles from './DocumentsTab.module.css';

const FILTER_DEFS = [
  { key: 'types', label: 'File Type', primary: true },
  { key: 'uploaders', label: 'Uploaded By', primary: true },
];
const EMPTY_FILTERS = { types: [], uploaders: [] };

// Must match UploadDropField's default `accept` so the drag path accepts the
// same files the drawer's dropzone would.
const ACCEPTED_EXTS = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']);
const isAcceptedFile = (f) => {
  const ext = /\.([a-z0-9]+)$/i.exec(f?.name || '')?.[1]?.toLowerCase();
  return !!ext && ACCEPTED_EXTS.has(ext);
};
const dragHasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

/**
 * Documents empty state. Mirrors the Comms tab's RingEmptyState pattern
 * (dashed medallion + caption + inline action) so this tab looks like a
 * first-class member of the patient profile instead of inventing its own
 * blank page. Three variants, picked from the current narrow / category
 * state. Drag-and-drop onto the panel still works beneath via the
 * overlay in the parent.
 */
function EmptyDocuments({ narrowed, category, categoryLabel, onUpload, onClearFilters }) {
  if (narrowed) {
    return (
      <div className={styles.emptyWrap}>
        <RingEmptyState icon="solar:filter-linear" label="No matching documents">
          <Button
            variant="secondary"
            size="L"
            leadingIcon="solar:close-circle-linear"
            onClick={onClearFilters}
          >
            Clear search and filters
          </Button>
        </RingEmptyState>
      </div>
    );
  }
  const label = category === ALL_CATEGORY ? 'documents' : categoryLabel.toLowerCase();
  return (
    <div className={styles.emptyWrap}>
      <RingEmptyState icon="solar:folder-with-files-linear" label={`No ${label} present`}>
        <Button
          variant="primary"
          size="L"
          leadingIcon="solar:upload-minimalistic-linear"
          onClick={onUpload}
        >
          Upload File
        </Button>
      </RingEmptyState>
    </div>
  );
}

const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`; };
const extOf = name => (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1]?.toLowerCase() || null;
const uniqueSorted = values => [...new Set(values.filter(Boolean))].sort();

// A same-origin or session file downloads in place; a stored file opens in a
// new tab (signed when private), since cross-origin links ignore `download`.
function downloadDocument(d) {
  const local = d.file ? URL.createObjectURL(d.file) : d.fileUrl?.startsWith('/') ? d.fileUrl : null;
  if (!local) { openSafeUrl(d.fileUrl, 'noopener'); return; }
  const a = document.createElement('a');
  a.href = local;
  a.download = d.name;
  a.click();
  if (d.file) setTimeout(() => URL.revokeObjectURL(local), 0);
}

/**
 * The patient's document library (Figma P360 Revamp 238:47081): a Categories
 * rail beside the selected folder's table, with search, Upload File and filters.
 */
export function DocumentsTab({ patient }) {
  const { documents: loaded, loading } = usePatientDocuments(patient);
  const addProgramDocument = useAppStore(s => s.addProgramDocument);
  const currentActorName = useAppStore(s => s.currentActorName);
  const showToast = useAppStore(s => s.showToast);
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [uploadCategory, setUploadCategory] = useState(null);
  const [uploadInitialFile, setUploadInitialFile] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  // Drag-over overlay. Counter beats a single boolean because dragleave
  // fires on every child boundary; we only hide when every enter balances.
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  // Sample documents aren't in the store, so edits and deletes also apply here.
  const [overrides, setOverrides] = useState({});
  const [removed, setRemoved] = useState(() => new Set());
  const updateProgramDocument = useAppStore(s => s.updateProgramDocument);
  const removeProgramDocument = useAppStore(s => s.removeProgramDocument);
  const openCommsDrawer = useAppStore(s => s.openCommsDrawer);
  const customCategories = useAppStore(s => s.documentCategories);
  const fetchDocumentCategories = useAppStore(s => s.fetchDocumentCategories);
  const addDocumentCategory = useAppStore(s => s.addDocumentCategory);
  const [addingCategory, setAddingCategory] = useState(false);
  useEffect(() => { fetchDocumentCategories(); }, [fetchDocumentCategories]);
  const categories = useMemo(() => withCustomCategories(customCategories), [customCategories]);
  const documents = useMemo(
    () => loaded.filter(d => !removed.has(d.id)).map(d => (overrides[d.id] ? { ...d, ...overrides[d.id] } : d)),
    [loaded, removed, overrides],
  );

  const counts = useMemo(() => {
    const c = { [ALL_CATEGORY]: documents.length };
    documents.forEach(d => { const k = categoryOf(d); c[k] = (c[k] || 0) + 1; });
    return c;
  }, [documents]);

  const inCategory = useMemo(
    () => (category === ALL_CATEGORY ? documents : documents.filter(d => categoryOf(d) === category)),
    [documents, category],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inCategory.filter(d =>
      (!filters.types.length || filters.types.includes(d.type))
      && (!filters.uploaders.length || filters.uploaders.includes(d.updatedBy))
      && (!q || [d.name, d.type, d.updatedBy].some(v => v && v.toLowerCase().includes(q))));
  }, [inCategory, filters, query]);

  const filterCount = filters.types.length + filters.uploaders.length;
  const narrowed = filterCount || query.trim();
  const categoryLabel = categories.find(c => c.key === category)?.label;

  const selectCategory = (key) => { setCategory(key); setSelectedIds([]); };
  const closeSearch = () => { setSearchOpen(false); setQuery(''); };
  const toggle = id => setSelectedIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  const toggleAll = checked => setSelectedIds(checked ? rows.map(r => r.id) : []);

  const upload = ({ file, name, type, category: cat }) => {
    const ext = extOf(file.name);
    addProgramDocument({
      id: `pdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      programCode: null,
      patientId: String(patient.id),
      name: ext && !extOf(name) ? `${name}.${ext}` : name,
      type,
      category: cat,
      sizeBytes: file.size,
      updatedBy: currentActorName?.() || 'You',
      updatedDate: today(),
      createdAt: new Date().toISOString(),
      ext,
    }, file);
    setUploadCategory(null);
    selectCategory(cat);
  };

  const saveEdit = ({ file, name, type, category: cat }) => {
    const ext = extOf(editing.name);
    const patch = {
      name: ext && !extOf(name) ? `${name}.${ext}` : name,
      type,
      category: cat,
      updatedBy: currentActorName?.() || 'You',
      updatedDate: today(),
    };
    setOverrides(o => ({ ...o, [editing.id]: patch }));
    updateProgramDocument(editing.id, patch);
    if (file) upload({ file, name, type, category: cat });
    setEditing(null);
  };

  const confirmDelete = () => {
    setRemoved(r => new Set(r).add(deleting.id));
    setSelectedIds(ids => ids.filter(id => id !== deleting.id));
    removeProgramDocument(deleting.id);
    setDeleting(null);
  };

  const rowAction = (key, doc) => {
    if (key === 'update') setEditing(doc);
    else if (key === 'share') {
      const patch = doc.sharedWithPatient
        ? { sharedWithPatient: false, sharedBy: null, sharedAt: null }
        : { sharedWithPatient: true, sharedBy: currentActorName?.() || null, sharedAt: new Date().toISOString() };
      setOverrides(o => ({ ...o, [doc.id]: { ...o[doc.id], ...patch } }));
      updateProgramDocument(doc.id, patch);
    }
    else if (key === 'delete') setDeleting(doc);
    else if (key === 'email') {
      openCommsDrawer('email', {
        initial: { patient, to: patient?.email ? [patient.email] : [], subject: doc.name },
      });
    }
  };

  // Drag-and-drop onto the main panel. On drop we open the Upload drawer with
  // the file pre-filled, so the user still picks category + document type
  // (and can confirm or change the auto-filled caption).
  const openDrawerWithFile = useCallback((file) => {
    setUploadInitialFile(file);
    setUploadCategory(category === ALL_CATEGORY ? '' : category);
  }, [category]);
  const resetDrag = useCallback(() => { dragDepthRef.current = 0; setDragActive(false); }, []);
  const onDragEnter = useCallback((e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  }, []);
  const onDragOver = useCallback((e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  const onDragLeave = useCallback((e) => {
    if (!dragHasFiles(e)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  }, []);
  const onDrop = useCallback((e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    resetDrag();
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const file = files.find(isAcceptedFile);
    if (!file) {
      showToast?.('That file type isn\'t supported. Try PDF, DOC, JPG, or PNG.');
      return;
    }
    if (files.length > 1) showToast?.('Only the first file was added. Upload the rest one at a time.');
    openDrawerWithFile(file);
  }, [openDrawerWithFile, resetDrag, showToast]);
  const closeUpload = () => { setUploadCategory(null); setUploadInitialFile(null); };
  const clearSearchAndFilters = () => { setQuery(''); setSearchOpen(false); setFilters(EMPTY_FILTERS); };

  return (
    <div className={styles.wrapper}>
      <DocumentCategoryRail categories={categories} active={category} counts={counts} onSelect={selectCategory} onAddCategory={() => setAddingCategory(true)} />
      <section
        className={styles.main}
        aria-label={categoryLabel}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {searchOpen ? (
          <div className={styles.header}>
            <Input
              autoFocus
              leadingIcon="solar:magnifer-linear"
              placeholder={`Search ${categoryLabel}`}
              aria-label="Search documents"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
              trailingAction="solar:close-linear"
              trailingActionLabel="Close search"
              onTrailingAction={closeSearch}
              wrapperClassName={styles.searchField}
            />
          </div>
        ) : (
          <div className={styles.header}>
            <span className={styles.title}>{categoryLabel}</span>
            <div className={styles.headerActions}>
              <ActionButton icon="solar:magnifer-linear" size="L" tooltip="Search" onClick={() => setSearchOpen(true)} />
              <span className={styles.divider} aria-hidden="true" />
              <Button
                variant="secondary"
                size="L"
                leadingIcon="solar:upload-minimalistic-linear"
                onClick={() => setUploadCategory(category === ALL_CATEGORY ? '' : category)}
              >
                Upload File
              </Button>
              <span className={styles.divider} aria-hidden="true" />
              <ActionButton
                icon="custom:filter"
                size="L"
                tooltip="Filters"
                tooltipLeft
                active={filtersOpen}
                count={filterCount ? String(filterCount) : undefined}
                onClick={() => setFiltersOpen(o => !o)}
              />
            </div>
          </div>
        )}
        <div className={styles.body}>
          {filtersOpen && (
            <FilterBar
              variant="inline"
              multiSelect
              leading={null}
              filterDefs={FILTER_DEFS}
              filters={filters}
              onFilterChange={(key, vals) => setFilters(f => ({ ...f, [key]: vals }))}
              onClearAll={() => setFilters(EMPTY_FILTERS)}
              getOptions={def => uniqueSorted(inCategory.map(d => (def.key === 'types' ? d.type : d.updatedBy)))}
              showMoreFilters={false}
              showSaveFilter={false}
            />
          )}
          {loading && !documents.length ? (
            <SimpleTableSkeleton rows={6} cols={3} />
          ) : rows.length === 0 ? (
            <EmptyDocuments
              narrowed={narrowed}
              category={category}
              categoryLabel={categoryLabel}
              onUpload={() => setUploadCategory(category === ALL_CATEGORY ? '' : category)}
              onClearFilters={clearSearchAndFilters}
            />
          ) : (
            <DocumentsTable
              rows={rows}
              selectedIds={selectedIds}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onOpen={setPreviewDoc}
              onDownload={downloadDocument}
              onAction={rowAction}
            />
          )}
        </div>
        {dragActive && (
          <div className={styles.dropOverlay} role="presentation">
            <div className={styles.dropCard}>
              <Icon name="solar:upload-minimalistic-linear" size={28} color="var(--primary-300)" />
              <div className={styles.dropTitle}>Drop file to upload</div>
              <div className={styles.dropHint}>PDF, DOC, JPG, or PNG, up to 100 MB</div>
            </div>
          </div>
        )}
      </section>
      {previewDoc && <ProgramDocPreviewDrawer doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      {uploadCategory !== null && (
        <UploadDocumentDrawer
          categories={categories}
          initialCategory={uploadCategory}
          initialFile={uploadInitialFile}
          onUpload={(payload) => { upload(payload); setUploadInitialFile(null); }}
          onClose={closeUpload}
        />
      )}
      {editing && (
        <UploadDocumentDrawer categories={categories} doc={editing} initialCategory={categoryOf(editing)} onUpload={saveEdit} onClose={() => setEditing(null)} />
      )}
      {addingCategory && (
        <AddCategoryDialog
          taken={categories.map(c => c.label)}
          onCancel={() => setAddingCategory(false)}
          onAdd={async (name) => {
            const key = await addDocumentCategory(name);
            setAddingCategory(false);
            if (key) selectCategory(key);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          variant="destructive"
          title={`Delete ${deleting.name}?`}
          description="This removes the file from the patient's documents and can't be undone."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
