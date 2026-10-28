import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/Icon/Icon';
import { goTo, useHashSubRoute } from '../lib/useHashRoute';
import { useProfile } from '../lib/profileContext';
import { FamilyMembers } from './FamilyMembers';
import { MyPackages } from './MyPackages';
import { ChangePassword } from './ChangePassword';
import { CommunicationPreferences } from './CommunicationPreferences';
import { AboutFold } from './AboutFold';
import styles from './Settings.module.css';

const SECTIONS = [
  { id: 'family', label: 'Family Members', icon: 'solar:users-group-rounded-linear', render: () => <FamilyMembers /> },
  { id: 'packages', label: 'My Packages', icon: 'solar:box-linear', render: (p) => <MyPackages memberId={p.member_id} /> },
  { id: 'password', label: 'Change Password', icon: 'solar:lock-password-linear', render: () => <ChangePassword /> },
  { id: 'communication', label: 'Communication Preferences', icon: 'solar:bell-linear', render: (p) => <CommunicationPreferences memberId={p.member_id} /> },
  { id: 'about', label: 'About Fold', icon: 'solar:info-circle-linear', render: () => <AboutFold /> },
];

// Settings (frame 701:5439): a menu beside the chosen section.
export function SettingsPage() {
  const { profile } = useProfile();
  const sub = useHashSubRoute();
  const section = SECTIONS.find((s) => s.id === sub) || SECTIONS[1];

  return (
    <div className={styles.layout}>
      <nav className={styles.menu} aria-label="Settings">
        <h2 className={styles.menuTitle}>Settings</h2>
        <ul className={styles.menuList}>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={`${styles.menuItem} ${s.id === section.id ? styles.menuActive : ''}`}
                aria-current={s.id === section.id ? 'page' : undefined}
                onClick={() => goTo(`settings/${s.id}`)}
              >
                <Icon name={s.icon} size={18} color="currentColor" />
                {s.label}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className={`${styles.menuItem} ${styles.logout}`} onClick={() => supabase.auth.signOut()}>
              <Icon name="solar:logout-2-linear" size={18} color="currentColor" />
              Logout
            </button>
          </li>
        </ul>
      </nav>
      <section className={styles.content} aria-label={section.label}>
        <h2 className={styles.sectionTitle}>{section.label}</h2>
        {section.render(profile)}
      </section>
    </div>
  );
}
