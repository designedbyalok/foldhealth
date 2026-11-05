const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const money = (n) => usd.format(Number(n) || 0);
export const moneyWhole = (n) => usdWhole.format(Number(n) || 0);

/** 3000 → "3K", 12500 → "12.5K", 800 → "800". */
export function short(n) {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  return `${Number((v / 1000).toFixed(1))}K`;
}

export const STATUSES = [
  { key: 'pending', label: 'Pending', tone: 'warning', icon: 'solar:clock-circle-linear' },
  { key: 'submitted', label: 'Submitted', tone: 'info', icon: 'solar:upload-minimalistic-linear' },
  { key: 'in_review', label: 'In Review', tone: 'info', icon: 'solar:refresh-circle-linear' },
  { key: 'paid', label: 'Paid', tone: 'success', icon: 'solar:check-circle-linear' },
  { key: 'rejected', label: 'Rejected', tone: 'error', icon: 'solar:close-circle-linear' },
];
export const statusOf = (key) => STATUSES.find((s) => s.key === key) || STATUSES[0];

/** Date-only strings are parsed as local dates, never through UTC. */
export function serviceDate(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/**
 * One coverage row in plain words. Spent and limits are per network; the
 * row is met when either network reaches its limit (plans differ, so this
 * says which one).
 */
export function accumulatorSummary(a) {
  const inSpent = Number(a.in_spent) || 0;
  const outSpent = Number(a.out_spent) || 0;
  const total = inSpent + outSpent;
  const limit = (Number(a.in_limit) || 0) + (Number(a.out_limit) || 0);
  const name = a.label.toLowerCase();
  if (total === 0) return { total, limit, met: false, text: `No deductions yet. Nothing has counted toward your ${name} this year.` };
  const inMet = a.in_limit && inSpent >= a.in_limit;
  const outMet = a.out_limit && outSpent >= a.out_limit;
  if (inMet || outMet) {
    return {
      total, limit, met: true,
      text: `You have reached your ${inMet ? 'in-network' : 'out-of-network'} ${name}. Your plan now pays its full share for ${inMet ? 'in-network' : 'out-of-network'} care for the rest of the year.`,
    };
  }
  return {
    total, limit, met: false,
    text: `You have spent ${moneyWhole(inSpent)} in-network and ${moneyWhole(outSpent)} out-of-network toward your ${name}. `
      + `${moneyWhole(Math.max(a.in_limit - inSpent, 0))} more in-network or ${moneyWhole(Math.max(a.out_limit - outSpent, 0))} more out-of-network and you reach it.`,
  };
}
