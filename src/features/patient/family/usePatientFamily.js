import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { resolveMember } from './familyMembers';

/**
 * The banner's Family & Caregiver list: the profile's family plus the people
 * added in Add Family, Caregivers & Decision Makers, and how many members
 * list this patient as their family. It loads only once `active` (the
 * section is on screen); `loading` is true until it has.
 */
export function usePatientFamily(patientId, profileFamily = [], active = true) {
  const key = patientId == null ? null : String(patientId);
  const added = useAppStore(s => (key ? s.familyMembers[key] : null));
  const familyOf = useAppStore(s => (key ? s.familyOfCount[key] : 0)) || 0;
  const patients = useAppStore(s => s.allPatients);
  const fetchFamilyMembers = useAppStore(s => s.fetchFamilyMembers);
  useEffect(() => { if (key && active) fetchFamilyMembers(key); }, [key, active, fetchFamilyMembers]);
  const family = useMemo(() => {
    const extra = (added || []).map((m) => {
      const r = resolveMember(m, patients || []);
      return { name: r.name, relation: r.relationship, initials: r.initials };
    });
    const names = new Set(extra.map(x => x.name.toLowerCase()));
    return [...(profileFamily || []).filter(f => !names.has(String(f.name).toLowerCase())), ...extra];
  }, [added, patients, profileFamily]);
  return { family, familyOf, loading: !!key && active && added === undefined };
}
