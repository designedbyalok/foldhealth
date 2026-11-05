import { useEffect, useState } from 'react';
import { loadCaptureConsentDrawer, loadedCaptureConsentDrawer } from './loadCaptureConsentDrawer';

/** Renders Capture Consent as soon as its chunk is in, with no Suspense delay. */
export function CaptureConsentDrawerHost(props) {
  const [Drawer, setDrawer] = useState(loadedCaptureConsentDrawer);

  useEffect(() => {
    if (Drawer) return undefined;
    let live = true;
    loadCaptureConsentDrawer().then((c) => { if (live) setDrawer(() => c); });
    return () => { live = false; };
  }, [Drawer]);

  return Drawer ? <Drawer {...props} /> : null;
}
