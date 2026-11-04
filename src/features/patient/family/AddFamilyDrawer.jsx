import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { Link } from '../../../components/Link/Link';
import { Badge } from '../../../components/Badge/Badge';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import { InfoBar } from '../../../components/InfoBar/InfoBar';
import { RingEmptyState } from '../../../components/RingEmptyState/RingEmptyState';
import { UploadDropField } from '../../../components/UploadDropField/UploadDropField';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { AddIconMinimalist } from '../../../components/Icon/AddIconMinimalist';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { PersonOption } from '../../messages/comms/PersonOption';
import { personMeta } from '../../messages/comms/sendTo';
import { categoryOf } from '../right-panel/tabs/documents/documentsData';
import {
  RELATIONSHIPS, DECISION_MAKER_ROLES, AUTHORITY_TYPES, LEGAL_AUTHORITY_CATEGORY, LEGAL_AUTHORITY_TYPE,
  rolesOfMember, resolveMember,
} from './familyMembers';
import styles from './AddFamilyDrawer.module.css';

const MAX_BYTES = 5 * 1024 * 1024;
const EMPTY_FORM = {
  mode: 'search', // 'search' | 'member' (a Fold member) | 'new' (someone outside Fold)
  relatedPatientId: '', name: '', relationship: '', email: '', phone: '', additionalPhones: [],
  isCaregiver: false, isEmergencyContact: false, decisionMaker: null, authorityType: null, documentIds: [],
};
const extOf = (name) => (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1]?.toLowerCase() || null;
const today = () => new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

function Card({ title, children }) {
  return (
    <div className={styles.card}>
      <span className={styles.cardTitle}>{title}</span>
      {children}
    </div>
  );
}

function RequiredLabel({ children }) {
  return <span className={styles.subLabel}>{children}<span className={styles.req} aria-hidden="true" /></span>;
}

/** Add a Legal Authority document to the patient's Documents (inline card). */
function NewDocumentCard({ patientId, onSaved, onCancel }) {
  const addProgramDocument = useAppStore(s => s.addProgramDocument);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [fieldKey, setFieldKey] = useState(0);
  const pick = (f) => {
    if (f && f.size > MAX_BYTES) {
      toast.error('That file is over 5 MB. Choose a smaller one.');
      setFieldKey(k => k + 1);
      return;
    }
    setFile(f);
    if (f && !caption) setCaption(f.name.replace(/\.[^.]+$/, ''));
  };
  const save = () => {
    if (!file || !caption.trim()) return;
    const ext = extOf(file.name);
    const id = `pdoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    addProgramDocument({
      id, programCode: null, patientId: String(patientId),
      name: ext ? `${caption.trim()}.${ext}` : caption.trim(),
      type: LEGAL_AUTHORITY_TYPE, category: LEGAL_AUTHORITY_CATEGORY,
      sizeBytes: file.size, updatedBy: useAppStore.getState().currentUserProfile?.name || 'You',
      updatedDate: today(), createdAt: new Date().toISOString(), ext,
    }, file);
    onSaved(id);
  };
  return (
    <div className={styles.docCard}>
      <span className={styles.cardTitle}>Add New Document</span>
      <UploadDropField
        key={fieldKey}
        onChange={pick}
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        helperText="Supported formats: PDF, DOC, DOCX, PNG, JPG"
        secondaryText="Max size: 5 MB"
      />
      {file && (
        <div className={styles.docFields}>
          <Select label="Document Type" disabled options={[{ value: LEGAL_AUTHORITY_TYPE, label: LEGAL_AUTHORITY_TYPE }]} value={LEGAL_AUTHORITY_TYPE} onValueChange={() => {}} />
          <Input label="Caption" required value={caption} onChange={e => setCaption(e.target.value)} maxLength={80} />
        </div>
      )}
      <div className={styles.actions}>
        <Button size="sm" onClick={save} disabled={!file || !caption.trim()}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/**
 * Add Family, Caregivers & Decision Makers (Figma Mar-Present 2026
 * 4801:13694). Search Fold members first; "Not a Fold Member? Add Here"
 * (Jun-July 2025 1162:54280) opens the form for someone outside Fold. Add
 * saves the person straight away; they're listed under Family & Caregivers.
 */
export function AddFamilyDrawer({ patient, onClose }) {
  const patientId = String(patient.id);
  const patients = useAppStore(s => s.allPatients) || [];
  const members = useAppStore(s => s.familyMembers[patientId]) || [];
  const fetchFamilyMembers = useAppStore(s => s.fetchFamilyMembers);
  const addFamilyMember = useAppStore(s => s.addFamilyMember);
  const removeFamilyMember = useAppStore(s => s.removeFamilyMember);
  const documents = useAppStore(s => s.programDocuments);
  const fetchProgramDocuments = useAppStore(s => s.fetchProgramDocuments);
  useEffect(() => { fetchFamilyMembers(patientId); fetchProgramDocuments(); }, [patientId, fetchFamilyMembers, fetchProgramDocuments]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [addingDoc, setAddingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  // A Fold member is listed once, and never the patient themself.
  const taken = new Set(members.map(m => String(m.relatedPatientId)).filter(Boolean));
  const memberOptions = useMemo(() => patients
    .filter(p => String(p.id) !== patientId && !taken.has(String(p.id)))
    .map(p => ({
      value: String(p.id),
      triggerLabel: p.name,
      searchText: `${p.name} ${p.memberId || ''}`,
      label: <PersonOption name={p.name} initials={p.initials} meta={personMeta(p)} />,
    })), [patients, patientId, members]); // eslint-disable-line react-hooks/exhaustive-deps

  const legalDocs = documents.filter(d => String(d.patientId) === patientId && categoryOf(d) === LEGAL_AUTHORITY_CATEGORY);
  const holder = form.decisionMaker ? members.find(m => m.decisionMaker === form.decisionMaker) : null;
  const isNew = form.mode === 'new';
  const name = form.mode === 'member' ? (patients.find(p => String(p.id) === form.relatedPatientId)?.name || '') : form.name.trim();
  const canAdd = form.mode !== 'search' && !!name && !!form.relationship && !addingDoc && !saving
    && (!form.decisionMaker || (!!form.authorityType && form.documentIds.length > 0));
  const addBlocked = form.mode === 'search' ? 'Pick a Fold member or add someone'
    : !name ? 'Add a name' : !form.relationship ? 'Pick a relationship'
      : addingDoc ? 'Save or cancel the new document first'
        : form.decisionMaker && !form.authorityType ? 'Pick an authority type'
          : form.decisionMaker && !form.documentIds.length ? 'Pick a supporting document' : null;

  const add = async () => {
    if (!canAdd) return;
    setSaving(true);
    const saved = await addFamilyMember(patientId, {
      ...form,
      name,
      relatedPatientId: form.mode === 'member' ? form.relatedPatientId : null,
      additionalPhones: form.additionalPhones.map(x => x.trim()).filter(Boolean),
    });
    setSaving(false);
    if (!saved) { toast.error('This person could not be added. Try again.'); return; }
    toast.success('Family Member Added Successfully');
    setForm(EMPTY_FORM);
  };

  const toggleDoc = (id) => set({ documentIds: form.documentIds.includes(id) ? form.documentIds.filter(x => x !== id) : [...form.documentIds, id] });
  const setPhone = (i, v) => set({ additionalPhones: form.additionalPhones.map((x, j) => (j === i ? v : x)) });
  const preview = (d) => {
    const url = d.fileUrl || (d.file ? URL.createObjectURL(d.file) : null);
    if (url) window.open(url, '_blank', 'noopener');
    else toast.error('This document has no file to preview.');
  };

  return (
    <Drawer title="Add Family, Caregivers & Decision Makers" onClose={onClose}>
      <div className={styles.body}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Add Family & Caregivers</h3>

          {form.mode === 'search' && (
            <Select
              label="Search Member"
              searchable
              options={memberOptions}
              value=""
              onValueChange={(id) => set({ mode: 'member', relatedPatientId: id })}
              placeholder="Search members"
              searchPlaceholder="Search by name or member ID"
              emptyText={() => (
                <span className={styles.notMember}>
                  <RingEmptyState size="S" icon="solar:user-cross-linear">
                    <span className={styles.notMemberText}>
                      Not a Fold Member? <Link onClick={() => set({ mode: 'new' })}>Add Here</Link>
                    </span>
                  </RingEmptyState>
                </span>
              )}
            />
          )}

          {form.mode !== 'search' && (
            <>
              <div className={styles.grid}>
                {isNew
                  ? <Input label="Name" required value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Enter name" maxLength={80} />
                  : <Input label="Name" required value={name} disabled />}
                <Select label="Relationship" required options={RELATIONSHIPS.map(r => ({ value: r, label: r }))} value={form.relationship} onValueChange={v => set({ relationship: v })} placeholder="Select relationship" />
                {isNew && <Input label="Email" type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="Enter email" />}
                {isNew && <Input label="Phone Number" type="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="Enter phone number" />}
              </div>
              {isNew && (
                <div className={styles.phones}>
                  {form.additionalPhones.length > 0 && <span className={styles.subLabel}>Additional Phone Numbers</span>}
                  {form.additionalPhones.map((v, i) => (
                    <div key={i} className={styles.phoneRow}>
                      <Input type="tel" value={v} onChange={e => setPhone(i, e.target.value)} placeholder="Enter phone number" aria-label={`Additional phone ${i + 1}`} />
                      <ActionButton icon="solar:trash-bin-trash-linear" tone="danger" size="sm" tooltip="Remove" tooltipLeft onClick={() => set({ additionalPhones: form.additionalPhones.filter((_, j) => j !== i) })} />
                    </div>
                  ))}
                  <Link className={styles.addLink} role="button" tabIndex={0} onClick={() => set({ additionalPhones: [...form.additionalPhones, ''] })}>
                    <AddIconMinimalist size={12} color="currentColor" />
                    Add Phone Numbers
                  </Link>
                </div>
              )}
              {form.mode === 'member' && (
                <Link variant="secondary" className={styles.addLink} role="button" tabIndex={0} onClick={() => set({ mode: 'search', relatedPatientId: '' })}>
                  Change member
                </Link>
              )}

              <Card title="Assign this relative as additional role:">
                <div className={styles.inline}>
                  <label className={styles.check}><Checkbox checked={form.isCaregiver} onCheckedChange={c => set({ isCaregiver: c === true })} />Caregiver</label>
                  <label className={styles.check}><Checkbox checked={form.isEmergencyContact} onCheckedChange={c => set({ isEmergencyContact: c === true })} />Emergency Contact</label>
                </div>
              </Card>

              <Card title="Mark this relative as a decision maker:">
                <div className={styles.inline}>
                  {DECISION_MAKER_ROLES.map(r => (
                    <RadioButton
                      key={r}
                      label={r === 'Decision Maker' ? 'Decision maker' : 'Alternate Decision maker'}
                      checked={form.decisionMaker === r}
                      // Clicking the picked one again clears it: being a decision maker is optional.
                      onChange={() => set(form.decisionMaker === r ? { decisionMaker: null } : { decisionMaker: r })}
                    />
                  ))}
                </div>
                {holder && (
                  <InfoBar variant="inline" tone="warning">
                    {resolveMember(holder, patients).name} is the current {form.decisionMaker}. Adding {name || 'this person'} replaces them.
                  </InfoBar>
                )}
                {form.decisionMaker && (
                  <>
                    <RequiredLabel>Select Authority Type</RequiredLabel>
                    <div className={styles.inline}>
                      {AUTHORITY_TYPES.map(t => <RadioButton key={t} label={t} checked={form.authorityType === t} onChange={() => set({ authorityType: t })} />)}
                    </div>
                    <RequiredLabel>Select Supporting Documents</RequiredLabel>
                    {legalDocs.length > 0 && (
                      <div className={styles.docList}>
                        <span className={styles.docListTitle}>Select from Patient’s Legal Authority Documents:</span>
                        {legalDocs.map(d => (
                          <div key={d.id} className={styles.docRow}>
                            <label className={styles.check}><Checkbox checked={form.documentIds.includes(d.id)} onCheckedChange={() => toggleDoc(d.id)} />{d.name}</label>
                            <ActionButton icon="solar:eye-linear" size="sm" tooltip="Preview" tooltipLeft onClick={() => preview(d)} />
                          </div>
                        ))}
                      </div>
                    )}
                    {addingDoc
                      ? <NewDocumentCard patientId={patientId} onCancel={() => setAddingDoc(false)} onSaved={(id) => { setAddingDoc(false); set({ documentIds: [...form.documentIds, id] }); }} />
                      : (
                        <Link className={styles.addLink} role="button" tabIndex={0} onClick={() => setAddingDoc(true)}>
                          <AddIconMinimalist size={12} color="currentColor" />
                          Upload New Document
                        </Link>
                      )}
                  </>
                )}
              </Card>

              <div className={styles.actions}>
                <Button onClick={add} disabled={!canAdd} disabledReason={addBlocked}>Add</Button>
                <Button variant="outline" onClick={() => { setForm(EMPTY_FORM); setAddingDoc(false); }}>Discard</Button>
              </div>
            </>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Family & Caregivers</h3>
          {members.length === 0 ? (
            <div className={styles.emptyCard}>
              <RingEmptyState size="S" icon="solar:user-heart-linear" label="No family or caregivers added" />
            </div>
          ) : (
            <div className={styles.list}>
              {members.map((raw) => {
                const m = resolveMember(raw, patients);
                return (
                  <div key={m.id} className={styles.person}>
                    {m.relatedPatientId
                      ? <Avatar variant="patient" size="M" initials={m.initials} />
                      : <Tooltip label="Not a Fold Member"><Avatar variant="others" size="M" initials={m.initials} /></Tooltip>}
                    <div className={styles.personText}>
                      <span className={styles.personName}>
                        {m.name}
                      </span>
                      <span className={styles.personMeta}>{[m.relationship, m.phone, m.email].filter(Boolean).join(' • ')}</span>
                      {rolesOfMember(m).length > 0 && (
                        <span className={styles.roles}>{rolesOfMember(m).map(r => <Badge key={r} size="xs" label={r} />)}</span>
                      )}
                    </div>
                    <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Remove" tooltipLeft onClick={() => setRemoving(m)} />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {removing && (
        <ConfirmDialog
          variant="destructive"
          title={`Remove ${removing.name}?`}
          description="They're removed from this patient's family, caregivers and decision makers."
          confirmLabel="Remove"
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            const ok = await removeFamilyMember(patientId, removing.id);
            if (ok) toast.success('Family Member Removed Successfully');
            else toast.error('This person could not be removed. Try again.');
            setRemoving(null);
          }}
        />
      )}
    </Drawer>
  );
}
