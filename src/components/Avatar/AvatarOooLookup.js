import { createContext } from 'react';

/**
 * How an Avatar given `userName` (and `userId`) finds that person's current
 * Out of Office record: `(who) => record | null`, where `who` is a name or
 * `{ id, name }`. Empty in the library, so no badge shows; the app provides
 * one that reads its OOO records (features/ooo/AvatarOooProvider).
 */
export const AvatarOooLookup = createContext(null);
