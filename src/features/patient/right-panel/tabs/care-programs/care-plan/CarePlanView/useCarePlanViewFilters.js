import { useMemo, useState } from 'react';
import { GBI_STATUS_TONE } from '../tables/carePlanTableShared';
import { norm } from './carePlanViewNorm';

/**
 * Status/priority/assignee filters plus template-scoped list filtering and summary stats.
 */
export function useCarePlanViewFilters({
  data,
  templateFilterId,
  carePlanTemplates,
  libraryGoals,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ status: [], priority: [], assignee: [] });

  const setFilter = (key, vals) => setFilters(f => ({ ...f, [key]: vals }));
  const clearFilters = () => setFilters({ status: [], priority: [], assignee: [] });
  const filtersActive = filters.status.length || filters.priority.length || filters.assignee.length;

  const assigneeOptions = useMemo(
    () => [...new Set((data.interventions || []).map(i => i.assignee?.name).filter(Boolean))],
    [data.interventions],
  );

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
    () => data.goals.filter(g => matchesSP(g) && matchesTemplate(g, 'goals')),
    [data.goals, filters, templateScope],
  );
  const filteredBarriers = useMemo(
    () => (data.barriers || []).filter(b => matchesSP(b) && matchesTemplate(b, 'barriers')),
    [data.barriers, filters, templateScope],
  );
  const filteredInterventions = useMemo(
    () => data.interventions.filter(i =>
      matchesSP(i) && matchesTemplate(i, 'interventions')
      && (!filters.assignee.length || filters.assignee.includes(i.assignee?.name))),
    [data.interventions, filters, templateScope],
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
