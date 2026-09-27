<script setup lang="ts">
import { ArrowUpDownIcon, LayoutGridIcon } from '@modrinth/assets'
import { Combobox, type ComboboxOption, defineMessages, useVIntl } from '@modrinth/ui'

import {
	type ServersLibraryGroupBy,
	serversLibraryGroupOptions,
	type ServersLibrarySort,
	serversLibrarySortOptions,
	useServersLibrary,
} from '@/components/ui/servers-library/use-server-library'

const { displayState } = useServersLibrary()
const { formatMessage } = useVIntl()

const messages = defineMessages({
	name: { id: 'app.servers-library.sort.name', defaultMessage: 'Name' },
	lastPlayed: { id: 'app.servers-library.sort.last-played', defaultMessage: 'Last opened' },
	dateCreated: { id: 'app.servers-library.sort.date-created', defaultMessage: 'Date created' },
	dateModified: { id: 'app.servers-library.sort.date-modified', defaultMessage: 'Date modified' },
	customGroup: { id: 'app.servers-library.group-by.custom-group', defaultMessage: 'Custom group' },
	noGrouping: { id: 'app.servers-library.group-by.none', defaultMessage: 'No grouping' },
	sortBy: { id: 'app.servers-library.sort.label', defaultMessage: 'Sort by' },
	groupBy: { id: 'app.servers-library.group-by.label', defaultMessage: 'Group by' },
})

const sortLabels = {
	Name: messages.name,
	'Last played': messages.lastPlayed,
	'Date created': messages.dateCreated,
	'Date modified': messages.dateModified,
}

const groupLabels = {
	Group: messages.customGroup,
	None: messages.noGrouping,
}

const sortOptions: ComboboxOption<ServersLibrarySort>[] = serversLibrarySortOptions.map((option) => ({
	value: option,
	label: formatMessage(sortLabels[option]),
}))
const groupOptions: ComboboxOption<ServersLibraryGroupBy>[] = serversLibraryGroupOptions.map(
	(option) => ({
		value: option.value,
		label: formatMessage(groupLabels[option.value]),
	}),
)
</script>

<template>
	<Combobox
		v-model="displayState.sortBy"
		class="w-max"
		:options="sortOptions"
		:show-icon-in-selected="false"
		:max-height="320"
		dropdown-min-width="160px"
	>
		<template #prefix>
			<ArrowUpDownIcon class="size-5 text-primary" :aria-label="formatMessage(messages.sortBy)" />
		</template>
		<template #selected="{ label }">
			<span>{{ label }}</span>
		</template>
	</Combobox>
	<Combobox
		v-model="displayState.group"
		class="w-max"
		:options="groupOptions"
		dropdown-min-width="160px"
		:show-icon-in-selected="false"
	>
		<template #prefix>
			<LayoutGridIcon class="size-5 text-primary" :aria-label="formatMessage(messages.groupBy)" />
		</template>
		<template #selected="{ label }">
			<span>{{ label }}</span>
		</template>
	</Combobox>
</template>
