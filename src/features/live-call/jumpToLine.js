/** Scrolls the transcript to line `i` (lines carry `data-ln`). */
export const jumpToLine = (i) => document.querySelector(`[data-ln="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
