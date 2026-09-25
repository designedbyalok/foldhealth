// Local fallback for the practice's eFax numbers until
// supabase/efax_numbers_migration.sql has run. Mirrors that file's seed rows
// (same ids) so switching to the DB changes nothing on screen.

export const EFAX_NUMBERS_MOCK = [
  { id: 'efax-1', name: 'Primary Office', number: '(619) 555-1234', linkedUserIds: [], isActive: true },
  { id: 'efax-2', name: 'Care Management', number: '(619) 555-1288', linkedUserIds: [], isActive: true },
  { id: 'efax-3', name: 'Billing', number: '(619) 555-1299', linkedUserIds: [], isActive: false },
];
