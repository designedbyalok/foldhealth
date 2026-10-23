import { useState } from 'react';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../components/Button/Button';
import { Select } from '../../../../../../components/Select/Select';
import { Input } from '../../../../../../components/Input/Input';
import { Switch } from '../../../../../../components/Switch/Switch';
import { RadioOptionGroup } from '../../../../../../components/RadioOptionGroup/RadioOptionGroup';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../../../store/useAppStore';
import { CHANNEL_OPTIONS, CONTACT_STATUS_OPTIONS, LITERACY_OPTIONS } from '../../../../data/patientPreferences';
import styles from './PatientPreferencesDrawer.module.css';

const NO_PREFERENCE = '';

/**
 * Edit the patient's contact preferences: channel per enrolled program,
 * language and interpreter need, health literacy, and whether each phone
 * number and email is valid. Saves to patient_preferences.
 *
 * `programCodes` are the patient's open enrollments; `contactPoints` the
 * merged list from mergeContactPoints; `profileLanguage` applies while the
 * preferred language is left empty.
 */
export function PatientPreferencesDrawer({ patientId, preferences, programCodes, contactPoints, profileLanguage, onClose }) {
  const savePatientPreferences = useAppStore(s => s.savePatientPreferences);
  const [channels, setChannels] = useState(preferences?.channelByProgram || {});
  const [language, setLanguage] = useState(preferences?.preferredLanguage || '');
  const [interpreter, setInterpreter] = useState(!!preferences?.needsInterpreter);
  const [literacy, setLiteracy] = useState(preferences?.healthLiteracy || 'unknown');
  const [points, setPoints] = useState(contactPoints);
  const [closing, setClosing] = useState(false);

  const setStatus = (i, status) => setPoints(list => list.map((p, j) => (
    j === i ? { ...p, status, checked_at: new Date().toISOString() } : p
  )));

  const save = async () => {
    const channelByProgram = Object.fromEntries(Object.entries(channels).filter(([, v]) => v));
    await savePatientPreferences(patientId, {
      channelByProgram,
      preferredLanguage: language.trim() || null,
      needsInterpreter: interpreter,
      healthLiteracy: literacy,
      contactPoints: points,
    });
    toast.success('Preferences saved');
    setClosing(true);
  };

  const channelOptions = [{ value: NO_PREFERENCE, label: 'No preference' }, ...CHANNEL_OPTIONS];

  return (
    <Drawer
      title="Contact Preferences"
      onClose={onClose}
      dismissed={closing}
      primaryAction={<Button variant="primary" size="L" onClick={save}>Save</Button>}
    >
      <div className={styles.body}>
        <section className={styles.section}>
          <span className={styles.sectionTitle}>Preferred channel per program</span>
          {programCodes.length === 0 && <span className={styles.muted}>Not enrolled in any program.</span>}
          {programCodes.map(code => (
            <div key={code} className={styles.row}>
              <span className={styles.rowLabel}>{code}</span>
              <div className={styles.control}>
                <Select
                  options={channelOptions}
                  value={channels[code] || NO_PREFERENCE}
                  onChange={v => setChannels(c => ({ ...c, [code]: v }))}
                  aria-label={`${code} preferred channel`}
                />
              </div>
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <span className={styles.sectionTitle}>Language</span>
          <Input
            label="Preferred language"
            placeholder={profileLanguage ? `Same as profile (${profileLanguage})` : 'e.g. Spanish'}
            value={language}
            onChange={e => setLanguage(e.target.value)}
          />
          <Switch checked={interpreter} onChange={() => setInterpreter(v => !v)} label="Needs an interpreter" />
        </section>

        <section className={styles.section}>
          <span className={styles.sectionTitle}>Health literacy</span>
          <RadioOptionGroup name="health-literacy" options={LITERACY_OPTIONS} value={literacy} onChange={setLiteracy} />
        </section>

        <section className={styles.section}>
          <span className={styles.sectionTitle}>Contact validity</span>
          {points.length === 0 && <span className={styles.muted}>No phone numbers or emails on the profile.</span>}
          {points.map((p, i) => (
            <div key={`${p.kind}:${p.value}`} className={styles.row}>
              <span className={styles.rowLabel}>{p.value}</span>
              <div className={styles.control}>
                <Select
                  options={CONTACT_STATUS_OPTIONS}
                  value={p.status || 'unverified'}
                  onChange={v => setStatus(i, v)}
                  aria-label={`${p.value} status`}
                />
              </div>
            </div>
          ))}
        </section>
      </div>
    </Drawer>
  );
}
