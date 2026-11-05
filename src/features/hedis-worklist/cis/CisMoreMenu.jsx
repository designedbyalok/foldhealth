import { useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { cisRecordEvidence, downloadCisSchedule } from './downloadCisSchedule';
import { hasGivenDose, seriesStartDate } from './cisStatusConfig';

/**
 * CIS-CMB10 more-actions (⋯) menu: save the immunization record to the
 * gap's Documents, or download the schedule or the record PDF. Scheduling a
 * vaccine reminder is the Suggested Action; Sync to EHR is its own button.
 *
 * @param {object}   props
 * @param {object}   props.member
 * @param {object}   props.result           – evaluateCis() output
 * @param {object}   [props.notes]          – cis_dose_notes by 'dtap:1'
 * @param {function} [props.onSaveEvidence] – ({ file, caption, sync }) => void
 * @param {'sm'|'md'} [props.size='sm']
 */
export function CisMoreMenu({ member, result, notes, onSaveEvidence, size = 'sm' }) {
  const [rect, setRect] = useState(null);
  const hasDoses = hasGivenDose(result);
  const items = [
    {
      key: 'save',
      icon: 'solar:document-add-linear',
      label: 'Save to Document',
      disabled: !onSaveEvidence || !hasDoses,
      hint: hasDoses ? undefined : 'No doses on record yet',
    },
    { divider: true },
    { key: 'schedule', icon: 'solar:download-minimalistic-linear', label: 'Download Schedule' },
    { key: 'record', icon: 'solar:download-minimalistic-linear', label: 'Download Immunization Record' },
  ];
  const params = { member, result, notes, startedOn: seriesStartDate(result) };
  const select = async (key) => {
    setRect(null);
    if (key === 'save') {
      onSaveEvidence({ ...(await cisRecordEvidence({ member, result, notes })), sync: false });
      return;
    }
    // The immunization record carries Astrana's header and footer (their
    // team's preview); the schedule keeps the Trailhead report branding.
    downloadCisSchedule({ ...params, mode: key, brand: key === 'record' ? 'astrana' : 'trailhead' });
  };
  return (
    <>
      <ActionButton
        size={size}
        icon="solar:menu-dots-linear"
        tooltip="More actions"
        tooltipLeft
        onClick={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      />
      {rect && (
        <MenuPopover
          anchorRect={rect}
          items={items}
          onSelect={select}
          onClose={() => setRect(null)}
          ariaLabel="More actions"
          width={264}
        />
      )}
    </>
  );
}
