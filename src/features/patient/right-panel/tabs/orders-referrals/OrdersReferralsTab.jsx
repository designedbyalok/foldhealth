import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../components/Button/Button';
import { FilterBar } from '../../../../../components/FilterBar/FilterBar';
import { Input } from '../../../../../components/Input/Input';
import { SubTabs } from '../../../../../components/SubTabs/SubTabs';
import { TableSkeleton } from '../../../../../components/TableSkeleton/TableSkeleton';
import { EmptyState } from '../../../../../components/EmptyState/EmptyState';
import { useAppStore } from '../../../../../store/useAppStore';
import { REFERRAL_STATUSES } from '../../../data/patientReferrals';
import { AddMedicationsDrawer } from '../../../left-panel/tabs/pami-hx/AddMedicationsDrawer/AddMedicationsDrawer';
import { NewOrderDrawer } from './NewOrderDrawer';
import { NewReferralDrawer } from './NewReferralDrawer';
import { OrdersTable } from './OrdersTable';
import { ReferralsTable } from './ReferralsTable';
import { AttachmentPreviewDrawer, ReferralDetailDrawer } from './ReferralDrawers';
import {
  DATE_RANGE_LABELS, EMPTY_FILTERS, VIEW_TABS, applyFilters, filterDefsFor, medicationRow, optionsOf, orderRow, referralRow, viewOf,
} from './ordersViews';
import styles from './OrdersReferralsTab.module.css';

const EMPTY = [];
const NEW_ORDER_ITEMS = [
  { key: 'referral', icon: 'solar:square-share-line-linear', label: 'Referral' },
  { key: 'lab', icon: 'solar:test-tube-linear', label: 'Lab' },
  { key: 'imaging', icon: 'solar:gallery-linear', label: 'Imaging' },
  { key: 'medication', icon: 'solar:pill-linear', label: 'Medication' },
];

function usePatientOrders(patientId) {
  const referrals = useAppStore(s => (patientId ? s.patientReferrals[patientId] : null)) || EMPTY;
  const referralsLoaded = useAppStore(s => (patientId ? s.patientReferralsLoadedFor[patientId] : false));
  const fetchPatientReferrals = useAppStore(s => s.fetchPatientReferrals);
  const meds = useAppStore(s => (patientId ? s.patientMedications[patientId] : null)) || EMPTY;
  const fetchPatientMedications = useAppStore(s => s.fetchPatientMedications);
  const orders = useAppStore(s => (patientId ? s.patientOrders[patientId] : null)) || EMPTY;
  const ordersLoaded = useAppStore(s => (patientId ? s.patientOrdersLoadedFor[patientId] : false));
  const fetchPatientOrders = useAppStore(s => s.fetchPatientOrders);
  // The medications loaded-for flag flips before the query returns and back
  // on error, so the skeleton waits on this fetch instead.
  const [medsFetchedFor, setMedsFetchedFor] = useState(null);

  useEffect(() => { if (patientId) fetchPatientReferrals(patientId); }, [patientId, fetchPatientReferrals]);
  useEffect(() => { if (patientId) fetchPatientOrders(patientId); }, [patientId, fetchPatientOrders]);
  useEffect(() => {
    if (!patientId) return undefined;
    let live = true;
    Promise.resolve(fetchPatientMedications(patientId)).finally(() => { if (live) setMedsFetchedFor(patientId); });
    return () => { live = false; };
  }, [patientId, fetchPatientMedications]);

  const rows = useMemo(() => ({
    referral: referrals.map(referralRow),
    lab: orders.filter(o => o.type === 'lab').map(orderRow),
    imaging: orders.filter(o => o.type === 'imaging').map(orderRow),
    medication: meds.map(medicationRow),
  }), [referrals, orders, meds]);
  const loading = { referral: !referralsLoaded, lab: !ordersLoaded, imaging: !ordersLoaded, medication: medsFetchedFor !== patientId };
  return { rows, loading };
}

/**
 * The patient's orders and referrals (Figma P360 Revamp 54:34442): Referral,
 * Lab, Imaging and Medication views with search, filters and New Order.
 */
export function OrdersReferralsTab({ patient }) {
  const patientId = useAppStore(s => s.selectedPatientId);
  const { rows, loading } = usePatientOrders(patientId);
  const [view, setView] = useState('referral');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [openReferral, setOpenReferral] = useState(null);
  const [preview, setPreview] = useState(null);
  const [creating, setCreating] = useState(null);

  const viewRows = rows[view];
  const shown = useMemo(() => applyFilters(viewRows, { query, filters }), [viewRows, query, filters]);
  const filterCount = filters.status.length + filters.referredTo.length + filters.created.length;
  const { label, noun } = viewOf(view);
  const emptyLabel = viewRows.length ? `No ${noun} match these filters` : `No ${noun} for this patient yet`;
  const EMPTY_ICON = { referral: 'custom:refer', lab: 'solar:test-tube-linear', imaging: 'solar:scanner-linear', medication: 'solar:pill-linear' };

  const switchView = (key) => { setView(key); setFilters(EMPTY_FILTERS); setSelectedIds([]); };
  const closeSearch = () => { setSearchOpen(false); setQuery(''); };
  const toggle = id => setSelectedIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));
  const toggleAll = () => setSelectedIds(ids => (ids.length === shown.length ? [] : shown.map(r => r.id)));
  const startOrder = (key) => { if (key !== view) switchView(key); setCreating(key); };
  const closeCreate = () => setCreating(null);
  const getOptions = def => ({
    status: view === 'referral' ? REFERRAL_STATUSES : optionsOf(viewRows, 'status'),
    referredTo: optionsOf(viewRows, 'toName'),
    created: DATE_RANGE_LABELS,
  })[def.key];

  const tableProps = { rows: shown, selectedIds, onToggle: toggle, onToggleAll: toggleAll, emptyLabel };

  return (
    <div className={styles.wrapper}>
      {searchOpen ? (
        <div className={`${styles.toolbar} ${styles.searchRow}`}>
          <Input
            autoFocus
            leadingIcon="solar:magnifer-linear"
            placeholder={`Search ${label}`}
            aria-label={`Search ${noun}`}
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
            value={view}
            onValueChange={switchView}
            leading={(
              <>
                <ActionButton icon="solar:magnifer-linear" tooltip="Search" aria-label={`Search ${noun}`} onClick={() => setSearchOpen(true)} />
                <span className={styles.divider} aria-hidden="true" />
              </>
            )}
          />
          <Button
            variant="outline" tone="primary"
            leadingIcon="solar:add-square-linear"
            menuItems={NEW_ORDER_ITEMS}
            onMenuSelect={startOrder}
            menuAriaLabel="New order type"
            onClick={() => setCreating(view)}
          >
            New Order
          </Button>
          <span className={styles.divider} aria-hidden="true" />
          <ActionButton
            icon="custom:filter"
            tooltip="Filters"
            tooltipLeft
            aria-label="Filters"
            active={filtersOpen}
            count={filterCount ? String(filterCount) : undefined}
            onClick={() => setFiltersOpen(o => !o)}
          />
        </div>
      )}
      {filtersOpen && (
        <FilterBar
          variant="inline"
          multiSelect
          leading={null}
          filterDefs={filterDefsFor(view)}
          filters={filters}
          onFilterChange={(key, vals) => setFilters(f => ({ ...f, [key]: vals }))}
          onClearAll={() => setFilters(EMPTY_FILTERS)}
          getOptions={getOptions}
          showMoreFilters={false}
          showSaveFilter={false}
        />
      )}
      {loading[view]
        ? <TableSkeleton rows={6} />
        : !shown.length
          ? <div className={styles.empty}><EmptyState icon={EMPTY_ICON[view] || 'solar:clipboard-list-linear'} title={emptyLabel} /></div>
          : view === 'referral'
          ? <ReferralsTable {...tableProps} onOpen={setOpenReferral} onPreview={setPreview} />
          : <OrdersTable view={view} {...tableProps} />}
      {openReferral && <ReferralDetailDrawer referral={openReferral} patient={patient} onClose={() => setOpenReferral(null)} />}
      {preview && <AttachmentPreviewDrawer attachment={preview} onClose={() => setPreview(null)} />}
      {creating === 'referral' && <NewReferralDrawer patient={patient} patientId={patientId} onClose={closeCreate} />}
      {(creating === 'lab' || creating === 'imaging') && <NewOrderDrawer key={creating} patientId={patientId} type={creating} onClose={closeCreate} />}
      {creating === 'medication' && <AddMedicationsDrawer patientId={patientId} onClose={closeCreate} />}
    </div>
  );
}
