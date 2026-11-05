import { useMemo } from 'react';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import styles from './DiagPanelFilterBar.module.css';

// Fixed vocabulary for status buckets: matches the values `addHccGap` and
// the DOS-action reducer produce. Kept static so an empty ICD list still
// exposes the full option set (Figma 9810:158181).
const ICD_STATUS_OPTIONS = ['New', 'In Progress', 'Accepted', 'Dismissed'];
const CLAIMS_OPTIONS = ['Available', 'Not Available'];

const parseDate = (mmddyyyy) => {
  if (!mmddyyyy || typeof mmddyyyy !== 'string') return null;
  const [m, d, y] = mmddyyyy.split('/');
  if (!m || !d || !y) return null;
  return { y, m, d, key: `${y}-${m}-${d}` };
};

const EMPTY_ICDS = [];

/**
 * DiagPanelFilterBar: filter row shown under the DiagPanel toolbar when the
 * Filter icon is active (Figma 9810:158181). Six FilterChips + Clear All.
 *
 * The parent owns `filters` state and passes each option list here; this
 * component is a thin presentational wrapper so the same predicate can be
 * used to narrow both the associated-ICD grid and the suspect group below.
 */
export function DiagPanelFilterBar({
  filters,
  icds = EMPTY_ICDS,
  member,
  onChange,
  onClearAll,
}) {
  // Options are derived from the ICDs currently attached to the record so the
  // dropdown only lists values a user can actually match. Kept in useMemo so
  // clicking through chips doesn't recompute on every render.
  const options = useMemo(() => {
    const years   = new Set();
    const hccs    = new Set();
    const byList  = new Set();
    const lastRec = new Set();

    for (const i of icds) {
      const parsed = parseDate(i.last);
      if (parsed) {
        years.add(parsed.y);
        lastRec.add(i.last);
      }
      if (i.hcc) hccs.add((i.hcc || '').split(' - ')[0].trim());
      if (i.by)  byList.add(i.by);
    }
    // Visit Type options come from the member's dos_list entries: the same
    // list of visit types the DOS row / worklist row show for this member.
    const vt = new Set(
      (member?.dos_list || []).flatMap(d => d?.vt ? [d.vt] : []),
    );
    return {
      years:   [...years].toSorted().reverse(),
      hcc:     [...hccs].toSorted(),
      by:      [...byList].toSorted(),
      lastRec: [...lastRec].toSorted().reverse(),
      created: member?.date ? [member.date] : [],
      vt:      [...vt].toSorted(),
    };
  }, [icds, member?.date, member?.dos_list]);

  const set = (key) => (vals) => onChange({ ...filters, [key]: vals });

  return (
    <div className={styles.bar}>
      <FilterChip
        label="Measurement Year"
        options={options.years}
        selected={filters.year || []}
        onChange={set('year')}
      />
      <FilterChip
        label="ICD Status"
        options={ICD_STATUS_OPTIONS}
        selected={filters.status || []}
        onChange={set('status')}
      />
      <FilterChip
        label="Recorded By"
        options={options.by}
        selected={filters.by || []}
        onChange={set('by')}
      />
      <FilterChip
        label="Last Recorded Date"
        options={options.lastRec}
        selected={filters.lastRec || []}
        onChange={set('lastRec')}
      />
      <FilterChip
        label="Visit Type"
        options={options.vt}
        selected={filters.vt || []}
        onChange={set('vt')}
      />
      <FilterChip
        label="Claims"
        options={CLAIMS_OPTIONS}
        selected={filters.claims || []}
        onChange={set('claims')}
        singleSelect
      />
      <button type="button" className={styles.clearBtn} onClick={onClearAll}>
        <span className={styles.clearIcon} aria-hidden="true">⊗</span>
        Clear All
      </button>
    </div>
  );
}

