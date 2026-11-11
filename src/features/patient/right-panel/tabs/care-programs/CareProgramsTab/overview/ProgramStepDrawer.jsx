import { lazy, Suspense } from 'react';
import { Drawer } from '@/components/Drawer/Drawer';
import { Button } from '@/components/Button/Button';
import styles from './CareProgramsOverview.module.css';

const ProgramDetailView = lazy(() => import('../../program-detail/ProgramDetailView/ProgramDetailView.jsx').then(m => ({ default: m.ProgramDetailView })));

/**
 * One program step in a drawer, opened from Next Best Actions: the program
 * view's own step (header, Reviewed / Skip, content) without its step list,
 * so the work happens in place. Open Program goes to the full view at the
 * same step. `open` is { program, stepId }.
 */
export function ProgramStepDrawer({ open, onOpenProgram, onClose }) {
  if (!open) return null;
  const { program, stepId } = open;
  return (
    <Drawer
      title={program.name}
      onClose={onClose}
      noCloseDivider
      bodyClassName={styles.stepDrawerBody}
      headerRight={(
        <>
          <Button size="sm" variant="outline" leadingIcon="solar:square-arrow-right-up-linear" onClick={() => { onClose(); onOpenProgram(program, stepId); }}>
            Open Program
          </Button>
          <span className={styles.headerDivider} />
        </>
      )}
    >
      <Suspense fallback={null}>
        <ProgramDetailView key={`${program.id}:${stepId}`} program={program} stepId={stepId} onClose={onClose} />
      </Suspense>
    </Drawer>
  );
}
