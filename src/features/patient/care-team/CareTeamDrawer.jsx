import { useEffect, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Select } from '../../../components/Select/Select';
import { Badge } from '../../../components/Badge/Badge';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { RingEmptyState } from '../../../components/RingEmptyState/RingEmptyState';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { PersonOption } from '../../messages/comms/PersonOption';
import { usePatientCareTeam } from './usePatientCareTeam';
import { CARE_TEAM_ROLES } from './careTeamRoles';
import styles from './CareTeamDrawer.module.css';

const initialsOf = (name) => String(name || '').replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const keyOf = (m) => m.id || `${m.userId || m.name}|${m.role || ''}`;

function MemberRow({ member, historical, onMenu }) {
  return (
    <div className={styles.member}>
      <Avatar variant={historical ? 'others' : 'staff'} size="M" initials={member.initials || initialsOf(member.name)} />
      <div className={styles.memberText}>
        <span className={styles.memberName}>
          {member.name}
          {member.role && <Badge tone="grey" size="XS" label={member.role} />}
        </span>
        {member.title && <span className={styles.memberTitle}>{member.title}</span>}
      </div>
      <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" tooltipLeft onClick={e => onMenu(e.currentTarget.getBoundingClientRect())} />
    </div>
  );
}

/**
 * Primary Care Team (Figma SNP Story 3104:1470194): pick a role, then the
 * user who holds it; they join Current Care Team Members. Taking someone off
 * moves them to Historical Care Team Members. Save writes both to
 * patient_care_team, for any patient, profile or not.
 */
export function CareTeamDrawer({ patient, onClose }) {
  const patientId = String(patient.id);
  const { team, history: savedHistory, loading } = usePatientCareTeam(patientId);
  const people = useAppStore(s => s.platformPeople) || [];
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const saveCareTeam = useAppStore(s => s.saveCareTeam);
  useEffect(() => { fetchPlatformUsers(); }, [fetchPlatformUsers]);

  const [current, setCurrent] = useState(team);
  const [history, setHistory] = useState(savedHistory);
  // Opened before the team had loaded: take it once it arrives.
  const [seeded, setSeeded] = useState(!loading);
  if (!seeded && !loading) { setSeeded(true); setCurrent(team); setHistory(savedHistory); }
  const [role, setRole] = useState('');
  const [menu, setMenu] = useState(null); // { member, historical, rect }
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  // Remounting the user search clears it after each pick.
  const [pickerKey, setPickerKey] = useState(0);

  // Someone already holding the picked role isn't offered again for it.
  const holders = new Set(current.filter(m => m.role === role).map(m => m.userId || m.name));
  const userOptions = people
    .filter(u => !holders.has(u.id) && !holders.has(u.name))
    .map(u => ({
      value: String(u.id),
      triggerLabel: u.name,
      searchText: `${u.name} ${(u.clinicalRoles || []).join(' ')} ${u.email || ''}`,
      label: <PersonOption name={u.name} initials={u.initials || initialsOf(u.name)} meta={(u.clinicalRoles || [])[0] || u.email || ''} />,
    }));

  const addUser = (id) => {
    const u = people.find(x => String(x.id) === id);
    if (!u) return;
    setCurrent(list => [...list, { id: `ct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, userId: String(u.id), name: u.name, initials: u.initials || initialsOf(u.name), role, title: (u.clinicalRoles || [])[0] || '' }]);
    setRole('');
    setPickerKey(k => k + 1);
    setDirty(true);
  };
  const toHistory = (m) => {
    setCurrent(list => list.filter(x => keyOf(x) !== keyOf(m)));
    setHistory(list => [m, ...list]);
    setDirty(true);
  };
  const restore = (m) => {
    setHistory(list => list.filter(x => keyOf(x) !== keyOf(m)));
    setCurrent(list => [...list, m]);
    setDirty(true);
  };
  const remove = (m, historical) => {
    (historical ? setHistory : setCurrent)(list => list.filter(x => keyOf(x) !== keyOf(m)));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const ok = await saveCareTeam(patientId, current, history);
    setSaving(false);
    if (!ok) { toast.error('The care team could not be saved. Try again.'); return; }
    toast.success('Care Team Updated Successfully');
    onClose();
  };

  const menuItems = menu?.historical
    ? [{ key: 'restore', icon: 'solar:restart-linear', label: 'Move to Current Team' }, { key: 'remove', icon: 'solar:trash-bin-trash-linear', label: 'Remove', danger: true }]
    : [{ key: 'history', icon: 'solar:history-linear', label: 'Move to Historical' }, { key: 'remove', icon: 'solar:trash-bin-trash-linear', label: 'Remove', danger: true }];

  return (
    <Drawer
      title="Primary Care Team"
      onClose={onClose}
      primaryAction={<Button onClick={save} disabled={!dirty || saving} disabledReason={!dirty ? 'No changes to save' : null}>Save</Button>}
    >
      <div className={styles.body}>
        <div className={styles.pickers}>
          <Select
            label="Select Role"
            options={CARE_TEAM_ROLES.map(r => ({ value: r, label: r }))}
            value={role}
            onChange={setRole}
            placeholder="Select Care Team Role"
          />
          <Select
            key={pickerKey}
            label="Search User"
            searchable
            disabled={!role}
            options={userOptions}
            value=""
            onChange={addUser}
            placeholder="Search & Select Team Members"
            searchPlaceholder="Search by name or role"
            emptyText="No users match"
          />
        </div>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Current Care Team Members</h3>
          {loading
            ? <div className={styles.empty}><span className={styles.loadingText}>Loading care team…</span></div>
            : current.length === 0
            ? <div className={styles.empty}><RingEmptyState size="S" icon="solar:users-group-rounded-linear" label="No care team members yet" /></div>
            : current.map(m => <MemberRow key={keyOf(m)} member={m} onMenu={rect => setMenu({ member: m, historical: false, rect })} />)}
        </section>

        {history.length > 0 && (
          <section className={styles.section}>
            <h3 className={`${styles.sectionTitle} ${styles.sectionTitleMuted}`}>Historical Care Team Members</h3>
            {history.map(m => <MemberRow key={keyOf(m)} member={m} historical onMenu={rect => setMenu({ member: m, historical: true, rect })} />)}
          </section>
        )}
      </div>
      {menu && (
        <MenuPopover
          anchorRect={menu.rect}
          items={menuItems}
          width="auto"
          onClose={() => setMenu(null)}
          onSelect={(key) => {
            if (key === 'history') toHistory(menu.member);
            if (key === 'restore') restore(menu.member);
            if (key === 'remove') remove(menu.member, menu.historical);
            setMenu(null);
          }}
        />
      )}
    </Drawer>
  );
}
