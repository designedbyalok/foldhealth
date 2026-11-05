import { useAppStore } from '../../../store/useAppStore';
import { Button } from '../../../components/Button/Button';
import { categoryLabel, executionTypeOf, scheduleLabel } from '../lib/catalog';
import { graphCounts } from '../lib/analytics';
import { PreviewModal, PreviewStats } from './PreviewModal';
import { plural, startFromTemplate } from './listUtils';

/** Template preview: what it does, how often it has been used, and its flow. */
export function TemplatePreviewModal({ template: t, onClose }) {
  const openNewAutomation = useAppStore(s => s.openNewAutomation);
  const counts = graphCounts(t.graph);
  return (
    <PreviewModal
      title={t.name}
      meta={<span>{categoryLabel(t.category)}</span>}
      description={t.description}
      actions={(
        <Button leadingIcon="solar:copy-linear" onClick={() => startFromTemplate(openNewAutomation, t)}>Use Template</Button>
      )}
      stats={(
        <PreviewStats
          items={[
            { label: 'Used', value: plural(t.usedCount || 0, 'time') },
            { label: 'Execution type', value: executionTypeOf(t.schedule) },
            { label: 'Frequency', value: scheduleLabel(t.schedule) },
            { label: 'Steps', value: `${plural(counts.conditions, 'condition')}, ${plural(counts.actions, 'action')}` },
          ]}
        />
      )}
      graph={t.graph}
      onClose={onClose}
    />
  );
}
