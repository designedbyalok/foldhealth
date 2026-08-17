import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './styles/tailwind.css'
import './index.css'
import App from './App.jsx'
import { initTheme } from './lib/theme'
import { useAppStore } from './store/useAppStore'
import { startUpdateChecker } from './lib/updateChecker'

// Sentry — error + performance monitoring. browserTracingIntegration adds
// the Web Vitals transactions (FCP / LCP / INP / TTFB / CLS) we want to
// watch. Must run before createRoot so React errors are captured from
// the first render. sendDefaultPii includes IP addresses — keep an eye
// on this for any HIPAA-sensitive deployment.
//
// Only initialize on the deployed production site. `import.meta.env.PROD`
// alone isn't enough because `bun run preview` serves the built bundle
// locally with PROD=true — and those localhost sessions were leaking
// dev-time HMR crashes into the auto-fix routine (see PR #27). Gating on
// hostname too means dev, preview, and any local build stay silent.
const isDeployedProd =
  import.meta.env.PROD &&
  !['localhost', '127.0.0.1'].includes(window.location.hostname)

if (isDeployedProd) {
  Sentry.init({
    dsn: 'https://2d5be2c606f585f9dd1fdfe9b23ae274@o4511450529529856.ingest.us.sentry.io/4511450531037184',
    environment: 'production',
    // Route envelopes through our own /api/monitoring function so requests
    // leave the browser as a same-origin path. Bypasses ad/privacy blockers
    // that match the public *.ingest.sentry.io host.
    tunnel: '/api/monitoring',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
    // Stream GenAI spans for Vercel AI SDK calls (generateText, streamText,
    // ToolLoopAgent, etc.). Inert until we add the AI SDK. When we do, pass
    // `experimental_telemetry: { isEnabled: true, functionId, recordInputs,
    // recordOutputs }` on each call so spans land in Sentry's Agents tab.
    streamGenAiSpans: true,
    sendDefaultPii: true,
    // Noise that isn't ours and isn't actionable:
    //   • navigator.locks contention on the Supabase auth token — expected
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
}

// Initialize theme subsystem before first render.
// (index.html already painted the correct theme; this reconciles store +
// wires the OS preference listener for 'system' mode.)
initTheme()
useAppStore.getState()._initThemeSubscriptions()

// Poll /version.json in the background; when a fresh deploy has shipped
// the UpdateAvailableBanner appears so users refresh before their lazy
// imports 404 into a white screen.
startUpdateChecker()

if (import.meta.env.DEV) {
  // Dev-only escape hatch — lets DevTools poke at store state (e.g. to
  // preview the update banner without waiting for a real chunk error).
  window.__store = useAppStore
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
