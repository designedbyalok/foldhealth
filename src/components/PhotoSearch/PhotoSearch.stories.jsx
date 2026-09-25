import { useState } from 'react';
import { PhotoSearch } from './PhotoSearch';

// Offline stand-in for the Pexels proxy: flat token-coloured tiles, no network.
const TINTS = ['var(--primary-300)', 'var(--status-success)', 'var(--status-warning)', 'var(--neutral-400)', 'var(--status-error)', 'var(--primary-200)'];
const stubSearch = ({ query, page }) => new Promise(resolve => setTimeout(() => resolve({
  source: 'pexels',
  nextPage: page < 2 ? page + 1 : null,
  photos: query.toLowerCase() === 'none' ? [] : TINTS.map((c, i) => ({
    id: page * 100 + i,
    alt: `${query} ${i + 1}`,
    photographer: 'Sample Photographer',
    avgColor: c,
  })),
}), 600));

export default {
  title: 'Forms/PhotoSearch',
  component: PhotoSearch,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'Search free stock photos (Pexels, photos only) and pick one. Used for the Employer Impact report cover background. Stories use a stubbed search; type "none" to see the empty state.' },
    },
  },
  argTypes: {
    orientation: { control: 'select', options: [undefined, 'portrait', 'landscape', 'square'] },
    placeholder: { control: 'text' },
  },
};

export const Default = {
  args: { orientation: 'portrait' },
  render: (args) => {
    const [picked, setPicked] = useState(null);
    return (
      <div style={{ width: 520 }}>
        <PhotoSearch {...args} search={stubSearch} selectedId={picked?.id} onSelect={setPicked} />
      </div>
    );
  },
};
