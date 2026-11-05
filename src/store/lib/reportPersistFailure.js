import { toast } from '../../components/Toast/sonnerToast';
import { track } from '../../lib/tracking';

let _lastPersistToastAt = 0;

export function reportPersistFailure(op, error) {
  const msg = (error && error.message) || 'unknown error';
  console.warn(`${op} failed:`, msg);
  try { track('persist.failed', { op, message: msg }); } catch { /* ignore */ }
  const now = Date.now();
  if (now - _lastPersistToastAt > 3000) {
    _lastPersistToastAt = now;
    try { toast.error?.("Couldn't save changes: refresh to see the last saved state."); } catch { /* ignore */ }
  }
}
