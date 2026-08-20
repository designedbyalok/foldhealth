import { supabase } from '../../../lib/supabase';
import { ROLE_COLORS } from './AccountPanel.constants';

// Imported AND re-exported: this module calls isCapitalizedName itself, and a
// bare `export { … } from` would satisfy importers while leaving the name
// undefined in local scope here.
import { NAME_CAPITALIZED, isCapitalizedName } from '../../../lib/nameValidation';

export { NAME_CAPITALIZED, isCapitalizedName };

export function preventDefaultDrag(e) {
  e.preventDefault();
}

/**
 * Assign a user's authorization columns (admin_role / role / clinical_roles).
 *
 * These are the only columns that decide what someone can do, so the client is
 * not allowed to write them directly — a `profiles_guard_authz_fields` trigger
 * rejects that. This RPC is SECURITY DEFINER and re-derives the caller's admin
 * status from the database before applying anything.
 */
export async function assignUserRoles(userId, adminRole, clinicalRoles) {
  const roles = clinicalRoles || [];
  const { error } = await supabase.rpc('admin_set_user_roles', {
    target_id: userId,
    new_admin_role: adminRole || 'Employer',
    new_role: roles.length > 0 ? roles[0] : 'Viewer',
    new_clinical_roles: roles,
  });
  return !error;
}

export function downloadUserImportTemplate() {
  const csv = 'First Name,Middle Name,Last Name,Email,Admin Role\nAmy,,Brenneman,amy@fold.health,Employer\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'user_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export const ADMIN_ROLES = ['Business/Practice Owner', 'Operations/Clinical Analyst', 'Employer'];
export const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
export const LANGUAGE_OPTIONS = ['English', 'Spanish', 'Cantonese', 'Mandarin', 'Vietnamese', 'Korean', 'Tagalog', 'Arabic', 'French', 'Hindi', 'Portuguese', 'Russian'];
export const MOCK_ROLES = Object.keys(ROLE_COLORS);
export const BULK_EXTRA_COLUMNS = ['credentials', 'gender', 'profile', 'licence_state', 'location', 'languages', 'mobile', 'fax', 'zip_code'];
export const BULK_COL_LABELS = {
  first_name: 'First Name', middle_name: 'Middle Name', last_name: 'Last Name', email: 'Email', admin_role: 'Administrative Role',
  credentials: 'Credentials', gender: 'Gender', profile: 'Profile', licence_state: 'Licence State', location: 'Location',
  languages: 'Languages', mobile: 'Mobile Number', fax: 'Fax Number', zip_code: 'Zip Code',
};

export async function sendSingleInvite({ form, showToast, logAudit, onInvited }) {
  if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
    showToast('First name, last name, and email are required');
    return false;
  }
  if (!isCapitalizedName(form.first_name) || !isCapitalizedName(form.last_name)) {
    showToast('First and last name must start with a capital letter');
    return false;
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: form.email,
    password: crypto.randomUUID(),
    options: {
      data: {
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        invited: 'true',
      },
      emailRedirectTo: window.location.origin,
    },
  });
  if (authError) {
    showToast(`Invite failed: ${authError.message}`);
    return false;
  }

  const userId = authData?.user?.id;
  if (userId) {
    const profileExtras = {
      full_name: `${form.first_name} ${form.last_name}`.trim(),
      first_name: form.first_name, middle_name: form.middle_name, last_name: form.last_name,
      gender: form.gender, bio: form.bio, mobile: form.mobile, fax: form.fax,
      zip_code: form.zip_code, address_line1: form.address_line1, address_line2: form.address_line2,
      state: form.state, city: form.city,
      credentials: form.credentials, licence_states: form.licence_states,
      locations: form.locations, languages: form.languages,
    };
    await supabase.from('profiles').update(profileExtras).eq('id', userId);
    // Roles go through admin_set_user_roles, never a plain column write: the
    // function re-checks that the caller is an admin server-side, so the
    // privilege decision never depends on what the browser chose to send.
    await assignUserRoles(userId, form.admin_role, form.clinical_roles);
    logAudit('UserProfile', userId, profileExtras.full_name, 'created', `Invited user: ${form.email}`, 'Lifecycle');
  }

  showToast(`Invitation sent to ${form.email}`);
  onInvited();
  return true;
}

export function parseBulkCsv(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g, '_'));
  const rows = lines.slice(1).map((line, i) => {
    const vals = line.split(',').map(v => v.trim());
    const row = { _id: i };
    headers.forEach((h, hi) => { row[h] = vals[hi] || ''; });
    if (!row.first_name) row.first_name = '';
    if (!row.last_name) row.last_name = '';
    if (!row.email) row.email = '';
    if (!row.admin_role) row.admin_role = 'Employer';
    return row;
  });
  const detected = ['first_name', 'middle_name', 'last_name', 'email', 'admin_role'];
  headers.forEach(h => { if (!detected.includes(h) && h !== '_id') detected.push(h); });
  return { rows, columns: detected };
}

export async function importBulkUsers({ bulkRows, showToast, logAudit, onInvited }) {
  const badRow = bulkRows.find(r =>
    (r.first_name && !isCapitalizedName(r.first_name)) ||
    (r.last_name && !isCapitalizedName(r.last_name)),
  );
  if (badRow) {
    showToast(`Row for ${badRow.email || badRow.first_name || '—'}: first/last name must start with a capital letter`);
    return false;
  }

  const results = await Promise.all(bulkRows.map(async (row) => {
    if (!row.email?.trim()) return false;
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: row.email, password: crypto.randomUUID(),
        options: {
          data: {
            first_name: row.first_name,
            last_name: row.last_name,
            full_name: `${row.first_name} ${row.last_name}`.trim(),
            invited: 'true',
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (authError) return false;
      const userId = authData?.user?.id;
      if (userId) {
        await supabase.from('profiles').update({
          full_name: `${row.first_name} ${row.last_name}`.trim(),
          first_name: row.first_name, middle_name: row.middle_name, last_name: row.last_name,
          gender: row.gender, mobile: row.mobile, fax: row.fax, zip_code: row.zip_code,
        }).eq('id', userId);
        await assignUserRoles(userId, row.admin_role, []);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }));

  const successCount = results.filter(Boolean).length;
  logAudit('UserProfile', 'bulk', 'Bulk Import', 'created', `Bulk imported ${successCount} users`, 'Lifecycle');
  showToast(`${successCount} user(s) invited successfully`);
  onInvited();
  return true;
}
