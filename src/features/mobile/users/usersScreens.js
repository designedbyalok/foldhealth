import { UsersScreen } from './UsersScreen';
import { UserDetailScreen } from './UserDetailScreen';
import { EditUserScreen } from './EditUserScreen';
import { InviteUserScreen } from './InviteUserScreen';
import { RolesScreen } from './RolesScreen';
import { RoleScreen } from './RoleScreen';
import { LocationsScreen } from './LocationsScreen';
import { LocationFormScreen } from './LocationFormScreen';

// Settings > Account (Users, Access Control, Locations) on the phone.
export const USERS_SCREENS = {
  settingsUsers: UsersScreen,
  settingsUser: UserDetailScreen,
  settingsUserEdit: EditUserScreen,
  settingsInviteUser: InviteUserScreen,
  settingsRoles: RolesScreen,
  settingsRole: RoleScreen,
  settingsLocations: LocationsScreen,
  settingsLocation: LocationFormScreen,
};
// Screens with a pinned footer action hide the tab bar.
export const USERS_FULL_SCREEN = ['settingsUser', 'settingsUserEdit', 'settingsInviteUser', 'settingsLocation'];
