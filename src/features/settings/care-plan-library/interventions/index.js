export { InterventionDrawer } from './InterventionDrawer/InterventionDrawer.jsx';
export { KIND_LABELS, INTERVENTION_KIND_ORDER } from './shared/interventionKinds.js';

// Every kind is edited by the one drawer — the kind only decides which entity
// field sits under the title, so switching it swaps fields in place instead of
// tearing the drawer down.
import { InterventionDrawer as _Drawer } from './InterventionDrawer/InterventionDrawer.jsx';
import { INTERVENTION_KIND_ORDER as _ORDER } from './shared/interventionKinds.js';

export const INTERVENTION_EDITORS = Object.fromEntries(_ORDER.map(k => [k, _Drawer]));
