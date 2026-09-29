<script setup lang="ts">
import { ServerStackIcon } from '@modrinth/assets'
import { defineMessages, useVIntl } from '@modrinth/ui'
import { onActivated, provide, ref } from 'vue'

import ServersLibrarySection from '@/components/ui/servers-library/index.vue'
import NewServerModal from '@/components/ui/servers-library/new-server-modal.vue'
import { useAppEvent } from '@/composables/use-app-event'
import { applyServerProcessEvent, servers } from '@/helpers/server'
import { useRootBreadcrumb } from '@/providers/breadcrumbs'

useAppEvent('process', applyServerProcessEvent)

defineOptions({ name: 'ServersPage' })

const { formatMessage } = useVIntl()
const messages = defineMessages({
	servers: { id: 'app.servers.heading', defaultMessage: 'Servers' },
})
const breadcrumb = useRootBreadcrumb({
	slot: 'root',
	id: 'servers',
	label: formatMessage(messages.servers),
	to: '/servers',
	visual: { type: 'icon', component: ServerStackIcon },
})
onActivated(breadcrumb.reset)

const isNewServerModalOpen = ref(false)
provide('showNewServerModal', () => {
	isNewServerModalOpen.value = true
})
</script>

<template>
	<div data-servers-library-page-background class="flex flex-col gap-3 p-6">
		<ServersLibrarySection :instances="servers" />
	</div>
	<NewServerModal v-model="isNewServerModalOpen" />
</template>
