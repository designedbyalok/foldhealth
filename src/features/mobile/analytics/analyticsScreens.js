import { AnalyticsScreen } from './AnalyticsScreen';
import { AnalyticsDashboardScreen } from './AnalyticsDashboardScreen';

/** Analytics sub-screens for MobileShell: push('analytics'), push('analyticsDashboard', { dashboardKey }). */
export const ANALYTICS_SCREENS = {
  analytics: AnalyticsScreen,
  analyticsDashboard: AnalyticsDashboardScreen,
};
