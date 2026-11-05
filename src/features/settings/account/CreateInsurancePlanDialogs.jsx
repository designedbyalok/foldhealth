import { Button } from '../../../components/Button/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../components/Dialog/Dialog';

export function CreateInsurancePlanDialogs({
  showDiscardDialog,
  setShowDiscardDialog,
  showSaveDialog,
  setShowSaveDialog,
  onClose,
  onSave,
}) {
  return (
    <>
      {showDiscardDialog && (
        <ConfirmDialog
          variant="destructive"
          title="Discard Information?"
          description="This action will discard all information you have entered for the plan. Please confirm if you want to proceed."
          confirmLabel="Discard"
          onCancel={() => setShowDiscardDialog(false)}
          onConfirm={() => { setShowDiscardDialog(false); onClose(); }}
        />
      )}

      <Dialog open={showSaveDialog} onOpenChange={open => !open && setShowSaveDialog(false)}>
        <DialogContent style={{ zIndex: 600 }}>
          <DialogHeader>
            <DialogTitle>Save Changes?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Please confirm to save the changes you made for this plan.
          </DialogDescription>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="outline" onClick={() => { setShowSaveDialog(false); onClose(); }}>
              Discard
            </Button>
            <Button onClick={() => { setShowSaveDialog(false); onSave(); }}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
