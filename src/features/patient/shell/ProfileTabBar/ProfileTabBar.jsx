import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { OverflowTabs } from '../../../../components/Tabs/OverflowTabs';
import { PROFILE_TABS } from '../../data/programActivityMock';
import { SidebarCollapseHint } from './SidebarCollapseHint';
import styles from './ProfileTabBar.module.css';

const TAB_ITEMS = PROFILE_TABS.map(tab => ({ key: tab, label: tab }));

// `actions`: controls for the active tab (Overview's Customize), pinned right.
export function ProfileTabBar({ activeTab, onTabChange, leftCollapsed = false, onToggleLeft, extraTabs, actions }) {
  // When the left panel is collapsed its tabs flow into this bar, leading the
  // primary tabs so the order reads left-panel first (Gaps → PAMI/Hx →
  // Vitals/Labs → …), then the right-panel tabs.
  const items = extraTabs && extraTabs.length
    ? [...extraTabs.map(tab => ({ key: tab, label: tab })), ...TAB_ITEMS]
    : TAB_ITEMS;
  return (
    <div className={styles.tabBar}>
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
      <div className={styles.tabsArea}>
        <OverflowTabs
          items={items}
          value={activeTab}
          onValueChange={onTabChange}
        />
      </div>
      {actions && (
        <>
          <span className={styles.divider} />
          <div className={styles.actions}>{actions}</div>
        </>
      )}
    </div>
  );
}
