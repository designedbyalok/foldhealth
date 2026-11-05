import { Switch } from '../../../../components/Switch/Switch';
import { Icon } from '../../../../components/Icon/Icon';
import { ROLE_COLORS } from '../../account/AccountPanel.constants';
import styles from '../CareProgramConfig.module.css';

const ROLES = Object.keys(ROLE_COLORS).filter(r => r !== 'Patient');
// An empty list means every role; NOBODY keeps "switched off for everyone" distinct from that.
const NOBODY = '__none__';

const isOn = (list, role) => (!list || list.length === 0 ? true : list.includes(role));
const allOn = list => !list || list.length === 0;
function toggleRole(list, role, on) {
  const current = allOn(list) ? ROLES : list.filter(r => r !== NOBODY);
  const next = on ? [...new Set([...current, role])] : current.filter(r => r !== role);
  if (next.length === ROLES.length) return [];
  return next.length ? next : [NOBODY];
}

/** One access card (Figma "Platform Access"): Allow All, then a switch per role. */
function RoleAccessCard({ icon, title, list, onChange, children }) {
  return (
    <section className={styles.accessCard}>
      <div className={styles.accessHead}>
        <span className={styles.accessTitle}>
          <Icon name={icon} size={16} color="var(--neutral-400)" />
          {title}
        </span>
        <span className={styles.accessHeadRight}>
          <span className={styles.allowAll}>Allow All</span>
          <Switch checked={allOn(list)} onChange={on => onChange(on ? [] : [NOBODY])} ariaLabel={`${title}: allow all roles`} />
        </span>
      </div>
      <div className={styles.accessCols}><span>Permissions</span><span>Status</span></div>
      {children}
      <div className={styles.accessGroup}>Roles</div>
      {ROLES.map(role => (
        <div key={role} className={styles.accessRow}>
          <span className={styles.accessLabel}>{role}</span>
          <Switch checked={isOn(list, role)} onChange={on => onChange(toggleRole(list, role, on))} ariaLabel={`${title}: ${role}`} />
        </div>
      ))}
    </section>
  );
}

/** Access: who sees this program in navigation, who can enroll patients, and who can change its settings. */
export function AccessTab({ draft, patch }) {
  const a = draft.access;
  const set = p => patch({ access: { ...a, ...p } });
  return (
    <>
      <p className={styles.cardHint}>Switch a role off to take away that access for this program. Allow All gives it to every role.</p>
      <div className={styles.accessCards}>
        <RoleAccessCard icon="solar:widget-linear" title="Navigation Access" list={a.navigationRoles} onChange={navigationRoles => set({ navigationRoles })}>
          <div className={styles.accessGroup}>Program</div>
          <div className={styles.accessRow}>
            <span className={styles.accessLabel}>Show in Population navigation</span>
            <Switch checked={a.showInNavigation} onChange={showInNavigation => set({ showInNavigation })} ariaLabel="Show in Population navigation" />
          </div>
        </RoleAccessCard>
        <RoleAccessCard icon="solar:user-plus-linear" title="Enrollment Access" list={a.enrollRoles} onChange={enrollRoles => set({ enrollRoles })} />
        <RoleAccessCard icon="solar:settings-linear" title="Settings Access" list={a.settingsRoles} onChange={settingsRoles => set({ settingsRoles })} />
      </div>
    </>
  );
}
