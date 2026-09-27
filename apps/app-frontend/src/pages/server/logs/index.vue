<script setup lang="ts">
import { defineMessages, EmptyState, useVIntl } from '@modrinth/ui'

defineOptions({ name: 'ServerLogsTab' })

const { formatMessage } = useVIntl()
const messages = defineMessages({
	heading: { id: 'app.server.logs.empty.heading', defaultMessage: 'No logs yet' },
	description: {
		id: 'app.server.logs.empty.description',
		defaultMessage: 'Start the server to see console output here.',
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
