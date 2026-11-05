import { useState } from 'react';
import { Toaster } from './Toast';
import { toast } from './sonnerToast';
import { Button } from '../Button/Button';
import { Switch } from '../Switch/Switch';

export default {
  title: 'Overlays/Toast',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Imperative toast notifications backed by Sonner. Mount `<Toaster />` once at the app root, then call `toast(...)`, `toast.success(...)`, or `toast.error(...)` from anywhere.',
      },
    },
  },
};

function Playground_() {
  const [withDescription, setWithDescription] = useState(false);
  const desc = (text) => (withDescription ? { description: text } : undefined);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Toaster />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button
          variant="soft" tone="success"
          onClick={() => toast.success('Uploaded chart.pdf', desc('Sent to the Coder queue for review.'))}
        >
          Success
        </Button>
        <Button
          variant="soft" tone="danger"
          onClick={() => toast.error('Upload failed', desc('The file exceeds the 100 MB limit. Try a smaller file.'))}
        >
          Error
        </Button>
        <Button
          tone="info"
          onClick={() => toast.info('New Foldhealth version available', desc('Reload to pick up the latest build.'))}
        >
          Info
        </Button>
        <Button
          variant="outline" tone="primary"
          onClick={() => toast.warning('Session will expire in 2 minutes', desc('Save any open work: unsaved changes will be lost.'))}
        >
          Warning
        </Button>
      </div>
      <Switch
        checked={withDescription}
        onChange={setWithDescription}
        label="Include description in every toast"
      />
    </div>
  );
}

export const Playground = { render: () => <Playground_ /> };
