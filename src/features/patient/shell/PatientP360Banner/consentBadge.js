const POPOVER_WIDTH = 350;

/** "1/4" for the banner: program consents given out of all program consents. */
export const consentSummaryLabel = (summary) => (summary?.total ? `${summary.given}/${summary.total}` : 'N/A');

/** Below the anchor, kept 8px inside the viewport's right edge. */
export function consentPopoverPos(anchor) {
  const rect = anchor?.getBoundingClientRect();
  if (!rect) return null;
  return { top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8) };
}
