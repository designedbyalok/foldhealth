import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { PROFILE_COLUMNS, evaluate, hasEventRules } from './evaluateRules';

/* Supabase caps a select at 1000 rows, page through in batches so the
   evaluation always runs against the FULL population, not a silent
   truncation. */
const BATCH = 1000;
async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + BATCH - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < BATCH) return rows;
  }
}

/* Fetch all clinical events and group them by patient_id → event_type. */
async function fetchEvents() {
  try {
    const rows = await fetchAll(
      'patient_clinical_events',
      'patient_id, event_type, code, code_system, display, effective_date, numeric_value, unit',
    );
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.patient_id)) map.set(row.patient_id, {});
      const byType = map.get(row.patient_id);
      (byType[row.event_type] ||= []).push(row);
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * useQualifiedMembers: evaluates a rule tree against every patient profile
 * (p360_profiles) client-side and joins each qualified profile to its
 * identity row for display.
 *
 * Hybrid evaluation: for rules that reference profile columns only, evaluation
 * runs purely in-memory. When the rule tree includes coded terminology,
 * observation, or event-count rules, the hook also fetches
 * patient_clinical_events and injects events into each profile as `_events`
 * so the evaluator can match against them.
 *
 * Returns { members, count, loading, error, refresh }.
 */
export function useQualifiedMembers(query) {
  const [profiles, setProfiles] = useState(null);
  const [identity, setIdentity] = useState(new Map());
  const [events, setEvents] = useState(new Map());
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const needsEvents = hasEventRules(query);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const promises = [
          fetchAll('p360_profiles', PROFILE_COLUMNS.join(',')),
          fetchAll('patients', 'id, name, gender, age, member_id, language, dob'),
          fetchAll('all_patients', 'id, name, gender, age, member_id, language, dob'),
        ];
        if (needsEvents) promises.push(fetchEvents());

        const results = await Promise.all(promises);
        if (cancelled) return;

        const [profs, pts, aps] = results;
        const evMap = needsEvents ? results[3] : new Map();

        const map = new Map();
        pts.forEach(p => map.set(p.id, p));
        aps.forEach(p => map.set(p.id, p));

        setIdentity(map);
        setEvents(evMap);
        setProfiles(profs);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.warn('[useQualifiedMembers] fetch failed:', err.message);
        setProfiles([]);
        setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshToken, needsEvents]);

  const members = useMemo(() => {
    if (!profiles) return null;

    /* Inject event data into profiles for event-level rule evaluation. */
    const enriched = needsEvents
      ? profiles.map(p => ({ ...p, _events: events.get(p.patient_id) || {} }))
      : profiles;

    return evaluate(enriched, query).map(profile => {
      const idr = identity.get(profile.patient_id) || {};
      return {
        id: profile.patient_id,
        name: idr.name || profile.patient_id,
        gender: idr.gender || profile.sex_at_birth || '',
        age: profile.age ?? idr.age ?? '',
        memberId: idr.member_id || profile.patient_id,
        language: idr.language || 'en',
        state: profile.state || '',
        membershipStatus: profile.membership_status || '',
        engagement: profile.engagement_level || '',
      };
    });
  }, [profiles, identity, events, query, needsEvents]);

  return {
    members: members || [],
    count: error ? null : (members ? members.length : null),
    loading: profiles === null,
    error,
    refresh: () => { setProfiles(null); setError(null); setRefreshToken(t => t + 1); },
  };
}
