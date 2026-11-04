import { AvatarOooProvider } from './ooo/AvatarOooProvider';
import { BulkBarDefaultsProvider } from './worklists/BulkBarDefaultsProvider';
import { PageSizePreferenceProvider } from './worklists/PageSizePreferenceProvider';
import { ActivityLogRenderersProvider } from './activity/ActivityLogRenderersProvider';
import { MentionRosterProvider } from './activity/MentionRosterProvider';

/**
 * What the app plugs into the component library: the library reads these
 * through context instead of importing the store, so it stays standalone.
 * Mounted around the app (App.jsx) and around every Storybook story.
 */
export function AppProviders({ children }) {
  return (
    <AvatarOooProvider>
      <BulkBarDefaultsProvider>
        <PageSizePreferenceProvider>
          <ActivityLogRenderersProvider>
            <MentionRosterProvider>
              {children}
            </MentionRosterProvider>
          </ActivityLogRenderersProvider>
        </PageSizePreferenceProvider>
      </BulkBarDefaultsProvider>
    </AvatarOooProvider>
  );
}
