import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../components/Button/Button';
import {
  UnityInsightCollapse, UnityInsightHeader, UnityInsights, UnityRecommendation,
} from '../../../../../../components/UnityInsights/UnityInsights';
import { useCardSignals } from './OverviewInsightsContext';
import cardStyles from '../cards/overviewCards.module.css';
import { ACTION_ICON, widgetInsightSummary } from './widgetInsights';
import { AiInsightIcon } from '../../../../../../components/Icon/AiInsightIcon';

/**
 * The lightbulb in a card header that opens its Unity insights (pair with
 * `<CardInsights open={...} />`). Renders nothing when there are none.
 */
export function CardInsightsButton({ open, onToggle }) {
  const { widgetKey, signals } = useCardSignals();
  if (!signals.length) return null;
  return (
    <ActionButton size="sm" active={open} dot={!open} tooltip={widgetInsightSummary(widgetKey, signals)} tooltipLeft aria-label="Unity insights" onClick={onToggle}>
      <AiInsightIcon size={16} />
    </ActionButton>
  );
}

/** One signal's next step and its Mark reviewed check. */
export function SignalActions({ signal, onRun, onReview, primary = false }) {
  return (
    <>
      {signal.action && (
        <Button
          variant={primary ? 'solid' : 'soft'}
          size="sm"
          leadingIcon={ACTION_ICON[signal.action.key]}
          onClick={() => onRun(signal)}
        >
          {signal.action.label}
        </Button>
      )}
      <ActionButton icon="solar:check-read-linear" size="sm" tooltip="Mark reviewed" onClick={() => onReview(signal, true)} />
    </>
  );
}

/**
 * A card header's actions with the insights lightbulb first, split from the
 * card's own actions (children) by a divider. Pair with
 * `<CardInsights open={insightsOpen} />` under the header.
 */
export function CardHeaderActions({ insightsOpen, onToggleInsights, children }) {
  const { signals } = useCardSignals();
  if (!signals.length) return children ?? null;
  return (
    <span className={cardStyles.headerActions}>
      <CardInsightsButton open={insightsOpen} onToggle={onToggleInsights} />
      {children && <span className={cardStyles.headerDivider} />}
      {children}
    </span>
  );
}

/**
 * A card's Unity recommendations, one per open signal, under the widget's
 * headline. Opened and closed by the card's lightbulb (CardHeaderActions).
 * Renders nothing when the widget has no open signals.
 */
export function CardInsights({ open }) {
  const { ctx, widgetKey, signals } = useCardSignals();
  if (!signals.length) return null;
  return (
    <UnityInsightCollapse open={open}>
      <UnityInsights>
        <UnityInsightHeader title={widgetInsightSummary(widgetKey, signals)} />
        {signals.map(s => (
          <UnityRecommendation
            key={s.id}
            title={s.title}
            description={s.detail}
            aside={s.isNew ? <Badge tone="info" size="sm" label="New" /> : null}
            actions={<SignalActions signal={s} onRun={ctx.run} onReview={ctx.review} />}
          />
        ))}
      </UnityInsights>
    </UnityInsightCollapse>
  );
}
