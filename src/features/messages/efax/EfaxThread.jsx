import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { ChatBubble } from '../../../components/ChatBubble/ChatBubble';
import { ItemRow } from '../../../components/ItemRow/ItemRow';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { AiTooltipLabel } from '../../../components/Tooltip/AiTooltipLabel';
import { SuggestedPatients } from '../../../components/SuggestedPatients/SuggestedPatients';
import { initialsOf } from '../../../components/SuggestedPatients/patientMatch';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import listStyles from '../MessagesView.module.css';
import commsStyles from '../comms/Comms.module.css';
import { dayLabel } from '../comms/commsUtils';
import { patientSnapshot, suggestionsFor } from './efaxData';
import { PatientContextDrawer } from './PatientContextDrawer';
import { DocPreviewDrawer } from '../../hcc/DocPreviewDrawer';
import styles from './Efax.module.css';

const FAX_PDF = '/charts/progress-note.pdf';
const timeOnly = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
// Suggestions shown in the message; the rest are behind "View N More".
const SHOWN = 2;

/**
 * One inbound fax (Figma 2932:39952): the sender's note, the file, and the
 * patient it's about. Until a patient is added, the row reads "Add Patient
 * Context" (+ opens Patient Context for eFax) and the AI's picks hang under
 * the message as "Suggested Members", each added with one click. Once added,
 * the patient shows as a row (View Profile | Change Patient), marked when
 * the OCR suggested them.
 */
export function EfaxThread({ fax, reading, patients, me }) {
  const updateEfax = useAppStore(s => s.updateEfax);
  const navigateToPatient = useAppStore(s => s.navigateToPatient);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!fax.read) updateEfax(fax.id, { read: true });
  }, [fax.id, fax.read, updateEfax]);

  const suggestions = useMemo(() => suggestionsFor(fax, patients), [fax, patients]);

  // The received page: a bundled sample PDF until faxes carry real files.
  const pdf = FAX_PDF;
  const [previewing, setPreviewing] = useState(false);
  const viewFile = () => setPreviewing(true);
  const download = () => {
    const a = document.createElement('a');
    a.href = pdf;
    a.download = fax.documentName;
    a.click();
  };

  // `who` is a patient id (from the drawer) or a patient snapshot (a suggestion).
  const link = (who, viaOcr, { linkReferral = false } = {}) => {
    const p = typeof who === 'object'
      ? who
      : patientSnapshot(patients.find(x => String(x.id) === String(who)))
        || suggestions.find(s => String(s.patient.id) === String(who))?.patient;
    if (!p) return;
    updateEfax(fax.id, {
      linked: { patientId: p.id, name: p.name, by: me?.name || 'You', at: new Date().toISOString(), viaOcr, linkReferral },
    });
    setPicking(false);
    toast.success('Patient context added successfully');
  };

  const linked = fax.linked;
  const linkedWhen = linked && `${dayLabel(linked.at)}, ${timeOnly(linked.at)}`;

  return (
    <div className={listStyles.chatPanel}>
      <div className={listStyles.chatHeader}>
        <span className={`${styles.faxAvatar} ${styles.faxAvatarL}`}>
          <Icon name="solar:printer-linear" size={20} color="currentColor" />
        </span>
        <div className={listStyles.chatHeaderInfo}>
          <div className={listStyles.chatHeaderName}>{fax.senderName}</div>
          <div className={listStyles.chatHeaderMeta}>{fax.senderFax}</div>
        </div>
        <div className={listStyles.chatHeaderActions}>
          <ActionButton icon="solar:eye-linear" size="sm" tooltip="View File" onClick={viewFile} />
        </div>
      </div>

      <div className={commsStyles.thread}>
        <div className={commsStyles.daySep}><span>{dayLabel(fax.receivedAt)}</span></div>
        <ChatBubble
          side="left"
          name={fax.senderName}
          initials={initialsOf(fax.senderName)}
          avatarVariant="provider"
          flush
          time={`${fax.pages} pages • ${timeOnly(fax.receivedAt)}`}
        >
          <div className={styles.faxBubble}>
            <div className={[styles.faxBody, linked ? '' : styles.faxBodyRuled].join(' ')}>
              {fax.note && <span className={styles.faxNote}>{fax.note}</span>}
              <ItemRow
                tone="primary"
                leading={<Icon name="custom:pdf-file" size={20} color="var(--primary-300)" />}
                label={fax.documentName}
                actions={[
                  { key: 'view', icon: 'solar:eye-linear', tooltip: 'View File', onClick: viewFile },
                  { key: 'download', icon: 'solar:download-minimalistic-linear', tooltip: 'Download', onClick: download },
                ]}
              />
              {linked ? (
                <ItemRow
                  leading={<Avatar variant="patient" size="S" initials={initialsOf(linked.name)} />}
                  label={linked.name}
                  tone="muted"
                  after={linked.viaOcr && (
                    <Tooltip
                      variant="card"
                      label={(
                        <AiTooltipLabel title="Suggested by Unity">
                          Unity matched this patient from the eFax.
                          <span className={styles.addedLine}>Added by {linked.by}, {linkedWhen}.</span>
                        </AiTooltipLabel>
                      )}
                    >
                      <span className={styles.ocrTag} aria-label="Patient suggested by Unity">
                        <Icon name="custom:ai" size={14} />
                      </span>
                    </Tooltip>
                  )}
                  actions={[
                    { key: 'profile', icon: 'solar:eye-linear', tooltip: 'View Profile', onClick: () => navigateToPatient(linked.patientId) },
                    { key: 'change', icon: 'solar:refresh-linear', tooltip: 'Change Patient', onClick: () => setPicking(true) },
                  ]}
                />
              ) : (
                <ItemRow
                  leading={<Avatar type="icon" variant="others" iconName="solar:user-linear" size="S" />}
                  label="Add Patient Context"
                  tone="muted"
                  actions={[{ key: 'add', icon: 'custom:add', tooltip: 'Add Patient Context', onClick: () => setPicking(true) }]}
                />
              )}
            </div>

            {!linked && (
              <SuggestedPatients
                loading={reading}
                items={suggestions.slice(0, SHOWN)}
                moreCount={Math.max(0, suggestions.length - SHOWN)}
                onMore={() => setPicking(true)}
                onAdd={it => link(it.patient, true)}
                emptyHint="Unity AI read the fax but couldn't match it to a patient."
              />
            )}
          </div>
        </ChatBubble>
      </div>

      {previewing && (
        <DocPreviewDrawer
          charts={[{ id: fax.id, n: fax.documentName, pdf, ext: 'pdf' }]}
          showStatus={false}
          onClose={() => setPreviewing(false)}
        />
      )}

      {picking && (
        <PatientContextDrawer
          suggestions={suggestions}
          patients={patients}
          current={linked && { ...linked, when: linkedWhen }}
          onSave={link}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
