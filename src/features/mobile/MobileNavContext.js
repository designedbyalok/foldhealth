import { createContext, useContext } from 'react';

/**
 * Screen stack for the provider mobile app. `push(screen, props)` opens a
 * sub-screen over the current tab, `pop()` goes back, `setTab(key)` switches
 * the bottom tab and clears the stack (`canTab(key)`: is it allowed),
 * `openMember({ id, memberId, name, tab? })`
 * opens a patient's profile from any id space.
 */
export const MobileNavContext = createContext({ push: () => {}, pop: () => {}, setTab: () => {}, canTab: () => false, openMember: () => {} });

export const useMobileNav = () => useContext(MobileNavContext);
