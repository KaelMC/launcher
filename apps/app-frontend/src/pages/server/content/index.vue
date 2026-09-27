<script setup lang="ts">
import { defineMessages, EmptyState, useVIntl } from '@modrinth/ui'

defineOptions({ name: 'ServerContentTab' })

const { formatMessage } = useVIntl()
const messages = defineMessages({
	heading: { id: 'app.server.content.empty.heading', defaultMessage: 'No content installed' },
	description: {
		id: 'app.server.content.empty.description',
		defaultMessage: 'Mods and plugins installed on this server will show up here.',
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
