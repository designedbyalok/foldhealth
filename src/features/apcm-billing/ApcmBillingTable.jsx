import { useMemo, useState, useEffect, useRef } from 'react';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Pagination } from '../../components/Pagination/Pagination';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { TableSkeleton } from '../../components/TableSkeleton/TableSkeleton';
import { ApcmBillingRow } from './ApcmBillingRow';
import { AttestationModal } from './AttestationModal';
// Patients now come from the Supabase-backed store (fetch below), but the
// helpers (surface rule, visibility rule, provider list) still live in mock.
import { PROVIDERS, surfacesForAttestation, visibleIcdsOf } from './data/mock';
import { useAppStore } from '../../store/useAppStore';
import styles from './ApcmBillingTable.module.css';
import rowStyles from './ApcmBillingRow.module.css';

const thStyle = {
  padding: '8px 14px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--neutral-300)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

// Fee schedule rendered inside the column-header (i) popover.
const CPT_RULES = [
  { label: '<2 chronic (any QMB)',   code: 'G0556', fee: 15  },
  { label: '2+ chronic, non-QMB',    code: 'G0557', fee: 50  },
  { label: '2+ chronic, QMB (dual)', code: 'G0558', fee: 110 },
];

export function ApcmBillingTable({ searchQuery = '', filtersOpen = false }) {
  const activeTab = 'new-changes';
  const storePatients = useAppStore(s => s.apcmPatients);
  const apcmPatientsLoading = useAppStore(s => s.apcmPatientsLoading);
  const fetchApcmPatients = useAppStore(s => s.fetchApcmPatients);
  const openQuickView = useAppStore(s => s.openQuickView);

  const [patients, setPatients] = useState([]);
  // Loading gate — true until the first fetch settles. Seeded from cached
  // store data so revisiting the tab (data already present) skips the
  // skeleton, while a cold mount shows it from the very first paint.
  const [didFetch, setDidFetch] = useState(() => storePatients.length > 0);
  const prevLoading = useRef(false);

  // Fetch from Supabase on first mount; falls back to local mock on error.
  useEffect(() => {
    if (storePatients.length === 0 && !apcmPatientsLoading) {
      fetchApcmPatients();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark the first fetch as settled once loading flips true → false.
  useEffect(() => {
    if (prevLoading.current && !apcmPatientsLoading) setDidFetch(true);
    prevLoading.current = apcmPatientsLoading;
  }, [apcmPatientsLoading]);

  const isLoading = apcmPatientsLoading || !didFetch;

  // Sync store → local state once data arrives (local state handles UI mutations).
  useEffect(() => {
    if (storePatients.length > 0 && patients.length === 0) {
      setPatients(storePatients);
    }
  }, [storePatients, patients.length]);
  const [comments, setComments] = useState({});
  const [activeFilters] = useState({});
  // Inline filters. Member name/ID/EHR ID search lives in the panel's search
  // bar (searchQuery); the filter bar holds the ICD + provider filters.
  const [icdFilter, setIcdFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [attestationFor, setAttestationFor] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const showToast = useAppStore(s => s.showToast);

  const handleCommentChange = (id, value) =>
    setComments(prev => ({ ...prev, [id]: value }));

  // Toggle an ICD's chronic status. Two-way: chronic → acute (undo) and
  // acute → chronic. Also auto-selects the row so the floating bulk bar's
  // Trigger Attestation action becomes actionable — checking any ICD chronic is a
  // strong signal the user intends to bill this patient.
  const handleMarkChronic = (patientId, icdCode) => {
    let markedDesc = null;
    let newStatus = null;
    setPatients(prev => prev.map(p => {
      if (p.id !== patientId) return p;
      return {
        ...p,
        icdCodes: p.icdCodes.map(c => {
          if (c.code !== icdCode) return c;
          markedDesc = c.description;
          newStatus = c.status === 'chronic' ? 'acute' : 'chronic';
          return { ...c, status: newStatus };
        }),
      };
    }));
    if (newStatus === 'chronic') {
      setSelectedIds(prev => prev.includes(patientId) ? prev : [...prev, patientId]);
    }
    if (showToast && markedDesc) {
      const verb = newStatus === 'chronic' ? 'marked chronic' : 'unmarked chronic';
      showToast(`${icdCode} ${verb} in Athena — ${markedDesc}`);
    }
  };

  const filtered = useMemo(() => {
    // Surfacing rule (user requirement 1 + 3): only patients with at least
    // one non-resolved ICD are surfaced. No ICDs OR all-resolved → hidden.
    let result = patients.filter(p => p.tab === activeTab && surfacesForAttestation(p));

    // Parent's global search (name / memberId / EHR ID) — kept for
    // back-compat with the SearchIconButton in BillingPanel.
    const applyMemberSearch = (q, list) => {
      if (!q.trim()) return list;
      const s = q.toLowerCase();
      return list.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.memberId.toLowerCase().includes(s) ||
        p.ehrId.includes(s)
      );
    };
    result = applyMemberSearch(searchQuery, result);

    if (icdFilter) {
      // icdFilter is an exact ICD code chosen from the searchable Select.
      // Match only against the codes actually visible in the row — never
      // against hidden ambiguous-candidate codes the user can't see or act on.
      result = result.filter(p => visibleIcdsOf(p).some(c => c.code === icdFilter));
    }
    if (providerFilter) result = result.filter(p => p.renderingProvider === providerFilter);
    if (activeFilters.cpt) result = result.filter(p => p.cptCode === activeFilters.cpt);
    return result;
  }, [patients, activeTab, searchQuery, icdFilter, providerFilter, activeFilters]);

  // Distinct ICD options for the searchable Select — every code visible in the
  // table. The ICD code is the primary detail (shown as a small badge in the
  // trigger + as line 1 in the dropdown); the description is secondary (line 2)
  // and searchable. Sorted by code for a stable list.
  const icdOptions = useMemo(() => {
    const map = new Map();
    for (const p of patients) {
      for (const c of visibleIcdsOf(p)) {
        if (c.code && !map.has(c.code)) map.set(c.code, c.description || '');
      }
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, desc]) => ({
        value: code,
        chipLabel: code,
        searchText: `${code} ${desc}`,
        label: (
          <span className={styles.icdOption}>
            <span className={styles.icdOptionCode}>{code}</span>
            {desc && <span className={styles.icdOptionDesc}>{desc}</span>}
          </span>
        ),
      }));
  }, [patients]);

  const rows = useMemo(() =>
    filtered.map(p => ({ ...p, comment: comments[p.id] ?? p.comment })),
    [filtered, comments]
  );

  // Case C guard — these patients have ambiguous mapping + chronic-not-selected
  // AND no qualifying Dx documented in the last 36 months. Fold surfaces them
  // but does not allow attestation. Selection + bulk Trigger Attestation skip them.
  // Case C only: ambiguous 1:many + chronic-not-selected + every candidate
  // outside the 36-month documentation window. Unresolved-mapping patients
  // (code === null) remain attestable — provider has already committed via
  // the "Marked Chronic by Provider" flag; Fold surfaces the warning inline.
  const isCannotAttest = (p) => {
    const ambiguous = p.reasons?.some(r => r.startsWith('Ambiguous ICD-10 from EMR Mapping'));
    const chronic = p.reasons?.some(r => r.startsWith('Chronic Condition Not Selected'));
    if (!(ambiguous && chronic)) return false;
    return (p.icdCodes || []).every(c => c.documentedInLast36Months === false);
  };

  const anyFilterActive = Boolean(icdFilter || providerFilter);
  // IDs of currently-filtered rows that can be attested (excludes Case C
  // blocked patients). Used by the filter-bar Trigger Attestation button.
  const attestableFilteredIds = useMemo(
    () => rows.filter(p => !isCannotAttest(p)).map(p => p.id),
    [rows]
  );

  // If the ICD filter has narrowed the visible rows to a single distinct code,
  // expose it as a bulk-mark target + a count of patients who still have it
  // in an acute (unmarked) state. The distinct-code check uses visibleIcdsOf
  // so hidden ambiguous candidates don't inflate the count and suppress the
  // bulk action (e.g. typing "E11" still resolves cleanly to E11.9 because
  // E11.8/E11.65 candidates are hidden on Case A rows anyway).
  const bulkTarget = useMemo(() => {
    if (!icdFilter) return null;
    const code = icdFilter; // exact code from the Select
    const actionable = rows.filter(p =>
      visibleIcdsOf(p).some(c => c.code === code && c.status === 'acute')
    ).length;
    return { code, actionable };
  }, [rows, icdFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = rows.slice((safePage - 1) * perPage, safePage * perPage);

  const goToPage = (p) => {
    const n = Math.max(1, Math.min(p, totalPages));
    setCurrentPage(n);
  };

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const attestationForSet = useMemo(
    () => (attestationFor ? new Set(attestationFor) : null),
    [attestationFor],
  );
  const allFilteredIdSet = useMemo(() => new Set(rows.map(p => p.id)), [rows]);

  // Bulk selection (scoped to current page) — Case C patients can't be
  // selected; "select all" therefore only ranges over attestable rows.
  const allIds = paginated.filter(p => !isCannotAttest(p)).map(p => p.id);
  const allIdSet = useMemo(() => new Set(allIds), [allIds]);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIdSet.has(id));
  const someSelected = selectedIds.some(id => allIdSet.has(id)) && !allSelected;

  const toggleSelect = (id) => {
    // Guard: Case C patients cannot be selected (their checkbox is disabled
    // in the row, but defend the data layer too).
    const p = rows.find(r => r.id === id);
    if (p && isCannotAttest(p)) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = (checked) =>
    setSelectedIds(checked
      ? [...new Set([...selectedIds, ...allIds])]
      : selectedIds.filter(id => !allIdSet.has(id))
    );

  const tabSelectedIds = selectedIds.filter(id => allFilteredIdSet.has(id));

  const handleTriggerBill = (ids) => {
    // Filter out Case C patients defensively — they should never reach here
    // via row action (button disabled) or bulk (checkbox disabled), but guard
    // anyway in case of programmatic invocation.
    const attestable = ids.filter(id => {
      const p = rows.find(r => r.id === id);
      return p && !isCannotAttest(p);
    });
    if (attestable.length === 0) return;
    setAttestationFor(attestable);
  };

  // Bulk-mark the filter-target ICD chronic across every currently-filtered
  // patient that still has it in an acute state. No row selection required —
  // the ICD filter itself defines the scope.
  const handleBulkMarkChronic = () => {
    if (!bulkTarget) return;
    const { code } = bulkTarget;
    const targetIds = new Set(
      rows.filter(p => visibleIcdsOf(p).some(c => c.code === code && c.status === 'acute'))
          .map(p => p.id)
    );
    if (targetIds.size === 0) return;
    setPatients(prev => prev.map(p => {
      if (!targetIds.has(p.id)) return p;
      return {
        ...p,
        icdCodes: p.icdCodes.map(c =>
          c.code === code && c.status === 'acute' ? { ...c, status: 'chronic' } : c
        ),
      };
    }));
    // Auto-select the newly-marked patients so the floating bulk bar's
    // Trigger Attestation action is one click away.
    setSelectedIds(prev => [...new Set([...prev, ...targetIds])]);
    if (showToast) {
      showToast(`${code} marked chronic in Athena — ${targetIds.size} patient${targetIds.size === 1 ? '' : 's'}`);
    }
  };

  const handleAttestationSubmit = () => {
    if (attestationForSet) {
      setPatients(prev => prev.filter(p => !attestationForSet.has(p.id)));
      setSelectedIds(prev => prev.filter(id => !attestationForSet.has(id)));
    }
    setAttestationFor(null);
  };

  return (
    <>
      <div className={styles.wrap}>

        {/* ── Filter bar — toggled by the panel's Filter button. Holds the
            ICD + provider filters; member (name/ID/EHR) search lives in the
            panel search bar. ── */}
        {filtersOpen && (
          <div className={styles.filterBar}>
            <FilterChip
              label="ICD Code"
              searchable
              searchPlaceholder="Search ICD code or description…"
              value={icdFilter}
              options={icdOptions}
              onSet={v => { setIcdFilter(v); setCurrentPage(1); }}
              onClear={() => { setIcdFilter(''); setCurrentPage(1); }}
            />

            <FilterChip
              label="Provider"
              value={providerFilter}
              options={PROVIDERS.map(p => ({ value: p, label: p }))}
              onSet={v => { setProviderFilter(v); setCurrentPage(1); }}
              onClear={() => { setProviderFilter(''); setCurrentPage(1); }}
            />

            {anyFilterActive && (
              <button
                type="button"
                className={styles.filterClearAll}
                onClick={() => { setIcdFilter(''); setProviderFilter(''); setCurrentPage(1); }}
              >
                Clear filters
              </button>
            )}

            {/* Filter-scoped chronic-mark. Trigger Attestation is not surfaced here —
                it lives in the floating bulk bar, driven by ICD-column marks
                (each chronic-mark auto-selects the row) or the leftmost row
                checkbox. */}
            {bulkTarget && bulkTarget.actionable > 0 && (
              <div className={styles.bulkFilterAction}>
                <Button
                  variant="secondary"
                  size="S"
                  leadingIcon="solar:check-circle-linear"
                  onClick={handleBulkMarkChronic}
                >
                  Mark {bulkTarget.code} chronic on {bulkTarget.actionable} patient{bulkTarget.actionable === 1 ? '' : 's'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Table ── */}
        <div className={styles.scrollWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${rowStyles.stickyLeft} ${rowStyles.stickyCheck} ${styles.checkTh}`}>
                  <Checkbox
                    checked={someSelected ? 'indeterminate' : allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className={`${rowStyles.stickyLeft} ${rowStyles.stickyMember}`} style={{ ...thStyle, borderRight: '1px solid var(--neutral-150)', minWidth: 220 }}>Member</th>
                <th style={thStyle}>EHR ID</th>
                <th style={thStyle}>Month</th>
                <th style={thStyle}>Date of Service</th>
                <th style={thStyle}>
                  <span className={styles.cptHeader}>
                    CPT Code
                    <span className={styles.cptInfoWrap}>
                      <span className={styles.cptInfo} aria-label="CPT rule">
                        <Icon name="solar:info-circle-linear" size={12} color="currentColor" />
                      </span>
                      <span className={styles.cptTooltip} role="tooltip">
                        <span className={styles.cptTooltipTitle}>Billing code &amp; fee</span>
                        {CPT_RULES.map(r => (
                          <span key={r.code} className={styles.cptTooltipRow}>
                            <span className={styles.cptTooltipLabel}>{r.label}</span>
                            <span className={styles.cptTooltipCode}>{r.code} · ${r.fee}</span>
                          </span>
                        ))}
                        <span className={styles.cptTooltipFoot}>
                          Checking Chronic on an ICD syncs to Athena and may change the code + fee.
                        </span>
                      </span>
                    </span>
                  </span>
                </th>
                <th style={{ ...thStyle, minWidth: 360 }}>ICD Codes</th>
                <th style={thStyle}>Last Encounter</th>
                <th style={{ ...thStyle, minWidth: 320 }}>Reasons</th>
                <th style={thStyle}>Rendering Provider</th>
                <th style={{ ...thStyle, minWidth: 280 }}>Comment</th>
                <th className={rowStyles.stickyRight} style={{ ...thStyle, width: '1%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={12} className={styles.loadingCell}>
                    <TableSkeleton rows={perPage} />
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={12}>
                    <div className={styles.empty}>
                      <Icon name="solar:clipboard-text-linear" size={40} color="var(--neutral-200)" />
                      <p className={styles.emptyTitle}>No patients found</p>
                      <p className={styles.emptyMsg}>
                        {searchQuery
                          ? 'No APCM patients match your search.'
                          : 'No patients require manual review for this billing period.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map(patient => (
                  <ApcmBillingRow
                    key={patient.id}
                    patient={patient}
                    isSelected={selectedIdSet.has(patient.id)}
                    isActive={attestationForSet?.has(patient.id) ?? false}
                    onSelect={toggleSelect}
                    onTriggerBill={handleTriggerBill}
                    onCommentChange={handleCommentChange}
                    onMarkChronic={handleMarkChronic}
                    onOpenPatient={() => openQuickView({
                      id: patient.id,
                      name: patient.name,
                      memberId: patient.memberId,
                      language: patient.language,
                    })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Shared Pagination component (controlled mode) — same UI as
            the TOC Worklist + HCC. APCM owns its page state locally, so
            it passes currentPage/perPage/totalItems + change handlers. */}
        {!isLoading && rows.length > 0 && (
          <Pagination
            currentPage={safePage}
            perPage={perPage}
            totalItems={rows.length}
            onPageChange={goToPage}
            onPerPageChange={(n) => { setPerPage(Number(n)); setCurrentPage(1); }}
          />
        )}
      </div>

      {/* ── Floating bulk action bar ── */}
      {tabSelectedIds.length > 0 && (
        <div className={styles.bulkBar}>
          <div className={styles.bulkCount}>
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all on page"
            />
            <span>{tabSelectedIds.length} selected</span>
          </div>
          <span className={styles.bulkDivider} />
          <Button
            variant="primary"
            size="S"
            leadingIcon="solar:bill-list-linear"
            onClick={() => handleTriggerBill(tabSelectedIds)}
          >
            Trigger Attestation
          </Button>
          <span className={styles.bulkDivider} />
          <ActionButton icon="solar:menu-dots-linear" size="L" tooltip="More options" onClick={() => {}} />
          <span className={styles.bulkDivider} />
          <CloseButton
            size={16}
            onClick={() => setSelectedIds(prev => prev.filter(id => !allFilteredIdSet.has(id)))}
            className={styles.bulkClose}
            label="Clear selection"
          />
        </div>
      )}

      {attestationFor && (
        <AttestationModal
          patients={patients.filter(p => attestationForSet?.has(p.id))}
          onClose={() => setAttestationFor(null)}
          onSubmit={handleAttestationSubmit}
        />
      )}
    </>
  );
}
