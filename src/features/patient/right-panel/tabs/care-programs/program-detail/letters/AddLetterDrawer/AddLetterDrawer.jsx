import { useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { Button } from '../../../../../../../../components/Button/Button';
import { Toggle } from '../../../../../../../../components/Toggle/Toggle';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { FilterChip } from '../../../../../../../../components/FilterChip/FilterChip';
import { Checkbox } from '../../../../../../../../components/Checkbox/Checkbox';
import { WorklistShell } from '../../../../../../../../components/WorklistShell/WorklistShell';
import styles from './AddLetterDrawer.module.css';

// MM/DD/YYYY → epoch (for the Last updated sort).
const toTime = (d = '') => { const [m, dd, y] = d.split('/'); return new Date(+y, +m - 1, +dd).getTime() || 0; };

// Coarse category derived from the letter name (no category column upstream).
const letterCategory = (name = '') => {
  if (/welcome|consent|enroll/i.test(name)) return 'Onboarding';
  if (/invite|ict|icp/i.test(name)) return 'Invitation';
  if (/education|flyer|nps/i.test(name)) return 'Education';
  return 'Other';
};

const VIEW_ITEMS = [
  { key: 'grid', icon: 'solar:widget-4-linear' },
  { key: 'list', icon: 'solar:list-linear' },
];
const EMPTY_LETTERS = [];

// Mirrors the grid this table replaced: 32 / fill / 130 / 160.
const LETTER_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 32 },
  { key: 'name', label: 'File Name' },
  { key: 'lastSent', label: 'Last updated', sortKey: 'lastSent', sortType: 'date', width: 130 },
  { key: 'actions', label: 'Actions', width: 160 },
];

function LetterThumb() {
  return <Avatar type="icon" variant="others" iconName="solar:document-text-linear" size="M" />;
}

/**
 * Add Letter drawer: browse the letters library and add templates to the
 * program. Figma 2334-319071. Built on the shared Drawer.
 */
const AddButton = ({ letter, added, onAdd }) => (
  added
    ? <Button variant="soft" size="sm" className={styles.addBtn} disabled>Added</Button>
    : <Button variant="soft" size="sm" className={styles.addBtn} onClick={() => onAdd(letter)}>Add</Button>
);

export function AddLetterDrawer({ letters = EMPTY_LETTERS, addedIds, onAdd, onPreview, onDownload, onClose }) {
  const [search, setSearch] = useState('');
  const [typeSel, setTypeSel] = useState([]);
  const [catSel, setCatSel] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'grid'
  const [selected, setSelected] = useState(() => new Set());
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const handleSort = (key) => {
    setSortDir(d => (sortKey === key && d === 'asc') ? 'desc' : 'asc');
    setSortKey(key);
  };

  const typeOptions = useMemo(() => [...new Set(letters.flatMap(l => l.fileType ? [l.fileType] : []))], [letters]);
  const catOptions = useMemo(() => [...new Set(letters.map(l => letterCategory(l.fileName)))], [letters]);
  const typeSelSet = useMemo(() => new Set(typeSel), [typeSel]);
  const catSelSet = useMemo(() => new Set(catSel), [catSel]);

  const q = search.trim().toLowerCase();
  const filtered = letters.filter(l =>
    (!q || l.fileName.toLowerCase().includes(q))
    && (!typeSel.length || typeSelSet.has(l.fileType))
    && (!catSel.length || catSelSet.has(letterCategory(l.fileName))));
  const rows = sortKey === 'lastSent'
    ? filtered.toSorted((a, b) => (sortDir === 'asc' ? 1 : -1) * (toTime(a.lastSent) - toTime(b.lastSent)))
    : filtered;

  const toggle = (id) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const isAdded = (id) => addedIds?.has(id);

  return (
    <Drawer title="Add Letter" onClose={onClose} bodyClassName={styles.body}>
      <div className={styles.toolbar}>
        <FilterChip label="Type" options={typeOptions} selected={typeSel} onChange={setTypeSel} />
        <FilterChip label="Category" options={catOptions} selected={catSel} onChange={setCatSel} />
        <span className={styles.toolbarDivider} />
        <Toggle items={VIEW_ITEMS} value={view} onValueChange={setView} size="sm" />
        <span className={styles.toolbarDivider} />
        <div className={styles.searchBox}>
          <Icon name="solar:magnifer-linear" size={16} color="var(--neutral-200)" />
          <input aria-label="Search letters" placeholder="Search Letters" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {view === 'list' ? (
        <WorklistShell
          embedded
          header={null}
          columns={LETTER_COLUMNS}
          rows={rows}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          selectedIds={[...selected]}
          onSelectAll={() => setSelected(prev => (prev.size === rows.length ? new Set() : new Set(rows.map(r => r.id))))}
          onClearSelection={() => setSelected(new Set())}
          emptyState={<div className={styles.empty}>No letters match your filters.</div>}
          minTableWidth={0}
          renderRow={l => (
            <tr key={l.id} className={styles.row}>
              <td className={styles.checkCell} onClick={e => e.stopPropagation()}>
                <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} aria-label={`Select ${l.fileName}`} />
              </td>
              <td className={styles.nameCol}>
                <span className={styles.nameInner}>
                  <LetterThumb />
                  <span className={styles.nameBlock}>
                    <span className={styles.name}>{l.fileName}</span>
                    <span className={styles.subtype}>{l.fileType}</span>
                  </span>
                </span>
              </td>
              <td className={styles.dateCol}>{l.lastSent || '-'}</td>
              <td className={styles.actionsCol}>
                <span className={styles.actions}>
                  <AddButton letter={l} added={isAdded(l.id)} onAdd={onAdd} />
                  <span className={styles.actionDivider} />
                  <ActionButton icon="solar:eye-linear" size="sm" tooltip="Preview" onClick={() => onPreview(l)} />
                  <span className={styles.actionDivider} />
                  <ActionButton icon="solar:download-minimalistic-linear" size="sm" tooltip="Download" onClick={() => onDownload(l)} />
                </span>
              </td>
            </tr>
          )}
        />
      ) : (
        <div className={styles.grid}>
          {rows.map(l => (
            <div key={l.id} className={styles.card}>
              <div className={styles.preview}>
                {l.contentBase64 ? (
                  <iframe
                    className={styles.previewFrame}
                    src={`data:application/pdf;base64,${l.contentBase64}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                    title={l.fileName}
                    tabIndex={-1}
                  />
                ) : (
                  <div className={styles.previewPlaceholder}>
                    <Icon name="solar:document-text-linear" size={40} color="var(--neutral-200)" />
                  </div>
                )}
                <div className={styles.previewOverlay}>
                  <Button variant="outline" onClick={() => onPreview(l)}>Preview</Button>
                  {isAdded(l.id)
                    ? <Button disabled>Added</Button>
                    : <Button onClick={() => onAdd(l)}>Add File</Button>}
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span className={styles.name}>{l.fileName}</span>
                <span className={styles.subtype}>{l.fileType}</span>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className={styles.empty}>No letters match your filters.</div>}
        </div>
      )}
    </Drawer>
  );
}
