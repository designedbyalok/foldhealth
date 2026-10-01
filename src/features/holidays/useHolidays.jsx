import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/Button/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { RingEmptyState } from '../../components/RingEmptyState/RingEmptyState';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { SearchIconButton } from '../../components/SearchIconButton/SearchIconButton';
import { toast } from '../../components/Toast/sonnerToast';
import { useAppStore } from '../../store/useAppStore';
import { HolidayDrawer } from './HolidayDrawer';
import { HolidaysTable } from './HolidaysTable';
import { HOLIDAY_ICON, holidaysInYear, holidayYears, sortHolidays } from './holidayUtils';
import styles from './holidays.module.css';

const PER_PAGE = 20;

/**
 * Holidays list with its controls and drawers, shared by Settings → Calendar
 * → Holiday configuration and the calendar's Holidays drawer. Returns the
 * pieces for the caller to place: `tools` (search + New Configuration),
 * `intro` (title, description, Year), `body` (the table) and `elements`
 * (drawers and the delete confirmation).
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.embedded]
 */
export function useHolidays({ embedded = false } = {}) {
  const holidays = useAppStore(s => s.holidayConfigs);
  const fetched = useAppStore(s => s.holidayConfigsFetched);
  const fetchHolidays = useAppStore(s => s.fetchHolidayConfigs);
  const deleteHoliday = useAppStore(s => s.deleteHolidayConfig);
  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [year, setYear] = useState(() => [String(new Date().getFullYear())]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const [form, setForm] = useState(null);       // { holiday? , copyFrom? }
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortHolidays(holidaysInYear(holidays, Number(year[0])))
      .filter(h => !q || h.name.toLowerCase().includes(q) || (h.locations || []).some(l => l.toLowerCase().includes(q)));
  }, [holidays, year, query]);
  const lastPage = Math.max(1, Math.ceil(shown.length / perPage));
  const pageNow = Math.min(page, lastPage);
  const rows = shown.slice((pageNow - 1) * perPage, pageNow * perPage);

  const tools = (
    <>
      {searchOpen ? (
        <SearchBar
          placeholder="Search By Holiday or Location"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          onClose={() => { setSearchOpen(false); setQuery(''); setPage(1); }}
        />
      ) : (
        <SearchIconButton tooltipBelow onClick={() => setSearchOpen(true)} />
      )}
      <Button variant="secondary" size="L" leadingIcon="solar:add-circle-linear" onClick={() => setForm({})}>New Configuration</Button>
    </>
  );

  const intro = (
    <div className={styles.intro}>
      <span className={styles.introText}>
        <h3 className={styles.introTitle}>Holidays</h3>
        <span className={styles.introSub}>Configure holidays to manage calls and messages using phone tree and auto replies during a specific holiday period.</span>
      </span>
      <FilterChip
        label="Year"
        options={holidayYears(holidays).map(String)}
        selected={year}
        onChange={(next) => { if (next.length) { setYear(next); setPage(1); } }}
        singleSelect
        noClear
      />
    </div>
  );

  const body = (
    <HolidaysTable
      holidays={rows}
      loading={!fetched}
      embedded={embedded}
      emptyState={(
        <div className={styles.emptyBox}>
          <RingEmptyState icon={HOLIDAY_ICON} label={query ? 'No holidays match your search' : `No holidays in ${year[0]} yet`} />
        </div>
      )}
      pagination={shown.length > PER_PAGE ? {
        page: pageNow, perPage, totalItems: shown.length, onPageChange: setPage, onPageSizeChange: (n) => { setPerPage(n); setPage(1); },
      } : undefined}
      onEdit={(h) => setForm({ holiday: h })}
      onDuplicate={(h) => setForm({ copyFrom: h })}
      onDelete={setToDelete}
    />
  );

  const elements = (
    <>
      {form && <HolidayDrawer holiday={form.holiday} copyFrom={form.copyFrom} onClose={() => setForm(null)} />}
      {toDelete && (
        <ConfirmDialog
          variant="destructive"
          title="Delete Holiday?"
          description={`${toDelete.name} will be removed from the calendar and its auto reply turned off for ${toDelete.locations.length} location${toDelete.locations.length === 1 ? '' : 's'}.`}
          confirmLabel="Delete Holiday"
          cancelLabel="Cancel"
          loading={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              const ok = await deleteHoliday(toDelete.id);
              if (ok) toast.success('Holiday Deleted Successfully');
              setToDelete(null);
            } finally {
              setDeleting(false);
            }
          }}
        />
      )}
    </>
  );

  return { tools, intro, body, elements, openNew: () => setForm({}) };
}
