import { Button } from '../../components/Button/Button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/Dialog/Dialog';

export function AgentCanvasCloseDialog({ open, onOpenChange, onDiscard, onSaveAndClose }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] p-0 gap-0 overflow-hidden rounded-lg">
        <DialogTitle className="sr-only">Unsaved Changes</DialogTitle>
        <DialogDescription className="sr-only">You have unsaved changes. Choose to discard or save.</DialogDescription>
        <div style={{ padding: 16, borderBottom: '0.5px solid var(--neutral-150)' }}>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-500)', marginBottom: '0.5rem' }}>
            Unsaved Changes
          </div>
          <div style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-300)', lineHeight: 1.5 }}>
            You have unsaved changes to this workflow. Would you like to save before leaving?
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 12 }}>
          <Button variant="outline" fullWidth style={{ flex: 1, minWidth: 0 }} onClick={onDiscard}>
            Discard
          </Button>
          <Button fullWidth style={{ flex: 1, minWidth: 0 }} onClick={onSaveAndClose}>
            Save & Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
