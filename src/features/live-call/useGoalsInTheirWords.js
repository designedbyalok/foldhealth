import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useCallPatient } from './useCallPatient';

const EMPTY = [];

/**
 * The patient's care plan goals that carry their own words (patientTitle),
 * across their open programs: "I want to walk to church again" beside the
 * clinical goal it belongs to. Loads each program's plan if it isn't yet.
 */
export function useGoalsInTheirWords(patient) {
  const { pid, programs } = useCallPatient(patient);
  const plans = useAppStore(s => s.patientCarePlans) || EMPTY;
  const programIds = programs.map(p => p.id).join('|');
  useEffect(() => {
    const s = useAppStore.getState();
    for (const p of programs) s.fetchPatientCarePlan?.(pid, p.id);
    // programIds stands in for programs: refetch only when the set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid, programIds]);

  return useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of programs) {
      for (const g of plans[`${pid}::${p.id}`]?.goals || EMPTY) {
        const words = String(g.patientTitle || '').trim();
        if (!words || seen.has(words.toLowerCase())) continue;
        seen.add(words.toLowerCase());
        out.push({ id: g.id, words, goal: g.title, program: p.code });
      }
    }
    return out;
  }, [plans, pid, programs]);
}
