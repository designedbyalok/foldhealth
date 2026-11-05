// Rewrites goal + intervention library seeds with clinically meaningful priorities.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { goalPriority, interventionPriority } from './carePlanPriorityRules.mjs';

const root = new URL('..', import.meta.url).pathname;
const goalPath = `${root}/src/features/settings/care-plan-library/data/carePlanGoalLibrarySeed.js`;
const intvPath = `${root}/src/features/settings/care-plan-library/data/carePlanInterventionLibrarySeed.js`;

const goalMod = await import(pathToFileURL(goalPath).href);
const goals = goalMod.CARE_PLAN_GOAL_LIBRARY.map((g) => ({
  ...g,
  priority: goalPriority(g),
}));

const intvMod = await import(pathToFileURL(intvPath).href);
const interventions = intvMod.CARE_PLAN_INTERVENTION_LIBRARY.map((row) => {
  let parentPriority = 'medium';
  for (const g of goals) {
    if ((g.links || []).some((l) => l.id === row.id)) {
      parentPriority = g.priority;
      break;
    }
  }
  const priority = interventionPriority(row, parentPriority);
  return {
    ...row,
    config: { ...(row.config || {}), priority },
  };
});

const goalHeader = `// Structured Care Plan Goals Library
// Generated from structured_care_plan_goals_library.md. Upserted by
// \`bun run seed\` (onConflict: 'id'). Priorities assigned by
// scripts/applyCarePlanLibraryPriorities.mjs, re-run after library content changes.

export const CARE_PLAN_GOAL_LIBRARY = ${JSON.stringify(goals, null, 2)};
`;

const intvHeader = `// Care Plan Interventions Library (reusable templates)
// Generated from structured_care_plan_goals_library.md. Upserted by
// \`bun run seed\` (onConflict: 'id'). Priorities in config assigned by
// scripts/applyCarePlanLibraryPriorities.mjs, re-run after library content changes.

export const CARE_PLAN_INTERVENTION_LIBRARY = ${JSON.stringify(interventions, null, 2)};
`;

const goalRaw = readFileSync(goalPath, 'utf8');
const goalSplit = '\n];\n\n// The seed authored every goal';
const goalSplitIdx = goalRaw.indexOf(goalSplit);
if (goalSplitIdx < 0) throw new Error('Could not find goal library footer marker');
const goalFooter = goalRaw.slice(goalSplitIdx + '\n];\n\n'.length);

const intvRaw = readFileSync(intvPath, 'utf8');
const intvSplit = '\n];\n\nexport function carePlanInterventionLibraryToRow';
const intvSplitIdx = intvRaw.indexOf(intvSplit);
if (intvSplitIdx < 0) throw new Error('Could not find intervention library footer marker');
const intvFooter = intvRaw.slice(intvSplitIdx + '\n];\n\n'.length);

writeFileSync(goalPath, goalHeader.trimEnd() + '\n\n' + goalFooter);
writeFileSync(intvPath, intvHeader.trimEnd() + '\n\n' + intvFooter);

const goalCounts = { high: 0, medium: 0, low: 0 };
for (const g of goals) goalCounts[g.priority] = (goalCounts[g.priority] || 0) + 1;
const intvCounts = { high: 0, medium: 0, low: 0 };
for (const i of interventions) {
  const p = i.config?.priority || 'medium';
  intvCounts[p] = (intvCounts[p] || 0) + 1;
}
console.log('Goals:', goalCounts);
console.log('Intervention templates:', intvCounts);
