import { useMemo, useState } from 'react';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { DownChevronIcon } from '../../../../../../../components/Icon/DownChevronIcon';
import { FilterChip } from '../../../../../../../components/FilterChip/FilterChip';
import { DateRangePopover } from '../../../../../../../components/DateRangePopover/DateRangePopover';
import { getOpenIcdsForMember } from '../../../../../../hcc/data/icds';
import styles from './ProgramDiagnosisGapsTable.module.css';

// Program-step surface for the AWV / APE "Open Diagnosis Gaps" step. Same
// data source as the sidebar Diagnosis Gaps section, but the row UX
// exposes the linked ICDs inline behind an expand toggle so a scheduler
// can see exactly which ICDs the follow-up visit needs to close.
//
// Rule: only ICDs the physician hasn't already raised a claim for
// belong here. "Accepted" is our proxy for "physician claim raised",
// "Dismissed" is a hard close (both are filtered out by
// getOpenIcdsForMember's isIcdOpen), so what lands here are
// New / In Progress / Suspect / Recapture rows waiting on the
// follow-up visit that will close the gap in the EHR.

function splitHccLabel(raw) {
  if (!raw) return { code: '-', name: '' };
  const [codeRaw, ...rest] = String(raw).split(' - ');
  return { code: codeRaw.trim() || '-', name: rest.join(' - ').trim() };
}

function groupByHcc(icds) {
  const map = {};
  for (const icd of icds) {
    const key = icd.hcc || 'HCC Not Linked';
    if (!map[key]) map[key] = { title: key, icds: [], lastDocumented: null };
    map[key].icds.push(icd);
    if (icd.last && (!map[key].lastDocumented || icd.last > map[key].lastDocumented)) {
      map[key].lastDocumented = icd.last;
    }
  }
  return Object.values(map).map((g, i) => {
    const { code, name } = splitHccLabel(g.title);
    return {
      id: `dg-${i}`,
      raw: g.title,
      code,
      name,
      icds: g.icds,
      icdCount: g.icds.length,
      lastDocumented: g.lastDocumented || '-',
    };
  });
}

// Parse an MM/DD/YYYY string into a comparable Date. Returns null if
// the value is missing or malformed (e.g. the "-" placeholder).
function parseMmddyyyy(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
}

function yearOf(dateStr) {
  const d = parseMmddyyyy(dateStr);
  return d ? String(d.getFullYear()) : null;
}

const EMPTY_FILTERS = { my: [], hcc: [], icd: [], date: [] };

function DiagnosisGapRow({ item }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = () => setExpanded(v => !v);
  const countLabel = `${item.icdCount} ICD${item.icdCount !== 1 ? 's' : ''} Linked`;
  return (
    <div className={styles.rowGroup}>
      <div className={styles.row}>
        <div className={styles.content}>
          <span className={styles.title}>
            <span className={styles.hccCode}>{item.code}</span>
            {item.name ? <span className={styles.hccSep}> - </span> : null}
            <span className={styles.hccName}>{item.name}</span>
          </span>
          <div className={styles.meta}>
            <span className={styles.metaText}>Last Documented: {item.lastDocumented}</span>
            <span className={styles.metaSep} aria-hidden="true">•</span>
            <button
              type="button"
              className={styles.icdLink}
              onClick={toggle}
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${countLabel}` : `Expand ${countLabel}`}
            >
              <span>{countLabel}</span>
              <DownChevronIcon
                size={14}
                color="var(--primary-300)"
                className={expanded ? styles.icdChevronOpen : styles.icdChevron}
              />
            </button>
          </div>
        </div>
        <div className={styles.moreBtn}>
          <ActionButton icon="solar:menu-dots-linear" size="S" tooltip="More" />
        </div>
      </div>
      {expanded && item.icds.length > 0 && (
        <div className={styles.icdList} role="table" aria-label={`ICDs linked to ${item.raw}`}>
          <div className={styles.icdHeaderRow} role="row">
            <span className={styles.icdHeaderCell} role="columnheader">ICD Code</span>
            <span className={styles.icdHeaderCell} role="columnheader">Description</span>
          </div>
          {item.icds.map(icd => (
            <div key={icd.code} className={styles.icdRow} role="row">
              <span className={styles.icdCode} role="cell">{icd.code}</span>
              <span className={styles.icdDesc} role="cell" title={icd.desc}>{icd.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProgramDiagnosisGapsTable({ memberName, search }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const allGroups = useMemo(() => {
    if (!memberName) return [];
    const { all } = getOpenIcdsForMember(memberName);
    return groupByHcc(all);
  }, [memberName]);

  // Options are derived from the full unfiltered set so a picker never
  // hides a value the user might want to add — narrowing on Measure Year
  // doesn't collapse the HCC dropdown to a single row.
  const filterMeta = useMemo(() => {
    const yearSet = new Set();
    const hccSet = new Set();
    const icdSet = new Set();
    for (const g of allGroups) {
      for (const icd of g.icds) {
        const y = yearOf(icd.last);
        if (y) yearSet.add(y);
        if (icd.code) icdSet.add(icd.code);
      }
      if (g.raw) hccSet.add(g.raw);
    }
    // Fall back to the standard 3-year Measurement Year window when the
    // data itself doesn't carry dates, so the filter still reads normally.
    if (!yearSet.size) {
      const y = new Date().getFullYear();
      [y, y - 1, y - 2].forEach(v => yearSet.add(String(v)));
    }
    return {
      years: [...yearSet].sort((a, b) => Number(b) - Number(a)),
      hccs: [...hccSet].sort(),
      icds: [...icdSet].sort(),
    };
  }, [allGroups]);

  const items = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    const yearActive = filters.my.length > 0;
    const hccActive = filters.hcc.length > 0;
    const icdActive = filters.icd.length > 0;
    const [rangeStart, rangeEnd] = filters.date;
    const start = rangeStart ? new Date(rangeStart) : null;
    const end = rangeEnd ? new Date(rangeEnd) : null;

    return allGroups.filter(g => {
      // Group-level HCC filter — the whole HCC row drops out when its
      // label isn't in the picked set.
      if (hccActive && !filters.hcc.includes(g.raw)) return false;

      // The other filters gate on the ICDs inside the group. A group
      // survives when at least one ICD passes every active filter, so a
      // narrow ICD pick doesn't also require a matching HCC pick to keep
      // the HCC card visible.
      const someIcdMatches = g.icds.some(icd => {
        if (icdActive && !filters.icd.includes(icd.code)) return false;
        if (yearActive) {
          const y = yearOf(icd.last);
          if (!y || !filters.my.includes(y)) return false;
        }
        if (start || end) {
          const d = parseMmddyyyy(icd.last);
          if (!d) return false;
          if (start && d < start) return false;
          if (end && d > end) return false;
        }
        if (q) {
          const inCode = (icd.code || '').toLowerCase().includes(q);
          const inDesc = (icd.desc || '').toLowerCase().includes(q);
          const inHcc = g.raw.toLowerCase().includes(q);
          if (!inCode && !inDesc && !inHcc) return false;
        }
        return true;
      });
      return someIcdMatches;
    });
  }, [allGroups, filters, search]);

  const dateSummary = filters.date.length === 2
    ? `${fmtShort(filters.date[0])} – ${fmtShort(filters.date[1])}`
    : '';

  return (
    <div className={styles.wrapper}>
      <div className={styles.filterBar}>
        <FilterChip
          size="S"
          label="Measure Year"
          options={filterMeta.years}
          selected={filters.my}
          onChange={v => setFilter('my', v)}
        />
        <FilterChip
          size="S"
          label="HCC"
          options={filterMeta.hccs}
          selected={filters.hcc}
          onChange={v => setFilter('hcc', v)}
          searchable
        />
        <FilterChip
          size="S"
          label="ICD"
          options={filterMeta.icds}
          selected={filters.icd}
          onChange={v => setFilter('icd', v)}
          searchable
        />
        <FilterChip
          size="S"
          label="Documented Date"
          active={filters.date.length === 2}
          activeSummary={dateSummary}
          onClear={() => setFilter('date', [])}
          renderPopover={({ anchorRect, onClose }) => (
            <DateRangePopover
              anchorRect={anchorRect}
              label="Documented Date"
              selected={filters.date}
              onChange={v => setFilter('date', v)}
              onClose={onClose}
            />
          )}
        />
      </div>
      {items.length ? (
        <div className={styles.card}>
          {items.map(item => (
            <DiagnosisGapRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          {search || filters.my.length || filters.hcc.length || filters.icd.length || filters.date.length
            ? 'No diagnosis gaps match your filters'
            : 'No open diagnosis gaps'}
        </div>
      )}
    </div>
  );
}

// Short display (MM/DD) for the Documented Date chip. Keeps the pill
// value legible without repeating the full 10-char date twice.
function fmtShort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}`;
}
