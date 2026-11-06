import { formatPhone } from '../../../messages/comms/commsUtils';
import { InfoRow, ProfileSection } from './ProfileSection';
import styles from '../MemberProfileScreen.module.css';

const LANGUAGES = { en: 'English', es: 'Spanish', fr: 'French', zh: 'Chinese', vi: 'Vietnamese', ko: 'Korean', ru: 'Russian', ar: 'Arabic' };
const languageLabel = (v) => LANGUAGES[String(v || '').toLowerCase()] || v;
const firstOf = (v) => (Array.isArray(v) ? v.filter(Boolean)[0] : v);

/**
 * Figma P360 Demographics (759:26451): basic info, contact, address, other.
 * From the all_patients row, with p360_profiles filling what it adds.
 */
export function DemographicsTab({ patient, p360 }) {
  const email = patient.email || firstOf(p360?.emails);
  const plan = [p360?.health_plan_name, firstOf(p360?.plan_numbers_primary)].filter(Boolean).join(' • ');
  return (
    <>
      <ProfileSection title="Basic Info">
        <div className={styles.infoCard}>
          <InfoRow label="Name" value={patient.name} />
          <InfoRow label="Chosen Name" value={p360?.chosen_name} />
          <InfoRow label="Gender" value={p360?.gender_identity || patient.gender} />
          <InfoRow label="Sex at Birth" value={p360?.sex_at_birth} />
          <InfoRow label="Pronoun" value={p360?.pronoun} />
          <InfoRow label="Birth Date" value={patient.dob} />
          <InfoRow label="Age" value={patient.age != null && patient.age !== '' ? String(patient.age) : ''} />
          <InfoRow label="Language" value={languageLabel(patient.language)} />
        </div>
      </ProfileSection>

      <ProfileSection title="Contact Info">
        <div className={styles.infoCard}>
          <InfoRow label="Email" value={email} />
          <InfoRow label="Phone" value={formatPhone(patient.phone)} />
        </div>
      </ProfileSection>

      <ProfileSection title="Address">
        <div className={styles.infoCard}>
          <InfoRow label="City" value={patient.city} />
          <InfoRow label="State" value={patient.state} />
          <InfoRow label="Zipcode" value={patient.zip} />
          <InfoRow label="Location" value={patient.location} />
        </div>
      </ProfileSection>

      <ProfileSection title="Other Info">
        <div className={styles.infoCard}>
          <InfoRow label="Member ID" value={patient.memberId} />
          <InfoRow label="PCP" value={patient.pcp} />
          <InfoRow label="Health Plan" value={plan || patient.planCode} />
          <InfoRow label="Coverage" value={patient.coverageType} />
          <InfoRow label="Last Visit" value={patient.lastVisit} />
          <InfoRow label="Source" value={patient.source} />
        </div>
      </ProfileSection>
    </>
  );
}
