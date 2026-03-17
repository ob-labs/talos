import { userPreferencesStorage } from '@/lib/storage/user-preferences';
import { withErrorHandler, handleSuccess } from "@/lib/api/error-handler";

/**
 * GET /api/preferences
 * Get user preferences
 */
export async function GET() {
  return withErrorHandler(async () => {
    // TODO: userPreferencesStorage is temporarily null due to circular dependency
    // Return default preferences for now
    if (!userPreferencesStorage) {
      return handleSuccess({
        activeWorkspace: null,
        activeWorktree: null,
        activeStory: null,
        sidebarView: 'workspaces' as const,
        isLeftPanelCollapsed: false,
        isRightPanelCollapsed: false,
        lastUpdated: Date.now(),
        version: '0.1.0',
      });
    }

    const preferences = await userPreferencesStorage.getPreferences();
    return handleSuccess(preferences);
  }, "GET /api/preferences");
}
