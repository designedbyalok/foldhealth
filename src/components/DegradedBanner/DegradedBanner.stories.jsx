import { DegradedBanner } from './DegradedBanner';

export default {
  title: 'Feedback/DegradedBanner',
  component: DegradedBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Global banner shown when the app is running in a degraded state (e.g. Supabase unreachable, real-time channel down). Reads its own status from the store, no props.',
      },
    },
  },
};

export const Default = { render: () => <DegradedBanner /> };
