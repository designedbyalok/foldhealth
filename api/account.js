// Account security, one function (see _lib/dispatch.js):
// /api/password-reset, /api/account-unlock, /api/security-email-dispatch,
// /api/auth-activity, /api/patient-invite.
import { dispatch } from './_lib/dispatch.js';
import passwordReset from './_handlers/password-reset.js';
import accountUnlock from './_handlers/account-unlock.js';
import securityEmailDispatch from './_handlers/security-email-dispatch.js';
import authActivity from './_handlers/auth-activity.js';
import patientInvite from './_handlers/patient-invite.js';

export default dispatch(
  { 'password-reset': passwordReset, 'account-unlock': accountUnlock, 'security-email-dispatch': securityEmailDispatch,
    'auth-activity': authActivity, 'patient-invite': patientInvite },
  {
    '/api/password-reset': 'password-reset',
    '/api/account-unlock': 'account-unlock',
    '/api/security-email-dispatch': 'security-email-dispatch',
    '/api/auth-activity': 'auth-activity',
    '/api/patient-invite': 'patient-invite',
  },
);
