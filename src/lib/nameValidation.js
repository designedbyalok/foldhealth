/**
 * Shared rules for profile display names: both `first_name` and `last_name`
 * must be present and start with a capital.
 *
 * These lived in `features/settings/account/InviteUserDrawer.utils.js`, which
 * was fine while the Invite drawer and Account panel were the only validators.
 * PreferencesDrawer lives in `src/components/`, and a component importing from
 * a feature is backwards layering — so the rule moved here and both original
 * call sites now import it from `lib`.
 *
 * `\p{Lu}` rather than `A-Z`: staff names include accented capitals (É, Ø, Ż)
 * and an `A-Z` test would reject a correctly-capitalised name.
 */
export const NAME_CAPITALIZED = /^\p{Lu}/u;

export function isCapitalizedName(str) {
  return NAME_CAPITALIZED.test((str || '').trim());
}

/** Present and capitalised. Empty/whitespace fails. */
export function isValidNamePart(str) {
  const v = (str || '').trim();
  return v.length > 0 && isCapitalizedName(v);
}

/**
 * Split a display name into { first, last } the same way the database trigger
 * does: first whitespace-delimited token is the first name, everything after
 * it is the last name.
 *
 * This is a convention, not a fact — "Abhay Pratap Chaudhary" could plausibly
 * be first="Abhay Pratap". Keeping the JS and SQL implementations identical
 * matters more than being clever, so a client-side derive and a trigger-side
 * derive never disagree about the same input.
 *
 * Returns nulls when there is nothing to split, so callers can tell
 * "underivable" apart from "derived an empty string".
 */
export function splitFullName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/** Capitalise the first character, leaving the rest of the string alone. */
export function capitalizeFirst(str) {
  const v = (str || '').trim();
  if (!v) return v;
  return v[0].toLocaleUpperCase() + v.slice(1);
}
