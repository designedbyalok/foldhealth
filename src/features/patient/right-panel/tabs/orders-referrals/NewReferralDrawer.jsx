import { useEffect, useState } from 'react';
import { Drawer } from '../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../components/Button/Button';
import { useAppStore } from '../../../../../store/useAppStore';
import { CareGapReferralForm } from '../../../../hedis-worklist/CareGapReferralForm';
import { useCareGapReferralForm, REFERRAL_STATUS, CUSTOM_SENDER, isEmail, providerContact } from '../../../../hedis-worklist/useCareGapReferralForm';
import { useReferralDirectory } from '../../../../hedis-worklist/useReferralDirectory';
import { draftReferralEmail } from '../../../../hedis-worklist/referralEmail';
import { DOC_TYPES } from '../../../../hcc/data/chartDocs';
import { usePatientDocuments } from '../documents/usePatientDocuments';
import styles from './OrderForms.module.css';

const todayMmDdYyyy = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
const initialsOf = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

/**
 * New Order > Referral: the same Send Referral form as the Care Gap drawer
 * (Figma 19:57416), eFax or Email. Saves to patient_referrals as Draft or
 * Signed & Referred.
 */
export function NewReferralDrawer({ patient, patientId, onClose }) {
  const createPatientReferral = useAppStore(s => s.createPatientReferral);
  const addProgramDocument = useAppStore(s => s.addProgramDocument);
  const currentActorName = useAppStore(s => s.currentActorName);
  const showToast = useAppStore(s => s.showToast);
  const { providers, senderLines, meProvider, emailSignature, senderDefaults } = useReferralDirectory();
  const { documents } = usePatientDocuments(patient);
  const form = useCareGapReferralForm();
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Pick up the default sender lines once the directory has loaded.
  const defaultsKey = JSON.stringify(senderDefaults());
  useEffect(() => { form.reset(JSON.parse(defaultsKey)); }, [defaultsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = form.values;
  const isEmailChannel = v.channel === 'email';
  const provider = providers.find(p => p.id === v.providerId);
  const contact = providerContact(provider, v.channel);
  const canSaveDraft = !!(v.providerId || v.reason.trim() || v.emailSubject.trim() || v.emailBody.trim() || v.files.length || v.docs.length);
  const canSend = !!(
    contact
    // Email states its purpose in the subject / body instead of a reason.
    && (isEmailChannel || v.reason.trim())
    && (v.files.length || v.docs.length)
    && (v.senderId === CUSTOM_SENDER ? isEmail(v.customSender) : v.senderId)
    && (!isEmailChannel || (v.emailSubject.trim() && v.emailBody.trim()))
  );

  const uploadDocument = ({ file, caption, docType }) => {
    if (!patient?.id || !file) return null;
    const now = new Date();
    const id = `pdoc-${now.getTime()}`;
    addProgramDocument({
      id,
      programCode: null,
      patientId: String(patient.id),
      name: caption,
      type: docType,
      sizeBytes: file.size,
      updatedBy: currentActorName(),
      updatedDate: todayMmDdYyyy(now),
      createdAt: now.toISOString(),
      ext: (/\.([a-z0-9]+)$/i.exec(file.name) || [])[1]?.toLowerCase() || null,
    }, file);
    return { id, name: caption, type: docType, addedAt: now.toISOString() };
  };

  const generateEmail = async () => {
    if (!provider) { showToast('Pick who to refer to first'); return; }
    setGenerating(true);
    const draft = await draftReferralEmail({
      patientName: patient?.name,
      patientAge: patient?.age,
      patientSex: patient?.gender,
      providerName: provider.name,
      providerSpecialty: provider.specialty,
      reason: v.reason.trim() || v.emailBody.trim(),
      attachments: [...v.docs.map(d => d.name), ...v.files.map(f => f.name)],
      senderName: meProvider?.name,
    });
    setGenerating(false);
    form.set('emailSubject')(draft.subject);
    form.set('emailBody')(draft.body);
    showToast(draft.source === 'ai' ? 'Email drafted with UnityAI' : 'UnityAI is unavailable, drafted from the referral details');
  };

  const save = async (status) => {
    if (status === REFERRAL_STATUS.draft ? !canSaveDraft : !canSend) return;
    setSaving(true);
    const ok = await createPatientReferral(patientId, {
      status,
      providerName: provider?.name || '',
      providerSpecialty: provider?.specialty || '',
      referredBySpecialty: meProvider?.specialty || '',
      reason: isEmailChannel ? v.emailSubject.trim() : v.reason.trim(),
      note: !isEmailChannel && v.noteOpen ? v.note.trim() : '',
      files: v.files,
      docs: v.docs.map(d => ({ name: d.name, type: d.type || '', url: d.url || '', documentId: d.documentId || d.id })),
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Drawer
      title="Send Referral"
      onClose={onClose}
      noCloseDivider
      headerRight={(
        <>
          <Button variant="outline" disabled={saving || !canSaveDraft} onClick={() => save(REFERRAL_STATUS.draft)}>Save as Draft</Button>
          <Button disabled={saving || !canSend} onClick={() => save(REFERRAL_STATUS.referred)}>Sign &amp; Refer</Button>
          <span className={styles.headerDivider} aria-hidden="true" />
        </>
      )}
    >
      <CareGapReferralForm
        form={form}
        providers={providers}
        senderLines={senderLines}
        patientDocuments={documents.map(d => ({ id: d.id, name: d.name, type: d.type, addedAt: d.createdAt, url: d.fileUrl }))}
        docTypes={DOC_TYPES}
        onUploadDocument={uploadDocument}
        onGenerateEmail={generateEmail}
        generatingEmail={generating}
        emailSignature={emailSignature}
        ccMember={patient && { id: patient.id, name: patient.name, initials: initialsOf(patient.name) }}
      />
    </Drawer>
  );
}
