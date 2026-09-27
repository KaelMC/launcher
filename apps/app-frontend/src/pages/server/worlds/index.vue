<script setup lang="ts">
import { defineMessages, EmptyState, useVIntl } from '@modrinth/ui'

defineOptions({ name: 'ServerWorldsTab' })

const { formatMessage } = useVIntl()
const messages = defineMessages({
	heading: { id: 'app.server.worlds.empty.heading', defaultMessage: 'No worlds yet' },
	description: {
		id: 'app.server.worlds.empty.description',
		defaultMessage: 'Worlds hosted on this server will show up here.',
	},
})
</script>

<template>
	<EmptyState
		type="empty-inbox"
		:heading="formatMessage(messages.heading)"
		:description="formatMessage(messages.description)"
	/>
</template>
