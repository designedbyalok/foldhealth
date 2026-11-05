/* eslint-disable no-restricted-syntax -- email block data: sizes are px in the
   rendered email HTML (as in accountEmailTemplates.js), not app styles. */
/**
 * The redesigned account security emails (fold-account-security-emails),
 * rebuilt in the email builder's blocks: a purple header with the Fold logo,
 * "ACCOUNT SECURITY", the title and an illustration; the message; a box of
 * account details; numbered next steps; the button; a "didn't do this?" note;
 * and a lavender footer.
 *
 * They're new templates (Settings → Content → Emails, category "Account
 * Security") next to the existing ones, not replacements. The two patient
 * ones cover a paused patient app sign-in: the patient resets their password
 * to unlock it (no admin step), and the care team gets a heads-up. Each has its own
 * `system_key` ending in `_v2`, which the server doesn't send yet, so what
 * users receive is unchanged until a template is switched over.
 *
 * Images live in public/email/security. Set PUBLIC_APP_URL when seeding so
 * the stored email HTML points at them by full address (an email can't load
 * a relative one); without it they still show in the builder.
 */
import { renderEmailHtml } from './patchEmailHtml';

const BRAND = '#8C5AE2';
const TEXT = '#3A485F';
const MUTED = '#6F7A90';
const ASSET_BASE = `${globalThis.process?.env?.PUBLIC_APP_URL || ''}/email/security`;
const LOGO_WHITE = 'https://foldhealth-sandbox-cms-uploads.s3.us-east-2.amazonaws.com/39605e30-fbaa-4600-aeff-1421ba8fd931/Logo_W_6bc9ddf6a6.png';

const pad = (top, right, bottom, left) => ({ top, right, bottom, left });
const NO_PAD = pad(0, 0, 0, 0);

/**
 * One email's blocks. `p` prefixes every block id so each template's ids are
 * its own.
 */
function documentOf(p, c) {
  const blocks = {};
  const add = (id, block) => { blocks[`${p}-${id}`] = block; return `${p}-${id}`; };
  const text = (id, value, { size = 15, line = 1.6, color = TEXT, weight, padding, list } = {}) => add(id, {
    type: 'Text',
    data: {
      props: { text: value, ...(list ? { listStyle: list } : {}) },
      style: { color, fontSize: size, lineHeight: line, textAlign: 'left', ...(weight ? { fontWeight: weight } : {}), padding },
    },
  });
  const box = (id, childrenIds, { bg, radius = 12, inner = pad(0, 0, 0, 0), outer = pad(6, 32, 18, 32) }) => {
    const innerId = add(`${id}-box`, { type: 'Container', data: { style: { backgroundColor: bg, borderRadius: radius, padding: inner }, props: { childrenIds } } });
    return add(id, { type: 'Container', data: { style: { padding: outer }, props: { childrenIds: [innerId] } } });
  };

  // Header: logo, eyebrow and title on the left; the illustration on the right.
  const logo = add('logo', { type: 'Image', data: { props: { url: LOGO_WHITE, alt: 'Fold Health', width: 140 }, style: { textAlign: 'left', padding: pad(28, 8, 0, 32) } } });
  const eyebrow = text('eyebrow', c.eyebrow || 'ACCOUNT SECURITY', { size: 12, line: 1.35, color: '#D7C0FF', weight: '600', padding: pad(26, 8, 6, 32) });
  blocks[eyebrow].data.style.letterSpacing = 1;
  const title = add('title', { type: 'Heading', data: { props: { text: c.title, level: 'h1' }, style: { color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', lineHeight: 1.3, textAlign: 'left', padding: pad(0, 8, 32, 32) } } });
  const art = add('art', { type: 'Image', data: { props: { url: `${ASSET_BASE}/${c.art}`, alt: '', width: 128 }, style: { textAlign: 'right', padding: pad(16, 32, 16, 0) } } });
  const headCols = add('head-cols', {
    type: 'ColumnsContainer',
    data: {
      style: { padding: NO_PAD },
      props: {
        columnsCount: 2,
        columnsGap: 0,
        columnWidths: [70, 30],
        columns: [{ childrenIds: [logo, eyebrow, title], valign: 'middle' }, { childrenIds: [art], valign: 'middle', align: 'right' }],
      },
    },
  });
  const header = add('header', {
    type: 'Container',
    data: {
      role: 'header',
      style: { backgroundColor: '#7154F0', backgroundImage: `${ASSET_BASE}/security-header-bg.png`, backgroundSize: 'cover', padding: NO_PAD },
      props: { childrenIds: [headCols] },
    },
  });

  // Greeting and message.
  const greeting = text('greeting', 'Hi {{first_name}},', { padding: pad(28, 32, 12, 32) });
  const intro = c.intro.map((t, i) => text(`intro-${i}`, t, { padding: pad(0, 32, i === c.intro.length - 1 ? 18 : 12, 32) }));

  // Account details: labels on the left, values (bold) on the right.
  const labels = text('details-labels', c.details.map(([l]) => l).join('\n'), { size: 14, line: 1.9, color: MUTED, padding: pad(0, 0, 0, 0) });
  const values = text('details-values', c.details.map(([, v]) => `<strong>${v}</strong>`).join('\n'), { size: 14, line: 1.9, padding: pad(0, 0, 0, 0) });
  const detailCols = add('details-cols', {
    type: 'ColumnsContainer',
    data: { style: { padding: pad(12, 20, 12, 20) }, props: { columnsCount: 2, columnsGap: 12, columnWidths: [45, 55], columns: [{ childrenIds: [labels] }, { childrenIds: [values] }] } },
  });
  const details = box('details', [detailCols], { bg: '#F8F5FF' });

  // Numbered next steps.
  const stepsTitle = text('steps-title', c.stepsTitle, { weight: 'bold', line: 1.45, padding: pad(18, 20, 6, 20) });
  const steps = text('steps', c.steps.join('\n'), { size: 14, line: 1.5, list: 'number', padding: pad(0, 20, 16, 20) });
  const stepsBox = box('steps-box', [stepsTitle, steps], { bg: '#FFFFFF' });

  // The button, and the link to copy if it doesn't work.
  const button = add('button', {
    type: 'Button',
    data: {
      props: { text: c.button, url: c.link, size: 'medium', buttonStyle: 'rounded', buttonBackgroundColor: BRAND, buttonTextColor: '#FFFFFF' },
      style: { textAlign: 'left', padding: pad(4, 32, c.copyLink ? 12 : 22, 32) },
    },
  });
  const copyLink = c.copyLink ? text('copy-link', `Button not working? Copy this link into your browser:\n${c.link}`, { size: 13, line: 1.5, color: MUTED, padding: pad(0, 32, 12, 32) }) : null;

  // "Didn't do this?" note, sign-off and footer.
  const noteText = text('note-text', c.note, { size: 13, line: 1.55, color: MUTED, padding: pad(14, 20, 14, 20) });
  const note = box('note', [noteText], { bg: '#F6F7F8', outer: pad(6, 32, 24, 32) });
  const signoff = text('signoff', 'Thank you,\nThe Fold Health Team', { padding: pad(0, 32, 32, 32) });
  const footBrand = add('foot-brand', { type: 'Heading', data: { props: { text: 'Fold Health', level: 'h3' }, style: { color: BRAND, fontSize: 18, fontWeight: 'bold', textAlign: 'left', padding: pad(28, 32, 0, 32) } } });
  const footText = text('foot-text', 'This is an account security email, so you can’t unsubscribe from it. Fold Health will never ask for your password by email.', { size: 12, line: 1.5, color: MUTED, padding: pad(16, 32, 28, 32) });
  const footer = add('footer', { type: 'Container', data: { role: 'footer', style: { backgroundColor: '#F4EEFF', padding: NO_PAD }, props: { childrenIds: [footBrand, footText] } } });

  const body = [header, greeting, ...intro, details, stepsBox, button, ...(copyLink ? [copyLink] : []), note, signoff, footer];
  return {
    root: { type: 'EmailLayout', data: { backdropColor: '#F6F7F8', canvasColor: '#FFFFFF', textColor: TEXT, fontFamily: 'MODERN_SANS', childrenIds: body } },
    ...blocks,
  };
}

export const ACCOUNT_SECURITY_EMAIL_TEMPLATES = [
  {
    systemKey: 'account_locked_v2',
    name: 'Account Security: Sign-in Paused',
    description: 'Sent when sign-in is paused after too many unsuccessful attempts.',
    subject: 'Sign-in to your Fold Health account is paused',
    doc: documentOf('sp', {
      title: 'Sign-in to your account is paused',
      art: 'security-illustration-locked.png',
      intro: [
        'We paused sign-in to your Fold Health account after {{attempts}} unsuccessful sign-in attempts. We do this to keep your account safe.',
        'You can’t sign in until your administrator unlocks your account. Waiting or trying again won’t unlock it. Your data is safe, and nothing in your account has changed.',
      ],
      details: [['Your User ID', '{{user_id}}'], ['Email', '{{email}}'], ['Paused on', '{{event_time}}'], ['Unsuccessful attempts', '{{attempts}}']],
      stepsTitle: 'What to do next',
      steps: ['Ask your administrator to unlock your account.', 'We’ll email you when your account is unlocked.', 'Then follow the steps in that email to sign in.'],
      button: 'Email your administrator',
      link: 'mailto:{{support_email}}',
      copyLink: false,
      note: 'Didn’t try to sign in? Someone else may have tried to use your account. Let your administrator know right away.',
    }),
  },
  {
    systemKey: 'account_unlocked_v2',
    name: 'Account Security: Account Unlocked',
    description: 'Sent when an administrator unlocks an account.',
    subject: 'Your Fold Health account is unlocked',
    doc: documentOf('au', {
      title: 'Your account is unlocked',
      art: 'security-illustration-unlocked.png',
      intro: ['Your administrator unlocked your Fold Health account. You can sign in again.'],
      details: [['Your User ID', '{{user_id}}'], ['Unlocked on', '{{event_time}}']],
      stepsTitle: 'Before you sign in',
      steps: [
        'Make sure you’re signing in to the account for {{email}}.',
        'Type your password carefully. Several unsuccessful attempts in a row will pause sign-in again.',
        'If you don’t remember your password, ask your administrator for help before you try again.',
      ],
      button: 'Sign in to Fold Health',
      link: '{{sign_in_link}}',
      copyLink: true,
      note: 'Didn’t ask for your account to be unlocked? Contact your administrator right away.',
    }),
  },
  {
    systemKey: 'signup_approved_v2',
    name: 'Account Security: Sign-up Approved',
    description: 'Sent when an administrator approves a sign-up request.',
    subject: 'Welcome to Fold Health: your account is approved',
    doc: documentOf('sa', {
      eyebrow: 'WELCOME TO FOLD HEALTH',
      title: 'Your account is approved',
      art: 'security-illustration-approved.png',
      intro: ['Your request to join Fold Health is approved. You can now sign in and start using your account.'],
      details: [['Your User ID', '{{user_id}}'], ['Email', '{{email}}'], ['Approved on', '{{event_time}}']],
      stepsTitle: 'Getting started',
      steps: [
        'Select Sign in to Fold Health below.',
        'Sign in with your User ID and password.',
        'Check your profile details. If anything looks wrong, let your administrator know.',
      ],
      button: 'Sign in to Fold Health',
      link: '{{sign_in_link}}',
      copyLink: true,
      note: 'Didn’t sign up for Fold Health? Don’t sign in. Contact {{support_email}} so we can look into it.',
    }),
  },
  {
    systemKey: 'account_activated_v2',
    name: 'Account Security: Account Active Again',
    description: 'Sent when a user sets a new password after an unlock and the account is active again.',
    subject: 'Your Fold Health account is active again',
    doc: documentOf('aa', {
      title: 'Your account is active again',
      art: 'security-illustration-activated.png',
      intro: [
        'You set a new password, and your Fold Health account is active again.',
        'Your old password no longer works. To keep your account safe, we signed you out on your other devices.',
      ],
      details: [['Your User ID', '{{user_id}}'], ['Activated on', '{{event_time}}']],
      stepsTitle: 'What this means',
      steps: [
        'Use your new password the next time you sign in.',
        'Sign in again on any other device you use for Fold Health.',
        'Update any saved password in your browser or password manager.',
      ],
      button: 'Sign in to Fold Health',
      link: '{{sign_in_link}}',
      copyLink: true,
      note: 'Didn’t set a new password? Contact your administrator right away so they can secure your account.',
    }),
  },
  {
    systemKey: 'password_changed_v2',
    name: 'Account Security: Password Changed',
    description: 'Sent when a user’s password is changed.',
    subject: 'Your Fold Health password was changed',
    doc: documentOf('pc', {
      title: 'Your password was changed',
      art: 'security-illustration-password-set.png',
      intro: [
        'The password for your Fold Health account was changed.',
        'To keep your account safe, we signed you out everywhere. Sign in again with your new password.',
      ],
      details: [['Your User ID', '{{user_id}}'], ['Changed on', '{{event_time}}']],
      stepsTitle: 'What to do next',
      steps: ['Sign in again with your new password.', 'Update any saved password in your browser or password manager.'],
      button: 'Sign in to Fold Health',
      link: '{{sign_in_link}}',
      copyLink: true,
      note: 'Didn’t change your password? Contact your administrator right away.',
    }),
  },
  {
    systemKey: 'unlock_link_v2',
    name: 'Account Security: Set a New Password',
    description: 'Sent when an administrator unlocks an account: a one-time link to set a new password.',
    subject: 'Set a new password to unlock your Fold Health account',
    doc: documentOf('un', {
      title: 'Set a new password to unlock your account',
      art: 'security-illustration-set-password.png',
      intro: [
        'Your administrator unlocked your Fold Health account. To finish, set a new password.',
        'The link below works once and expires in 24 hours.',
      ],
      details: [['Your User ID', '{{user_id}}'], ['Unlocked on', '{{event_time}}']],
      stepsTitle: 'What to do next',
      steps: [
        'Select Set a new password below.',
        'Choose a strong password that you don’t use anywhere else.',
        'Sign in to Fold Health with your new password.',
      ],
      button: 'Set a new password',
      link: '{{set_password_link}}',
      copyLink: true,
      note: 'Link expired? Ask your administrator to send a new one.\nDidn’t expect this email? Don’t use the link. Contact your administrator right away.',
    }),
  },
  {
    systemKey: 'patient_account_locked_v2',
    name: 'Account Security: Patient Sign-in Paused',
    description: 'Sent to a patient when patient app sign-in is paused after too many unsuccessful attempts. They unlock it by resetting their password.',
    subject: 'Sign-in to your Fold Health account is paused',
    doc: documentOf('psp', {
      title: 'Sign-in to your account is paused',
      art: 'security-illustration-locked.png',
      intro: [
        'We paused sign-in to your Fold Health account after {{attempts}} unsuccessful sign-in attempts. We do this to keep your account safe.',
        'To sign in again, reset your password. Waiting or trying your old password again won’t unlock it. Your health information is safe, and nothing in your account has changed.',
      ],
      details: [['Email', '{{email}}'], ['Paused on', '{{event_time}}'], ['Unsuccessful attempts', '{{attempts}}']],
      stepsTitle: 'What to do next',
      steps: [
        'Select Reset your password below.',
        'Choose a new password that you don’t use anywhere else.',
        'Sign in to Fold Health with your new password.',
      ],
      button: 'Reset your password',
      link: '{{reset_password_link}}',
      copyLink: true,
      note: 'Link expired? Choose Forgot password on the sign-in page to get a new one.\nDidn’t try to sign in? Someone else may have tried to use your account. Reset your password now, and let your care team know.',
    }),
  },
  {
    systemKey: 'patient_account_locked_admin_v2',
    name: 'Account Security: Patient Sign-in Paused (Care Team)',
    description: 'Sent to administrators when a patient’s sign-in is paused. The patient unlocks it by resetting their password; no admin action is needed.',
    subject: 'A patient’s sign-in to Fold Health is paused',
    doc: documentOf('psa', {
      title: 'A patient’s sign-in is paused',
      art: 'security-illustration-locked.png',
      intro: [
        'Sign-in to {{locked_patient_name}}’s Fold Health account was paused after {{attempts}} unsuccessful sign-in attempts.',
        'You don’t need to unlock it. The patient unlocks it by resetting their password, and we’ve emailed them a link to do that.',
      ],
      details: [['Patient', '{{locked_patient_name}}'], ['Patient ID', '{{locked_patient_id}}'], ['Email', '{{locked_patient_email}}'], ['Paused on', '{{event_time}}'], ['Unsuccessful attempts', '{{attempts}}']],
      stepsTitle: 'If the patient contacts you',
      steps: [
        'Ask them to reset their password using the link we emailed them.',
        'If the link expired, they can choose Forgot password on the patient app sign-in page.',
        'Once they set a new password, they can sign in again.',
      ],
      button: 'View patient profile',
      link: '{{patient_profile_link}}',
      copyLink: false,
      note: 'Didn’t expect this? Several unsuccessful attempts can mean someone else tried to sign in. Check with the patient before you share any account details.',
    }),
  },
];

/** campaigns row for scripts/seed.js, alongside the existing account emails. */
export const accountSecurityEmailTemplateToRow = (t) => ({
  system_key: t.systemKey,
  name: t.name,
  description: t.description,
  channel: 'email',
  section: 'running',
  category: 'Account Security',
  subject_line: t.subject,
  email_template: t.doc,
  email_html: renderEmailHtml(t.doc, { theme: 'light', compliance: null }),
});
