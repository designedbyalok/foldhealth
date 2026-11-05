import { StickyNoteAuditDrawer } from './StickyNoteAuditDrawer';

export default {
  title: 'Layout/StickyNoteAuditDrawer',
  component: StickyNoteAuditDrawer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Right-side drawer that opens from a patient\'s sticky note. Lets you edit the current note (with EHR profile picker) and shows the full audit history, every prior edit with author, timestamp, and text. Sourced from the `stickyNoteHistory` slice via `fetchStickyNoteHistory(patientId)`.',
      },
    },
  },
  argTypes: {
    patientId: {
      control: 'text',
      description: 'Patient id: used to hydrate note history from the store.',
      table: { type: { summary: 'string' } },
    },
    note: {
      control: 'object',
      description: 'The sticky note currently being edited: `{ id, text, ehr_profile, author_name, updated_at }`.',
      table: { type: { summary: 'StickyNote' } },
    },
    profileOptions: {
      control: 'object',
      description: 'EHR-profile options for the Select. Defaults to Central / APC / FoldHealth.',
      table: { type: { summary: 'string[]' } },
    },
    onClose: {
      action: 'onClose',
      description: 'Fires when the drawer\'s close button (or overlay) is clicked.',
      table: { type: { summary: '() => void' } },
    },
  },
};

export const Playground = {
  args: {
    patientId: 'demo-patient',
    note: {
      id: 'note-1',
      text: 'Prefers afternoon calls. Spouse is primary contact, Maria (555-0134).',
      ehr_profile: 'Central Profile',
      author_name: 'You',
      updated_at: new Date().toISOString(),
    },
    profileOptions: ['Central Profile', 'APC', 'FoldHealth'],
  },
};
