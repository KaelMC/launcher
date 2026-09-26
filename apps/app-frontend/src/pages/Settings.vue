<script setup lang="ts">
import {
	CoffeeIcon,
	LanguagesIcon,
	LightBulbIcon,
	MicrochipIcon,
	ModrinthIcon,
	PaintbrushIcon,
	RefreshCwIcon,
	Settings2Icon,
	ToggleRightIcon,
} from '@modrinth/assets'
import {
	commonMessages,
	commonSettingsMessages,
	defineMessage,
	defineMessages,
	injectNotificationManager,
	LoadingIndicator,
	PageHeader,
	ProgressBar,
	UnsavedChangesPopup,
	useVIntl,
} from '@modrinth/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { getVersion } from '@tauri-apps/api/app'
import { platform as getOsPlatform, version as getOsVersion } from '@tauri-apps/plugin-os'
import { computed, provide, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import AppearanceSettings from '@/components/ui/settings/display/AppearanceSettings.vue'
import BehaviorSettings from '@/components/ui/settings/display/BehaviorSettings.vue'
import FeatureFlagSettings from '@/components/ui/settings/display/FeatureFlagSettings.vue'
import FeaturesSettings from '@/components/ui/settings/display/FeaturesSettings.vue'
import LanguageSettings from '@/components/ui/settings/display/LanguageSettings.vue'
import InstancesSyncedSettings from '@/components/ui/settings/instances/instances-synced-settings/index.vue'
import JavaSettings from '@/components/ui/settings/instances/JavaSettings.vue'
import ResourceManagementSettings from '@/components/ui/settings/instances/ResourceManagementSettings.vue'
import { useAppSettings } from '@/composables/use-app-settings.ts'
import { appSettingsKeys, appSettingsQueryOptions, set } from '@/helpers/settings.ts'
import {
	appSettingsModalContextKey,
	type UnsavedChangesController,
} from '@/providers/app-settings-modal'
import { injectAppUpdateDownloadProgress } from '@/providers/download-progress.ts'

const route = useRoute()
const router = useRouter()

const appSettings = useAppSettings()

const { formatMessage } = useVIntl()
const { handleError } = injectNotificationManager()
const queryClient = useQueryClient()

const devModeCounter = ref(0)

const developerModeEnabled = defineMessage({
	id: 'app.settings.developer-mode-enabled',
	defaultMessage: 'Developer mode enabled.',
})

const tabCategories = defineMessages({
	display: {
		id: 'settings.sidebar.label.display',
		defaultMessage: 'Display',
	},
	instances: {
		id: 'app.settings.sidebar.label.instances',
		defaultMessage: 'Instances',
	},
})

const tabs = [
	{
		id: 'appearance',
		name: defineMessage({
			id: 'app.settings.tabs.appearance',
			defaultMessage: 'Appearance',
		}),
		category: tabCategories.display,
		icon: PaintbrushIcon,
		content: AppearanceSettings,
	},
	{
		id: 'features',
		name: defineMessage({
			id: 'app.settings.tabs.features',
			defaultMessage: 'Features',
		}),
		category: tabCategories.display,
		icon: LightBulbIcon,
		content: FeaturesSettings,
	},
	{
		id: 'behavior',
		name: defineMessage({
			id: 'app.settings.tabs.behavior',
			defaultMessage: 'Behavior',
		}),
		category: tabCategories.display,
		icon: Settings2Icon,
		content: BehaviorSettings,
	},
	{
		id: 'language',
		name: defineMessage({
			id: 'app.settings.tabs.language',
			defaultMessage: 'Language',
		}),
		category: tabCategories.display,
		icon: LanguagesIcon,
		content: LanguageSettings,
		badge: commonMessages.beta,
	},
	{
		id: 'feature-flags',
		name: commonSettingsMessages.featureFlags,
		category: tabCategories.display,
		icon: ToggleRightIcon,
		content: FeatureFlagSettings,
		developerOnly: true,
	},
	{
		id: 'synced-options',
		name: defineMessage({
			id: 'app.settings.tabs.synced-options',
			defaultMessage: 'Synced settings',
		}),
		category: tabCategories.instances,
		icon: RefreshCwIcon,
		content: InstancesSyncedSettings,
	},
	{
		id: 'java-installations',
		name: defineMessage({
			id: 'app.settings.tabs.java-installations',
			defaultMessage: 'Java installations',
		}),
		category: tabCategories.instances,
		icon: CoffeeIcon,
		content: JavaSettings,
	},
	{
		id: 'resource-management',
		name: defineMessage({
			id: 'app.settings.tabs.resource-management',
			defaultMessage: 'Resource management',
		}),
		category: tabCategories.instances,
		icon: MicrochipIcon,
		content: ResourceManagementSettings,
	},
]

const availableTabs = computed(() =>
	tabs.filter((tab) => !tab.developerOnly || appSettings.devMode),
)

function tabIndexFromRoute(): number {
	const requestedId = route.query.tab
	if (typeof requestedId === 'string') {
		const index = availableTabs.value.findIndex((tab) => tab.id === requestedId)
		if (index >= 0) return index
	}
	return 0
}

const selectedTab = ref(tabIndexFromRoute())

const unsavedChangesPopup = ref<{ nudge: () => void } | null>(null)
const unsavedChangesController = ref<UnsavedChangesController | null>(null)
const emptyUnsavedChangesState: Record<string, unknown> = {}
const originalUnsavedChangesState = computed(
	() => unsavedChangesController.value?.getOriginal() ?? emptyUnsavedChangesState,
)
const modifiedUnsavedChangesState = computed(
	() => unsavedChangesController.value?.getModified() ?? emptyUnsavedChangesState,
)
const savingUnsavedChanges = computed(() => unsavedChangesController.value?.isSaving() ?? false)
const hasUnsavedChanges = computed(
	() =>
		(unsavedChangesController.value?.hasChanges() ?? false) ||
		(unsavedChangesController.value?.isSaving() ?? false),
)

function canLeaveCurrentTab(): boolean {
	if (
		!unsavedChangesController.value?.hasChanges() &&
		!unsavedChangesController.value?.isSaving()
	) {
		return true
	}
	unsavedChangesPopup.value?.nudge()
	return false
}

function setTab(index: number) {
	if (index === selectedTab.value) return
	if (!canLeaveCurrentTab()) return
	selectedTab.value = index
	void router.replace({ query: { ...route.query, tab: availableTabs.value[index]?.id } })
}

function close(): boolean {
	if (!canLeaveCurrentTab()) return false
	if (window.history.state?.back) {
		router.back()
	} else {
		void router.push('/')
	}
	return true
}

onBeforeRouteLeave(() => canLeaveCurrentTab())

function registerUnsavedChangesController(controller: UnsavedChangesController | null): void {
	unsavedChangesController.value = controller
}

provide(appSettingsModalContextKey, {
	close,
	registerUnsavedChangesController,
})

function resetUnsavedChanges(): void {
	unsavedChangesController.value?.reset()
}

function saveUnsavedChanges(): void {
	void unsavedChangesController.value?.save()
}

watch(
	() => route.query.tab,
	() => {
		selectedTab.value = tabIndexFromRoute()
	},
)

const { progress, version: downloadingVersion } = injectAppUpdateDownloadProgress()

const { data: appInfo } = useQuery({
	queryKey: ['app-info'],
	queryFn: async () => ({
		version: await getVersion(),
		osPlatform: getOsPlatform(),
		osVersion: getOsVersion(),
	}),
	staleTime: Infinity,
})

const developerModeMutation = useMutation({
	mutationKey: appSettingsKeys.update,
	scope: { id: 'app-settings' },
	mutationFn: async (enabled: boolean) => {
		const settings = await queryClient.fetchQuery(appSettingsQueryOptions())
		const nextSettings = { ...settings, developer_mode: enabled }
		await set(nextSettings)
		return nextSettings
	},
	onMutate: () => queryClient.cancelQueries({ queryKey: appSettingsKeys.all }),
	onSuccess: (settings) => {
		const selectedTabEntry = availableTabs.value[selectedTab.value]

		queryClient.setQueryData(appSettingsKeys.all, settings)
		appSettings.devMode = settings.developer_mode

		const selectedTabIndex = selectedTabEntry
			? availableTabs.value.indexOf(selectedTabEntry)
			: -1
		selectedTab.value = selectedTabIndex >= 0 ? selectedTabIndex : 0
	},
	onError: handleError,
	onSettled: () => queryClient.invalidateQueries({ queryKey: appSettingsKeys.all }),
})

function devModeCount() {
	if (developerModeMutation.isPending.value) return
	devModeCounter.value++
	if (devModeCounter.value > 5) {
		devModeCounter.value = 0
		developerModeMutation.mutate(!appSettings.devMode)
	}
}

const messages = defineMessages({
	downloading: {
		id: 'app.settings.downloading',
		defaultMessage: 'Downloading v{version}',
	},
	appVersion: {
		id: 'app.settings.app-version',
		defaultMessage: 'Modrinth App {version}',
	},
	macos: {
		id: 'app.settings.operating-system.macos',
		defaultMessage: 'macOS',
	},
	developerModeButtonLabel: {
		id: 'app.settings.developer-mode-button.label',
		defaultMessage: 'Toggle developer mode',
	},
})

function startsCategory(index: number) {
	const category = availableTabs.value[index]?.category
	return !!category && category.id !== availableTabs.value[index - 1]?.category?.id
}
</script>

<template>
	<div class="flex h-full flex-col p-6">
		<PageHeader :title="formatMessage(commonMessages.settingsLabel)" />
		<div class="grid min-h-0 flex-1 grid-cols-[minmax(12.5rem,18rem)_minmax(0,1fr)] gap-6 pt-4">
			<div
				class="flex min-h-0 min-w-0 flex-col gap-1 overflow-y-auto border-0 border-r-[1px] border-solid border-divider pr-4"
			>
				<template v-for="(tab, index) in availableTabs" :key="tab.id">
					<div
						v-if="startsCategory(index) && tab.category"
						class="shrink-0 truncate px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-secondary"
					>
						{{ formatMessage(tab.category) }}
					</div>
					<button
						:class="`flex min-w-0 shrink-0 gap-2 items-center text-left rounded-xl px-4 py-2 border-none font-semibold cursor-pointer active:scale-[0.97] transition-all ${selectedTab === index ? 'bg-button-bgSelected text-button-textSelected' : 'bg-transparent text-button-text hover:bg-button-bg hover:text-contrast'}`"
						@click="setTab(index)"
					>
						<component :is="tab.icon" class="w-4 h-4 flex-shrink-0" />
						<span class="min-w-0 flex-1 truncate">{{ formatMessage(tab.name) }}</span>
						<span
							v-if="tab.badge"
							class="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold bg-brand-highlight text-brand-green"
						>
							{{ formatMessage(tab.badge) }}
						</span>
					</button>
				</template>

				<div class="mt-auto pt-4 text-secondary text-sm">
					<div class="mb-3">
						<template v-if="progress > 0 && progress < 1">
							<p class="m-0 mb-2">
								{{ formatMessage(messages.downloading, { version: downloadingVersion }) }}
							</p>
							<ProgressBar :progress="progress" />
						</template>
					</div>
					<p v-if="appSettings.devMode" class="text-brand font-semibold m-0 mb-2">
						{{ formatMessage(developerModeEnabled) }}
					</p>
					<div class="flex items-center gap-3">
						<button
							:aria-label="formatMessage(messages.developerModeButtonLabel)"
							:disabled="developerModeMutation.isPending.value"
							class="p-0 m-0 bg-transparent border-none cursor-pointer button-animation"
							:class="{
								'text-brand': appSettings.devMode,
								'text-secondary': !appSettings.devMode,
							}"
							@click="devModeCount"
						>
							<ModrinthIcon aria-hidden="true" class="w-6 h-6" />
						</button>
						<div v-if="appInfo" class="max-w-[200px]">
							<p class="m-0">
								{{ formatMessage(messages.appVersion, { version: appInfo.version }) }}
							</p>
							<p class="m-0">
								<span v-if="appInfo.osPlatform === 'macos'">{{ formatMessage(messages.macos) }}</span>
								<span v-else class="capitalize">{{ appInfo.osPlatform }}</span>
								{{ appInfo.osVersion }}
							</p>
						</div>
					</div>
				</div>
			</div>
			<div class="relative min-h-0">
				<div class="absolute inset-0 overflow-y-auto pb-24">
					<Suspense>
						<component :is="availableTabs[selectedTab]?.content" v-if="availableTabs[selectedTab]?.content" />
						<template #fallback>
							<LoadingIndicator class="py-2" />
						</template>
					</Suspense>
				</div>
				<div class="pointer-events-none absolute bottom-0 left-0 right-0 z-20">
					<div class="pointer-events-auto">
						<UnsavedChangesPopup
							ref="unsavedChangesPopup"
							:original="originalUnsavedChangesState"
							:modified="modifiedUnsavedChangesState"
							:saving="savingUnsavedChanges"
							:class="{ hidden: !hasUnsavedChanges }"
							inline
							@reset="resetUnsavedChanges"
							@save="saveUnsavedChanges"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
