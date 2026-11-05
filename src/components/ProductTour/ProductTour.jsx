import { useState, useCallback, useEffect } from 'react';
import { Joyride, STATUS, ACTIONS } from 'react-joyride';
import { TourTooltip } from './TourTooltip';
import { localTourStore } from './ProductTour.utils';

/**
 * ProductTour: wraps React Joyride with Fold Health design system. Shows a
 * tour once: `store` answers whether this user has seen it and records that
 * they have. The default remembers it in this browser; the app passes one
 * that also syncs across devices (features/tours).
 *
 * @param {{ hasSeen: (tourId) => boolean|Promise<boolean>, markSeen: (tourId) => void }} [props.store]
 */
export function ProductTour({ tourId, steps, run = true, onFinish, continuous = true, store = localTourStore }) {
  const [running, setRunning] = useState(false);
  const [checked, setChecked] = useState(false);

  // Show the tour only if this user hasn't seen it.
  useEffect(() => {
    if (!run) { setChecked(true); return; }
    let cancelled = false;
    Promise.resolve(store.hasSeen(tourId)).then((seen) => {
      if (cancelled) return;
      if (!seen) setRunning(true);
      setChecked(true);
    });
    return () => { cancelled = true; };
  }, [tourId, run, store]);

  // Recorded as seen as soon as it starts, so a reload mid-tour doesn't replay it.
  useEffect(() => {
    if (running) store.markSeen(tourId);
  }, [running, tourId, store]);

  const handleCallback = useCallback((data) => {
    const { status, action } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
      setRunning(false);
      onFinish?.();
    }
  }, [onFinish]);

  if (!checked || !running || !steps?.length) return null;

  return (
    <Joyride
      steps={steps}
      run={running}
      continuous={continuous}
      showSkipButton
      showProgress={false}
      disableOverlayClose={false}
      disableScrolling={false}
      spotlightClicks
      callback={handleCallback}
      tooltipComponent={TourTooltip}
      // react-joyride v3 API: zIndex/overlayColor moved from styles.options
      // to the options prop, and spotlight rounding is the spotlightRadius
      // option: styles.spotlight is spread as props onto an SVG <path>, so
      // borderRadius there hits the DOM and triggers a React warning.
      options={{
        zIndex: 10000,
        overlayColor: 'rgba(0, 0, 0, 0.35)',
        spotlightRadius: 8,
      }}
      floaterProps={{
        disableAnimation: true,
      }}
    />
  );
}
