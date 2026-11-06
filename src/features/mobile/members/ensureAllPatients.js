import { useAppStore } from '../../../store/useAppStore';

// fetchAllPatients returns at once while an earlier call is still loading;
// wait for that load so a lookup doesn't run against an empty list.
export async function ensureAllPatients() {
  await useAppStore.getState().fetchAllPatients();
  if (!useAppStore.getState().allPatientsLoading) return;
  await new Promise((resolve) => {
    const off = useAppStore.subscribe((s) => {
      if (!s.allPatientsLoading) { off(); resolve(); }
    });
  });
}
