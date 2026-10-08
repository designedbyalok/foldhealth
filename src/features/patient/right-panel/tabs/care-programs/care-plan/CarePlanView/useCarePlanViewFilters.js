import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { GBI_STATUS_TONE } from '../tables/carePlanTableShared';
import { norm } from './carePlanViewNorm';
import { interventionOwner } from '../tables/carePlanTableModel';

/**
 * Search, status/priority/assignee filters plus template-scoped list filtering
 * and summary stats. Search text and filter-bar visibility come from the store
 * because their buttons live in the program-detail content header.
 */
export function useCarePlanViewFilters({
  data,
  templateFilterId,
  carePlanTemplates,
  libraryGoals,
  patientName,
}) {
  const filtersOpen = useAppStore(s => s.carePlanFiltersOpen);
  const setFiltersOpen = useAppStore(s => s.setCarePlanFiltersOpen);
  const searchText = useAppStore(s => s.carePlanSearchText);
  const setSearchText = useAppStore(s => s.setCarePlanSearchText);
  // Leaving the plan (another step, patient or program) starts the next one
  // unsearched and unfiltered, like bulk mode.
  useEffect(() => () => { setSearchText(''); setFiltersOpen(false); }, [setSearchText, setFiltersOpen]);
  const q = norm(searchText);
  const matchesSearch = (item) => !q
    || norm(item.title).includes(q)
    || norm(item.subtitle || item.description || '').includes(q);
  const [filters, setFilters] = useState({ status: [], priority: [], assignee: [] });

  const setFilter = (key, vals) => setFilters(f => ({ ...f, [key]: vals }));
  const clearFilters = () => setFilters({ status: [], priority: [], assignee: [] });
  const filtersActive = filters.status.length || filters.priority.length || filters.assignee.length;

  // Same owner the intervention rows show: member tasks belong to the patient
  // (labelled as such, so they don't merge with a staff member of the same
  // name), internal tasks to their staff assignee or nobody.
  const patientLabel = patientName ? `${patientName} (Patient)` : 'Patient';
  const ownerKey = (i) => {
    const owner = interventionOwner(i, patientName ? [{ name: patientName }] : []);
    if (owner.isMemberTask) return patientLabel;
    return owner.unassigned ? 'Unassigned' : owner.name;
  };
  const assigneeOptions = useMemo(() => {
    const keys = new Set((data.interventions || []).map(ownerKey));
    const staff = [...keys].filter(k => k !== patientLabel && k !== 'Unassigned').sort((a, b) => a.localeCompare(b));
    return [
      ...(keys.has(patientLabel) ? [patientLabel] : []),
      ...staff,
      ...(keys.has('Unassigned') ? ['Unassigned'] : []),
    ];
  }, [data.interventions, patientLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchesSP = (item) =>
    (!filters.status.length || filters.status.includes(item.status)) &&
    (!filters.priority.length || filters.priority.map(p => p.toLowerCase()).includes((item.priority || '').toLowerCase()));

  const templateScope = useMemo(() => {
    if (!templateFilterId) return null;
    const t = carePlanTemplates.find(x => x.id === templateFilterId);
    if (!t) return null;
    const titlesOf = (list, kind) => new Set((list || []).map(e => {
      if (kind === 'goals') {
        const lib = e?.id ? libraryGoals.find(g => g.id === e.id) : null;
        return norm(lib?.title || e?.title || '');
      }
      return norm(e?.title || '');
    }).filter(Boolean));
    const goalTitles = titlesOf(t.goals, 'goals');
    const goalIdSet = new Set(
      data.goals.filter(g => goalTitles.has(norm(g.title))).map(g => g.id),
    );
    return {
      goalTitles,
      interventionTitles: titlesOf(t.interventions),
      barrierTitles: titlesOf(t.barriers),
      goalIdSet,
    };
  }, [templateFilterId, carePlanTemplates, libraryGoals, data.goals]);

  const matchesTemplate = (item, kind) => {
    if (!templateScope) return true;
    if (kind === 'barriers') {
      return templateScope.goalIdSet.has(item.goalId)
        || templateScope.barrierTitles.has(norm(item.title));
    }
    const set = kind === 'goals' ? templateScope.goalTitles : templateScope.interventionTitles;
    return set.size > 0 && set.has(norm(item.title));
  };

  const filteredGoals = useMemo(
    () => data.goals.filter(g => matchesSearch(g) && matchesSP(g) && matchesTemplate(g, 'goals')),
    [data.goals, filters, templateScope, q],
  );
  const filteredBarriers = useMemo(
    () => (data.barriers || []).filter(b => matchesSearch(b) && matchesSP(b) && matchesTemplate(b, 'barriers')),
    [data.barriers, filters, templateScope, q],
  );
  const filteredInterventions = useMemo(
    () => {
      const assignees = new Set(filters.assignee);
      return data.interventions.filter(i =>
        matchesSearch(i) && matchesSP(i) && matchesTemplate(i, 'interventions')
        && (!assignees.size || assignees.has(ownerKey(i))));
    },
    [data.interventions, filters, templateScope, q, patientLabel], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const planStats = useMemo(() => {
    const goals = filteredGoals;
    const iv = filteredInterventions;
    const br = filteredBarriers;
    const all = [...goals, ...iv, ...br];
    const avgProgress = goals.length
      ? Math.round(goals.reduce((sum, g) => sum + (Number(g.progress) || 0), 0) / goals.length)
      : 0;
    const counts = new Map();
    for (const item of all) {
      if (!item.status) continue;
      counts.set(item.status, (counts.get(item.status) || 0) + 1);
    }
    const statuses = Object.keys(GBI_STATUS_TONE)
      .filter(status => counts.get(status))
      .map(status => ({ status, count: counts.get(status), tone: GBI_STATUS_TONE[status] }));
    return {
      goals: goals.length,
      iv: iv.length,
      br: br.length,
      total: all.length,
      statuses,
      avgProgress,
    };
  }, [filteredGoals, filteredInterventions, filteredBarriers]);

  return {
    filtersOpen,
    setFiltersOpen,
    filters,
    setFilter,
    clearFilters,
    filtersActive,
    assigneeOptions,
    filteredGoals,
    filteredBarriers,
    filteredInterventions,
    planStats,
    norm,
  };
}
