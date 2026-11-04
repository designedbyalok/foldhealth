import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../components/Button/Button';
import { Select } from '../../../../../../components/Select/Select';
import { DatePicker } from '../../../../../../components/DatePicker/DatePicker';
import { useAppStore } from '../../../../../../store/useAppStore';
import { SNP_TRIGGER_TYPES } from '../../../../data/snpTriggerTypes';
import styles from './CreateSnpProgramDrawer.module.css';

const MEMBER_SLICES = ['patients', 'snpWorklistMembers', 'hccMembers', 'awvMembers', 'cmpMembers', 'ccmWorklistMembers', 'hedisMembers', 'allPatients'];
const TRIGGER_OPTIONS = SNP_TRIGGER_TYPES.map(t => ({ value: t, label: t }));

// The member's ids as "Member ID - IPA", one per worklist row that has one.
function useMemberInfoOptions(patientId) {
  const slices = useAppStore(useShallow(s => MEMBER_SLICES.map(k => s[k])));
  return useMemo(() => {
    const seen = new Map();
    for (const rows of slices) {
      for (const m of rows || []) {
        if (!m || (m.id !== patientId && String(m.memberId) !== String(patientId) && m.patientId !== patientId)) continue;
        const id = String(m.memberId || m.id || '').replace(/^#/, '');
        if (!id) continue;
        const label = m.ipa ? `${id} - ${m.ipa}` : id;
        if (!seen.has(label)) seen.set(label, { value: label, label });
      }
    }
    return [...seen.values()];
  }, [patientId, slices]);
}

/**
 * Create SNP Program: which of the member's plan ids the enrollment is for,
 * what triggered it and when. Every field is required; Create enrolls the
 * member and the trigger shows on the program's Snapshot.
 *
 * @param {object}   props
 * @param {string}   props.patientId
 * @param {({ memberInfo, triggerType, triggerDate }) => void} props.onCreate
 * @param {function} props.onClose
 */
export function CreateSnpProgramDrawer({ patientId, onCreate, onClose }) {
  const memberOptions = useMemberInfoOptions(patientId);
  const [memberInfo, setMemberInfo] = useState(() => memberOptions[0]?.value || '');
  const [triggerType, setTriggerType] = useState('');
  const [triggerDate, setTriggerDate] = useState('');
  const member = memberInfo || memberOptions[0]?.value || '';
  const ready = !!member && !!triggerType && !!triggerDate;

  return (
    <Drawer
      title="Create SNP Program"
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!ready} onClick={() => onCreate({ memberInfo: member, triggerType, triggerDate })}>Create</Button>
          <span className={styles.headerDivider} />
        </>
      )}
    >
      <div className={styles.body}>
        <Select
          label="Member Info"
          required
          portal
          placeholder="Select Member Info"
          options={memberOptions}
          value={member}
          onValueChange={setMemberInfo}
          emptyText="No member ids found"
        />
        <Select
          label="Trigger Type"
          required
          portal
          searchable
          placeholder="Select Trigger Type"
          options={TRIGGER_OPTIONS}
          value={triggerType}
          onValueChange={setTriggerType}
        />
        <DatePicker label="Trigger Date" required value={triggerDate} onSelect={setTriggerDate} />
      </div>
    </Drawer>
  );
}
