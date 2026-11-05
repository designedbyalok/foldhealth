/**
 * Analytics + breadcrumb tracking: single fan-out helper.
 *
 * One `track(name, props?)` call fires to both:
 *   1. Vercel Analytics  → Custom Events in the Vercel dashboard
 *   2. Sentry            → breadcrumb attached to any future error
 *
 * Naming convention:
 *   `feature.action`, lowercase, dot-separated, past-tense verb.
 *   Sub-noun allowed when needed: `email.block_added`, `agent.flow_saved`.
 *   No spaces, no colons, no PascalCase.
 *
 * PHI policy:
 *   Never put patient names, DOB, emails, phone numbers, or freeform
 *   note text into `props`. Opaque IDs only (`patientId`, `goalId`,
 *   `memberId`, etc.).
 *
 * Canonical event names live in /Users/alokk/.claude/plans/i-want-you-to-wondrous-sparrow.md.
 */
let vercelTrack = () => {};
let vercelPageview = () => {};
import('@vercel/analytics').then(m => {
  vercelTrack = m.track;
  if (m.pageview) vercelPageview = m.pageview;
}).catch(() => {
  // Silent fallback if blocked by adblockers
});

import { useAppStore } from '../store/useAppStore';
import { supabase } from './supabase';

const isDev = import.meta.env.DEV;

// Sentry only runs on the deployed site (see main.jsx), which hands in the
// one function used here once it has initialized.
let sentry = null;
export function attachSentry(s) {
  sentry = s;
}

// Auto-attached to every event. Kept narrow, just enough context to slice
// dashboards by current location without leaking domain data.
function defaultProps() {
  try {
    const s = useAppStore.getState();
    return {
      page: s.activePage || null,
      tab: s.activeTab || null,
      list: s.activeSubnavList || null,
    };
  } catch {
    return {};
  }
}

export function track(name, props = {}) {
  const payload = { ...defaultProps(), ...props };

  // Both transports are wrapped: an analytics outage must never throw
  // into product code.
  try {
    vercelTrack(name, payload);
  } catch (e) {
    if (isDev) console.warn('[track] vercel failed', e);
  }
  try {
    sentry?.addBreadcrumb({
      category: 'user-action',
      type: 'user',
      level: 'info',
      message: name,
      data: payload,
    });
  } catch (e) {
    if (isDev) console.warn('[track] sentry failed', e);
  }

  if (isDev) console.debug('[track]', name, payload);
}

// Collapses a hash path to its route template. Only this ever leaves the
// browser: raw paths carry patient-portal tokens (#/p/<token>), auth tokens
// (token_hash, access_token, refresh_token) and form prefill query params.
export function normalizeRoute(path) {
  let route = String(path || '').replace(/^#/, '').split('?')[0].split('#')[0] || '/';
  // Supabase implicit-flow redirects put `access_token=…` straight in the hash.
  if (!route.startsWith('/')) return '/';

  // Replace standard UUIDs with [id]
  route = route.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]');
  // Replace numeric IDs with [id]
  route = route.replace(/\/\d+(?=\/|$)/g, '/[id]');

  // Handle specific custom string IDs for this app's routing
  if (route.match(/^\/p\/[^/]+/)) {
    route = route.replace(/^\/p\/[^/]+/, '/p/[token]');
  } else if (route.match(/^\/f\/[^/]+/)) {
    route = route.replace(/^\/f\/[^/]+/, '/f/[id]');
  } else if (route.match(/^\/population\/patient\/[^/]+/)) {
    route = route.replace(/^\/population\/patient\/[^/]+/, '/population/patient/[id]');
  } else if (route.match(/^\/settings\/messages\/chat-settings\/(?!new$)[^/]+/)) {
    route = route.replace(/^\/settings\/messages\/chat-settings\/[^/]+/, '/settings/messages/chat-settings/[id]');
  }
  return route;
}

// Vercel Analytics / Speed Insights `beforeSend`: their scripts report
// location.href, so swap it for origin + path + normalized hash route.
export function scrubAnalyticsEvent(event) {
  try {
    const u = new URL(event.url);
    const hash = u.hash ? `#${normalizeRoute(u.hash)}` : '';
    return { ...event, url: `${u.origin}${u.pathname}${hash}` };
  } catch {
    return null;
  }
}

export function trackPageview(path) {
  try {
    const route = normalizeRoute(path);
    vercelPageview({ route, path: route });
  } catch (e) {
    if (isDev) console.warn('[trackPageview] vercel failed', e);
  }
}

// ── Funnel tracking ─────────────────────────────────────────────────────────
// Everything `track` does (Vercel + Sentry breadcrumb), plus a durable row in
// Supabase's funnel_events so steps can be stitched into per-session paths.
// Vercel alone can't answer "did THIS user finish or drop off", its events
// are anonymous aggregates. Same PHI policy: opaque IDs only, never names,
// emails, phone numbers, or freeform text.

let _funnelSid = null;
function funnelSessionId() {
  if (_funnelSid) return _funnelSid;
  const mint = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  try {
    _funnelSid = sessionStorage.getItem('fh_funnel_sid') || mint();
    sessionStorage.setItem('fh_funnel_sid', _funnelSid);
  } catch {
    _funnelSid = mint();
  }
  return _funnelSid;
}

export function trackFunnel(name, props = {}, funnel = 'schedule_appointment') {
  track(name, props);

  (async () => {
    const { error } = await supabase.from('funnel_events').insert({
      session_id: funnelSessionId(),
      funnel,
      event_name: name,
      props,
    });
    if (error && isDev) console.warn('[trackFunnel] insert failed', error.message);
  })().catch(e => {
    if (isDev) console.warn('[trackFunnel] failed', e);
  });
}
