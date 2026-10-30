import { useState } from 'react';
import { Alert } from '../../../../../../../components/Alert/Alert';
import { Button } from '../../../../../../../components/Button/Button';
import { ConfirmDialog } from '../../../../../../../components/ConfirmDialog/ConfirmDialog';
import styles from './CarePlanView.module.css';

/**
 * A template run whose patient now matches a different category: says which
 * and why, and offers to switch (confirmed) or dismiss. One banner per run.
 * `suggestion` is from categorySuggestions().
 */
export function CategorySuggestionBanner({ suggestion, canEdit, onSwitch, onDismiss }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { template, to, reasons, fromName } = suggestion;

  const doSwitch = async () => {
    setBusy(true);
    try {
      await onSwitch(suggestion);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className={styles.pausedBanner}>
      <Alert
        tone="info"
        icon="solar:transfer-horizontal-linear"
        message={(
          <>
            <strong>{template.name}</strong>
            {` · Latest results match ${to.name} (${reasons.join('; ')}). `}
            {fromName ? `This plan follows ${fromName}.` : 'This plan has the Common items only.'}
          </>
        )}
      />
      {canEdit && (
        <>
          <Button variant="ghost" size="sm" onClick={() => onDismiss(suggestion)}>Dismiss</Button>
          <Button variant="outline" size="sm" leadingIcon="solar:transfer-horizontal-linear" onClick={() => setConfirming(true)}>
            Switch Category
          </Button>
        </>
      )}
      {confirming && (
        <ConfirmDialog
          variant="primary"
          title={`Switch to ${to.name}?`}
          description={[
            `${template.name} moves to ${to.name}, adding its goals, interventions and barriers.`,
            // What leaves depends on the plan (items linked only to a leaving
            // goal go too), so the exact count is in History afterwards.
            fromName ? `Goals, interventions and barriers only in ${fromName} move to the plan's history with the current run.` : '',
            'Common items stay as they are.',
          ].filter(Boolean).join(' ')}
          confirmLabel="Switch Category"
          loading={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={doSwitch}
        />
      )}
    </div>
  );
}
