import { useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { PHYSICIAN_ROLE } from '../../../data/medicalSpecialties';
import { OOO_ICON } from '../../ooo/oooUtils';
import { ROLE_COLORS } from '../../settings/account/AccountPanel.constants';
import { formatDate, formatRelative, statusBadge } from '../../settings/account/users/UsersTab.utils';
import { useUsersTab } from '../../settings/account/users/useUsersTab';
import { accountStatus, formatLockTime, isLocked, reasonLabel } from '../../settings/account/users/accountLock';
import { ConfirmSheet } from '../care/CarePlanSheets';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { GroupedRow, GroupedSection } from '../more/GroupedList';
import { NoAccountAccess } from './accountAccess';
import { useAccountAccess } from './useAccountAccess';
import { UnlockSheet } from './UnlockSheet';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './users.module.css';

const join = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : v) || '';

/**
 * One user (desktop View User drawer + the row's UserActions): profile,
 * roles, locations, lock state, and the admin actions with the same
 * useUsersTab calls, permission checks and toasts. Destructive steps
 * (reject, disable, delete) confirm in a bottom sheet first.
 */
export function UserDetailScreen(props) {
  const allowed = useAccountAccess();
  if (!allowed) return <NoAccountAccess title="User" />;
  return <UserDetail {...props} />;
}

function UserDetail({ userId, user: seed }) {
  const { push, pop } = useMobileNav();
  const tab = useUsersTab();
  const fresh = tab.filteredUsers.find(u => u.id === userId);
  const user = fresh || (tab.loading ? seed : null);
  const [ask, setAsk] = useState(null); // 'reject' | 'disable' | 'delete' | 'unlock'
  const [busy, setBusy] = useState(null);

  if (!user) {
    return (
      <div className={common.screen}>
        <MobileSubHeader title="User" />
        <div className={common.body}>
          {tab.loading ? <MobileListSkeleton count={4} height={96} /> : (
            <MobileEmpty icon="solar:user-cross-linear" title="User not found" description="They may have been deleted." />
          )}
        </div>
      </div>
    );
  }

  const raw = user._raw || {};
  const status = accountStatus(user);
  const sb = statusBadge(status);
  const admin = tab.isCurrentUserAdmin;
  const pending = user.status === 'Pending';
  const locked = status === 'Locked';
  const roles = raw.clinical_roles?.length ? raw.clinical_roles : (user.role && user.role !== 'Viewer' ? [user.role] : []);
  const locations = raw.locations?.length ? raw.locations : (user.location ? [user.location] : []);
  const rel = formatRelative(user.lastActiveAt);

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  };
  const close = () => setAsk(null);

  const footer = admin && (pending || locked);
  return (
    <div className={common.screen}>
      <MobileSubHeader
        title={user.name}
        actions={admin ? (
          <ActionButton icon="solar:pen-linear" size="lg" aria-label="Edit user" onClick={() => push('settingsUserEdit', { userId: user.id, user })} />
        ) : null}
      >
        <div className={styles.heroMeta}>
          <Badge tone={sb.variant} icon={sb.icon} size="md" label={status} />
          {user.email && <span className={styles.heroEmail}>{user.email}</span>}
        </div>
      </MobileSubHeader>
      <div className={common.body}>
        <div className={more.stack}>
          <div className={styles.hero}>
            <Avatar variant="staff" size="XL" initials={user.initials} userName={user.name} userId={user.id} locked={locked} />
            <div className={styles.heroText}>
              <span className={styles.heroRole}>{raw.admin_role || 'Business/Practice Owner'}</span>
              <span className={styles.heroSub}>
                {rel ? `Last signed in ${rel.label}` : 'Never signed in'}
              </span>
            </div>
          </div>

          <LockCard
            lock={user.lock}
            canUnlock={admin}
            resending={busy === 'resend'}
            onResend={() => run('resend', () => tab.resendUnlockLink(user))}
          />

          {pending && (
            <p className={styles.notice}>
              <Icon name="solar:clock-circle-linear" size={20} color="currentColor" />
              {admin ? 'Signed up and waiting for approval. They can sign in once approved.' : 'Waiting for a practice admin to approve this sign-up.'}
            </p>
          )}

          <GroupedSection label="Roles">
            {roles.length ? (
              <div className={styles.badges}>
                {roles.map(r => <Badge key={r} tone={ROLE_COLORS[r] || 'primary'} size="md" label={r} />)}
              </div>
            ) : <GroupedRow label="No clinical role" tone="muted" />}
          </GroupedSection>

          <GroupedSection label="Locations">
            {locations.length ? (
              <div className={styles.badges}>
                {locations.map(l => <Badge key={l} tone="neutral" size="md" label={l} />)}
              </div>
            ) : <GroupedRow label="No location" tone="muted" />}
          </GroupedSection>

          {roles.includes(PHYSICIAN_ROLE) && (
            <GroupedSection label="Specialty">
              <GroupedRow label={join(raw.specialties) || '-'} />
            </GroupedSection>
          )}

          <GroupedSection label="Basic info">
            <GroupedRow label="First name" detail={raw.first_name || user.name.split(' ')[0] || '-'} />
            <GroupedRow label="Middle name" detail={raw.middle_name || '-'} />
            <GroupedRow label="Last name" detail={raw.last_name || user.name.split(' ').slice(1).join(' ') || '-'} />
            <GroupedRow label="Date of birth" detail={raw.date_of_birth || '-'} />
            <GroupedRow label="Gender" detail={raw.gender || '-'} />
            <GroupedRow label="Credentials" detail={join(raw.credentials) || '-'} />
            <GroupedRow label="Licence state" detail={join(raw.licence_states) || '-'} />
            <GroupedRow label="Languages" detail={join(raw.languages) || '-'} />
          </GroupedSection>

          <GroupedSection label="Contact">
            <GroupedRow label="Email" detail={user.email || '-'} />
            <GroupedRow label="Mobile" detail={raw.mobile || raw.phone || '-'} />
            <GroupedRow label="Fax" detail={raw.fax || '-'} />
            <GroupedRow label="Address" detail={[raw.address_line1, raw.address_line2, raw.city, raw.state, raw.zip_code].filter(Boolean).join(', ') || '-'} />
          </GroupedSection>

          {raw.bio && (
            <GroupedSection label="Profile">
              <p className={styles.bio}>{raw.bio}</p>
            </GroupedSection>
          )}

          <GroupedSection label="Activity">
            <GroupedRow label="Created" detail={formatDate(user.createdAt)} />
            <GroupedRow label="Last sign-in" detail={formatDate(user.lastActiveAt)} />
          </GroupedSection>

          {admin && (
            <GroupedSection label="Actions">
              {!pending && !locked && (
                <GroupedRow
                  icon="solar:password-linear"
                  label="Reset password"
                  sub={busy === 'reset' ? 'Sending code' : 'Emails a 6-digit reset code'}
                  disabled={busy === 'reset'}
                  onClick={() => run('reset', () => tab.resetPassword(user))}
                  chevron={false}
                />
              )}
              {!pending && (
                <GroupedRow
                  icon={user.status === 'Active' ? 'solar:user-cross-linear' : 'solar:user-check-linear'}
                  label={user.status === 'Active' ? 'Disable user' : 'Enable user'}
                  disabled={busy === 'toggle'}
                  onClick={() => (user.status === 'Active' ? setAsk('disable') : run('toggle', () => tab.toggleUserStatus(user)))}
                  chevron={false}
                />
              )}
              <GroupedRow icon="solar:pen-linear" label="Edit user" onClick={() => push('settingsUserEdit', { userId: user.id, user })} />
              <GroupedRow
                icon={OOO_ICON}
                label="View OOO records"
                onClick={() => push('ooo', { user: { id: user.id, name: user.name, email: user.email, role: user.clinicalRoles?.[0] || user.role } })}
              />
              <GroupedRow icon="solar:trash-bin-minimalistic-linear" label="Delete user" tone="danger" chevron={false} onClick={() => setAsk('delete')} />
            </GroupedSection>
          )}
        </div>
      </div>

      {footer && (
        <div className={styles.footer}>
          {pending ? (
            <>
              <Button size="lg" variant="outline" tone="danger" disabled={!!busy} onClick={() => setAsk('reject')}>Reject</Button>
              <Button size="lg" loading={busy === 'approve'} disabled={!!busy} onClick={() => run('approve', () => tab.reviewSignup(user, true))}>Approve</Button>
            </>
          ) : (
            <Button size="lg" leadingIcon="solar:lock-keyhole-unlocked-linear" onClick={() => setAsk('unlock')}>Unlock account</Button>
          )}
        </div>
      )}

      {ask === 'reject' && (
        <ConfirmSheet
          title={`Reject ${user.name}?`}
          text="They won't be able to sign in. You can enable the account later."
          confirmLabel="Reject"
          busy={busy === 'reject'}
          onClose={close}
          onConfirm={() => run('reject', async () => { await tab.reviewSignup(user, false); close(); })}
        />
      )}
      {ask === 'disable' && (
        <ConfirmSheet
          title={`Disable ${user.name}?`}
          text="They're signed out and can't sign in until an admin enables the account again."
          confirmLabel="Disable"
          busy={busy === 'toggle'}
          onClose={close}
          onConfirm={() => run('toggle', async () => { await tab.toggleUserStatus(user); close(); })}
        />
      )}
      {ask === 'delete' && (
        <ConfirmSheet
          title={`Delete ${user.name}?`}
          text="This permanently removes them from the platform and can't be undone."
          confirmLabel="Delete"
          busy={busy === 'delete'}
          onClose={close}
          onConfirm={() => run('delete', async () => {
            const ok = await tab.deleteUser(user, { confirmed: true });
            close();
            if (ok) pop();
          })}
        />
      )}
      {ask === 'unlock' && (
        <UnlockSheet
          user={user}
          onClose={close}
          onConfirm={async (choice) => { if (await tab.unlockAccount(user, choice)) close(); }}
        />
      )}
    </div>
  );
}

/** Lock state (desktop AccountLockPanel): locked, or unlocked and waiting for a new password. */
function LockCard({ lock, canUnlock, onResend, resending }) {
  if (!lock) return null;
  if (isLocked(lock)) {
    const attempts = lock.failed_count || 5;
    const details = [
      `Since ${formatLockTime(lock.locked_at)}`,
      `${attempts} failed attempt${attempts === 1 ? '' : 's'}`,
      (lock.failed_apps || []).join(', '),
      lock.locked_by === 'system' ? 'Locked by the system' : lock.locked_by && `Locked by ${lock.locked_by}`,
      !canUnlock && 'Only a practice admin can unlock it',
    ].filter(Boolean).join(' · ');
    return (
      <section className={[styles.lock, styles.lockLocked].join(' ')} aria-label="Account locked">
        <Icon name="solar:lock-keyhole-minimalistic-linear" size={24} color="var(--status-error)" />
        <span className={styles.lockText}>
          <span className={styles.lockTitle}>Account locked</span>
          <span className={styles.lockNote}>{details}</span>
        </span>
      </section>
    );
  }
  if (!lock.unlocked_at || !lock.require_reset) return null;
  const by = lock.unlock_reason === 'password_reset' ? 'the user' : (lock.unlocked_by_name || 'an admin');
  const reason = `${reasonLabel(lock.unlock_reason)}${lock.unlock_note ? ` (${lock.unlock_note})` : ''}`;
  return (
    <section className={styles.lock} aria-label="Account unlocked">
      <Icon name="solar:lock-keyhole-unlocked-linear" size={24} color="var(--neutral-300)" />
      <span className={styles.lockText}>
        <span className={styles.lockTitle}>Unlocked by {by}, {formatLockTime(lock.unlocked_at)}</span>
        <span className={styles.lockNote}>Reason: {reason} · Waiting for them to set a new password from the emailed link</span>
        {canUnlock && (
          <Button size="lg" variant="outline" leadingIcon="solar:letter-linear" loading={resending} onClick={onResend}>Resend link</Button>
        )}
      </span>
    </section>
  );
}
