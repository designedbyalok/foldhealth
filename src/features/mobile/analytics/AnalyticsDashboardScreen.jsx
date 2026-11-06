import { useCan } from '../../../lib/useCan';
import { useAppStore } from '../../../store/useAppStore';
import { VIEW_TITLES } from '../../analytics/analyticsData';
import { MobileSubHeader } from '../MobileHeader';
import { useMobileNav } from '../MobileNavContext';
import { MobileEmpty } from '../MobileParts';
import {
  BarList, DesktopOnlyNote, InsightCard, ItemList, KpiGrid, MeasureList, RowList, Section, SectionLoading, SlicerBar,
} from './AnalyticsParts';
import { DASHBOARD_SPECS, NO_SLICER_VIEWS, dashboardMeta, isDashboardLocked, lockedMessage } from './analyticsDashboards';
import { DashboardChart } from './DashboardChart';
import { EmployerDashboard } from './EmployerDashboard';
import { PharmacyDashboard } from './PharmacyDashboard';
import { RoiDashboard } from './RoiDashboard';
import { useDashboardData, usePeriodLabel } from './useDashboardData';
import common from '../mobile.module.css';
import styles from './AnalyticsDashboardScreen.module.css';

const CUSTOM = { employer: EmployerDashboard, pharmacy: PharmacyDashboard, roi: RoiDashboard };

/** One Analytics dashboard, read only, at phone width. */
export function AnalyticsDashboardScreen({ dashboardKey }) {
  const can = useCan();
  const persona = useAppStore(s => s.analyticsPersona);
  const meta = dashboardMeta(dashboardKey);
  const titles = VIEW_TITLES[dashboardKey];
  const blocked = !can('nav:analytics') || !meta || isDashboardLocked(persona, dashboardKey);
  const Custom = CUSTOM[dashboardKey];

  return (
    <div className={common.screen}>
      <MobileSubHeader title={titles?.title || meta?.label || 'Analytics'}>
        {titles?.sub && <p className={styles.sub}>{titles.sub}</p>}
        {!blocked && !NO_SLICER_VIEWS.has(dashboardKey) && <SlicerBar />}
      </MobileSubHeader>
      <div className={common.body}>
        {blocked ? (
          <MobileEmpty
            icon="solar:lock-keyhole-linear"
            title="Not available"
            description={meta ? lockedMessage(meta.label, persona) : 'This dashboard does not exist.'}
          />
        ) : (
          <div className={styles.stack}>
            {Custom ? <Custom /> : <GenericDashboard viewKey={dashboardKey} />}
          </div>
        )}
      </div>
    </div>
  );
}

function GenericDashboard({ viewKey }) {
  const spec = DASHBOARD_SPECS[viewKey];
  const { push } = useMobileNav();
  const persona = useAppStore(s => s.analyticsPersona);
  const showToast = useAppStore(s => s.showToast);
  const periodLabel = usePeriodLabel();
  const { kpiData, sections } = useDashboardData(viewKey, spec);
  const insight = kpiData?.insight || (kpiData ? spec.insightFallback : null);
  // An insight button that opens another view: same persona check as the side nav.
  const navigate = (key) => {
    const target = dashboardMeta(key);
    if (!target) return;
    if (isDashboardLocked(persona, key)) showToast(lockedMessage(target.label, persona));
    else push('analyticsDashboard', { dashboardKey: key });
  };

  return (
    <>
      <InsightCard insight={insight} onNavigate={navigate} />
      <KpiGrid items={kpiData?.kpis} loading={kpiData === null} />
      {spec.sections.map((sec, i) => {
        const data = sections[i];
        return (
          <Section key={`${sec.title}-${i}`} title={sec.title} sub={sec.sub || (sec.kind === 'chart' ? periodLabel : undefined)}>
            {data === undefined ? <SectionLoading height={sec.kind === 'chart' ? 220 : 160} /> : (
              sec.kind === 'chart' ? <DashboardChart spec={sec} data={data} />
                : sec.kind === 'bars' ? <BarList items={data} />
                  : sec.kind === 'measures' ? <MeasureList rows={data} />
                    : sec.kind === 'table' ? <RowList rows={data} spec={sec} />
                      : <ItemList items={data} spec={sec} />
            )}
          </Section>
        );
      })}
      {spec.desktopOnly && <DesktopOnlyNote what={spec.desktopOnly} />}
    </>
  );
}
