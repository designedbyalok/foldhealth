import { useMemo, useState, useEffect, useRef } from 'react';
import { isCannotAttest } from './apcmBillingUtils';
import { surfacesForAttestation, visibleIcdsOf } from './data/mock';
import { useAppStore } from '../../store/useAppStore';
import styles from './ApcmBillingTable.module.css';

export function useApcmBillingTable(searchQuery) {
  const activeTab = 'new-changes';
  const storePatients = useAppStore(s => s.apcmPatients);
  const apcmPatientsLoading = useAppStore(s => s.apcmPatientsLoading);
  const fetchApcmPatients = useAppStore(s => s.fetchApcmPatients);
  const openQuickView = useAppStore(s => s.openQuickView);
  const showToast = useAppStore(s => s.showToast);

  const [patients, setPatients] = useState([]);
  const [didFetch, setDidFetch] = useState(() => storePatients.length > 0);
  const prevLoading = useRef(false);

  useEffect(() => {
    if (storePatients.length === 0 && !apcmPatientsLoading) {
      fetchApcmPatients();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevLoading.current && !apcmPatientsLoading) setDidFetch(true);
    prevLoading.current = apcmPatientsLoading;
  }, [apcmPatientsLoading]);

  const isLoading = apcmPatientsLoading || !didFetch;

  useEffect(() => {
    if (storePatients.length > 0 && patients.length === 0) {
      setPatients(storePatients);
    }
  }, [storePatients, patients.length]);

  const [comments, setComments] = useState({});
  const [activeFilters] = useState({});
  const [icdFilter, setIcdFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [attestationFor, setAttestationFor] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const handleCommentChange = (id, value) =>
    setComments(prev => ({ ...prev, [id]: value }));

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
      showToast(`${icdCode} ${verb} in Athena: ${markedDesc}`);
    }
  };

  const tabPatients = useMemo(
    () => patients.filter(p => p.tab === activeTab && surfacesForAttestation(p)),
    [patients, activeTab],
  );
  const isFiltered = !!searchQuery.trim() || !!icdFilter || !!providerFilter || !!activeFilters.cpt;

  const filtered = useMemo(() => {
    let result = tabPatients;

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
      result = result.filter(p => visibleIcdsOf(p).some(c => c.code === icdFilter));
    }
    if (providerFilter) result = result.filter(p => p.renderingProvider === providerFilter);
    if (activeFilters.cpt) result = result.filter(p => p.cptCode === activeFilters.cpt);
    return result;
  }, [tabPatients, searchQuery, icdFilter, providerFilter, activeFilters]);

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

  const anyFilterActive = Boolean(icdFilter || providerFilter);

  const bulkTarget = useMemo(() => {
    if (!icdFilter) return null;
    const code = icdFilter;
    let actionable = 0;
    for (const p of rows) {
      if (visibleIcdsOf(p).some(c => c.code === code && c.status === 'acute')) actionable++;
    }
    return { code, actionable };
  }, [rows, icdFilter]);

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

  const allIds = useMemo(() => {
    const ids = [];
    for (const p of paginated) {
      if (!isCannotAttest(p)) ids.push(p.id);
    }
    return ids;
  }, [paginated]);
  const allIdSet = useMemo(() => new Set(allIds), [allIds]);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIdSet.has(id));
  const someSelected = selectedIds.some(id => allIdSet.has(id)) && !allSelected;

  const toggleSelect = (id) => {
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
    const attestable = ids.filter(id => {
      const p = rows.find(r => r.id === id);
      return p && !isCannotAttest(p);
    });
    if (attestable.length === 0) return;
    setAttestationFor(attestable);
  };

  const handleBulkMarkChronic = () => {
    if (!bulkTarget) return;
    const { code } = bulkTarget;
    const targetIds = new Set();
    for (const p of rows) {
      if (visibleIcdsOf(p).some(c => c.code === code && c.status === 'acute')) {
        targetIds.add(p.id);
      }
    }
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
    setSelectedIds(prev => [...new Set([...prev, ...targetIds])]);
    if (showToast) {
      showToast(`${code} marked chronic in Athena: ${targetIds.size} patient${targetIds.size === 1 ? '' : 's'}`);
    }
  };

  const handleAttestationSubmit = () => {
    if (attestationForSet) {
      setPatients(prev => prev.filter(p => !attestationForSet.has(p.id)));
      setSelectedIds(prev => prev.filter(id => !attestationForSet.has(id)));
    }
    setAttestationFor(null);
  };

  const resetPage = () => setCurrentPage(1);

  return {
    totalCount: tabPatients.length,
    isFiltered,
    openQuickView,
    isLoading,
    perPage,
    rows,
    safePage,
    paginated,
    icdFilter,
    icdOptions,
    providerFilter,
    anyFilterActive,
    bulkTarget,
    someSelected,
    allSelected,
    selectedIdSet,
    attestationForSet,
    attestationFor,
    patients,
    tabSelectedIds,
    allFilteredIdSet,
    setIcdFilter,
    setProviderFilter,
    setPerPage,
    setCurrentPage,
    resetPage,
    goToPage,
    handleBulkMarkChronic,
    handleCommentChange,
    handleMarkChronic,
    handleSelectAll,
    toggleSelect,
    handleTriggerBill,
    handleAttestationSubmit,
    setAttestationFor,
    setSelectedIds,
  };
}
