import { Tabs } from '../Tabs/Tabs';

// Now Tabs variant="pill" (src/components/layers.json $deprecated). Kept so open branches build.
export function SubTabs({ tabs, ...rest }) {
  return <Tabs variant="pill" items={tabs} {...rest} />;
}
