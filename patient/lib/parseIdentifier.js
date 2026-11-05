// Patients sign in with the email or mobile number on their record.
// A bare 10-digit number is treated as US (+1).
export function parseIdentifier(raw) {
  const value = raw.trim();
  if (value.includes('@')) return { email: value.toLowerCase() };
  const digits = value.replace(/[^\d]/g, '');
  if (value.startsWith('+') && digits.length >= 8) return { phone: `+${digits}` };
  if (digits.length === 10) return { phone: `+1${digits}` };
  return null;
}
