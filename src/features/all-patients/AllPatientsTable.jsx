import { useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AllPatientsRow } from './AllPatientsRow';
import { TableSkeleton } from '../../components/TableSkeleton/TableSkeleton';
import { Icon } from '../../components/Icon/Icon';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';

const CITIES = [
  ['Queens', 'NY'], ['Brooklyn', 'NY'], ['Manhattan', 'NY'], ['Bronx', 'NY'],
  ['Newark', 'NJ'], ['Jersey City', 'NJ'], ['Stamford', 'CT'], ['Yonkers', 'NY'],
  ['Paterson', 'NJ'], ['Hoboken', 'NJ'], ['White Plains', 'NY'], ['Hempstead', 'NY'],
];
const TPAS = ['Aetna', 'BCBS', 'UHC', 'Humana', 'Cigna', 'Anthem'];
const COVERAGES = ['HMO', 'PPO', 'EPO', 'POS', 'Medicare Advantage'];
const CONDITIONS = ['Diabetes', 'Hypertension', 'CHF', 'COPD', 'CKD', 'Asthma', 'Obesity', 'Depression'];
const PROGRAMS = ['CCM', 'APCM', 'RPM', 'BHI', 'TCM'];
const PCPS = [
  { name: 'Dr. Sarah Chen', init: 'SC' },
  { name: 'Dr. James Park', init: 'JP' },
  { name: 'Dr. Elena Rodriguez', init: 'ER' },
  { name: 'Dr. Michael Lee', init: 'ML' },
  { name: 'Dr. Priya Patel', init: 'PP' },
  { name: 'Dr. David Kim', init: 'DK' },
];

// Deterministic hash so dummy data stays stable across renders
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pick(arr, seed) { return arr[seed % arr.length]; }

function fillDummy(row, idx) {
  const seed = hash(row.id || String(idx));
  const [city, state] = pick(CITIES, seed);
  const pcp = pick(PCPS, seed >> 3);
  const tpa = pick(TPAS, seed >> 5);
  const coverage = pick(COVERAGES, seed >> 2);
  const plan = `PL${String(seed % 9000 + 1000)}`;
  const group = `G${String(seed % 900000 + 100000)}`;
  const familyId = `F${String(seed % 90000 + 10000)}`;
  const unique = `U${String(seed % 900000000 + 100000000)}`;
  const phoneDigits = String(2000000000 + (seed % 7999999999));
  const phone = `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`;
  const firstName = (row.name || 'member').split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
  const email = `${firstName}${seed % 99}@fold.health`;
  const condCount = (seed % 3) + 1;
  const conditions = [];
  for (let i = 0; i < condCount; i++) {
    const c = CONDITIONS[(seed + i * 7) % CONDITIONS.length];
    if (!conditions.includes(c)) conditions.push(c);
  }
  const program = pick(PROGRAMS, seed >> 7);
  const lastVisit = new Date(2025, (seed % 12), (seed % 27) + 1).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const ccm = (seed % 3) === 0 ? false : (seed % 3) === 1 ? true : null;
  const apcm = ((seed >> 4) % 3) === 0 ? false : ((seed >> 4) % 3) === 1 ? true : null;
  const tags = row.tags?.length ? row.tags : [pick(['High Risk', 'Rising Risk', 'Stable'], seed >> 1)];

  return {
    ...row,
    email: row.email || email,
    phone: row.phone || phone,
    city: row.city || city,
    state: row.state || state,
    location: row.location || `${city}, ${state}`,
    tpa: row.tpa || tpa,
    coverageType: row.coverageType || coverage,
    planCode: row.planCode || plan,
    groupNumber: row.groupNumber || group,
    familyId: row.familyId || familyId,
    uniqueMemberId: row.uniqueMemberId || unique,
    chronicConditions: row.chronicConditions?.length ? row.chronicConditions : conditions,
    pcp: row.pcp || pcp.name,
    pcpInitials: row.pcpInitials || pcp.init,
    lastVisit: row.lastVisit || lastVisit,
    activeCareProgram: row.activeCareProgram || program,
    ccmConsent: row.ccmConsent ?? ccm,
    apcmConsent: row.apcmConsent ?? apcm,
    tags,
  };
}

export function AllPatientsTable() {
  const allPatients = useAppStore(s => s.allPatients);
  const allPatientsLoading = useAppStore(s => s.allPatientsLoading);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const patients = useAppStore(s => s.patients);
  const hccMembers = useAppStore(s => s.hccMembers);
  const snpWorklistMembers = useAppStore(s => s.snpWorklistMembers || []);
  const fetchSnpWorklistMembers = useAppStore(s => s.fetchSnpWorklistMembers);
  const selectedIds = useAppStore(s => s.selectedAllPatientsIds);
  const selectOne = useAppStore(s => s.selectAllPatient);
  const selectAll = useAppStore(s => s.selectAllAllPatients);
  const clearSelected = useAppStore(s => s.clearAllPatientsSelected);
  const currentPage = useAppStore(s => s.currentPage);
  const perPage = useAppStore(s => s.perPage);
  const searchQuery = useAppStore(s => s.searchQuery);

  useEffect(() => { fetchAllPatients(); }, [fetchAllPatients]);
  // SubNav already prefetches this on mount, but landing directly on All
  // Patients (e.g. via hash route) can beat that, so make sure the SNP roster
  // is in the store before we compose the union below.
  useEffect(() => { fetchSnpWorklistMembers(); }, [fetchSnpWorklistMembers]);

  // The Supabase all_patients table is TOC+HCC-only today (its `source`
  // CHECK constraint restricts to toc/hcc/manual). To keep SNP counted in
  // this view — matching what SubNav's dedupe union already reports — we
  // supplement with any SNP member whose memberId isn't already present,
  // keyed on the normalized memberId used everywhere else in the app.
  const normMemberId = (v) => (v || '').toString().replace(/^#/, '').trim().toLowerCase();
  const snpAsAllPatientRows = useMemo(() => snpWorklistMembers.map(m => ({
    id: `snp-${m.id}`,
    source: 'snp',
    name: m.name,
    initials: m.initials,
    gender: m.gender,
    age: m.age,
    memberId: m.memberId,
    language: m.language,
    assignee: m.assigneeName,
    assigneeInitials: m.assigneeInitials,
    tags: (m.tags || []).flatMap(t => t.label ? [t.label] : []),
  })), [snpWorklistMembers]);

  // If Supabase has data, use it and add SNP members not already covered
  // (dedupe by normalized memberId). Otherwise fall back to combining
  // TOC + HCC + SNP in memory.
  const baseRows = useMemo(() => {
    if (allPatients.length > 0) {
      const seen = new Set(allPatients.map(r => normMemberId(r.memberId)).filter(Boolean));
      const extra = snpAsAllPatientRows.filter(r => {
        const k = normMemberId(r.memberId);
        return k && !seen.has(k);
      });
      return [...allPatients, ...extra];
    }

    const tocRows = patients.map(p => ({
      id: `toc-${p.id}`,
      source: 'toc',
      name: p.name,
      initials: p.initials,
      gender: p.gender,
      age: p.age,
      memberId: p.memberId,
      language: p.language,
      assignee: p.assignee,
      assigneeInitials: p.assigneeInitials,
      tags: p.lace ? [`LACE ${p.lace}`] : [],
    }));

    const hccRows = hccMembers.map(m => ({
      id: `hcc-${m.id}`,
      source: 'hcc',
      name: m.name,
      initials: m.in,
      gender: m.g,
      age: m.age,
      memberId: m.memberId,
      language: m.language,
      pcp: m.pcp,
      tags: m.rl ? [`Risk ${m.rl}`] : [],
    }));

    const seen = new Set([...tocRows, ...hccRows].map(r => normMemberId(r.memberId)).filter(Boolean));
    const snpRows = snpAsAllPatientRows.filter(r => {
      const k = normMemberId(r.memberId);
      return k && !seen.has(k);
    });

    return [...tocRows, ...hccRows, ...snpRows];
  }, [allPatients, patients, hccMembers, snpAsAllPatientRows]);

  const filled = useMemo(() => baseRows.map((r, i) => fillDummy(r, i)), [baseRows]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return filled;
    const q = searchQuery.toLowerCase().trim();
    return filled.filter(r =>
      r.name?.toLowerCase().includes(q) ||
      r.memberId?.toString().toLowerCase().includes(q) ||
      r.pcp?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  }, [filled, searchQuery]);

  const startIdx = (currentPage - 1) * perPage;
  const paginated = filtered.slice(startIdx, startIdx + perPage);

  const allIds = paginated.map(r => r.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const handleSelectAll = (checked) => {
    if (checked) selectAll(allIds);
    else clearSelected();
  };

  const thStyle = {
    padding: '8px 14px', fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)',
    borderBottom: '1px solid var(--neutral-150)', background: 'var(--neutral-0)',
    position: 'sticky', top: 0, zIndex: 2, textAlign: 'left',
    whiteSpace: 'nowrap', userSelect: 'none',
  };

  if (allPatientsLoading && baseRows.length === 0) return <TableSkeleton rows={perPage} />;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--neutral-0)', position: 'relative', overscrollBehavior: 'none' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', sans-serif", minWidth: 1400 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: 36, padding: '8px 10px', position: 'sticky', top: 0, left: 0, zIndex: 4 }}>
              <Checkbox checked={someSelected ? 'indeterminate' : allSelected} onCheckedChange={handleSelectAll} />
            </th>
            <th style={{ ...thStyle, padding: '8px 12px', position: 'sticky', top: 0, left: 36, zIndex: 4, borderRight: '1px solid var(--neutral-150)' }}>Members</th>
            <th style={thStyle}>Contact Info</th>
            <th style={thStyle}>Location</th>
            <th style={thStyle}>Tags</th>
            <th style={thStyle}>Attributes</th>
            <th style={thStyle}>Chronic Conditions</th>
            <th style={thStyle}>PCP</th>
            <th style={thStyle}>Last Visit</th>
            <th style={thStyle}>Active Care Program</th>
            <th style={thStyle}>CCM Consent</th>
            <th style={thStyle}>APCM Consent</th>
            <th style={{ ...thStyle, width: 140, position: 'sticky', top: 0, right: 0, zIndex: 3 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map(row => (
            <AllPatientsRow
              key={row.id}
              row={row}
              isSelected={selectedIds.includes(row.id)}
              onSelect={selectOne}
            />
          ))}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '64px 24px', gap: 12, color: 'var(--neutral-300)',
        }}>
          <Icon name="solar:users-group-two-rounded-linear" size={40} color="var(--neutral-200)" />
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--neutral-400)', margin: 0 }}>
            {searchQuery ? 'No results found' : 'No patients yet'}
          </p>
          <p style={{ fontSize: 14, margin: 0, textAlign: 'center', maxWidth: 320 }}>
            {searchQuery ? 'Try adjusting your search.' : 'Patients from TOC and HCC worklists will appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}
