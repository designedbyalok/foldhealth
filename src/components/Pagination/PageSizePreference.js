import { createContext } from 'react';

/**
 * The user's page-size choice, shared by every Pagination: `auto` (fit the
 * rows to the viewport) or a fixed `size`. `load()` fetches it once and
 * `save({ auto, size })` records a change; `loaded` says the stored choice
 * has arrived. The library default fits to the viewport and remembers
 * nothing; the app provides its saved preference (features/worklists).
 */
export const PageSizePreference = createContext({
  auto: true,
  size: 10,
  loaded: false,
  load: () => {},
  save: () => {},
});
