/**
 * Clamp a count for display in a fixed-width badge.
 *
 * The sidebar nav badge and the TopBar bell badge are both small pills sized
 * for two digits. An uncapped count is a layout bug waiting on a busy
 * account — 100+ unread would stretch the pill past the icon it is anchored
 * to. Anything over the cap reads "99+", which is all the precision a badge
 * is for; the exact number is in the panel behind it.
 */
export function formatBadgeCount(n, cap = 99) {
  const v = Number(n) || 0;
  if (v <= 0) return '';
  return v > cap ? `${cap}+` : String(v);
}
