import { useEffect, useMemo } from 'react';
import { SideNav } from '../SideNav/SideNav';
import { useAppStore } from '../../store/useAppStore';
import { HEDIS_MEMBERS } from '../../features/hedis-worklist/data/mock';
import styles from './SubNav.module.css';

// Define which lists map to which filter criteria
const WORKLISTS = [
  { label: 'SNP', filter: null, view: 'snp' },
  { label: 'Annual Visit', filter: null },
  { label: 'TOC IP', filter: null, view: 'toc' },
  { label: 'HCC', filter: null, view: 'hcc' },
  { label: 'HEDIS', filter: null, view: 'hedis' },
  { label: 'CCM', filter: null, view: 'ccm' },
  { label: 'JSA', filter: null, view: 'jsa' },
  { label: 'High Utilizers', filter: { readmission: 'Yes' } },
  { label: 'DM', filter: null },
  { label: 'TCM', filter: null },
];
const WORKLIST_LABELS = WORKLISTS.map(w => w.label);
const WORKLIST_BY_LABEL = Object.fromEntries(WORKLISTS.map(w => [w.label, w]));

export function SubNav({ collapsed, width = 200 }) {
  const activeSubnavList = useAppStore(s => s.activeSubnavList);
  const setActiveSubnavList = useAppStore(s => s.setActiveSubnavList);
  const setActiveFilters = useAppStore(s => s.setActiveFilters);
  const patients = useAppStore(s => s.patients);
  const hccMembers = useAppStore(s => s.hccMembers);
  const awvMembers = useAppStore(s => s.awvMembers || []);
  const ccmWorklistMembers = useAppStore(s => s.ccmWorklistMembers || []);
  const snpWorklistMembers = useAppStore(s => s.snpWorklistMembers || []);
  const jsaMembers = useAppStore(s => s.jsaMembers || []);
  const worklistCounts = useAppStore(s => s.worklistCounts);
  const fetchWorklistCounts = useAppStore(s => s.fetchWorklistCounts);
  const fetchWorklistOrder = useAppStore(s => s.fetchWorklistOrder);
  const saveWorklistOrder = useAppStore(s => s.saveWorklistOrder);
  const fetchWorklistColumnPrefs = useAppStore(s => s.fetchWorklistColumnPrefs);
  const worklistOrder = useAppStore(s => s.worklistOrder);
  const clearSelected = useAppStore(s => s.clearSelected);
  const clearHccSelected = useAppStore(s => s.clearHccSelected);

  // Counts only. This used to call fetchHccMembers + fetchAwvMembers +
  // fetchCcmWorklistMembers + fetchSnpWorklistMembers + fetchJsaMembers +
  // fetchPatients + fetchCallDetails on mount, which meant every Population
  // route pulled every worklist table in full: opening the 9-row CCM list
  // transferred ~275 KB, ~40x what the screen renders, and HCC came to 38
  // requests. The badges were the only reason — seven integers.
  //
  // fetchWorklistCounts asks for just the id columns those integers need
  // (6.7 KB, measured). Each worklist's own view fetches its own rows, which
  // it already did. fetchCallDetails moved to the TCM queue that actually
  // reads it.
  useEffect(() => {
    fetchWorklistCounts();
    fetchWorklistOrder(WORKLIST_LABELS);
    fetchWorklistColumnPrefs();
  }, []);

  // User-ordered worklists — store order or the default until the fetch
  // resolves. Reconciled here as well (not just in the store) because the
  // localStorage-cached order may predate a newly added worklist.
  const orderedWorklists = useMemo(() => {
    let saved = (worklistOrder || []).filter(l => WORKLIST_BY_LABEL[l]);
    if (saved.includes('TOC')) {
      const hasTcm = saved.includes('TCM');
      saved = saved.map(l => (l === 'TOC' ? (hasTcm ? 'TOC IP' : 'TCM') : l));
    }
    const order = saved.length > 0
      ? [...saved, ...WORKLIST_LABELS.filter(l => !saved.includes(l))]
      : WORKLIST_LABELS;
    return order.map(l => WORKLIST_BY_LABEL[l]);
  }, [worklistOrder]);

  // HCC's data model has one row per coding record — a patient with multiple
  // records repeats in `hccMembers` (Annette Brave = 4 rows, one per record).
  // The badge and worklist table both show unique patients, so we count fold
  // IDs the same way the table dedupes (see `dedupedMembers` in
  // useHccWorklistTable). Every other list is already one-row-per-patient.
  const hccUniquePatientCount = useMemo(() => {
    // Prefer the loaded slice so the badge tracks edits live (archive a
    // record, the count moves). `worklistCounts` is the cheap fallback for
    // every list the user has not opened yet.
    if (hccMembers.length === 0) return worklistCounts?.hccUnique ?? 0;
    const seen = new Set();
    for (const m of hccMembers) {
      const k = (m?.memberId || m?.id || '').toString().replace(/^#/, '').trim().toLowerCase();
      if (k) seen.add(k);
    }
    return seen.size;
  }, [hccMembers, worklistCounts]);

  // Lists with a backing worklist (TOC, HCC, HEDIS, CCM, SNP, Annual Visit)
  // show real row counts; the rest have no data source yet and show 0.
  const getCounts = useMemo(() => {
    // Loaded slice wins so the badge stays live while the user works in a
    // list; `worklistCounts` covers the lists they have not opened. A slice
    // that is genuinely empty and a slice that is merely not fetched are
    // indistinguishable by length, so an empty list shows its counted value
    // (also 0) — same answer either way.
    const wc = worklistCounts;
    const pick = (slice, counted) => (slice.length > 0 ? slice.length : (counted ?? 0));
    const counts = {};
    for (const list of WORKLISTS) {
      if (list.view === 'hcc') counts[list.label] = hccUniquePatientCount;
      else if (list.view === 'hedis') counts[list.label] = HEDIS_MEMBERS.length;
      else if (list.view === 'ccm') counts[list.label] = pick(ccmWorklistMembers, wc?.ccm);
      else if (list.view === 'snp') counts[list.label] = pick(snpWorklistMembers, wc?.snp);
      else if (list.view === 'jsa') counts[list.label] = pick(jsaMembers, wc?.jsa);
      else if (list.label === 'Annual Visit') counts[list.label] = pick(awvMembers, wc?.awv);
      else if (list.label === 'TCM') counts[list.label] = pick(patients, wc?.tcm);
      else if (list.label === 'TOC IP') {
        counts[list.label] = patients.length > 0
          ? patients.filter(p => p.agentAssigned).length
          : (wc?.tocIp ?? 0);
      } else counts[list.label] = 0;
    }
    return counts;
  }, [patients, hccUniquePatientCount, awvMembers, ccmWorklistMembers, snpWorklistMembers, jsaMembers, worklistCounts]);

  // Unique patient count across every worklist. Different worklists use
  // different id spaces (p1, hcc-42, ccmw-001), so we key the union on a
  // normalized memberId (# stripped, trimmed, lowercased) — that's the one
  // field every worklist shares. Patients missing a memberId fall back to
  // their row id so they still count once.
  const allPatientsCount = useMemo(() => {
    // Every slice is empty until the user opens a worklist, so the union has
    // to come from `worklistCounts` — which computes it the same way, over
    // the same normalized key, from the id-only queries. Once slices ARE
    // loaded we recompute locally so the badge tracks live edits; the union
    // still needs the counted value as its floor, because a locally-computed
    // union over one loaded slice would undercount every list still unfetched.
    const seen = new Set();
    const collect = (rows) => (rows || []).forEach(r => {
      const key = (r?.memberId || r?.id || '').toString().replace(/^#/, '').trim().toLowerCase();
      if (key) seen.add(key);
    });
    collect(patients);
    collect(hccMembers);
    collect(awvMembers);
    collect(HEDIS_MEMBERS);
    collect(ccmWorklistMembers);
    collect(snpWorklistMembers);
    collect(jsaMembers);
    return Math.max(seen.size, worklistCounts?.allPatients ?? 0);
  }, [patients, hccMembers, awvMembers, ccmWorklistMembers, snpWorklistMembers, jsaMembers, worklistCounts]);

  const sections = useMemo(() => [
    {
      key: 'worklists',
      label: 'Worklists',
      items: orderedWorklists.map(w => ({ key: w.label, label: w.label, count: getCounts[w.label] || 0 })),
    },
    {
      key: 'patients',
      label: 'Patients',
      items: [
        { key: 'My Patients', label: 'My Patients', count: 0 },
        { key: 'All Patients', label: 'All Patients', count: allPatientsCount || 0 },
      ],
    },
    {
      key: 'population-groups',
      label: 'Population Groups',
      items: [
        { key: 'pg:All', label: 'All' },
        { key: 'pg:Static', label: 'Static' },
        { key: 'pg:Dynamic', label: 'Dynamic' },
      ],
    },
    { key: 'leads-contacts', label: 'Leads & Contacts', items: [] },
  ], [orderedWorklists, getCounts, allPatientsCount, patients.length, hccUniquePatientCount]);

  const handleSelect = (key) => {
    setActiveSubnavList(key);
    // Clear selection from both worklists so selection doesn't bleed across lists
    clearSelected();
    clearHccSelected();
    // Worklist rows can carry a preset filter; everything else clears filters.
    const worklist = WORKLIST_BY_LABEL[key];
    setActiveFilters(worklist?.filter ? worklist.filter : {});
  };

  return (
    <SideNav
      className={[styles.rail, collapsed ? styles.collapsed : ''].filter(Boolean).join(' ')}
      sections={sections}
      activeKey={activeSubnavList}
      onSelect={handleSelect}
      width={collapsed ? 0 : width}
      sectionLabelVariant="title"
      sortableSection="worklists"
      onReorder={saveWorklistOrder}
    />
  );
}
