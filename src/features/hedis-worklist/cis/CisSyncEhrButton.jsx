import { useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { cisRecordEvidence } from './downloadCisSchedule';
import { hasGivenDose } from './cisStatusConfig';

/**
 * Sync to EHR: the immunization record PDF (Astrana branding) is synced to
 * the patient's EHR and kept in the care gap's Documents. A non-standard
 * note; nothing is billed. Disabled until a dose is on record. Saving to
 * Documents only lives in the ⋯ menu.
 *
 * @param {object}   props
 * @param {object}   props.member
 * @param {object}   props.result         – evaluateCis() output
 * @param {object}   [props.notes]
 * @param {function} props.onSaveEvidence – ({ file, caption, sync }) => void
 * @param {'sm'|'md'} [props.size='sm']
 */
export function CisSyncEhrButton({ member, result, notes, onSaveEvidence, size = 'sm' }) {
  const [busy, setBusy] = useState(false);
  const hasDoses = hasGivenDose(result);
  const sync = async () => {
    setBusy(true);
    try {
      onSaveEvidence({ ...(await cisRecordEvidence({ member, result, notes })), sync: true });
    } finally {
      setBusy(false);
    }
  };
  const disabled = !onSaveEvidence || !hasDoses || busy;
  return (
    <ActionButton
      size={size}
      icon="solar:refresh-circle-linear"
      tooltip={hasDoses ? 'Sync to EHR' : 'No doses on record yet'}
      tooltipLeft
      disabled={disabled}
      onClick={disabled ? undefined : sync}
    />
  );
}
