import { ActionButton } from '../ActionButton/ActionButton';

/**
 * Reusable search trigger button: wraps ActionButton at size L.
 */
export function SearchIconButton({ className, title = 'Search', ...props }) {
  return (
    <ActionButton
      icon="solar:magnifer-linear"
      tooltip={title}
      className={className}
      {...props}
    />
  );
}
