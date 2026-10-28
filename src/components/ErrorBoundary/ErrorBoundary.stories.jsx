import { useState } from 'react';
import { Button } from '../Button/Button';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb({ explode }) {
  if (explode) throw new Error('Story error');
  return <p>Content rendered normally.</p>;
}

function Demo() {
  const [explode, setExplode] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 420 }}>
      <Button variant="secondary" size="L" onClick={() => setExplode((e) => !e)}>
        {explode ? 'Stop throwing' : 'Throw an error'}
      </Button>
      <ErrorBoundary resetKeys={[explode]}>
        <Bomb explode={explode} />
      </ErrorBoundary>
    </div>
  );
}

export default {
  title: 'Feedback/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Catches a render error in its children and shows ErrorState with Try Again. Changing any `resetKeys` value clears it.',
      },
    },
  },
};

export const Default = { render: () => <Demo /> };
