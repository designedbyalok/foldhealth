import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../components/Button/Button';
import { ConfirmDialog } from '../../../../../../components/ConfirmDialog/ConfirmDialog';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { PatientPortalInviteDrawer } from './PatientPortalInviteDrawer';
import styles from './PatientPortalAccess.module.css';

const RELATIONSHIP_LABELS = {
  self: "Patient's own account",
  dependent: 'Parent or guardian',
  caregiver: 'Caregiver',
};

const EMPTY = [];

/**
 * Who can use the patient app (patients.foldhealth.org) for this patient:
 * linked patient accounts, invite another, remove access. Lives on the
 * Profile tab's Demographics view.
 */
export function PatientPortalAccess({ patient, defaultEmail }) {
  // Portal links key on the member id (Fold ID). Worklist rows like HCC's
  // carry their own `id` ("hcc-32"), so prefer `memberId`.
  const memberId = patient ? String(patient.memberId || patient.id) : null;
  const accounts = useAppStore((s) => s.patientPortalByMember[memberId] ?? EMPTY);
  const loading = useAppStore((s) => s.patientPortalLoading[memberId]);
  const loaded = useAppStore((s) => memberId in s.patientPortalByMember);
  const fetchAccounts = useAppStore((s) => s.fetchPatientPortalAccounts);
  const removeAccess = useAppStore((s) => s.removePatientPortalAccess);
  const showToast = useAppStore((s) => s.showToast);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (memberId) fetchAccounts(memberId); }, [memberId, fetchAccounts]);

  if (!memberId) return null;

  return (
    <div className={styles.wrap}>
      {!loaded && loading && <CardSkeleton count={1} />}
      {loaded && accounts.length === 0 && (
        <p className={styles.empty}>No one can use the patient app for this patient yet.</p>
      )}
      {accounts.length > 0 && (
        <ul className={styles.list}>
          {accounts.map((a) => (
            <li key={a.userId} className={styles.row}>
              <div className={styles.rowText}>
                <span className={styles.email}>{a.email}</span>
                <span className={styles.meta}>
                  {RELATIONSHIP_LABELS[a.relationship] || a.relationship}
                  {a.otherMembers > 0 && ` • also manages ${a.otherMembers} other ${a.otherMembers === 1 ? 'patient' : 'patients'}`}
                </span>
              </div>
              <Badge size="sm" tone={a.lastSignInAt ? 'success' : 'neutral'} label={a.lastSignInAt ? 'Active' : 'Invite sent'} />
              <ActionButton icon="solar:trash-bin-trash-linear" size="sm" tooltip="Remove access" onClick={() => setRemoving(a)} />
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" leadingIcon="solar:user-plus-linear" onClick={() => setInviting(true)}>
        Give portal access
      </Button>

      {inviting && (
        <PatientPortalInviteDrawer
          patient={patient}
          memberId={memberId}
          defaultEmail={accounts.length === 0 ? defaultEmail : ''}
          onClose={() => setInviting(false)}
          onSent={(email) => showToast?.(`Invite sent to ${email}`)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Remove patient app access?"
          description={`${removing.email} will no longer see this patient in the patient app. Their account and any other patients they manage are not affected.`}
          confirmLabel="Remove access"
          loading={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await removeAccess(memberId, removing.userId);
            } finally {
              setBusy(false);
              setRemoving(null);
            }
          }}
        />
      )}
    </div>
  );
}
