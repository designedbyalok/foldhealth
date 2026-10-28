import googleLogo from './google.svg';
import microsoftLogo from './microsoft.svg';
import styles from './OAuthButtons.module.css';

const PROVIDERS = [
  { id: 'google', label: 'Google', logo: googleLogo },
  { id: 'azure', label: 'Microsoft', logo: microsoftLogo },
];

/**
 * OAuthButtons: "or continue with" divider plus one button per sign-in
 * provider (Google, Microsoft), as on the staff login.
 *
 * @param {object}   props
 * @param {function} props.onSelect           – called with the Supabase provider id ('google' | 'azure')
 * @param {string[]} [props.enabled=['google']] – providers that are live; the rest show "Coming soon"
 * @param {boolean}  [props.disabled=false]   – disables every button (e.g. while signing in)
 * @param {string}   [props.label='or continue with']
 */
export function OAuthButtons({ onSelect, enabled = ['google'], disabled = false, label = 'or continue with' }) {
  return (
    <div className={styles.root}>
      <div className={styles.divider}>
        <span className={styles.line} />
        <span className={styles.label}>{label}</span>
        <span className={styles.line} />
      </div>
      <div className={styles.row}>
        {PROVIDERS.map((p) => {
          const live = enabled.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              className={styles.button}
              disabled={disabled || !live}
              title={live ? undefined : 'Coming soon'}
              onClick={() => onSelect(p.id)}
            >
              <img src={p.logo} alt="" width={18} height={18} />
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
