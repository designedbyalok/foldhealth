import { Icon } from './Icon';
import { AiInsightIcon } from './AiInsightIcon';
import { CloseIcon } from './CloseIcon';
import { UnityIcon } from '../UnityIcon/UnityIcon';

export default {
  title: 'Core/Icon',
  component: Icon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders any Iconify icon by name, the app standardizes on the Solar set at 1px stroke (see `solar:*-linear` variants) with a handful of in-repo `custom:*` icons for shapes Solar doesn\'t cover. Use this instead of importing SVGs directly so sizing, color, and stroke-width stay consistent. Toggle `showCatalog` to browse the commonly-used names and the branded in-repo icons.',
      },
    },
  },
  argTypes: {
    name: { control: 'text' },
    size: { control: 'number' },
    color: { control: 'color' },
    showCatalog: {
      control: 'boolean',
      description: 'Show the reference grid of common + branded icons below the playground icon.',
    },
  },
  args: { name: 'solar:home-2-linear', size: 24, showCatalog: false },
};

// In-repo `custom:*` icons for the PAMI/Hx sections and their empty states,
// shapes Solar doesn't have (or, for the wine glass, kept local alongside
// its siblings). Rendered through <Icon> so the registry itself is exercised.
const CLINICAL_ICONS = [
  { name: 'custom:allergy', label: 'Allergy' },
  { name: 'custom:scalpel', label: 'Surgical History' },
  { name: 'custom:medical-history', label: 'Medical History' },
  { name: 'custom:family-history', label: 'Family History' },
  { name: 'custom:social-history', label: 'Social History' },
  { name: 'custom:tobacco', label: 'Tobacco' },
  { name: 'custom:sdoh', label: 'SDOH' },
  { name: 'custom:drag-handle', label: 'Drag Handle' },
  { name: 'custom:imaging', label: 'Imaging' },
];

const COMMON_ICONS = [
  'solar:home-2-linear', 'solar:users-group-rounded-linear', 'solar:settings-linear',
  'custom:filter', 'solar:magnifer-linear', 'solar:add-circle-linear',
  'solar:phone-calling-linear', 'solar:chat-round-linear', 'solar:history-linear',
  'solar:check-circle-linear', 'solar:close-circle-linear', 'solar:menu-dots-bold',
  'solar:pen-linear', 'solar:trash-bin-minimalistic-linear', 'solar:file-text-linear',
  'solar:chart-2-linear', 'solar:arrow-up-linear', 'solar:arrow-down-linear',
];

function Catalog() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32, borderTop: '0.5px solid var(--neutral-150)', paddingTop: 24 }}>
      <div>
        <div style={{ fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 'var(--font-sm)' }}>Common icons</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
          {COMMON_ICONS.map(name => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Icon name={name} size={24} />
              <span style={{ fontSize: 'var(--font-2xs)', color: 'var(--neutral-300)', textAlign: 'center', wordBreak: 'break-all' }}>
                {name.replace('solar:', '')}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 'var(--font-sm)' }}>Branded in-repo icons</div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <AiInsightIcon size={32} />
            <div style={{ fontSize: 'var(--font-2xs)', color: 'var(--neutral-300)', marginTop: 4 }}>AI Insight</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <CloseIcon size={24} />
            <div style={{ fontSize: 'var(--font-2xs)', color: 'var(--neutral-300)', marginTop: 4 }}>Close</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <UnityIcon size={24} color="var(--primary-300)" />
            <div style={{ fontSize: 'var(--font-2xs)', color: 'var(--neutral-300)', marginTop: 4 }}>Unity</div>
          </div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 'var(--font-sm)' }}>Clinical in-repo icons (PAMI/Hx)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
          {CLINICAL_ICONS.map(({ name, label }) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Icon name={name} size={24} color="var(--neutral-300)" />
              <span style={{ fontSize: 'var(--font-2xs)', color: 'var(--neutral-300)', textAlign: 'center' }}>{label}</span>
              <span style={{ fontSize: 'var(--font-2xs)', color: 'var(--neutral-200)', textAlign: 'center', wordBreak: 'break-all' }}>{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Playground = {
  render: ({ showCatalog, ...args }) => (
    <div>
      <Icon {...args} />
      {showCatalog && <Catalog />}
    </div>
  ),
};

export const ClinicalIcons = {
  name: 'Clinical icons (PAMI/Hx)',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
      {CLINICAL_ICONS.map(({ name, label }) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Icon name={name} size={31} color="var(--neutral-200)" />
          <span style={{ fontSize: 'var(--font-2xs)', color: 'var(--neutral-300)', textAlign: 'center' }}>{label}</span>
          <span style={{ fontSize: 'var(--font-2xs)', color: 'var(--neutral-200)', textAlign: 'center', wordBreak: 'break-all' }}>{name}</span>
        </div>
      ))}
    </div>
  ),
};
