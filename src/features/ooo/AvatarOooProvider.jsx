import { useCallback } from 'react';
import { AvatarOooLookup } from '../../components/Avatar/AvatarOooLookup';
import { useAppStore } from '../../store/useAppStore';
import { activeOooFor } from './oooUtils';

/** Lets every Avatar given a `userName` show that person's Out of Office badge. */
export function AvatarOooProvider({ children }) {
  const records = useAppStore(s => s.oooRecords);
  const lookup = useCallback((who) => activeOooFor(records, who), [records]);
  return <AvatarOooLookup.Provider value={lookup}>{children}</AvatarOooLookup.Provider>;
}
