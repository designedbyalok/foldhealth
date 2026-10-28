import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/Input/Input';
import { Button } from '@/components/Button/Button';
import { useProfile } from '../lib/profileContext';
import styles from './Settings.module.css';

const MIN_LENGTH = 8;

export function ChangePassword() {
  const { viewingAs } = useProfile();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (viewingAs) {
    return <p className={styles.note}>You are signed in with your care team account. Change its password in the Fold Health staff app.</p>;
  }

  const save = async (e) => {
    e.preventDefault();
    if (next.length < MIN_LENGTH) { setError(`Use at least ${MIN_LENGTH} characters.`); return; }
    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Re-checks the current password so an unattended session can't change it.
      const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (authError) { setError('Your current password is not right.'); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) { setError(updateError.message); return; }
      setCurrent(''); setNext(''); setConfirm('');
      toast.success('Password changed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={`${styles.stack} ${styles.narrow}`} onSubmit={save} noValidate>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Input label="Current password" aria-label="Current password" type="password" autoComplete="current-password" showPasswordToggle value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Input label="New password" aria-label="New password" type="password" autoComplete="new-password" showPasswordToggle helperText={`At least ${MIN_LENGTH} characters`} value={next} onChange={(e) => setNext(e.target.value)} />
      <Input label="Confirm new password" aria-label="Confirm new password" type="password" autoComplete="new-password" showPasswordToggle value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button variant="primary" size="L" type="submit" disabled={saving || !current || !next || !confirm}>
        {saving ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  );
}
