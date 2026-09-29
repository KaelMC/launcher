import { MinusIcon, PlayIcon, StarIcon, StopCircleIcon, TrashIcon } from '@modrinth/assets'
import { type ButtonMenuOption, defineMessages, useVIntl } from '@modrinth/ui'
import { useEventListener, useStorage } from '@vueuse/core'
import dayjs from 'dayjs'
import {
	computed,
	inject,
	type InjectionKey,
	provide,
	type Ref,
	ref,
	watch,
} from 'vue'

import { removeServer, runningServerIds } from '@/helpers/server'
import {
	create_group as createServerGroup,
	delete_group as deleteServerGroup,
	FAVORITES_GROUP_ID,
	list_groups as listServerGroups,
	MAX_SERVER_GROUP_NAME_LENGTH,
	rename_group as renameServerGroup,
	set_group_memberships as setServerGroupMemberships,
	set_group_order as setServerGroupOrder,
	type ServerGroupDefinition,
} from '@/helpers/server-groups'
import type { FakeServer } from '@/helpers/types-servers'

import { serversLibrarySearch } from './view-state'

export const serversLibrarySortOptions = ['Name', 'Last played', 'Date created', 'Date modified'] as const

export const serversLibraryGroupOptions = [
	{ value: 'Group', label: 'Custom group' },
	{ value: 'None', label: 'No grouping' },
] as const

export type ServersLibrarySort = (typeof serversLibrarySortOptions)[number]
export type ServersLibraryGroupBy = (typeof serversLibraryGroupOptions)[number]['value']
export type ServersLibraryFilters = Record<'status', string[]>

export type ServerGroup = {
	id: string
	key: string
	instances: FakeServer[]
}

export type ServerSelection = {
	instanceId: string
	groupId: string
}

export type ActiveServerGroupDrag = {
	instances: ServerSelection[]
	primaryInstanceId: string
	fromGroup: string | null
}

export const getServerSelectionKey = ({ instanceId, groupId }: ServerSelection) =>
	JSON.stringify([groupId, instanceId])

export type ServerCard = {
	server: FakeServer
	playing: boolean
	play: (event: MouseEvent | null) => void
	stop: (event: MouseEvent | null) => void
}

type ServerContextMenu = {
	open: (event: MouseEvent, options: ButtonMenuOption[]) => void
}

type ConfirmDeleteModal = {
	show: () => void
}

const serverActionMessages = defineMessages({
	play: { id: 'app.servers-library.server.action.play', defaultMessage: 'Start' },
	stop: { id: 'app.servers-library.server.action.stop', defaultMessage: 'Stop' },
	addToFavorites: {
		id: 'app.servers-library.server.action.add-to-favorites',
		defaultMessage: 'Add to favorites',
	},
	removeFromFavorites: {
		id: 'app.servers-library.server.action.remove-from-favorites',
		defaultMessage: 'Remove from favorites',
	},
	delete: { id: 'app.servers-library.server.action.delete', defaultMessage: 'Delete' },
	removeFromGroup: {
		id: 'app.servers-library.server.action.remove-from-group',
		defaultMessage: 'Remove from group',
	},
})

function createServersLibraryState(instances: Ref<FakeServer[]>) {
	const { formatMessage } = useVIntl()

	const search = serversLibrarySearch
	const filters = useStorage<ServersLibraryFilters>(
		'Servers-grid-filters',
		{ status: [] },
		localStorage,
		{ mergeDefaults: true },
	)
	const libraryGroups = ref<ServerGroupDefinition[]>([])
	const libraryGroupsLoaded = ref(false)
	const isNewGroupModalOpen = ref(false)
	const newGroupName = ref('')
	const newGroupSearch = ref('')
	const selectedNewGroupInstanceIds = ref(new Set<string>())
	const isGroupInstancesModalOpen = ref(false)
	const groupInstancesModalGroupId = ref<string | null>(null)
	const groupInstancesSearch = ref('')
	const selectedGroupInstanceIds = ref(new Set<string>())
	const savingGroupInstances = ref(false)
	const selectedLibraryInstances = ref(new Map<string, ServerSelection>())
	const isLibraryInstanceSelectionActive = computed(() => selectedLibraryInstances.value.size > 0)
	const creatingGroup = ref(false)
	const reorderingGroups = ref(false)
	const groupIdPendingNameEdit = ref<string | null>(null)
	const activeInstanceGroupDrag = ref<ActiveServerGroupDrag | null>(null)
	const instanceGroupDragTarget = ref<string | null>(null)
	const instanceGroupDragPointer = ref({ x: 0, y: 0 })
	const isAddingInstanceToGroup = ref(false)
	const instanceOptions = ref<ServerContextMenu | null>(null)
	const currentDeleteInstanceId = ref<string | null>(null)
	const currentDeleteInstances = computed(() =>
		instances.value.filter((instance) => instance.id === currentDeleteInstanceId.value),
	)
	const confirmDeleteModal = ref<ConfirmDeleteModal | null>(null)

	const displayState = useStorage<{
		group: ServersLibraryGroupBy
		sortBy: ServersLibrarySort
		collapsedGroups: string[]
		ungroupedGroupPosition: number
	}>(
		'Servers-grid-display-state',
		{
			group: 'Group',
			sortBy: 'Last played',
			collapsedGroups: [],
			ungroupedGroupPosition: Number.MAX_SAFE_INTEGER,
		},
		localStorage,
		{ mergeDefaults: true },
	)

	if (!serversLibrarySortOptions.includes(displayState.value.sortBy)) {
		displayState.value.sortBy = 'Last played'
	}

	if (!serversLibraryGroupOptions.some((option) => option.value === displayState.value.group)) {
		displayState.value.group = 'Group'
	}

	const isSearching = computed(() => search.value.length > 0)
	const collapsedSectionKeys = computed(() => new Set(displayState.value.collapsedGroups))
	const groupNames = computed(
		() =>
			new Set(
				libraryGroups.value
					.filter((group) => group.id !== FAVORITES_GROUP_ID)
					.map((group) => group.name.trim())
					.filter((name) => name && name.toLowerCase() !== 'none'),
			),
	)
	const existingGroupNames = computed(
		() => new Set(['none', ...Array.from(groupNames.value, (name) => name.toLowerCase())]),
	)
	const normalizedNewGroupName = computed(() =>
		newGroupName.value.trim().substring(0, MAX_SERVER_GROUP_NAME_LENGTH),
	)
	const newGroupInstances = computed(() => {
		const query = newGroupSearch.value.trim().toLowerCase()

		return instances.value
			.filter((instance) => !query || instance.name.toLowerCase().includes(query))
			.slice()
			.sort((a, b) => {
				const groupedDifference = Number(a.group_ids.length > 0) - Number(b.group_ids.length > 0)
				if (groupedDifference !== 0) return groupedDifference

				return a.name.localeCompare(b.name)
			})
	})
	const groupInstancesModalGroup = computed(() => {
		if (groupInstancesModalGroupId.value === 'group:none') {
			return { id: 'group:none', name: 'None' }
		}

		return libraryGroups.value.find((group) => group.id === groupInstancesModalGroupId.value) ?? null
	})
	const groupInstances = computed(() => {
		const query = groupInstancesSearch.value.trim().toLowerCase()

		return instances.value
			.filter((instance) => !query || instance.name.toLowerCase().includes(query))
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name))
	})
	const canCreateGroup = computed(
		() => normalizedNewGroupName.value.length > 0 && !creatingGroup.value,
	)
	const customLibraryGroups = computed(() =>
		libraryGroups.value.filter((group) => group.id !== FAVORITES_GROUP_ID),
	)
	const orderedLibraryGroupIds = computed(() => {
		const groupIds = customLibraryGroups.value.map((group) => group.id)
		const storedUngroupedGroupPosition = displayState.value.ungroupedGroupPosition
		const ungroupedGroupPosition = Math.min(
			Math.max(
				Number.isFinite(storedUngroupedGroupPosition)
					? Math.trunc(storedUngroupedGroupPosition)
					: Number.MAX_SAFE_INTEGER,
				0,
			),
			groupIds.length,
		)
		groupIds.splice(ungroupedGroupPosition, 0, 'group:none')
		return groupIds
	})
	const libraryGroupOrder = computed(
		() => new Map(orderedLibraryGroupIds.value.map((groupId, index) => [groupId, index])),
	)

	const refreshGroups = async () => {
		libraryGroups.value = await listServerGroups()
		libraryGroupsLoaded.value = true
	}

	void refreshGroups()

	const filteredInstances = computed(() =>
		instances.value.filter((instance) => {
			const status = runningServerIds.value.has(instance.id) ? 'running' : 'stopped'
			const statusMatches = filters.value.status.length === 0 || filters.value.status.includes(status)

			return statusMatches
		}),
	)

	const instanceGroups = computed<ServerGroup[]>(() => {
		const visibleInstances = filteredInstances.value.filter((instance) =>
			instance.name.toLowerCase().includes(search.value.toLowerCase()),
		)

		switch (displayState.value.sortBy) {
			case 'Name':
				visibleInstances.sort((a, b) => a.name.localeCompare(b.name))
				break
			case 'Last played':
				visibleInstances.sort((a, b) => dayjs(b.last_played ?? 0).diff(dayjs(a.last_played ?? 0)))
				break
			case 'Date created':
				visibleInstances.sort((a, b) => dayjs(b.created).diff(dayjs(a.created)))
				break
			case 'Date modified':
				visibleInstances.sort((a, b) => dayjs(b.modified).diff(dayjs(a.modified)))
				break
		}

		const groupedInstances = new Map<string, { name: string; instances: FakeServer[] }>()
		const addToGroup = (id: string, name: string, instance: FakeServer) => {
			const group = groupedInstances.get(id) ?? { name, instances: [] }
			group.instances.push(instance)
			groupedInstances.set(id, group)
		}
		const groupsById = new Map(libraryGroups.value.map((group) => [group.id, group]))

		for (const instance of visibleInstances) {
			switch (displayState.value.group) {
				case 'Group':
					if (instance.group_ids.length === 0) {
						addToGroup('group:none', 'None', instance)
					} else {
						for (const groupId of instance.group_ids) {
							const group = groupsById.get(groupId)
							addToGroup(groupId, group?.name ?? groupId, instance)
						}
					}
					break
				case 'None':
					addToGroup('None:None', 'None', instance)
					break
			}
		}

		if (displayState.value.group === 'Group') {
			if (!groupedInstances.has('group:none')) {
				groupedInstances.set('group:none', { name: 'None', instances: [] })
			}

			for (const group of libraryGroups.value) {
				if (!groupedInstances.has(group.id)) {
					groupedInstances.set(group.id, { name: group.name, instances: [] })
				}
			}
		}

		const groups = Array.from(groupedInstances, ([id, group]) => ({
			id,
			key: group.name,
			instances: group.instances,
		}))

		if (displayState.value.sortBy === 'Name') {
			groups.sort((a, b) => a.key.localeCompare(b.key) || a.id.localeCompare(b.id))
		}

		if (displayState.value.group === 'Group') {
			groups.sort((a, b) => {
				if (a.id === b.id) return 0
				if (a.id === FAVORITES_GROUP_ID) return -1
				if (b.id === FAVORITES_GROUP_ID) return 1

				const aOrder = libraryGroupOrder.value.get(a.id) ?? Number.MAX_SAFE_INTEGER
				const bOrder = libraryGroupOrder.value.get(b.id) ?? Number.MAX_SAFE_INTEGER
				return aOrder - bOrder || a.key.localeCompare(b.key) || a.id.localeCompare(b.id)
			})
		}

		return groups
	})

	const getSectionKey = (sectionId: string) => `${displayState.value.group}:${sectionId}`

	const isSectionCollapsed = (sectionId: string) =>
		!isSearching.value && collapsedSectionKeys.value.has(getSectionKey(sectionId))

	const setSectionCollapsed = (sectionId: string, collapsed: boolean) => {
		if (isSearching.value) return

		const sectionKey = getSectionKey(sectionId)
		const collapsedSections = new Set(displayState.value.collapsedGroups)

		if (collapsed) {
			collapsedSections.add(sectionKey)
		} else {
			collapsedSections.delete(sectionKey)
		}

		displayState.value.collapsedGroups = [...collapsedSections]
	}

	const normalizeInstanceGroupId = (groupId: string) => (groupId === 'group:none' ? null : groupId)

	const updateInstanceGroupDrag = (pointer?: { x: number; y: number }) => {
		if (pointer) {
			instanceGroupDragPointer.value = { x: pointer.x, y: pointer.y }
		}
	}

	const startInstanceGroupDrag = (
		instanceId: string,
		groupId: string,
		pointer?: { x: number; y: number },
	) => {
		if (displayState.value.group !== 'Group') return

		const primaryInstance = { instanceId, groupId }
		activeInstanceGroupDrag.value = {
			instances: [primaryInstance],
			primaryInstanceId: instanceId,
			fromGroup: normalizeInstanceGroupId(groupId),
		}
		updateInstanceGroupDrag(pointer)
	}

	const finishInstanceGroupDrag = () => {
		activeInstanceGroupDrag.value = null
		instanceGroupDragTarget.value = null
	}

	const setInstanceGroupDragTarget = (groupId: string | null) => {
		instanceGroupDragTarget.value = groupId
	}

	const getInstanceGroupDropState = (groupId: string) => {
		const drag = activeInstanceGroupDrag.value
		const toGroup = normalizeInstanceGroupId(groupId)
		const draggedInstance = instances.value.find(
			(instance) => instance.id === drag?.primaryInstanceId,
		)
		const alreadyInGroup = draggedInstance
			? toGroup
				? draggedInstance.group_ids.includes(toGroup)
				: draggedInstance.group_ids.length === 0
			: false

		return {
			alreadyInGroup,
			canDrop: !!drag && !!draggedInstance && !alreadyInGroup,
			operation: 'move' as const,
		}
	}

	const moveDraggedInstancesToGroup = async (groupId: string) => {
		const drag = activeInstanceGroupDrag.value
		const toGroup = normalizeInstanceGroupId(groupId)
		if (!drag) return false

		const dropState = getInstanceGroupDropState(groupId)
		if (!dropState.canDrop) return false

		const instance = instances.value.find((candidate) => candidate.id === drag.primaryInstanceId)
		if (!instance) return false

		await setServerGroupMemberships([
			{
				instance_id: instance.id,
				group_ids: toGroup ? [toGroup] : [],
			},
		])

		selectedLibraryInstances.value = new Map()

		return true
	}

	const getDefaultNewGroupName = () => {
		let groupNumber = groupNames.value.size + 1
		while (existingGroupNames.value.has(`group ${groupNumber}`.toLowerCase())) {
			groupNumber++
		}

		return `Group ${groupNumber}`
	}

	const openNewGroupModal = (instanceIds: Iterable<string> = []) => {
		newGroupName.value = getDefaultNewGroupName()
		newGroupSearch.value = ''
		selectedNewGroupInstanceIds.value = new Set(instanceIds)
		isNewGroupModalOpen.value = true
	}

	const closeNewGroupModal = () => {
		isNewGroupModalOpen.value = false
	}

	const openGroupInstancesModal = (groupId: string) => {
		const group = libraryGroups.value.find((candidate) => candidate.id === groupId)
		if (!group && groupId !== 'group:none') return

		groupInstancesModalGroupId.value = groupId
		groupInstancesSearch.value = ''
		selectedGroupInstanceIds.value = new Set(
			instances.value
				.filter((instance) =>
					groupId === 'group:none'
						? instance.group_ids.length === 0
						: instance.group_ids.includes(groupId),
				)
				.map((instance) => instance.id),
		)
		isGroupInstancesModalOpen.value = true
	}

	const closeGroupInstancesModal = () => {
		isGroupInstancesModalOpen.value = false
		groupInstancesModalGroupId.value = null
	}

	const toggleGroupInstance = (instanceId: string) => {
		const selectedIds = new Set(selectedGroupInstanceIds.value)

		if (selectedIds.has(instanceId)) {
			if (groupInstancesModalGroupId.value === 'group:none') return
			selectedIds.delete(instanceId)
		} else {
			selectedIds.add(instanceId)
		}

		selectedGroupInstanceIds.value = selectedIds
	}

	const saveGroupInstances = async () => {
		const groupId = groupInstancesModalGroupId.value
		if (!groupId || savingGroupInstances.value) return false

		const isUngrouped = groupId === 'group:none'
		savingGroupInstances.value = true

		try {
			await setServerGroupMemberships(
				instances.value.map((instance) => {
					const shouldIncludeGroup = selectedGroupInstanceIds.value.has(instance.id)
					const nextGroupIds = isUngrouped
						? shouldIncludeGroup
							? []
							: instance.group_ids
						: shouldIncludeGroup
							? [...new Set([...instance.group_ids, groupId])]
							: instance.group_ids.filter((instanceGroupId) => instanceGroupId !== groupId)

					return { instance_id: instance.id, group_ids: nextGroupIds }
				}),
			)
			selectedLibraryInstances.value = new Map()
			return true
		} finally {
			savingGroupInstances.value = false
		}
	}

	const toggleNewGroupInstance = (instanceId: string) => {
		const selectedIds = new Set(selectedNewGroupInstanceIds.value)

		if (selectedIds.has(instanceId)) {
			selectedIds.delete(instanceId)
		} else {
			selectedIds.add(instanceId)
		}

		selectedNewGroupInstanceIds.value = selectedIds
	}

	const clearLibraryInstanceSelection = () => {
		selectedLibraryInstances.value = new Map()
	}

	watch(() => displayState.value.group, clearLibraryInstanceSelection)

	const setSelectedLibraryInstances = (selections: Iterable<ServerSelection>) => {
		selectedLibraryInstances.value = new Map(
			[...selections].map((selection) => [getServerSelectionKey(selection), selection]),
		)
	}

	const toggleLibraryInstanceSelection = (selection: ServerSelection) => {
		const selectedInstances = new Map(selectedLibraryInstances.value)
		const selectionKey = getServerSelectionKey(selection)

		if (selectedInstances.has(selectionKey)) {
			selectedInstances.delete(selectionKey)
		} else {
			selectedInstances.set(selectionKey, selection)
		}

		selectedLibraryInstances.value = selectedInstances
	}

	useEventListener(window, 'keydown', (event) => {
		if (
			event.key === 'Escape' &&
			!event.defaultPrevented &&
			isLibraryInstanceSelectionActive.value
		) {
			clearLibraryInstanceSelection()
		}
	})

	const createGroup = async () => {
		if (!canCreateGroup.value) return false

		creatingGroup.value = true

		try {
			const group = await createServerGroup(normalizedNewGroupName.value)
			libraryGroups.value = [
				group,
				...libraryGroups.value.filter((existingGroup) => existingGroup.id !== group.id),
			]

			await setServerGroupMemberships(
				instances.value
					.filter((instance) => selectedNewGroupInstanceIds.value.has(instance.id))
					.map((instance) => ({
						instance_id: instance.id,
						group_ids: [...instance.group_ids, group.id],
					})),
			)
			return true
		} finally {
			creatingGroup.value = false
		}
	}

	const createDefaultGroup = async (instanceIds: Iterable<string> = []) => {
		if (creatingGroup.value) return false

		creatingGroup.value = true

		try {
			const group = await createServerGroup(getDefaultNewGroupName())
			const selectedInstanceIds = new Set(instanceIds)
			const instancesToAdd = instances.value.filter((instance) =>
				selectedInstanceIds.has(instance.id),
			)
			await setServerGroupMemberships(
				instancesToAdd.map((instance) => ({
					instance_id: instance.id,
					group_ids: [...instance.group_ids, group.id],
				})),
			)

			libraryGroups.value = [
				group,
				...libraryGroups.value.filter((existingGroup) => existingGroup.id !== group.id),
			]

			displayState.value.group = 'Group'
			groupIdPendingNameEdit.value = group.id
			return true
		} finally {
			creatingGroup.value = false
		}
	}

	const completePendingGroupNameEdit = (groupId: string) => {
		if (groupIdPendingNameEdit.value === groupId) {
			groupIdPendingNameEdit.value = null
		}
	}

	const deleteGroup = async (groupId: string) => {
		await deleteServerGroup(groupId)
		libraryGroups.value = libraryGroups.value.filter((group) => group.id !== groupId)
		return true
	}

	const renameGroup = async (groupId: string, newName: string) => {
		const normalizedNewName = newName.trim()
		const currentGroup = libraryGroups.value.find((group) => group.id === groupId)
		if (currentGroup?.name === normalizedNewName) return true

		const renamedGroup = await renameServerGroup(groupId, normalizedNewName)
		libraryGroups.value = libraryGroups.value.map((group) =>
			group.id === groupId ? renamedGroup : group,
		)
		return true
	}

	const canMoveGroupUp = (groupId: string) =>
		!reorderingGroups.value &&
		orderedLibraryGroupIds.value.findIndex((orderedGroupId) => orderedGroupId === groupId) > 0

	const canMoveGroupDown = (groupId: string) => {
		const groupIndex = orderedLibraryGroupIds.value.findIndex(
			(orderedGroupId) => orderedGroupId === groupId,
		)
		return (
			!reorderingGroups.value &&
			groupIndex >= 0 &&
			groupIndex < orderedLibraryGroupIds.value.length - 1
		)
	}

	const reorderGroups = async (orderedGroupIds: string[]) => {
		if (reorderingGroups.value) return false

		const customGroupsById = new Map(customLibraryGroups.value.map((group) => [group.id, group]))
		const reorderableGroupIds = new Set([...customGroupsById.keys(), 'group:none'])
		const orderedGroupIdSet = new Set(orderedGroupIds)

		if (
			orderedGroupIdSet.size !== orderedGroupIds.length ||
			orderedGroupIds.some((groupId) => !reorderableGroupIds.has(groupId))
		) {
			return false
		}

		let orderedGroupIndex = 0
		const reorderedGroupIds = orderedLibraryGroupIds.value.map((groupId) =>
			orderedGroupIdSet.has(groupId) ? orderedGroupIds[orderedGroupIndex++] : groupId,
		)

		const reorderedCustomGroups = reorderedGroupIds
			.filter((groupId) => groupId !== 'group:none')
			.map((groupId) => customGroupsById.get(groupId)!)
		const favoriteGroups = libraryGroups.value.filter((group) => group.id === FAVORITES_GROUP_ID)
		libraryGroups.value = [...favoriteGroups, ...reorderedCustomGroups]
		displayState.value.ungroupedGroupPosition = reorderedGroupIds.indexOf('group:none')
		reorderingGroups.value = true

		try {
			await setServerGroupOrder(reorderedCustomGroups.map((group) => group.id))
			return true
		} finally {
			reorderingGroups.value = false
		}
	}

	const moveGroup = async (groupId: string, direction: -1 | 1) => {
		const orderedGroupIds = [...orderedLibraryGroupIds.value]
		const groupIndex = orderedGroupIds.indexOf(groupId)
		const targetIndex = groupIndex + direction

		if (groupIndex < 0 || targetIndex < 0 || targetIndex >= orderedGroupIds.length) {
			return false
		}

		const targetGroupId = orderedGroupIds[targetIndex]
		orderedGroupIds[targetIndex] = orderedGroupIds[groupIndex]
		orderedGroupIds[groupIndex] = targetGroupId

		return await reorderGroups(orderedGroupIds)
	}

	const deleteInstance = async () => {
		if (!currentDeleteInstanceId.value) return

		await removeServer(currentDeleteInstanceId.value)
		currentDeleteInstanceId.value = null
	}

	const setInstanceGroups = (item: ServerCard, groupIds: string[]) =>
		void setServerGroupMemberships([{ instance_id: item.server.id, group_ids: groupIds }])

	const handleInstanceContextMenu = (
		event: MouseEvent,
		item: ServerCard,
		instanceGroupId: string,
	) => {
		const removableGroupId =
			displayState.value.group === 'Group' &&
			instanceGroupId !== 'group:none' &&
			instanceGroupId !== FAVORITES_GROUP_ID
				? instanceGroupId
				: null
		const isFavorite = item.server.group_ids.includes(FAVORITES_GROUP_ID)

		instanceOptions.value?.open(event, [
			{
				id: 'stop',
				label: formatMessage(serverActionMessages.stop),
				icon: StopCircleIcon,
				shown: item.playing,
				tone: 'red',
				action: () => item.stop(null),
			},
			{
				id: 'play',
				label: formatMessage(serverActionMessages.play),
				icon: PlayIcon,
				shown: !item.playing,
				tone: 'brand',
				action: () => item.play(null),
			},
			{
				id: isFavorite ? 'remove_from_favorites' : 'add_to_favorites',
				label: formatMessage(
					isFavorite
						? serverActionMessages.removeFromFavorites
						: serverActionMessages.addToFavorites,
				),
				icon: StarIcon,
				action: () =>
					setInstanceGroups(
						item,
						isFavorite
							? item.server.group_ids.filter((groupId) => groupId !== FAVORITES_GROUP_ID)
							: [...new Set([...item.server.group_ids, FAVORITES_GROUP_ID])],
					),
			},
			{ type: 'divider' },
			{
				id: 'remove_from_group',
				label: formatMessage(serverActionMessages.removeFromGroup),
				icon: MinusIcon,
				shown: !!removableGroupId,
				action: () =>
					setInstanceGroups(
						item,
						item.server.group_ids.filter((groupId) => groupId !== removableGroupId),
					),
			},
			{ type: 'divider' },
			{
				id: 'delete',
				label: formatMessage(serverActionMessages.delete),
				icon: TrashIcon,
				tone: 'red',
				hoverFilledOnly: true,
				action: () => {
					currentDeleteInstanceId.value = item.server.id
					confirmDeleteModal.value?.show()
				},
			},
		])
	}

	return {
		instances,
		libraryGroups,
		libraryGroupsLoaded,
		search,
		isSearching,
		filters,
		displayState,
		instanceGroups,
		isNewGroupModalOpen,
		newGroupName,
		newGroupSearch,
		selectedNewGroupInstanceIds,
		isGroupInstancesModalOpen,
		groupInstancesModalGroup,
		groupInstancesSearch,
		selectedGroupInstanceIds,
		savingGroupInstances,
		selectedLibraryInstances,
		isLibraryInstanceSelectionActive,
		activeInstanceGroupDrag,
		instanceGroupDragTarget,
		instanceGroupDragPointer,
		isAddingInstanceToGroup,
		creatingGroup,
		reorderingGroups,
		groupIdPendingNameEdit,
		newGroupInstances,
		groupInstances,
		canCreateGroup,
		instanceOptions,
		confirmDeleteModal,
		currentDeleteInstances,
		isSectionCollapsed,
		setSectionCollapsed,
		startInstanceGroupDrag,
		updateInstanceGroupDrag,
		finishInstanceGroupDrag,
		setInstanceGroupDragTarget,
		getInstanceGroupDropState,
		moveDraggedInstancesToGroup,
		openNewGroupModal,
		closeNewGroupModal,
		openGroupInstancesModal,
		closeGroupInstancesModal,
		toggleNewGroupInstance,
		toggleGroupInstance,
		saveGroupInstances,
		clearLibraryInstanceSelection,
		setSelectedLibraryInstances,
		toggleLibraryInstanceSelection,
		createGroup,
		createDefaultGroup,
		completePendingGroupNameEdit,
		deleteGroup,
		renameGroup,
		canMoveGroupUp,
		canMoveGroupDown,
		reorderGroups,
		moveGroup,
		deleteInstance,
		handleInstanceContextMenu,
	}
}

export type ServersLibraryState = ReturnType<typeof createServersLibraryState>

const serversLibraryKey: InjectionKey<ServersLibraryState> = Symbol('servers-library')

export function provideServersLibrary(instances: Ref<FakeServer[]>) {
	const library = createServersLibraryState(instances)
	provide(serversLibraryKey, library)
	return library
}

export function useServersLibrary() {
	const library = inject(serversLibraryKey)

	if (!library) {
		throw new Error('useServersLibrary must be called within a servers-library provider')
	}

	return library
}
