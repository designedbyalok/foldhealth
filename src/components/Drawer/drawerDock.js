import { createContext } from 'react';

// A DOM element that `dockable` Drawers render into, beside the content
// instead of over it. Null (the default) keeps every Drawer an overlay.
export const DrawerDockContext = createContext(null);
