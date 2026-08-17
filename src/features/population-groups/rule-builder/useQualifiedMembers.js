import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { FIELD_BY_KEY, RULE_FIELDS } from './fieldCatalog';

/* Columns the evaluator reads: every catalog profileColumn plus identity. */
const PROFILE_COLUMNS = ['id', 'patient_id', ...new Set(RULE_FIELDS.map(f => f.profileColumn))];

const norm = (v) => String(v ?? '').toLowerCase();

/* One condition against one profile. Missing data disqualifies (a rule about
   a value nobody recorded shouldn't match) except doesNotContain, where an
   empty list genuinely doesn't contain the needle. */
function matchesRule(profile, rule) {
  const field = FIELD_BY_KEY[rule.field];
  if (!field) return false;
  const raw = profile[field.profileColumn];
  const v = rule.value || {};

  if (field.valueType === 'number') {
    const left = Number(raw);
    const right = Number(v.amount);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    switch (rule.operator) {
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '<': return left < right;
      case '=': return left === right;
      case '!=': return left !== right;
      default: return false;
    }
  }

  if (field.valueType === 'date') {
    const left = raw ? new Date(raw).getTime() : NaN;
    const right = v.text ? new Date(v.text).getTime() : NaN;
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    switch (rule.operator) {
      case '<=': return left <= right;
      case '>=': return left >= right;
      case '=': return new Date(left).toDateString() === new Date(right).toDateString();
      default: return false;
    }
  }

  const needle = norm(v.text);
  if (!needle) return false;
  // jsonb list columns arrive as arrays/objects; flatten to searchable text.
  const haystack = typeof raw === 'string' ? norm(raw) : norm(JSON.stringify(raw ?? ''));
  switch (rule.operator) {
    case '=': return norm(raw) === needle;
    case '!=': return norm(raw) !== needle && raw != null;
    case 'contains': return haystack.includes(needle);
    case 'doesNotContain': return !haystack.includes(needle);
    default: return false;
  }
}

function evaluate(profiles, query) {
  const rules = (query?.rules || []).filter(r => {
    const val = r.value || {};
    return (val.amount ?? val.text ?? '') !== '';
  });
  if (rules.length === 0) return [];
  const or = query.combinator === 'or';
  return profiles.filter(p => (or
    ? rules.some(r => matchesRule(p, r))
    : rules.every(r => matchesRule(p, r))));
}

/**
 * useQualifiedMembers — evaluates a rule tree against every patient profile
 * (p360_profiles) client-side and joins each qualified profile to its
 * identity row for display: p# ids live in `patients`, FOLD#/ap-# ids in
 * `all_patients`. Returns { members, count, loading, refresh }.
 */
export function useQualifiedMembers(query) {
  const [profiles, setProfiles] = useState(null); // null = not fetched yet
  const [identity, setIdentity] = useState(new Map());
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: profs }, { data: pts }, { data: aps }] = await Promise.all([
        supabase.from('p360_profiles').select(PROFILE_COLUMNS.join(',')),
        supabase.from('patients').select('id, name, gender, age, member_id, language, dob'),
        supabase.from('all_patients').select('id, name, gender, age, member_id, language, dob'),
      ]);
      if (cancelled) return;
      const map = new Map();
      (pts || []).forEach(p => map.set(p.id, p));
      (aps || []).forEach(p => map.set(p.id, p));
      setIdentity(map);
      setProfiles(profs || []);
    })();
    return () => { cancelled = true; };
  }, [refreshToken]);

  const members = useMemo(() => {
    if (!profiles) return null;
    return evaluate(profiles, query).map(profile => {
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
  }, [profiles, identity, query]);

  return {
    members: members || [],
    count: members ? members.length : null, // null while loading → rail shows "-"
    loading: profiles === null,
    refresh: () => { setProfiles(null); setRefreshToken(t => t + 1); },
  };
}
