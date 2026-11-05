import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Named imports, not `import * as Sentry`: holding the namespace kept Replay
// and Feedback in the entry chunk even though neither is used.
import { init as initSentry, browserTracingIntegration, addBreadcrumb } from '@sentry/react'
import './styles/tailwind.css'
import './index.css'
import App from './App.jsx'
import { initTheme } from './lib/theme'
import { useAppStore } from './store/useAppStore'
import { startUpdateChecker } from './lib/updateChecker'
import { attachSentry } from './lib/tracking'

// URLs carry patient-portal tokens (#/p/<token>), auth tokens and form
// prefill params, so only origin + path ever reach Sentry.
const stripUrl = (u) => (typeof u === 'string' ? u.split(/[?#]/)[0] : u)

// Sentry: error + performance monitoring. browserTracingIntegration adds
// the Web Vitals transactions (FCP / LCP / INP / TTFB / CLS) we want to
// watch. Must run before createRoot so React errors are captured from
// the first render. v11's default dataCollection includes IP addresses and
// cookies; keep an eye on this for any HIPAA-sensitive deployment.
//
// Only initialize on the deployed production site. `import.meta.env.PROD`
// alone isn't enough because `bun run preview` serves the built bundle
// locally with PROD=true: and those localhost sessions were leaking
// dev-time HMR crashes into the auto-fix routine (see PR #27). Gating on
// hostname too means dev, preview, and any local build stay silent.
const isDeployedProd =
  import.meta.env.PROD &&
  !['localhost', '127.0.0.1'].includes(window.location.hostname)

if (isDeployedProd) {
  initSentry({
    dsn: 'https://2d5be2c606f585f9dd1fdfe9b23ae274@o4511450529529856.ingest.us.sentry.io/4511450531037184',
    environment: 'production',
    // Route envelopes through our own /api/monitoring function so requests
    // leave the browser as a same-origin path. Bypasses ad/privacy blockers
    // that match the public *.ingest.sentry.io host.
    tunnel: '/api/monitoring',
    integrations: [browserTracingIntegration()],
    tracesSampleRate: 1.0,
    // v11 collects request/response bodies by default. Those are Supabase
    // rows with patient data here, so keep them out of Sentry.
    dataCollection: { httpBodies: [] },
    // No IPs or cookies; clicks and inputs are dropped because their messages
    // carry aria-labels with patient names, and URLs lose their hash/query.
    sendDefaultPii: false,
    beforeBreadcrumb(crumb) {
      if (crumb.category === 'ui.click' || crumb.category === 'ui.input') return null
      if (crumb.data) {
        for (const k of ['url', 'from', 'to']) if (crumb.data[k]) crumb.data[k] = stripUrl(crumb.data[k])
      }
      return crumb
    },
    beforeSend(event) {
      if (event.request?.url) event.request.url = stripUrl(event.request.url)
      if (event.request?.query_string) delete event.request.query_string
      if (event.user) delete event.user.ip_address
      return event
    },
    // Noise that isn't ours and isn't actionable:
    //   • navigator.locks contention on the Supabase auth token, expected
    //     whenever a user has the app open in more than one tab; the losing
    //     tab retries and recovers on its own.
    //   • "Object Not Found Matching Id…" comes from the Outlook SafeLinks
    //     scanner injecting script into the page, not from our bundle.
    ignoreErrors: [
      /Lock ".*" was released because another request stole it/,
      /Lock broken by another request with the 'steal' option/,
      /Object Not Found Matching Id:/,
    ],
  })
  // track() adds its events as breadcrumbs once Sentry is running.
  attachSentry({ addBreadcrumb })
}

// Initialize theme subsystem before first render.
// (index.html already painted the correct theme; this reconciles store +
// wires the OS preference listener for 'system' mode.)
initTheme()
useAppStore.getState()._initThemeSubscriptions()

// Poll /version.json in the background; when a fresh deploy has shipped
// the UpdateCard appears so users refresh before their lazy
// imports 404 into a white screen.
startUpdateChecker()

if (import.meta.env.DEV) {
  // Dev-only escape hatch: lets DevTools poke at store state (e.g. to
  // preview the update card without waiting for a real chunk error).
  window.__store = useAppStore
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
