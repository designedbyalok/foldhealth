import { createContext } from 'react';

/**
 * Entry bodies an ActivityLog can't draw on its own because they open app
 * records: `detailCard` (clinical notes, tasks, appointments) and `referral`,
 * plus `viewerName` (the signed-in user, whose @-mentions in comments are
 * highlighted). Empty in the library, where those entries fall back to the
 * generic body; the app provides them (features/activity).
 */
export const ActivityLogRenderers = createContext({});
