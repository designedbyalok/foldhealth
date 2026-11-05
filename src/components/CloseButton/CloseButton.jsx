import { forwardRef } from 'react';
import { CloseIcon } from '../Icon/CloseIcon';
import styles from './CloseButton.module.css';

/**
 * Fold Health CloseButton: single source of truth for the top-bar dismiss
 * icon used across full-screen takeovers (Agent Builder, Email Builder,
 * Campaign Builder, etc.). Renders the plain cross via CloseIcon (not the
 * circled solar variant) with a neutral hover affordance.
 *
 * @param {object}  props
 * @param {() => void}  props.onClick
 * @param {number}  [props.size=18]
 * @param {string}  [props.label='Close']: aria-label + tooltip
 * @param {string}  [props.className]
 */
export const CloseButton = forwardRef(function CloseButton(
  { onClick, size = 18, label = 'Close', className, ...rest },
  ref,
) {
  return (
    <button
      type="button"
      ref={ref}
      className={[styles.btn, className || ''].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-label={label}
      title={label}
      {...rest}
    >
      <CloseIcon size={size} />
    </button>
  );
});
