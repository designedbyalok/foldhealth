// perfect-freehand stroke options: mirrors the controls shown in the
// @uiw/react-signature demo (Size / Smoothing / Thinning / Streamline).
export const SIGNATURE_OPTIONS = {
  size: 4,
  smoothing: 0.46,
  thinning: 0.73,
  streamline: 0.5,
};

// Persist drawn signatures to localStorage so users can reuse a signature
// across attestation sessions. Stored per browser, capped at 5 entries to
// keep the panel scannable.
export const SAVED_SIGNATURES_KEY = 'apcm-saved-signatures';
export const MAX_SAVED_SIGNATURES = 5;

export function loadSavedSignatures() {
  try {
    const raw = localStorage.getItem(SAVED_SIGNATURES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function persistSavedSignatures(list) {
  try { localStorage.setItem(SAVED_SIGNATURES_KEY, JSON.stringify(list)); }
  catch { /* quota or private mode: silent */ }
}

export function serializeSignatureSvg(svgEl) {
  if (!svgEl) return null;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  // Ensure a viewBox is set so the SVG scales correctly in thumbnails.
  if (!clone.getAttribute('viewBox')) {
    const w = clone.getAttribute('width') || svgEl.clientWidth;
    const h = clone.getAttribute('height') || svgEl.clientHeight;
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  return new XMLSerializer().serializeToString(clone);
}

export const SIGNATURE_MODES = [
  { key: 'type', label: 'Type', icon: 'solar:keyboard-linear' },
  { key: 'draw', label: 'Draw', icon: 'solar:pen-linear' },
];

export const SIGNATURE_HINT = {
  type: 'By typing your name above you are applying your digital signature and agree this constitutes a legally binding signature.',
  draw: 'By drawing your signature above you are applying your digital signature and agree this constitutes a legally binding signature.',
};

export const ATTESTATION_TEXT =
  'I attest that this medical record entry accurately reflects the history, examination, ' +
  'assessments, diagnoses, and procedures/services that I personally performed or directly ' +
  'supervised on the date(s) of service indicated. I further attest that all services documented ' +
  'were medically necessary, appropriate to the patient\'s condition, and provided in accordance ' +
  'with applicable standards of care and payer requirements. To the best of my knowledge, the ' +
  'information recorded in this note is complete and accurate.';

// Builds the props shape expected by the shared PatientBanner component
// from an APCM patient record (which lacks gender/age: those fields are
// optional in the banner and will simply not render).
export function toBannerProps(patient) {
  if (!patient) return null;
  const initials = patient.renderingProviderInitials
    || (patient.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('');
  return {
    initials,
    name: patient.name,
    memberId: patient.memberId,
  };
}

export function now() {
  return new Date().toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  });
}
