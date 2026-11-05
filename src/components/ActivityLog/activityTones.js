// Status label → Badge tone. HEDIS canonical status grouping drives the
// color band: Open → primary (Not Started); Engaged / Submitted → warning
// (In Progress); Completed → success (Done); Closed - * → grey. HCC-only
// labels (Accepted / Dismissed / Audited / Returned / …) share the same
// map so both worklists render identical status pills. Unknown falls to
// 'grey'.
const STATUS_TONE = {
  Open:                          'primary',
  Audited:                       'primary',
  Engaged:                       'warning',
  'Engaged Requires Follow-Up':  'warning',
  Submitted:                     'warning',
  'In Progress':                 'warning',
  New:                           'warning',
  Pending:                       'warning',
  'Pending Review':              'warning',
  'Record Requested':            'warning',
  'Record Received':             'warning',
  Completed:                     'success',
  Signed:                        'success',
  Accepted:                      'success',
  Met:                           'success',
  Resolved:                      'success',
  // Care plan GBI statuses (see care-plan/lib/gbiStatus): a pause, a
  // discontinued item and a not-applicable one are none of them failures.
  'On Hold':                     'info',
  'Not Met':                     'error',
  Discontinued:                  'secondary',
  'Not Applicable':              'disabled',
  Draft:                         'grey',
  Dismissed:                     'error',
  Returned:                      'warning',
  Rebuttal:                      'secondary',
  Rejected:                      'error',
  'Closed - Data':               'grey',
  'Closed - Do not call':        'grey',
  'Closed - UTR':                'grey',
  'Closed - Other':              'grey',
  Deleted:                       'grey',
  None:                          'grey',
};
export const statusTone = (label) => STATUS_TONE[label] || 'neutral';
