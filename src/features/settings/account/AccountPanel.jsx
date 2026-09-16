import { useState, useEffect, useRef, useMemo, useId } from 'react';
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
import { Textarea } from '../../../components/Textarea/Textarea';
import { DatePicker } from '../../../components/DatePicker/DatePicker';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { Select } from '../../../components/Select/Select';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { AuditLogContent } from '../shared/AuditLogDrawer';
import { IdIcon } from '../../../components/Icon/IdIcon';
import { AddIconMinimalist } from '../../../components/Icon/AddIconMinimalist';
import { CreateInsurancePlanDrawer } from './CreateInsurancePlanDrawer';
import { InsurancePlanViewDrawer } from './InsurancePlanViewDrawer';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '../../../components/ShadcnDialog/ShadcnDialog';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { BulkBar } from '../../../components/BulkBar/BulkBar';
import { BulkSelectToggle } from '../../../components/BulkSelect/BulkSelectToggle';
import { useBulkSelect } from '../../../components/BulkSelect/useBulkSelect';
import { OrgPanel } from './OrgPanel';
import { UsersTab } from './users/UsersTab';
import { LocationsTab } from './locations/LocationsTab';
import { HCC_ROLES, ROLE_COLORS, getInitials } from './AccountPanel.constants';
import { useLocationNames, TagInput, MultiSelectField, AddColumnDropdown } from './AccountPanelParts';
import { ADMIN_ROLES, GENDER_OPTIONS, LANGUAGE_OPTIONS, MOCK_ROLES, isCapitalizedName } from './InviteUserDrawer.utils';
import styles from './AccountPanel.module.css';

const ALL_TABS = ['Org', 'Users', 'Teams', 'Access Control', 'Locations', 'Insurance Plans', 'Holiday Configuration', 'Merged Or Delayed', 'Allowed Phone', 'Allowed Emails'];

// Bridge the store's slug (`accountTab`, e.g. 'access-control' — also the URL
// segment the router reads) and the display names in ALL_TABS.
const tabKeyToName = (key) => ALL_TABS.find(t => t.toLowerCase().replace(/ /g, '-') === key) || 'Org';
const tabNameToKey = (name) => name.toLowerCase().replace(/ /g, '-');

export { InviteUserDrawer } from './InviteUserDrawer';

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

  // Bulk-select for the Insurance Plans table. Resets when the account tab
  // changes. Plans are local state, so bulk delete filters that state — same
  // as the single-row delete below.
  const planBulk = useBulkSelect(activeTab);
  const [bulkDeletePlansOpen, setBulkDeletePlansOpen] = useState(false);
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
          actions={['search']}
          searchPlaceholder="Search plans…"
          searchValue={planSearchVal}
          onSearchChange={setPlanSearchVal}
          primaryActionLabel="New Insurance Plan"
          onPrimaryAction={() => setShowCreateInsurance(true)}
          rightExtras={<BulkSelectToggle active={planBulk.bulkMode} onToggle={planBulk.toggleBulk} />}
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
              bulkMode={planBulk.bulkMode}
              isSelected={planBulk.isSelected}
              onToggleSelect={planBulk.toggleId}
              onToggleAll={(rows) => planBulk.toggleAll(rows)}
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

      {/* Floating bulk bar for Insurance Plans */}
      {isInsurancePlans && planBulk.bulkMode && planBulk.count > 0 && (
        <BulkBar
          selectedIds={planBulk.selectedIdList}
          onClear={planBulk.clearSelection}
          actions={[{
            label: 'Delete',
            icon: 'solar:trash-bin-trash-linear',
            variant: 'secondary',
            onClick: () => setBulkDeletePlansOpen(true),
          }]}
        />
      )}

      {bulkDeletePlansOpen && (
        <ConfirmDialog
          variant="destructive"
          icon="solar:trash-bin-2-linear"
          title={`Delete ${planBulk.count} insurance plan${planBulk.count === 1 ? '' : 's'}?`}
          description="Please confirm if you want to permanently delete the selected insurance plans from the system."
          confirmLabel="Delete Plans"
          onCancel={() => setBulkDeletePlansOpen(false)}
          onConfirm={() => {
            const ids = new Set(planBulk.selectedIdList);
            setPlans(prev => prev.filter(p => !ids.has(p.id)));
            setBulkDeletePlansOpen(false);
            planBulk.exitBulk();
          }}
        />
      )}

      {planSavedToast && (
        <div className={styles.toastOverlay}>
          <div className={styles.toast}>
            <span className={styles.toastText}>Plan Saved Successfully</span>
            <button className={styles.toastClose} onClick={() => setPlanSavedToast(false)} aria-label="Dismiss notification">
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
    <Drawer title="User Profile" onClose={onClose} bodyClassName={styles.editDrawerBody} headerStyle={{ padding: '12px' }} titleStyle={{ fontSize: 'var(--font-base)' }}>
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

/* ── Insurance Plans Tab ── */

function InsurancePlansTab({
  plans = [], onCreateNew, onView, onEdit, onDeleteRequest, searchVal = '',
  bulkMode = false, isSelected = () => false, onToggleSelect, onToggleAll,
}) {
  const filtered = searchVal
    ? plans.filter(p =>
        (p.planName || '').toLowerCase().includes(searchVal.toLowerCase()) ||
        (p.planType || '').toLowerCase().includes(searchVal.toLowerCase()) ||
        (p.groupNumber || '').toLowerCase().includes(searchVal.toLowerCase())
      )
    : plans;
  const allSelected = filtered.length > 0 && filtered.every(p => isSelected(p.id));

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
            {bulkMode && (
              <th className={styles.insuranceTh} style={{ width: 44 }}>
                <Checkbox checked={allSelected} onCheckedChange={() => onToggleAll?.(filtered)} aria-label="Select all plans" />
              </th>
            )}
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
            <tr
              key={plan.id}
              className={styles.insuranceTableRow}
              onClick={bulkMode ? () => onToggleSelect?.(plan.id) : undefined}
              style={bulkMode ? { cursor: 'pointer' } : undefined}
            >
              {bulkMode && (
                <td className={styles.insuranceTd} onClick={e => e.stopPropagation()}>
                  <Checkbox checked={isSelected(plan.id)} onCheckedChange={() => onToggleSelect?.(plan.id)} aria-label={`Select ${plan.planName}`} />
                </td>
              )}
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

/* ── Edit User Drawer ── */

const DRAWER_TABS = ['User Details', 'Business Hours', 'Assigned Patients'];
const EHR_SYSTEMS = ['Athena Health', 'Epic', 'Cerner', 'eClinicalWorks', 'Allscripts', 'NextGen', 'Greenway Health', 'DrChrono'];

export function EditUserDrawer({ user, onClose, onSave }) {
  const uid = useId();
  const locationNames = useLocationNames();
  const raw = user._raw || {};
  const logAudit = useAppStore(s => s.logAudit);
  const showToast = useAppStore(s => s.showToast);
  const [drawerTab, setDrawerTab] = useState('User Details');

  // The saved-state baseline: what the form equals when there are no unsaved
  // edits. Both the dirty check and draft recovery measure against it.
  const initialForm = useMemo(() => ({
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
  }), [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-user draft so an accidental close (or a reload) never loses typing.
  // localStorage is per-viewer and best-effort — every access is guarded.
  const draftKey = `foldEditUserDraft:${user.id}`;
  const clearDraft = () => { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } };

  // Read any saved draft once, at mount, so a recovered form and the "restored"
  // toast agree without touching a ref during render.
  const [initialDraft] = useState(() => {
    try {
      const v = localStorage.getItem(draftKey);
      const draft = v ? JSON.parse(v) : null;
      return draft && typeof draft === 'object' ? draft : null;
    } catch { return null; }
  });
  const [form, setForm] = useState(() => (initialDraft ? { ...initialForm, ...initialDraft } : initialForm));

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  // Persist edits as they happen; drop the draft the moment the form is back
  // at the saved baseline.
  useEffect(() => {
    try {
      if (isDirty) localStorage.setItem(draftKey, JSON.stringify(form));
      else localStorage.removeItem(draftKey);
    } catch { /* ignore */ }
  }, [form, isDirty, draftKey]);

  // Let the user know we brought their unsaved work back.
  useEffect(() => {
    if (initialDraft) showToast('Restored your unsaved changes');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Only the essential identity fields are required, so the form isn't a wall
  // of asterisks. The capital-letter rule shows live; the required rule only
  // after a save attempt.
  const [submitted, setSubmitted] = useState(false);
  const nameError = (v) => {
    if (submitted && !v.trim()) return 'This field is required';
    if (v && !isCapitalizedName(v)) return 'Must start with a capital letter';
    return '';
  };
  const firstNameError = nameError(form.first_name);
  const lastNameError = nameError(form.last_name);

  const [confirmClose, setConfirmClose] = useState(false);

  const handleSave = () => {
    setSubmitted(true);
    if (!form.first_name.trim() || !form.last_name.trim()) {
      showToast('First and last name are required');
      return;
    }
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
    // The save intent supersedes the draft; the parent unmounts this drawer on
    // success, so clear it now rather than leaving a stale draft behind.
    clearDraft();
    onSave(updates);
  };

  // Close guards. A dirty overlay / X / Esc close is vetoed (beforeClose returns
  // false) and routed to the save-or-discard dialog so nothing is lost by
  // accident. The explicit Discard button is intentional, so it just drops the
  // draft and closes.
  const beforeClose = () => {
    if (!isDirty) return true;
    setConfirmClose(true);
    return false;
  };
  const handleDiscard = () => { clearDraft(); onClose(); };
  const discardFromDialog = () => { setConfirmClose(false); clearDraft(); onClose(); };
  const saveFromDialog = () => { setConfirmClose(false); handleSave(); };

  return (
    <Drawer title="User Profile" onClose={onClose} beforeClose={beforeClose} bodyClassName={styles.editDrawerBody} headerStyle={{ padding: '12px' }} titleStyle={{ fontSize: 'var(--font-base)' }}>
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
          {/* Administrative Roles — a radiogroup keeps an external group label
              (aria-labelledby, no built-in control to own it), sized to match
              the DS label + 4px gap via .formField. */}
          <div className={styles.formField}>
            <span className={styles.formLabel} id={`${uid}-admin-roles`}>Administrative Roles</span>
            <div className={styles.radioGroup} role="radiogroup" aria-labelledby={`${uid}-admin-roles`}>
              {ADMIN_ROLES.map(role => (
                <RadioButton key={role} label={role} checked={form.admin_role === role} onChange={() => set('admin_role', role)} />
              ))}
            </div>
          </div>

          {/* Clinical & Operational Roles */}
          <div className={styles.formField}>
            <p className={styles.formHint}>Select at least one role if the user interacts with patients or schedules appointments.</p>
            <MultiSelectField label="Clinical & Operational Roles" options={MOCK_ROLES} value={form.clinical_roles} onChange={v => { set('clinical_roles', v); if (v.length > 0) set('role', v[0]); }} />
          </div>

          {/* Location */}
          <MultiSelectField label="Location" options={locationNames} value={form.locations} onChange={v => set('locations', v)} />

          {/* Map User to EHR — each select carries its own built-in label. */}
          <div className={styles.formGrid}>
            <Select
              label="EHR System"
              options={EHR_SYSTEMS.map(s => ({ value: s, label: s }))}
              value={form.ehr_mapping || undefined}
              onChange={v => set('ehr_mapping', v)}
              placeholder="Select EHR system"
            />
            <Select
              label="EHR User"
              options={[`${form.first_name} ${form.last_name} (${form.ehr_mapping || 'EHR'})`, 'Amy Brenneman (Athena Health)', 'John Doe (Epic)', 'Jane Smith (Cerner)'].filter(Boolean).map(u => ({ value: u, label: u }))}
              value={form.ehr_user || undefined}
              onChange={v => set('ehr_user', v)}
              placeholder="Select EHR user"
            />
          </div>

          {/* Languages */}
          <MultiSelectField label="Languages" options={LANGUAGE_OPTIONS} value={form.languages} onChange={v => set('languages', v)} />

          {/* Basic Info */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Basic Info</h4>
            <div className={styles.formGrid}>
              <Input
                label="First Name"
                required
                id={`${uid}-first-name`}
                value={form.first_name}
                onChange={e => set('first_name', e.target.value)}
                placeholder="First name"
                errorText={firstNameError || undefined}
              />
              <Input label="Middle Name" id={`${uid}-middle-name`} value={form.middle_name} onChange={e => set('middle_name', e.target.value)} placeholder="Middle name" />
              <Input
                label="Last Name"
                required
                id={`${uid}-last-name`}
                value={form.last_name}
                onChange={e => set('last_name', e.target.value)}
                placeholder="Last name"
                errorText={lastNameError || undefined}
              />
              <DatePicker label="Date of Birth" id={`${uid}-dob`} value={form.date_of_birth || ''} onSelect={v => set('date_of_birth', v)} />
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-credentials`}>Credentials</label>
                <TagInput inputId={`${uid}-credentials`} value={form.credentials} onChange={v => set('credentials', v)} placeholder="e.g. Dr, NP" />
              </div>
              <Select
                label="Gender"
                id={`${uid}-gender`}
                options={GENDER_OPTIONS.map(g => ({ value: g, label: g }))}
                value={form.gender || undefined}
                onChange={v => set('gender', v)}
                placeholder="Select gender"
              />
            </div>
          </div>

          {/* Profile */}
          <Textarea title="Profile" id={`${uid}-bio`} rows={5} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Brief bio or description..." />

          {/* Licence State */}
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor={`${uid}-licence-states`}>Licence State</label>
            <TagInput inputId={`${uid}-licence-states`} value={form.licence_states} onChange={v => set('licence_states', v)} placeholder="Add state..." />
          </div>

          {/* Contact Info */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Contact Info</h4>
            <div className={styles.formGrid}>
              <Input label="Mobile Number" id={`${uid}-mobile`} value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+1 234 567 890" />
              <Input label="Email" required id={`${uid}-email`} value={form.email} disabled />
              <Input label="Fax Number" id={`${uid}-fax`} value={form.fax} onChange={e => set('fax', e.target.value)} placeholder="+1 234 567 890" />
              <Input label="Zip Code" id={`${uid}-zip`} value={form.zip_code} onChange={e => set('zip_code', e.target.value)} placeholder="12345" />
            </div>
          </div>

          {/* Additional Info */}
          <div className={styles.formSection}>
            <h4 className={styles.formSectionTitle}>Additional Info</h4>
            <div className={styles.formGrid}>
              <Input label="Address Line 1" id={`${uid}-address1`} value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="Street address" />
              <Input label="Address Line 2" id={`${uid}-address2`} value={form.address_line2} onChange={e => set('address_line2', e.target.value)} placeholder="Apt, suite, etc." />
              <Input label="State" id={`${uid}-state`} value={form.state} onChange={e => set('state', e.target.value)} placeholder="State" />
              <Input label="City" id={`${uid}-city`} value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
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

      {/* Unsaved-changes guard: shown when the user tries to close a dirty
          form. Dismissing it (overlay / Esc) keeps the drawer open — the safe
          default — so a stray click never discards work. */}
      <Dialog open={confirmClose} onOpenChange={open => !open && setConfirmClose(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes on this profile. Save them before closing, or discard them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="M" onClick={() => setConfirmClose(false)}>Keep editing</Button>
            <Button variant="secondary" size="M" onClick={discardFromDialog}>Discard</Button>
            <Button variant="primary" size="M" onClick={saveFromDialog}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Drawer>
  );
}

