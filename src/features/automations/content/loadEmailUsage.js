import { useAppStore } from '../../../store/useAppStore';
import { automationsUsingEmail } from './emailUsage';

// fetchAutomations returns at once while another caller's load is in flight,
// so wait for the status to settle before reading the list.
function automationsReady() {
  const { automationsStatus, fetchAutomations } = useAppStore.getState();
  if (automationsStatus === 'ready') return Promise.resolve();
  if (automationsStatus !== 'loading') return fetchAutomations();
  return new Promise((resolve) => {
    const unsubscribe = useAppStore.subscribe((s) => {
      if (s.automationsStatus !== 'loading') { unsubscribe(); resolve(); }
    });
  });
}

/** Loads automations if needed and returns the ones that send any of `emailIds`. */
export async function loadEmailUsage(emailIds) {
  await automationsReady();
  return automationsUsingEmail(useAppStore.getState().automations, emailIds);
}
