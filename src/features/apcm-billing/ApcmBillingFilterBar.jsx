import { Button } from '../../components/Button/Button';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { PROVIDERS } from './data/mock';
import styles from './ApcmBillingTable.module.css';

export function ApcmBillingFilterBar({
  icdFilter,
  icdOptions,
  providerFilter,
  anyFilterActive,
  bulkTarget,
  onIcdFilterSet,
  onIcdFilterClear,
  onProviderFilterSet,
  onProviderFilterClear,
  onClearAll,
  onBulkMarkChronic,
}) {
  return (
    <div className={styles.filterBar}>
      <FilterChip
        label="ICD Code"
        searchable
        searchPlaceholder="Search ICD code or description…"
        value={icdFilter}
        options={icdOptions}
        onSet={onIcdFilterSet}
        onClear={onIcdFilterClear}
      />

      <FilterChip
        label="Provider"
        value={providerFilter}
        options={PROVIDERS.map(p => ({ value: p, label: p }))}
        onSet={onProviderFilterSet}
        onClear={onProviderFilterClear}
      />

      {anyFilterActive && (
        <button
          type="button"
          className={styles.filterClearAll}
          onClick={onClearAll}
        >
          Clear filters
        </button>
      )}

      {/* Filter-scoped chronic-mark. Trigger Attestation is not surfaced here,
          it lives in the floating bulk bar, driven by ICD-column marks
          (each chronic-mark auto-selects the row) or the leftmost row
          checkbox. */}
      {bulkTarget && bulkTarget.actionable > 0 && (
        <div className={styles.bulkFilterAction}>
          <Button
            variant="outline"
            size="sm"
            leadingIcon="solar:check-circle-linear"
            onClick={onBulkMarkChronic}
          >
            Mark {bulkTarget.code} chronic on {bulkTarget.actionable} patient{bulkTarget.actionable === 1 ? '' : 's'}
          </Button>
        </div>
      )}
    </div>
  );
}
