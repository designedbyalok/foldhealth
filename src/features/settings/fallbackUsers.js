// Fallback Account → Users roster. Lives in its own data module (not in
// AccountPanel.jsx) so consumers like hcc/systemUsers.js, which needs it at
// module-eval time: don't form an import cycle through AccountPanel →
// useAppStore → systemUsers. That cycle is evaluation-order-fragile and
// throws "Cannot access 'FALLBACK_USERS' before initialization".

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
}

export const FALLBACK_USERS = [
  { name: 'Amy Brenneman', email: 'amy.brenneman@email.com', role: 'Physician/Doctor', location: 'Toms River', extraRoles: 4, extraLocations: 0 },
  { name: 'Michael Corleone', email: 'michael.corleone@email.com', role: 'Nurse', location: 'Montebello', extraRoles: 9, extraLocations: 12 },
  { name: 'Larry Sanders', email: 'larry.sanders@email.com', role: 'Medical Assistant', location: 'Sparks', extraRoles: 6, extraLocations: 0 },
  { name: 'Tina Turner', email: 'tina.turner@email.com', role: 'Admin/Practice Manager', location: 'Chesapeake', extraRoles: 12, extraLocations: 1 },
  { name: 'Manny Grizwald', email: 'manny.grizwald@email.com', role: 'Billing Specialist', location: 'Visalia', extraRoles: 10, extraLocations: 4 },
  { name: 'Bobby Brown', email: 'bobby.brown@email.com', role: 'Front Desk Staff/Receptionist', location: 'Lowell', extraRoles: 0, extraLocations: 2 },
  { name: 'Charlie Chaplin', email: 'charlie.chaplin@email.com', role: 'Lab Technician', location: 'Palm Bay', extraRoles: 13, extraLocations: 3 },
  { name: 'John Doe', email: 'john.doe@email.com', role: 'Pharmacist', location: 'Lawton', extraRoles: 10, extraLocations: 2 },
  { name: 'Bruce Springsteen', email: 'bruce.springsteen@email.com', role: 'Health Information Manager (HIM)', location: 'Oceanside', extraRoles: 14, extraLocations: 40 },
  { name: 'Elon Butters', email: 'elon.butters@email.com', role: 'Radiologist', location: 'Merced', extraRoles: 9, extraLocations: 7 },
  { name: 'Samatha Abington', email: 'samanthab@email.com', role: 'Patient', location: 'Oakland Park', extraRoles: 1, extraLocations: 4 },
].map((u, i) => ({
  id: `fallback-${i}`, ...u,
  initials: getInitials(u.name).toUpperCase(),
  status: 'Active',
}));
