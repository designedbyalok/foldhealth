import { useState } from 'react';
import { Button } from '../Button/Button';
import { UnityInsightHeader, UnityInsightStrip, UnityInsights, UnityRecommendation } from './UnityInsights';

export default {
  title: 'AI/UnityInsights',
  component: UnityInsights,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'The Unity layer under a card: a headline strip, section headers with "Powered by Unity", and recommendation rows with an action cell (Figma Reports 31:35360).',
      },
    },
  },
};

const frame = { width: 520, border: '0.5px solid var(--neutral-150)', borderRadius: 'var(--space-2)', overflow: 'hidden', background: 'var(--neutral-0)' };

export const Default = {
  render: () => (
    <div style={frame}>
      <UnityInsights>
        <UnityInsightStrip>Sustained proactive engagement can keep red-flagged patients below critical levels!</UnityInsightStrip>
        <UnityInsightHeader title="Recommendations:" />
        <UnityRecommendation
          title="Early Intervention"
          description="Prioritize follow-ups for high-risk patients before they become overdue."
          actions={<Button variant="soft" size="sm" leadingIcon="solar:bolt-linear">Run Automation</Button>}
        />
        <UnityRecommendation
          title="HRA Completion"
          description="Encourage patients to complete HRAs early to detect risks sooner."
          actions={<Button variant="soft" size="sm" leadingIcon="solar:document-add-linear">Send Form</Button>}
        />
      </UnityInsights>
    </div>
  ),
};

export const Collapsible = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div style={frame}>
        <UnityInsights>
          <UnityInsightStrip expanded={open} onToggle={() => setOpen(v => !v)}>
            Missed Annual Wellness Visit on 04/10/2026 is not rebooked.
          </UnityInsightStrip>
          {open && (
            <>
              <UnityInsightHeader title="Recommendations:" />
              <UnityRecommendation
                title="Missed Annual Wellness Visit"
                description="04/10/2026 • Never checked in • Not rebooked"
                actions={<Button variant="soft" size="sm" leadingIcon="solar:calendar-add-linear">Reschedule</Button>}
              />
            </>
          )}
        </UnityInsights>
      </div>
    );
  },
};
