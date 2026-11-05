import { useMemo } from 'react';
import { ActivityLogRenderers } from '../../components/ActivityLog/ActivityLogRenderers';
import { useAppStore } from '../../store/useAppStore';
import { DetailCardEntryBody, ReferralEntryBody } from './ActivityEntries';

/** Gives every ActivityLog the app's note, task, appointment and referral entries. */
export function ActivityLogRenderersProvider({ children }) {
  const viewerName = useAppStore(s => s.currentUserProfile?.name);
  const value = useMemo(() => ({ detailCard: DetailCardEntryBody, referral: ReferralEntryBody, viewerName }), [viewerName]);
  return <ActivityLogRenderers.Provider value={value}>{children}</ActivityLogRenderers.Provider>;
}
