import { useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Icon } from '../../../components/Icon/Icon';
import { Badge } from '../../../components/Badge/Badge';
import { TemplateAnswersForm } from '../../patient/right-panel/tabs/notes/PatientNotesTab/TemplateAnswersForm';
import { MEASURE_NAMES } from '../../hedis-worklist/ClinicalNotePanel.utils';
import styles from './NoteTemplatePreviewDrawer.module.css';

/**
 * NoteTemplatePreviewDrawer: read-only preview of a Note Template's
 * clinician-facing form. Reuses TemplateAnswersForm, the exact same
 * renderer the Non-Visit / Normal Note authoring drawer uses, so what
 * an admin sees here matches what a clinician sees in the Clinical Note
 * flow. Local answers state is throwaway; nothing is persisted.
 */
export function NoteTemplatePreviewDrawer({ template, onClose }) {
  const [answers, setAnswers] = useState({});
  const items = Array.isArray(template.schema?.items) ? template.schema.items : [];
  const isCareGap = !!template.gap_code;
  const contextLabel = template.context === 'non_visit' ? 'Non-Visit' : 'Visit';
  const gapName = template.gap_code ? MEASURE_NAMES?.[template.gap_code] : null;

  return (
    <Drawer
      title={template.name || 'Note Template Preview'}
      onClose={onClose}
      width={640}
    >
      <div className={styles.body}>
        <div className={styles.metaRow}>
          <Badge size="sm" label={isCareGap ? 'Care Gap' : 'Normal'} />
          {template.gap_code && (
            <Badge label={gapName ? `${template.gap_code} · ${gapName}` : template.gap_code} />
          )}
          {isCareGap && <Badge size="sm" label={contextLabel} />}
          {template.is_default_for_gap && template.context && (
            <Badge tone="success" size="sm" label={`${contextLabel} default`} />
          )}
          <Badge tone={template.status === 'active' ? 'success' : 'neutral'} size="sm" label={template.status || 'active'} />
        </div>

        <div className={styles.banner}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--status-info)" />
          <span>This is a preview of the template as it appears when a clinician fills it out. Nothing is saved from here.</span>
        </div>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <Icon name="solar:notes-linear" size={32} color="var(--neutral-200)" />
            <p className={styles.emptyTitle}>This template has no fields yet.</p>
            <p className={styles.emptyBody}>Close this preview and click <strong>Edit</strong> to author the schema in the Form Builder.</p>
          </div>
        ) : (
          <TemplateAnswersForm items={items} answers={answers} onChange={setAnswers} />
        )}
      </div>
    </Drawer>
  );
}
