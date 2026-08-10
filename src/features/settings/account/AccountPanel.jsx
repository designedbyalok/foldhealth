import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Badge } from '../../../components/Badge/Badge';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Drawer } from '../../../components/Drawer/Drawer';
import { TabStrip } from '../../../components/TabStrip/TabStrip';
import { UserProfileBanner } from './users/UserProfileBanner';
import { Input } from '../../../components/Input/Input';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { Select } from '../../../components/Select/Select';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { AuditLogContent } from '../panels/AuditLogDrawer';
import { IdIcon } from '../../../components/Icon/IdIcon';
import { AddIconMinimalist } from '../../../components/Icon/AddIconMinimalist';
import { CreateInsurancePlanDrawer } from '../CreateInsurancePlanDrawer';
import { InsurancePlanViewDrawer } from '../InsurancePlanViewDrawer';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { OrgPanel } from '../panels/OrgPanel';
import { UsersTab } from './users/UsersTab';
import { LocationsTab } from './locations/LocationsTab';
import styles from './AccountPanel.module.css';

const ALL_TABS = ['Org', 'Users', 'Teams', 'Access Control', 'Locations', 'Insurance Plans', 'Holiday Configuration', 'Merged Or Delayed', 'Allowed Phone', 'Allowed Emails'];

// HCC coding-workflow roles are listed first — an admin assigning any of
// these to a teammate flips the TopBar role switcher on for them and drives
// the HCC review workflow's stage gating (Support → Coder → QA → Compliance).
export const HCC_ROLES = ['Support', 'Coder', 'QA', 'Compliance'];

export const ROLE_COLORS = {
  'Support':                       'toc-attempted',
  'Coder':                         'ai-care',
  'QA':                            'ai-med',
  'Compliance':                    'compliance-warn',
  'Physician/Doctor':              'ai-care', 'Nurse': 'toc-engaged', 'Medical Assistant': 'status-scheduled',
  'Admin/Practice Manager':        'outreach-post-visit', 'Billing Specialist': 'compliance-warn',
  'Front Desk Staff/Receptionist': 'ai-neutral', 'Lab Technician': 'status-queued',
  'Pharmacist':                    'ai-med', 'Health Information Manager (HIM)': 'ai-care',
  'Radiologist':                   'toc-engaged', 'Patient': 'ai-neutral',
};

// A properly-cased name starts with an uppercase letter A-Z. Hyphens,
// apostrophes, and Unicode letters are allowed anywhere; the rule only
// polices the FIRST character so "O'Brien", "van Meel", and "Mary Ann"
// all pass (the second word's casing is a downstream concern).
const NAME_CAPITALIZED = /^[A-Z]/;
function isCapitalizedName(str) {
  return NAME_CAPITALIZED.test((str || '').trim());
}

export function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
}

const MOCK_ROLES = Object.keys(ROLE_COLORS);
const MOCK_LOCATIONS = ['Toms River', 'Montebello', 'Sparks', 'Chesapeake', 'Visalia', 'Lowell', 'Palm Bay', 'Lawton', 'Oceanside', 'Merced', 'Oakland Park'];

const tabKeyToName = (key) => ALL_TABS.find(t => t.toLowerCase().replace(/ /g, '-') === key) || 'Org';
const tabNameToKey = (name) => name.toLowerCase().replace(/ /g, '-');

export function AccountPanel() {
  const storeTab = useAppStore(s => s.accountTab);
  const setStoreTab = useAppStore(s => s.setAccountTab);
  const [activeTab, setActiveTabLocal] = useState(() => tabKeyToName(storeTab || 'org'));
  const setActiveTab = (tab) => { setActiveTabLocal(tab); setStoreTab(tabNameToKey(tab)); };
  const [showCreateInsurance, setShowCreateInsurance] = useState(false);
  const [plans, setPlans] = useState([]);
  const [planSavedToast, setPlanSavedToast] = useState(false);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [deletingPlanId, setDeletingPlanId] = useState(null);
  const [planSearchVal, setPlanSearchVal] = useState('');

  const handleSavePlan = (planData) => {
    if (planData.id) {
      setPlans(prev => prev.map(p => p.id === planData.id ? planData : p));
    } else {
      setPlans(prev => [...prev, { id: Date.now(), ...planData }]);
    }
    setPlanSavedToast(true);
    setTimeout(() => setPlanSavedToast(false), 3000);
  };

  const isInsurancePlans = activeTab === 'Insurance Plans';
  const isUsers = activeTab === 'Users';
  const isLocations = activeTab === 'Locations';
  const tabsForBar = ALL_TABS.map(t => ({ key: t, label: t }));

  return (
    <div className={styles.wrapper}>
      {isInsurancePlans ? (
        <SectionTitleBar
          tabs={tabsForBar}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showSearch
          searchPlaceholder="Search plans…"
          searchValue={planSearchVal}
          onSearchChange={setPlanSearchVal}
          primaryActionLabel="New Insurance Plan"
          onPrimaryAction={() => setShowCreateInsurance(true)}
        />
      ) : !isUsers && !isLocations ? (
        <SectionTitleBar
          tabs={tabsForBar}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      ) : null}

      {isUsers ? (
        // Users tab owns its own SectionTitleBar (with search / filter /
        // Invite User), the filter chip row, the WorklistShell table, and
        // its three drawers. See src/features/settings/account/users/.
        <UsersTab tabsForBar={tabsForBar} activeTab={activeTab} setActiveTab={setActiveTab} />
      ) : isLocations ? (
        // Locations tab — same shell + drawers pattern as Users.
        <LocationsTab tabsForBar={tabsForBar} activeTab={activeTab} setActiveTab={setActiveTab} />
      ) : (
        <div className={styles.tableWrap}>
          {activeTab === 'Org' ? (
            <OrgPanel />
          ) : activeTab === 'Insurance Plans' ? (
            <InsurancePlansTab
              plans={plans}
              onCreateNew={() => setShowCreateInsurance(true)}
              onView={(plan) => setViewingPlan(plan)}
              onEdit={(plan) => setEditingPlan(plan)}
              onDeleteRequest={(id) => setDeletingPlanId(id)}
              searchVal={planSearchVal}
            />
          ) : (
            <div className={styles.emptyState}>
              <Icon name="solar:widget-linear" size={40} color="var(--neutral-150)" />
              <p className={styles.emptyTitle}>{activeTab}</p>
              <p className={styles.emptyDesc}>This section is coming soon.</p>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Insurance Plan Drawer */}
      {(showCreateInsurance || editingPlan) && (
        <CreateInsurancePlanDrawer
          onClose={() => { setShowCreateInsurance(false); setEditingPlan(null); }}
          onSave={handleSavePlan}
          initialPlan={editingPlan || undefined}
          mode={editingPlan ? 'edit' : 'create'}
        />
      )}

      {viewingPlan && (
        <InsurancePlanViewDrawer
          plan={viewingPlan}
          onClose={() => setViewingPlan(null)}
          onEdit={(plan) => { setViewingPlan(null); setEditingPlan(plan); }}
        />
      )}

      {deletingPlanId && (
        <ConfirmDialog
          variant="destructive"
          icon="solar:trash-bin-2-linear"
          title="Delete Insurance Plan?"
          description="Please confirm if you want to permanently delete this insurance plan from the system."
          confirmLabel="Delete Plan"
          onCancel={() => setDeletingPlanId(null)}
          onConfirm={() => {
            setPlans(prev => prev.filter(p => p.id !== deletingPlanId));
            setDeletingPlanId(null);
          }}
        />
      )}

      {planSavedToast && (
        <div className={styles.toastOverlay}>
          <div className={styles.toast}>
            <span className={styles.toastText}>Plan Saved Successfully</span>
            <button className={styles.toastClose} onClick={() => setPlanSavedToast(false)}>
              <Icon name="solar:close-circle-linear" size={16} color="white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── View User Drawer (Read-Only) ── */

const VIEW_TABS = ['User Details', 'Business Hours', 'Assigned Patients', 'Audit Log'];

export function ViewUserDrawer({ user, onClose, onEdit }) {
  const raw = user._raw || {};
  const [viewTab, setViewTab] = useState('User Details');
  const setActivePage = useAppStore(s => s.setActivePage);
  const setCurrentPage = useAppStore(s => s.setCurrentPage);
  const setPendingChatUserEmail = useAppStore(s => s.setPendingChatUserEmail);

  const openChat = () => {
    setPendingChatUserEmail(user.email);
    setActivePage('messages');
    setCurrentPage(1);
    onClose();
  };

  const adminRole = raw.admin_role || 'Business/Practice Owner';
  const roles = raw.clinical_roles?.length > 0 ? raw.clinical_roles : (raw.role && raw.role !== 'Viewer' ? [raw.role] : []);
  const locations = raw.locations?.length > 0 ? raw.locations : [];
  const languages = raw.languages?.length > 0 ? raw.languages : [];
  const credentials = raw.credentials?.length > 0 ? raw.credentials : [];
  const licenceStates = raw.licence_states?.length > 0 ? raw.licence_states : [];

  return (
    <Drawer title="User Profile" onClose={onClose} bodyClassName={styles.editDrawerBody} headerStyle={{ padding: '12px' }} titleStyle={{ fontSize: 14 }}>
      <UserProfileBanner user={user} onChat={openChat} />
      <TabStrip
        items={VIEW_TABS.map(t => ({ key: t, label: t }))}
        activeKey={viewTab}
        onChange={setViewTab}
        fullWidth={false}
        trailing={<ActionButton icon="solar:pen-linear" size="S" tooltip="Edit Profile" onClick={onEdit} />}
      />

      {viewTab === 'Audit Log' ? (
        <div className={styles.formScroll}>
          <AuditLogContent entityType="UserProfile" entityId={user.id} />
        </div>
      ) : viewTab === 'User Details' ? (
        <div className={styles.formScroll}>
          {/* Administrative Role */}
          <div className={styles.viewSection}>
            <div className={styles.viewSectionLabel}>Administrative Role</div>
            <div className={styles.viewBadges}>
              <Badge variant="ai-neutral" label={adminRole} />
            </div>
          </div>

          {/* Roles */}
          {roles.length > 0 && (
            <div className={styles.viewSection}>
              <div className={styles.viewSectionLabel}>Roles</div>
              <div className={styles.viewBadges}>
                {roles.map(r => <Badge key={r} variant="ai-care" label={r} />)}
              </div>
            </div>
          )}

          {/* Location */}
          {locations.length > 0 && (
            <div className={styles.viewSection}>
              <div className={styles.viewSectionLabel}>Location</div>
              <div className={styles.viewBadges}>
                {locations.map(l => <Badge key={l} variant="ai-neutral" label={l} />)}
              </div>
            </div>
          )}

          {/* Languages */}
          {languages.length > 0 && (
            <div className={styles.viewSection}>
              <div className={styles.viewSectionLabel}>Languages</div>
              <div className={styles.viewBadges}>
                {languages.map(l => <Badge key={l} variant="toc-engaged" label={l} />)}
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className={styles.viewSection}>
            <div className={styles.viewSectionTitle}>Basic Info</div>
            <div className={styles.viewGrid}>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>First Name</span>
                <span className={styles.viewFieldValue}>{raw.first_name || user.name?.split(' ')[0] || '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Middle Name</span>
                <span className={styles.viewFieldValue}>{raw.middle_name || '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Last Name</span>
                <span className={styles.viewFieldValue}>{raw.last_name || user.name?.split(' ').slice(1).join(' ') || '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Date of Birth</span>
                <span className={styles.viewFieldValue}>{raw.date_of_birth || '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Credentials</span>
                <span className={styles.viewFieldValue}>{credentials.length > 0 ? credentials.join(', ') : '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Email</span>
                <span className={styles.viewFieldValue}>{user.email || '-'}</span>
              </div>
            </div>
          </div>

          {/* Profile */}
          {raw.bio && (
            <div className={styles.viewSection}>
              <div className={styles.viewFieldLabel}>Profile</div>
              <p className={styles.viewBio}>{raw.bio}</p>
            </div>
          )}

          {/* Licence State & Gender */}
          <div className={styles.viewSection}>
            <div className={styles.viewGrid}>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Licence State</span>
                <span className={styles.viewFieldValue}>{licenceStates.length > 0 ? licenceStates.join(', ') : '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Gender</span>
                <span className={styles.viewFieldValue}>{raw.gender || '-'}</span>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className={styles.viewSection}>
            <div className={styles.viewSectionTitle}>Contact Info</div>
            <div className={styles.viewGrid}>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Mobile Number</span>
                <span className={styles.viewFieldValue}>{raw.mobile || raw.phone || '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Email</span>
                <span className={styles.viewFieldValue}>{user.email || '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Fax Number</span>
                <span className={styles.viewFieldValue}>{raw.fax || '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Zipcode</span>
                <span className={styles.viewFieldValue}>{raw.zip_code || '-'}</span>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className={styles.viewSection}>
            <div className={styles.viewSectionTitle}>Additional Info</div>
            <div className={styles.viewGrid}>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Address Line 1</span>
                <span className={styles.viewFieldValue}>{raw.address_line1 || '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>Address Line 2</span>
                <span className={styles.viewFieldValue}>{raw.address_line2 || '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>State</span>
                <span className={styles.viewFieldValue}>{raw.state || '-'}</span>
              </div>
              <div className={styles.viewField}>
                <span className={styles.viewFieldLabel}>City</span>
                <span className={styles.viewFieldValue}>{raw.city || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Icon name="solar:widget-linear" size={40} color="var(--neutral-150)" />
          <p className={styles.emptyTitle}>{viewTab}</p>
          <p className={styles.emptyDesc}>Coming soon.</p>
        </div>
      )}
    </Drawer>
  );
}

/* ── Edit User Drawer ── */

const ADMIN_ROLES = ['Business/Practice Owner', 'Operations/Clinical Analyst', 'Employer'];
const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const DRAWER_TABS = ['User Details', 'Business Hours', 'Assigned Patients'];
const EHR_SYSTEMS = ['Athena Health', 'Epic', 'Cerner', 'eClinicalWorks', 'Allscripts', 'NextGen', 'Greenway Health', 'DrChrono'];
const LANGUAGE_OPTIONS = ['English', 'Spanish', 'Cantonese', 'Mandarin', 'Vietnamese', 'Korean', 'Tagalog', 'Arabic', 'French', 'Hindi', 'Portuguese', 'Russian'];
// Fallback list — used only before practice_locations has been fetched or
// when the migration hasn't run yet. Kept in sync with the seed mock names.
const LOCATION_OPTIONS_FALLBACK = ['SEB Office', 'Downtown Clinic', 'AstranaCare Centennial Hills', 'Valley Medical Center', 'Sunrise Health', 'Palm Desert Office', 'Riverside Clinic', 'Carson City Center'];

// Hook the user drawers use to pull practice-location names from the store.
// Fires the fetch on first mount so opening a drawer before the Locations
// tab still hydrates the dropdown.
function useLocationNames() {
  const locations = useAppStore(s => s.practiceLocations);
  const fetched   = useAppStore(s => s.practiceLocationsFetched);
  const fetchLocations = useAppStore(s => s.fetchPracticeLocations);
  useEffect(() => { if (!fetched) fetchLocations(); }, [fetched, fetchLocations]);
  return locations.length ? locations.map(l => l.name) : LOCATION_OPTIONS_FALLBACK;
}

/* Tag input helper — renders removable badges inside an input-like container */
function TagInput({ value = [], onChange, placeholder }) {
  const [inputVal, setInputVal] = useState('');
  const addTag = () => {
    const v = inputVal.trim();
    if (v && !value.includes(v)) { onChange([...value, v]); setInputVal(''); }
  };
  const removeTag = (tag) => onChange(value.filter(t => t !== tag));
  return (
    <div className={styles.tagInput}>
      {value.map(tag => (
        <span key={tag} className={styles.tag}>
          {tag}
          <CloseButton size={10} onClick={() => removeTag(tag)} className={styles.tagClose} label="Remove" />
        </span>
      ))}
      <input
        className={styles.tagInputField}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
        placeholder={value.length === 0 ? placeholder : ''}
      />
    </div>
  );
}

/* ── Multi-select helper (checkbox list inside a select-like container) ── */
function MultiSelectField({ label, required, options, value = [], onChange }) {
  const [open, setOpen] = useState(false);
  // Anchor rect drives the portalled dropdown's position. Recomputed on
  // open + on scroll/resize so it tracks the trigger correctly when the
  // form scrolls underneath.
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const popRef = useRef(null);

  const measure = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setRect(r);
  };
  useEffect(() => {
    if (!open) return undefined;
    measure();
    const onScroll = () => measure();
    const close = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const toggle = (opt) => {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  };
  return (
    <div className={styles.formField}>
      <label className={styles.formLabel}>{label} {required && <span className={styles.required}>*</span>}</label>
      <div ref={triggerRef} style={{ position: 'relative' }}>
        <div className={styles.tagInput} onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
          {value.length > 0 ? value.map(v => (
            <span key={v} className={styles.tag}>
              {v}
              <CloseButton size={10} onClick={e => { e.stopPropagation(); toggle(v); }} className={styles.tagClose} label="Remove" />
            </span>
          )) : <span style={{ color: 'var(--neutral-200)', fontSize: 14 }}>Select...</span>}
          <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </div>
      </div>
      {/* Portal the dropdown out to document.body with fixed positioning
          so the surrounding .inviteFormScroll's overflow:auto never
          clips it. */}
      {open && rect && createPortal(
        <div
          ref={popRef}
          className={styles.multiSelectDropdown}
          style={{
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
          }}
        >
          {options.map(opt => (
            <label key={opt} className={styles.multiSelectOption}>
              <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ── Inline Audit Log for User Profile ── */
/* ── Add Column Dropdown for Bulk Import ── */
function AddColumnDropdown({ available, labels, onAdd, onClose }) {
  const [selected, setSelected] = useState([]);
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div className={styles.addColDropdown}>
        {available.map(col => (
          <label key={col} className={styles.addColOption}>
            <input type="checkbox" checked={selected.includes(col)} onChange={() => setSelected(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])} />
            <span>{labels[col] || col}</span>
          </label>
        ))}
        {available.length === 0 && <div style={{ padding: 12, color: 'var(--neutral-300)', fontSize: 13 }}>All columns added</div>}
        <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderTop: '0.5px solid var(--neutral-100)' }}>
          <Button variant="ghost" size="S" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="S" onClick={() => onAdd(selected)} disabled={selected.length === 0}>Add Columns</Button>
        </div>
      </div>
    </>
  );
}

/* ── Invite User Drawer ── */

export function InviteUserDrawer({ onClose, onInvited }) {
  const [step, setStep] = useState('choose'); // 'choose' | 'form' | 'bulk-upload' | 'bulk-review'
  const [showAdditional, setShowAdditional] = useState(false);
  const showToast = useAppStore(s => s.showToast);
  const logAudit = useAppStore(s => s.logAudit);
  const locationNames = useLocationNames();
  // Bulk import state
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkColumns, setBulkColumns] = useState(['first_name', 'middle_name', 'last_name', 'email', 'admin_role']);
  const [addColOpen, setAddColOpen] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [highlightCol, setHighlightCol] = useState(null);
  const fileInputRef = useRef(null);
  const tableRef = useRef(null);
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', email: '',
    admin_role: 'Business/Practice Owner', clinical_roles: [],
    gender: '', bio: '', mobile: '', fax: '', zip_code: '',
    address_line1: '', address_line2: '', state: '', city: '',
    credentials: [], licence_states: [], locations: [], languages: [],
  });
  const [sending, setSending] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSendInvite = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      showToast('First name, last name, and email are required');
      return;
    }
    if (!isCapitalizedName(form.first_name) || !isCapitalizedName(form.last_name)) {
      showToast('First and last name must start with a capital letter');
      return;
    }
    setSending(true);
    try {
      // Invite via Supabase Auth (single confirmation email). The temp
      // password is a placeholder — App.jsx routes users whose metadata
      // carries invited='true' to ResetPasswordPage, where they set a
      // real password and are dropped into the app.
      //
      // emailRedirectTo is the bare origin — appending our own `#/…` hash
      // would collide with Supabase's `#access_token=…` fragment and break
      // supabase-js's detectSessionInUrl parser.
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
      if (authError) { showToast(`Invite failed: ${authError.message}`); return; }

      // Fill in the profile extras (roles, contact, locations, …). The
      // handle_new_user() trigger has already inserted the base row with
      // status='Invited', and RLS's profiles_self_insert blocks admins
      // from INSERTing another user's row — so UPDATE, not upsert.
      const userId = authData?.user?.id;
      if (userId) {
        const profileExtras = {
          full_name: `${form.first_name} ${form.last_name}`.trim(),
          first_name: form.first_name, middle_name: form.middle_name, last_name: form.last_name,
          admin_role: form.admin_role,
          role: form.clinical_roles.length > 0 ? form.clinical_roles[0] : 'Viewer',
          clinical_roles: form.clinical_roles,
          gender: form.gender, bio: form.bio, mobile: form.mobile, fax: form.fax,
          zip_code: form.zip_code, address_line1: form.address_line1, address_line2: form.address_line2,
          state: form.state, city: form.city,
          credentials: form.credentials, licence_states: form.licence_states,
          locations: form.locations, languages: form.languages,
        };
        await supabase.from('profiles').update(profileExtras).eq('id', userId);
        logAudit('UserProfile', userId, profileExtras.full_name, 'created', `Invited user: ${form.email}`, 'Lifecycle');
      }

      showToast(`Invitation sent to ${form.email}`);
      onInvited();
    } catch (e) {
      showToast(`Error: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  if (step === 'choose') {
    return (
      <Drawer title="Invite User" onClose={onClose}>
        <div className={styles.inviteChoose}>
          <p className={styles.inviteChooseTitle}>Choose how you'd like to add team members</p>
          <div className={styles.inviteCard} onClick={() => setStep('form')}>
            <Icon name="solar:user-plus-linear" size={32} color="var(--primary-300)" />
            <h4>Single Invite</h4>
            <p>Invite one team member at a time by filling out a form</p>
            <Button variant="secondary" size="L">Invite Individual</Button>
          </div>
          <div className={styles.inviteCard} style={{ background: '#FFF8F5', borderColor: 'rgba(244,122,62,0.2)' }} onClick={() => setStep('bulk-upload')}>
            <Icon name="solar:users-group-rounded-linear" size={32} color="#F47A3E" />
            <h4>Bulk Import</h4>
            <p>Upload a CSV file to add multiple team members at once</p>
            <Button variant="secondary" size="L" style={{ color: '#F47A3E', borderColor: '#F47A3E' }}>Import Multiple</Button>
          </div>
        </div>
      </Drawer>
    );
  }

  // ── Bulk Upload Step ──
  if (step === 'bulk-upload') {
    const handleFileSelect = (file) => {
      if (!file) return;
      setBulkFile(file);
      // Parse CSV
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { showToast('CSV must have a header row and at least one data row'); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g, '_'));
        const rows = lines.slice(1).map((line, i) => {
          const vals = line.split(',').map(v => v.trim());
          const row = { _id: i };
          headers.forEach((h, hi) => { row[h] = vals[hi] || ''; });
          // Ensure required fields
          if (!row.first_name) row.first_name = '';
          if (!row.last_name) row.last_name = '';
          if (!row.email) row.email = '';
          if (!row.admin_role) row.admin_role = 'Employer';
          return row;
        });
        setBulkRows(rows);
        // Auto-detect columns from CSV headers
        const detected = ['first_name', 'middle_name', 'last_name', 'email', 'admin_role'];
        headers.forEach(h => { if (!detected.includes(h) && h !== '_id') detected.push(h); });
        setBulkColumns(detected);
      };
      reader.readAsText(file);
    };

    const handleDrop = (e) => { e.preventDefault(); handleFileSelect(e.dataTransfer.files[0]); };
    const handleDragOver = (e) => { e.preventDefault(); };

    return (
      <Drawer title={<div><div style={{ fontSize: 16, fontWeight: 600 }}>Bulk Import Users</div><div style={{ fontSize: 13, color: 'var(--neutral-300)', fontWeight: 400 }}>Import the users in bulk by uploading a spreadsheet.</div></div>} onClose={onClose} bodyClassName={styles.inviteDrawerBody} headerRight={
        <Button variant="primary" size="L" disabled={!bulkFile} onClick={() => setStep('bulk-review')}>Next</Button>
      }>
        <div className={styles.inviteFormScroll}>
          {/* Stepper */}
          <div className={styles.bulkStepper}>
            <span className={styles.bulkStepActive}><span className={styles.bulkStepNum}>1</span> Upload File</span>
            <span className={styles.bulkStepLine} />
            <span className={styles.bulkStepInactive}><span className={styles.bulkStepNum}>2</span> Profile Review</span>
          </div>

          {/* Icon */}
          <div className={styles.bulkIcon}>
            <Icon name="solar:users-group-rounded-linear" size={48} color="var(--neutral-200)" />
          </div>

          {/* Instructions */}
          <div className={styles.bulkInfo}>
            <div className={styles.bulkInfoTitle}><Icon name="solar:info-circle-linear" size={16} color="var(--primary-300)" /> How to import team members</div>
            <ol className={styles.bulkInfoList}>
              <li>Download the CSV template below</li>
              <li>Fill in the team member details in the spreadsheet</li>
              <li>Save the file and upload it here</li>
              <li>Review the preview and confirm the import</li>
            </ol>
          </div>

          {/* Upload area */}
          {!bulkFile ? (
            <div className={styles.bulkDropZone} onDrop={handleDrop} onDragOver={handleDragOver} onClick={() => fileInputRef.current?.click()}>
              <Icon name="solar:upload-linear" size={24} color="var(--neutral-200)" />
              <p>Drag and drop file here or <span className={styles.bulkChooseFile}>Choose file</span></p>
              <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
            </div>
          ) : (
            <div className={styles.bulkFileCard}>
              <Icon name="solar:document-text-linear" size={24} color="var(--neutral-300)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)' }}>{bulkFile.name}</div>
                <div style={{ fontSize: 12, color: 'var(--neutral-300)' }}>{(bulkFile.size / (1024 * 1024)).toFixed(1)} MB</div>
              </div>
              <button className={styles.bulkChooseFile} onClick={() => { setBulkFile(null); setBulkRows([]); }}>Change file</button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--neutral-200)' }}>
            <span>Supported formats: CSV, XLS, XLSX</span>
            <span>Max size: 5 MB</span>
          </div>

          {/* Template download */}
          {!bulkFile && (
            <div className={styles.bulkTemplate}>
              <Icon name="solar:file-text-linear" size={24} color="var(--neutral-300)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--neutral-400)' }}>User Details Import Template</div>
                <div style={{ fontSize: 13, color: 'var(--neutral-300)' }}>You can download the attached example and use it as a template to add users</div>
              </div>
              <button className={styles.bulkChooseFile} onClick={() => {
                const csv = 'First Name,Middle Name,Last Name,Email,Admin Role\nAmy,,Brenneman,amy@fold.health,Employer\n';
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'user_import_template.csv'; a.click();
              }}>Download sample</button>
            </div>
          )}

          {/* Info notice */}
          <div className={styles.bulkNotice}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-200)" />
            <span>{bulkFile ? 'Once users are generated through the bulk import method, their login credentials will be sent out promptly.' : 'After users are successfully created through the bulk import process, they will receive their login credentials via email.'}</span>
          </div>
        </div>
      </Drawer>
    );
  }

  // ── Bulk Review Step ──
  if (step === 'bulk-review') {
    const EXTRA_COLUMNS = ['credentials', 'gender', 'profile', 'licence_state', 'location', 'languages', 'mobile', 'fax', 'zip_code'];
    const COL_LABELS = { first_name: 'First Name', middle_name: 'Middle Name', last_name: 'Last Name', email: 'Email', admin_role: 'Administrative Role', credentials: 'Credentials', gender: 'Gender', profile: 'Profile', licence_state: 'Licence State', location: 'Location', languages: 'Languages', mobile: 'Mobile Number', fax: 'Fax Number', zip_code: 'Zip Code' };

    const addRow = () => {
      const newId = Date.now();
      setBulkRows(prev => [...prev, { _id: newId, first_name: '', middle_name: '', last_name: '', email: '', admin_role: '' }]);
      setHighlightId(newId);
      setTimeout(() => { setHighlightId(null); tableRef.current?.querySelector('tbody tr:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
      setTimeout(() => setHighlightId(null), 1500);
    };
    const deleteRow = (id) => setBulkRows(prev => prev.filter(r => r._id !== id));
    const duplicateRow = (row) => {
      const newId = Date.now();
      setBulkRows(prev => [...prev, { ...row, _id: newId, email: '' }]);
      setHighlightId(newId);
      setTimeout(() => setHighlightId(null), 1500);
    };
    const updateRow = (id, field, value) => {
      setBulkRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r));
    };
    const addColumns = (cols) => {
      setBulkColumns(prev => [...prev, ...cols.filter(c => !prev.includes(c))]);
      setAddColOpen(false);
      if (cols.length > 0) {
        setHighlightCol(cols[0]);
        setTimeout(() => setHighlightCol(null), 1500);
        // Scroll table right to show new column
        setTimeout(() => { const scrollArea = tableRef.current?.parentElement; if (scrollArea) scrollArea.scrollLeft = scrollArea.scrollWidth; }, 100);
      }
    };

    const handleBulkImport = async () => {
      // Reject the whole batch when any candidate row has a lowercase-start
      // first/last name — surfaces the offending row so the coder can fix it
      // in the same session instead of chasing back-fills later.
      const badRow = bulkRows.find(r =>
        (r.first_name && !isCapitalizedName(r.first_name)) ||
        (r.last_name && !isCapitalizedName(r.last_name)),
      );
      if (badRow) {
        showToast(`Row for ${badRow.email || badRow.first_name || '—'}: first/last name must start with a capital letter`);
        return;
      }
      setSending(true);
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
              admin_role: row.admin_role || 'Employer', role: 'Viewer',
              gender: row.gender, mobile: row.mobile, fax: row.fax, zip_code: row.zip_code,
            }).eq('id', userId);
            return true;
          }
          return false;
        } catch (e) {
          return false;
        }
      }));
      const successCount = results.filter(Boolean).length;
      logAudit('UserProfile', 'bulk', 'Bulk Import', 'created', `Bulk imported ${successCount} users`, 'Lifecycle');
      showToast(`${successCount} user(s) invited successfully`);
      setSending(false);
      onInvited();
    };

    return (
      <Drawer title={<div><div style={{ fontSize: 16, fontWeight: 600 }}>Bulk Import Users</div><div style={{ fontSize: 13, color: 'var(--neutral-300)', fontWeight: 400 }}>Import the Prospect in bulk by uploading a spreadsheet.</div></div>} onClose={onClose} className={styles.bulkReviewDrawer} bodyClassName={styles.inviteDrawerBody} headerRight={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="L" onClick={() => setStep('bulk-upload')}>Previous</Button>
          <Button variant="primary" size="L" onClick={handleBulkImport} disabled={sending}>{sending ? 'Importing...' : 'Import'}</Button>
        </div>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Stepper + actions */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '0.5px solid var(--neutral-150)', gap: 16, flexShrink: 0 }}>
            <div className={styles.bulkStepper} style={{ flex: 1 }}>
              <span className={styles.bulkStepDone}><span className={styles.bulkStepNum}>1</span> Upload File</span>
              <span className={styles.bulkStepLine} />
              <span className={styles.bulkStepActive}><span className={styles.bulkStepNum}>2</span> Profile Review</span>
            </div>
            <Button variant="ghost" size="S" leadingIcon="solar:add-circle-linear" onClick={addRow}>Add Row</Button>
            <div style={{ position: 'relative' }}>
              <Button variant="ghost" size="S" leadingIcon="solar:add-circle-linear" onClick={() => setAddColOpen(v => !v)}>Add Column</Button>
              {addColOpen && (
                <AddColumnDropdown
                  available={EXTRA_COLUMNS.filter(c => !bulkColumns.includes(c))}
                  labels={COL_LABELS}
                  onAdd={addColumns}
                  onClose={() => setAddColOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table className={styles.bulkTable} ref={tableRef}>
              <thead>
                <tr>
                  <th className={styles.stickyLeft}>Users</th>
                  {bulkColumns.map(col => (
                    <th key={col} style={{ minWidth: 140, background: highlightCol === col ? 'var(--primary-50)' : undefined, transition: 'background .5s' }}>{COL_LABELS[col] || col} {['first_name', 'last_name', 'email'].includes(col) && <span style={{ color: 'var(--status-error)' }}>*</span>}</th>
                  ))}
                  <th className={styles.stickyRight}>Action</th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map(row => {
                  const isEmpty = !row.first_name && !row.last_name;
                  const isHighlighted = highlightId === row._id;
                  return (
                  <tr key={row._id} style={{ background: isHighlighted ? 'var(--primary-25)' : undefined, transition: 'background .5s' }}>
                    <td className={styles.stickyLeft} style={{ background: isHighlighted ? 'var(--primary-25)' : '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isEmpty ? (
                          <Icon name="solar:user-linear" size={24} color="var(--neutral-200)" />
                        ) : (
                          <Avatar variant="assignee" initials={getInitials(`${row.first_name} ${row.last_name}`).toUpperCase()} />
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: isEmpty ? 'var(--neutral-200)' : 'var(--neutral-400)' }}>{isEmpty ? 'Unnamed' : `${row.first_name} ${row.last_name}`}</div>
                          <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{row.email || 'abc@xyz.com'}</div>
                        </div>
                      </div>
                    </td>
                    {bulkColumns.map(col => (
                      <td key={col} style={{ background: highlightCol === col ? 'var(--primary-25)' : undefined, transition: 'background .5s' }}>
                        {col === 'admin_role' ? (
                          <Select
                            className={styles.bulkSelectTrigger}
                            options={ADMIN_ROLES.map(r => ({ value: r, label: r }))}
                            value={row[col] || undefined}
                            onChange={v => updateRow(row._id, col, v)}
                            placeholder="Select Admin R..."
                          />
                        ) : col === 'gender' ? (
                          <Select
                            className={styles.bulkSelectTrigger}
                            options={GENDER_OPTIONS.map(g => ({ value: g, label: g }))}
                            value={row[col] || undefined}
                            onChange={v => updateRow(row._id, col, v)}
                            placeholder="Select..."
                          />
                        ) : (
                          <input className={styles.bulkInput} value={row[col] || ''} onChange={e => updateRow(row._id, col, e.target.value)} placeholder={COL_LABELS[col] || ''} />
                        )}
                      </td>
                    ))}
                    <td className={styles.stickyRight} style={{ background: isHighlighted ? 'var(--primary-25)' : '#fff' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <ActionButton icon="solar:copy-linear" size="S" tooltip="Duplicate" onClick={() => duplicateRow(row)} />
                        <ActionButton icon="solar:trash-bin-minimalistic-linear" size="S" tooltip="Delete" state="error" onClick={() => deleteRow(row._id)} />
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notice */}
          <div className={styles.bulkNotice} style={{ margin: 0, padding: '8px 16px', borderTop: '0.5px solid var(--neutral-150)' }}>
            <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-200)" />
            <span>Following the successful creation of users through bulk import, their login credentials will be made available to them.</span>
          </div>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer title="Invite User" onClose={onClose} bodyClassName={styles.inviteDrawerBody} headerRight={
      <Button variant="primary" size="L" onClick={handleSendInvite} disabled={sending}>{sending ? 'Sending...' : 'Send Invite'}</Button>
    }>
      <div className={styles.inviteFormScroll}>
        {/* Basic Info */}
        <h4 className={styles.formSectionTitle} style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>Basic Info</h4>
        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>First Name <span className={styles.required}>*</span></label>
            <Input
              value={form.first_name}
              onChange={e => set('first_name', e.target.value)}
              placeholder="First Name"
              variant={form.first_name && !isCapitalizedName(form.first_name) ? 'error' : 'default'}
            />
            {form.first_name && !isCapitalizedName(form.first_name) && (
              <span className={styles.fieldError}>Must start with a capital letter</span>
            )}
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Middle Name</label>
            <Input value={form.middle_name} onChange={e => set('middle_name', e.target.value)} placeholder="Middle Name" />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Last Name <span className={styles.required}>*</span></label>
            <Input
              value={form.last_name}
              onChange={e => set('last_name', e.target.value)}
              placeholder="Last Name"
              variant={form.last_name && !isCapitalizedName(form.last_name) ? 'error' : 'default'}
            />
            {form.last_name && !isCapitalizedName(form.last_name) && (
              <span className={styles.fieldError}>Must start with a capital letter</span>
            )}
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Email <span className={styles.required}>*</span></label>
            <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="Enter email" type="email" />
          </div>
        </div>

        {/* Administrative Roles */}
        <div className={styles.formSection}>
          <label className={styles.formLabel}>Administrative Roles <span className={styles.required}>*</span></label>
          <div className={styles.radioGroup} role="radiogroup">
            {ADMIN_ROLES.map(role => (
              <RadioButton key={role} label={role} checked={form.admin_role === role} onChange={() => set('admin_role', role)} />
            ))}
          </div>
        </div>

        {/* Clinical Roles */}
        <div className={styles.formSection}>
          <label className={styles.formLabel}>Clinical & Operational Roles <span className={styles.required}>*</span></label>
          <p className={styles.formHint}>Select at least one role if the user interacts with patients or schedules appointments.</p>
          <MultiSelectField label="" options={MOCK_ROLES} value={form.clinical_roles} onChange={v => set('clinical_roles', v)} />
        </div>

        {/* Additional Fields toggle */}
        <button className={styles.additionalToggle} onClick={() => setShowAdditional(v => !v)}>
          Additional Fields <Icon name={showAdditional ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} size={14} color="var(--neutral-400)" />
        </button>

        {showAdditional && (
          <>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Credentials <span className={styles.required}>*</span></label>
                <TagInput value={form.credentials} onChange={v => set('credentials', v)} placeholder="e.g. Dr, NP" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Gender <span className={styles.required}>*</span></label>
                <Select
                  options={GENDER_OPTIONS.map(g => ({ value: g, label: g }))}
                  value={form.gender || undefined}
                  onChange={v => set('gender', v)}
                  placeholder="Select gender"
                />
              </div>
            </div>

            <div className={styles.formSection}>
              <label className={styles.formLabel}>Profile</label>
              <textarea className={styles.formTextarea} rows={4} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Brief bio..." />
            </div>

            <MultiSelectField label="Licence State" required options={['Nevada', 'New York', 'California', 'Texas', 'Florida']} value={form.licence_states} onChange={v => set('licence_states', v)} />
            <MultiSelectField label="Location" required options={locationNames} value={form.locations} onChange={v => set('locations', v)} />
            <MultiSelectField label="Languages" required options={LANGUAGE_OPTIONS} value={form.languages} onChange={v => set('languages', v)} />

            {/* Contact Info */}
            <h4 className={styles.formSectionTitle}>Contact Info</h4>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Mobile Number <span className={styles.required}>*</span></label>
                <Input value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+1 234 567 890" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Email <span className={styles.required}>*</span></label>
                <Input value={form.email} disabled />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Fax Number <span className={styles.required}>*</span></label>
                <Input value={form.fax} onChange={e => set('fax', e.target.value)} placeholder="+1 234 567 890" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Zip Code <span className={styles.required}>*</span></label>
                <Input value={form.zip_code} onChange={e => set('zip_code', e.target.value)} placeholder="12345" />
              </div>
            </div>

            {/* Additional Info */}
            <h4 className={styles.formSectionTitle}>Additional Info</h4>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Address Line 1 <span className={styles.required}>*</span></label>
                <Input value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="Street address" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Address Line 2 <span className={styles.required}>*</span></label>
                <Input value={form.address_line2} onChange={e => set('address_line2', e.target.value)} placeholder="Apt, suite" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>State <span className={styles.required}>*</span></label>
                <Input value={form.state} onChange={e => set('state', e.target.value)} placeholder="State" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>City <span className={styles.required}>*</span></label>
                <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

/* ── Insurance Plans Tab ── */

function InsurancePlansTab({ plans = [], onCreateNew, onView, onEdit, onDeleteRequest, searchVal = '' }) {
  const filtered = searchVal
    ? plans.filter(p =>
        (p.planName || '').toLowerCase().includes(searchVal.toLowerCase()) ||
        (p.planType || '').toLowerCase().includes(searchVal.toLowerCase()) ||
        (p.groupNumber || '').toLowerCase().includes(searchVal.toLowerCase())
      )
    : plans;

  if (plans.length === 0) {
    return (
      <div className={styles.insuranceEmpty}>
        <div className={styles.insuranceEmptyOuterRing}>
          <div className={styles.insuranceEmptyRing}>
            <div className={styles.insuranceEmptyInner}>
              <Icon name="solar:shield-user-linear" size={24} color="var(--neutral-200)" />
            </div>
          </div>
        </div>
        <p className={styles.insuranceEmptyText}>No Insurance Plans have been Created.</p>
        <Button variant="primary" size="L" leadingIcon="solar:add-circle-linear" onClick={onCreateNew}>
          Create New
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.insuranceTableWrap}>
      <table className={styles.insuranceTable}>
        <thead>
          <tr className={styles.insuranceTableHeader}>
            <th className={styles.insuranceTh} style={{ width: 180 }}>Plan Logo</th>
            <th className={styles.insuranceTh}>Plan Name</th>
            <th className={styles.insuranceTh} style={{ width: 160 }}>Plan Type</th>
            <th className={styles.insuranceTh} style={{ width: 160 }}>Group Number</th>
            <th className={styles.insuranceTh} style={{ width: 160 }}>EDI Payer ID</th>
            <th className={styles.insuranceTh} style={{ width: 180 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(plan => (
            <tr key={plan.id} className={styles.insuranceTableRow}>
              <td className={styles.insuranceTd}>
                {(plan.logoPreviewUrl || plan.planLogoUrl) ? (
                  <img
                    src={plan.logoPreviewUrl || plan.planLogoUrl}
                    alt="Logo"
                    className={styles.insuranceLogoImg}
                  />
                ) : (
                  <span className={styles.insuranceLogoPlaceholder}>—</span>
                )}
              </td>
              <td className={styles.insuranceTd}>
                <span className={styles.insurancePlanName}>{plan.planName}</span>
              </td>
              <td className={styles.insuranceTd}>
                <span className={styles.insurancePlanTypeBadge}>{plan.planType || '—'}</span>
              </td>
              <td className={styles.insuranceTd}>
                <span className={styles.insuranceCellText}>{plan.groupNumber || '—'}</span>
              </td>
              <td className={styles.insuranceTd}>
                <span className={styles.insuranceCellText}>{plan.ediPayerId || '—'}</span>
              </td>
              <td className={styles.insuranceTd}>
                <div className={styles.insuranceActions}>
                  <button className={styles.insuranceActionBtn} onClick={() => onView(plan)} title="View">
                    <Icon name="solar:eye-linear" size={16} color="var(--neutral-300)" />
                  </button>
                  <span className={styles.insuranceActionDivider} />
                  <button className={styles.insuranceActionBtn} onClick={() => onEdit?.(plan)} title="Edit">
                    <Icon name="solar:pen-linear" size={16} color="var(--neutral-300)" />
                  </button>
                  <span className={styles.insuranceActionDivider} />
                  <button className={styles.insuranceActionBtn} onClick={() => onDeleteRequest?.(plan.id)} title="Delete">
                    <Icon name="solar:trash-bin-2-linear" size={16} color="var(--neutral-300)" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* CreateInsurancePlanDrawer is defined in ./CreateInsurancePlanDrawer.jsx */

export function EditUserDrawer({ user, onClose, onSave }) {
  const locationNames = useLocationNames();
  const raw = user._raw || {};
  const logAudit = useAppStore(s => s.logAudit);
  const showToast = useAppStore(s => s.showToast);
  const [drawerTab, setDrawerTab] = useState('User Details');
  const [form, setForm] = useState({
    first_name: raw.first_name || user.name?.split(' ')[0] || '',
    middle_name: raw.middle_name || '',
    last_name: raw.last_name || user.name?.split(' ').slice(1).join(' ') || '',
    date_of_birth: raw.date_of_birth || '',
    gender: raw.gender || '',
    admin_role: raw.admin_role || 'Business/Practice Owner',
    role: raw.role || user.role || 'Viewer',
    bio: raw.bio || '',
    mobile: raw.mobile || raw.phone || user.phone || '',
    email: raw.email || user.email || '',
    fax: raw.fax || '',
    zip_code: raw.zip_code || '',
    address_line1: raw.address_line1 || '',
    address_line2: raw.address_line2 || '',
    state: raw.state || '',
    city: raw.city || '',
    locations: raw.locations || [],
    languages: raw.languages || [],
    credentials: raw.credentials || [],
    licence_states: raw.licence_states || [],
    clinical_roles: raw.clinical_roles || [],
    ehr_mapping: raw.ehr_mapping || '',
    ehr_user: raw.ehr_user || '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    if (!isCapitalizedName(form.first_name) || !isCapitalizedName(form.last_name)) {
      showToast('First and last name must start with a capital letter');
      return;
    }
    const updates = {
      full_name: `${form.first_name} ${form.last_name}`.trim(),
      first_name: form.first_name, middle_name: form.middle_name, last_name: form.last_name,
      date_of_birth: form.date_of_birth, gender: form.gender,
      admin_role: form.admin_role, role: form.clinical_roles.length > 0 ? form.clinical_roles[0] : 'Viewer', bio: form.bio,
      mobile: form.mobile, fax: form.fax, zip_code: form.zip_code,
      address_line1: form.address_line1, address_line2: form.address_line2,
      state: form.state, city: form.city,
      locations: form.locations, languages: form.languages,
      credentials: form.credentials, licence_states: form.licence_states,
      clinical_roles: form.clinical_roles, ehr_mapping: form.ehr_mapping, ehr_user: form.ehr_user,
    };
    // Build changes for audit log
    const changes = [];
    for (const [key, val] of Object.entries(updates)) {
      const oldVal = raw[key];
      const newStr = Array.isArray(val) ? val.join(', ') : String(val || '');
      const oldStr = Array.isArray(oldVal) ? (oldVal || []).join(', ') : String(oldVal || '');
      if (newStr !== oldStr) changes.push({ field: key, from: oldStr, to: newStr, type: 'text' });
    }
    if (changes.length > 0) {
      logAudit('UserProfile', user.id, user.name, 'updated', `Profile updated: ${changes.map(c => c.field).join(', ')}`, 'Configuration', changes);
    }
    onSave(updates);
  };

  const handleDiscard = () => { onClose(); };

  return (
    <Drawer title="User Profile" onClose={onClose} bodyClassName={styles.editDrawerBody} headerStyle={{ padding: '12px' }} titleStyle={{ fontSize: 14 }}>
      <UserProfileBanner user={user} />
      <TabStrip
        items={DRAWER_TABS.map(t => ({ key: t, label: t }))}
        activeKey={drawerTab}
        onChange={setDrawerTab}
        fullWidth={false}
        trailing={<>
          <Button variant="ghost" size="S" onClick={handleDiscard}>Discard</Button>
          <Button variant="primary" size="S" onClick={handleSave}>Save</Button>
        </>}
      />

      {drawerTab === 'User Details' ? (
        <div className={styles.formScroll}>
          {/* Administrative Roles */}
          <div className={styles.formSection}>
            <label className={styles.formLabel}>Administrative Roles <span className={styles.required}>*</span></label>
            <div className={styles.radioGroup} role="radiogroup">
              {ADMIN_ROLES.map(role => (
                <RadioButton key={role} label={role} checked={form.admin_role === role} onChange={() => set('admin_role', role)} />
              ))}
            </div>
          </div>

          {/* Clinical & Operational Roles */}
          <div className={styles.formSection}>
            <p className={styles.formHint}>Select at least one role if the user interacts with patients or schedules appointments.</p>
            <MultiSelectField label="Clinical & Operational Roles" required options={MOCK_ROLES} value={form.clinical_roles} onChange={v => { set('clinical_roles', v); if (v.length > 0) set('role', v[0]); }} />
          </div>

          {/* Location */}
          <MultiSelectField label="Location" required options={locationNames} value={form.locations} onChange={v => set('locations', v)} />

          {/* Map User to EHR */}
          <div className={styles.formSection}>
            <label className={styles.formLabel}>Map User to EHR <span className={styles.required}>*</span></label>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <Select
                  options={EHR_SYSTEMS.map(s => ({ value: s, label: s }))}
                  value={form.ehr_mapping || undefined}
                  onChange={v => set('ehr_mapping', v)}
                  placeholder="Select EHR system"
                />
              </div>
              <div className={styles.formField}>
                <Select
                  options={[`${form.first_name} ${form.last_name} (${form.ehr_mapping || 'EHR'})`, 'Amy Brenneman (Athena Health)', 'John Doe (Epic)', 'Jane Smith (Cerner)'].filter(Boolean).map(u => ({ value: u, label: u }))}
                  value={form.ehr_user || undefined}
                  onChange={v => set('ehr_user', v)}
                  placeholder="Select EHR user"
                />
              </div>
            </div>
          </div>

          {/* Languages */}
          <MultiSelectField label="Languages" required options={LANGUAGE_OPTIONS} value={form.languages} onChange={v => set('languages', v)} />

          {/* Basic Info */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Basic Info</h4>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>First Name <span className={styles.required}>*</span></label>
                <Input
                  value={form.first_name}
                  onChange={e => set('first_name', e.target.value)}
                  placeholder="First name"
                  variant={form.first_name && !isCapitalizedName(form.first_name) ? 'error' : 'default'}
                />
                {form.first_name && !isCapitalizedName(form.first_name) && (
                  <span className={styles.fieldError}>Must start with a capital letter</span>
                )}
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Middle Name</label>
                <Input value={form.middle_name} onChange={e => set('middle_name', e.target.value)} placeholder="Middle name" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Last Name <span className={styles.required}>*</span></label>
                <Input
                  value={form.last_name}
                  onChange={e => set('last_name', e.target.value)}
                  placeholder="Last name"
                  variant={form.last_name && !isCapitalizedName(form.last_name) ? 'error' : 'default'}
                />
                {form.last_name && !isCapitalizedName(form.last_name) && (
                  <span className={styles.fieldError}>Must start with a capital letter</span>
                )}
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Date of Birth</label>
                <div className={styles.dateInputWrap}>
                  <input
                    type="date"
                    className={styles.dateInput}
                    value={form.date_of_birth || ''}
                    onChange={e => set('date_of_birth', e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Credentials <span className={styles.required}>*</span></label>
                <TagInput value={form.credentials} onChange={v => set('credentials', v)} placeholder="e.g. Dr, NP" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Gender <span className={styles.required}>*</span></label>
                <Select
                  options={GENDER_OPTIONS.map(g => ({ value: g, label: g }))}
                  value={form.gender || undefined}
                  onChange={v => set('gender', v)}
                  placeholder="Select gender"
                />
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className={styles.formSection}>
            <label className={styles.formLabel}>Profile</label>
            <textarea className={styles.formTextarea} rows={5} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Brief bio or description..." />
          </div>

          {/* Licence State */}
          <div className={styles.formSection}>
            <label className={styles.formLabel}>Licence State <span className={styles.required}>*</span></label>
            <TagInput value={form.licence_states} onChange={v => set('licence_states', v)} placeholder="Add state..." />
          </div>

          {/* Contact Info */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Contact Info</h4>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Mobile Number <span className={styles.required}>*</span></label>
                <Input value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+1 234 567 890" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Email <span className={styles.required}>*</span></label>
                <Input value={form.email} disabled />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Fax Number <span className={styles.required}>*</span></label>
                <Input value={form.fax} onChange={e => set('fax', e.target.value)} placeholder="+1 234 567 890" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Zip Code <span className={styles.required}>*</span></label>
                <Input value={form.zip_code} onChange={e => set('zip_code', e.target.value)} placeholder="12345" />
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Additional Info</h4>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Address Line 1 <span className={styles.required}>*</span></label>
                <Input value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="Street address" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Address Line 2 <span className={styles.required}>*</span></label>
                <Input value={form.address_line2} onChange={e => set('address_line2', e.target.value)} placeholder="Apt, suite, etc." />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>State <span className={styles.required}>*</span></label>
                <Input value={form.state} onChange={e => set('state', e.target.value)} placeholder="State" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>City <span className={styles.required}>*</span></label>
                <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Icon name="solar:widget-linear" size={40} color="var(--neutral-150)" />
          <p className={styles.emptyTitle}>{drawerTab}</p>
          <p className={styles.emptyDesc}>Coming soon.</p>
        </div>
      )}
    </Drawer>
  );
}
