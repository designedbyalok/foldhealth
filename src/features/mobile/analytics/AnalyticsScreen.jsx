import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { Skeleton } from '../../../components/Skeleton/Skeleton';
import { useCan } from '../../../lib/useCan';
import { useAppStore } from '../../../store/useAppStore';
import { PAGES, PERSONA_DETAILS, VIEW_TITLES } from '../../analytics/analyticsData';
import { MobileSubHeader } from '../MobileHeader';
import { useMobileNav } from '../MobileNavContext';
import { MobileEmpty } from '../MobileParts';
import { AskFold, SlicerBar } from './AnalyticsParts';
import { DASHBOARD_SPECS, isDashboardLocked, lockedMessage } from './analyticsDashboards';
import common from '../mobile.module.css';
import styles from './AnalyticsScreen.module.css';

const DELTA = { pos: { tone: 'success', icon: 'solar:arrow-up-linear' }, neg: { tone: 'danger', icon: 'solar:arrow-down-linear' } };

/** Each open dashboard's first KPI, from the same fetchViewKpis call (and cache) its view uses. */
function useHeadlineKpis(keys) {
  const fetchViewKpis = useAppStore(s => s.fetchViewKpis);
  const period = useAppStore(s => s.analyticsPeriod);
  const [heads, setHeads] = useState({ period: null, byKey: {} });
  const keyList = keys.join(',');
  useEffect(() => {
    let cancelled = false;
    keyList.split(',').filter(Boolean).forEach(k => {
      fetchViewKpis(k).then(d => {
        if (cancelled) return;
        setHeads(h => ({ period, byKey: { ...(h.period === period ? h.byKey : {}), [k]: d?.kpis?.[0] || false } }));
      });
    });
    return () => { cancelled = true; };
  }, [keyList, period, fetchViewKpis]);
  return heads.period === period ? heads.byKey : {};
}

/** Analytics hub on the phone: the dashboards this persona can open (view only). */
export function AnalyticsScreen() {
  const { push } = useMobileNav();
  const can = useCan();
  const persona = useAppStore(s => s.analyticsPersona);
  const showToast = useAppStore(s => s.showToast);
  const allowed = can('nav:analytics');

  const openKeys = useMemo(() => PAGES.flatMap(sec => sec.items)
    .filter(p => DASHBOARD_SPECS[p.id]?.kpis && !isDashboardLocked(persona, p.id))
    .map(p => p.id), [persona]);
  const heads = useHeadlineKpis(allowed ? openKeys : []);
  const who = PERSONA_DETAILS[persona] || PERSONA_DETAILS.exec;

  if (!allowed) {
    return (
      <div className={common.screen}>
        <MobileSubHeader title="Analytics" />
        <MobileEmpty icon="solar:lock-keyhole-linear" title="No access to Analytics" description="Ask your admin for access to Analytics." />
      </div>
    );
  }

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Analytics">
        <p className={styles.persona}>Viewing as {who.name}, {who.role}</p>
      </MobileSubHeader>
      <div className={common.body}>
        <div className={styles.top}>
          <AskFold />
          <SlicerBar />
        </div>
        {PAGES.map(sec => (
          <section key={sec.section} className={styles.group}>
            <h2 className={styles.groupTitle}>{sec.section}</h2>
            {sec.items.map(p => {
              const locked = isDashboardLocked(persona, p.id);
              const head = heads[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  className={[styles.dash, locked ? styles.locked : ''].filter(Boolean).join(' ')}
                  aria-label={locked ? `${p.label}, restricted` : p.label}
                  onClick={() => (locked ? showToast(lockedMessage(p.label, persona)) : push('analyticsDashboard', { dashboardKey: p.id }))}
                >
                  <span className={styles.dashIcon}><Icon name={p.icon} size={24} color="currentColor" /></span>
                  <span className={styles.dashText}>
                    <span className={styles.dashTitle}>{p.label}</span>
                    {locked ? (
                      <span className={styles.dashSub}>Not available for this persona</span>
                    ) : head ? (
                      <span className={styles.kpi}>
                        <span className={styles.kpiValue}>{head.value}</span>
                        <span className={styles.kpiLabel}>{head.label}</span>
                        {head.delta && <Badge size="sm" tone={DELTA[head.deltaType]?.tone || 'neutral'} icon={DELTA[head.deltaType]?.icon} label={head.delta} />}
                      </span>
                    ) : head === undefined && DASHBOARD_SPECS[p.id]?.kpis ? (
                      <Skeleton width="60%" height={20} radius={4} />
                    ) : (
                      <span className={styles.dashSub}>{VIEW_TITLES[p.id]?.sub}</span>
                    )}
                  </span>
                  <Icon name={locked ? 'solar:lock-keyhole-linear' : 'solar:alt-arrow-right-linear'} size={24} color="var(--placeholder-text)" />
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
