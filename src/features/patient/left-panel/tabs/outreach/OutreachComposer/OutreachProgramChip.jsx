import { useCallback } from 'react';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Tooltip } from '../../../../../../components/Tooltip/Tooltip';
import styles from './OutreachProgramChip.module.css';

/**
 * One program/gap chip for the Outreach composer.
 *
 * Collapses the old (Programs multi-select) + (Outreach Outcome radio) +
 * (Separate Notes switch) stack into a single gesture: the chip itself
 * owns both selection AND outcome. Clicks cycle:
 *   unselected → selected (no outcome)
 *   selected   → ✓ Successful
 *   ✓          → ✕ Unsuccessful
 *   ✕          → unselected
 *
 * Internally the chip is a `<button>` wrapping Fold's shared `<Badge>`,
 * so the color palette, size curve, icon treatment, hover tint, and
 * dark-mode token swap all come from the design-system component rather
 * than this file. The button chrome adds the interactive gestures the
 * stock Badge doesn't carry (focus ring, press scale, outcome-dot pop).
 */
export function OutreachProgramChip({
  code,
  label,
  outcome,
  selected,
  onCycle,
  disabled = false,
}) {
  const tone = outcome === 'Successful' ? 'success'
    : outcome === 'Unsuccessful' ? 'error'
    : selected ? 'primary'
    : 'grey';

  const next = outcome === 'Successful' ? 'Unsuccessful'
    : outcome === 'Unsuccessful' ? null
    : selected ? 'Successful'
    : 'selected';

  const tooltipLabel = outcome === 'Successful' ? `${code}: Successful, click to set Unsuccessful`
    : outcome === 'Unsuccessful' ? `${code}: Unsuccessful, click to clear`
    : selected ? `${code} selected, click to mark Successful`
    : `Add ${code} to this outreach`;

  const handleClick = useCallback(() => {
    if (disabled) return;
    onCycle?.(next);
  }, [disabled, next, onCycle]);

  const outcomeIcon = outcome === 'Successful' ? 'solar:check-circle-bold'
    : outcome === 'Unsuccessful' ? 'solar:close-circle-bold'
    : null;

  return (
    <Tooltip label={tooltipLabel} placement="top">
      <button
        type="button"
        className={[styles.chipBtn, outcome ? styles.chipHasOutcome : ''].join(' ')}
        onClick={handleClick}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={tooltipLabel}
      >
        <Badge
          tone={tone}
          size="S"
          icon={outcomeIcon || undefined}
          label={label || code}
        />
      </button>
    </Tooltip>
  );
}
