// Outbound email, one function (see _lib/dispatch.js):
// /api/send-test-email, /api/send-report-email, /api/referral-email.
import { dispatch } from './_lib/dispatch.js';
import sendTestEmail from './_handlers/send-test-email.js';
import sendReportEmail from './_handlers/send-report-email.js';
import referralEmail from './_handlers/referral-email.js';

export default dispatch(
  { 'send-test-email': sendTestEmail, 'send-report-email': sendReportEmail, 'referral-email': referralEmail },
  {
    '/api/send-test-email': 'send-test-email',
    '/api/send-report-email': 'send-report-email',
    '/api/referral-email': 'referral-email',
  },
);
