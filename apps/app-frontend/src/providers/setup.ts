import type { AbstractModrinthClient } from '@modrinth/api-client'
import type { AbstractPopupNotificationManager, AbstractWebNotificationManager } from '@modrinth/ui'
import { ref } from 'vue'

import type { InstanceIconConfig } from '@/helpers/types'

import type { AppEvents } from './app-events'
import { setupOnboardingChecklistProvider } from './onboarding-checklist'
import { setupAuthProvider } from './setup/auth'
import { setupCreationModal } from './setup/creation-modal'
import { setupFileDropProvider } from './setup/file-drop'
import { setupFilePickerProvider } from './setup/file-picker'
import { setupImageViewerEditorProvider } from './setup/image-viewer-editor'
import { setupInstanceImportProvider } from './setup/instance-import'
import { setupTagsProvider } from './setup/tags'
import { setupUserCountryProvider } from './setup/user-country'
import { setupAppUserPreferencesProvider } from './setup/user-preferences'

export function setupProviders(
	client: AbstractModrinthClient,
	notificationManager: AbstractWebNotificationManager,
	_popupNotificationManager: AbstractPopupNotificationManager,
	appEvents: AppEvents,
	getGeneratedIconConfig?: (iconPath: string) => InstanceIconConfig | null,
) {
	setupUserCountryProvider(client)
	const authProvider = setupAuthProvider(ref(null), () => {})
	setupAppUserPreferencesProvider(authProvider, notificationManager)
	const tags = setupTagsProvider(notificationManager)
	setupFileDropProvider()
	setupFilePickerProvider()
	setupImageViewerEditorProvider()
	setupInstanceImportProvider(notificationManager)
	const onboardingChecklist = setupOnboardingChecklistProvider(appEvents)

	return {
		...setupCreationModal(notificationManager, getGeneratedIconConfig),
		onboardingChecklist,
		tags,
	}
}
