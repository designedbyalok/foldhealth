import { Tabs } from '../Tabs/Tabs';

// Now Tabs (src/components/layers.json $deprecated). Kept so open branches build.
export function TabStrip({ activeKey, onChange, ...rest }) {
  return <Tabs value={activeKey} onValueChange={onChange} {...rest} />;
}
