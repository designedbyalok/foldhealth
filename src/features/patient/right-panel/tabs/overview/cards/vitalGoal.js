// The goal's leading number ("120/80" -> 120 systolic, "7%" -> 7), drawn as
// the target line on a vital's trend; null when the goal has no number.
export function goalTarget(goal) {
  const m = String(goal || '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}
