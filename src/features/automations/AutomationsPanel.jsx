import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { AutomationsList } from './list/AutomationsList';
import { AutomationBuilder } from './builder/AutomationBuilder';
import { AutomationAnalytics } from './analytics/AutomationAnalytics';
import { MemberTrace } from './analytics/MemberTrace';

/**
 * Settings > Automations. The list sits beside the Settings sub-nav; the
 * builder, analytics and member trace own the whole Settings area
 * (SettingsLayout decides which via `automationsView.screen`).
 */
export function AutomationsPanel() {
  const view = useAppStore(s => s.automationsView);
  const fetchAutomations = useAppStore(s => s.fetchAutomations);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  if (view.screen === 'builder' && view.id) return <AutomationBuilder key={view.id} id={view.id} />;
  if (view.screen === 'analytics' && view.id) return <AutomationAnalytics id={view.id} />;
  if (view.screen === 'trace' && view.id) return <MemberTrace id={view.id} runMemberId={view.runMemberId} />;
  return <AutomationsList />;
}
