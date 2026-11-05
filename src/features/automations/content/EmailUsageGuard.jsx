import { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { automationsUsingEmail } from './emailUsage';
import { EmailUsageDialog } from './EmailUsageDialog';
import { EmailUsageDrawer } from './EmailUsageDrawer';

/**
 * The delete guard for emails that automations send: the "Delete content?"
 * dialog, and its Review drawer. `onDelete` runs the caller's delete and
 * resolves truthy on success, which closes the guard.
 */
export function EmailUsageGuard({ emailIds, emailName, deleting = false, onDelete, onClose }) {
  const automations = useAppStore(s => s.automations);
  const [reviewing, setReviewing] = useState(false);

  const remove = async () => {
    if (await onDelete()) onClose();
  };

  if (reviewing) {
    return <EmailUsageDrawer emailIds={emailIds} emailName={emailName} deleting={deleting} onDelete={remove} onClose={onClose} />;
  }
  return (
    <EmailUsageDialog
      automations={automationsUsingEmail(automations, emailIds)}
      emailCount={emailIds.length}
      deleting={deleting}
      onDelete={remove}
      onReview={() => setReviewing(true)}
      onClose={onClose}
    />
  );
}
