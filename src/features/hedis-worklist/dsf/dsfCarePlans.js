// Verbatim care-plan copy for the DSF-A / DSF-B workflow. Each entry is
// the outcome-panel title + the exact bullet list rendered inside
// `CarePlanOutcomePanel`. Copy is taken verbatim from the user story
// (Section 4 "Result-Driven Display Logic & Care Plan Text") and MUST
// NOT be paraphrased: clinical review sits on the exact wording.

const WELLNESS_BULLETS = [
  'Encourage maintenance of healthy lifestyle habits, including regular exercise, adequate sleep, stress management, and social engagement.',
  'Continue routine heart healthy lifestyle and mental health monitoring.',
  'Repeat depression screening per clinic protocol or sooner if symptoms develop.',
  'Patient advised to contact the office if mood changes, depressive symptoms, or mental health concerns arise.',
];

const MILD_NO_BULLETS = [
  'Follow-up PCP for active surveillance.',
  'Advised contacting the office if mood changes, depressive symptoms, or mental health concerns arise.',
  'Reinforce lifestyle supplemental interventions: internet-based psychotherapy, self-help interventions (support groups, smartphone applications), mind-body interventions (yoga, tai chi), and bright light therapy.',
  'Reinforce ER precautions for active suicidal or homicidal ideations.',
  'Reinforce mental health line if mental crisis is imminent: call 988.',
  'Reinforce mental health support or resources are available if needed: call 800-854-7771, the 24/7 Los Angeles County Help Line for Mental Health.',
];

const MILD_YES_BULLETS = [
  'Follow-up with PCP in 2-4 weeks to discuss anti-depressant intervention and/or referral for Psychotherapy.',
  'Reinforce lifestyle supplemental interventions: internet-based psychotherapy, self-help interventions (support groups, smartphone applications), mind-body interventions (yoga, tai chi), and bright light therapy.',
  'Reinforce ER precautions for active suicidal or homicidal ideations.',
  'Reinforce mental health line if mental crisis is imminent: call 988.',
  'Reinforce mental health support or resources are available if needed: call 800-854-7771, the 24/7 Los Angeles County Help Line for Mental Health.',
  'Results will be communicated to PCP office.',
];

const MODERATE_BULLETS = [
  'Follow-up with PCP in 2-4 weeks to discuss initiation of anti-depressant and/or referral to Psychiatrist/Psychotherapist for further intervention.',
  'Provided lifestyle supplemental interventions: internet-based psychotherapy, self-help interventions (support groups, smartphone applications), mind-body interventions (yoga, tai chi), and bright light therapy.',
  'Reinforce ER precautions for active suicidal or homicidal ideations.',
  'Reinforce mental health line if mental crisis is imminent: call 988.',
  'Reinforce mental health support or resources are available if needed: call 800-854-7771, the 24/7 Los Angeles County Help Line for Mental Health.',
  'Results will be communicated to PCP office.',
  'Patient verbalizes understanding and agrees with plan.',
];

const SEVERE_BULLETS = [
  'Denies any suicidal thoughts, intent or plan at this time.',
  'Strongly advise to follow-up with PCP in 1-2 weeks for initiation of anti-depressant and referral to Psychiatrist and behavioral therapist.',
  'Reinforce lifestyle supplemental interventions: internet-based psychotherapy, self-help interventions (support groups, smartphone applications), mind-body interventions (yoga, tai chi), and bright light therapy.',
  'Reinforce ER precautions for active suicidal or homicidal ideations.',
  'Reinforce mental health line if mental crisis is imminent: call 988.',
  'Reinforce mental health support or resources are available if needed: call 800-854-7771, the 24/7 Los Angeles County Help Line for Mental Health.',
  'Results will be communicated to PCP office.',
  'Patient verbalizes understanding and agrees with plan.',
];

const DECLINE_BULLETS = [
  'Patient declines further evaluation and treatment at this time.',
  'Risks of untreated depression and potential benefits of treatment were reviewed.',
  'Patient verbalizes understanding and demonstrates decision-making capacity.',
  'Patient denies suicidal ideation, homicidal ideation, intent, or plan.',
  'No acute safety concerns identified.',
  'Advised to follow-up with PCP to be reassessed as clinically indicated.',
  'Reinforce ER precautions for active suicidal or homicidal ideations.',
  'Reinforce mental health line if mental crisis is imminent: call 988.',
  'Reinforce mental health support or resources are available if needed: call 800-854-7771, the 24/7 Los Angeles County Help Line for Mental Health.',
  'Results will be communicated to PCP office.',
  'Patient verbalizes understanding and agrees with plan.',
];

export const DSF_CARE_PLANS = {
  phq2Negative:  { title: 'Care Plan - PHQ-2 Negative',   bullets: WELLNESS_BULLETS },
  phq9Minimal:   { title: 'Care Plan - PHQ-9 score 0-4',  bullets: WELLNESS_BULLETS },
  phq9MildNo:    { title: 'Care Plan - PHQ-9 Mild (No)',  bullets: MILD_NO_BULLETS },
  phq9MildYes:   { title: 'Care Plan - PHQ-9 Mild (Yes)', bullets: MILD_YES_BULLETS },
  phq9Moderate:  { title: 'Care Plan - PHQ-9 Moderate',   bullets: MODERATE_BULLETS },
  phq9Severe:    { title: 'Care Plan - PHQ-9 Severe',     bullets: SEVERE_BULLETS },
  decline:       { title: 'Care Plan - Patient Declined', bullets: DECLINE_BULLETS },
};
