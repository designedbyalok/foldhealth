import { OverflowTabs } from '../Tabs/OverflowTabs';

// Now OverflowTabs (src/components/layers.json $deprecated). Kept so open branches build.
export function OverflowTabStrip({ activeKey, onChange, ...rest }) {
  return <OverflowTabs value={activeKey} onValueChange={onChange} {...rest} />;
}
