/** Every open change a plan's event updates suggest (useEventUpdates), as { impact, change }. */
export const suggestionsOf = events => (!events.loaded || events.missing ? []
  : events.pending.flatMap(impact => impact.open.map(change => ({ impact, change }))));
