import { PROGRAM_STEPS } from '../../../../../data/programActivityMock';

export const TASK_STATUS_LABEL = { pending: 'Pending', missed: 'Missed', completed: 'Completed' };
export const capFirst = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
export const EMPTY_TASK_FILTERS = { status: [], priority: [], dueDate: [], completedDate: [] };
export const LETTER_SUB_TABS = ['All', 'Sent', 'Not Sent'];
export const EMPTY_LETTER_FILTERS = { fileType: [], sentVia: [], lastSent: [], sentBy: [] };

export const fmtCompletedDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

export const initialsOf = (name = '') =>
  name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';

export const stepsFor = (code) => PROGRAM_STEPS[code] || PROGRAM_STEPS.SNP;

/**
 * The program's steps without its Care Plan step, for orgs that keep one
 * patient-level care plan instead (care_plan_mode = 'patient'). Dropping it
 * from the list also drops it from progress, so a hidden mandatory step
 * never holds a program back.
 */
export function withoutCarePlanStep(steps) {
  return steps
    .filter(s => s.name !== 'Care Plan')
    .map(s => (s.type === 'section' ? { ...s, children: s.children.filter(c => c.name !== 'Care Plan') } : s));
}
export const flatSteps = (list) => list.flatMap(s => (s.type === 'section' ? s.children : [s]));

export function letterPdfBlob(letter) {
  if (!letter?.contentBase64) return null;
  const bin = atob(letter.contentBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'application/pdf' });
}

export function downloadLetters(chosen, toast) {
  if (!chosen || chosen.length === 0) return;
  chosen.forEach(letter => {
    const pdf = letterPdfBlob(letter);
    const blob = pdf || new Blob([
      `${letter.fileName}\n\nFile Type: ${letter.fileType}\nSent Via: ${(letter.sentVia || []).join(', ')}\nLast Sent: ${letter.lastSent}\nSent By: ${letter.sentBy}\n`,
    ], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdf ? (letter.sourceFile || `${letter.fileName}.pdf`) : `${letter.fileName}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
  toast.success(
    chosen.length === 1 ? 'File downloaded successfully' : `${chosen.length} files downloaded successfully`,
  );
}

export const ASSESSMENT_STEPS = {
  HRA: { formName: 'HRA Assessment form', title: 'Health Risk Assessment', filledBy: 'Annette Brave', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
  'BRCSI Assessment': { formName: 'BRCSI Assessment form', title: 'BRCSI Assessment', filledBy: 'Annette Brave', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
  'SNP Assessment': { formName: 'SNP Assessment form', title: 'SNP Assessment', filledBy: 'Annette Brave', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
  'Post IP Assessment': { formName: 'Post IP Assessment form', title: 'Post IP Assessment', filledBy: 'Annette Brave', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
  'Post Visit Checklist': { checklist: true, title: 'Post Visit Check List', filledBy: 'Robert Fox', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
  'Post-Visit': { checklist: true, title: 'Post Visit Check List', filledBy: 'Robert Fox', filledDate: '10/11/24', reviewedBy: 'Robert Fox', reviewedDate: '10/11/24' },
};

export const DEFAULT_LETTER_NAMES = ['Intro or Welcome Letter - Patient', 'UTR Letter', 'Member Flyers'];

// MM/DD/YY — the stamp format the step headers use for sign-off attribution.
export function mmddyy(d = new Date()) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}
