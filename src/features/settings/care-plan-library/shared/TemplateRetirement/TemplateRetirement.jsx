import { Badge } from '../../../../../components/Badge/Badge';
import { InfoBar } from '../../../../../components/InfoBar/InfoBar';
import { Tooltip } from '../../../../../components/Tooltip/Tooltip';
import {
  formatRetireDate, retirementSummary, retiringOn, templatesReplacedBy,
} from '../../lib/templateRetirement';

/**
 * "Retiring 12/01/2026" warning on a template still in use that has a
 * retirement date, with what replaces it on hover. Nothing otherwise.
 */
export function RetiringBadge({ template, templates, className }) {
  const day = retiringOn(template);
  if (!day) return null;
  return (
    <Tooltip label={retirementSummary(template, templates)}>
      <Badge
        size="S"
        tone="warning"
        icon="solar:calendar-mark-linear"
        label={`Retiring on ${formatRetireDate(day)}`}
        className={className}
      />
    </Tooltip>
  );
}

/**
 * The retirement cross-reference on a template: what replaces it (before and
 * after its date), and which retired or retiring templates it replaces.
 */
export function TemplateRetirementNote({ template, templates }) {
  const summary = retirementSummary(template, templates);
  const replaces = templatesReplacedBy(template, templates);
  if (!summary && !replaces.length) return null;
  return (
    <>
      {summary && (
        <InfoBar variant="inline" tone="warning" icon="solar:archive-down-linear">{summary}</InfoBar>
      )}
      {replaces.length > 0 && (
        <InfoBar variant="inline" icon="solar:refresh-linear">
          {`Replaces ${replaces.map(t => (retiringOn(t) ? `${t.name} (retiring on ${formatRetireDate(retiringOn(t))})` : t.name)).join(', ')}.`}
        </InfoBar>
      )}
    </>
  );
}
