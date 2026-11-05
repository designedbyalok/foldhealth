// CMP program statuses, in menu order, with their badge tone.
export const CMP_STATUS_TONE = {
  Declined: 'danger',
  New: 'info',
  'Unable to Reach': 'neutral',
  Enrolled: 'primary',
  Attempted: 'warning',
  Engaged: 'success',
};
export const CMP_STATUSES = Object.keys(CMP_STATUS_TONE);
