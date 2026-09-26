<script setup lang="ts">
import { ServerStackIcon } from '@modrinth/assets'
import { defineMessages, EmptyState, useVIntl } from '@modrinth/ui'
import { onActivated } from 'vue'

import { useRootBreadcrumb } from '@/providers/breadcrumbs'

defineOptions({ name: 'ServersPage' })

const { formatMessage } = useVIntl()
const messages = defineMessages({
	servers: { id: 'app.servers.heading', defaultMessage: 'Servers' },
	noServersHeading: { id: 'app.servers.empty.heading', defaultMessage: 'No servers yet' },
	noServersDescription: {
		id: 'app.servers.empty.description',
		defaultMessage: 'Servers you host or connect to will show up here.',
	},
})
const breadcrumb = useRootBreadcrumb({
	slot: 'root',
	id: 'servers',
	label: formatMessage(messages.servers),
	to: '/servers',
	visual: { type: 'icon', component: ServerStackIcon },
})
onActivated(breadcrumb.reset)
</script>

<template>
	<div class="box-border h-full p-6">
		<h1 class="m-0 mb-4 text-2xl font-extrabold text-contrast">{{ formatMessage(messages.servers) }}</h1>
		<EmptyState
			type="empty-inbox"
			:heading="formatMessage(messages.noServersHeading)"
			:description="formatMessage(messages.noServersDescription)"
		/>
	</div>
</template>
