import { useDiagPanel } from './useDiagPanel';
import { DiagPanelView } from './DiagPanelView';

/** `embedded` renders the panel's content without the drawer, for the patient split. */
export function DiagPanel({ embedded = false }) {
  const panel = useDiagPanel();
  return <DiagPanelView {...panel} embedded={embedded} />;
}
