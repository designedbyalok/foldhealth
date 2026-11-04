import { Icon } from '../../../../../../../components/Icon/Icon';
import { AddIconMinimalist } from '../../../../../../../components/Icon/AddIconMinimalist';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../../../components/Button/Button';
import { SearchBar } from '../../../../../../../components/SearchBar/SearchBar';
import { Toggle } from '../../../../../../../components/Toggle/Toggle';
import { FilterChip } from '../../../../../../../components/FilterChip/FilterChip';
import { Checkbox } from '../../../../../../../components/Checkbox/Checkbox';
import { EmptyState } from '../../../../../../../components/EmptyState/EmptyState';
import { WorklistShell } from '../../../../../../../components/WorklistShell/WorklistShell';
import { LETTER_SUB_TABS } from './ProgramDetailView.utils';
import styles from './ProgramDetailView.module.css';

// Column widths preserved from the hand-rolled <table> this replaced.
const LETTER_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 36 },
  { key: 'fileName', label: 'File Name' },
  { key: 'fileType', label: 'File Type' },
  { key: 'sentVia', label: 'Sent Via' },
  { key: 'lastSent', label: 'Last Sent' },
  { key: 'sentBy', label: 'Sent By' },
  { key: 'actions', label: '', width: 72 },
];

export function ProgramDetailViewLetters({
  letterSearchOpen,
  setLetterSearchOpen,
  letterSearchText,
  setLetterSearchText,
  activeLetterTab,
  setActiveLetterTab,
  setAddLetterOpen,
  letterFiltersOpen,
  setLetterFiltersOpen,
  letterFilterMeta,
  letterFilters,
  setLetterFilter,
  letterFiltersActive,
  clearLetterFilters,
  allLettersSelected,
  someLettersSelected,
  toggleAllLetters,
  shownLetters,
  selectedLetters,
  toggleLetter,
  setSendTarget,
  setRowMenu,
  setHistoryOpen,
  isLettersPane,
  downloadSelectedLetters,
  letters,
  setSelectedLetters,
  previewLetter,
}) {
  return (
    <>
      <div className={styles.contentInner}>
        <div className={styles.contentSubTabs}>
          {letterSearchOpen ? (
            <div className={styles.letterSearchWrap}>
              <SearchBar fullWidth placeholder="Search letters" value={letterSearchText}
                onChange={e => setLetterSearchText(e.target.value)}
                onClose={() => { setLetterSearchOpen(false); setLetterSearchText(''); }} />
            </div>
          ) : (
            <>
              <ActionButton icon="solar:magnifer-linear" size="sm" tooltip="Search" onClick={() => setLetterSearchOpen(true)} />
              <span className={styles.tabDivider} />
              <Toggle size="sm" items={LETTER_SUB_TABS} value={activeLetterTab} onValueChange={setActiveLetterTab} />
              <div style={{ flex: 1 }} />
            </>
          )}
          <ActionButton size="sm" tooltip="Add" onClick={() => setAddLetterOpen(true)}><AddIconMinimalist size={16} color="var(--neutral-300)" /></ActionButton>
          <ActionButton icon="solar:filter-linear" size="sm" tooltip="Filter" active={letterFiltersOpen}
            iconColor={letterFiltersOpen ? 'var(--primary-300)' : undefined}
            onClick={() => setLetterFiltersOpen(v => !v)} />
          <ActionButton icon="solar:history-linear" size="sm" tooltip="History" onClick={() => setHistoryOpen(true)} />
        </div>

        {letterFiltersOpen && (
          <div className={styles.letterFilterBar}>
            {letterFilterMeta.map(f => (
              <FilterChip key={f.key} label={f.label} options={f.options}
                selected={letterFilters[f.key]} onChange={vals => setLetterFilter(f.key, vals)} />
            ))}
            {letterFiltersActive && (
              <button className={styles.letterClearAll} onClick={clearLetterFilters}>
                <Icon name="solar:backspace-linear" size={16} color="var(--primary-300)" />
                Clear All
              </button>
            )}
          </div>
        )}

        <WorklistShell
          embedded
          header={null}
          columns={LETTER_COLUMNS}
          rows={shownLetters}
          selectedIds={[...selectedLetters]}
          onSelectAll={toggleAllLetters}
          onClearSelection={() => setSelectedLetters(new Set())}
          emptyState={<EmptyState icon="solar:letter-linear" title="No Letters" />}
          minTableWidth={0}
          renderRow={letter => (
            <tr key={letter.id}
              className={`${styles.letterRow} ${selectedLetters.has(letter.id) ? styles.rowSelected : ''}`}>
              <td className={styles.checkCell}>
                <Checkbox checked={selectedLetters.has(letter.id)}
                  onCheckedChange={() => toggleLetter(letter.id)}
                  aria-label={`Select ${letter.fileName}`} />
              </td>
              <td className={`${styles.letterCell} ${styles.fileNameCell} ${styles.clickable}`}
                onClick={() => previewLetter?.(letter)}>{letter.fileName}</td>
              <td className={`${styles.letterCell} ${styles.colMuted}`}>{letter.fileType}</td>
              <td className={styles.letterCell}>
                <span className={styles.viaChips}>
                  {letter.sentVia.map(v => <span key={v} className={styles.viaChip}>{v}</span>)}
                </span>
              </td>
              <td className={styles.letterCell}>{letter.lastSent}</td>
              <td className={styles.letterCell}>{letter.sentBy}</td>
              <td className={`${styles.letterCell} ${styles.rowActionsCell}`}>
                {selectedLetters.size === 0 && (
                  <div className={styles.rowActions}>
                    <ActionButton icon="solar:plain-linear" size="sm" tooltip="Send letter"
                      onClick={() => setSendTarget({ letterName: letter.fileName, clearOnSent: false })} />
                    <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More actions"
                      onClick={(e) => setRowMenu({ id: letter.id, rect: e.currentTarget.getBoundingClientRect() })} />
                  </div>
                )}
              </td>
            </tr>
          )}
        />
      </div>

      {isLettersPane && selectedLetters.size > 0 && (
        <div className={styles.bulkBar} role="toolbar" aria-label="Letter bulk actions">
          <div className={styles.bulkSelect}>
            <Checkbox checked={someLettersSelected ? 'indeterminate' : allLettersSelected}
              onCheckedChange={toggleAllLetters} aria-label="Select all letters" />
            <span className={styles.bulkCount}>{selectedLetters.size} Selected</span>
          </div>
          <span className={styles.bulkDivider} />
          <Button variant="outline" leadingIcon="solar:download-minimalistic-linear" onClick={downloadSelectedLetters}>
            Download Files
          </Button>
          <Button leadingIcon="solar:plain-linear"
            onClick={() => setSendTarget({
              letterName: selectedLetters.size === 1
                ? letters.find(l => selectedLetters.has(l.id))?.fileName || 'Letter'
                : 'Letters',
              clearOnSent: true,
            })}>
            Send Files
          </Button>
          <span className={styles.bulkDivider} />
          <ActionButton icon="solar:close-square-linear" size="sm" tooltip="Clear selection"
            onClick={() => setSelectedLetters(new Set())} />
        </div>
      )}
    </>
  );
}
