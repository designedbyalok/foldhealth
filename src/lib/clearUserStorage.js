// Per-user data this browser keeps between visits. Cleared at sign-out so the
// next person on a shared workstation doesn't inherit it.
const KEYS = ['apcm-saved-signatures', 'fold:testEmailRecents', 'fold-comms-v2'];
const PREFIXES = ['foldEditUserDraft:'];

export function clearUserStorage() {
  try {
    for (const k of KEYS) localStorage.removeItem(k);
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i);
      if (k && PREFIXES.some(p => k.startsWith(p))) localStorage.removeItem(k);
    }
  } catch { /* storage blocked */ }
}
