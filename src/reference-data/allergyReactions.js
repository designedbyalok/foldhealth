// HL7 IPS "Allergy Reaction SNOMED CT IPS Free Set", a static list, no API
// needed. Stands in until the NLM account is approved and reactions can be
// looked up against the full terminology the way allergens already are.
//
// Every entry is SNOMED CT, so the system is a constant rather than a field.
export const REACTION_SYSTEM = 'http://snomed.info/sct';

export const ALLERGY_REACTIONS = [
  { code: '39579001', display: 'Anaphylaxis' },
  { code: '41291007', display: 'Angioedema' },
  { code: '126485001', display: 'Urticaria (hives)' },
  { code: '271807003', display: 'Eruption of skin (rash)' },
  { code: '418363000', display: 'Itching of skin' },
  { code: '267036007', display: 'Dyspnea (shortness of breath)' },
  { code: '4386001', display: 'Bronchospasm' },
  { code: '51599000', display: 'Edema of larynx' },
  { code: '410430005', display: 'Cardiorespiratory arrest' },
  { code: '698247007', display: 'Cardiac arrhythmia' },
  { code: '91175000', display: 'Seizure' },
  { code: '422400008', display: 'Vomiting' },
  { code: '422587007', display: 'Nausea' },
  { code: '62315008', display: 'Diarrhea' },
  { code: '9826008', display: 'Conjunctivitis' },
  { code: '162290004', display: 'Dry eyes' },
  { code: '781682005', display: 'Hyperemia of eye' },
  { code: '70076002', display: 'Rhinitis' },
  { code: '76067001', display: 'Sneezing' },
  { code: '49727002', display: 'Cough' },
  { code: '195967001', display: 'Asthma' },
  { code: '24079001', display: 'Atopic dermatitis' },
  { code: '43116000', display: 'Eczema' },
  { code: '247472004', display: 'Weal' },
  { code: '271757001', display: 'Papular eruption' },
  { code: '271759003', display: 'Bullous eruption' },
  { code: '31996006', display: 'Vasculitis' },
  { code: '73442001', display: 'Stevens-Johnson syndrome' },
  { code: '768962006', display: 'Lyell syndrome (toxic epidermal necrolysis)' },
  { code: '702809001', display: 'Drug reaction with eosinophilia and systemic symptoms (DRESS)' },
];
