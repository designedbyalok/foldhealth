import { EmptyState } from '../EmptyState/EmptyState';

// Now EmptyState (src/components/layers.json $deprecated). Kept so open branches build.
export function RingEmptyState({ label, ...rest }) {
  return <EmptyState title={label} {...rest} />;
}
