<script setup lang="ts">
import { PlusIcon, SearchIcon, SquarePlusIcon } from '@modrinth/assets'
import { Button, defineMessages, Input, useVIntl } from '@modrinth/ui'
import { computed, inject } from 'vue'

import FilterMenu from '@/components/ui/servers-library/library-toolbar/filter-menu.vue'
import NewGroupModal from '@/components/ui/servers-library/library-toolbar/new-group-modal.vue'
import SortMenu from '@/components/ui/servers-library/library-toolbar/sort-menu.vue'
import { useServersLibrary } from '@/components/ui/servers-library/use-server-library'

const { search, selectedLibraryInstances, openNewGroupModal } = useServersLibrary()
const showNewServerModal = inject<() => void>('showNewServerModal')
const { formatMessage } = useVIntl()
const messages = defineMessages({
	search: { id: 'app.servers-library.search.placeholder', defaultMessage: 'Search' },
	newGroup: { id: 'app.servers-library.group.new', defaultMessage: 'New group' },
	newServer: { id: 'app.servers-library.server.new', defaultMessage: 'New server' },
})
const selectedInstanceIds = computed(
	() => new Set([...selectedLibraryInstances.value.values()].map((selection) => selection.instanceId)),
)

function openNewGroup() {
	openNewGroupModal(selectedInstanceIds.value)
}
</script>

<template>
	<div class="flex flex-col gap-2">
		<div class="flex flex-wrap gap-2">
			<Input
				v-model="search"
				:icon="SearchIcon"
				type="text"
				:placeholder="formatMessage(messages.search)"
				clearable
				wrapper-class="min-w-[16rem] flex-1"
			/>
			<Button @click="openNewGroup">
				<SquarePlusIcon />
				{{ formatMessage(messages.newGroup) }}
			</Button>
			<Button type="colored" color="brand" @click="showNewServerModal?.()">
				<PlusIcon />
				{{ formatMessage(messages.newServer) }}
			</Button>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<SortMenu />
			<div class="mx-2 h-6 w-px bg-surface-5" />
			<FilterMenu />
		</div>
	</div>
	<NewGroupModal />
</template>
