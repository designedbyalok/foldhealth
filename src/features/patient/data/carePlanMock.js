// Care Plan step content for the program window (Figma 482:253058).
// Local demo data: Goals + Interventions tables and the condition chip row.
export const CARE_PLAN_MOCK = {
  createdBy: 'Ivy Ralph',
  createdDate: '09/11/24',
  conditions: [
    { label: 'Diabetes Mellitus Type 2', primary: true },
    { label: 'Hypertension' },
    { label: 'Diabetes', removable: true },
    { label: 'Cholesterol', removable: true },
    { label: 'Asthma', removable: true },
    { label: 'Arthritis', removable: true },
  ],
  conditionTotal: 31,
  goals: [
    { id: 'g1', priority: 'high', icon: 'solar:dumbbell-small-linear', title: 'Target to achieve a healthy weight', subtitle: 'Weight <= 160 lbs', links: 8, currentValue: 'No Data', trend: '-', progress: '-', status: 'Not Started' },
    { id: 'g2', priority: 'high', icon: 'solar:pen-linear', title: 'Avoid episodes of low blood glucose', subtitle: 'Low blood glucose <70 mgdL', links: 4, currentValue: 'No Data', trend: '-', progress: '-', status: 'Not Started' },
    { id: 'g3', priority: 'high', icon: 'solar:heart-pulse-linear', title: 'Target an average blood pressure', subtitle: 'Blood pressure < 140/90 mmHg • 3 Months', links: 6, currentValue: 'No Data', trend: '-', progress: '-', status: 'Not Started' },
    { id: 'g4', priority: 'high', icon: 'solar:dumbbell-small-linear', title: 'Eat a healthier diet for hypertensive patients', subtitle: '', links: 1, currentValue: '', trend: '-', progress: '-', status: 'Not Started' },
    { id: 'g5', priority: 'high', icon: 'solar:pen-linear', title: 'Get my hypertension routine lab tests once a year', subtitle: '', links: 0, currentValue: '', trend: '-', progress: '-', status: 'Not Started' },
    { id: 'g6', priority: 'high', icon: 'solar:checklist-minimalistic-linear', title: 'Stop drinking', subtitle: '', links: 3, currentValue: '', trend: '-', progress: '-', status: 'Not Started' },
  ],
  interventions: [
    { id: 'i1', priority: 'high', icon: 'solar:book-linear', title: 'Learn how to use a blood pressure measuring device', duration: null, links: 3, assignee: { name: 'Terri Schuster', initials: 'TS' }, adherence: '-', status: 'Not Started' },
    { id: 'i2', priority: 'high', icon: 'solar:clipboard-list-linear', title: 'Measure blood pressure everyday', duration: '9D', links: 3, assignee: { name: 'Terri Schuster', initials: 'TS' }, adherence: '-', status: 'Not Started' },
  ],
  barriers: [
    { id: 'b1', priority: 'high', title: 'Transportation: no reliable ride to clinic', description: 'Patient reports missing appointments due to bus schedule.', status: 'Not Started' },
    { id: 'b2', priority: 'medium', title: 'Health Literacy: confused about medication schedule', description: 'Needs simplified dosing calendar.', status: 'In Progress' },
  ],
};
