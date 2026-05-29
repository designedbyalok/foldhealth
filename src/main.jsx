import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './styles/tailwind.css'
import './index.css'
import App from './App.jsx'
import { initTheme } from './lib/theme'
import { useAppStore } from './store/useAppStore'

// Sentry — error + performance monitoring. browserTracingIntegration adds
// the Web Vitals transactions (FCP / LCP / INP / TTFB / CLS) we want to
// watch. Must run before createRoot so React errors are captured from
// the first render. sendDefaultPii includes IP addresses — keep an eye
// on this for any HIPAA-sensitive deployment.
Sentry.init({
  dsn: 'https://2d5be2c606f585f9dd1fdfe9b23ae274@o4511450529529856.ingest.us.sentry.io/4511450531037184',
  // Vite sets MODE = 'development' during `bun run dev` and 'production'
  // during `bun run build`. Tagging here lets the automated Sentry-triage
  // routine filter on `environment:production` so dev/HMR crashes don't
  // get auto-fixed.
  environment: import.meta.env.MODE,
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
})

// Initialize theme subsystem before first render.
// (index.html already painted the correct theme; this reconciles store +
// wires the OS preference listener for 'system' mode.)
initTheme()
useAppStore.getState()._initThemeSubscriptions()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
