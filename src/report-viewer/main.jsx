/**
 * Report viewer: the Employer Impact page as a saved, read-only snapshot.
 * Built on its own (bun run build:report-viewer) into one script and one
 * stylesheet, which Print → Download HTML inlines into the downloaded file
 * with the snapshot as window.__FOLD_REPORT__.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tailwind.css';
import '../index.css';
import interUrl from '../../public/fonts/inter-latin.woff2?url';
import { loadSnapshot } from './snapshotStore';
import { EmployerImpactView } from '../features/analytics/views/employer/EmployerImpactView';
import layout from '../features/analytics/AnalyticsLayout.module.css';

// index.css points at /fonts/…, which a downloaded file can't reach; the
// build inlines the font here instead.
const font = document.createElement('style');
font.textContent = `@font-face{font-family:'Inter';font-style:normal;font-weight:100 900;font-display:swap;src:url(${interUrl}) format('woff2-variations');}`;
document.head.appendChild(font);

const snapshot = window.__FOLD_REPORT__;
loadSnapshot(snapshot);
document.documentElement.dataset.theme = 'light';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className={layout.canvas}>
      <EmployerImpactView snapshot={snapshot} />
    </div>
  </StrictMode>,
);
