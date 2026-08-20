import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../../../../../../components/Button/Button';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Toggle } from '../../../../../../../../components/Toggle/Toggle';
import { SearchBar } from '../../../../../../../../components/SearchBar/SearchBar';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { DocumentUploader } from '../../../../../../../../components/DocumentUploader/DocumentUploader';
import { RingEmptyState } from '../../../../../../../../components/RingEmptyState/RingEmptyState';
import { FilterChip } from '../../../../../../../../components/FilterChip/FilterChip';
import { DateRangePopover } from '../../../../../../../../components/DateRangePopover/DateRangePopover';
import { ImagePreviewOverlay } from '../../../../../../../../components/ImagePreviewOverlay/ImagePreviewOverlay';
import { resolveFileKind } from '../../../../../../../../components/FilePreview/FilePreview.utils';
import { ProgramDocPreviewDrawer } from '../ProgramDocPreviewDrawer/ProgramDocPreviewDrawer';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import styles from './ProgramRelatedFiles.module.css';

const SUB_TABS = ['Program Related', 'All Documents'];

const VIEW_ITEMS = [
  { key: 'list', icon: 'solar:list-linear' },
  { key: 'grid', icon: 'solar:widget-linear' },
];

const EMPTY_FILE_FILTERS = { fileType: [], lastUpdated: [], dateAdded: [] };

const todayMMDDYYYY = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

// updatedDate is stored as MM/DD/YYYY (display format); parse it back to a
// Date so it can be compared against the ISO range from DateRangePopover.
const parseMMDDYYYY = (s) => {
  const [m, d, y] = (s || '').split('/');
  return m && d && y ? new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`) : null;
};

const inRange = (date, [startIso, endIso]) => {
  if (!date) return false;
  const t = date.getTime();
  if (startIso && t < new Date(startIso).getTime()) return false;
  if (endIso && t > new Date(endIso).getTime()) return false;
  return true;
};

const extOf = (filename) => {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  return m ? m[1].toLowerCase() : null;
};

// Only offer the click-to-preview affordance when there's an actual file to
// show (fileUrl once persisted, or the in-memory File for the same session)
// — otherwise FilePreview would just render an empty drawer/overlay.
const previewKindOf = (d) => (d.fileUrl || d.file)
  ? resolveFileKind({ src: d.fileUrl, name: d.name, ext: d.ext })
  : null;
const isPreviewable = (d) => ['image', 'pdf', 'docx'].includes(previewKindOf(d));

/**
 * Program Documents step — a patient's document library. Empty by default;
 * documents accrue as the user uploads them via the inline DocumentUploader
 * (opened by the "Upload File" toolbar button). Uploaded docs persist to the
 * `program_documents` table, scoped by programCode + patientId.
 *
 * Toolbar/search/tab formatting mirrors the Letters step; the view Toggle
 * switches between the list table and a card grid (doc cards match the Add
 * Letter card layout).
 */
export function ProgramRelatedFiles({ programCode, patientId }) {
  const [activeTab, setActiveTab] = useState('Program Related');
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState(() => new Set());
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILE_FILTERS);
  const [previewDoc, setPreviewDoc] = useState(null);
  const setFilter = (key, vals) => setFilters(prev => ({ ...prev, [key]: vals }));
  const filtersActive = Object.values(filters).some(v => v.length > 0);

  const fetchProgramDocuments = useAppStore(s => s.fetchProgramDocuments);
  const addProgramDocument = useAppStore(s => s.addProgramDocument);
  const programDocuments = useAppStore(s => s.programDocuments);
  useEffect(() => { fetchProgramDocuments(); }, [fetchProgramDocuments]);

  const docs = useMemo(() => programDocuments.filter(d =>
    d.programCode === programCode
    && (patientId == null || String(d.patientId) === String(patientId))
  ), [programDocuments, programCode, patientId]);

  const fileTypeOptions = useMemo(() => [...new Set(docs.map(d => d.type).filter(Boolean))], [docs]);

  // Set, not includes(): the lookup runs once per doc, so an array scan makes
  // this O(docs x selectedTypes).
  const fileTypeSet = useMemo(() => new Set(filters.fileType), [filters.fileType]);

  const filtered = useMemo(() => docs.filter(d => {
    if (fileTypeSet.size > 0 && !fileTypeSet.has(d.type)) return false;
    if (filters.lastUpdated.length === 2 && !inRange(parseMMDDYYYY(d.updatedDate), filters.lastUpdated)) return false;
    if (filters.dateAdded.length === 2 && !inRange(d.createdAt ? new Date(d.createdAt) : null, filters.dateAdded)) return false;
    return true;
  }), [docs, filters, fileTypeSet]);

  const q = searchText.trim().toLowerCase();
  const rows = useMemo(
    () => (q ? filtered.filter(d => (d.name || '').toLowerCase().includes(q)) : filtered),
    [filtered, q],
  );

  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
  const someSelected = rows.some(r => selected.has(r.id)) && !allSelected;
  const toggleAll = () => setSelected(prev => (prev.size === rows.length ? new Set() : new Set(rows.map(r => r.id))));
  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const handleUpload = ({ file, caption, category }) => {
    addProgramDocument({
      id: `pd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      programCode,
      patientId: patientId != null ? String(patientId) : null,
      name: caption || file.name,
      type: category,
      sizeBytes: file.size,
      updatedBy: 'You',
      updatedDate: todayMMDDYYYY(),
      createdAt: new Date().toISOString(),
      ext: extOf(file.name),
    }, file);
    setUploaderOpen(false);
  };

  return (
    <div className={styles.container}>
      {/* Toolbar — mirrors the Letters step formatting. */}
      <div className={styles.toolbar}>
        {searchOpen ? (
          <div className={styles.searchWrap}>
            <SearchBar
              fullWidth
              placeholder="Search documents"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onClose={() => { setSearchOpen(false); setSearchText(''); }}
            />
          </div>
        ) : (
          <>
            <ActionButton icon="solar:magnifer-linear" size="S" tooltip="Search" onClick={() => setSearchOpen(true)} />
            <span className={styles.tabDivider} />
            {SUB_TABS.map(tab => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
            <div className={styles.spacer} />
          </>
        )}
        <Toggle size="S" items={VIEW_ITEMS} active={view} onChange={setView} />
        <Button
          variant="tertiary"
          size="L"
          leadingIcon="solar:upload-minimalistic-linear"
          onClick={() => setUploaderOpen(v => !v)}
        >
          Upload File
        </Button>
        <span className={styles.tabDivider} />
        <ActionButton icon="solar:filter-linear" size="S" tooltip="Filter" active={filtersOpen}
          iconColor={filtersOpen ? 'var(--primary-300)' : undefined}
          onClick={() => setFiltersOpen(v => !v)} />
      </div>

      {filtersOpen && (
        <div className={styles.filterBar}>
          <FilterChip label="File Type" options={fileTypeOptions}
            selected={filters.fileType} onChange={vals => setFilter('fileType', vals)} />
          <FilterChip label="Last Updated" active={filters.lastUpdated.length === 2}
            onClear={() => setFilter('lastUpdated', [])}
            activeSummary={filters.lastUpdated.length === 2 ? `${filters.lastUpdated[0]} – ${filters.lastUpdated[1]}` : undefined}
            renderPopover={({ anchorRect, onClose }) => (
              <DateRangePopover anchorRect={anchorRect} label="Last Updated"
                selected={filters.lastUpdated} onChange={vals => setFilter('lastUpdated', vals)} onClose={onClose} />
            )} />
          <FilterChip label="Date Added" active={filters.dateAdded.length === 2}
            onClear={() => setFilter('dateAdded', [])}
            activeSummary={filters.dateAdded.length === 2 ? `${filters.dateAdded[0]} – ${filters.dateAdded[1]}` : undefined}
            renderPopover={({ anchorRect, onClose }) => (
              <DateRangePopover anchorRect={anchorRect} label="Date Added"
                selected={filters.dateAdded} onChange={vals => setFilter('dateAdded', vals)} onClose={onClose} />
            )} />
          {filtersActive && (
            <button className={styles.clearAll} onClick={() => setFilters(EMPTY_FILE_FILTERS)}>
              <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
              Clear All
            </button>
          )}
        </div>
      )}

      {uploaderOpen && (
        <div className={styles.uploaderWrap}>
          <DocumentUploader onSubmit={handleUpload} onCancel={() => setUploaderOpen(false)} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <RingEmptyState icon="solar:file-text-linear" label={q ? 'No Documents Found' : 'No Documents Added'} />
        </div>
      ) : view === 'grid' ? (
        <div className={styles.grid}>
          {rows.map(f => (
            <div key={f.id} className={`${styles.card} ${isPreviewable(f) ? styles.clickable : ''}`}
              onClick={isPreviewable(f) ? () => setPreviewDoc(f) : undefined}>
              <div className={styles.cardThumb}>
                <Icon name="solar:file-text-linear" size={40} color="var(--neutral-200)" />
              </div>
              <div className={styles.cardFooter}>
                <span className={styles.cardName}>{f.name}</span>
                <span className={styles.cardType}>{f.type}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.table}>
          <div className={styles.headRow}>
            <span className={styles.checkCell}>
              <Checkbox checked={someSelected ? 'indeterminate' : allSelected} onCheckedChange={toggleAll} aria-label="Select all files" />
            </span>
            <span className={styles.nameCell}>File Name</span>
            <span className={styles.typeCell}>File Type</span>
            <span className={styles.updatedCell}>Last Updated</span>
          </div>
          {rows.map(f => (
            <div key={f.id} className={styles.row}>
              <span className={styles.checkCell}>
                <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggleOne(f.id)} aria-label={`Select ${f.name}`} />
              </span>
              <span className={`${styles.nameCell} ${isPreviewable(f) ? styles.clickable : ''}`}
                onClick={isPreviewable(f) ? () => setPreviewDoc(f) : undefined}>{f.name}</span>
              <span className={styles.typeCell}>{f.type}</span>
              <span className={styles.updatedCell}>
                <span className={styles.updatedBy}>{f.updatedBy}</span>
                <span className={styles.updatedDate}>{f.updatedDate}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {previewDoc && (previewKindOf(previewDoc) === 'image'
        ? <ImagePreviewOverlay doc={previewDoc} onClose={() => setPreviewDoc(null)} />
        : <ProgramDocPreviewDrawer doc={previewDoc} onClose={() => setPreviewDoc(null)} />)}
    </div>
  );
}
