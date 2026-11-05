/** Whether an open automation (builder, analytics, trace) owns the whole Settings area. */
export const isAutomationsTakeover = (view) => !!view && view.screen !== 'list' && !!view.id;
