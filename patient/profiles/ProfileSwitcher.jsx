import { useState } from 'react';
import { Icon } from '@/components/Icon/Icon';
import { RadioListPopover } from '@/components/RadioListPopover/RadioListPopover';
import { useProfile } from '../lib/profileContext';
import { firstName, shortName } from '../lib/profileFormat';
import styles from './ProfileSwitcher.module.css';

// "Andrew ⌄" on Home (frame 701:4555). With one profile it is just a label.
export function ProfileSwitcher() {
  const { profiles, profile, select } = useProfile();
  const [anchor, setAnchor] = useState(null);
  const label = (p) => (profiles.filter((q) => q.name === p.name).length > 1 ? `${p.name} (${p.member_id})` : p.name || p.member_id);

  if (profiles.length < 2) return <span className={styles.single}>{firstName(profile)}</span>;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={!!anchor}
        onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
      >
        {shortName(profile, profiles)}
        <Icon name="solar:alt-arrow-down-linear" size={14} color="currentColor" />
      </button>
      {anchor && (
        <RadioListPopover
          anchorRect={anchor}
          label="Switch profile"
          options={profiles.map(label)}
          selected={[label(profile)]}
          showClear={false}
          onChange={([picked]) => {
            const next = profiles.find((p) => label(p) === picked);
            if (next) select(next.member_id);
            setAnchor(null);
          }}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
