import { createPortal } from 'react-dom';
import { CarePlanCreateView } from '../../../../../../settings/care-plan-library/create/CarePlanCreateView/CarePlanCreateView';
import { useAppStore } from '../../../../../../../store/useAppStore';
import styles from './TemplateCreateLayer.module.css';

/**
 * The Care Plan Library's "New Care Plan" editor, opened over the patient's
 * plan from Apply Templates → Create New so the user never leaves the patient.
 * Sits above the app chrome but below every Drawer (z 400+) and popover, so
 * the editor's own pickers and drawers still open on top of it.
 */
export function TemplateCreateLayer({ onClose, onCreated }) {
  const saveCarePlanTemplate = useAppStore(s => s.saveCarePlanTemplate);
  const showToast = useAppStore(s => s.showToast);

  const handleSave = async (values) => {
    const saved = await saveCarePlanTemplate(values);
    if (!saved) return;
    showToast(`"${saved.name}" ${values.status === 'draft' ? 'saved as draft' : 'saved'}`);
    onCreated(saved);
  };

  return createPortal(
    <div className={styles.layer} role="dialog" aria-modal="true" aria-label="New care plan template">
      <CarePlanCreateView onClose={onClose} onSave={handleSave} />
    </div>,
    document.body,
  );
}
