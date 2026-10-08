import { useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { cisPdfFile, downloadCisSchedule } from './downloadCisSchedule';
import { fmtDate, seriesStartDate } from './cisStatusConfig';

/**
 * CIS-CMB10 more-actions (⋯) menu: schedule a vaccine appointment, download
 * the schedule or the immunization record PDF, or save the record to the
 * care gap's Documents as evidence (a non-standard note; nothing is billed).
 *
 * @param {object}   props
 * @param {object}   props.member
 * @param {object}   props.result           – evaluateCis() output
 * @param {object}   [props.notes]          – cis_dose_notes by 'dtap:1'
 * @param {function} [props.onSchedule]     – () => void; hides the option when absent
 * @param {function} [props.onSaveEvidence] – ({ file, caption }) => void; hides the option when absent
 * @param {'S'|'L'}  [props.size='S']
 */
export function CisMoreMenu({ member, result, notes, onSchedule, onSaveEvidence, size = 'S' }) {
  const [rect, setRect] = useState(null);
  // Nothing left to book once every dose of every vaccine has been given.
  const allGiven = result.antigens.every(a => a.rows.every(r => r.kind === 'given'));
  const items = [
    onSchedule && {
      key: 'schedule-appt', icon: 'solar:calendar-add-linear', label: 'Schedule appointment',
      disabled: allGiven, hint: allGiven ? 'Every dose has been given' : undefined,
    },
    { key: 'schedule', icon: 'solar:download-minimalistic-linear', label: 'Download schedule' },
    { key: 'record', icon: 'solar:download-minimalistic-linear', label: 'Download immunization record' },
    onSaveEvidence && { key: 'evidence', icon: 'solar:document-add-linear', label: 'Save record to gap documents' },
  ].filter(Boolean);
  const params = { member, result, notes, startedOn: seriesStartDate(result) };
  const select = async (key) => {
    setRect(null);
    if (key === 'schedule-appt') onSchedule();
    else if (key === 'evidence') {
      const file = await cisPdfFile({ ...params, mode: 'record', brand: 'astrana' });
      onSaveEvidence({ file, caption: `Immunization Record (CIS-CMB10) ${fmtDate(new Date())}` });
    // The immunization record carries Astrana's header and footer (their
    // team's preview); the schedule keeps the Trailhead report branding.
    } else downloadCisSchedule({ ...params, mode: key, brand: key === 'record' ? 'astrana' : 'trailhead' });
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
