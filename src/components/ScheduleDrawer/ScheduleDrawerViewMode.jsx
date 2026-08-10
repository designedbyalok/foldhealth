import { Icon } from '../Icon/Icon';
import { Drawer } from '../Drawer/Drawer';
import { Avatar } from '../Avatar/Avatar';
import { ActionButton } from '../ActionButton/ActionButton';
import { Select } from '../Select/Select';
import { AppointmentTypePicker } from './AppointmentTypePicker';
import { DetailDropdown } from './DetailDropdown';
import { ProviderPicker } from './ProviderPicker';
import { DatePicker } from './DatePicker';
import { StaffInstructionIcon } from './ScheduleDrawerScreens';
import { getInitials, MODE_OPTIONS, LOCATION_OPTIONS, APPOINTMENT_STATUSES } from './scheduleDrawerConstants';
import styles from './ScheduleDrawer.module.css';

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
  const matchedType = appointmentTypes.find(t => t.name === ea.appointment_type_name);
  const apptTypeColor = matchedType?.color || (ea.appointment_type_name?.includes('Wellness') ? 'var(--status-warning)' : 'var(--primary-300)');
  const apptTypeForPicker = appointmentType || (ea.appointment_type_name ? { name: ea.appointment_type_name, color: matchedType?.color || apptTypeColor, id: matchedType?.id } : null);

  return (
    <Drawer title="Appointment Details" onClose={onClose} bodyClassName={styles.drawerBody}>
      <div className={styles.content} style={{ gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--neutral-50)', borderRadius: 8, padding: 8 }}>
          <div style={{ flex: 1 }}>
            <Select
              style={{ width: 120 }}
              options={APPOINTMENT_STATUSES.map(s => ({ value: s, label: s }))}
              value={apptStatus}
              onChange={handleStatusChange}
              disabled={isPastAppointment}
            />
          </div>
          <ActionButton icon="solar:paperclip-linear" size="L" tooltip="Attach" />
          <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
          {!showViewStaffInstructions && (
            <ActionButton size="L" tooltip="Add Staff Instructions" onClick={() => setShowViewStaffInstructions(true)}>
              <StaffInstructionIcon />
            </ActionButton>
          )}
          {!showViewStaffInstructions && <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />}
          <div style={{ position: 'relative' }} ref={moreMenuRef}>
            <ActionButton icon="solar:menu-dots-bold" size="L" tooltip="More" onClick={() => setShowMoreMenu(v => !v)} />
            {showMoreMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowMoreMenu(false)} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 9999, background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-100)', borderRadius: 8, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.12)', padding: 8, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button onClick={() => { showToast('Booking link copied!'); setShowMoreMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--neutral-400)', fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <Icon name="solar:link-linear" size={16} color="var(--neutral-300)" /> Send Booking Link
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); handleDeleteAppointment(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--status-error)', fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
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
                <ActionButton icon="solar:phone-linear" size="L" tooltip="Call" />
                <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                <ActionButton icon="solar:chat-round-line-linear" size="L" tooltip="Chat" />
                <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                <ActionButton icon="solar:menu-dots-bold" size="L" tooltip="More" />
              </div>
            </div>
            {ea.reason_for_visit && (
              <div className={styles.reasonField} style={{ pointerEvents: 'none' }}>
                <span className={styles.reasonLabel}>Reason for Visit</span>
                <div className={styles.reasonInput} style={{ background: 'var(--neutral-50)', minHeight: 32 }}>{ea.reason_for_visit}</div>
              </div>
            )}
            <div className={styles.patientInfoGrid}>
              <div className={styles.patientInfoRow}>
                <span className={styles.patientInfoLabel} style={{ fontSize: 14, fontWeight: 500 }}>Patient Location</span>
                <span className={styles.patientInfoValue} style={{ fontSize: 14 }}>{ea.location || 'New York'}</span>
              </div>
              <div className={styles.patientInfoRow}>
                <span className={styles.patientInfoLabel} style={{ fontSize: 14, fontWeight: 500 }}>Last Appointment</span>
                <span className={styles.patientInfoValue} style={{ fontSize: 14 }}>07-26-2023 with Katherine Moss <button className={styles.viewDetailsLink}>View Details</button></span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section} style={isPastAppointment ? { pointerEvents: 'none', opacity: 0.7 } : undefined}>
          <span className={styles.sectionLabel}>Appointment Details {isPastAppointment && <span style={{ fontSize: 11, color: 'var(--neutral-200)', fontWeight: 400 }}>(Past — read only)</span>}</span>
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
              <DetailDropdown value={location || ea.location} placeholder="Select Location" icon="solar:map-point-linear" options={LOCATION_OPTIONS.map(l => ({ label: l }))} onSelect={v => { setLocation(v); if (ea.id) updateAppointment(ea.id, { location: v }); }} />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Primary User</span>
              <ProviderPicker value={provider || ea.primary_user} onSelect={v => { setProvider(v); if (ea.id) updateAppointment(ea.id, { primary_user: v }); }} profileUsers={profileUsers} onAddSecondary={() => setSectionOpen('secondary', true)} />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Date</span>
              <DatePicker value={date || ea.date} onSelect={v => { setDate(v); if (ea.id) updateAppointment(ea.id, { date: v }); }} />
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Time</span>
              <span className={styles.detailValue}><Icon name="solar:clock-circle-linear" size={16} color="var(--neutral-300)" /> {ea.time_start || '—'} - {ea.time_end || '—'} ({timezoneLabel})</span>
            </div>
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
                dangerouslySetInnerHTML={{ __html: instructionDraft }}
                onInput={e => setInstructionDraft(e.currentTarget.innerHTML)}
              />
              <div className={styles.instructionToolbar}>
                <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
                <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
                <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:text-field-linear" size="S" tooltip="Heading" onClick={() => document.execCommand('formatBlock', false, 'h3')} />
                <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
                <div style={{ flex: 1 }} />
                <ActionButton icon="solar:close-linear" size="S" tooltip="Discard" state="error" onClick={() => { setInstructionDraft(ea.member_instruction || ''); setEditingInstruction(false); }} />
                <ActionButton icon="solar:check-read-linear" size="S" tooltip="Save" onClick={handleSaveInstruction} />
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingInstruction(true)}
              style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 4, padding: 8, fontSize: 14, color: ea.member_instruction ? 'var(--neutral-400)' : 'var(--neutral-200)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, background: 'var(--neutral-50)', cursor: 'pointer', minHeight: 36 }}
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
                  dangerouslySetInnerHTML={{ __html: staffInstructionDraft }}
                  onInput={e => setStaffInstructionDraft(e.currentTarget.innerHTML)}
                />
                <div className={styles.instructionToolbar}>
                  <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
                  <span className={styles.toolbarDivider} />
                  <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
                  <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
                  <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
                  <span className={styles.toolbarDivider} />
                  <ActionButton icon="solar:text-field-linear" size="S" tooltip="Heading" onClick={() => document.execCommand('formatBlock', false, 'h3')} />
                  <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
                  <div style={{ flex: 1 }} />
                  <ActionButton icon="solar:trash-bin-minimalistic-linear" size="S" tooltip="Remove" state="error" onClick={() => { setShowViewStaffInstructions(false); setStaffInstructionDraft(''); if (ea.id) updateAppointment(ea.id, { staff_instruction: '' }); }} />
                  <ActionButton icon="solar:close-linear" size="S" tooltip="Discard" state="error" onClick={() => { setStaffInstructionDraft(ea.staff_instruction || ''); setEditingStaffInstruction(false); }} />
                  <ActionButton icon="solar:check-read-linear" size="S" tooltip="Save" onClick={handleSaveStaffInstruction} />
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingStaffInstruction(true)}
                style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 4, padding: 8, fontSize: 14, color: ea.staff_instruction ? 'var(--neutral-400)' : 'var(--neutral-200)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, background: 'var(--neutral-50)', cursor: 'pointer', minHeight: 36 }}
              >
                {ea.staff_instruction || 'Click to add staff instructions...'}
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
