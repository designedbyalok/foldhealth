import { AssigneeChange } from './AssigneeChange';

export default {
  title: 'Core/Assignee',
  component: AssigneeChange,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Worklist row cell for assigning / re-assigning a user. Assigned state = 24px provider avatar + name + optional role, fixed 140px width with name truncation. Unassigned state = outlined person slot + "Assign User", width hugs the content. Hover fills the pill with `--neutral-50` and reveals a chevron.',
      },
    },
  },
  argTypes: {
    name: { control: 'text' },
    initials: { control: 'text' },
    role: { control: 'text' },
    showRole: { control: 'boolean' },
    unassigned: { control: 'boolean' },
    size: { control: 'inline-radio', options: ['M', 'S'] },
    avatarOnly: { control: 'boolean' },
    hideAvatar: { control: 'boolean' },
    unassignedLabel: { control: 'text' },
    disabled: { control: 'boolean' },
    // Patient / member rows use the primary purple Avatar variant;
    // staff rows keep the secondary (default) variant. Kept as a
    // control so consumers can flip the pill (and the hover
    // tooltip avatar) without touching internal wiring.
    avatarVariant: { control: 'inline-radio', options: ['staff', 'patient'] },
  },
};

export const Playground = {
  args: {
    name: 'Deborah Hintz',
    initials: 'DH',
    role: 'Support team',
    unassigned: false,
    avatarOnly: false,
    showRole: false,
    disabled: false,
    size: "M"
  },
};

export const Assigned = {
  args: { name: 'Deborah Hintz', initials: 'DH', role: 'Support team' },
};

export const AssignedLongName = {
  name: 'Assigned · truncated name',
  args: {
    name: 'Dr. Shravank Krishnamurthy Montgomery-Patel',
    initials: 'SM',
    role: 'Support team',
  },
};

export const AssignedNoRole = {
  name: 'Assigned · name only',
  args: { name: 'Daniel Arsulo', initials: 'DA' },
};

// Same value for `role` is passed, but `showRole={false}` hides the
// sub-line: matches the "role toggle off" state in Storybook controls.
export const AssignedRoleHidden = {
  name: 'Assigned · role hidden',
  args: {
    name: 'Deborah Hintz',
    initials: 'DH',
    role: 'Support team',
    showRole: false,
    unassigned: false,
    avatarOnly: false,
    disabled: false
  },
};

export const Unassigned = {
  args: { unassigned: true },
};

// ── Size + state matrix: mirrors Figma Fold-Pixel-1.0 node 8629:178 ────

export const SizeSmall = {
  name: 'Size · S',
  args: { name: 'Deborah Hintz', initials: 'DH', role: 'Support team', size: 'S' },
};

export const AvatarOnly = {
  name: 'Avatar only',
  args: { name: 'Deborah Hintz', initials: 'DH', avatarOnly: true },
};

export const AvatarOnlyUnassigned = {
  name: 'Avatar only · unassigned',
  args: { unassigned: true, avatarOnly: true },
};

export const Disabled = {
  args: { name: 'Deborah Hintz', initials: 'DH', role: 'Support team', disabled: true },
};

// ── hideAvatar variant: used by the HCC worklist role cells. Assigned rows
// drop the initials avatar entirely; unassigned rows swap the outlined
// Avatar-with-icon for a plain leading Solar `user-plus` glyph next to the
// label. ────────────────────────────────────────────────────────────────
export const HideAvatarAssigned = {
  name: 'Hide avatar · assigned',
  args: { name: 'Deborah Hintz', initials: 'DH', hideAvatar: true },
};

export const HideAvatarUnassigned = {
  name: 'Hide avatar · unassigned',
  args: { unassigned: true, hideAvatar: true, unassignedLabel: 'Assign' },
};

export const DisabledUnassigned = {
  name: 'Disabled · unassigned',
  args: { unassigned: true, disabled: true },
};

// Avatar-only unassigned matrix (default / hover / disabled): Figma
// Fold-Pixel-1.0 node 8629:419.
export const AvatarOnlyUnassignedDisabled = {
  name: 'Avatar only · unassigned · disabled',
  args: { unassigned: true, avatarOnly: true, disabled: true },
};

// ── Patient (member) variant ────────────────────────────────────────────
// Every "member task" intervention (Patient Task / Patient Education /
// Send Form / Measure Vital) is owned by the patient. The pill uses
// the primary purple Avatar variant instead of the staff/secondary one
// so a reader can tell at a glance whether a row is owned by a member
// or by a care-team user. The hover tooltip's avatar picks up the same
// variant automatically.
export const PatientAssigned = {
  name: 'Patient · assigned',
  args: {
    name: 'Annette Brave',
    initials: 'AB',
    role: 'Member',
    avatarVariant: 'patient',
  },
};

export const PatientAvatarOnly = {
  name: 'Patient · avatar only',
  args: {
    name: 'Annette Brave',
    initials: 'AB',
    avatarOnly: true,
    avatarVariant: 'patient',
  },
};

export const PatientAvatarOnlyDisabled = {
  name: 'Patient · avatar only · disabled',
  args: {
    name: 'Annette Brave',
    initials: 'AB',
    avatarOnly: true,
    avatarVariant: 'patient',
    disabled: true,
  },
};
