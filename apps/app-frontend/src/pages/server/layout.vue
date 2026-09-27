<template>
	<div v-if="server">
		<div class="p-6 pr-2 pb-4">
			<PageHeader :title="server.name">
				<template #leading>
					<Avatar
						:src="server.icon_url ?? undefined"
						:alt="server.name"
						size="64px"
						:tint-by="server.id"
						pad-transparent-corners
					/>
				</template>

				<template #metadata>
					<PageHeaderMetadata>
						<PageHeaderMetadataItem :icon="statusIcon" tooltip="Server status">
							{{ playing ? formatMessage(messages.running) : formatMessage(messages.stopped) }}
						</PageHeaderMetadataItem>
						<PageHeaderMetadataTimeItem
							v-if="server.last_played"
							:icon="ClockIcon"
							:date="server.last_played"
							:label="formatMessage(messages.lastOpened)"
						/>
						<PageHeaderMetadataItem v-else :icon="ClockIcon" tooltip="Last opened">
							{{ formatMessage(messages.neverOpened) }}
						</PageHeaderMetadataItem>
					</PageHeaderMetadata>
				</template>

				<template #actions>
					<PageHeaderActions>
						<Button
							v-if="playing"
							type="colored"
							color="red"
							size="xl"
							native-type="button"
							@click="toggleStatus"
						>
							<StopCircleIcon />
							{{ formatMessage(commonMessages.stopButton) }}
						</Button>
						<Button v-else type="colored" color="brand" size="xl" native-type="button" @click="toggleStatus">
							<PlayIcon />
							{{ formatMessage(commonMessages.playButton) }}
						</Button>

						<IconButton
							v-tooltip="formatMessage(messages.settings)"
							size="xl"
							:label="formatMessage(messages.settings)"
							native-type="button"
							@click="openSettings"
						>
							<SettingsIcon />
						</IconButton>
						<TeleportOverflowMenu
							type="quiet"
							size="xl"
							:label="formatMessage(messages.moreActions)"
							:tooltip="formatMessage(messages.moreActions)"
							:options="moreActions"
						>
							<MoreVerticalIcon />
						</TeleportOverflowMenu>
					</PageHeaderActions>
				</template>
			</PageHeader>
		</div>
		<div class="px-6">
			<NavTabs :links="tabs" />
		</div>
		<div class="p-6 pt-4">
			<RouterView v-slot="{ Component }">
				<template v-if="Component">
					<Suspense :key="server.id">
						<component :is="Component" />
					</Suspense>
				</template>
			</RouterView>
		</div>

		<NewModal ref="renameModal" :header="formatMessage(messages.renameServer)" max-width="450px">
			<div class="flex flex-col gap-2.5">
				<label for="server-rename" class="font-semibold text-contrast">
					{{ formatMessage(messages.serverName) }}
				</label>
				<Input id="server-rename" v-model="renameValue" :maxlength="256" />
			</div>
			<template #actions>
				<div class="flex justify-end gap-2">
					<Button type="outlined" @click="renameModal?.hide()">
						<XIcon />
						{{ formatMessage(commonMessages.cancelButton) }}
					</Button>
					<Button
						type="colored"
						color="brand"
						:disabled="!renameValue.trim()"
						@click="saveRename"
					>
						<CheckIcon />
						{{ formatMessage(commonMessages.saveChangesButton) }}
					</Button>
				</div>
			</template>
		</NewModal>
		<ConfirmDeleteServerModal
			ref="confirmDeleteModal"
			:instances="server ? [server] : []"
			@delete="handleDelete"
		/>
	</div>
</template>

<script setup lang="ts">
import {
	BoxesIcon,
	CheckIcon,
	ClockIcon,
	FolderOpenIcon,
	GlobeIcon,
	MoreVerticalIcon,
	PlayIcon,
	SettingsIcon,
	StopCircleIcon,
	TerminalSquareIcon,
	TrashIcon,
	XIcon,
} from '@modrinth/assets'
import {
	Avatar,
	Button,
	type ButtonMenuOption,
	commonMessages,
	defineMessages,
	IconButton,
	Input,
	NavTabs,
	NewModal,
	PageHeader,
	PageHeaderActions,
	PageHeaderMetadata,
	PageHeaderMetadataItem,
	PageHeaderMetadataTimeItem,
	TeleportOverflowMenu,
	useVIntl,
} from '@modrinth/ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ConfirmDeleteServerModal from '@/components/ui/modal/ConfirmDeleteServerModal.vue'
import { editServer, fakeServers, removeServer, toggleServerStatus } from '@/helpers/fake-servers'
import { useRootBreadcrumb } from '@/providers/breadcrumbs'

import { provideServerPage } from './server-context'

const { formatMessage } = useVIntl()
const route = useRoute()
const router = useRouter()

const messages = defineMessages({
	running: { id: 'app.server.status.running', defaultMessage: 'Running' },
	stopped: { id: 'app.server.status.stopped', defaultMessage: 'Stopped' },
	lastOpened: { id: 'app.server.last-opened', defaultMessage: 'Last opened' },
	neverOpened: { id: 'app.server.never-opened', defaultMessage: 'Never opened' },
	settings: { id: 'app.server.action.settings', defaultMessage: 'Server settings' },
	moreActions: { id: 'app.server.action.more-actions', defaultMessage: 'More actions' },
	renameServer: { id: 'app.server.action.rename', defaultMessage: 'Rename server' },
	serverName: { id: 'app.server.rename.name-label', defaultMessage: 'Server name' },
	deleteServer: { id: 'app.server.action.delete', defaultMessage: 'Delete server' },
	contentTab: { id: 'app.server.tab.content', defaultMessage: 'Content' },
	filesTab: { id: 'app.server.tab.files', defaultMessage: 'Files' },
	worldsTab: { id: 'app.server.tab.worlds', defaultMessage: 'Worlds' },
	logsTab: { id: 'app.server.tab.logs', defaultMessage: 'Logs' },
})

const serverId = computed(() => String(route.params.id ?? ''))
const server = computed(() => fakeServers.value.find((candidate) => candidate.id === serverId.value))
const playing = computed(() => server.value?.status === 'running')
const statusIcon = computed(() => (playing.value ? PlayIcon : StopCircleIcon))

watch(
	[serverId, server],
	([id, found]) => {
		if (id && !found) {
			void router.replace('/servers')
		}
	},
	{ immediate: true },
)

const basePath = computed(() => `/servers/${encodeURIComponent(serverId.value)}`)
const tabs = computed(() => [
	{ label: formatMessage(messages.contentTab), href: basePath.value, icon: BoxesIcon },
	{ label: formatMessage(messages.filesTab), href: `${basePath.value}/files`, icon: FolderOpenIcon },
	{ label: formatMessage(messages.worldsTab), href: `${basePath.value}/worlds`, icon: GlobeIcon },
	{ label: formatMessage(messages.logsTab), href: `${basePath.value}/logs`, icon: TerminalSquareIcon },
])

function toggleStatus() {
	toggleServerStatus(serverId.value)
}

const renameModal = ref<InstanceType<typeof NewModal>>()
const renameValue = ref('')

function openSettings() {
	renameValue.value = server.value?.name ?? ''
	renameModal.value?.show()
}

function saveRename() {
	const trimmedName = renameValue.value.trim()
	if (!trimmedName) return

	editServer(serverId.value, { name: trimmedName })
	renameModal.value?.hide()
}

const confirmDeleteModal = ref<InstanceType<typeof ConfirmDeleteServerModal>>()

function handleDelete() {
	removeServer(serverId.value)
	void router.push('/servers')
}

const moreActions = computed<ButtonMenuOption[]>(() => [
	{
		id: 'delete',
		label: formatMessage(messages.deleteServer),
		icon: TrashIcon,
		tone: 'red',
		hoverFilledOnly: true,
		action: () => confirmDeleteModal.value?.show(),
	},
])

useRootBreadcrumb({
	slot: 'server',
	id: () => `server:${serverId.value}`,
	label: () => server.value?.name ?? formatMessage(commonMessages.loadingLabel),
	visual: () => ({
		type: 'image',
		src: server.value?.icon_url ?? undefined,
		tintBy: server.value?.id ?? serverId.value,
	}),
	to: () => basePath.value,
})

provideServerPage({
	serverId,
	server,
	playing,
	toggleStatus,
	openSettings,
})
</script>
