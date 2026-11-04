import { EmptyState } from '../EmptyState/EmptyState';
import { Button } from '../Button/Button';

// Now EmptyState tone="danger" (src/components/layers.json $deprecated). Kept so open branches build.
export function ErrorState({ title = 'Something went wrong', message, onRetry, icon = 'solar:danger-triangle-linear' }) {
  return (
    <EmptyState
      tone="danger"
      icon={icon}
      title={title}
      description={message || 'An unexpected error occurred. Please try again or contact support if the problem persists.'}
      action={onRetry && <Button variant="soft" leadingIcon="solar:refresh-linear" onClick={onRetry}>Try Again</Button>}
    />
  );
}
