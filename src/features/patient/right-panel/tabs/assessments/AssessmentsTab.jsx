import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../components/Button/Button';
import { FilterBar } from '../../../../../components/FilterBar/FilterBar';
import { Input } from '../../../../../components/Input/Input';
import { SimpleTableSkeleton } from '../../../../../components/SimpleTableSkeleton/SimpleTableSkeleton';
import { SubTabs } from '../../../../../components/SubTabs/SubTabs';
import { resolvePatientStoreId } from '../../../../../lib/resolvePatientStoreId';
import { useAppStore } from '../../../../../store/useAppStore';
import { AssessmentDetail } from './AssessmentDetail';
import { AssessmentsTable } from './AssessmentsTable';
import { VIEWS, applyFilters, buildAssessmentRows, filterDefsFor } from './assessmentRows';
import styles from './AssessmentsTab.module.css';

const VIEW_TABS = VIEWS.map(({ key, label }) => ({ key, label }));
const EMPTY_FILTERS = {};

/**
 * The patient's assessments: Forms library forms sent to or filled for this
 * patient, with their responses. A row opens the assessment beside a narrow
 * list (split), which can expand to the full panel.
 */
export function AssessmentsTab({ patient }) {
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const id = useAppStore(s => (selectedPatientId ? String(resolvePatientStoreId(s, selectedPatientId)) : null));
  const data = useAppStore(s => (id ? s.patientAssessments[id] : null));
  const fetchAssessments = useAppStore(s => s.fetchPatientAssessments);
  const runPatientRowAction = useAppStore(s => s.runPatientRowAction);
  useEffect(() => { if (id) fetchAssessments(id); }, [id, fetchAssessments]);

  const [view, setView] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [responseIndex, setResponseIndex] = useState(0);
  const [full, setFull] = useState(false);

  const rows = useMemo(() => (data ? buildAssessmentRows(data) : []), [data]);
  const filterDefs = useMemo(() => filterDefsFor(rows), [rows]);
  const shown = useMemo(() => {
    const test = VIEWS.find(v => v.key === view)?.test;
    const q = query.trim().toLowerCase();
    return applyFilters(rows, filterDefs, filters)
      .filter(r => (!test || test(r)) && (!q || r.name.toLowerCase().includes(q)));
  }, [rows, filterDefs, filters, view, query]);
  const openRow = rows.find(r => r.id === openId) || null;
  const filterCount = Object.values(filters).reduce((n, v) => n + v.length, 0);
  const narrowed = filterCount || view !== 'all' || query.trim();

  const sendAssessment = (formIds) => runPatientRowAction('Send Assessment', {
    id: patient?.id ?? selectedPatientId, memberId: patient?.memberId, name: patient?.name,
  }, formIds ? { initialFormIds: formIds } : {});
  const open = (rowId) => { setOpenId(rowId); setResponseIndex(0); };
  const close = () => { setOpenId(null); setFull(false); };
  const closeSearch = () => { setSearchOpen(false); setQuery(''); };
  const toggle = rowId => setSelectedIds(ids => (ids.includes(rowId) ? ids.filter(x => x !== rowId) : [...ids, rowId]));

  const detail = openRow && (
    <AssessmentDetail
      key={openRow.id}
      row={openRow}
      index={responseIndex}
      onIndex={setResponseIndex}
      patientName={patient?.name || 'Patient'}
      full={full}
      onToggleFull={() => setFull(f => !f)}
      onResend={() => sendAssessment([openRow.id])}
      onClose={close}
    />
  );
  if (detail && full) return <div className={styles.fullDetail}>{detail}</div>;

  return (
    <div className={`${styles.wrapper} ${detail ? styles.split : ''}`}>
      <div className={styles.listPane}>
        {searchOpen ? (
          <div className={`${styles.toolbar} ${styles.searchRow}`}>
            <Input
              autoFocus
              leadingIcon="solar:magnifer-linear"
              placeholder="Search Assessments"
              aria-label="Search assessments"
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
          <div className={styles.toolbar}>
            <SubTabs
              className={styles.views}
              tabs={VIEW_TABS}
              activeKey={view}
              onChange={setView}
              leading={(
                <>
                  <ActionButton icon="solar:magnifer-linear" tooltip="Search" aria-label="Search assessments" onClick={() => setSearchOpen(true)} />
                  <span className={styles.divider} aria-hidden="true" />
                </>
              )}
            />
            {!detail && (
              <>
                <Button variant="soft" leadingIcon="solar:add-circle-linear" onClick={() => sendAssessment()}>
                  Send Assessment
                </Button>
                <span className={styles.divider} aria-hidden="true" />
              </>
            )}
            <ActionButton
              icon="custom:filter"
              tooltip="Filters"
              tooltipLeft
              aria-label="Filters"
              active={filtersOpen}
              disabled={!filterDefs.length}
              count={filterCount ? String(filterCount) : undefined}
              onClick={() => setFiltersOpen(o => !o)}
            />
          </div>
        )}
        {filtersOpen && filterDefs.length > 0 && (
          <FilterBar
            variant="inline"
            multiSelect
            leading={null}
            filterDefs={filterDefs}
            filters={filters}
            onFilterChange={(key, vals) => setFilters(f => ({ ...f, [key]: vals }))}
            onClearAll={() => setFilters(EMPTY_FILTERS)}
            getOptions={def => def.options}
            showMoreFilters={false}
            showSaveFilter={false}
          />
        )}
        {!data
          ? <SimpleTableSkeleton rows={5} cols={detail ? 2 : 5} />
          : (
            <AssessmentsTable
              rows={shown}
              compact={!!detail}
              activeId={openId}
              selectedIds={selectedIds}
              onToggle={toggle}
              onToggleAll={checked => setSelectedIds(checked ? shown.map(r => r.id) : [])}
              onOpen={open}
              emptyLabel={narrowed ? 'No Matching Assessments' : 'No Assessments Sent'}
            />
          )}
      </div>
      {detail && <div className={styles.detailPane}>{detail}</div>}
    </div>
  );
}
