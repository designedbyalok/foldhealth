import { createContext, useContext } from 'react';

// { profiles, profile, select(memberId), viewingAs? } for the signed-in
// user; `profile` is the person every screen currently acts for. `viewingAs`
// ({ switchPatient }) is set only for a provider-portal user viewing as a patient.
export const ProfileContext = createContext(null);

export const useProfile = () => useContext(ProfileContext);
