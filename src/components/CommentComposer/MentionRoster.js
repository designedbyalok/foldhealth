import { createContext } from 'react';

/**
 * Who a CommentComposer offers for @-mentions when the caller passes no
 * `users`: `{ users, load }`, where `load()` fetches the roster (called when a
 * composer mounts). Empty in the library; the app provides its people
 * (features/activity/MentionRosterProvider).
 */
export const MentionRoster = createContext({ users: [], load: () => {} });
