import { useMemo, useState } from 'react';
import { Drawer } from '../Drawer/Drawer';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import { SearchBar } from '../SearchBar/SearchBar';
import { FilterChip } from '../FilterChip/FilterChip';
import { Checkbox } from '../Checkbox/Checkbox';
import { DocumentUploadForm } from '../DocumentUploadForm/DocumentUploadForm';
import { useDocumentUploadForm } from '../DocumentUploadForm/useDocumentUploadForm';
import styles from './DocumentPickerDrawer.module.css';
import { openSafeUrl } from '../../lib/openSafeUrl';

const LAST_UPDATE_OPTIONS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'Last 12 Months', days: 365 },
];
const EMPTY_FILTERS = { type: [], lastUpdate: [] };

const fmtDate = (d) => (d
  ? `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
  : '');

/**
 * DocumentPickerDrawer: pick existing patient documents to attach
 * (Figma New Care Gap Workflow 19:57753). Search, Type and Last Update
 * filters; rows with checkbox, name, "type • Added on: date", a per-row Add
 * and a preview. Header "Add Selected" adds every checked document.
 *
 * @param {object}   props
 * @param {Array}    props.documents  – [{ id, name, type?, addedAt?: Date|string, url? }]
 * @param {string[]} [props.alreadyAdded] – ids already on the target (shown as Added)
 * @param {function} props.onAdd      – (docs[]) => void
 * @param {function} props.onClose
 * @param {string}   [props.title='Select from Documents']
 * @param {function} [props.onUpload] – ({ file, caption, docType }) => doc; shows the Upload action
 * @param {string[]} [props.docTypes] – Document Type options for the upload form
 */
export function DocumentPickerDrawer({ documents = [], alreadyAdded = [], onAdd, onClose, title = 'Select from Documents', onUpload, docTypes = [] }) {
  const [uploading, setUploading] = useState(false);
  const upload = useDocumentUploadForm();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [checked, setChecked] = useState(() => new Set());
  // "Last N days" is measured from when the drawer opened.
  const [openedAt] = useState(() => Date.now());
  const added = useMemo(() => new Set(alreadyAdded), [alreadyAdded]);

  const rows = useMemo(() => documents.map(d => {
    const at = d.addedAt ? new Date(d.addedAt) : null;
    return { ...d, at: at && !Number.isNaN(at.getTime()) ? at : null };
  }), [documents]);
  const typeOptions = useMemo(() => [...new Set(rows.map(r => r.type).filter(Boolean))].sort(), [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const range = LAST_UPDATE_OPTIONS.find(o => o.label === filters.lastUpdate[0]);
    const from = range ? openedAt - range.days * 86400000 : null;
    return rows.filter(r => {
      if (q && !`${r.name} ${r.type || ''}`.toLowerCase().includes(q)) return false;
      if (filters.type.length && !filters.type.includes(r.type)) return false;
      if (from && (!r.at || r.at.getTime() < from)) return false;
      return true;
    });
  }, [rows, search, filters, openedAt]);

  const selectable = visible.filter(r => !added.has(r.id));
  const allChecked = selectable.length > 0 && selectable.every(r => checked.has(r.id));
  const someChecked = selectable.some(r => checked.has(r.id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(selectable.map(r => r.id)));
  const toggleOne = (id) => setChecked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const addDocs = (docs) => {
    if (!docs.length) return;
    onAdd?.(docs);
    setChecked(prev => {
      const next = new Set(prev);
      docs.forEach(d => next.delete(d.id));
      return next;
    });
  };
  const checkedDocs = rows.filter(r => checked.has(r.id) && !added.has(r.id));

  const openUpload = () => { upload.reset(); setUploading(true); };
  // A fresh upload lands back on the list already checked, ready to add.
  const submitUpload = () => {
    if (!upload.canSave) return;
    const doc = onUpload({ file: upload.file, caption: upload.caption.trim(), docType: upload.docType });
    if (doc?.id) setChecked(prev => new Set(prev).add(doc.id));
    upload.reset();
    setUploading(false);
  };

  return (
    <Drawer
      title={title}
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <div className={styles.headerRight}>
          <Button disabled={!checkedDocs.length} onClick={() => { addDocs(checkedDocs); onClose?.(); }}>
            {checkedDocs.length ? `Add Selected (${checkedDocs.length})` : 'Add Selected'}
          </Button>
          <span className={styles.headerDivider} />
        </div>
      )}
    >
      <div className={styles.toolbar}>
        {searchOpen ? (
          <SearchBar
            className={styles.search}
            placeholder="Search documents"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClose={() => { setSearchOpen(false); setSearch(''); }}
          />
        ) : (
          <ActionButton size="sm" icon="solar:magnifer-linear" tooltip="Search" onClick={() => setSearchOpen(true)} />
        )}
        <span className={styles.divider} />
        <FilterChip size="S" label="Type" options={typeOptions} selected={filters.type} onChange={v => setFilters(f => ({ ...f, type: v }))} />
        <FilterChip size="S" label="Last Update" options={LAST_UPDATE_OPTIONS.map(o => o.label)} selected={filters.lastUpdate} onChange={v => setFilters(f => ({ ...f, lastUpdate: v }))} singleSelect />
        {onUpload && (
          <ActionButton
            size="sm"
            icon="solar:upload-minimalistic-linear"
            tooltip="Upload"
            tooltipLeft
            active={uploading}
            className={styles.uploadBtn}
            onClick={() => (uploading ? setUploading(false) : openUpload())}
          />
        )}
      </div>

      {/* Upload opens inline above the list, so the new document lands in
          the same view it's picked from. */}
      {uploading && (
        <div className={styles.uploadCard}>
          <span className={styles.uploadTitle}>Upload Document</span>
          <DocumentUploadForm form={upload} docTypes={docTypes} />
          <div className={styles.uploadActions}>
            <Button size="sm" disabled={!upload.canSave} onClick={submitUpload}>Upload</Button>
            <Button variant="outline" size="sm" onClick={() => setUploading(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="solar:folder-linear" size={32} color="var(--neutral-200)" />
          <p>No documents uploaded for this patient yet.</p>
        </div>
      ) : (
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colCheck} />
            <col />
            <col className={styles.colActions} />
          </colgroup>
          <thead>
            <tr>
              <th className={styles.th}>
                <Checkbox
                  checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  disabled={!selectable.length}
                  aria-label="Select all documents"
                />
              </th>
              <th className={styles.th}>File Name</th>
              <th className={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={3} className={styles.noMatch}>No documents match these filters.</td></tr>
            ) : visible.map(r => {
              const isAdded = added.has(r.id);
              return (
                <tr key={r.id} className={styles.row}>
                  <td className={styles.td}>
                    <Checkbox
                      checked={isAdded || checked.has(r.id)}
                      disabled={isAdded}
                      onCheckedChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.name}`}
                    />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.fileCell}>
                      <Icon name="solar:file-linear" size={20} color="var(--neutral-400)" />
                      <div className={styles.fileText}>
                        <span className={styles.fileName}>{r.name}</span>
                        <span className={styles.fileMeta}>
                          {[r.type, r.at ? `Added on: ${fmtDate(r.at)}` : ''].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.actions}>
                      <Button variant="outline" size="sm" disabled={isAdded} onClick={() => addDocs([r])}>
                        {isAdded ? 'Added' : 'Add'}
                      </Button>
                      <span className={styles.divider} />
                      <ActionButton
                        size="sm"
                        icon="solar:eye-linear"
                        tooltip={r.url ? 'Preview' : 'Preview not available'}
                        disabled={!r.url}
                        onClick={() => { if (r.url) openSafeUrl(r.url, 'noopener'); }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Drawer>
  );
}
