// Org-scoped first-login defaults.
//
// The auth layer calls maybeApplyOrgDefaults() every time a session is
// established (SIGNED_IN + initial getSession on reload). The helper is a
// no-op unless the user's email matches a rule below, AND the marker for
// that user hasn't been written yet: so a user can still switch theme or
// nav style after and we won't clobber it on next login.

const ORG_RULES = [
  {
    // Astrana users land on the plum palette with the minimal (light) sidebar
    // the first time they sign in on a given browser.
    domain: 'astranahealth.com',
    theme: 'plum',
    navStyle: 'light',
    markerPrefix: 'orgDefaults:astranahealth',
  },
];

function matchRule(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase();
  if (!domain) return null;
  return ORG_RULES.find(r => r.domain === domain) || null;
}

export function maybeApplyOrgDefaults(user, { setTheme, setNavStyle }) {
  const rule = matchRule(user?.email);
  if (!rule || !user?.id) return;
  const markerKey = `${rule.markerPrefix}:${user.id}`;
  try {
    if (localStorage.getItem(markerKey)) return;
    if (rule.theme) setTheme(rule.theme);
    if (rule.navStyle) setNavStyle(rule.navStyle);
    localStorage.setItem(markerKey, '1');
  } catch {
    /* localStorage unavailable: skip silently, we'll try again next login */
  }
}
