// Empty-value placeholder shown in the UI. Rows saved before the switch from
// the em dash still hold U+2014, so checks accept both.
export const isEmptyDash = (v) => v === '-' || v === '\u2014';
