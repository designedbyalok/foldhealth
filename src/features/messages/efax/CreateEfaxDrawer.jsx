import { useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Select } from '../../../components/Select/Select';
import { RadioOptionGroup } from '../../../components/RadioOptionGroup/RadioOptionGroup';
import { EFAX_DOCUMENTS, EFAX_SCENARIOS, EFAX_SENDERS, buildFax } from './efaxData';
import styles from './Efax.module.css';

const SCENARIO_OPTIONS = Object.entries(EFAX_SCENARIOS).map(([value, s]) => ({ value, label: s.label, hint: s.hint }));
const SENDER_OPTIONS = EFAX_SENDERS.map(s => ({ value: s.name, label: s.name }));
const DOCUMENT_OPTIONS = EFAX_DOCUMENTS.map(d => ({ value: d.value, label: d.value }));

/**
 * Receives a test fax about any patient, read as a strong match, one that
 * needs review, or no match, so each state of the match card can be shown.
 */
export function CreateEfaxDrawer({ patients, patientOptions, onCreate, onClose }) {
  const [patientId, setPatientId] = useState('');
  const [scenario, setScenario] = useState('high');
  const [sender, setSender] = useState(EFAX_SENDERS[0].name);
  const [documentType, setDocumentType] = useState('Referral');

  const create = () => {
    const patient = patients.find(p => String(p.id) === patientId);
    if (!patient) return;
    onCreate(buildFax({ patient, scenario, sender: EFAX_SENDERS.find(s => s.name === sender), documentType }));
  };

  return (
    <Drawer
      title="Create Test eFax"
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button disabled={!patientId} onClick={create}>Create</Button>
          <span className={styles.headerDivider} />
        </>
      )}
    >
      <div className={styles.form}>
        <Select
          label="Patient"
          required
          searchable
          placeholder="Search patient by name"
          searchPlaceholder="Search patients"
          options={patientOptions}
          value={patientId}
          onValueChange={setPatientId}
        />
        <RadioOptionGroup
          label="How the fax reads"
          variant="card"
          options={SCENARIO_OPTIONS}
          value={scenario}
          onChange={setScenario}
        />
        <Select label="Sent From" options={SENDER_OPTIONS} value={sender} onValueChange={setSender} />
        <Select label="Document" options={DOCUMENT_OPTIONS} value={documentType} onValueChange={setDocumentType} />
      </div>
    </Drawer>
  );
}
