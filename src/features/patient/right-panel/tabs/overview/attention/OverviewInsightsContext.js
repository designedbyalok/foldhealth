import { createContext, useContext } from 'react';

// The Overview provides { byWidget, run, review } once; each card is wrapped
// in its own widget key so CardInsights knows which signals are its own.
export const OverviewInsightsContext = createContext(null);
export const OverviewWidgetKeyContext = createContext(null);

/** The open signals of the card this is rendered in. */
export function useCardSignals() {
  const ctx = useContext(OverviewInsightsContext);
  const widgetKey = useContext(OverviewWidgetKeyContext);
  return { ctx, widgetKey, signals: (ctx && widgetKey && ctx.byWidget[widgetKey]) || [] };
}
