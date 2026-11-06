import { useEffect, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { safeBarItems, safeConfigData, safeTableRows } from '../../analytics/views/shared.utils';

/**
 * Loads one dashboard's KPIs and sections through the same store fetches
 * (and cache keys) as its desktop view. Each value is `null` while loading.
 * Refetches when the period changes, like the desktop views.
 */
export function useDashboardData(viewKey, spec) {
  const fetchViewKpis = useAppStore(s => s.fetchViewKpis);
  const fetchViewTable = useAppStore(s => s.fetchViewTable);
  const fetchProgressBars = useAppStore(s => s.fetchProgressBars);
  const fetchConfig = useAppStore(s => s.fetchConfig);
  const fetchTimeSeries = useAppStore(s => s.fetchTimeSeries);
  const period = useAppStore(s => s.analyticsPeriod);
  const periodMode = useAppStore(s => s.analyticsPeriodMode);
  const reqKey = `${viewKey}|${period}|${periodMode}`;
  // Results are tagged with the request they answer, so a period change
  // reads as loading until its own responses land.
  const [state, setState] = useState({ key: null, kpis: null, sections: {} });

  useEffect(() => {
    if (!spec) return undefined;
    let cancelled = false;
    const put = (patch) => {
      if (cancelled) return;
      setState(s => {
        const base = s.key === reqKey ? s : { key: reqKey, kpis: null, sections: {} };
        return { ...base, ...patch(base) };
      });
    };

    if (spec.kpis) {
      fetchViewKpis(viewKey).then(d => put(() => ({ kpis: d || { kpis: [], insight: null } })));
    }
    spec.sections.forEach((sec, i) => {
      const done = (value) => put(s => ({ sections: { ...s.sections, [i]: value } }));
      if (sec.kind === 'bars') {
        fetchProgressBars(viewKey, sec.barKey).then(d => {
          const items = safeBarItems(d);
          done(items.length ? items : (sec.fallback || []));
        });
      } else if (sec.kind === 'table' || sec.kind === 'measures') {
        fetchViewTable(viewKey, sec.tableKey).then(d => done(safeTableRows(d)));
      } else if (sec.kind === 'list') {
        fetchConfig(sec.configKey).then(d => done(safeConfigData(d)?.[sec.path] || []));
      } else if (sec.kind === 'chart' && sec.series) {
        fetchTimeSeries(sec.series).then(d => done(d || {}));
      } else if (sec.kind === 'chart' && sec.configKey) {
        fetchConfig(sec.configKey).then(d => {
          const points = safeConfigData(d)?.data_points || [];
          // Same Rolling 12M scaling as ExecutiveView.
          done(periodMode === 'r12' ? points.map(v => (v != null ? +(v * 1.15).toFixed(2) : null)) : points);
        });
      } else {
        done(sec.data || []);
      }
    });
    return () => { cancelled = true; };
  }, [reqKey, viewKey, spec, period, periodMode, fetchViewKpis, fetchViewTable, fetchProgressBars, fetchConfig, fetchTimeSeries]);

  const fresh = state.key === reqKey;
  return {
    kpiData: spec?.kpis ? (fresh ? state.kpis : null) : { kpis: [], insight: null },
    sections: fresh ? state.sections : {},
  };
}

/** Same label the desktop views put under a trend chart. */
export function usePeriodLabel() {
  const periodMode = useAppStore(s => s.analyticsPeriodMode);
  return periodMode === 'r12' ? 'Rolling 12M' : 'YTD 2025';
}
