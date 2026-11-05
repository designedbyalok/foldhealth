import { DEFAULT_ITEMS } from '../../forms/builder/memberConsent';

// What the care team reads or shows the patient before capturing consent.
// CCM, APCM and BHI share their wording with the Forms "Member Consent"
// component so a form and a capture say the same thing.
const agreement = (id) => DEFAULT_ITEMS.find(i => i.id === id)?.agreement || '';

const RIGHTS = 'You can stop at any time, and cost sharing may apply.';

export const CONSENT_SCRIPTS = {
  'program:CCM': `${agreement('ccm')} Only one practitioner can bill for CCM in a calendar month. ${RIGHTS}`,
  'program:APCM': agreement('apcm'),
  'program:RPM': `Remote Patient Monitoring (RPM) uses a connected device to send your readings, such as blood pressure or glucose, to your care team between visits. Only one practitioner can bill for RPM in a calendar month. ${RIGHTS}`,
  'program:BHI': `${agreement('bhi')} ${RIGHTS}`,
  'channel:call': 'May we call you at this number about your care, appointments and test results?',
  'channel:sms': 'May we send text messages to this number about your care and appointments? Message and data rates may apply. Reply STOP at any time to stop.',
  'channel:email': 'May we email you about your care and appointments? Emails may include your name and appointment details.',
  'other:data_sharing': 'May we share your health information with the other providers, care team members and health plans involved in your care, so they can coordinate your treatment? You can withdraw this consent at any time.',
};

export const consentScript = (scopeType, scope) => CONSENT_SCRIPTS[`${scopeType}:${scope}`] || '';

// The full agreement shown in Capture Consent where one exists (Figma
// 1:35100, 41:6654). Each block is a paragraph (`text`) or a labelled list
// (`label`, optional `text` lead-in, `items`). Scopes without one show their
// script. With a `statement`, the patient answers it with Accept / Decline
// instead of the give / choose-not-to checkboxes; `bare` drops the question
// above the agreement and the Notes field.
export const CONSENT_AGREEMENTS = {
  'program:APCM': {
    title: 'Agreement to Receive Medicare Advanced Primary Care Management (APCM) Services',
    blocks: [
      { text: 'Medicare covers Advanced Primary Care Management (APCM) services provided monthly by your primary care practitioner.' },
      { text: 'In agreeing to receive Medicare Advanced Primary Care Management (APCM) services at this practice, I understand that my primary care practitioner is willing to provide such services to me, including the following:' },
      {
        label: 'Access and continuity of care:',
        items: [
          '24/7 access to the care team for urgent care needs.',
          'The ability to get successive, routine appointments with a member of the care team.',
        ],
      },
      {
        label: 'Comprehensive care management:',
        items: [
          'Needs assessment, including medical and psychosocial.',
          'Helping ensure I receive recommended preventive services.',
          'Medication management and support.',
          'A personalized care plan that outlines my health goals and needs and is regularly reviewed and updated.',
          'A copy of my care plan accessible to me, my caregivers, and members of my care team.',
        ],
      },
      {
        label: 'Care coordination:',
        text: 'Coordinating my care across settings, including referrals to other providers, such as:',
        items: [
          'Communicating with all providers of care, including home and community-based providers, hospitals, skilled nursing facilities, and others.',
          'Follow-up care after emergency department visits or discharge from a hospital, skilled nursing facility, or other health care facility.',
        ],
      },
      {
        label: 'Enhanced communication opportunities:',
        items: [
          'Supporting other ways for me and my caregivers to communicate with my practitioner and care team, such as patient portals, secure messaging, and e-consults.',
        ],
      },
      { text: 'I understand APCM services are subject to the usual Medicare deductible and coinsurance applied to practitioner services.' },
      { text: 'I also understand that I can cancel this agreement at any time (effective at the end of a calendar month).' },
    ],
  },
  'other:data_sharing': {
    title: 'Agreement to Give Data Sharing Services',
    bare: true,
    blocks: [
      { text: 'Hello,' },
      { text: 'Collaborative Care is a health benefit resource offered by Amerilux International within your Health Plan. When you sign up for the Health Plan, you access their team that works to get you great care options for specialty level medical options and prescription drugs at no cost. Through their team and their partners, they work together behind the scenes to find ways to help you get the most out of your health benefits, like recommending top doctors and spotting opportunities to improve your care.' },
      { text: 'To do this, they have added another partner tool called Milu Health. In conjunction with Collaborative Care, Milu securely requests your health records from your healthcare providers on an ongoing basis. This data is clinically reviewed, and you may receive free text message encounters with Milu nurses and pharmacists, to identify any medication issues, care gaps, or other ways to proactively support your health while saving you money. Since you are enrolled in the Health Plan, you now will have the benefit of this new tool with Collaborative Care.' },
      { text: 'All we need you to do is agree to the Terms of Service and acknowledge the Privacy Policy and Notice of Privacy Practices by selecting "Accept" and signing your name electronically below. Review Milu Health\'s Terms of Service, Privacy Policy and HIPAA Notice of Privacy Practices before you sign.' },
    ],
    statement: 'I give my consent to Milu\'s Terms of Service and acknowledge the Privacy Policy and Notice of Privacy Practices.',
  },
};

export const consentAgreement = (scopeType, scope) => CONSENT_AGREEMENTS[`${scopeType}:${scope}`] || null;
