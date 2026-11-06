import { createContext, useContext } from 'react';

/**
 * Screen stack for the provider mobile app. `push(screen, props)` opens a
 * sub-screen over the current tab, `pop()` goes back, `setTab(key)` switches
 * the bottom tab and clears the stack, `openMember({ id, memberId, name })`
 * opens a patient's profile from any id space.
 */
export const MobileNavContext = createContext({ push: () => {}, pop: () => {}, setTab: () => {}, openMember: () => {} });

export const useMobileNav = () => useContext(MobileNavContext);
