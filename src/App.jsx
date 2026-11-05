import { useEffect, useRef, useState, lazy, Suspense } from 'react';
const Analytics = lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })).catch(() => ({ default: () => null })));
const SpeedInsights = lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })).catch(() => ({ default: () => null })));
import { AppLayout } from './layouts/AppLayout';
import { AppProviders } from './features/AppProviders';
import { Toaster } from './components/Toast/Toast';
import { UpdateAvailableCard } from './components/UpdateCard/UpdateCard';
import { FoldHealthLogo } from './components/FoldHealthLogo/FoldHealthLogo';
import styles from './App.module.css';
import { LoginPage } from './features/auth/LoginPage';
import { isPendingApprovalSession, PENDING_APPROVAL_NOTICE } from './features/auth/pendingApproval';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { UnlockAccountPage } from './features/auth/UnlockAccountPage';
import { reportSignInSuccess, takeOAuthSignIn } from './features/auth/accountSecurity';
import { useAppStore } from './store/useAppStore';
import { supabase } from './lib/supabase';
import { initRouter } from './lib/router';
import { track, trackPageview, scrubAnalyticsEvent } from './lib/tracking';
import { maybeApplyOrgDefaults } from './lib/orgDefaults';

// Public, shareable form fill-view (#/f/{id}): rendered without auth so a
// link can be opened by anyone. RLS on forms/form_responses ('Allow all')
// permits anonymous read + submit.
const PublicFormView = lazy(() => import('./features/forms/view/FormView').then(m => ({ default: m.FormView })));
// The patient's Comms page (#/p/{token}): their chat with the care team and
// browser calls. No sign-in, for patients and for staff checking the view.
const PatientCommsPage = lazy(() => import('./features/patient-portal/PatientCommsPage').then(m => ({ default: m.PatientCommsPage })));

function App() {
  const routerInit = useRef(false);
  const [session, setSession] = useState(undefined); // undefined = loading, null = unauthenticated
  // Message handed from ResetPasswordPage to LoginPage (e.g. "awaiting approval").
  const [loginNotice, setLoginNotice] = useState('');
  const [signOutRequest, setSignOutRequest] = useState(0);
  // Dev builds only: in a production bundle a hand-set sessionStorage flag
  // must not open the app shell without a Supabase session.
  const [bypassed, setBypassed] = useState(() => import.meta.env.DEV && sessionStorage.getItem('__auth_bypass') === 'true');
  // Set when Supabase fires PASSWORD_RECOVERY OR when the URL hash carries
  // the recovery tokens directly (e.g. before supabase-js has processed
  // them). Initial check handles the brief window between mount and the
  // PASSWORD_RECOVERY event firing. `type=signup` covers invited users
  // arriving via the confirmation email: we route them to the same page
  // to set an initial password (see `invited` metadata check below).
  const [recoveryMode, setRecoveryMode] = useState(() => {
    const h = window.location.hash || '';
    // `token_hash=` covers the custom email-template links
    // (#/reset-password?token_hash=…), see ResetPasswordPage for the flow.
    return /type=recovery/.test(h) || /type=signup/.test(h)
      || /token_hash=/.test(h) || h.startsWith('#/reset-password');
  });
  const recoveryModeRef = useRef(recoveryMode);
  useEffect(() => { recoveryModeRef.current = recoveryMode; }, [recoveryMode]);
  // Featurebase identity-verification JWT: minted server-side by the
  // featurebase-jwt Edge Function (the signing secret never reaches the
  // client). The Help popover's "Give Feedback" builds the portal SSO link
  // from it so users land on the feedback portal already signed in.
  // Dev-bypass sessions stay anonymous (plain portal link).
  //
  // This effect only *invalidates*. The mint moved to `ensureFeaturebaseJwt`,
  // called when the user reaches for Help (Sidebar), because minting it here
  // meant one Edge Function invocation on every page load, 0.5–4.1 s
  // measured: to prepare a link most sessions never click. Any session
  // change (logout, token refresh, switching user) drops the old JWT so it
  // can never be sent for the wrong identity; the next Help open re-mints.
  useEffect(() => {
    useAppStore.getState().resetFeaturebaseJwt();
  }, [session]);

  // Track the hash so the public-form route reacts to navigation.
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => {
      const newHash = window.location.hash;
      setHash(newHash);
      const path = newHash.replace(/^#/, '') || '/';
      trackPageview(path);
    };
    window.addEventListener('hashchange', onHash);
    
    // Also track the initial page view since Vercel's default page view 
    // will just be for '/' and won't include the initial hash path.
    const initialPath = window.location.hash.replace(/^#/, '') || '/';
    trackPageview(initialPath);
    
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // Subscribe FIRST so we never miss PASSWORD_RECOVERY, which can fire
    // synchronously from inside the first getSession() call when there
    // are recovery tokens in the URL.
    // Apply the domain-scoped defaults (theme + nav style) once per user
    // per browser. Called from both SIGNED_IN and the initial getSession
    // check below so returning users on reload also get the defaults on
    // their first login from a given browser.
    const applyDefaults = (u) => {
      if (!u) return;
      const store = useAppStore.getState();
      maybeApplyOrgDefaults(u, { setTheme: store.setTheme, setNavStyle: store.setNavStyle });
    };

    // A Pending account finishing an OAuth sign-up gets a token it can't use
    // (see pendingApproval.js). Drop it and say why. ResetPasswordPage handles
    // its own email-confirmation case. signOut runs from an effect because
    // awaiting supabase calls inside onAuthStateChange can deadlock supabase-js.
    const rejectPending = (s) => {
      if (!isPendingApprovalSession(s) || recoveryModeRef.current) return false;
      track('auth.signup_pending_approval');
      setLoginNotice(PENDING_APPROVAL_NOTICE);
      setSession(null);
      setSignOutRequest(n => n + 1);
      return true;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (rejectPending(s)) return;
      // Sentry/Vercel events for major auth transitions. Supabase emits
      // SIGNED_IN once after a successful login (covers password, OAuth
      // callback, and magic-link), and SIGNED_OUT on logout. PASSWORD_RECOVERY
      // fires when the user lands here via a password-reset email link;
      // hold them on ResetPasswordPage instead of dropping into the app.
      if (event === 'SIGNED_OUT') {
        track('auth.logout');
        setRecoveryMode(false);
        useAppStore.getState().resetCarePlanFavorites();
        useAppStore.getState().resetSignedInUser();
      } else if (event === 'SIGNED_IN') {
        track('auth.session_established');
        // Refocus and token refresh also emit SIGNED_IN: reset only for a different user.
        const known = useAppStore.getState().currentUserProfile?.id;
        if (known && known !== s?.user?.id) useAppStore.getState().resetSignedInUser();
        // Back from Google: log it in Login Activity. Deferred, because
        // awaiting supabase inside this callback can deadlock supabase-js.
        const provider = takeOAuthSignIn();
        if (provider) setTimeout(() => reportSignInSuccess(provider), 0);
        applyDefaults(s?.user);
        // supabase-js also emits SIGNED_IN on tab refocus and token refresh,
        // so no force: the fetch re-runs only when the signed-in user changed.
        void useAppStore.getState().fetchCarePlanFavorites();
        // Invited users arrive here via the confirmation email with a
        // placeholder password. Keep them on ResetPasswordPage so they
        // can set a real one before dropping into the app.
        if (s?.user?.user_metadata?.invited === 'true') {
          setRecoveryMode(true);
        }
      } else if (event === 'PASSWORD_RECOVERY') {
        track('auth.password_recovery_started');
        setRecoveryMode(true);
      }
      setSession(s);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (rejectPending(s)) return;
      if (s?.user?.user_metadata?.invited === 'true') {
        setRecoveryMode(true);
      }
      applyDefaults(s?.user);
      setSession(s);
      if (s?.user) {
        void useAppStore.getState().fetchCarePlanFavorites();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (signOutRequest) void supabase.auth.signOut({ scope: 'local' });
  }, [signOutRequest]);

  // Initialize hash router (once)
  useEffect(() => {
    if (!routerInit.current) {
      routerInit.current = true;
      initRouter(useAppStore);
      // Smoke test: confirms the analytics + Sentry breadcrumb pipeline is
      // live on app boot. Remove once full coverage is in place.
      track('app.booted');
    }
  }, []);

  const isAuthenticated = session || bypassed;

  // Password recovery: must short-circuit before the regular auth
  // branches. The recovery email gives the user a temporary session, so
  // we'd otherwise drop them straight into the app with no way to set
  // a new password. onDone signs them out and clears the flag.
  if (recoveryMode) {
    return (
      <ResetPasswordPage
        onDone={(opts) => {
          setRecoveryMode(false);
          if (opts?.notice) setLoginNotice(opts.notice);
          if (opts?.enterApp) {
            // Invited user just set their first password, session is
            // valid, drop them straight into the app.
            window.location.hash = '#/home';
          } else {
            window.location.hash = '#/login';
          }
        }}
      />
    );
  }

  // The link an administrator's unlock emails (account lockout): set a new
  // password, then sign in. Works whether or not someone is signed in here.
  const unlockMatch = hash.match(/^#\/unlock-account\?token=([^&#]+)/);
  if (unlockMatch) {
    return (
      <UnlockAccountPage
        token={decodeURIComponent(unlockMatch[1])}
        onDone={(opts) => {
          if (opts?.notice) setLoginNotice(opts.notice);
          window.location.hash = opts?.enterApp ? '#/home' : '#/login';
        }}
      />
    );
  }

  const patientPageMatch = hash.match(/^#\/p\/([^/?#]+)/);
  if (patientPageMatch) {
    return (
      <Suspense fallback={<div style={{ height: '100vh' }} />}>
        <PatientCommsPage token={decodeURIComponent(patientPageMatch[1])} />
        <Toaster />
      </Suspense>
    );
  }

  // Loading state while checking auth
  if (session === undefined && !bypassed) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: "'Inter', sans-serif", color: 'var(--neutral-200)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className={styles.bootLogo} role="status" aria-label="Loading">
            <FoldHealthLogo size={40} color="var(--primary-300)" />
          </div>
          <div style={{ marginTop: 12, fontSize: 'var(--font-base)' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Public shareable form link: render the fill-view without auth so anyone
  // with the link can fill + submit. Authenticated users fall through to the
  // in-app takeover (AppLayout) which adds the close-to-chat affordance.
  const publicFormMatch = hash.match(/^#\/f\/([^/?#]+)/);
  if (publicFormMatch && !isAuthenticated) {
    const fid = isNaN(Number(publicFormMatch[1])) ? publicFormMatch[1] : Number(publicFormMatch[1]);
    return (
      <Suspense fallback={<div style={{ height: '100vh' }} />}>
        <PublicFormView id={fid} isPublic />
      </Suspense>
    );
  }

  // Not authenticated: show login. The dev-mode "Continue without login"
  // button performs a REAL sign-in with the demo account when the
  // VITE_DEV_LOGIN_* vars are present (dev builds only: the branch is
  // dead-code-eliminated from production bundles via import.meta.env.DEV).
  // Every table is RLS'd to `authenticated`, so a bare bypass session sees
  // zero rows from Supabase; the demo sign-in gives dev sessions real data.
  // Falls back to the legacy no-auth bypass if the sign-in fails (offline,
  // creds missing) so local UI work is never blocked on the network.
  if (!isAuthenticated) {
    if (window.location.hash !== '#/login') window.location.hash = '#/login';
    const legacyBypass = () => {
      track('auth.bypass_used');
      sessionStorage.setItem('__auth_bypass', 'true');
      // Synthetic Fold Demo identity for dev sessions without real Supabase auth.
      // TopBar and useAppStore read this to show "Fold Demo" instead of "User"
      // when no Supabase session exists. Cleared on logout.
      try {
        sessionStorage.setItem('__auth_bypass_user', JSON.stringify({
          id: 'local-dev-demo',
          email: 'demo@fold.health',
          name: 'Fold Demo',
        }));
      } catch { /* ignore */ }
      setBypassed(true);
      window.location.hash = '#/home';
    };
    const handleBypass = async () => {
      const email = import.meta.env.DEV ? import.meta.env.VITE_DEV_LOGIN_EMAIL : null;
      const password = import.meta.env.DEV ? import.meta.env.VITE_DEV_LOGIN_PASSWORD : null;
      if (email && password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          track('auth.dev_demo_login');
          window.location.hash = '#/home';
          return; // onAuthStateChange sets the session, normal auth flow takes over
        }
        console.warn('dev demo login failed: falling back to no-auth bypass:', error.message);
      }
      legacyBypass();
    };
    return <LoginPage key={loginNotice} onBypass={handleBypass} notice={loginNotice} />;
  }

  // Authenticated: clear login hash if present
  if (window.location.hash === '#/login' || window.location.hash === '') {
    window.location.hash = '#/home';
  }

  // Authenticated: show app
  return (
    <Suspense fallback={null}>
      <UpdateAvailableCard />
      <AppProviders>
        <AppLayout />
      </AppProviders>
      {/* Their scripts report the full URL; keep tokens and prefill params out. */}
      <Analytics beforeSend={scrubAnalyticsEvent} />
      <SpeedInsights beforeSend={scrubAnalyticsEvent} />
    </Suspense>
  );
}

export default App;
