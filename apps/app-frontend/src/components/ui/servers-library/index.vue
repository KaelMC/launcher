<script setup lang="ts">
import { StarIcon } from '@modrinth/assets'
import { ContextMenu, defineMessages, useVIntl } from '@modrinth/ui'
import { computed, onDeactivated, ref, toRef, watch } from 'vue'
import Draggable from 'vuedraggable'

import ConfirmDeleteServerModal from '@/components/ui/modal/ConfirmDeleteServerModal.vue'
import GroupInstancesModal from '@/components/ui/servers-library/group-instances-modal.vue'
import LibraryToolbar from '@/components/ui/servers-library/library-toolbar/index.vue'
import LibrarySelectionActionBar from '@/components/ui/servers-library/LibrarySelectionActionBar.vue'
import ServerGroup from '@/components/ui/servers-library/server-group/index.vue'
import ServerGroupDnd from '@/components/ui/servers-library/server-group/server-group-dnd.vue'
import {
	getServerSelectionKey,
	type ServerGroup as ServerGroupType,
	provideServersLibrary,
} from '@/components/ui/servers-library/use-server-library'
import { FAVORITES_GROUP_ID } from '@/helpers/server-groups'
import type { FakeServer } from '@/helpers/types-servers'

const props = defineProps<{
	instances: FakeServer[]
}>()

const { formatMessage } = useVIntl()
const messages = defineMessages({
	library: { id: 'app.servers-library.title', defaultMessage: 'Servers' },
	noSearchResults: {
		id: 'app.servers-library.search.no-results.title',
		defaultMessage: 'No servers match your search.',
	},
	instanceActionsLabel: {
		id: 'app.servers-library.instance.actions.label',
		defaultMessage: 'Server actions',
	},
})

const {
	instanceGroups,
	libraryGroupsLoaded,
	isSearching,
	displayState,
	filters,
	reorderingGroups,
	reorderGroups,
	instanceOptions,
	confirmDeleteModal,
	currentDeleteInstances,
	clearLibraryInstanceSelection,
	deleteInstance,
	selectedLibraryInstances,
	setSelectedLibraryInstances,
	toggleLibraryInstanceSelection,
} = provideServersLibrary(toRef(props, 'instances'))

const hasActiveFilters = computed(() =>
	Object.values(filters.value).some((selectedValues) => selectedValues.length > 0),
)

const visibleInstanceGroups = computed(() =>
	instanceGroups.value.filter((instanceGroup) =>
		instanceGroup.id === FAVORITES_GROUP_ID
			? instanceGroup.instances.length > 0
			: instanceGroup.instances.length > 0 ||
				(!isSearching.value && !hasActiveFilters.value && instanceGroup.key !== 'None'),
	),
)

const visibleReorderableGroups = computed(() =>
	displayState.value.group === 'Group'
		? visibleInstanceGroups.value.filter((group) => group.id !== FAVORITES_GROUP_ID)
		: [],
)
const visibleFavoritesGroup = computed(() =>
	visibleInstanceGroups.value.find((group) => group.id === FAVORITES_GROUP_ID),
)
const draggableGroups = ref<ServerGroupType[]>([])
const isDraggingGroup = ref(false)
const GROUP_REORDERING_CLASS = 'server-group-reordering'
const canDragReorderGroups = computed(
	() => !reorderingGroups.value && draggableGroups.value.length > 1,
)

watch(
	visibleReorderableGroups,
	(groups) => {
		if (!isDraggingGroup.value) {
			draggableGroups.value = [...groups]
		}
	},
	{ immediate: true },
)

function onGroupDragStart() {
	isDraggingGroup.value = true
	document.documentElement.classList.add(GROUP_REORDERING_CLASS)
}

function onGroupDragEnd() {
	isDraggingGroup.value = false
	document.documentElement.classList.remove(GROUP_REORDERING_CLASS)

	const currentGroupIds = visibleReorderableGroups.value.map((group) => group.id)
	const orderedGroupIds = draggableGroups.value.map((group) => group.id)
	if (orderedGroupIds.every((groupId, index) => groupId === currentGroupIds[index])) {
		draggableGroups.value = [...visibleReorderableGroups.value]
		return
	}

	void reorderGroups(orderedGroupIds)
}

onDeactivated(clearLibraryInstanceSelection)

const anchorInstance = ref<{ groupId: string; instanceId: string } | null>(null)

function handleToggleInstance(groupId: string, instanceId: string, shiftKey: boolean) {
	const displayedInstances = visibleInstanceGroups.value.flatMap((group) =>
		group.instances.map((instance) => ({ groupId: group.id, instanceId: instance.id })),
	)
	const anchor = anchorInstance.value

	if (shiftKey && anchor && displayedInstances.length) {
		const anchorIndex = displayedInstances.findIndex(
			(instance) => instance.groupId === anchor.groupId && instance.instanceId === anchor.instanceId,
		)
		const targetIndex = displayedInstances.findIndex(
			(instance) => instance.groupId === groupId && instance.instanceId === instanceId,
		)

		if (anchorIndex === -1 || targetIndex === -1) {
			toggleLibraryInstanceSelection({ groupId, instanceId })
			return
		}

		const start = Math.min(anchorIndex, targetIndex)
		const end = Math.max(anchorIndex, targetIndex)
		const range = displayedInstances.slice(start, end + 1)
		const nextSelectedInstances = new Map(selectedLibraryInstances.value)
		const targetKey = getServerSelectionKey({ groupId, instanceId })

		if (nextSelectedInstances.has(targetKey)) {
			for (const instance of range) {
				nextSelectedInstances.delete(getServerSelectionKey(instance))
			}
		} else {
			for (const instance of range) {
				nextSelectedInstances.set(getServerSelectionKey(instance), instance)
			}
		}

		setSelectedLibraryInstances(nextSelectedInstances.values())
		anchorInstance.value = null
		return
	}

	toggleLibraryInstanceSelection({ groupId, instanceId })
	anchorInstance.value = { groupId, instanceId }
}

function setInstanceOptions(component: unknown) {
	instanceOptions.value = component as InstanceType<typeof ContextMenu> | null
}

function setConfirmDeleteModal(component: unknown) {
	confirmDeleteModal.value = component as InstanceType<typeof ConfirmDeleteServerModal> | null
}

watch(selectedLibraryInstances, (selectedInstances) => {
	if (selectedInstances.size === 0) {
		anchorInstance.value = null
		return
	}

	if (
		anchorInstance.value &&
		!selectedInstances.has(getServerSelectionKey(anchorInstance.value))
	) {
		anchorInstance.value = null
	}
})
</script>

<template>
	<ServerGroupDnd :instances="instances">
		<section data-servers-library-page-background class="flex min-h-[500px] flex-col gap-3 pb-16">
			<h2 class="m-0 text-2xl font-semibold text-contrast">{{ formatMessage(messages.library) }}</h2>
			<LibraryToolbar />
			<div
				v-if="libraryGroupsLoaded && isSearching && visibleInstanceGroups.length === 0"
				class="text-base text-primary"
			>
				{{ formatMessage(messages.noSearchResults) }}
			</div>
			<div v-else-if="libraryGroupsLoaded && displayState.group === 'Group'" class="flex flex-col">
				<div v-if="visibleFavoritesGroup" class="min-w-0">
					<ServerGroup
						:instance-group="visibleFavoritesGroup"
						:selection-anchor-instance-id="
							anchorInstance?.groupId === FAVORITES_GROUP_ID ? anchorInstance.instanceId : null
						"
						@toggle-selection="
							(instanceId: string, shiftKey: boolean) =>
								handleToggleInstance(FAVORITES_GROUP_ID, instanceId, shiftKey)
						"
					/>
				</div>

				<Draggable
					:list="draggableGroups"
					class="flex flex-col"
					item-key="id"
					:disabled="!canDragReorderGroups"
					:animation="250"
					handle=".instance-group-reorder-handle"
					filter=".instance-group-reorder-ignore, input, textarea, [contenteditable='true']"
					:prevent-on-filter="false"
					ghost-class="instance-group-reorder-ghost"
					@start="onGroupDragStart"
					@end="onGroupDragEnd"
				>
					<template #item="{ element: instanceGroup }">
						<div :key="instanceGroup.id" class="min-w-0 w-full">
							<ServerGroup
								:can-drag-reorder="canDragReorderGroups"
								:hide-header="instanceGroup.id === 'group:none' && visibleInstanceGroups.length === 1"
								:instance-group="instanceGroup"
								:selection-anchor-instance-id="
									anchorInstance?.groupId === instanceGroup.id ? anchorInstance?.instanceId : null
								"
								@toggle-selection="
									(instanceId: string, shiftKey: boolean) =>
										handleToggleInstance(instanceGroup.id, instanceId, shiftKey)
								"
							/>
						</div>
					</template>
				</Draggable>
			</div>

			<div v-else-if="libraryGroupsLoaded" class="flex flex-col">
				<div v-for="instanceGroup in visibleInstanceGroups" :key="instanceGroup.id" class="min-w-0">
					<ServerGroup
						:hide-header="instanceGroup.key === 'None' && visibleInstanceGroups.length === 1"
						:instance-group="instanceGroup"
						:selection-anchor-instance-id="
							anchorInstance?.groupId === instanceGroup.id ? anchorInstance.instanceId : null
						"
						@toggle-selection="
							(instanceId: string, shiftKey: boolean) =>
								handleToggleInstance(instanceGroup.id, instanceId, shiftKey)
						"
					/>
				</div>
			</div>
		</section>
	</ServerGroupDnd>
	<LibrarySelectionActionBar />
	<GroupInstancesModal />
	<ConfirmDeleteServerModal :ref="setConfirmDeleteModal" :instances="currentDeleteInstances" @delete="deleteInstance" />
	<ContextMenu :ref="setInstanceOptions" :label="formatMessage(messages.instanceActionsLabel)">
		<template #remove_from_favorites="{ option }">
			<StarIcon style="color: var(--color-text-default); fill: var(--color-text-default)" />
			{{ option.label }}
		</template>
	</ContextMenu>
</template>

<style scoped>
:global(.instance-group-reorder-ghost) {
	opacity: 0.35;
}

:global(html.server-group-reordering),
:global(html.server-group-reordering *) {
	-webkit-user-select: none !important;
	cursor: grabbing !important;
	user-select: none !important;
}
</style>
