import { useEffect, useMemo } from 'react';
import { SideNav } from '../SideNav/SideNav';
import { useAppStore } from '../../store/useAppStore';
import { HEDIS_MEMBERS } from '../../features/hedis-worklist/data/mock';
import styles from './SubNav.module.css';

// Define which lists map to which filter criteria
const WORKLISTS = [
  { label: 'SNP', filter: null, view: 'snp' },
  { label: 'Annual Visit', filter: null },
  { label: 'TOC', filter: null },  // default — shows all TOC patients
  { label: 'HCC', filter: null, view: 'hcc' },
  { label: 'HEDIS', filter: null, view: 'hedis' },
  { label: 'CCM', filter: null, view: 'ccm' },
  { label: 'JSA', filter: null, view: 'jsa' },
  { label: 'High Utilizers', filter: { readmission: 'Yes' } },
  { label: 'DM', filter: null },
];
const WORKLIST_LABELS = WORKLISTS.map(w => w.label);
const WORKLIST_BY_LABEL = Object.fromEntries(WORKLISTS.map(w => [w.label, w]));

export function SubNav({ collapsed }) {
  const activeSubnavList = useAppStore(s => s.activeSubnavList);
  const setActiveSubnavList = useAppStore(s => s.setActiveSubnavList);
  const setActiveFilters = useAppStore(s => s.setActiveFilters);
  const patients = useAppStore(s => s.patients);
  const hccMembers = useAppStore(s => s.hccMembers);
  const awvMembers = useAppStore(s => s.awvMembers || []);
  const ccmWorklistMembers = useAppStore(s => s.ccmWorklistMembers || []);
  const snpWorklistMembers = useAppStore(s => s.snpWorklistMembers || []);
  const jsaMembers = useAppStore(s => s.jsaMembers || []);
  const fetchHccMembers = useAppStore(s => s.fetchHccMembers);
  const fetchAwvMembers = useAppStore(s => s.fetchAwvMembers);
  const fetchCcmWorklistMembers = useAppStore(s => s.fetchCcmWorklistMembers);
  const fetchSnpWorklistMembers = useAppStore(s => s.fetchSnpWorklistMembers);
  const fetchJsaMembers = useAppStore(s => s.fetchJsaMembers);
  const fetchPatients = useAppStore(s => s.fetchPatients);
  const fetchCallDetails = useAppStore(s => s.fetchCallDetails);
  const fetchWorklistOrder = useAppStore(s => s.fetchWorklistOrder);
  const saveWorklistOrder = useAppStore(s => s.saveWorklistOrder);
  const fetchWorklistColumnPrefs = useAppStore(s => s.fetchWorklistColumnPrefs);
  const worklistOrder = useAppStore(s => s.worklistOrder);
  const clearSelected = useAppStore(s => s.clearSelected);
  const clearHccSelected = useAppStore(s => s.clearHccSelected);

  // Prefetch every worklist on mount so counts show up right away. Also
  // triggers `fetchPatients` + `fetchCallDetails` here (rather than inside
  // WorklistTable / QueueTable) so the TOC queue works when the user lands
  // there before ever visiting the worklist tab, and so tab switches don't
  // remount those effects and re-fire the same requests. The fetch actions
  // are idempotent (guarded by *DidFetch flags in the store).
  useEffect(() => {
    fetchHccMembers();
    fetchAwvMembers();
    fetchCcmWorklistMembers();
    fetchSnpWorklistMembers();
    fetchJsaMembers();
    fetchPatients();
    fetchCallDetails();
    fetchWorklistOrder(WORKLIST_LABELS);
    fetchWorklistColumnPrefs();
  }, []);

  // User-ordered worklists — store order or the default until the fetch
  // resolves. Reconciled here as well (not just in the store) because the
  // localStorage-cached order may predate a newly added worklist.
  const orderedWorklists = useMemo(() => {
    const saved = (worklistOrder || []).filter(l => WORKLIST_BY_LABEL[l]);
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
    const seen = new Set();
    for (const m of hccMembers) {
      const k = (m?.memberId || m?.id || '').toString().replace(/^#/, '').trim().toLowerCase();
      if (k) seen.add(k);
    }
    return seen.size;
  }, [hccMembers]);

  // Lists with a backing worklist (TOC, HCC, HEDIS, CCM, SNP, Annual Visit)
  // show real row counts; the rest have no data source yet and show 0.
  const getCounts = useMemo(() => {
    const counts = {};
    for (const list of WORKLISTS) {
      if (list.view === 'hcc') counts[list.label] = hccUniquePatientCount;
      else if (list.view === 'hedis') counts[list.label] = HEDIS_MEMBERS.length;
      else if (list.view === 'ccm') counts[list.label] = ccmWorklistMembers.length;
      else if (list.view === 'snp') counts[list.label] = snpWorklistMembers.length;
      else if (list.view === 'jsa') counts[list.label] = jsaMembers.length;
      else if (list.label === 'Annual Visit') counts[list.label] = awvMembers.length;
      else if (list.label === 'TOC') counts[list.label] = patients.length;
      else counts[list.label] = 0;
    }
    return counts;
  }, [patients, hccUniquePatientCount, awvMembers, ccmWorklistMembers, snpWorklistMembers, jsaMembers]);

  // Unique patient count across every worklist. Different worklists use
  // different id spaces (p1, hcc-42, ccmw-001), so we key the union on a
  // normalized memberId (# stripped, trimmed, lowercased) — that's the one
  // field every worklist shares. Patients missing a memberId fall back to
  // their row id so they still count once.
  const allPatientsCount = useMemo(() => {
    const seen = new Set();
    const collect = (rows) => rows.forEach(r => {
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
    return seen.size;
  }, [patients, hccMembers, awvMembers, ccmWorklistMembers, snpWorklistMembers, jsaMembers]);

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
    // Archived Worklist — frozen snapshots of worklists, isolated from the
    // live versions so upstream changes never alter them.
    {
      key: 'archived',
      label: 'Archived Worklist',
      items: [{ key: 'HCC (Archived)', label: 'HCC', count: hccUniquePatientCount || 0 }],
    },
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
      width={collapsed ? 0 : 200}
      sectionLabelVariant="title"
      sortableSection="worklists"
      onReorder={saveWorklistOrder}
    />
  );
}
