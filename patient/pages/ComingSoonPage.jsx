import { EmptyState } from '@/components/EmptyState/EmptyState';

export function ComingSoonPage({ icon, title }) {
  return (
    <EmptyState
      icon={icon}
      title={`${title} is coming soon`}
      description="This part of your Fold Health portal is still being built."
    />
  );
}
