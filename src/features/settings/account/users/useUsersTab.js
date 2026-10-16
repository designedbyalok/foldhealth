import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAppStore } from '../../../../store/useAppStore';
import { FALLBACK_USERS } from '../../fallbackUsers';
import { getInitials } from '../AccountPanel.constants';
import { ROLE_FIELDS } from './UsersTab.utils';
import { apiFetch } from '../../../../lib/apiFetch';
import { flushSecurityEmails } from '../../../auth/accountSecurity';
import { isLocked } from './accountLock';

// Map a raw `profiles` row to the user shape the table renders. Shared by the
// list fetch and the single-row save so a save can update just its own row
// (from the UPDATE's returned row) instead of re-fetching the whole table.
function mapProfileRow(u) {
  const displayName = u.full_name?.trim() || u.email?.split('@')[0] || 'Unknown';
  return {
    id: u.id,
    name: displayName,
    email: u.email || '',
    initials: getInitials(displayName).toUpperCase(),
    status: u.status || 'Active',
    role: u.clinical_roles?.length > 0 ? u.clinical_roles[0] : (u.role || 'Viewer'),
    clinicalRoles: u.clinical_roles || [],
    extraRoles: u.clinical_roles?.length > 1 ? u.clinical_roles.length - 1 : (u.extra_roles || 0),
    location: u.locations?.length > 0 ? u.locations[0] : (u.practice_location || ''),
    locations: u.locations || [],
    extraLocations: u.locations?.length > 1 ? u.locations.length - 1 : (u.extra_locations || 0),
    department: u.department || '',
    phone: u.phone || u.mobile || '',
    avatarUrl: u.avatar_url || '',
    lastActiveAt: u.last_active_at,
    createdAt: u.created_at,
    _raw: u,
  };
}

export function useUsersTab() {
  const showToast = useAppStore(s => s.showToast);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  // A notification can hand over a status filter ("Pending") either before
  // this tab mounts (seeded here) or while it is already open (subscription).
  const [filterOpen, setFilterOpen] = useState(() => !!useAppStore.getState().pendingUsersStatusFilter);
  const [userFilters, setUserFilters] = useState(() => ({
    status: useAppStore.getState().pendingUsersStatusFilter || [], roles: [], location: [],
  }));
  useEffect(() => {
    useAppStore.getState().clearPendingUsersStatusFilter();
    return useAppStore.subscribe((s) => {
      if (!s.pendingUsersStatusFilter) return;
      setUserFilters({ status: s.pendingUsersStatusFilter, roles: [], location: [] });
      setFilterOpen(true);
      s.clearPendingUsersStatusFilter();
    });
  }, []);
  const currentUserIdRef = useRef(null);
  // Signed-in user's id, and the dev-bypass flag for "no session at all".
  // Only `getSession()` runs here — it reads the locally persisted session and
  // costs no round trip, unlike `getUser()`.
  const [meId, setMeId] = useState(null);
  const [noSession, setNoSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session;
      if (!session) { setNoSession(true); return; }
      currentUserIdRef.current = session.user.id;
      setMeId(session.user.id);
    });
  }, []);

  // Derived, not fetched. This used to be its own
  // `profiles?select=role,clinical_roles,admin_role&id=eq.<me>` round trip,
  // which is redundant: `fetchUsers` below already pulls every profile row
  // including the signed-in user's, with these three columns in it. Verified
  // against the live table — the current user is present in that response.
  //
  // One deliberate behaviour change: if the list query fails and `users` falls
  // back to FALLBACK_USERS (no `_raw`), this is now false rather than
  // separately resolved. That fails closed on a permission check, and in
  // practice the standalone query hit the same table under the same RLS, so it
  // would have failed too.
  const isCurrentUserAdmin = useMemo(() => {
    if (noSession) return true;   // dev bypass — unchanged
    if (!meId) return false;
    const raw = users.find(u => u.id === meId)?._raw;
    if (!raw) return false;
    const isClinAdmin = raw.role === 'Admin/Practice Manager'
      || raw.clinical_roles?.includes('Admin/Practice Manager');
    const isSystemAdmin = raw.admin_role === 'Business/Practice Owner';
    return isClinAdmin || isSystemAdmin;
  }, [users, meId, noSession]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data?.length > 0) {
        setUsers(data.map(mapProfileRow));
      } else {
        setUsers(FALLBACK_USERS);
      }
    } catch {
      setUsers(FALLBACK_USERS);
    }
    setLoading(false);
  }, []);

  // One profiles query per session — revisiting the Users tab reuses the
  // local list; mutations (toggle/invite/edit) keep it in sync.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchUsers();
  }, [fetchUsers]);

  // Account lockout state (admins only; RLS returns nothing to others, and
  // nothing at all before account_lockout_migration.sql runs).
  const [lockouts, setLockouts] = useState({});
  useEffect(() => {
    let live = true;
    supabase.from('account_lockouts').select('*').then(({ data, error }) => {
      if (live && !error) setLockouts(Object.fromEntries((data || []).map(r => [r.user_id, r])));
    });
    return () => { live = false; };
  }, []);
  const usersWithLock = useMemo(
    () => users.map(u => (lockouts[u.id] ? { ...u, lock: lockouts[u.id] } : u)),
    [users, lockouts],
  );

  const unlockAccount = async (user, { reason, note, identityConfirmed, requireReset }) => {
    if (!isCurrentUserAdmin) {
      showToast('Only practice admins can unlock accounts');
      return false;
    }
    const { data, error } = await supabase.rpc('admin_unlock_account', {
      target: user.id,
      reason,
      note: note || null,
      identity_confirmed: !!identityConfirmed,
      require_reset: !!requireReset,
    });
    if (error) {
      showToast(error.message || 'Could not unlock the account');
      return false;
    }
    if (data) setLockouts(prev => ({ ...prev, [user.id]: data }));
    flushSecurityEmails();
    showToast(`${user.name} unlocked`);
    return true;
  };

  const toggleUserStatus = async (user) => {
    if (!isCurrentUserAdmin) {
      showToast('Only Admin/Practice Manager can change user status');
      return;
    }
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    const { data, error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', user.id)
      .select();

    if (!error && data && data.length > 0) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      showToast(`${user.name} ${newStatus === 'Active' ? 'enabled' : 'disabled'}`);
    } else {
      showToast(error?.message || 'Failed to update user status (Check permissions)');
    }
  };

  // Approving a Pending sign-up is what lets them sign in: the access-token
  // hook refuses sessions while status is 'Pending' or 'Rejected'.
  const reviewSignup = async (user, approve) => {
    if (!isCurrentUserAdmin) {
      showToast('Only Admin/Practice Manager can approve sign-ups');
      return;
    }
    const newStatus = approve ? 'Active' : 'Rejected';
    const { data, error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', user.id)
      .select();

    if (!error && data && data.length > 0) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      showToast(`${user.name} ${approve ? 'approved' : 'rejected'}`);
    } else {
      showToast(error?.message || 'Failed to update sign-up request (Check permissions)');
    }
  };

  const deleteUser = async (user) => {
    if (!isCurrentUserAdmin) {
      showToast('Only Admin/Practice Manager can delete users');
      return;
    }
    if (!confirm(`Delete ${user.name}? This will permanently remove them from the platform.`)) return;

    const removeFromUI = () => setUsers(prev => prev.filter(u => u.id !== user.id));
    const fail = (msg) => { showToast(msg); fetchUsers(); };

    try {
      const { error: fnError } = await supabase.functions.invoke('delete-user', {
        body: { userId: user.id },
      });

      if (!fnError) {
        removeFromUI();
        showToast(`${user.name} deleted`);
        return;
      }
      const fnMessage = await fnError.context?.json?.().then(b => b?.error).catch(() => null);
      if (fnMessage) {
        fail(fnMessage);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)
        .select();

      if (error || !data || data.length === 0) {
        fail(error?.message || 'Failed to delete user (Check permissions)');
        return;
      }

      removeFromUI();
      showToast(`${user.name} deleted`);
    } catch (err) {
      fail(err?.message || 'Failed to delete user');
    }
  };

  // Bulk delete — same edge-function-then-profiles-fallback path as
  // deleteUser, run per id in parallel. The bulk confirm dialog replaces the
  // per-row confirm(). Returns true if at least one deletion succeeded.
  const deleteUsersBulk = async (ids) => {
    if (!isCurrentUserAdmin) {
      showToast('Only Admin/Practice Manager can delete users');
      return false;
    }
    if (!ids?.length) return false;
    const results = await Promise.all(ids.map(async (id) => {
      const { error: fnError } = await supabase.functions.invoke('delete-user', { body: { userId: id } });
      if (!fnError) return true;
      const { data, error } = await supabase.from('profiles').delete().eq('id', id).select();
      return !error && data && data.length > 0;
    }));
    const okCount = results.filter(Boolean).length;
    const idSet = new Set(ids);
    setUsers(prev => prev.filter(u => !idSet.has(u.id)));
    fetchUsers();
    if (okCount) showToast(`${okCount} user${okCount === 1 ? '' : 's'} deleted`);
    if (okCount < ids.length) showToast(`${ids.length - okCount} could not be deleted (check permissions)`);
    return okCount > 0;
  };

  const resetPassword = async (user) => {
    if (!isCurrentUserAdmin) {
      showToast('Only Admin/Practice Manager can reset passwords');
      return;
    }
    if (!user.email) { showToast('No email address for this user'); return; }
    // A 6-digit code to the email on file (api/password-reset.js). Admins
    // never see or set the password.
    try {
      const res = await apiFetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', userId: user.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) showToast(json?.error?.message || 'Failed to send the reset code');
      else showToast(`Reset code sent to ${user.email}`);
    } catch {
      showToast('Failed to send the reset code');
    }
  };

  const saveUserProfile = async (userId, updates) => {
    const isSelf = userId === currentUserIdRef.current;

    if (!isCurrentUserAdmin) {
      if (!isSelf) {
        showToast('Only Admin/Practice Manager can edit other users');
        return;
      }
      const stripped = { ...updates };
      for (const f of ROLE_FIELDS) delete stripped[f];
      updates = stripped;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select();

    if (error || !data || data.length === 0) {
      showToast(`Error: ${error?.message || 'Permission denied'}`);
      return;
    }

    // Update just this row from the UPDATE's returned record instead of
    // re-fetching every profile — the full-table refetch (with a loading
    // skeleton flash) was what made Save feel slow.
    setUsers(prev => prev.map(u => (u.id === userId ? mapProfileRow(data[0]) : u)));
    showToast('Profile updated');
    setEditingUser(null);
  };

  const filteredUsers = useMemo(() => {
    let list = usersWithLock;
    if (userFilters.status.length) {
      const statusSet = new Set(userFilters.status);
      list = list.filter(u => statusSet.has(u.status) || (statusSet.has('Locked') && isLocked(u.lock)));
    }
    if (userFilters.roles.length) {
      const rolesSet = new Set(userFilters.roles);
      list = list.filter(u => rolesSet.has(u.role));
    }
    if (userFilters.location.length) {
      const locationSet = new Set(userFilters.location);
      list = list.filter(u => locationSet.has(u.location));
    }
    if (!searchVal.trim()) return list;
    const q = searchVal.toLowerCase();
    return list.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.location.toLowerCase().includes(q));
  }, [usersWithLock, searchVal, userFilters]);

  const filterOptions = useMemo(() => {
    const roles = new Set();
    const locations = new Set();
    for (const u of users) {
      if (u.role) roles.add(u.role);
      if (u.location) locations.add(u.location);
    }
    return {
      status: ['Active', 'Pending', 'Invited', 'Inactive', 'Suspended', 'Rejected', 'Locked'],
      roles: [...roles].sort(),
      location: [...locations].sort(),
    };
  }, [users]);

  const userFiltersActive =
    userFilters.status.length + userFilters.roles.length + userFilters.location.length;

  return {
    users,
    loading,
    searchVal,
    setSearchVal,
    editingUser,
    setEditingUser,
    viewingUser,
    setViewingUser,
    showInvite,
    setShowInvite,
    filterOpen,
    setFilterOpen,
    userFilters,
    setUserFilters,
    userFiltersActive,
    isCurrentUserAdmin,
    fetchUsers,
    toggleUserStatus,
    reviewSignup,
    deleteUser,
    deleteUsersBulk,
    resetPassword,
    unlockAccount,
    lockouts,
    saveUserProfile,
    filteredUsers,
    filterOptions,
  };
}
