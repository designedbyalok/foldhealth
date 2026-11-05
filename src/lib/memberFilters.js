import { genderLabelFrom } from './patientDisplay';

// Member-domain filter vocabulary shared by every worklist, so Gender,
// Language and Member Status show the same options everywhere. Rows store
// codes (M/F, ISO 639-1 languages); the filters show and save the labels.

export const GENDER_FILTER_OPTIONS = ['Male', 'Female', 'Other'];

export const MEMBER_STATUS_FILTER_OPTIONS = ['Active', 'Inactive', 'Suspended'];

// Code → label for every language code the worklist data carries. `ch` is a
// legacy CCM code for Chinese.
const LANGUAGE_LABEL = {
  en: 'English', es: 'Spanish', ar: 'Arabic', bn: 'Bengali', yue: 'Cantonese',
  zh: 'Chinese', ch: 'Chinese', fr: 'French', hi: 'Hindi', it: 'Italian',
  ja: 'Japanese', ko: 'Korean', pa: 'Punjabi', tl: 'Tagalog', vi: 'Vietnamese',
};

// English and Spanish first (most members), then alphabetical.
export const LANGUAGE_FILTER_OPTIONS = [...new Set(Object.values(LANGUAGE_LABEL))];

// For filter bars that store the row's code and show the label (TOC / TCM).
export const LANGUAGE_FILTER_CODE_OPTIONS = LANGUAGE_FILTER_OPTIONS.map(label => ({
  value: Object.keys(LANGUAGE_LABEL).find(code => LANGUAGE_LABEL[code] === label),
  label,
}));

export function memberGenderLabel(code) {
  if (code === 'O') return 'Other';
  return genderLabelFrom(code) || null;
}

export function memberLanguageLabel(code) {
  if (!code) return null;
  return LANGUAGE_LABEL[code] || code;
}
