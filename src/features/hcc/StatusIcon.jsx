import { Icon } from '../../components/Icon/Icon';
import { InProgressIcon } from '../../components/Icon/InProgressIcon';
import { RecordReceivedIcon } from '../../components/Icon/RecordReceivedIcon';
import { ReturnedIcon } from '../../components/Icon/ReturnedIcon';
import { getStatusSpec, hasStatusSpec } from './statusSpec';

/**
 * StatusIcon: single dispatch point for HCC status icons.
 *
 * Some statuses use a custom Figma SVG (`spec.custom`) instead of a Solar
 * glyph; this helper picks the right renderer so consumers don't repeat
 * the branching. New custom icons: add a `custom: '<key>'` entry to the
 * status's `statusSpec` row and a matching case in CUSTOM_BY_KEY below.
 */
const CUSTOM_BY_KEY = {
  'in-progress':     InProgressIcon,
  'record-received': RecordReceivedIcon,
  'returned':        ReturnedIcon,
};

export function StatusIcon({ status, size = 12, color }) {
  const spec = getStatusSpec(status);
  const tone = color ?? spec.color;
  const Custom = spec.custom ? CUSTOM_BY_KEY[spec.custom] : null;
  if (Custom) return <Custom size={size} color={tone} />;
  return <Icon name={spec.icon} size={size} color={tone} />;
}

// For timelines: the worklist icon for `status`, or null when the worklist has
// no icon for it (the timeline then falls back to its own glyph).
export function timelineStatusIcon(status, color) {
  if (!hasStatusSpec(status)) return null;
  return <StatusIcon status={status} size={14} color={color} />;
}
