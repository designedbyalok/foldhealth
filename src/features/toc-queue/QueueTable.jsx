import { useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../../components/Icon/Icon';
import { Checkbox } from '../../components/ui/checkbox';
import { QueueRow } from './QueueRow';
import { QueueEmptyState } from './QueueEmptyState';
import { TableSkeleton } from '../../components/Skeleton/TableSkeleton';

export function QueueTable() {
  const patients = useAppStore(s => s.patients);
  const patientsLoading = useAppStore(s => s.patientsLoading);
  const fetchPatients = useAppStore(s => s.fetchPatients);
  const fetchCallDetails = useAppStore(s => s.fetchCallDetails);
  const searchQuery = useAppStore(s => s.searchQuery);

  // Fetch patients + call details when queue mounts (lazy — skip if already loaded)
  useEffect(() => { if (!patients.length && !patientsLoading) fetchPatients(); fetchCallDetails(); }, [patients.length, patientsLoading, fetchPatients, fetchCallDetails]);
  const activeFilters = useAppStore(s => s.activeFilters);
  const currentPage = useAppStore(s => s.currentPage);
  const perPage = useAppStore(s => s.perPage);

  // Filter to only agent-assigned patients, then apply search + filters
  const filteredQueue = useMemo(() => {
    let result = patients.filter(p => p.agentAssigned)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99)); // sort by priority

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.memberId?.toLowerCase().includes(q) ||
        p.initials?.toLowerCase().includes(q)
      );
    }

    for (const [key, value] of Object.entries(activeFilters)) {
      if (value) {
        result = result.filter(p => String(p[key]) === String(value));
      }
    }

    return result;
  }, [patients, searchQuery, activeFilters]);

  if (patientsLoading) return <TableSkeleton rows={6} />;

  if (!filteredQueue.length) {
    // Check if there are any invoked patients at all (before filters)
    const anyInvoked = patients.some(p => p.agentAssigned);
    if (!anyInvoked) return <QueueEmptyState />;
    // There are invoked patients but filters hide them
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', paddingBottom: 64 }}>
          <Icon name="custom:filter" size={40} color="var(--neutral-200)" />
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)' }}>No matching agents</div>
          <div style={{ fontSize: 13, color: 'var(--neutral-300)', lineHeight: 1.5 }}>
            Active filters hide all queued patients. Try adjusting your filters.
          </div>
        </div>
      </div>
    );
  }

  const startIdx = (currentPage - 1) * perPage;
  const paginatedQueue = filteredQueue.slice(startIdx, startIdx + perPage);

  const thBase = {
    fontSize: 12, fontWeight: 500, color: 'var(--neutral-300)',
    padding: '10px 14px', borderBottom: '1px solid var(--neutral-150)',
    background: 'var(--neutral-0)', position: 'sticky', top: 0, zIndex: 2,
    textAlign: 'left', whiteSpace: 'nowrap', userSelect: 'none',
  };

  const agentTh = {
    ...thBase,
    background: 'var(--agent-col-bg)',
    color: 'var(--primary-300)',
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--neutral-0)', position: 'relative', overscrollBehavior: 'none' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', sans-serif", minWidth: 2000 }}>
        <thead>
          <tr>
            <th style={{ ...thBase, width: 36, padding: '8px 10px', position: 'sticky', left: 0, zIndex: 4 }}>
              <Checkbox />
            </th>
            <th style={{ ...thBase, padding: '8px 12px', position: 'sticky', left: 36, zIndex: 4, borderRight: '1px solid var(--neutral-150)' }}>Members</th>
            <th style={thBase}>Priority</th>
            <th style={thBase}>Outreach Type</th>
            <th style={thBase}>LACE Acuity</th>
            <th style={thBase}>Outreach Window</th>
            <th style={{ ...agentTh, borderLeft: '2px solid var(--primary-200)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1L8.5 5H13L9.5 7.5L11 11L7 8.5L3 11L4.5 7.5L1 5H5.5L7 1Z" fill="currentColor"/></svg>
                Status
              </span>
            </th>
            <th style={{ ...agentTh, minWidth: 140 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6.92509 2.77376C6.92509 3.03232 7.1347 3.24192 7.39326 3.24192C7.65182 3.24192 7.86142 3.03232 7.86142 2.77376H6.92509ZM7.86142 1.33325C7.86142 1.07469 7.65182 0.865087 7.39326 0.865087C7.1347 0.865087 6.92509 1.07469 6.92509 1.33325H7.86142ZM16.2884 2.77376C16.2884 3.03232 16.498 3.24192 16.7566 3.24192C17.0151 3.24192 17.2247 3.03232 17.2247 2.77376H16.2884ZM17.2247 1.33325C17.2247 1.07469 17.0151 0.865087 16.7566 0.865087C16.498 0.865087 16.2884 1.07469 16.2884 1.33325H17.2247ZM1.53184 12.8861C1.53184 13.1447 1.74144 13.3543 2 13.3543C2.25856 13.3543 2.46816 13.1447 2.46816 12.8861H1.53184ZM2.46816 11.4456C2.46816 11.1871 2.25856 10.9774 2 10.9774C1.74144 10.9774 1.53184 11.1871 1.53184 11.4456H2.46816ZM21.5318 12.8861C21.5318 13.1447 21.7414 13.3543 22 13.3543C22.2586 13.3543 22.4682 13.1447 22.4682 12.8861H21.5318ZM22.4682 11.4456C22.4682 11.1871 22.2586 10.9774 22 10.9774C21.7414 10.9774 21.5318 11.1871 21.5318 11.4456H22.4682ZM9.50725 14.9272C9.29953 14.7732 9.00632 14.8168 8.85236 15.0245C8.69839 15.2322 8.74196 15.5254 8.94968 15.6794L9.50725 14.9272ZM15.1252 15.6794C15.3329 15.5254 15.3765 15.2322 15.2226 15.0245C15.0686 14.8168 14.7754 14.7732 14.5677 14.9272L15.1252 15.6794ZM7.86142 2.77376V1.33325H6.92509V2.77376H7.86142ZM17.2247 2.77376V1.33325H16.2884V2.77376H17.2247ZM2.46816 12.8861V11.4456H1.53184V12.8861H2.46816ZM22.4682 12.8861V11.4456H21.5318V12.8861H22.4682ZM12.0375 15.7715C11.0989 15.7715 10.2273 15.4609 9.50725 14.9272L8.94968 15.6794C9.82209 16.3261 10.8872 16.7078 12.0375 16.7078V15.7715ZM14.5677 14.9272C13.8476 15.4609 12.976 15.7715 12.0375 15.7715V16.7078C13.1877 16.7078 14.2528 16.3261 15.1252 15.6794L14.5677 14.9272ZM15.3146 10.1535C15.3146 10.4618 15.2305 10.7197 15.119 10.8869C15.0053 11.0574 14.8998 11.0898 14.8464 11.0898V12.0261C15.3102 12.0261 15.6728 11.7442 15.8981 11.4063C16.1255 11.0652 16.2509 10.6209 16.2509 10.1535H15.3146ZM14.8464 11.0898C14.7931 11.0898 14.6875 11.0574 14.5739 10.8869C14.4624 10.7197 14.3783 10.4618 14.3783 10.1535H13.4419C13.4419 10.6209 13.5674 11.0652 13.7948 11.4063C14.0201 11.7442 14.3826 12.0261 14.8464 12.0261V11.0898ZM14.3783 10.1535C14.3783 9.84517 14.4624 9.58723 14.5739 9.42004C14.6875 9.24958 14.7931 9.21715 14.8464 9.21715V8.28082C14.3826 8.28082 14.0201 8.56279 13.7948 8.90066C13.5674 9.24179 13.4419 9.6861 13.4419 10.1535H14.3783ZM14.8464 9.21715C14.8998 9.21715 15.0053 9.24958 15.119 9.42004C15.2305 9.58723 15.3146 9.84517 15.3146 10.1535H16.2509C16.2509 9.6861 16.1255 9.24179 15.8981 8.90066C15.6728 8.56279 15.3102 8.28082 14.8464 8.28082V9.21715ZM9.69663 10.1535C9.69663 10.4618 9.61247 10.7197 9.50101 10.8869C9.38737 11.0574 9.28179 11.0898 9.22846 11.0898V12.0261C9.69226 12.0261 10.0548 11.7442 10.2801 11.4063C10.5075 11.0652 10.633 10.6209 10.633 10.1535H9.69663ZM9.22846 11.0898C9.17514 11.0898 9.06956 11.0574 8.95592 10.8869C8.84446 10.7197 8.7603 10.4618 8.7603 10.1535H7.82397C7.82397 10.6209 7.94942 11.0652 8.17684 11.4063C8.40208 11.7442 8.76467 12.0261 9.22846 12.0261V11.0898ZM8.7603 10.1535C8.7603 9.84517 8.84446 9.58723 8.95592 9.42004C9.06956 9.24958 9.17514 9.21715 9.22846 9.21715V8.28082C8.76467 8.28082 8.40208 8.56279 8.17684 8.90066C7.94942 9.24179 7.82397 9.6861 7.82397 10.1535H8.7603ZM9.22846 9.21715C9.28179 9.21715 9.38737 9.24958 9.50101 9.42004C9.61247 9.58723 9.69663 9.84517 9.69663 10.1535H10.633C10.633 9.6861 10.5075 9.24179 10.2801 8.90066C10.0548 8.56279 9.69226 8.28082 9.22846 8.28082V9.21715ZM12.0375 21.3894C9.81727 21.3894 8.19923 21.3884 6.96279 21.2222C5.73983 21.0578 4.96055 20.7395 4.37642 20.1553L3.71434 20.8174C4.50143 21.6045 5.51124 21.9718 6.83803 22.1502C8.15136 22.3268 9.84374 22.3258 12.0375 22.3258V21.3894ZM2.20599 12.4943C2.20599 14.688 2.205 16.3804 2.38157 17.6937C2.55995 19.0205 2.92724 20.0303 3.71434 20.8174L4.37642 20.1553C3.79229 19.5712 3.47397 18.7919 3.30955 17.569C3.14332 16.3325 3.14232 14.7145 3.14232 12.4943H2.20599ZM20.9326 12.4943C20.9326 14.7145 20.9316 16.3325 20.7654 17.569C20.6009 18.7919 20.2826 19.5712 19.6985 20.1553L20.3606 20.8174C21.1477 20.0303 21.515 19.0205 21.6933 17.6937C21.8699 16.3804 21.8689 14.688 21.8689 12.4943H20.9326ZM12.0375 22.3258C14.2312 22.3258 15.9236 22.3268 17.2369 22.1502C18.5637 21.9718 19.5735 21.6045 20.3606 20.8174L19.6985 20.1553C19.1144 20.7395 18.3351 21.0578 17.1121 21.2222C15.8757 21.3884 14.2576 21.3894 12.0375 21.3894V22.3258ZM12.0375 3.59917C14.2576 3.59917 15.8757 3.60016 17.1121 3.7664C18.3351 3.93082 19.1144 4.24914 19.6985 4.83327L20.3606 4.17119C19.5735 3.38409 18.5637 3.0168 17.2369 2.83842C15.9236 2.66185 14.2312 2.66284 12.0375 2.66284V3.59917ZM21.8689 12.4943C21.8689 10.3006 21.8699 8.6082 21.6933 7.29488C21.515 5.96809 21.1477 4.95828 20.3606 4.17119L19.6985 4.83327C20.2826 5.4174 20.6009 6.19668 20.7654 7.41964C20.9316 8.65607 20.9326 10.2741 20.9326 12.4943H21.8689ZM12.0375 2.66284C9.84374 2.66284 8.15136 2.66185 6.83803 2.83842C5.51124 3.0168 4.50143 3.38409 3.71434 4.17119L4.37642 4.83327C4.96055 4.24914 5.73983 3.93082 6.96279 3.7664C8.19923 3.60016 9.81727 3.59917 12.0375 3.59917V2.66284ZM3.14232 12.4943C3.14232 10.2741 3.14332 8.65607 3.30955 7.41964C3.47397 6.19668 3.79229 5.4174 4.37642 4.83327L3.71434 4.17119C2.92724 4.95828 2.55995 5.96809 2.38157 7.29488C2.205 8.6082 2.20599 10.3006 2.20599 12.4943H3.14232Z" fill="currentColor"/>
                </svg>
                Due On
              </span>
            </th>
            <th style={{ ...agentTh, minWidth: 260 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="2" rx="1" fill="currentColor"/><rect x="2" y="6" width="7" height="2" rx="1" fill="currentColor"/><rect x="2" y="10" width="5" height="2" rx="1" fill="currentColor"/></svg>
                Next Action
              </span>
            </th>
            <th style={{ ...agentTh, minWidth: 280, borderRight: '2px solid var(--primary-200)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="solar:magic-stick-3-bold" size={14} />
                AI Insights
              </span>
            </th>
            <th style={thBase}>TOC Status</th>
            <th style={thBase}>Due On</th>
            <th style={thBase}>Next Outreach</th>
            <th style={thBase}>Start Date</th>
            <th style={thBase}>Last Admission</th>
            <th style={thBase}>Assignee</th>
            <th style={thBase}>Readmission</th>
            <th style={thBase}>Tasks</th>
            <th style={thBase}>Care Plan Status</th>
            <th style={{ ...thBase, position: 'sticky', right: 0, zIndex: 3, borderLeft: '1px solid var(--neutral-150)', boxShadow: '-4px 0 8px rgba(0,0,0,.04)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedQueue.map(p => (
            <QueueRow key={p.id} patient={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
