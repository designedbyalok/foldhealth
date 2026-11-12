import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { OverflowTabs } from '../../../../components/Tabs/OverflowTabs';
import { PROFILE_TABS } from '../../data/programActivityMock';
import { SidebarCollapseHint } from './SidebarCollapseHint';
import styles from './ProfileTabBar.module.css';

const TAB_ITEMS = PROFILE_TABS.map(tab => ({ key: tab, label: tab }));

// `actions`: controls for the active tab (Overview's Customize), pinned right.
// `onToggleFullScreen`: the full screen control, last on the bar. In full
// screen the panel toggle steps aside (the panel is already folded in).
export function ProfileTabBar({ activeTab, onTabChange, leftCollapsed = false, onToggleLeft, extraTabs, actions, fullScreen = false, onToggleFullScreen }) {
  // When the left panel is collapsed its tabs flow into this bar, leading the
  // primary tabs so the order reads left-panel first (Gaps → PAMI/Hx →
  // Vitals/Labs → …), then the right-panel tabs.
  const items = extraTabs && extraTabs.length
    ? [...extraTabs.map(tab => ({ key: tab, label: tab })), ...TAB_ITEMS]
    : TAB_ITEMS;
  return (
    <div className={styles.tabBar}>
      {!fullScreen && (
        <>
          <SidebarCollapseHint enabled={!leftCollapsed}>
            <ActionButton
              icon="solar:sidebar-minimalistic-linear"
              size="sm"
              active
              aria-label={leftCollapsed ? 'Expand panel' : 'Collapse panel'}
              className={[leftCollapsed ? styles.sidebarFlipped : '', styles.sidebarToggle].filter(Boolean).join(' ')}
              onClick={onToggleLeft}
            />
          </SidebarCollapseHint>
          <span className={styles.divider} />
        </>
      )}
      <div className={styles.tabsArea}>
        <OverflowTabs
          items={items}
          value={activeTab}
          onValueChange={onTabChange}
        />
      </div>
      {(actions || onToggleFullScreen) && (
        <>
          <span className={styles.divider} />
          <div className={styles.actions}>
            {actions}
            {onToggleFullScreen && (
              <ActionButton
                icon={fullScreen ? 'solar:quit-full-screen-linear' : 'solar:full-screen-linear'}
                size="sm"
                tooltip={fullScreen ? 'Exit full screen (Esc)' : 'Full screen: more room for care management'}
                tooltipLeft
                aria-label={fullScreen ? 'Exit full screen' : 'Full screen'}
                aria-pressed={fullScreen}
                onClick={onToggleFullScreen}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
