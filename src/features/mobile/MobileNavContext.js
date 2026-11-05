import { createContext, useContext } from 'react';

/**
 * Screen stack for the provider mobile app. `push(screen, props)` opens a
 * sub-screen over the current tab, `pop()` goes back, `setTab(key)` switches
 * the bottom tab and clears the stack.
 */
export const MobileNavContext = createContext({ push: () => {}, pop: () => {}, setTab: () => {} });

export const useMobileNav = () => useContext(MobileNavContext);
