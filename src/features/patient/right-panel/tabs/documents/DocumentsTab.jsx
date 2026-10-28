import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../../../../components/ConfirmDialog/ConfirmDialog';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../components/Button/Button';
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
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [uploadCategory, setUploadCategory] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
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

  return (
    <div className={styles.wrapper}>
      <DocumentCategoryRail categories={categories} active={category} counts={counts} onSelect={selectCategory} onAddCategory={() => setAddingCategory(true)} />
      <section className={styles.main} aria-label={categoryLabel}>
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
          {loading && !documents.length
            ? <SimpleTableSkeleton rows={6} cols={3} />
            : (
              <DocumentsTable
                rows={rows}
                selectedIds={selectedIds}
                onToggle={toggle}
                onToggleAll={toggleAll}
                onOpen={setPreviewDoc}
                onDownload={downloadDocument}
                onAction={rowAction}
                emptyLabel={narrowed
                  ? 'No documents match your search or filters.'
                  : `No ${category === ALL_CATEGORY ? 'documents' : categoryLabel} uploaded yet.`}
              />
            )}
        </div>
      </section>
      {previewDoc && <ProgramDocPreviewDrawer doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      {uploadCategory !== null && (
        <UploadDocumentDrawer categories={categories} initialCategory={uploadCategory} onUpload={upload} onClose={() => setUploadCategory(null)} />
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
