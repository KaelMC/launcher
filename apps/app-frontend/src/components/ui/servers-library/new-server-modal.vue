<template>
	<NewModal ref="modal" width="560px" max-width="560px" :on-hide="handleHide">
		<template #title>
			<div class="flex items-center gap-2">
				<IconButton v-if="stage === 'details'" label="Back" @click="stage = 'select'">
					<LeftArrowIcon />
				</IconButton>
				<span class="text-2xl font-semibold text-contrast">New server</span>
			</div>
		</template>

		<div v-if="stage === 'select'" class="flex flex-col gap-4">
			<span class="font-semibold text-contrast">Already know what you want to play?</span>
			<Combobox
				v-model="projectSearchProjectId"
				:options="projectSearchOptions"
				searchable
				show-search-icon
				:show-chevron="false"
				:search-placeholder="'Search mods, modpacks, and more...'"
				:no-options-message="searchLoading ? 'Loading...' : 'No results found'"
				:disable-search-filter="true"
				@search-input="handleSearch"
			/>

			<div class="flex items-center gap-3">
				<div class="h-[1px] w-full flex-1 bg-surface-5" />
				<span class="text-sm text-secondary">or</span>
				<div class="h-[1px] w-full flex-1 bg-surface-5" />
			</div>

			<span class="font-semibold text-contrast">Choose installation type</span>
			<div class="flex flex-col gap-3">
				<BigOptionButton
					:icon="BoxesIcon"
					title="Custom setup"
					description="Start from scratch by picking a loader and game version."
					@click="chooseSetupType()"
				/>
				<BigOptionButton
					:icon="CompassIcon"
					title="Start from a mod or modpack"
					description="Choose a project and we'll use its latest version."
					@click="chooseSetupType()"
				/>
				<BigOptionButton
					:icon="UploadIcon"
					title="Upload a modpack"
					description="Install a modpack from an .mrpack file on your device."
					@click="chooseSetupType()"
				/>
			</div>
		</div>

		<div v-else class="flex flex-col gap-2.5">
			<label for="new-server-name" class="font-semibold text-contrast">Server name</label>
			<Input
				id="new-server-name"
				ref="nameInput"
				v-model="name"
				placeholder="Enter server name"
				:maxlength="256"
				@keyup.enter="handleCreateServer"
			/>
		</div>

		<template #actions>
			<div class="flex items-center justify-end gap-2">
				<Button type="outlined" @click="modal?.hide()">
					<XIcon />
					Cancel
				</Button>
				<Button
					v-if="stage === 'details'"
					type="colored"
					color="brand"
					:disabled="!name.trim()"
					@click="handleCreateServer"
				>
					<PlusIcon />
					Create server
				</Button>
			</div>
		</template>
	</NewModal>
</template>

<script setup lang="ts">
import { BoxesIcon, CompassIcon, LeftArrowIcon, PlusIcon, UploadIcon, XIcon } from '@modrinth/assets'
import { BigOptionButton, Button, Combobox, type ComboboxOption, IconButton, Input, NewModal } from '@modrinth/ui'
import { defineAsyncComponent, h, nextTick, ref, watch } from 'vue'

import { get_search_results } from '@/helpers/cache.js'
import { createServer } from '@/helpers/fake-servers'

const props = defineProps<{
	modelValue: boolean
}>()

const emit = defineEmits<{
	(e: 'update:modelValue', value: boolean): void
}>()

const modal = ref<InstanceType<typeof NewModal>>()
const nameInput = ref<InstanceType<typeof Input>>()
const stage = ref<'select' | 'details'>('select')
const name = ref('')

const searchLoading = ref(false)
const projectSearchProjectId = ref<string | undefined>()
const projectSearchOptions = ref<ComboboxOption<string>[]>([])
const projectSearchHits = ref<Record<string, { title: string; iconUrl?: string }>>({})

watch(
	() => props.modelValue,
	(open) => {
		if (open) {
			stage.value = 'select'
			name.value = ''
			projectSearchProjectId.value = undefined
			projectSearchOptions.value = []
			projectSearchHits.value = {}
			modal.value?.show()
			void search('')
		} else {
			modal.value?.hide()
		}
	},
)

async function search(query: string) {
	try {
		const projectTypes = ['mod', 'modpack', 'resourcepack', 'shader', 'datapack']
		const facets = JSON.stringify([projectTypes.map((type) => `project_type:${type}`)])
		const params = [`facets=${encodeURIComponent(facets)}`, 'limit=10']
		if (query) {
			params.push(`query=${encodeURIComponent(query)}`)
		}
		const raw = await get_search_results(`?${params.join('&')}`)
		const results = raw?.result ?? { hits: [] }

		projectSearchHits.value = {}
		for (const hit of results.hits) {
			projectSearchHits.value[hit.project_id] = {
				title: hit.title,
				iconUrl: hit.icon_url,
			}
		}

		projectSearchOptions.value = results.hits.map((hit: { project_id: string; title: string; icon_url: string }) => ({
			label: hit.title,
			value: hit.project_id,
			icon: defineAsyncComponent(() =>
				Promise.resolve({
					setup: () => () =>
						h('img', { src: hit.icon_url, alt: hit.title, class: 'h-5 w-5 rounded' }),
				}),
			),
		}))
	} catch {
		projectSearchOptions.value = []
	} finally {
		searchLoading.value = false
	}
}

async function handleSearch(query: string) {
	searchLoading.value = true
	await search(query)
}

watch(projectSearchProjectId, (projectId) => {
	if (!projectId) return
	const hit = projectSearchHits.value[projectId]
	if (!hit) return

	createServer(hit.title, hit.iconUrl ?? null)
	emit('update:modelValue', false)
})

async function chooseSetupType() {
	name.value = ''
	stage.value = 'details'
	await nextTick()
	nameInput.value?.focus?.()
}

function createWithName(rawName: string) {
	const trimmedName = rawName.trim()
	if (!trimmedName) return

	createServer(trimmedName)
	emit('update:modelValue', false)
}

function handleCreateServer() {
	createWithName(name.value)
}

function handleHide() {
	emit('update:modelValue', false)
}
</script>
