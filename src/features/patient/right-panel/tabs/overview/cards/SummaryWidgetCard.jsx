import { DashboardCardShell } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelEmbedded } from '../../../../../../components/PanelSection/PanelSection';
import { CareUtilizationWidget } from '../../../../shared/widgets/CareUtilizationWidget/CareUtilizationWidget.jsx';
import { PriorAuthWidget } from '../../../../shared/widgets/PriorAuthWidget/PriorAuthWidget.jsx';
import { PopulationGroupsWidget } from '../../../../shared/widgets/PopulationGroupsWidget/PopulationGroupsWidget.jsx';
import { CareJourneysWidget } from '../../../../shared/widgets/CareJourneysWidget/CareJourneysWidget.jsx';
import { ActiveAutomationsWidget } from '../../../../shared/widgets/ActiveAutomationsWidget/ActiveAutomationsWidget.jsx';
import { InsuranceWidget } from '../../../../shared/widgets/InsuranceWidget/InsuranceWidget.jsx';
import { SubscriptionWidget } from '../../../../shared/widgets/SubscriptionWidget/SubscriptionWidget.jsx';

// The left panel Summary tab's widgets, reused as-is in an Overview card
// frame. They bring their own collapsible header (PanelSection).
const WIDGETS = {
  careUtilization: CareUtilizationWidget,
  priorAuth: PriorAuthWidget,
  populationGroups: PopulationGroupsWidget,
  careJourneys: CareJourneysWidget,
  automations: ActiveAutomationsWidget,
  insurance: InsuranceWidget,
  subscription: SubscriptionWidget,
};

export function SummaryWidgetCard({ widget }) {
  const Widget = WIDGETS[widget];
  if (!Widget) return null;
  return (
    <DashboardCardShell flush>
      <PanelEmbedded>
        <Widget />
      </PanelEmbedded>
    </DashboardCardShell>
  );
}
