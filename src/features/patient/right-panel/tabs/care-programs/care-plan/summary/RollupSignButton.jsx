import { useMemo, useState } from 'react';
import { Button } from '../../../../../../../components/Button/Button';
import { ConfirmDialog } from '../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { SelectAssigneeModal } from '../../../../../../../components/SelectAssigneeModal/SelectAssigneeModal';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { carePlanSignShareEnabled } from '../lib/carePlanSignState';

const SIGN_MENU = [
  { key: 'review', icon: 'solar:checklist-minimalistic-linear', label: 'Send for Review' },
];

/**
 * Sign for the patient-level roll-up (care_plan_mode = 'both'). Each program
 * keeps its own signed plan and versions, so one Sign here signs every
 * program plan with unsigned changes (a new version of each), after a
 * confirmation that names them. Send for Review files one review per plan.
 */
export function RollupSignButton({ patientId, programs }) {
  const patientCarePlans = useAppStore(s => s.patientCarePlans);
  const signCarePlan = useAppStore(s => s.signCarePlan);
  const requestCarePlanReview = useAppStore(s => s.requestCarePlanReview);
  const showToast = useAppStore(s => s.showToast);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const pending = useMemo(
    () => programs.filter(p => carePlanSignShareEnabled(patientCarePlans[`${patientId}::${p.id}`])),
    [programs, patientCarePlans, patientId],
  );
  const names = pending.map(p => p.name || p.code).join(', ');

  const signAll = async () => {
    setBusy(true);
    let signed = 0;
    for (const p of pending) {
      if (await signCarePlan(patientId, p, '')) signed += 1;
    }
    setBusy(false);
    setConfirmOpen(false);
    showToast(signed === pending.length
      ? `${signed} care plan${signed === 1 ? '' : 's'} signed`
      : `Signed ${signed} of ${pending.length} care plans`);
  };

  const reviewAll = async (user) => {
    setReviewOpen(false);
    let sent = 0;
    for (const p of pending) {
      if (await requestCarePlanReview(patientId, p, user)) sent += 1;
    }
    showToast(sent
      ? `${sent} care plan${sent === 1 ? '' : 's'} sent to ${user.name} for review`
      : 'Could not send the care plans for review');
  };

  return (
    <>
      <Button
        variant="primary"
        size="M"
        leadingIcon="solar:pen-2-linear"
        disabled={pending.length === 0}
        onClick={() => setConfirmOpen(true)}
        menuItems={SIGN_MENU}
        menuWidth={200}
        menuAriaLabel="Sign care plans options"
        onMenuSelect={(key) => { if (key === 'review') setReviewOpen(true); }}
      >
        Sign
      </Button>
      {confirmOpen && (
        <ConfirmDialog
          variant="primary"
          icon="solar:pen-2-linear"
          iconColor="var(--primary-300)"
          title={`Sign ${pending.length} care plan${pending.length === 1 ? '' : 's'}?`}
          description={`Creates a new signed version of each plan with unsigned changes: ${names}.`}
          confirmLabel="Sign"
          loading={busy}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={signAll}
        />
      )}
      <SelectAssigneeModal
        open={reviewOpen}
        title={`Send ${pending.length} care plan${pending.length === 1 ? '' : 's'} for review`}
        onClose={() => setReviewOpen(false)}
        onConfirm={reviewAll}
      />
    </>
  );
}
