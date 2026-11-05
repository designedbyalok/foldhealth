import { Suspense, lazy } from 'react';
import { useAppStore } from '../../store/useAppStore';

const CallPopover = lazy(() => import('./CallPopover').then((m) => ({ default: m.CallPopover })));

export function CallPopoverHost() {
  const open = useAppStore((s) => Boolean(s.callPopoverPatient || s.callPopoverNumber));
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <CallPopover />
    </Suspense>
  );
}
