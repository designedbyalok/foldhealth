import { OAuthButtons } from './OAuthButtons';

export default {
  title: 'Forms/OAuthButtons',
  component: OAuthButtons,
  tags: ['autodocs'],
  args: { onSelect: () => {} },
  decorators: [(Story) => <div style={{ width: 360 }}><Story /></div>],
};

export const GoogleOnly = {};
export const BothLive = { args: { enabled: ['google', 'azure'] } };
export const Disabled = { args: { disabled: true } };
