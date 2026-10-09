import { useState } from 'react';
import { ImageTileGallery } from './ImageTileGallery';
import { PRESET_COVERS } from '../../features/analytics/views/employer/reportCovers';

export default {
  title: 'Forms/ImageTileGallery',
  component: ImageTileGallery,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'Pick one image from a grid, or add a new one (click or drop a file). Added images can be removed on hover. Used for the Employer Impact report cover. The story keeps added images in memory.' },
    },
  },
  argTypes: {
    columns: { control: { type: 'number', min: 2, max: 6 } },
    aspectRatio: { control: 'text' },
  },
};

export const Default = {
  args: { columns: 4, aspectRatio: '3 / 4' },
  render: (args) => {
    const [added, setAdded] = useState([]);
    const [selected, setSelected] = useState(PRESET_COVERS[0].id);
    const items = [...added, ...PRESET_COVERS];
    return (
      <div style={{ width: 520 }}>
        <ImageTileGallery
          {...args}
          ariaLabel="Cover image"
          items={items}
          selectedId={selected}
          onSelect={setSelected}
          accept=".png,.jpg,.jpeg,.svg"
          acceptMime={['image/png', 'image/jpeg', 'image/svg+xml']}
          maxMb={5}
          onAdd={(file) => new Promise((resolve) => setTimeout(() => {
            const id = `added-${Date.now()}`;
            setAdded(a => [{ id, src: URL.createObjectURL(file), label: file.name, removable: true }, ...a]);
            setSelected(id);
            resolve();
          }, 600))}
          onRemove={(id) => setAdded(a => a.filter(x => x.id !== id))}
        />
      </div>
    );
  },
};
