import { createContext } from 'react';

/**
 * What a BulkBar uses when its caller doesn't say: the selection and clear
 * (`selectedIds`, `onClear`), and the actions to offer
 * (`actions({ selectedIds, onChangeAssignee })` returning
 * `{ actions, moreActions }`). Empty in the library; the app provides its
 * defaults (features/worklists/BulkBarDefaultsProvider).
 */
export const BulkBarDefaults = createContext({});
