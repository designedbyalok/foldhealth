import { UpdateCard } from './UpdateCard';

export default {
  title: 'Feedback/UpdateCard',
  component: UpdateCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Floating announcement card (gradient hero, title with an optional pill tag, up to three highlights, primary + secondary action). The app uses it through UpdateAvailableCard, which appears bottom-right when a newer deploy is detected. Refresh reloads; Dismiss hides it for that deploy.',
      },
    },
  },
  args: {
    title: 'New update available',
    description: 'Refresh to get the latest version.',
    highlights: [
      "Login Activity in a user's Audit Log",
      'Account lockout: administrator-only unlock with an emailed link',
      'HCC Diagnosis Gaps and the Care Plan in the side panel (floating sidebar)',
    ],
    primaryLabel: 'Refresh',
    secondaryLabel: 'Dismiss',
    floating: false,
  },
};

export const Default = {};

export const WithoutHighlights = { args: { highlights: [] } };
