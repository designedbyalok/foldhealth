// Recommend library goals from a patient's problem list (PAMI/Hx "Problems").
// A problem title is mapped to condition keyword groups; a library goal is
// recommended when its condition tags / title mention any keyword of a matched
// group. Erring toward inclusion is fine — these are suggestions.

const CONDITION_KEYWORDS = {
  diabetes: ['diabetes', 'diabetic', 'glucose', 'glycemic', 'a1c', 'hba1c', 'insulin'],
  hypertension: ['hypertension', 'blood pressure', 'htn'],
  copd: ['copd', 'chronic obstructive', 'respiratory', 'oxygen', 'inhaler', 'pulmonary'],
  asthma: ['asthma'],
  hyperlipidemia: ['hyperlipidemia', 'lipid', 'cholesterol', 'ldl'],
  obesity: ['obesity', 'obese', 'weight', 'metabolic', 'bmi'],
  kidney: ['kidney', 'renal', 'ckd', 'nephro'],
  heart: ['cardiovascular', 'coronary', 'heart failure', 'cardiac', 'arrhythmia'],
  tobacco: ['tobacco', 'smok', 'nicotine'],
};

const activeProblemTokens = (problems = []) => {
  const tokens = new Set();
  for (const p of problems) {
    if ((p?.status || 'Active') !== 'Active') continue;
    const t = (p?.title || '').toLowerCase();
    for (const words of Object.values(CONDITION_KEYWORDS)) {
      if (words.some(w => t.includes(w))) words.forEach(w => tokens.add(w));
    }
  }
  return tokens;
};

/**
 * @returns {Set<string>} ids of library goals recommended for these problems.
 */
export function recommendedGoalIds(problems, libraryGoals = []) {
  const tokens = activeProblemTokens(problems);
  const out = new Set();
  if (!tokens.size) return out;
  const toks = [...tokens];
  for (const g of libraryGoals) {
    const hay = [
      (Array.isArray(g?.conditions) ? g.conditions.join(' ') : ''),
      g?.title || '',
      g?.category || '',
    ].join(' ').toLowerCase();
    if (toks.some(tok => hay.includes(tok))) out.add(g.id);
  }
  return out;
}
