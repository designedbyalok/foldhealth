// Time past the base code bills as an add-on: 99439 for each additional 20
// minutes of CCM (up to two a month), 99489 for each additional 30 minutes of
// complex CCM. Shown here, in the billing step, and nowhere in the work queue.
export function addOnNote(complexity, overshootSeconds) {
  const complex = complexity === 'high';
  const code = complex ? '99489' : '99439';
  const block = complex ? 30 : 20;
  const units = Math.max(0, Math.floor(overshootSeconds / (block * 60)));
  const counted = complex ? units : Math.min(units, 2);
  const rule = `Each additional ${block} minutes adds ${code}${complex ? '' : ', up to two a month'}.`;
  return counted ? `${rule} ${code} × ${counted} so far this month.` : rule;
}
