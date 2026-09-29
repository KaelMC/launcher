<template>
	<CreationFlowModal
		ref="creationFlowModal"
		type="server"
		show-snapshot-toggle
		:available-loaders="serverLoaders"
		:fetch-existing-instance-names="fetchExistingServerNames"
		:search-projects="searchProjects"
		:randomize-instance-icon="randomizeInstanceIcon"
		:customize-instance-icon="customizeInstanceIcon"
		@create="handleCreate"
		@browse-modpacks="handleBrowseModpacks"
		@hide="emit('update:modelValue', false)"
	/>
	<IconEditorModal ref="iconEditorModal" :config="generatedIcon?.config" @saved="handleIconSaved" />
</template>

<script setup lang="ts">
import type { CreationFlowContextValue } from '@modrinth/ui'
import { CreationFlowModal, injectNotificationManager } from '@modrinth/ui'
import { convertFileSrc } from '@tauri-apps/api/core'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import IconEditorModal from '@/components/ui/instance_settings/icon-editor-modal/index.vue'
import { get_search_results } from '@/helpers/cache.js'
import { createServer, servers, type ServerLoader } from '@/helpers/server'
import { beginServerCreationFromBrowse } from '@/helpers/server-creation-intent'
import type { InstanceIconConfig } from '@/helpers/types'

const { handleError } = injectNotificationManager()

const props = defineProps<{
	modelValue: boolean
}>()

const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void
}>()

const serverLoaders = ['paper', 'spigot', 'fabric', 'neoforge', 'forge', 'quilt']

const router = useRouter()
const creationFlowModal = ref<InstanceType<typeof CreationFlowModal>>()
const iconEditorModal = ref<InstanceType<typeof IconEditorModal>>()
const generatedIcon = ref<{ path: string; config: InstanceIconConfig } | null>(null)

watch(
	() => props.modelValue,
	(open) => {
		if (open) {
			creationFlowModal.value?.show()
		} else {
			creationFlowModal.value?.hide()
		}
	},
)

async function fetchExistingServerNames() {
	return servers.value.map((server) => server.name)
}

async function searchProjects(query: string, limit: number = 10) {
	const projectTypes = ['mod', 'modpack', 'resourcepack', 'shader', 'datapack']
	const facets = JSON.stringify([projectTypes.map((type) => `project_type:${type}`)])
	const params = [`facets=${encodeURIComponent(facets)}`, `limit=${limit}`]
	if (query) {
		params.push(`query=${encodeURIComponent(query)}`)
	}
	const raw = await get_search_results(`?${params.join('&')}`)
	if (raw?.result) return raw.result
	return { hits: [], offset: 0, limit, total_hits: 0 }
}

async function randomizeInstanceIcon() {
	const generated = await iconEditorModal.value?.randomizeAndSave()
	if (!generated) return null

	generatedIcon.value = { path: generated.iconPath, config: generated.config }
	return {
		path: generated.iconPath,
		previewUrl: convertFileSrc(generated.iconPath),
	}
}

function customizeInstanceIcon() {
	iconEditorModal.value?.show()
}

function handleIconSaved(iconPath: string, config: InstanceIconConfig) {
	generatedIcon.value = { path: iconPath, config }

	const context = creationFlowModal.value?.ctx
	if (!context) return

	context.instanceIcon.value = null
	context.instanceIconUrl.value = convertFileSrc(iconPath)
	context.instanceIconPath.value = iconPath
}

function handleBrowseModpacks() {
	beginServerCreationFromBrowse()
	router.push('/browse/modpack')
}

async function handleCreate(config: CreationFlowContextValue) {
	try {
		const loader = (config.selectedLoader.value ?? 'vanilla') as ServerLoader
		const gameVersion = config.selectedGameVersion.value
		if (!gameVersion) return

		const name =
			config.instanceName.value.trim() ||
			config.autoInstanceName.value ||
			config.modpackSelection.value?.name ||
			'New Server'
		const iconPath = config.instanceIconPath.value ?? null

		creationFlowModal.value?.hide()

		const server = await createServer(
			name,
			iconPath,
			loader,
			loader === 'vanilla' ? null : (config.selectedLoaderVersion.value ?? null),
			gameVersion,
		)

		await router.push(`/servers/${encodeURIComponent(server.id)}`)
	} catch (error) {
		handleError(error)
	}
}
</script>
