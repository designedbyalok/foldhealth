import { ActionButton } from '../ActionButton/ActionButton';
import { useAppStore } from '../../store/useAppStore';

/**
 * Sidebar collapse handle rendered at the leading edge of every worklist
 * header. Reads `subnavCollapsed` + `toggleSubnav` from the app store so no
 * worklist needs to thread props.
 */
export function SubnavToggle() {
  const subnavCollapsed = useAppStore(s => s.subnavCollapsed);
  const toggleSubnav = useAppStore(s => s.toggleSubnav);
  return (
    <ActionButton
      icon="solar:sidebar-minimalistic-linear"
      size="L"
      tooltip={subnavCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      iconColor="var(--neutral-300)"
      onClick={toggleSubnav}
      aria-label={subnavCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    />
  );
}
