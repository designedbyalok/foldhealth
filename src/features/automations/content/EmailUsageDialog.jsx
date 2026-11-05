import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { usageMessage } from './emailUsage';

/**
 * Shown instead of the plain delete confirm when automations send the email
 * (Figma 2966:140823). Delete goes ahead; Review opens the usage drawer.
 */
export function EmailUsageDialog({ automations, emailCount = 1, deleting = false, onDelete, onReview, onClose }) {
  return (
    <ConfirmDialog
      align="start"
      icon="solar:trash-bin-trash-linear"
      iconColor="var(--status-error)"
      title={emailCount > 1 ? 'Delete emails?' : 'Delete content?'}
      description={usageMessage(automations, emailCount)}
      confirmLabel="Delete"
      cancelLabel="Review"
      loading={deleting}
      onConfirm={() => onDelete()}
      onCancel={onReview}
      onClose={onClose}
    />
  );
}
