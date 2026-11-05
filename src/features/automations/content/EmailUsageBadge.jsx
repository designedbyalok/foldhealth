import { useEffect, useMemo } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { useAppStore } from '../../../store/useAppStore';
import { automationsUsingEmail, usedByLabel } from './emailUsage';

/** Small count beside an email's name in Content > Emails; nothing when unused. */
export function EmailUsageBadge({ emailId }) {
  const automations = useAppStore(s => s.automations);
  const fetchAutomations = useAppStore(s => s.fetchAutomations);
  // fetchAutomations is a no-op once loading or loaded, so one row starts it.
  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);
  const count = useMemo(() => automationsUsingEmail(automations, emailId).length, [automations, emailId]);
  if (!count) return null;
  return (
    <Tooltip label={usedByLabel(count)}>
      <Badge tone="primary" size="xs" icon="solar:bolt-linear" label={String(count)} />
    </Tooltip>
  );
}
