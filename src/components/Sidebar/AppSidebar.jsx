import { Sidebar } from './Sidebar';
import { SidebarFloating } from './SidebarFloating';
import { useAppStore } from '../../store/useAppStore';

/**
 * AppSidebar — picks the sidebar shape the user asked for in their profile
 * menu. Standard (default) renders the labeled 72px rail + page-column
 * SubNav the app has always shipped; 'floating' renders the compact 240px
 * floating card that pairs a 52px icon rail with the SubNav inline.
 *
 * Mount this in place of `<Sidebar />` directly; AppLayout also drops the
 * standalone `<SubNav />` next to the content column when the floating
 * shape is active, since that panel is already carried inside the card.
 */
export function AppSidebar() {
  const shape = useAppStore(s => s.sidebarShape);
  return shape === 'floating' ? <SidebarFloating /> : <Sidebar />;
}
