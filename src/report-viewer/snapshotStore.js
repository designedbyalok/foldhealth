/**
 * Stands in for src/store/useAppStore inside the report viewer build
 * (vite.report-viewer.config.js), so the page renders from its saved
 * snapshot with no Supabase and none of the app's store. Only what
 * EmployerImpactView reads is provided.
 */
let state = {};

export function loadSnapshot(snapshot) {
  state = {
    employerImpactFilters: snapshot.filters,
    employerImpactFiltersLoaded: true,
    fetchEmployerImpactFilters: () => {},
    // The page asks for the rows its filters need; the snapshot holds exactly those.
    fetchEmployerImpact: () => Promise.resolve(snapshot.rows),
    showToast: () => {},
  };
}

export function useAppStore(selector) {
  return selector(state);
}
useAppStore.getState = () => state;
useAppStore.setState = () => {};
useAppStore.subscribe = () => () => {};
