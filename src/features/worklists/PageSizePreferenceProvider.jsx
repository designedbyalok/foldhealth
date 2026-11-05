import { useMemo } from 'react';
import { PageSizePreference } from '../../components/Pagination/PageSizePreference';
import { useAppStore } from '../../store/useAppStore';

/** Every Pagination follows the user's saved page size (Supabase via the store). */
export function PageSizePreferenceProvider({ children }) {
  const auto = useAppStore(s => s.autoPageSize);
  const size = useAppStore(s => s.manualPageSize);
  const loaded = useAppStore(s => s.pageSizePrefLoaded);
  const load = useAppStore(s => s.fetchPageSizePref);
  const save = useAppStore(s => s.savePageSizePref);
  const value = useMemo(() => ({ auto, size, loaded, load, save }), [auto, size, loaded, load, save]);
  return <PageSizePreference.Provider value={value}>{children}</PageSizePreference.Provider>;
}
