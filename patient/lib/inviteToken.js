// Invite and reset emails link to #/set-password?token_hash=…&type=recovery
// (api/_handlers/patient-invite.js). Read once at load: the hash router may
// rewrite the URL afterwards.
export function readInviteToken(hash = window.location.hash) {
  const h = String(hash || '');
  if (!h.startsWith('#/set-password')) return null;
  const q = h.indexOf('?');
  const params = new URLSearchParams(q >= 0 ? h.slice(q + 1) : '');
  const tokenHash = params.get('token_hash');
  return tokenHash ? { tokenHash, type: params.get('type') || 'recovery' } : null;
}
