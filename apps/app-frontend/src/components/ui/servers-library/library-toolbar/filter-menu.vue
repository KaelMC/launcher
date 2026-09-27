<script setup lang="ts">
import { defineMessages, DropdownFilterBar, type DropdownFilterBarCategory, useVIntl } from '@modrinth/ui'
import { computed } from 'vue'

import { useServersLibrary } from '@/components/ui/servers-library/use-server-library'

const { filters } = useServersLibrary()
const { formatMessage } = useVIntl()

const messages = defineMessages({
	status: { id: 'app.servers-library.filter.status', defaultMessage: 'Status' },
	running: { id: 'app.servers-library.filter.status.running', defaultMessage: 'Running' },
	stopped: { id: 'app.servers-library.filter.status.stopped', defaultMessage: 'Stopped' },
	filterBy: { id: 'app.servers-library.filter.label', defaultMessage: 'Filter by' },
	addFilter: { id: 'app.servers-library.filter.add', defaultMessage: 'Add filter' },
	clearFilters: { id: 'app.servers-library.filter.clear', defaultMessage: 'Clear filters' },
})

const filterCategories = computed<DropdownFilterBarCategory[]>(() => [
	{
		key: 'status',
		label: formatMessage(messages.status),
		options: [
			{ value: 'running', label: formatMessage(messages.running) },
			{ value: 'stopped', label: formatMessage(messages.stopped) },
		],
	},
])
</script>

<template>
	<DropdownFilterBar
		v-model="filters"
		:categories="filterCategories"
		use-filter-icon
		:label="formatMessage(messages.filterBy)"
		:add-label="formatMessage(messages.addFilter)"
		:clear-label="formatMessage(messages.clearFilters)"
		apply-immediately
		checkbox-position="right"
	/>
</template>
