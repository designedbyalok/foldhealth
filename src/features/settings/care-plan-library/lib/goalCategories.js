// The goal category enum, in natural read order: physical measurements first,
// lifestyle, then Assessment (structured instruments), then the free-form
// Others catch-all bucket.
export const GOAL_CATEGORIES = ['Vitals', 'Labs', 'Diet', 'Exercise', 'Assessment', 'Others'];

// Older seeded rows carry the previous labels ('Vital' / 'Activity' /
// 'Lab result' / 'Other'). Map them to the new enum on read so every surface
// lands on the correct tab even before `bun run seed` re-runs. Assessment kept
// its name across the rename.
const LEGACY_CATEGORY_MAP = {
  Vital: 'Vitals',
  Activity: 'Exercise',
  'Lab result': 'Labs',
  Other: 'Others',
};

export const normalizeCategory = (c) => LEGACY_CATEGORY_MAP[c] || c || GOAL_CATEGORIES[0];
