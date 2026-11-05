import { describe, expect, it } from 'vitest';
import { assessmentSuggestionsFor, withAssessmentSuggestions } from './carePlanRecommendation';

const phq9 = { id: 's1', templateId: 't-bh', programCodes: [], reason: 'PHQ-9 Total score 15 on PHQ-9' };
const ccmOnly = { id: 's2', templateId: 't-dm', programCodes: ['CCM'], reason: 'Answered "Yes" to "Insulin?" on Intake' };

describe('assessmentSuggestionsFor', () => {
  it('keeps suggestions for any program and for this program', () => {
    expect(assessmentSuggestionsFor([phq9, ccmOnly], 'CCM').map(s => s.id)).toEqual(['s1', 's2']);
  });
  it('drops suggestions sent for another program', () => {
    expect(assessmentSuggestionsFor([phq9, ccmOnly], 'APCM').map(s => s.id)).toEqual(['s1']);
  });
  it('drops templates already applied to the plan', () => {
    expect(assessmentSuggestionsFor([phq9, ccmOnly], 'CCM', ['t-bh']).map(s => s.id)).toEqual(['s2']);
  });
});

describe('withAssessmentSuggestions', () => {
  const known = ['t-bh', 't-dm'];

  it('adds a suggested template as an assessment match', () => {
    expect(withAssessmentSuggestions([], [phq9], known)).toEqual([
      { templateId: 't-bh', rule: 'Assessment rule', criteria: ['PHQ-9 Total score 15 on PHQ-9'] },
    ]);
  });
  it('adds the reason to a template an automation also matched', () => {
    const auto = [{ templateId: 't-bh', rule: 'Depression screen', criteria: ['Has Depression'] }];
    expect(withAssessmentSuggestions(auto, [phq9], known)).toEqual([
      { templateId: 't-bh', rule: 'Depression screen', criteria: ['Has Depression', 'PHQ-9 Total score 15 on PHQ-9'] },
    ]);
    expect(auto[0].criteria).toEqual(['Has Depression']);
  });
  it('skips templates no longer in the library', () => {
    expect(withAssessmentSuggestions([], [phq9], ['t-dm'])).toEqual([]);
  });
  it('lists a reason once when two suggestions repeat it', () => {
    expect(withAssessmentSuggestions([], [phq9, { ...phq9, id: 's3' }], known)[0].criteria).toHaveLength(1);
  });
});
