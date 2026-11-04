/**
 * Splits a worklist's columns for the column picker: sticky-left columns
 * stay first, sticky-right last, `locked` ones render in place and can't be
 * hidden, the rest are customisable. Shared with the connected
 * features/worklists/WorklistShell, which saves the user's choices.
 */
export function splitWorklistColumns(columns) {
  const top = [];
  const botSticky = [];
  const inPlaceLocked = [];
  const mid = [];
  for (const c of columns) {
    if (c.sticky === 'left' && !c.showCheckbox) top.push(c);
    else if (c.sticky === 'right') botSticky.push(c);
    else if (c.locked && !c.showCheckbox) {
      mid.push(c);              // still rendered in-place in the row
      inPlaceLocked.push(c);    // and tagged for the popover locked band
    }
    else if (!c.showCheckbox) mid.push(c);
  }
  return {
    customisableColumns: mid,
    hiddenByDefault: mid.filter(c => c.defaultHidden).map(c => c.key || c.k),
    lockedKeys: new Set(inPlaceLocked.map(c => c.key)),
    lockedTop: top.map(c => ({ k: c.key, lb: c.popoverLabel || c.label })),
    lockedBottom: [...inPlaceLocked, ...botSticky].map(c => ({
      k: c.key, lb: c.popoverLabel || c.label,
    })),
  };
}
