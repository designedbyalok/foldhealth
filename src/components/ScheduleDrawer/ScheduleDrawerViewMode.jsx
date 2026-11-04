import { useState } from 'react';
import { sanitizeRichText } from '../../lib/sanitizeHtml';
import { Icon } from '../Icon/Icon';
import { Drawer } from '../Drawer/Drawer';
import { Avatar } from '../Avatar/Avatar';
import { ActionButton } from '../ActionButton/ActionButton';
import { Select } from '../Select/Select';
import { AppointmentTypePicker } from './AppointmentTypePicker';
import { DetailDropdown } from './DetailDropdown';
import { ProviderPicker } from './ProviderPicker';
import { DatePicker } from './DatePicker';
import { ScheduleDrawerTimePicker } from './ScheduleDrawerTimePicker';
import { StaffInstructionIcon } from './ScheduleDrawerScreens';
import { getInitials, MODE_OPTIONS, APPOINTMENT_STATUSES } from './scheduleDrawerConstants';
import { useLocationOptions } from './useLocationOptions';
import { usePatientCallButton } from '../../hooks/usePatientCallButton';
import styles from './ScheduleDrawer.module.css';

// "8:30 am" → "9:00 am", matching the picker's 30-minute slots.
function addThirtyMinutes(time) {
  const [h, m, p] = String(time || '').match(/(\d+):(\d+)\s*(am|pm)/i)?.slice(1) || [];
  if (!h) return null;
  const mins = (parseInt(m, 10) || 0) + 30;
  return mins >= 60
    ? `${(parseInt(h, 10) || 0) + 1}:${String(mins - 60).padStart(2, '0')} ${p}`
    : `${h}:${String(mins).padStart(2, '0')} ${p}`;
}

export function ScheduleDrawerViewMode({
  onClose,
  existingAppointment: ea,
  appointmentTypes,
  appointmentType,
  setAppointmentType,
  updateAppointment,
  apptStatus,
  handleStatusChange,
  isPastAppointment,
  showViewStaffInstructions,
  setShowViewStaffInstructions,
  showMoreMenu,
  setShowMoreMenu,
  moreMenuRef,
  showToast,
  handleDeleteAppointment,
  mode,
  setMode,
  location,
  setLocation,
  provider,
  setProvider,
  profileUsers,
  setSectionOpen,
  date,
  setDate,
  timezoneLabel,
  time,
  setTime,
  openSections = [],
  customTime,
  setCustomTime,
  timeBtnRef,
  inline = false,
  editingInstruction,
  setEditingInstruction,
  instructionDraft,
  setInstructionDraft,
  handleSaveInstruction,
  editingStaffInstruction,
  setEditingStaffInstruction,
  staffInstructionDraft,
  setStaffInstructionDraft,
  handleSaveStaffInstruction,
}) {
  const locationOptions = useLocationOptions();
  const matchedType = appointmentTypes.find(t => t.name === ea.appointment_type_name);
  const apptTypeColor = matchedType?.color || (ea.appointment_type_name?.includes('Wellness') ? 'var(--status-warning)' : 'var(--primary-300)');
  const apptTypeForPicker = appointmentType || (ea.appointment_type_name ? { name: ea.appointment_type_name, color: matchedType?.color || apptTypeColor, id: matchedType?.id } : null);
  const { callBtnRef, openCall } = usePatientCallButton(ea?.patient_id);
  const [reasonDraft, setReasonDraft] = useState(ea.reason_for_visit || '');

  const body = (
    <>
      <div className={styles.content} style={{ gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--neutral-50)', borderRadius: 8, padding: 8 }}>
          <div style={{ flex: 1 }}>
            <Select
              style={{ width: 120 }}
              options={APPOINTMENT_STATUSES.map(s => ({ value: s, label: s }))}
              value={apptStatus}
              onValueChange={handleStatusChange}
              disabled={isPastAppointment}
            />
          </div>
          <ActionButton icon="solar:paperclip-linear" tooltip="Attach" />
          <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          {!showViewStaffInstructions && (
            <ActionButton tooltip="Add Staff Instructions" onClick={() => setShowViewStaffInstructions(true)}>
              <StaffInstructionIcon />
            </ActionButton>
          )}
          {!showViewStaffInstructions && <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />}
          <div style={{ position: 'relative' }} ref={moreMenuRef}>
            <ActionButton icon="solar:menu-dots-bold" tooltip="More" onClick={() => setShowMoreMenu(v => !v)} />
            {showMoreMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowMoreMenu(false)} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 9999, background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-100)', borderRadius: 8, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.12)', padding: 8, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button onClick={() => { showToast('Booking link copied!'); setShowMoreMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', fontSize: 'var(--font-base)', color: 'var(--neutral-400)', fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <Icon name="solar:link-linear" size={16} color="var(--neutral-300)" /> Send Booking Link
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); handleDeleteAppointment(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', fontSize: 'var(--font-base)', color: 'var(--status-error)', fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <Icon name="solar:trash-bin-minimalistic-linear" size={16} color="var(--status-error)" /> Delete Appointment
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Patient Details</span>
          <div className={styles.patientCard}>
            <div className={styles.patientCardHeader}>
              <Avatar variant="patient" initials={getInitials(ea.patient_name).toUpperCase()} />
              <div className={styles.patientCardInfo}>
                <div className={styles.patientCardName}>{ea.patient_name || 'Unknown'}</div>
                <div className={styles.patientCardMeta}>
                  <span className={styles.rafScore}>RAF Score: 3.5</span>{' '}
                  <span className={styles.rafDelta}>+0.5 <Icon name="solar:arrow-up-linear" size={10} color="var(--status-success-bright)" /></span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <ActionButton
                  ref={callBtnRef}
                  icon="solar:phone-linear"
                  tooltip="Call patient"
                  onClick={openCall}
                />
                <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                <ActionButton icon="solar:chat-round-line-linear" tooltip="Chat" />
                <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                <ActionButton icon="solar:menu-dots-bold" tooltip="More" />
              </div>
            </div>
            {/* Same field as the booking form; edits save on blur. Past
                appointments are read-only like the rest of the details. */}
            <div className={styles.reasonField}>
              <label className={styles.reasonLabel} htmlFor="view-reason-for-visit">Reason for Visit</label>
              <input
                id="view-reason-for-visit"
                className={styles.reasonInput}
                placeholder="Enter Reason for Visit"
                value={reasonDraft}
                readOnly={isPastAppointment}
                onChange={e => setReasonDraft(e.target.value)}
                onBlur={() => {
                  const next = reasonDraft.trim();
                  if (ea.id && next !== (ea.reason_for_visit || '')) updateAppointment(ea.id, { reason_for_visit: next });
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
            </div>
            <div className={styles.patientInfoGrid}>
              <div className={styles.patientInfoRow}>
                <span className={styles.patientInfoLabel} style={{ fontSize: 'var(--font-base)', fontWeight: 500 }}>Patient Location</span>
                <span className={styles.patientInfoValue} style={{ fontSize: 'var(--font-base)' }}>{ea.location || 'New York'}</span>
              </div>
              <div className={styles.patientInfoRow}>
                <span className={styles.patientInfoLabel} style={{ fontSize: 'var(--font-base)', fontWeight: 500 }}>Last Appointment</span>
                <span className={styles.patientInfoValue} style={{ fontSize: 'var(--font-base)' }}>07-26-2023 with Katherine Moss <button className={styles.viewDetailsLink}>View Details</button></span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section} style={isPastAppointment ? { pointerEvents: 'none', opacity: 0.7 } : undefined}>
          <span className={styles.sectionLabel}>Appointment Details {isPastAppointment && <span style={{ fontSize: 'var(--font-xs)', color: 'var(--neutral-200)', fontWeight: 400 }}>(Past: read only)</span>}</span>
          <div className={styles.detailsCard}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Appointment Type</span>
              <AppointmentTypePicker value={apptTypeForPicker} onSelect={(v) => { setAppointmentType(v); if (v && ea.id) updateAppointment(ea.id, { appointment_type_name: v.name, appointment_type_id: v.id || null }); }} appointmentTypes={appointmentTypes} />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Mode of Appointment</span>
              <DetailDropdown value={mode || ea.mode} placeholder="Select Mode" icon={mode === 'Virtual' || ea.mode === 'Virtual' ? 'solar:monitor-linear' : 'solar:buildings-linear'} options={MODE_OPTIONS.map(m => ({ label: m.label, icon: m.icon }))} onSelect={v => { setMode(v); if (ea.id) updateAppointment(ea.id, { mode: v }); }} renderItem={(opt) => <><Icon name={opt.icon} size={16} color="var(--neutral-300)" /> {opt.label}</>} />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Location</span>
              <DetailDropdown value={location || ea.location} placeholder="Select Location" icon="solar:map-point-linear" options={locationOptions.map(l => ({ label: l }))} onSelect={v => { setLocation(v); if (ea.id) updateAppointment(ea.id, { location: v }); }} />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Primary User</span>
              <ProviderPicker value={provider || ea.primary_user} onSelect={(v, p) => { setProvider(v, p); if (ea.id) updateAppointment(ea.id, { primary_user: v, primary_user_id: p?.id || null }); }} profileUsers={profileUsers} onAddSecondary={() => setSectionOpen('secondary', true)} />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Date</span>
              <DatePicker value={date || ea.date} onSelect={v => { setDate(v); if (ea.id) updateAppointment(ea.id, { date: v }); }} />
            </div>
            {/* Same slot picker as the booking form; a pick saves the start and
                the 30-minute end back to the appointment. */}
            <ScheduleDrawerTimePicker
              time={time || ea.time_start || ''}
              setTime={(v) => {
                setTime?.(v);
                if (ea.id) updateAppointment(ea.id, { time_start: v, time_end: addThirtyMinutes(v) });
              }}
              isSectionOpen={(key) => openSections.includes(key)}
              setSectionOpen={setSectionOpen}
              customTime={customTime}
              setCustomTime={setCustomTime}
              timeBtnRef={timeBtnRef}
              timezoneLabel={timezoneLabel}
            />
          </div>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Member Instruction</span>
          {editingInstruction ? (
            <div className={styles.instructionEditor}>
              <div
                className={styles.instructionEditable}
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(instructionDraft) }}
                onInput={e => setInstructionDraft(e.currentTarget.innerHTML)}
              />
              <div className={styles.instructionToolbar}>
                <ActionButton icon="solar:paperclip-linear" size="sm" tooltip="Attach" />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:text-bold-linear" size="sm" tooltip="Bold" onClick={() => document.execCommand('bold')} />
                <ActionButton icon="solar:text-italic-linear" size="sm" tooltip="Italic" onClick={() => document.execCommand('italic')} />
                <ActionButton icon="solar:text-underline-linear" size="sm" tooltip="Underline" onClick={() => document.execCommand('underline')} />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:text-field-linear" size="sm" tooltip="Heading" onClick={() => document.execCommand('formatBlock', false, 'h3')} />
                <ActionButton icon="solar:list-linear" size="sm" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
                <div style={{ flex: 1 }} />
                <ActionButton icon="solar:close-linear" size="sm" tooltip="Discard" tone="danger" onClick={() => { setInstructionDraft(ea.member_instruction || ''); setEditingInstruction(false); }} />
                <ActionButton icon="solar:check-read-linear" size="sm" tooltip="Save" onClick={handleSaveInstruction} />
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingInstruction(true)}
              style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 4, padding: 8, fontSize: 'var(--font-base)', color: ea.member_instruction ? 'var(--neutral-400)' : 'var(--neutral-200)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, background: 'var(--neutral-50)', cursor: 'pointer', minHeight: 36 }}
            >
              {ea.member_instruction || 'Click to add instructions...'}
            </div>
          )}
        </div>

        {showViewStaffInstructions && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Staff Instructions</span>
            {editingStaffInstruction ? (
              <div className={styles.instructionEditor}>
                <div
                  className={styles.instructionEditable}
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(staffInstructionDraft) }}
                  onInput={e => setStaffInstructionDraft(e.currentTarget.innerHTML)}
                />
                <div className={styles.instructionToolbar}>
                  <ActionButton icon="solar:paperclip-linear" size="sm" tooltip="Attach" />
                  <span className={styles.toolbarDivider} />
                  <ActionButton icon="solar:text-bold-linear" size="sm" tooltip="Bold" onClick={() => document.execCommand('bold')} />
                  <ActionButton icon="solar:text-italic-linear" size="sm" tooltip="Italic" onClick={() => document.execCommand('italic')} />
                  <ActionButton icon="solar:text-underline-linear" size="sm" tooltip="Underline" onClick={() => document.execCommand('underline')} />
                  <span className={styles.toolbarDivider} />
                  <ActionButton icon="solar:text-field-linear" size="sm" tooltip="Heading" onClick={() => document.execCommand('formatBlock', false, 'h3')} />
                  <ActionButton icon="solar:list-linear" size="sm" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
                  <div style={{ flex: 1 }} />
                  <ActionButton icon="solar:trash-bin-minimalistic-linear" size="sm" tooltip="Remove" tone="danger" onClick={() => { setShowViewStaffInstructions(false); setStaffInstructionDraft(''); if (ea.id) updateAppointment(ea.id, { staff_instruction: '' }); }} />
                  <ActionButton icon="solar:close-linear" size="sm" tooltip="Discard" tone="danger" onClick={() => { setStaffInstructionDraft(ea.staff_instruction || ''); setEditingStaffInstruction(false); }} />
                  <ActionButton icon="solar:check-read-linear" size="sm" tooltip="Save" onClick={handleSaveStaffInstruction} />
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingStaffInstruction(true)}
                style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 4, padding: 8, fontSize: 'var(--font-base)', color: ea.staff_instruction ? 'var(--neutral-400)' : 'var(--neutral-200)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, background: 'var(--neutral-50)', cursor: 'pointer', minHeight: 36 }}
              >
                {ea.staff_instruction || 'Click to add staff instructions...'}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
  // Inline: the host (e.g. the Care Gap drawer's left pane) supplies the
  // frame and title; otherwise this is its own Appointment Details drawer.
  if (inline) return body;
  return (
    <Drawer title="Appointment Details" onClose={onClose} bodyClassName={styles.drawerBody}>
      {body}
    </Drawer>
  );
}
