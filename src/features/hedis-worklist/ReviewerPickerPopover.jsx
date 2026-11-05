import { SelectAssigneeModal } from '../../components/SelectAssigneeModal/SelectAssigneeModal';

/**
 * ReviewerPickerPopover: "Send for Review" reviewer chooser.
 *
 * Thin wrapper around the shared SelectAssigneeModal so the picker looks
 * and behaves identically to every other assignee chooser in the app
 * (SNP, TOC, tasks). Previously hand-rolled portal + search + list;
 * now delegates to Dialog + SearchBar + Avatar rows.
 */
export function ReviewerPickerPopover({ open, onClose, onConfirm }) {
  return (
    <SelectAssigneeModal
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Send for Review"
      confirmLabel="Send for Review"
    />
  );
}
