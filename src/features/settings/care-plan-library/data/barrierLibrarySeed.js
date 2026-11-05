// Barriers Library seed: Figma SNP-Story 7550:489275 (Add Barriers drawer).
// Upserted by `bun run seed` into `care_plan_barriers`.
export const CARE_PLAN_BARRIER_LIBRARY = [
  { id: 'a0000001-0000-4000-8000-000000000001', title: 'Set a goal to overcome obstacles in your care plan.', description: '' },
  { id: 'a0000001-0000-4000-8000-000000000002', title: 'Aim to break down barriers to achieving a blood pressure target of <130/80.', description: '' },
  { id: 'a0000001-0000-4000-8000-000000000003', title: 'Ensure that your oxygen saturation (SpO2) remains above 95% despite any challenges.', description: '' },
  { id: 'a0000001-0000-4000-8000-000000000004', title: 'Focus on maintaining a steady resting heart rate while navigating care barriers.', description: '' },
  { id: 'a0000001-0000-4000-8000-000000000005', title: 'Work towards keeping your HBA1c at or below 7.5% while addressing any hurdles.', description: '' },
  { id: 'a0000001-0000-4000-8000-000000000006', title: 'Schedule annual lab tests for hypertension management to identify any barriers.', description: '' },
  { id: 'a0000001-0000-4000-8000-000000000007', title: 'Strive to keep LDL cholesterol levels in check while overcoming any obstacles.', description: '' },
  { id: 'a0000001-0000-4000-8000-000000000008', title: 'Aim to maintain HBA1c levels while tackling any barriers in your care plan.', description: '' },
  { id: 'a0000001-0000-4000-8000-000000000009', title: 'Monitor blood glucose levels after meals, focusing on overcoming any challenges.', description: '' },
  { id: 'a0000001-0000-4000-8000-00000000000a', title: 'Adopt a healthier diet tailored for hypertensive patients, addressing any barriers.', description: '' },
  { id: 'a0000001-0000-4000-8000-00000000000b', title: 'Set a target to maintain a normal BMI while navigating care plan challenges.', description: '' },
  { id: 'a0000001-0000-4000-8000-00000000000c', title: 'Aim to achieve a healthy weight of less than 160 lbs while overcoming barriers.', description: '' },
  { id: 'a0000001-0000-4000-8000-00000000000d', title: 'Create an activity plan that includes moderate exercise, focusing on overcoming obstacles.', description: '' },
  { id: 'a0000001-0000-4000-8000-00000000000e', title: 'Begin your exercise journey while addressing any barriers to physical activity.', description: '' },
];

export function carePlanBarrierLibraryToRow(b) {
  return {
    id: b.id,
    title: b.title,
    description: b.description || '',
  };
}
